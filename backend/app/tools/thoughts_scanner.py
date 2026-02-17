"""
Thoughts scanner: finds thoughts/ folders in the vault and aggregates
counts by date and section (similar to todos).
"""

from __future__ import annotations

import os
import re
from collections import defaultdict
from datetime import date
from pathlib import Path

from app.services.lego_blocks.vault_constants_block import EXCLUDED_DIRS

_NESTED_ROOTS = {"acceleration_core", "lifeblood_systems", "operations"}

_DATE_FILENAME_RE = re.compile(r"^\d{4}-\d{2}-\d{2}\.md$")


def _extract_section(rel_path: str) -> str:
    parts = rel_path.split(os.sep)
    if len(parts) < 2:
        return "Other"
    if parts[0] in _NESTED_ROOTS and len(parts) >= 2:
        return parts[1]
    return parts[0]


def find_thought_folders(vault_root: Path) -> list[str]:
    """Walk vault, return relative paths to folders named 'thoughts'."""
    results: list[str] = []
    root_str = str(vault_root)

    for dirpath, dirnames, _filenames in os.walk(root_str):
        dirnames[:] = [d for d in dirnames if d not in EXCLUDED_DIRS and not d.startswith(".")]

        basename = os.path.basename(dirpath)
        if basename == "thoughts":
            rel = os.path.relpath(dirpath, root_str)
            results.append(rel)

    return sorted(results)


def get_thoughts_month(vault_root: Path, year: int, month: int) -> dict:
    """Calendar-level counts for a month across all thoughts folders."""
    thought_folders = find_thought_folders(vault_root)

    month_start = date(year, month, 1)
    month_end = date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)

    day_totals: dict[str, dict] = {}  # date -> {total, done, pending}
    section_totals: dict[str, dict] = defaultdict(lambda: {"total": 0, "done": 0, "pending": 0})
    section_days: dict[str, dict[str, dict]] = defaultdict(dict)

    for folder_rel in thought_folders:
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

            total = 1
            done = 0
            pending = 1
            date_key = file_date.isoformat()

            if date_key not in day_totals:
                day_totals[date_key] = {"total": 0, "done": 0, "pending": 0}
            day_totals[date_key]["total"] += total
            day_totals[date_key]["done"] += done
            day_totals[date_key]["pending"] += pending

            section_totals[section]["total"] += total
            section_totals[section]["done"] += done
            section_totals[section]["pending"] += pending

            if date_key not in section_days[section]:
                section_days[section][date_key] = {"total": 0, "done": 0, "pending": 0}
            section_days[section][date_key]["total"] += total
            section_days[section][date_key]["done"] += done
            section_days[section][date_key]["pending"] += pending

    days = []
    current = month_start
    while current < month_end:
        key = current.isoformat()
        d = day_totals.get(key, {"total": 0, "done": 0, "pending": 0})
        days.append({"date": key, **d})
        current = date.fromordinal(current.toordinal() + 1)

    sections = sorted(
        [{"name": s, **counts} for s, counts in section_totals.items()],
        key=lambda x: x["total"],
        reverse=True,
    )

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


def get_thoughts_section_month(
    vault_root: Path, year: int, month: int, sections: list[str]
) -> dict:
    """Return all thoughts for specific sections in a month, grouped by date."""
    thought_folders = find_thought_folders(vault_root)

    month_start = date(year, month, 1)
    month_end = date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)

    by_date: dict[str, list[dict]] = defaultdict(list)

    for folder_rel in thought_folders:
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
            by_date[file_date.isoformat()].append({
                "text": fname.replace(".md", ""),
                "checked": False,
                "line": 1,
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
