from datetime import date

from doneski.storage.file_store import FileStore


def test_read_nonexistent_day(store):
    assert store.read_day(date(2026, 4, 13)) is None


def test_write_and_read_day(store):
    d = date(2026, 4, 13)
    notes = [{"title": "Todo", "created": -2, "body": "stuff"}]
    store.write_day(d, notes)
    result = store.read_day(d)
    assert result == notes


def test_day_exists(store):
    d = date(2026, 4, 13)
    assert not store.day_exists(d)
    store.write_day(d, [])
    assert store.day_exists(d)


def test_delete_day(store):
    d = date(2026, 4, 13)
    store.write_day(d, [])
    assert store.delete_day(d) is True
    assert not store.day_exists(d)
    assert store.delete_day(d) is False


def test_list_days_in_month(store):
    store.write_day(date(2026, 4, 5), [])
    store.write_day(date(2026, 4, 12), [])
    store.write_day(date(2026, 4, 20), [])
    assert store.list_days_in_month(2026, 4) == [5, 12, 20]
    assert store.list_days_in_month(2026, 5) == []


def test_find_previous_day_same_month(store):
    store.write_day(date(2026, 4, 5), [])
    store.write_day(date(2026, 4, 10), [])
    assert store.find_previous_day(date(2026, 4, 13)) == date(2026, 4, 10)
    assert store.find_previous_day(date(2026, 4, 10)) == date(2026, 4, 5)


def test_find_previous_day_cross_month(store):
    store.write_day(date(2026, 3, 28), [])
    assert store.find_previous_day(date(2026, 4, 5)) == date(2026, 3, 28)


def test_find_previous_day_none(store):
    assert store.find_previous_day(date(2026, 4, 13)) is None
