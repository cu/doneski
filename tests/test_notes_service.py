from datetime import date

import pytest

from doneski.services.notes import NoteError, NotesService


def test_init_day_first_ever(service):
    notes = service.init_day(date(2026, 4, 13))
    assert len(notes) == 2
    assert notes[0]["title"] == "Todo"
    assert notes[0]["created"] == -2
    assert notes[0]["body"] == ""
    assert notes[1]["title"] == "Done"
    assert notes[1]["created"] == -1


def test_init_day_carry_over(service):
    d1 = date(2026, 4, 10)
    service.init_day(d1)
    # Add content and a regular note to day 1
    service.update_note(d1, "Todo", body="- Task A")
    service.update_note(d1, "Done", body="Finished X")
    service.create_note(d1, "Sprint Notes")
    service.update_note(d1, "Sprint Notes", body="Velocity: 42")

    d2 = date(2026, 4, 11)
    notes = service.init_day(d2)

    titles = [n["title"] for n in notes]
    assert "Todo" in titles
    assert "Done" in titles
    assert "Sprint Notes" in titles

    todo = next(n for n in notes if n["title"] == "Todo")
    assert todo["body"] == "- Task A"

    done = next(n for n in notes if n["title"] == "Done")
    assert done["body"] == ""  # NOT carried over

    sprint = next(n for n in notes if n["title"] == "Sprint Notes")
    assert sprint["body"] == "Velocity: 42"


def test_init_day_already_exists(service):
    service.init_day(date(2026, 4, 13))
    with pytest.raises(NoteError) as exc_info:
        service.init_day(date(2026, 4, 13))
    assert exc_info.value.status_code == 409


def test_init_day_future(service):
    with pytest.raises(NoteError):
        service.init_day(date(2099, 1, 1))


def test_create_note(service):
    d = date(2026, 4, 13)
    service.init_day(d)
    note = service.create_note(d, "Meeting Notes")
    assert note["title"] == "Meeting Notes"
    assert note["body"] == ""
    assert note["created"] > 0


def test_create_note_reserved_title(service):
    d = date(2026, 4, 13)
    service.init_day(d)
    with pytest.raises(NoteError):
        service.create_note(d, "Todo")
    with pytest.raises(NoteError):
        service.create_note(d, "done")
    with pytest.raises(NoteError):
        service.create_note(d, "TODO")
    with pytest.raises(NoteError):
        service.create_note(d, ".")
    with pytest.raises(NoteError):
        service.create_note(d, "..")


def test_create_note_duplicate_title(service):
    d = date(2026, 4, 13)
    service.init_day(d)
    service.create_note(d, "Notes")
    with pytest.raises(NoteError) as exc_info:
        service.create_note(d, "Notes")
    assert exc_info.value.status_code == 409


def test_create_note_too_long_title(service):
    d = date(2026, 4, 13)
    service.init_day(d)
    with pytest.raises(NoteError):
        service.create_note(d, "x" * 81)


def test_update_note_body(service):
    d = date(2026, 4, 13)
    service.init_day(d)
    note = service.update_note(d, "Todo", body="- New task")
    assert note["body"] == "- New task"


def test_update_note_title(service):
    d = date(2026, 4, 13)
    service.init_day(d)
    service.create_note(d, "Old Title")
    note = service.update_note(d, "Old Title", new_title="New Title")
    assert note["title"] == "New Title"


def test_cannot_rename_special_notes(service):
    d = date(2026, 4, 13)
    service.init_day(d)
    with pytest.raises(NoteError):
        service.update_note(d, "Todo", new_title="My Todo")
    with pytest.raises(NoteError):
        service.update_note(d, "Done", new_title="Finished")


def test_delete_note(service):
    d = date(2026, 4, 13)
    service.init_day(d)
    service.create_note(d, "Temp Note")
    service.delete_note(d, "Temp Note")
    notes = service.get_day(d)
    titles = [n["title"] for n in notes]
    assert "Temp Note" not in titles


def test_cannot_delete_special_notes(service):
    d = date(2026, 4, 13)
    service.init_day(d)
    with pytest.raises(NoteError):
        service.delete_note(d, "Todo")
    with pytest.raises(NoteError):
        service.delete_note(d, "Done")


def test_delete_day(service):
    d = date(2026, 4, 13)
    service.init_day(d)
    service.delete_day(d)
    assert service.get_day(d) is None


def test_delete_day_not_found(service):
    with pytest.raises(NoteError) as exc_info:
        service.delete_day(date(2026, 4, 13))
    assert exc_info.value.status_code == 404


def test_retroactive_day_init(service):
    """Initialize days out of order: Monday exists, then create Tuesday retroactively."""
    mon = date(2026, 4, 6)
    service.init_day(mon)
    service.update_note(mon, "Todo", body="- Monday task")
    service.create_note(mon, "Sprint")
    service.update_note(mon, "Sprint", body="Sprint stuff")

    # Skip Tuesday, init Wednesday
    wed = date(2026, 4, 8)
    service.init_day(wed)

    # Now retroactively create Tuesday
    tue = date(2026, 4, 7)
    notes = service.init_day(tue)

    # Tuesday should carry over from Monday (most recent prior day)
    todo = next(n for n in notes if n["title"] == "Todo")
    assert todo["body"] == "- Monday task"
    sprint = next(n for n in notes if n["title"] == "Sprint")
    assert sprint["body"] == "Sprint stuff"

    # Wednesday should be unchanged
    wed_notes = service.get_day(wed)
    wed_todo = next(n for n in wed_notes if n["title"] == "Todo")
    assert wed_todo["body"] == "- Monday task"
