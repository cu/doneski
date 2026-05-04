"""Flask application factory and entry point."""

import os
import sys

from dotenv import load_dotenv
from flask import Flask

from doneski.config import Config
from doneski.routes.api import api
from doneski.routes.pages import pages
from doneski.services.notes import NotesService
from doneski.storage.file_store import FileStore


def create_app(config: Config | None = None, instance_path: str | None = None) -> Flask:
    """Create and configure the Flask application.

    The data directory is Flask's instance folder. Override it by setting the
    DONESKI_DATA environment variable or by passing instance_path directly
    (the latter takes precedence, and is used by tests).
    """
    if config is None:
        config = Config()

    if instance_path is None:
        instance_path = os.environ.get("DONESKI_DATA")

    app = Flask(__name__, instance_path=instance_path)

    if config.DEBUG:
        print(sys.version)
        print(f"Instance path: {app.instance_path}")

    os.makedirs(app.instance_path, exist_ok=True)

    store = FileStore(app.instance_path)
    service = NotesService(store)
    app.config["FILE_STORE"] = store
    app.config["NOTES_SERVICE"] = service

    app.register_blueprint(api)
    app.register_blueprint(pages)

    return app


def main():
    """Entry point for the doneski command."""
    load_dotenv()
    config = Config()
    app = create_app(config)
    app.run(host=config.HOST, port=config.PORT, debug=config.DEBUG)
