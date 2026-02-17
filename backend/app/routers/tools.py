"""
API endpoints for vault management tools.
"""

from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.tools.format_for_excalidraw import FormatOptions, format_markdown, format_file
from app.tools.pdf_to_markdown import PdfConvertOptions, pdf_to_markdown, convert_pdf_file
from app.tools.git_insights import get_git_insights, GitInsightsOptions, GitRepoError
from app.tools.transcript_cleaner import (
    TranscriptOptions,
    clean_transcript,
    clean_transcript_file,
)
from app.tools.file_activity import get_month_activity, get_day_activity, get_section_month_activity
from app.tools.todo_scanner import (
    get_todos_month,
    get_todos_section_month,
    toggle_todo,
    create_todo,
)
from app.tools.thoughts_scanner import (
    get_thoughts_month,
    get_thoughts_section_month,
)
from app.services.lego_blocks.vault_constants_block import EXCLUDED_DIRS
from app.services.lego_blocks.vault_path_block import get_vault_root_block

router = APIRouter()

# Vault root path — read from LTM_PILOT_VAULT_ROOT env var (loaded by dotenv in main.py)
VAULT_ROOT = get_vault_root_block()


class FormatExcalidrawRequest(BaseModel):
    input_path: str = Field(..., description="Path to the markdown file (relative to vault root)")
    output_path: Optional[str] = Field(None, description="Output path (defaults to in-place)")
    options: Optional[dict] = Field(
        default_factory=dict,
        description="Formatting options",
        examples=[{
            "normalize_book": True,
            "strip_fences": True,
            "split_long_paragraphs": False,
            "join_lines": True
        }]
    )


class FormatExcalidrawResponse(BaseModel):
    success: bool
    output_path: str
    preview: str = Field(..., description="First 500 chars of formatted output")
    message: str


class FileListResponse(BaseModel):
    files: list[str]
    count: int


class PreviewRequest(BaseModel):
    input_path: str
    options: Optional[dict] = Field(default_factory=dict)


class PreviewResponse(BaseModel):
    original: str
    formatted: str
    original_lines: int
    formatted_lines: int


@router.get("/files", response_model=FileListResponse)
async def list_markdown_files(pattern: str = "**/*.md", limit: int = 100):
    """List markdown files in the vault."""
    try:
        files = []
        for p in VAULT_ROOT.glob(pattern):
            # Skip hidden files and directories, node_modules, .venv, etc.
            parts = p.relative_to(VAULT_ROOT).parts
            if any(part.startswith('.') or part in ('node_modules', '__pycache__', '.venv') for part in parts):
                continue
            # Skip excalidraw files for this tool
            if '.excalidraw' in p.name:
                continue
            if p.is_file():
                files.append(str(p.relative_to(VAULT_ROOT)))
                if len(files) >= limit:
                    break

        files.sort()
        return FileListResponse(files=files, count=len(files))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/format-excalidraw/preview", response_model=PreviewResponse)
