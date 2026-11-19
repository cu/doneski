"""Page-serving routes (SPA shell) and the container health check."""

import os

from flask import Blueprint, current_app, jsonify, render_template

pages = Blueprint("pages", __name__)


@pages.route("/")
def index():
    return render_template("index.html")


@pages.route("/healthz")
def healthz():
    """Report whether the app can actually serve requests.

    Checks that the data directory is writable, because the most likely way a
    container comes up broken is a mounted data volume owned by the wrong user
    (see the Docker notes in docs/architecture.md). Returns 503 in that case so
    the container is reported unhealthy instead of silently failing on write.
    """
    data_dir = current_app.config["FILE_STORE"].data_dir
    if not os.access(data_dir, os.W_OK | os.X_OK):
        return jsonify({"status": "unhealthy", "error": f"Data directory is not writable: {data_dir}"}), 503
    return jsonify({"status": "ok"})
