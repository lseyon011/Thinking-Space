"""
Git insights for the vault repository.

Provides data similar to GitHub's Insights tab:
- Pulse (recent activity summary)
- Contributors (top authors)
- Commits over time (weekly)
- Code frequency (weekly additions/deletions)
- Activity heatmap (daily commits)
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta
import subprocess
from pathlib import Path


@dataclass
class GitInsightsOptions:
    days: int = 365


class GitRepoError(RuntimeError):
    pass


def _run_git(cwd: Path, args: list[str]) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=cwd,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise GitRepoError(result.stderr.strip() or "Git command failed")
    return result.stdout


def _ensure_repo(cwd: Path) -> None:
    _run_git(cwd, ["rev-parse", "--is-inside-work-tree"])


def _daterange_start(days: int) -> date:
    return date.today() - timedelta(days=days - 1)


def _week_start(d: date) -> date:
    # Monday as start of week
    return d - timedelta(days=d.weekday())


def _parse_numstat(lines: list[str]) -> tuple[int, int]:
    additions = 0
    deletions = 0
    for line in lines:
        parts = line.split("\t")
        if len(parts) < 3:
            continue
        add, delete = parts[0], parts[1]
        if add.isdigit():
            additions += int(add)
        if delete.isdigit():
            deletions += int(delete)
    return additions, deletions


def _parse_name_status(lines: list[str]) -> tuple[dict[str, int], dict[str, int]]:
    status_counts = {"A": 0, "M": 0, "D": 0, "R": 0}
    file_edits: dict[str, int] = {}
    for line in lines:
        if "\t" not in line:
            continue
        parts = line.split("\t")
        status = parts[0]
        if status.startswith("R") and len(parts) >= 3:
            status_counts["R"] += 1
            file_path = parts[2]
            file_edits[file_path] = file_edits.get(file_path, 0) + 1
            continue
        if status and status[0] in status_counts and len(parts) >= 2:
            status_counts[status[0]] += 1
            file_path = parts[1]
            file_edits[file_path] = file_edits.get(file_path, 0) + 1
    return status_counts, file_edits


def get_change_breakdown(cwd: Path, days: int) -> dict:
    since = _daterange_start(days).isoformat()
    raw = _run_git(cwd, ["log", f"--since={since}", "--name-status", "--pretty=%H"])
    status_counts, file_edits = _parse_name_status(raw.splitlines())
    unique_files = len(file_edits)
    return {
        "status_counts": status_counts,
        "unique_files": unique_files,
        "file_edits": file_edits,
    }


def get_top_files(cwd: Path, days: int, limit: int = 10) -> list[dict]:
    since = _daterange_start(days).isoformat()
    raw = _run_git(cwd, ["log", f"--since={since}", "--numstat", "--pretty=%H"])
    file_stats: dict[str, dict[str, int]] = {}
    for line in raw.splitlines():
        if "\t" not in line:
            continue
        parts = line.split("\t")
        if len(parts) < 3:
            continue
        add, delete, path = parts[0], parts[1], parts[2]
        if path not in file_stats:
            file_stats[path] = {"edits": 0, "additions": 0, "deletions": 0}
        file_stats[path]["edits"] += 1
        if add.isdigit():
            file_stats[path]["additions"] += int(add)
        if delete.isdigit():
            file_stats[path]["deletions"] += int(delete)

    items = [
        {"file": path, **stats}
        for path, stats in file_stats.items()
    ]
    items.sort(key=lambda x: x["edits"], reverse=True)
    return items[:limit]


def get_range_additions_deletions(cwd: Path, days: int) -> tuple[int, int]:
    since = _daterange_start(days).isoformat()
    raw = _run_git(cwd, ["log", f"--since={since}", "--numstat", "--pretty=%H"])
    add_total = 0
    del_total = 0
    for line in raw.splitlines():
        if "\t" not in line:
            continue
        add, delete = line.split("\t")[:2]
        if add.isdigit():
            add_total += int(add)
        if delete.isdigit():
            del_total += int(delete)
    return add_total, del_total


def get_time_distribution(cwd: Path, days: int) -> dict:
    since = _daterange_start(days).isoformat()
    raw = _run_git(cwd, ["log", f"--since={since}", "--date=iso-strict", "--pretty=%ad"])
    day_counts = {i: 0 for i in range(7)}
    hour_counts = {i: 0 for i in range(24)}
    time_buckets = {
        "night": [0, 0, 0, 0, 0, 0, 0],      # 0-4
        "morning": [0, 0, 0, 0, 0, 0, 0],    # 5-11
        "afternoon": [0, 0, 0, 0, 0, 0, 0],  # 12-17
        "evening": [0, 0, 0, 0, 0, 0, 0],    # 18-23
    }

    for line in raw.splitlines():
        if not line.strip():
            continue
        dt = datetime.fromisoformat(line.strip())
        weekday = dt.weekday()
        hour = dt.hour
        day_counts[weekday] += 1
        hour_counts[hour] += 1
        if 0 <= hour <= 4:
            time_buckets["night"][weekday] += 1
        elif 5 <= hour <= 11:
            time_buckets["morning"][weekday] += 1
        elif 12 <= hour <= 17:
            time_buckets["afternoon"][weekday] += 1
        else:
            time_buckets["evening"][weekday] += 1

    most_active_day = max(day_counts.items(), key=lambda x: x[1])[0]
    most_active_hour = max(hour_counts.items(), key=lambda x: x[1])[0]

    return {
        "by_day": [day_counts[i] for i in range(7)],
        "by_hour": [hour_counts[i] for i in range(24)],
        "most_active_day": most_active_day,
        "most_active_hour": most_active_hour,
        "time_buckets": time_buckets,
    }


def get_pulse(cwd: Path, days: int = 7) -> dict:
    since = (date.today() - timedelta(days=days - 1)).isoformat()
    log = _run_git(cwd, ["log", f"--since={since}", "--numstat", "--pretty=%H"])
    commits = 0
    files_changed = set()
    add_total = 0
    del_total = 0
    current_numstat: list[str] = []

    for line in log.splitlines():
        if not line.strip():
            continue
        if len(line.strip()) == 40:
            # flush previous
            if current_numstat:
                adds, dels = _parse_numstat(current_numstat)
                add_total += adds
                del_total += dels
                current_numstat = []
            commits += 1
            continue
        if "\t" in line:
            current_numstat.append(line)
            parts = line.split("\t")
            if len(parts) >= 3:
                files_changed.add(parts[2])

    if current_numstat:
        adds, dels = _parse_numstat(current_numstat)
        add_total += adds
        del_total += dels

    authors = _run_git(cwd, ["log", f"--since={since}", "--format=%an"])
    unique_authors = len({a.strip() for a in authors.splitlines() if a.strip()})

    return {
        "days": days,
        "commits": commits,
        "authors": unique_authors,
        "files_changed": len(files_changed),
        "additions": add_total,
        "deletions": del_total,
    }


def get_contributors(cwd: Path, days: int) -> list[dict]:
    since = _daterange_start(days).isoformat()
    shortlog = _run_git(cwd, ["shortlog", "-s", "-n", f"--since={since}"])
    contributors = []
    for line in shortlog.splitlines():
        line = line.strip()
        if not line:
            continue
        parts = line.split("\t")
        if len(parts) != 2:
            continue
        count_str, name = parts
        if count_str.strip().isdigit():
            contributors.append({"name": name.strip(), "commits": int(count_str.strip())})
    return contributors


def get_weekly_commits(cwd: Path, days: int) -> list[dict]:
    since = _daterange_start(days).isoformat()
    raw = _run_git(cwd, ["log", f"--since={since}", "--date=short", "--pretty=%ad"])
    counts: dict[date, int] = {}
    for line in raw.splitlines():
        if not line.strip():
            continue
        d = datetime.strptime(line.strip(), "%Y-%m-%d").date()
        wk = _week_start(d)
        counts[wk] = counts.get(wk, 0) + 1

    # build ordered range
    start = _week_start(_daterange_start(days))
    end = _week_start(date.today())
    weeks = []
    cur = start
    while cur <= end:
        weeks.append({"week_start": cur.isoformat(), "count": counts.get(cur, 0)})
        cur += timedelta(days=7)
    return weeks


def get_code_frequency(cwd: Path, days: int) -> list[dict]:
    since = _daterange_start(days).isoformat()
    raw = _run_git(cwd, [
        "log",
        f"--since={since}",
        "--numstat",
        "--date=short",
        "--pretty=---%ad",
    ])

    weekly: dict[date, dict[str, int]] = {}
    current_date: date | None = None
    current_numstat: list[str] = []

    def flush() -> None:
        nonlocal current_numstat
        if current_date is None:
            return
        adds, dels = _parse_numstat(current_numstat)
        wk = _week_start(current_date)
        if wk not in weekly:
            weekly[wk] = {"additions": 0, "deletions": 0}
        weekly[wk]["additions"] += adds
        weekly[wk]["deletions"] += dels
        current_numstat = []

    for line in raw.splitlines():
        if line.startswith("---"):
            flush()
            date_str = line.replace("---", "").strip()
            current_date = datetime.strptime(date_str, "%Y-%m-%d").date()
            continue
        if "\t" in line:
            current_numstat.append(line)

    flush()

    start = _week_start(_daterange_start(days))
    end = _week_start(date.today())
    weeks = []
    cur = start
    while cur <= end:
        data = weekly.get(cur, {"additions": 0, "deletions": 0})
        weeks.append({
            "week_start": cur.isoformat(),
            "additions": data["additions"],
            "deletions": data["deletions"],
        })
        cur += timedelta(days=7)
    return weeks


def get_activity_heatmap(cwd: Path, days: int) -> dict:
    since = _daterange_start(days).isoformat()
    raw = _run_git(cwd, ["log", f"--since={since}", "--date=short", "--pretty=%ad"])
    counts: dict[date, int] = {}
    for line in raw.splitlines():
        if not line.strip():
            continue
        d = datetime.strptime(line.strip(), "%Y-%m-%d").date()
        counts[d] = counts.get(d, 0) + 1

    start = _daterange_start(days)
    end = date.today()
    daily = []
    cur = start
    while cur <= end:
        daily.append({"date": cur.isoformat(), "count": counts.get(cur, 0)})
        cur += timedelta(days=1)

    return {
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "daily": daily,
    }


def get_git_insights(repo_root: Path, options: GitInsightsOptions | None = None) -> dict:
    if options is None:
        options = GitInsightsOptions()

    _ensure_repo(repo_root)

    breakdown = get_change_breakdown(repo_root, options.days)
    time_dist = get_time_distribution(repo_root, options.days)
    weekly = get_weekly_commits(repo_root, options.days)
    additions, deletions = get_range_additions_deletions(repo_root, options.days)

    return {
        "range_days": options.days,
        "summary": {
            "total_commits": sum(w["count"] for w in weekly),
            "unique_files": breakdown["unique_files"],
            "additions": additions,
            "deletions": deletions,
            "net_change": additions - deletions,
        },
        "pulse": get_pulse(repo_root, days=min(7, options.days)),
        "contributors": get_contributors(repo_root, options.days),
        "weekly_commits": weekly,
        "code_frequency": get_code_frequency(repo_root, options.days),
        "heatmap": get_activity_heatmap(repo_root, options.days),
        "event_breakdown": breakdown["status_counts"],
        "top_files": get_top_files(repo_root, options.days, limit=10),
        "time_distribution": time_dist,
    }