async def preview_format(request: PreviewRequest):
    """Preview formatting without writing to file."""
    try:
        input_path = VAULT_ROOT / request.input_path
        if not input_path.exists():
            raise HTTPException(status_code=404, detail=f"File not found: {request.input_path}")

        original = input_path.read_text(encoding="utf-8")

        opts = FormatOptions(
            normalize_book=request.options.get("normalize_book", True),
            strip_fences=request.options.get("strip_fences", True),
            split_long_paragraphs=request.options.get("split_long_paragraphs", False),
            join_lines=request.options.get("join_lines", True),
        )

        formatted = format_markdown(original, opts)

        return PreviewResponse(
            original=original[:2000] + ("..." if len(original) > 2000 else ""),
            formatted=formatted[:2000] + ("..." if len(formatted) > 2000 else ""),
            original_lines=len(original.splitlines()),
            formatted_lines=len(formatted.splitlines()),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/format-excalidraw", response_model=FormatExcalidrawResponse)
async def format_excalidraw(request: FormatExcalidrawRequest):
    """Format a markdown file for Excalidraw mindmap import."""
    try:
        input_path = VAULT_ROOT / request.input_path

        # Generate output path: same folder, with "(formatted for excalidraw)" suffix
        if request.output_path:
            output_path = VAULT_ROOT / request.output_path
        else:
            stem = input_path.stem
            output_path = input_path.parent / f"{stem} (formatted for excalidraw).md"

        opts = FormatOptions(
            normalize_book=request.options.get("normalize_book", True),
            strip_fences=request.options.get("strip_fences", True),
            split_long_paragraphs=request.options.get("split_long_paragraphs", False),
            join_lines=request.options.get("join_lines", True),
        )

        formatted, out_path = format_file(input_path, output_path, opts)

        return FormatExcalidrawResponse(
            success=True,
            output_path=str(out_path.relative_to(VAULT_ROOT)),
            preview=formatted[:500] + ("..." if len(formatted) > 500 else ""),
            message=f"Formatted successfully: {out_path.name}",
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# PDF to Markdown
# =============================================================================

class PdfToMarkdownRequest(BaseModel):
    input_path: str = Field(..., description="Path to the PDF file (relative to vault root)")
    output_path: Optional[str] = Field(None, description="Output path (defaults to same name with .md)")
    options: Optional[dict] = Field(
        default_factory=dict,
        description="Conversion options",
        examples=[{
            "preserve_layout": True,
            "page_breaks": True
        }]
    )


class PdfToMarkdownResponse(BaseModel):
    success: bool
    output_path: str
    preview: str
    page_count: int
    message: str


class PdfPreviewRequest(BaseModel):
    input_path: str
    options: Optional[dict] = Field(default_factory=dict)


class PdfPreviewResponse(BaseModel):
    preview: str
    page_count: int
    total_chars: int


class GitInsightsResponse(BaseModel):
    success: bool
    data: dict
    message: str


class TranscriptCleanRequest(BaseModel):
    input_text: Optional[str] = None
    headings_text: Optional[str] = None
    input_path: Optional[str] = None
    output_path: Optional[str] = None
    output_folder: Optional[str] = None
    output_name: Optional[str] = None
    base_folder: Optional[str] = None
    options: Optional[dict] = Field(default_factory=dict)


class TranscriptCleanResponse(BaseModel):
    success: bool
    output_path: Optional[str]
    preview: str
    message: str


@router.get("/pdf-files", response_model=FileListResponse)
async def list_pdf_files(limit: int = 500):
    """List PDF files in the vault."""
    try:
        files = []
        for p in VAULT_ROOT.glob("**/*.pdf"):
            parts = p.relative_to(VAULT_ROOT).parts
            if any(part.startswith('.') or part in ('node_modules', '__pycache__', '.venv') for part in parts):
                continue
            if p.is_file():
                files.append(str(p.relative_to(VAULT_ROOT)))
                if len(files) >= limit:
                    break

        files.sort()
        return FileListResponse(files=files, count=len(files))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/folders", response_model=FileListResponse)
async def list_folders(pattern: str = "**/*", limit: int = 500):
    """List folders in the vault."""
    try:
        folders: list[str] = []
        for p in VAULT_ROOT.glob(pattern):
            if not p.is_dir():
                continue
            parts = p.relative_to(VAULT_ROOT).parts
            if any(part.startswith('.') or part in ('node_modules', '__pycache__', '.venv') for part in parts):
                continue
            folders.append(str(p.relative_to(VAULT_ROOT)))
            if len(folders) >= limit:
                break
        folders.sort()
        return FileListResponse(files=folders, count=len(folders))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/pdf-to-markdown/preview", response_model=PdfPreviewResponse)
async def preview_pdf(request: PdfPreviewRequest):
    """Preview PDF to markdown conversion."""
    try:
        input_path = VAULT_ROOT / request.input_path
        if not input_path.exists():
            raise HTTPException(status_code=404, detail=f"File not found: {request.input_path}")

        opts = PdfConvertOptions(
            preserve_layout=request.options.get("preserve_layout", True),
            page_breaks=request.options.get("page_breaks", True),
        )

        import fitz
        doc = fitz.open(input_path)
        page_count = len(doc)
        doc.close()

        markdown = pdf_to_markdown(input_path, opts)

        return PdfPreviewResponse(
            preview=markdown[:3000] + ("..." if len(markdown) > 3000 else ""),
            page_count=page_count,
            total_chars=len(markdown),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/pdf-to-markdown", response_model=PdfToMarkdownResponse)
async def convert_pdf(request: PdfToMarkdownRequest):
    """Convert a PDF file to markdown."""
    try:
        input_path = VAULT_ROOT / request.input_path

        if request.output_path:
            output_path = VAULT_ROOT / request.output_path
        else:
            output_path = input_path.with_suffix('.md')

        opts = PdfConvertOptions(
            preserve_layout=request.options.get("preserve_layout", True),
            page_breaks=request.options.get("page_breaks", True),
        )

        import fitz
        doc = fitz.open(input_path)
        page_count = len(doc)
        doc.close()

        markdown, out_path = convert_pdf_file(input_path, output_path, opts)

        return PdfToMarkdownResponse(
            success=True,
            output_path=str(out_path.relative_to(VAULT_ROOT)),
            preview=markdown[:500] + ("..." if len(markdown) > 500 else ""),
            page_count=page_count,
            message=f"Converted {page_count} pages to markdown",
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class FileActivityMonthResponse(BaseModel):
    success: bool
    data: dict


class FileActivityDayResponse(BaseModel):
    success: bool
    data: dict


@router.get("/file-activity/month", response_model=FileActivityMonthResponse)
async def file_activity_month(year: int, month: int):
    """Get day-level file created/modified counts for a given month."""
    try:
        if not (1 <= month <= 12):
            raise HTTPException(status_code=400, detail="Month must be 1-12")
        if not (2000 <= year <= 2100):
            raise HTTPException(status_code=400, detail="Year out of range")
        data = get_month_activity(VAULT_ROOT, year, month)
        return FileActivityMonthResponse(success=True, data=data)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/file-activity/day", response_model=FileActivityDayResponse)
async def file_activity_day(date: str):
    """Get file lists for a specific day."""
    try:
        from datetime import date as date_cls
        target = date_cls.fromisoformat(date)
        data = get_day_activity(VAULT_ROOT, target)
        return FileActivityDayResponse(success=True, data=data)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format, use YYYY-MM-DD")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/file-activity/section-month", response_model=FileActivityDayResponse)
async def file_activity_section_month(year: int, month: int, section: str):
    """Get all files for a specific section in a given month, grouped by date."""
    try:
        if not (1 <= month <= 12):
            raise HTTPException(status_code=400, detail="Month must be 1-12")
        if not (2000 <= year <= 2100):
            raise HTTPException(status_code=400, detail="Year out of range")
        if not section:
            raise HTTPException(status_code=400, detail="Section is required")
        data = get_section_month_activity(VAULT_ROOT, year, month, section)
        return FileActivityDayResponse(success=True, data=data)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/git-insights", response_model=GitInsightsResponse)
async def git_insights(days: int = 365):
    """Get git insights similar to GitHub's Insights tab."""
    try:
        options = GitInsightsOptions(days=days)
        data = get_git_insights(VAULT_ROOT, options)
        return GitInsightsResponse(
            success=True,
            data=data,
            message=f"Loaded git insights for last {days} days",
        )
    except GitRepoError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/clean-transcript/preview", response_model=TranscriptCleanResponse)
async def preview_clean_transcript(request: TranscriptCleanRequest):
    """Preview transcript cleaning without writing to file."""
    try:
        if request.input_path:
            input_path = VAULT_ROOT / request.input_path
            if not input_path.exists():
                raise HTTPException(status_code=404, detail=f"File not found: {request.input_path}")
            text = input_path.read_text(encoding="utf-8")
        else:
            text = request.input_text or ""
        headings_text = request.headings_text or None

        opts = TranscriptOptions(
            heading_level=request.options.get("heading_level", 2),
        )

        cleaned = clean_transcript(text, headings_text=headings_text, options=opts)
        return TranscriptCleanResponse(
            success=True,
            output_path=None,
            preview=cleaned[:2000] + ("..." if len(cleaned) > 2000 else ""),
            message="Preview generated",
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/clean-transcript", response_model=TranscriptCleanResponse)
async def clean_transcript_endpoint(request: TranscriptCleanRequest):
    """Clean transcript and optionally write to file."""
    try:
        if request.input_path:
            input_path = VAULT_ROOT / request.input_path
            if request.output_path:
                output_path = VAULT_ROOT / request.output_path
            else:
                output_path = input_path
            opts = TranscriptOptions(
                heading_level=request.options.get("heading_level", 2),
            )
            cleaned, out_path = clean_transcript_file(
                input_path,
                output_path,
                opts,
                headings_text=request.headings_text,
            )
            return TranscriptCleanResponse(
                success=True,
                output_path=str(out_path.relative_to(VAULT_ROOT)),
                preview=cleaned[:2000] + ("..." if len(cleaned) > 2000 else ""),
                message="Transcript cleaned and saved",
            )

        text = request.input_text or ""
        headings_text = request.headings_text or None
        opts = TranscriptOptions(
            heading_level=request.options.get("heading_level", 2),
        )
        cleaned = clean_transcript(text, headings_text=headings_text, options=opts)
        if request.output_folder and request.output_name:
            base_folder = VAULT_ROOT
            if request.base_folder:
                base_folder = VAULT_ROOT / request.base_folder
            output_dir = base_folder / request.output_folder
            output_dir.mkdir(parents=True, exist_ok=True)
            output_file = output_dir / f"{request.output_name}.md"
            output_file.write_text(cleaned, encoding="utf-8")
            return TranscriptCleanResponse(
                success=True,
                output_path=str(output_file.relative_to(VAULT_ROOT)),
                preview=cleaned[:2000] + ("..." if len(cleaned) > 2000 else ""),
                message="Transcript cleaned and saved",
            )
        return TranscriptCleanResponse(
            success=True,
            output_path=None,
            preview=cleaned[:2000] + ("..." if len(cleaned) > 2000 else ""),
            message="Transcript cleaned",
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Child Folders + New Thought
# =============================================================================

class NewThoughtRequest(BaseModel):
    folder_path: str = Field(..., description="Relative path from vault root")
    filename: str = Field(..., description="e.g. 2026-02-09.md")
    content: str = Field(..., description="Markdown body")
    title: Optional[str] = Field(None, description="If provided, prepended as # Title")
    date_header: bool = Field(True, description="Insert formatted date line below title")
    emotions: Optional[list[str]] = Field(default_factory=list, description="Emotion tags")


class NewThoughtResponse(BaseModel):
    success: bool
    output_path: str
    message: str


@router.get("/file-content")
async def get_file_content(path: str):
    """Read raw text content of a vault file."""
    try:
        target = (VAULT_ROOT / path).resolve()
        target.relative_to(VAULT_ROOT.resolve())
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid path")

    if not target.is_file():
        raise HTTPException(status_code=404, detail=f"File not found: {path}")

    size = target.stat().st_size
    # Obsidian Excalidraw markdown files can be very large (multi-MB), so
    # keep a practical safety limit instead of a strict 1 MB cap.
    max_size_bytes = 50 * 1024 * 1024
    if size > max_size_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds {max_size_bytes // (1024 * 1024)} MB limit",
        )

    try:
        content = target.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=415, detail="File is not a text file")

    return {"path": path, "content": content, "size_bytes": size}


class FileStatsRequest(BaseModel):
    paths: list[str] = Field(..., description="List of vault-relative file paths")


@router.post("/file-stats")
async def get_file_stats(request: FileStatsRequest):
    """Return lightweight stats (lines, words, size) for a batch of files."""
    results = []
    vault_resolved = VAULT_ROOT.resolve()
    for p in request.paths:
        try:
            target = (VAULT_ROOT / p).resolve()
            target.relative_to(vault_resolved)
        except ValueError:
            continue
        if not target.is_file():
            continue
        try:
            content = target.read_text(encoding="utf-8")
            results.append({
                "path": p,
                "lines": content.count('\n') + (1 if content else 0),
                "words": len(content.split()),
                "size_bytes": target.stat().st_size,
            })
        except (UnicodeDecodeError, OSError):
            continue
    return {"stats": results}


@router.get("/child-folders", response_model=FileListResponse)
async def list_child_folders(path: str = ""):
    """Return immediate child directory names for a given vault-relative path."""
    try:
        if path:
            target = (VAULT_ROOT / path).resolve()
            target.relative_to(VAULT_ROOT.resolve())
        else:
            target = VAULT_ROOT

        if not target.is_dir():
            raise HTTPException(status_code=404, detail=f"Not a directory: {path}")

        children = []
        for item in sorted(target.iterdir()):
            if not item.is_dir():
                continue
            name = item.name
            if name.startswith('.') or name in EXCLUDED_DIRS:
                continue
            children.append(name)

        return FileListResponse(files=children, count=len(children))
    except HTTPException:
        raise
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid path")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/new-thought", response_model=NewThoughtResponse)
async def create_new_thought(request: NewThoughtRequest):
    """Write a markdown thought file to the selected folder."""
    try:
        if '/' in request.filename or '\\' in request.filename:
            raise HTTPException(status_code=400, detail="Filename must not contain path separators")

        target_dir = (VAULT_ROOT / request.folder_path).resolve()
        target_dir.relative_to(VAULT_ROOT.resolve())

        target_dir.mkdir(parents=True, exist_ok=True)

        output_file = target_dir / request.filename
        if output_file.exists():
            raise HTTPException(
                status_code=409,
                detail=f"File already exists: {request.folder_path}/{request.filename}",
            )

        parts = []

        emotions = [e for e in (request.emotions or []) if e and e.strip()]
        if emotions:
            parts.append("---")
            parts.append("emotions:")
            for emotion in emotions:
                safe = emotion.replace('"', '\\"')
                parts.append(f'  - "{safe}"')
            parts.append("---")
            parts.append("")
        if request.title:
            parts.append(f"# {request.title}")
            parts.append("")

        if request.date_header:
            from datetime import date
            today = date.today()
            day_name = today.strftime("%A")
            month_name = today.strftime("%B")
            parts.append(f"*{day_name}, {month_name} {today.day}, {today.year}*")
            parts.append("")

        parts.append(request.content)

        output_file.write_text("\n".join(parts), encoding="utf-8")

        rel_path = str(output_file.relative_to(VAULT_ROOT))
        return NewThoughtResponse(
            success=True,
            output_path=rel_path,
            message=f"Saved to {rel_path}",
        )
    except HTTPException:
        raise
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid path")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Todos
# =============================================================================

class TodoCreateRequest(BaseModel):
    folder_path: str = Field(..., description="Relative path to the todos folder")
    date: str = Field(..., description="Date string YYYY-MM-DD, becomes filename")
    items: list[str] = Field(..., description="List of task texts")


class TodoToggleRequest(BaseModel):
    file_path: str = Field(..., description="Relative path to the todo .md file")
    line_number: int = Field(..., description="1-based line number of the checkbox")


@router.get("/todos/month")
async def todos_month(year: int, month: int):
    """Get calendar-level todo counts for a month."""
    try:
        if not (1 <= month <= 12):
            raise HTTPException(status_code=400, detail="Month must be 1-12")
        if not (2000 <= year <= 2100):
            raise HTTPException(status_code=400, detail="Year out of range")
        data = get_todos_month(VAULT_ROOT, year, month)
        return {"success": True, "data": data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/todos/section-month")
async def todos_section_month(year: int, month: int, sections: str):
    """Get todo items for specific sections in a month. Sections are comma-separated."""
    try:
        if not (1 <= month <= 12):
            raise HTTPException(status_code=400, detail="Month must be 1-12")
        if not (2000 <= year <= 2100):
            raise HTTPException(status_code=400, detail="Year out of range")
        if not sections.strip():
            raise HTTPException(status_code=400, detail="Sections parameter is required")
        section_list = [s.strip() for s in sections.split(",") if s.strip()]
        data = get_todos_section_month(VAULT_ROOT, year, month, section_list)
        return {"success": True, "data": data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/todos/create")
async def todos_create(request: TodoCreateRequest):
    """Create (or append to) a todo file."""
    try:
        data = create_todo(VAULT_ROOT, request.folder_path, request.date, request.items)
        return {"success": True, **data}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/todos/toggle")
async def todos_toggle(request: TodoToggleRequest):
    """Toggle a checkbox in a todo file."""
    try:
        data = toggle_todo(VAULT_ROOT, request.file_path, request.line_number)
        return {"success": True, **data}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Thoughts
# =============================================================================

@router.get("/thoughts/month")
async def thoughts_month(year: int, month: int):
    """Get calendar-level thought counts for a month."""
    try:
        if not (1 <= month <= 12):
            raise HTTPException(status_code=400, detail="Month must be 1-12")
        if not (2000 <= year <= 2100):
            raise HTTPException(status_code=400, detail="Year out of range")
        data = get_thoughts_month(VAULT_ROOT, year, month)
        return {"success": True, "data": data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/thoughts/section-month")
async def thoughts_section_month(year: int, month: int, sections: str):
    """Get thought items for specific sections in a month. Sections are comma-separated."""
    try:
        if not (1 <= month <= 12):
            raise HTTPException(status_code=400, detail="Month must be 1-12")
        if not (2000 <= year <= 2100):
            raise HTTPException(status_code=400, detail="Year out of range")
        if not sections.strip():
            raise HTTPException(status_code=400, detail="Sections parameter is required")
        section_list = [s.strip() for s in sections.split(",") if s.strip()]
        data = get_thoughts_section_month(VAULT_ROOT, year, month, section_list)
        return {"success": True, "data": data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Raw Vault Filesystem (for WebVaultFS)
# =============================================================================

_VAULT_EXCLUDED = EXCLUDED_DIRS


@router.get("/vault/walk")
async def vault_walk(extensions: str = ".md"):
    """Walk entire vault, return all files with stat info."""
    import os, time as _time
    ext_set = {e.strip() for e in extensions.split(",") if e.strip()}
    root_str = str(VAULT_ROOT)
    files = []
    for dirpath, dirnames, filenames in os.walk(root_str):
        dirnames[:] = [d for d in dirnames if d not in _VAULT_EXCLUDED and not d.startswith(".")]
        for fname in filenames:
            if fname.startswith("."):
                continue
            ext = os.path.splitext(fname)[1].lower()
            if ext not in ext_set:
                continue
            full = os.path.join(dirpath, fname)
            try:
                st = os.stat(full)
            except OSError:
                continue
            rel = os.path.relpath(full, root_str)
            files.append({
                "path": rel,
                "size": st.st_size,
                "mtime": st.st_mtime,
                "birthtime": getattr(st, "st_birthtime", st.st_ctime),
            })
    return {"files": files, "count": len(files)}


@router.get("/vault/readdir")
async def vault_readdir(path: str = ""):
    """List immediate children of a vault directory."""
    import os
    if path:
        target = (VAULT_ROOT / path).resolve()
        target.relative_to(VAULT_ROOT.resolve())
    else:
        target = VAULT_ROOT
    if not target.is_dir():
        raise HTTPException(status_code=404, detail=f"Not a directory: {path}")
    entries = []
    for name in sorted(os.listdir(target)):
        if name.startswith(".") or name in _VAULT_EXCLUDED:
            continue
        full = os.path.join(str(target), name)
        is_dir = os.path.isdir(full)
        entries.append({"name": name, "isDirectory": is_dir})
    return {"entries": entries, "count": len(entries)}


@router.get("/vault/stat")
async def vault_stat(path: str):
    """Stat a single vault file."""
    import os
    target = (VAULT_ROOT / path).resolve()
    try:
        target.relative_to(VAULT_ROOT.resolve())
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid path")
    if not target.exists():
        raise HTTPException(status_code=404, detail=f"Not found: {path}")
    st = os.stat(str(target))
    return {
        "path": path,
        "size": st.st_size,
        "mtime": st.st_mtime,
        "birthtime": getattr(st, "st_birthtime", st.st_ctime),
        "isDirectory": target.is_dir(),
    }


class VaultWriteRequest(BaseModel):
    path: str = Field(..., description="Relative path from vault root")
    content: str = Field(..., description="File content to write")


@router.post("/vault/write")
async def vault_write(request: VaultWriteRequest):
    """Write a file in the vault."""
    target = (VAULT_ROOT / request.path).resolve()
    try:
        target.relative_to(VAULT_ROOT.resolve())
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid path")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(request.content, encoding="utf-8")
    return {"success": True, "path": request.path}


class VaultMkdirRequest(BaseModel):
    path: str = Field(..., description="Relative path from vault root")


@router.post("/vault/mkdir")
async def vault_mkdir(request: VaultMkdirRequest):
    """Create a directory in the vault."""
    target = (VAULT_ROOT / request.path).resolve()
    try:
        target.relative_to(VAULT_ROOT.resolve())
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid path")
    target.mkdir(parents=True, exist_ok=True)
    return {"success": True, "path": request.path}
