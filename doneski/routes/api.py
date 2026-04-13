"""REST API endpoints for Doneski."""

from datetime import date

from flask import Blueprint, jsonify, request

from doneski.services.notes import NoteError, NotesService
from doneski.services.weekly_report import generate_weekly_report

api = Blueprint("api", __name__, url_prefix="/api")


def _parse_date(year: str, month: str, day: str) -> date:
    return date(int(year), int(month), int(day))


def _get_service() -> NotesService:
    from flask import current_app
    return current_app.config["NOTES_SERVICE"]


def _get_store():
    from flask import current_app
    return current_app.config["FILE_STORE"]


@api.errorhandler(NoteError)
def handle_note_error(e: NoteError):
    return jsonify({"error": e.message}), e.status_code


@api.errorhandler(ValueError)
def handle_value_error(e: ValueError):
    return jsonify({"error": str(e)}), 400


# --- Day operations ---


@api.route("/days/<year>/<month>", methods=["GET"])
def list_days(year: str, month: str):
    service = _get_service()
    days = service.list_days_in_month(int(year), int(month))
    return jsonify({"days": days})


@api.route("/day/<year>/<month>/<day>", methods=["GET"])
def get_day(year: str, month: str, day: str):
    service = _get_service()
    d = _parse_date(year, month, day)
    notes = service.get_day(d)
    if notes is None:
        return jsonify({"error": f"No notes for {d.isoformat()}"}), 404
    return jsonify({"notes": notes})


@api.route("/day/<year>/<month>/<day>/init", methods=["POST"])
def init_day(year: str, month: str, day: str):
    service = _get_service()
    d = _parse_date(year, month, day)
    notes = service.init_day(d)
    return jsonify({"notes": notes}), 201


@api.route("/day/<year>/<month>/<day>", methods=["DELETE"])
def delete_day(year: str, month: str, day: str):
    service = _get_service()
    d = _parse_date(year, month, day)
    service.delete_day(d)
    return jsonify({"ok": True})


# --- Note operations ---


@api.route("/day/<year>/<month>/<day>/notes", methods=["POST"])
def create_note(year: str, month: str, day: str):
    service = _get_service()
    d = _parse_date(year, month, day)
    data = request.get_json()
    if not data or "title" not in data:
        return jsonify({"error": "Missing 'title' in request body."}), 400
    note = service.create_note(d, data["title"])
    return jsonify(note), 201


@api.route("/day/<year>/<month>/<day>/notes/<path:title>", methods=["PUT"])
def update_note(year: str, month: str, day: str, title: str):
    service = _get_service()
    d = _parse_date(year, month, day)
    data = request.get_json()
    if not data:
        return jsonify({"error": "Missing request body."}), 400
    note = service.update_note(
        d,
        current_title=title,
        new_title=data.get("title"),
        body=data.get("body"),
    )
    return jsonify(note)


@api.route("/day/<year>/<month>/<day>/notes/<path:title>", methods=["DELETE"])
def delete_note(year: str, month: str, day: str, title: str):
    service = _get_service()
    d = _parse_date(year, month, day)
    service.delete_note(d, title)
    return jsonify({"ok": True})


# --- Reports ---


@api.route("/weekly-report", methods=["GET"])
def weekly_report():
    store = _get_store()
    date_str = request.args.get("date")
    ref_date = date.fromisoformat(date_str) if date_str else None
    report = generate_weekly_report(store, ref_date)
    return jsonify({"report": report})
