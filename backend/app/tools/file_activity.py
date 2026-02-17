"""
File activity insights based on filesystem timestamps.

Uses os.stat() to get creation (st_birthtime on macOS) and modification
(st_mtime) times for vault files, providing ground-truth activity data
independent of git commits.
"""

from __future__ import annotations

import os
import time
from collections import defaultdict
from datetime import date, datetime
from pathlib import Path

from app.services.lego_blocks.vault_constants_block import EXCLUDED_DIRS

# Directories whose children are the meaningful "section" level
_NESTED_ROOTS = {"acceleration_core", "lifeblood_systems", "operations"}

# In-memory cache for vault walk results
_CACHE: dict[str, tuple[float, list[tuple[str, os.stat_result]]]] = {}
_CACHE_TTL = 120  # seconds


def _walk_vault(vault_root: Path, extensions: set[str] | None = None) -> list[tuple[str, os.stat_result]]:
    """Walk the vault and return (relative_path, stat_result) pairs."""
    if extensions is None:
        extensions = {".md"}

    results: list[tuple[str, os.stat_result]] = []
    root_str = str(vault_root)

    for dirpath, dirnames, filenames in os.walk(root_str):
        dirnames[:] = [d for d in dirnames if d not in EXCLUDED_DIRS and not d.startswith(".")]

        for fname in filenames:
            if fname.startswith("."):
                continue
            ext = os.path.splitext(fname)[1].lower()
            if ext not in extensions:
                continue

            full = os.path.join(dirpath, fname)
            try:
                st = os.stat(full)
            except OSError:
                continue

            rel = os.path.relpath(full, root_str)
            results.append((rel, st))

    return results


def _walk_vault_cached(vault_root: Path) -> list[tuple[str, os.stat_result]]:
    """Cached version of _walk_vault. TTL-based, ~120s."""
    key = str(vault_root)
    now = time.monotonic()
    if key in _CACHE:
        ts, data = _CACHE[key]
        if now - ts < _CACHE_TTL:
            return data
    data = _walk_vault(vault_root)
    _CACHE[key] = (now, data)
    return data


def _get_birthtime(st: os.stat_result) -> float:
    """Get file creation time. Uses st_birthtime on macOS, falls back to st_ctime."""
    return getattr(st, "st_birthtime", st.st_ctime)


def _extract_section(rel_path: str) -> str:
    """Extract the meaningful section name from a relative path.

    For nested roots (acceleration_core, lifeblood_systems, operations),
    uses the 2nd path segment (e.g. F9, sfdl, sfw).
    For everything else, uses the 1st segment.
    Root-level files go into "Other".
    """
    parts = rel_path.split(os.sep)
    if len(parts) < 2:
        return "Other"
    if parts[0] in _NESTED_ROOTS and len(parts) >= 2:
        return parts[1]
    return parts[0]


def get_month_activity(vault_root: Path, year: int, month: int) -> dict:
    """Get day-level created/modified counts for a given month, with section breakdown."""
    entries = _walk_vault_cached(vault_root)

    month_start = date(year, month, 1)
    if month == 12:
        month_end = date(year + 1, 1, 1)
    else:
        month_end = date(year, month + 1, 1)

    day_created: dict[str, int] = {}
    day_modified: dict[str, int] = {}

    # Section-level aggregation
    section_created: dict[str, int] = defaultdict(int)
    section_modified: dict[str, int] = defaultdict(int)

    # Per-section per-day counts (for calendar filtering)
    # section_day_created["F9"]["2026-02-09"] = 3
    section_day_created: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    section_day_modified: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))

    for rel, st in entries:
        created_date = datetime.fromtimestamp(_get_birthtime(st)).date()
        modified_date = datetime.fromtimestamp(st.st_mtime).date()
        section = _extract_section(rel)

        if month_start <= created_date < month_end:
            key = created_date.isoformat()
            day_created[key] = day_created.get(key, 0) + 1
            section_created[section] += 1
            section_day_created[section][key] += 1

        if month_start <= modified_date < month_end and modified_date != created_date:
            key = modified_date.isoformat()
            day_modified[key] = day_modified.get(key, 0) + 1
            section_modified[section] += 1
            section_day_modified[section][key] += 1

    # Build day list
    days = []
    current = month_start
    while current < month_end:
        key = current.isoformat()
        days.append({
            "date": key,
            "created": day_created.get(key, 0),
            "modified": day_modified.get(key, 0),
        })
        current = date.fromordinal(current.toordinal() + 1)

    # Build sections list (union of all sections that had activity)
    all_sections = set(section_created) | set(section_modified)
    sections = sorted(
        [
            {
                "name": s,
                "created": section_created.get(s, 0),
                "modified": section_modified.get(s, 0),
            }
            for s in all_sections
        ],
        key=lambda x: x["created"] + x["modified"],
        reverse=True,
    )

    total_created = sum(d["created"] for d in days)
    total_modified = sum(d["modified"] for d in days)

    # Build section_days: {section: [{date, created, modified}, ...]} (only active dates)
    all_section_dates = set()
    for s in set(section_day_created) | set(section_day_modified):
        all_section_dates.add(s)
    section_days: dict[str, list[dict]] = {}
    for s in all_section_dates:
        s_created = section_day_created.get(s, {})
        s_modified = section_day_modified.get(s, {})
        active_dates = set(s_created) | set(s_modified)
        section_days[s] = sorted(
            [
                {
                    "date": d,
                    "created": s_created.get(d, 0),
                    "modified": s_modified.get(d, 0),
                }
                for d in active_dates
            ],
            key=lambda x: x["date"],
        )

    return {
        "year": year,
        "month": month,
        "days": days,
        "total_created": total_created,
        "total_modified": total_modified,
        "sections": sections,
        "section_days": section_days,
    }


