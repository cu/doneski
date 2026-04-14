# Doneski

Doneski is a personal daily task and notes management web application designed for anyone who needs to track work items and meeting notes from day to day. Each day carries over the previous day's notes (except completed items), allowing you to maintain a running view of your tasks while keeping a clean daily record of what got done. It features a calendar-based navigation sidebar, per-note editing with auto-save, note locking to prevent accidental edits to past days, and a weekly report generator that compiles your completed items for easy sharing.

# Technology Stack

- **Backend:** Python, Flask
- **Frontend:** Vanilla JavaScript (ES modules, no build step)
- **Storage:** JSON files (one file per day)
- **Project Management:** uv

# Running

Requires [uv](https://github.com/astral-sh/uv) and Python 3.13+.

```bash
uv sync
DONESKI_DATA_DIR=~/.doneski/data uv run doneski
```

The app will be available at `http://127.0.0.1:5000`. The `DONESKI_DATA_DIR` environment variable is required and specifies where note files are stored. Optionally set `DONESKI_HOST`, `DONESKI_PORT`, or `DONESKI_DEBUG`.

# Development

Run tests with:

```bash
uv run pytest
```
