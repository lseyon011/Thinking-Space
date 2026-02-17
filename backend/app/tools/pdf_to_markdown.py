"""
PDF to Markdown converter.

Uses PyMuPDF (fitz) to extract text from PDFs and convert to markdown format.
"""

from __future__ import annotations

import re
from pathlib import Path
from dataclasses import dataclass

import fitz  # PyMuPDF


@dataclass
class PdfConvertOptions:
    preserve_layout: bool = True
    extract_images: bool = False
    page_breaks: bool = True


def clean_text(text: str) -> str:
    """Clean extracted text."""
    # Fix common OCR/extraction issues
    text = re.sub(r'[ \t]+', ' ', text)  # Collapse multiple spaces
    text = re.sub(r'\n{3,}', '\n\n', text)  # Limit blank lines
    text = re.sub(r' +\n', '\n', text)  # Remove trailing spaces
    text = re.sub(r'\n +', '\n', text)  # Remove leading spaces on lines
    return text.strip()


def detect_headings(text: str) -> str:
    """Try to detect and format headings based on patterns."""
    lines = text.split('\n')
    result = []

    for i, line in enumerate(lines):
        stripped = line.strip()
        if not stripped:
            result.append(line)
            continue

        # Detect potential headings: short lines, all caps, or numbered sections
        is_short = len(stripped) < 80
        is_all_caps = stripped.isupper() and len(stripped) > 3
        is_numbered = re.match(r'^(?:Chapter|Part|Section|\d+[\.\):])\s+', stripped, re.IGNORECASE)

        # Check if next line is empty (common heading pattern)
        next_is_empty = (i + 1 < len(lines) and not lines[i + 1].strip())
        prev_is_empty = (i > 0 and not lines[i - 1].strip())

        if is_numbered and is_short:
            result.append(f"## {stripped}")
        elif is_all_caps and is_short and (next_is_empty or prev_is_empty):
            result.append(f"## {stripped.title()}")
        else:
            result.append(line)

    return '\n'.join(result)


def extract_page(page: fitz.Page, options: PdfConvertOptions) -> str:
    """Extract text from a single page."""
    if options.preserve_layout:
        # Use text extraction with layout preservation
        text = page.get_text("text", sort=True)
    else:
        # Simple text extraction
        text = page.get_text()

    return clean_text(text)


def pdf_to_markdown(
    pdf_path: str | Path,
    options: PdfConvertOptions | None = None,
) -> str:
    """
    Convert a PDF file to markdown.

    Args:
        pdf_path: Path to the PDF file
        options: Conversion options

    Returns:
        Markdown formatted text
    """
    if options is None:
        options = PdfConvertOptions()

    pdf_path = Path(pdf_path)
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    doc = fitz.open(pdf_path)
    pages = []

    for page_num in range(len(doc)):
        page = doc[page_num]
        text = extract_page(page, options)

        if text:
            if options.page_breaks and page_num > 0:
                pages.append(f"\n---\n\n<!-- Page {page_num + 1} -->\n")
            pages.append(text)

    doc.close()

    # Combine pages
    result = '\n\n'.join(pages)

    # Try to detect and format headings
    result = detect_headings(result)

    # Final cleanup
    result = re.sub(r'\n{3,}', '\n\n', result)

    return result


def convert_pdf_file(
    input_path: str | Path,
    output_path: str | Path | None = None,
    options: PdfConvertOptions | None = None,
) -> tuple[str, Path]:
    """
    Convert a PDF file to markdown and save.

    Args:
        input_path: Path to input PDF
        output_path: Path for output markdown (defaults to same name with .md)
        options: Conversion options

    Returns:
        Tuple of (markdown_content, output_path)
    """
    if options is None:
        options = PdfConvertOptions()

    in_path = Path(input_path)
    markdown = pdf_to_markdown(in_path, options)

    if output_path is None:
        out_path = in_path.with_suffix('.md')
    else:
        out_path = Path(output_path)

    out_path.write_text(markdown, encoding='utf-8')

    return markdown, out_path
