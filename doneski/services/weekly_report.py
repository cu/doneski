"""Weekly report generation."""

from datetime import date, timedelta

from doneski.storage.file_store import FileStore


def generate_weekly_report(store: FileStore, reference_date: date | None = None) -> str:
    """Generate a weekly report from the previous full week's Done notes.

    The previous week is Sun-Sat relative to `reference_date` (defaults to today).
    """
    if reference_date is None:
        reference_date = date.today()

    # Find the previous Saturday: go back from reference_date to the most recent
    # Saturday, then back one more week to get the start of the previous full week.
    # weekday(): Monday=0 ... Sunday=6
    # We want Sunday=start, Saturday=end.
    days_since_saturday = (reference_date.weekday() + 2) % 7  # 0 if reference is Saturday
    last_saturday = reference_date - timedelta(days=days_since_saturday)
    prev_sunday = last_saturday - timedelta(days=6)

    parts = []
    current = prev_sunday
    while current <= last_saturday:
        notes = store.read_day(current)
        if notes is not None:
            done_body = None
            for note in notes:
                if note["title"].lower() == "done":
                    done_body = note["body"]
                    break

            if done_body and done_body.strip():
                header = current.strftime("**%A, %B %-d, %Y**")
                parts.append(f"{header}\n\n{done_body.strip()}")

        current += timedelta(days=1)

    return "\n\n".join(parts)
