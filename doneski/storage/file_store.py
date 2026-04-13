"""File-based storage for daily notes.

Each day's notes are stored as a JSON file at <data_dir>/<YYYY>/<MM>/<DD>.json.
"""

import json
import os
import tempfile
from datetime import date, timedelta


class FileStore:
    def __init__(self, data_dir: str):
        self.data_dir = data_dir

    def _day_path(self, d: date) -> str:
        return os.path.join(
            self.data_dir, f"{d.year:04d}", f"{d.month:02d}", f"{d.day:02d}.json"
        )

    def day_exists(self, d: date) -> bool:
        return os.path.isfile(self._day_path(d))

    def read_day(self, d: date) -> list[dict] | None:
        """Read all notes for a day. Returns None if no file exists."""
        path = self._day_path(d)
        if not os.path.isfile(path):
            return None
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    def write_day(self, d: date, notes: list[dict]) -> None:
        """Atomically write notes for a day."""
        path = self._day_path(d)
        dir_path = os.path.dirname(path)
        os.makedirs(dir_path, exist_ok=True)

        # Write to temp file, then atomic rename
        fd, tmp_path = tempfile.mkstemp(dir=dir_path, suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                json.dump(notes, f, indent=2, ensure_ascii=False)
                f.write("\n")
            os.replace(tmp_path, path)
        except BaseException:
            # Clean up temp file on any failure
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
            raise

    def delete_day(self, d: date) -> bool:
        """Delete a day's notes file. Returns True if deleted, False if not found."""
        path = self._day_path(d)
        if not os.path.isfile(path):
            return False
        os.unlink(path)
        return True

    def list_days_in_month(self, year: int, month: int) -> list[int]:
        """List day numbers that have notes in a given month."""
        month_dir = os.path.join(self.data_dir, f"{year:04d}", f"{month:02d}")
        if not os.path.isdir(month_dir):
            return []
        days = []
        for filename in os.listdir(month_dir):
            if filename.endswith(".json"):
                try:
                    day = int(filename[:-5])  # strip .json
                    days.append(day)
                except ValueError:
                    continue
        days.sort()
        return days

    def find_previous_day(self, target: date) -> date | None:
        """Find the most recent date before `target` that has notes.

        Scans backwards from the target date, checking the same month first,
        then scanning month directories backwards. Stops after ~2 years.
        """
        earliest = target - timedelta(days=730)

        # Check days in the target month before the target day
        month_days = self.list_days_in_month(target.year, target.month)
        for day in reversed(month_days):
            if day < target.day:
                return date(target.year, target.month, day)

        # Scan backwards through previous months
        year, month = target.year, target.month
        while True:
            month -= 1
            if month < 1:
                month = 12
                year -= 1
            if date(year, month, 1) < earliest:
                return None

            month_days = self.list_days_in_month(year, month)
            if month_days:
                return date(year, month, month_days[-1])
