"""
Markdown formatter for Excalidraw mindmap import.

Features:
- Normalize book-style PART/CHAPTER headings when detected
- Demote paragraph-like deep headings (h4-h6) back to plain text
- Strip standalone code fences
- Add double blank lines between bullets for Excalidraw visual spacing
- Clean excessive blank lines
"""

from __future__ import annotations

import re
from pathlib import Path
from dataclasses import dataclass


PART_RE = re.compile(r"^PART\s+[IVXLC]+\s*$", re.IGNORECASE)
CHAPTER_RE = re.compile(r"^(?:##\s*)?Chapter\s+(\d+)(?::\s*(.+))?$", re.IGNORECASE)
CHAPTER_LINE_RE = re.compile(r"^CHAPTER\s+(\d+)\s*$", re.IGNORECASE)
SENTENCE_SPLIT_RE = re.compile(r'(?<=[.!?])\s+(?=[A-Z"\u201c\u201d(])')


@dataclass
class FormatOptions:
    normalize_book: bool = True
    strip_fences: bool = True
    split_long_paragraphs: bool = False
    join_lines: bool = True


def looks_like_paragraph(text: str) -> bool:
    word_count = len(text.split())
    if word_count >= 18:
        return True
    if len(text) >= 80:
        return True
    if text.count(".") >= 2:
        return True
    if len(text) >= 50 and text.endswith(('.', '."', '.\u201d')):
        return True
    return False


def demote_deep_headings(lines: list[str]) -> list[str]:
    out: list[str] = []
    for line in lines:
        m = re.match(r"^(#{4,})\s+(.+)$", line.strip())
        if not m:
            out.append(line)
            continue
        content = m.group(2).strip()
        if looks_like_paragraph(content):
            out.append(content)
        else:
            out.append(line)
    return out


def normalize_book_structure(lines: list[str]) -> list[str]:
    out: list[str] = []
    i = 0
    n = len(lines)
    while i < n:
        line = lines[i]
        stripped = line.strip()

        # PART headers
        if PART_RE.match(stripped):
            part_line = stripped
            title = ""
            if i + 1 < n:
                next_line = lines[i + 1].strip()
                if next_line and not next_line.upper().startswith("CHAPTER"):
                    title = next_line
                    i += 1
            if title:
                out.append(f"\n---\n\n# {part_line}: {title}\n")
            else:
                out.append(f"\n---\n\n# {part_line}\n")
            i += 1
            continue

        # CHAPTER headers
        m = CHAPTER_RE.match(stripped)
        if not m:
            m = CHAPTER_LINE_RE.match(stripped)
        if m:
            chap_num = m.group(1)
            chap_title = m.group(2) if len(m.groups()) >= 2 else None

            if not chap_title:
                if i + 1 < n:
                    next_line = lines[i + 1].strip()
                    if next_line and not next_line.upper().startswith("CHAPTER"):
                        chap_title = next_line
                        i += 1

            if chap_title:
                out.append(f"\n## Chapter {chap_num}: {chap_title}\n")
            else:
                out.append(f"\n## Chapter {chap_num}\n")
            i += 1
            continue

        out.append(line)
        i += 1

    return out


def strip_standalone_fences(lines: list[str]) -> list[str]:
    return [ln for ln in lines if ln.strip() != "```"]


def clean_excess_newlines(text: str) -> str:
    return re.sub(r"\n{4,}", "\n\n\n", text)


def auto_detect_book(lines: list[str]) -> bool:
    for line in lines:
        s = line.strip()
        if PART_RE.match(s) or CHAPTER_RE.match(s) or CHAPTER_LINE_RE.match(s):
            return True
    return False


def _normalize_bullet_text(text: str) -> str:
    cleaned = text.strip()
    while cleaned.startswith("• "):
        cleaned = cleaned[2:].strip()
    return cleaned


