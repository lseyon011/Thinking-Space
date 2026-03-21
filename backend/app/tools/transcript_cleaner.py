"""
Clean timestamped transcripts into structured markdown with section headings.

Input:
- Transcript blocks with timestamps, e.g.:
  (0s):
  Text...
  (1m 24s):
  Text...
- Section headings list with timestamps, e.g.:
  00:00:00 Title
  00:00:37 Title

Output:
- Markdown with headings:
  ## 00:00:00 Title
  Text...
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import re
from typing import Optional


@dataclass
class TranscriptOptions:
    heading_level: int = 2


HEADING_LINE_RE = re.compile(r"^(?:\d{1,2}:)?\d{1,2}:\d{2}\s+.+$")
TIMESTAMP_LINE_RE = re.compile(r"^\(([^)]+)\):\s*(.*)$")
TIMESTAMP_ONLY_LINE_RE = re.compile(r"^((?:\d{1,2}:)?\d{1,2}:\d{2})\s*$")
COMPACT_TIMESTAMP_LINE_RE = re.compile(r"^((?:\d{1,2}:)?\d{1,2}:\d{2})(.*)$")
INLINE_TIMESTAMP_RE = re.compile(r"^\s*(?:\(\s*[^)]+\s*\)|\d{1,2}:\d{2}:\d{2}|\d{1,2}:\d{2})\s*:?\\s*")
COMPACT_TIMESTAMP_FRAGMENT_RE = re.compile(
    r"(^|[\s([{\"'“‘.,!?;:-])"
    r"(?:(?:\d{1,2}:)?\d{1,2}:\d{2})(?:\d{1,4}\s*seconds?)?"
    r"(?=[A-Za-z])"
)
TIMESTAMP_ANY_RE = re.compile(
    r"\(\s*\d+\s*h\s*\d+\s*m\s*\d+\s*s\s*\)"
    r"|\(\s*\d+\s*m\s*\d+\s*s\s*\)"
    r"|\(\s*\d+\s*s\s*\)"
    r"|\b\d{1,2}:\d{2}:\d{2}\b"
    r"|\b\d{1,2}:\d{2}\b"
)


def _parse_time_to_seconds(value: str) -> Optional[int]:
    value = value.strip()
    if not value:
        return None

    if ":" in value:
        parts = value.split(":")
        try:
            parts = [int(p) for p in parts]
        except ValueError:
            return None
        if len(parts) == 3:
            h, m, s = parts
        elif len(parts) == 2:
            h = 0
            m, s = parts
        else:
            h = 0
            m = 0
            s = parts[0]
        return h * 3600 + m * 60 + s

    if any(ch.isalpha() for ch in value):
        h = m = s = 0
        match = re.search(r"(\d+)\s*h", value)
        if match:
            h = int(match.group(1))
        match = re.search(r"(\d+)\s*m", value)
        if match:
            m = int(match.group(1))
        match = re.search(r"(\d+)\s*s", value)
        if match:
            s = int(match.group(1))
        return h * 3600 + m * 60 + s

    if value.isdigit():
        return int(value)

    return None


def _format_time(seconds: int) -> str:
    h = seconds // 3600
    m = (seconds % 3600) // 60
    s = seconds % 60
    return f"{h:02d}:{m:02d}:{s:02d}"


def _strip_repeated_duration_prefix(raw: str) -> str:
    next_value = re.sub(r"^[\s:,-]+", "", raw)
    repeated_duration_match = re.match(r"^(\d{1,4})(?:\s*)seconds?", next_value, flags=re.IGNORECASE)
    if repeated_duration_match:
        next_value = next_value[repeated_duration_match.end():]
    return re.sub(r"^[\s:,-]+", "", next_value)


def _parse_compact_timestamp_line(line: str) -> Optional[tuple[int, str]]:
    match = COMPACT_TIMESTAMP_LINE_RE.match(line)
    if not match:
        return None
    timestamp = _parse_time_to_seconds(match.group(1))
    if timestamp is None:
        return None
    return timestamp, _strip_repeated_duration_prefix(match.group(2))


def _strip_timestamp_fragments(raw: str) -> str:
    next_value = COMPACT_TIMESTAMP_FRAGMENT_RE.sub(r"\1", raw)
    next_value = TIMESTAMP_ANY_RE.sub("", next_value)
    return re.sub(r"\s{2,}", " ", next_value).strip()


def _extract_heading_lines(lines: list[str]) -> tuple[list[str], list[str]]:
    heading_lines: list[str] = []
    content_lines = lines[:]

    i = len(lines) - 1
    while i >= 0 and not lines[i].strip():
        i -= 1

    while i >= 0:
        line = lines[i].strip()
        if not line:
            i -= 1
            continue
        if HEADING_LINE_RE.match(line):
            heading_lines.append(lines[i])
            i -= 1
            continue
        break

    if heading_lines:
        heading_lines.reverse()
        content_lines = lines[: i + 1]
        return content_lines, heading_lines

    # Also support transcripts where heading rows are provided first,
    # followed by timestamp-only transcript blocks.
    j = 0
    while j < len(lines) and not lines[j].strip():
        j += 1

    top_heading_lines: list[str] = []
    while j < len(lines) and HEADING_LINE_RE.match(lines[j].strip()):
        top_heading_lines.append(lines[j])
        j += 1

    if top_heading_lines:
        while j < len(lines) and not lines[j].strip():
            j += 1
        remaining = lines[j:]
        has_timestamp_blocks = any(
            TIMESTAMP_LINE_RE.match(line.strip())
            or TIMESTAMP_ONLY_LINE_RE.match(line.strip())
            or _parse_compact_timestamp_line(line.strip()) is not None
            for line in remaining
        )
        if has_timestamp_blocks:
            return remaining, top_heading_lines

    return content_lines, heading_lines


def _parse_heading_map(heading_lines: list[str]) -> dict[int, str]:
    headings: dict[int, str] = {}
    for line in heading_lines:
        parts = line.strip().split(" ", 1)
        if len(parts) < 2:
            continue
        ts, title = parts[0], parts[1].strip()
        seconds = _parse_time_to_seconds(ts)
        if seconds is None:
            continue
        headings[seconds] = title
    return headings


def _closest_heading(headings: dict[int, str], timestamp: int) -> Optional[tuple[int, str]]:
    if timestamp in headings:
        return timestamp, headings[timestamp]
    earlier = [t for t in headings.keys() if t <= timestamp]
    if not earlier:
        return None
    t = max(earlier)
    return t, headings[t]


def clean_transcript(
    transcript_text: str,
    headings_text: str | None = None,
    options: TranscriptOptions | None = None,
) -> str:
    if options is None:
        options = TranscriptOptions()

    transcript_lines = transcript_text.splitlines()
    if headings_text and headings_text.strip():
        heading_lines = headings_text.splitlines()
        content_lines = transcript_lines
    else:
        content_lines, heading_lines = _extract_heading_lines(transcript_lines)
    headings = _parse_heading_map(heading_lines)

    blocks: list[tuple[int, list[str]]] = []
    current_ts: Optional[int] = None
    current_lines: list[str] = []

    def flush() -> None:
        nonlocal current_ts, current_lines
        if current_ts is None:
            current_lines = []
            return
        text_lines = [ln.strip() for ln in current_lines if ln.strip()]
        blocks.append((current_ts, text_lines))
        current_lines = []

    for line in content_lines:
        stripped = line.strip()
        match = TIMESTAMP_LINE_RE.match(stripped)
        if match:
            flush()
            ts_raw = match.group(1)
            remainder = match.group(2).strip()
            ts_seconds = _parse_time_to_seconds(ts_raw)
            current_ts = ts_seconds if ts_seconds is not None else None
            if remainder:
                current_lines.append(remainder)
            continue

        ts_only_match = TIMESTAMP_ONLY_LINE_RE.match(stripped)
        if ts_only_match:
            flush()
            ts_seconds = _parse_time_to_seconds(ts_only_match.group(1))
            current_ts = ts_seconds if ts_seconds is not None else None
            continue

        compact_match = _parse_compact_timestamp_line(stripped)
        if compact_match:
            flush()
            current_ts, remainder = compact_match
            if remainder:
                current_lines.append(remainder)
            continue

        if current_ts is None:
            continue
        cleaned_line = INLINE_TIMESTAMP_RE.sub("", line)
        current_lines.append(cleaned_line)

    flush()

    heading_prefix = "#" * max(1, min(6, options.heading_level))
    output_lines: list[str] = []
    last_heading_key: Optional[int] = None
    for ts, block_lines in blocks:
        heading = _closest_heading(headings, ts)
        heading_key = heading[0] if heading else None
        title = heading[1].strip() if heading else ""
        title = _strip_timestamp_fragments(title)
        if not title:
            title = "Section"
        if heading_key != last_heading_key:
            output_lines.append(f"{heading_prefix} {title}")
            last_heading_key = heading_key
        if block_lines:
            paragraph = " ".join(block_lines)
            paragraph = _strip_timestamp_fragments(paragraph)
            output_lines.append(f"• {paragraph}")
        output_lines.append("")

    return "\n".join(output_lines).strip() + "\n"


def clean_transcript_file(
    input_path: str | Path,
    output_path: str | Path | None = None,
    options: TranscriptOptions | None = None,
    headings_text: str | None = None,
) -> tuple[str, Path]:
    if options is None:
        options = TranscriptOptions()

    in_path = Path(input_path)
    if not in_path.exists():
        raise FileNotFoundError(f"File not found: {in_path}")

    text = in_path.read_text(encoding="utf-8")
    cleaned = clean_transcript(text, headings_text=headings_text, options=options)

    out_path = Path(output_path) if output_path else in_path
    out_path.write_text(cleaned, encoding="utf-8")
    return cleaned, out_path
