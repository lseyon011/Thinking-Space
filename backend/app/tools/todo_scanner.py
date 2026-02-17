"""
Todo scanner: finds todos/ folders in the vault, parses checkbox lines,
aggregates by date and section.
"""

from __future__ import annotations

import os
import re
from collections import defaultdict
from datetime import date
from pathlib import Path

from app.services.lego_blocks.vault_constants_block import EXCLUDED_DIRS

_NESTED_ROOTS = {"acceleration_core", "lifeblood_systems", "operations"}

_CHECKBOX_RE = re.compile(r"^- \[([ xX])\] (.+)$")
_DATE_FILENAME_RE = re.compile(r"^\d{4}-\d{2}-\d{2}\.md$")


def _extract_section(rel_path: str) -> str:
    parts = rel_path.split(os.sep)
    if len(parts) < 2:
        return "Other"
    if parts[0] in _NESTED_ROOTS and len(parts) >= 2:
        return parts[1]
    return parts[0]


def find_todo_folders(vault_root: Path) -> list[str]:
    """Walk vault, return relative paths to folders named 'todos'."""
    results: list[str] = []
    root_str = str(vault_root)

    for dirpath, dirnames, _filenames in os.walk(root_str):
        dirnames[:] = [d for d in dirnames if d not in EXCLUDED_DIRS and not d.startswith(".")]

        basename = os.path.basename(dirpath)
        if basename == "todos":
            rel = os.path.relpath(dirpath, root_str)
            results.append(rel)

    return sorted(results)


def parse_todo_file(path: Path) -> list[dict]:
    """Read a .md file, extract checkbox lines. Returns list of {text, checked, line_number}."""
    items: list[dict] = []
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError:
        return items

    for i, line in enumerate(lines):
        m = _CHECKBOX_RE.match(line.strip())
        if m:
            checked = m.group(1).lower() == "x"
            text = m.group(2).strip()
            items.append({"text": text, "checked": checked, "line_number": i + 1})

    return items


def get_todos_month(vault_root: Path, year: int, month: int) -> dict:
    """Calendar-level counts for a month across all todo folders."""
    todo_folders = find_todo_folders(vault_root)

    month_start = date(year, month, 1)
    month_end = date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)

    # Aggregation structures
    day_totals: dict[str, dict] = {}  # date -> {total, done, pending}
    section_totals: dict[str, dict] = defaultdict(lambda: {"total": 0, "done": 0, "pending": 0})
    section_days: dict[str, dict[str, dict]] = defaultdict(dict)

    for folder_rel in todo_folders:
        folder_path = vault_root / folder_rel
        section = _extract_section(folder_rel)

        if not folder_path.is_dir():
            continue

        for fname in os.listdir(folder_path):
            if not _DATE_FILENAME_RE.match(fname):
                continue

            file_date_str = fname.replace(".md", "")
            try:
                file_date = date.fromisoformat(file_date_str)
            except ValueError:
                continue

            if not (month_start <= file_date < month_end):
                continue

            items = parse_todo_file(folder_path / fname)
            if not items:
                continue

            total = len(items)
            done = sum(1 for it in items if it["checked"])
            pending = total - done
            date_key = file_date.isoformat()

            # Day aggregation
            if date_key not in day_totals:
                day_totals[date_key] = {"total": 0, "done": 0, "pending": 0}
            day_totals[date_key]["total"] += total
            day_totals[date_key]["done"] += done
            day_totals[date_key]["pending"] += pending

            # Section aggregation
            section_totals[section]["total"] += total
            section_totals[section]["done"] += done
            section_totals[section]["pending"] += pending

            # Section-day aggregation
            if date_key not in section_days[section]:
                section_days[section][date_key] = {"total": 0, "done": 0, "pending": 0}
            section_days[section][date_key]["total"] += total
            section_days[section][date_key]["done"] += done
            section_days[section][date_key]["pending"] += pending

    # Build days list (all days in month)
    days = []
    current = month_start
    while current < month_end:
        key = current.isoformat()
        d = day_totals.get(key, {"total": 0, "done": 0, "pending": 0})
        days.append({"date": key, **d})
        current = date.fromordinal(current.toordinal() + 1)

    # Build sections list
    sections = sorted(
        [{"name": s, **counts} for s, counts in section_totals.items()],
        key=lambda x: x["total"],
        reverse=True,
    )

    # Build section_days: {section: [{date, total, done, pending}, ...]}
    section_days_out: dict[str, list[dict]] = {}
    for s, date_map in section_days.items():
        section_days_out[s] = sorted(
            [{"date": d, **counts} for d, counts in date_map.items()],
            key=lambda x: x["date"],
        )

    grand_total = sum(d["total"] for d in days)
    grand_done = sum(d["done"] for d in days)
    grand_pending = sum(d["pending"] for d in days)

    return {
        "year": year,
        "month": month,
        "days": days,
        "total": grand_total,
        "done": grand_done,
        "pending": grand_pending,
        "sections": sections,
        "section_days": section_days_out,
    }


