"""Business logic for note management."""

import time
from datetime import date

from doneski.storage.file_store import FileStore

SPECIAL_TITLES = {"todo", "done"}
MAX_TITLE_LENGTH = 80


class NoteError(Exception):
    """Base exception for note-related errors."""

    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class NotesService:
    def __init__(self, store: FileStore):
        self.store = store

    def get_day(self, d: date) -> list[dict] | None:
        return self.store.read_day(d)

    def init_day(self, d: date) -> list[dict]:
        """Initialize a new day by carrying over notes from the most recent previous day."""
        if d > date.today():
            raise NoteError("Cannot initialize a day in the future.", 400)

        if self.store.day_exists(d):
            raise NoteError(
                f"Day {d.isoformat()} already has notes.", 409
            )

        prev = self.store.find_previous_day(d)
        if prev is None:
            # First-ever use: create empty special notes
            notes = [
                {"title": "Todo", "created": -2, "body": ""},
                {"title": "Done", "created": -1, "body": ""},
            ]
        else:
            prev_notes = self.store.read_day(prev)
            notes = []
            for note in prev_notes:
                if note["title"].lower() == "done":
                    # Done note: carry over with empty body
                    notes.append({"title": "Done", "created": -1, "body": ""})
                elif note["title"].lower() == "todo":
                    # Todo note: carry over body
                    notes.append(
                        {"title": "Todo", "created": -2, "body": note["body"]}
                    )
                else:
                    # Regular note: carry over body, preserve created timestamp
                    notes.append({
                        "title": note["title"],
                        "created": note["created"],
                        "body": note["body"],
                    })

        self.store.write_day(d, notes)
        return notes

    def delete_day(self, d: date) -> None:
        if not self.store.delete_day(d):
            raise NoteError(f"No notes found for {d.isoformat()}.", 404)

    def list_days_in_month(self, year: int, month: int) -> list[int]:
        return self.store.list_days_in_month(year, month)

    def create_note(self, d: date, title: str) -> dict:
        """Create a new regular note for a day."""
        notes = self.store.read_day(d)
        if notes is None:
            raise NoteError(f"No notes found for {d.isoformat()}. Initialize the day first.", 404)

        self._validate_title(title, notes)

        note = {
            "title": title,
            "created": int(time.time()),
            "body": "",
        }
        notes.append(note)
        self.store.write_day(d, notes)
        return note

    def update_note(self, d: date, current_title: str, new_title: str | None = None, body: str | None = None) -> dict:
        """Update a note's title and/or body."""
        notes = self.store.read_day(d)
        if notes is None:
            raise NoteError(f"No notes found for {d.isoformat()}.", 404)

        note = self._find_note(notes, current_title)

        if new_title is not None and new_title != current_title:
            if current_title.lower() in SPECIAL_TITLES:
                raise NoteError(f'Cannot rename the "{current_title}" note.')
            self._validate_title(new_title, notes)
            note["title"] = new_title

        if body is not None:
            note["body"] = body

        self.store.write_day(d, notes)
        return note

    def delete_note(self, d: date, title: str) -> None:
        """Delete a regular note."""
        if title.lower() in SPECIAL_TITLES:
            raise NoteError(f'Cannot delete the "{title}" note.')

        notes = self.store.read_day(d)
        if notes is None:
            raise NoteError(f"No notes found for {d.isoformat()}.", 404)

        self._find_note(notes, title)  # raises if not found
        notes = [n for n in notes if n["title"] != title]
        self.store.write_day(d, notes)

    def _find_note(self, notes: list[dict], title: str) -> dict:
        for note in notes:
            if note["title"] == title:
                return note
        raise NoteError(f'Note "{title}" not found.', 404)

    def _validate_title(self, title: str, existing_notes: list[dict]) -> None:
        title_stripped = title.strip()
        if not title_stripped:
            raise NoteError("Note title cannot be empty.")
        if len(title_stripped) > MAX_TITLE_LENGTH:
            raise NoteError(f"Note title cannot exceed {MAX_TITLE_LENGTH} characters.")
        if title_stripped.lower() in SPECIAL_TITLES:
            raise NoteError(f'Cannot use reserved title "{title_stripped}".')
        for note in existing_notes:
            if note["title"] == title_stripped:
                raise NoteError(f'A note titled "{title_stripped}" already exists for this day.', 409)