def split_long_paragraph(text: str, max_len: int = 700, max_sentences: int = 3) -> list[str]:
    if len(text) <= max_len and text.count(".") < (max_sentences + 2):
        return [text]

    sentences = SENTENCE_SPLIT_RE.split(text)
    if len(sentences) <= 1:
        return [text]

    chunks: list[str] = []
    buf: list[str] = []
    buf_len = 0
    buf_sentences = 0

    for s in sentences:
        s = s.strip()
        if not s:
            continue
        add_len = len(s) + (1 if buf else 0)
        if buf and (buf_len + add_len > max_len or buf_sentences >= max_sentences):
            chunks.append(" ".join(buf).strip())
            buf = []
            buf_len = 0
            buf_sentences = 0
        if buf:
            buf_len += 1
        buf.append(s)
        buf_len += len(s)
        buf_sentences += 1

    if buf:
        chunks.append(" ".join(buf).strip())

    return chunks if chunks else [text]


def is_paragraph_end(line: str) -> bool:
    """Check if line ends a paragraph (ends with sentence-ending punctuation)."""
    stripped = line.rstrip()
    if not stripped:
        return False
    return bool(re.search(r'[.!?]["\u201c\u201d]?\s*$', stripped))


def is_paragraph_start(line: str) -> bool:
    """Check if line starts a new paragraph (starts with capital letter)."""
    stripped = line.strip()
    if not stripped:
        return False
    return stripped[0].isupper()


def bulletize_paragraphs(lines: list[str], split_long: bool, join_lines: bool) -> list[str]:
    out: list[str] = []
    para: list[str] = []

    def flush_para() -> None:
        nonlocal para
        if not para:
            return
        text = " ".join(s.strip() for s in para if s.strip())
        text = re.sub(r"\s{2,}", " ", text).strip()
        if text:
            out.append(f"• {text}")
            out.append("")
            out.append("")
        para = []

    for i, line in enumerate(lines):
        stripped = line.strip()

        if not stripped:
            flush_para()
            continue

        if stripped == "---":
            flush_para()
            out.append(line)
            continue

        if stripped.startswith("#"):
            flush_para()
            out.append(line)
            continue

        if re.match(r"^(\s*)(?:-|\*|\d+\.)\s+.+$", line):
            flush_para()
            text = re.sub(r"^(\s*)(?:-|\*|\d+\.)\s+", "", line).strip()
            out.append(f"• {_normalize_bullet_text(text)}")
            out.append("")
            out.append("")
            continue

        if re.match(r"^\s*•\s+.+$", line):
            flush_para()
            text = re.sub(r"^\s*•\s+", "", line).strip()
            out.append(f"• {_normalize_bullet_text(text)}")
            out.append("")
            out.append("")
            continue

        if para and is_paragraph_end(para[-1]) and is_paragraph_start(stripped):
            flush_para()

        para.append(line)

    flush_para()
    return out


def format_markdown(text: str, options: FormatOptions) -> str:
    """Format markdown text for Excalidraw mindmap import."""
    lines = text.splitlines()

    if options.strip_fences:
        lines = strip_standalone_fences(lines)

    # Auto-detect book structure if normalize_book is enabled
    should_normalize = options.normalize_book and auto_detect_book(lines)

    if should_normalize:
        lines = normalize_book_structure(lines)
        lines = "\n".join(lines).splitlines()

    lines = demote_deep_headings(lines)
    lines = bulletize_paragraphs(lines, options.split_long_paragraphs, options.join_lines)

    result = "\n".join(lines)
    result = clean_excess_newlines(result)
    if not result.endswith("\n"):
        result += "\n"
    return result


def format_file(
    input_path: str | Path,
    output_path: str | Path | None = None,
    options: FormatOptions | None = None,
) -> tuple[str, Path]:
    """
    Format a markdown file for Excalidraw.

    Returns:
        Tuple of (formatted_content, output_path)
    """
    if options is None:
        options = FormatOptions()

    in_path = Path(input_path)
    if not in_path.exists():
        raise FileNotFoundError(f"File not found: {in_path}")

    text = in_path.read_text(encoding="utf-8")
    formatted = format_markdown(text, options)

    out_path = Path(output_path) if output_path else in_path
    out_path.write_text(formatted, encoding="utf-8")

    return formatted, out_path
