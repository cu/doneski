import os
import tempfile

import pytest

from doneski.app import create_app
from doneski.config import Config
from doneski.services.notes import NotesService
from doneski.storage.file_store import FileStore


@pytest.fixture
def data_dir(tmp_path):
    return str(tmp_path)


@pytest.fixture
def store(data_dir):
    return FileStore(data_dir)


@pytest.fixture
def service(store):
    return NotesService(store)


@pytest.fixture
def app(data_dir):
    config = Config.__new__(Config)
    config.DATA_DIR = data_dir
    config.HOST = "127.0.0.1"
    config.PORT = 5000
    config.DEBUG = False
    return create_app(config)


@pytest.fixture
def client(app):
    return app.test_client()