def get_day_activity(vault_root: Path, target_date: date) -> dict:
    """Get file lists for a specific day, grouped by section."""
    entries = _walk_vault_cached(vault_root)

    created: list[dict] = []
    modified: list[dict] = []

    for rel, st in entries:
        created_date = datetime.fromtimestamp(_get_birthtime(st)).date()
        modified_date = datetime.fromtimestamp(st.st_mtime).date()
        section = _extract_section(rel)

        if created_date == target_date:
            created.append({
                "path": rel,
                "section": section,
                "size_bytes": st.st_size,
                "timestamp": datetime.fromtimestamp(_get_birthtime(st)).isoformat(),
            })
        elif modified_date == target_date:
            modified.append({
                "path": rel,
                "section": section,
                "size_bytes": st.st_size,
                "timestamp": datetime.fromtimestamp(st.st_mtime).isoformat(),
            })

    created.sort(key=lambda x: (x["section"], x["path"]))
    modified.sort(key=lambda x: (x["section"], x["path"]))

    # Group by section for the response
    sections: dict[str, dict] = {}
    for f in created:
        s = f["section"]
        if s not in sections:
            sections[s] = {"created": [], "modified": []}
        sections[s]["created"].append(f)
    for f in modified:
        s = f["section"]
        if s not in sections:
            sections[s] = {"created": [], "modified": []}
        sections[s]["modified"].append(f)

    return {
        "date": target_date.isoformat(),
        "created": created,
        "modified": modified,
        "created_count": len(created),
        "modified_count": len(modified),
        "sections": sections,
    }


def get_section_month_activity(vault_root: Path, year: int, month: int, section: str) -> dict:
    """Get all files for a specific section in a given month, grouped by date."""
    entries = _walk_vault_cached(vault_root)

    month_start = date(year, month, 1)
    month_end = date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)

    # date_str -> {created: [...], modified: [...]}
    by_date: dict[str, dict[str, list[dict]]] = {}

    for rel, st in entries:
        if _extract_section(rel) != section:
            continue

        created_date = datetime.fromtimestamp(_get_birthtime(st)).date()
        modified_date = datetime.fromtimestamp(st.st_mtime).date()

        def _file_entry(ts: float) -> dict:
            return {
                "path": rel,
                "section": section,
                "size_bytes": st.st_size,
                "timestamp": datetime.fromtimestamp(ts).isoformat(),
            }

        if month_start <= created_date < month_end:
            key = created_date.isoformat()
            by_date.setdefault(key, {"created": [], "modified": []})
            by_date[key]["created"].append(_file_entry(_get_birthtime(st)))

        if month_start <= modified_date < month_end and modified_date != created_date:
            key = modified_date.isoformat()
            by_date.setdefault(key, {"created": [], "modified": []})
            by_date[key]["modified"].append(_file_entry(st.st_mtime))

    # Sort dates and files within each date
    dates = sorted(by_date.keys(), reverse=True)
    days = []
    total_created = 0
    total_modified = 0
    for d in dates:
        data = by_date[d]
        data["created"].sort(key=lambda x: x["path"])
        data["modified"].sort(key=lambda x: x["path"])
        total_created += len(data["created"])
        total_modified += len(data["modified"])
        days.append({
            "date": d,
            "created": data["created"],
            "modified": data["modified"],
        })

    return {
        "section": section,
        "year": year,
        "month": month,
        "days": days,
        "total_created": total_created,
        "total_modified": total_modified,
    }
