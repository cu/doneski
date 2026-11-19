import json
import os

import pytest


def test_list_days_empty(client):
    resp = client.get("/api/days/2026/04")
    assert resp.status_code == 200
    assert resp.json["days"] == []


def test_init_and_get_day(client):
    resp = client.post("/api/day/2026/04/13/init")
    assert resp.status_code == 201
    notes = resp.json["notes"]
    assert len(notes) == 2
    assert notes[0]["title"] == "Done"
    assert notes[1]["title"] == "Todo"

    resp = client.get("/api/day/2026/04/13")
    assert resp.status_code == 200
    assert len(resp.json["notes"]) == 2


def test_get_day_404(client):
    resp = client.get("/api/day/2026/04/13")
    assert resp.status_code == 404


def test_init_day_conflict(client):
    client.post("/api/day/2026/04/13/init")
    resp = client.post("/api/day/2026/04/13/init")
    assert resp.status_code == 409


def test_create_note(client):
    client.post("/api/day/2026/04/13/init")
    resp = client.post(
        "/api/day/2026/04/13/notes",
        data=json.dumps({"title": "Sprint"}),
        content_type="application/json",
    )
    assert resp.status_code == 201
    assert resp.json["title"] == "Sprint"


def test_update_note(client):
    client.post("/api/day/2026/04/13/init")
    resp = client.put(
        "/api/day/2026/04/13/notes/Todo",
        data=json.dumps({"body": "- Task 1"}),
        content_type="application/json",
    )
    assert resp.status_code == 200
    assert resp.json["body"] == "- Task 1"


def test_delete_note(client):
    client.post("/api/day/2026/04/13/init")
    client.post(
        "/api/day/2026/04/13/notes",
        data=json.dumps({"title": "Temp"}),
        content_type="application/json",
    )
    resp = client.delete("/api/day/2026/04/13/notes/Temp")
    assert resp.status_code == 200

    resp = client.get("/api/day/2026/04/13")
    titles = [n["title"] for n in resp.json["notes"]]
    assert "Temp" not in titles


def test_delete_special_note_rejected(client):
    client.post("/api/day/2026/04/13/init")
    resp = client.delete("/api/day/2026/04/13/notes/Todo")
    assert resp.status_code == 400


def test_delete_day(client):
    client.post("/api/day/2026/04/13/init")
    resp = client.delete("/api/day/2026/04/13")
    assert resp.status_code == 200
    resp = client.get("/api/day/2026/04/13")
    assert resp.status_code == 404


def test_list_days(client):
    client.post("/api/day/2026/04/05/init")
    client.post("/api/day/2026/04/13/init")
    resp = client.get("/api/days/2026/04")
    assert resp.json["days"] == [5, 13]


def test_weekly_report(client):
    resp = client.get("/api/weekly-report")
    assert resp.status_code == 200
    assert "report" in resp.json


def test_index_page(client):
    resp = client.get("/")
    assert resp.status_code == 200
    assert b"Doneski" in resp.data


def test_healthz_ok(client):
    resp = client.get("/healthz")
    assert resp.status_code == 200
    assert resp.json["status"] == "ok"


@pytest.mark.skipif(
    hasattr(os, "geteuid") and os.geteuid() == 0,
    reason="root bypasses directory permission checks",
)
def test_healthz_unwritable_data_dir(app, client):
    data_dir = app.config["FILE_STORE"].data_dir
    original_mode = os.stat(data_dir).st_mode
    os.chmod(data_dir, 0o500)
    try:
        resp = client.get("/healthz")
    finally:
        os.chmod(data_dir, original_mode)
    assert resp.status_code == 503
    assert resp.json["status"] == "unhealthy"
    assert data_dir in resp.json["error"]
