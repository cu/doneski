"""Flask application factory and entry point."""

from dotenv import load_dotenv
from flask import Flask

from doneski.config import Config
from doneski.routes.api import api
from doneski.routes.pages import pages
from doneski.services.notes import NotesService
from doneski.storage.file_store import FileStore


def create_app(config: Config | None = None) -> Flask:
    if config is None:
        config = Config()

    app = Flask(__name__)

    store = FileStore(config.DATA_DIR)
    service = NotesService(store)
    app.config["FILE_STORE"] = store
    app.config["NOTES_SERVICE"] = service

    app.register_blueprint(api)
    app.register_blueprint(pages)

    return app


def main():
    load_dotenv()
    config = Config()
    app = create_app(config)
    app.run(host=config.HOST, port=config.PORT, debug=config.DEBUG)
