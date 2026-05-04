import os


class Config:
    """Application configuration loaded from environment variables."""

    HOST: str
    PORT: int
    DEBUG: bool

    def __init__(self):
        self.HOST = os.environ.get("DONESKI_HOST", "127.0.0.1")
        self.PORT = int(os.environ.get("DONESKI_PORT", "5000"))
        self.DEBUG = os.environ.get("DONESKI_DEBUG", "false").lower() == "true"
