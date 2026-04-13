import os
import sys


class Config:
    DATA_DIR: str
    HOST: str
    PORT: int
    DEBUG: bool

    def __init__(self):
        data_dir = os.environ.get("DONESKI_DATA_DIR")
        if not data_dir:
            print(
                "Error: DONESKI_DATA_DIR environment variable is required but not set.",
                file=sys.stderr,
            )
            sys.exit(1)

        self.DATA_DIR = data_dir
        self.HOST = os.environ.get("DONESKI_HOST", "127.0.0.1")
        self.PORT = int(os.environ.get("DONESKI_PORT", "5000"))
        self.DEBUG = os.environ.get("DONESKI_DEBUG", "false").lower() == "true"