def get_todos_section_month(
    vault_root: Path, year: int, month: int, sections: list[str]
) -> dict:
    """Return all todo items for specific sections in a month, grouped by date."""
    todo_folders = find_todo_folders(vault_root)

    month_start = date(year, month, 1)
    month_end = date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)

    # date -> list of items
    by_date: dict[str, list[dict]] = defaultdict(list)

    for folder_rel in todo_folders:
        section = _extract_section(folder_rel)
        if section not in sections:
            continue

        folder_path = vault_root / folder_rel
        if not folder_path.is_dir():
            continue

        for fname in os.listdir(folder_path):
            if not _DATE_FILENAME_RE.match(fname):
                continue

            file_date_str = fname.replace(".md", "")
            try:
                file_date = date.fromisoformat(file_date_str)
            except ValueError:
                continue

            if not (month_start <= file_date < month_end):
                continue

            file_rel = os.path.join(folder_rel, fname)
            items = parse_todo_file(folder_path / fname)

            for it in items:
                by_date[file_date.isoformat()].append({
                    "text": it["text"],
                    "checked": it["checked"],
                    "line": it["line_number"],
                    "file": file_rel,
                    "section": section,
                })

    days = sorted(
        [{"date": d, "items": items} for d, items in by_date.items()],
        key=lambda x: x["date"],
        reverse=True,
    )

    return {
        "sections": sections,
        "days": days,
    }


def toggle_todo(vault_root: Path, file_path: str, line_number: int) -> dict:
    """Toggle a checkbox at the given line number. Returns updated item."""
    full_path = vault_root / file_path
    if not full_path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    lines = full_path.read_text(encoding="utf-8").splitlines()

    if line_number < 1 or line_number > len(lines):
        raise ValueError(f"Line {line_number} out of range (file has {len(lines)} lines)")

    line = lines[line_number - 1]
    m = _CHECKBOX_RE.match(line.strip())
    if not m:
        raise ValueError(f"Line {line_number} is not a checkbox line")

    # Preserve leading whitespace
    leading = line[: len(line) - len(line.lstrip())]
    was_checked = m.group(1).lower() == "x"
    text = m.group(2).strip()

    if was_checked:
        lines[line_number - 1] = f"{leading}- [ ] {text}"
    else:
        lines[line_number - 1] = f"{leading}- [x] {text}"

    full_path.write_text("\n".join(lines), encoding="utf-8")

    return {
        "text": text,
        "checked": not was_checked,
        "line": line_number,
        "file": file_path,
    }


def create_todo(vault_root: Path, folder_path: str, date_str: str, items: list[str]) -> dict:
    """Create or append to a todo file. Each item becomes a - [ ] line."""
    target_dir = (vault_root / folder_path).resolve()
    # Ensure path is within vault
    target_dir.relative_to(vault_root.resolve())
    target_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{date_str}.md"
    file_path = target_dir / filename

    new_lines = [f"- [ ] {item.strip()}" for item in items if item.strip()]
    if not new_lines:
        raise ValueError("No valid items provided")

    if file_path.exists():
        existing = file_path.read_text(encoding="utf-8")
        # Ensure we start on a new line
        if existing and not existing.endswith("\n"):
            existing += "\n"
        content = existing + "\n".join(new_lines) + "\n"
    else:
        content = "\n".join(new_lines) + "\n"

    file_path.write_text(content, encoding="utf-8")

    rel = os.path.relpath(str(file_path), str(vault_root))
    return {
        "output_path": rel,
        "items_added": len(new_lines),
        "appended": file_path.exists(),
    }
