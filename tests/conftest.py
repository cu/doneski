import pytest

from doneski.app import create_app
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
def app(tmp_path):
    return create_app(instance_path=str(tmp_path))


@pytest.fixture
def client(app):
    return app.test_client()
