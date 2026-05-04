# About

Doneski is a personal daily task/notes management web application. The core workflow is: start each day by carrying over the previous day's notes, edit throughout the day, and occasionally review via weekly reports.

# Tech Stack

* Language: Python
* Framework: Flask
* Frontend: Vanilla JS
* Storage: JSON files
* Project management: uv

# Project Structure

```
├─ AGENTS.md                   # this file
├─ pyproject.toml              # uv project config
├─ README.md
├─ doneski/                    # Python package (flat layout, no src/)
│  ├─ app.py                   # Flask application factory + main() entry point
│  ├─ config.py                # Configuration (data dir, port, etc.)
│  ├─ routes/
│  │  ├─ api.py                # REST API endpoints
│  │  └─ pages.py              # Page-serving routes (just the SPA shell)
│  ├─ services/
│  │  ├─ notes.py              # Business logic: day init, note CRUD, carry‑over
│  │  └─ weekly_report.py      # Weekly report generation
│  ├─ storage/
│  │  └─ file_store.py         # JSON file read/write, directory scanning
│  ├─ static/
│  │  ├─ css/
│  │  │  └─ style.css          # All application styles
│  │  └─ js/
│  │     ├─ app.js             # Entry point, app initialization and routing
│  │     ├─ api.js             # Fetch wrapper for all backend calls
│  │     ├─ calendar.js        # Calendar widget rendering and interaction
│  │     ├─ sidebar.js         # Sidebar: note list, buttons, day metadata
│  │     ├─ editor.js          # Right pane: note header, controls, textarea
│  │     ├─ state.js           # Client‑side application state management
│  │     └─ utils.js           # Date formatting, helpers
│  └─ templates/
│     └─ index.html            # Single‑page app shell
└─ tests/
   ├─ conftest.py
   ├─ test_notes_service.py
   ├─ test_file_store.py
   └─ test_api.py
```

# Key structural decisions

- **Single-page application**: Flask serves one HTML page; all interaction is handled client-side via JS calling REST APIs. No full-page reloads.
- **Flat package layout**: `doneski/` lives directly in the project root (no `src/` prefix). Simpler for an app; `uv` handles it with hatchling as the build backend.
- **Service layer**: Business logic (day initialization, carry-over, validation) lives in `services/`, separate from HTTP routing and file I/O. This makes it testable and keeps routes thin.
- **Storage layer**: All file system access is isolated in `storage/file_store.py`. If we ever want to swap to SQLite or similar, only this layer changes.

# JSON File Schema

One file per day at `<data_dir>/<YYYY>/<MM>/<DD>.json`:

```json
[
  {
    "title": "Todo",
    "created": -2,
    "body": "- Item one\n- Item two"
  },
  {
    "title": "Done",
    "created": -1,
    "body": ""
  },
  {
    "title": "Sprint Planning Notes",
    "created": 1712764801,
    "body": "Discussed velocity..."
  }
]
```

**Fields:**
- `title` (string, max 80 chars): Unique within a day. Serves as the note identifier.
- `created` (integer, unix epoch): Timestamp of note creation. **`-2` for Todo, `-1` for Done.** This ensures they always sort to the top (Todo first, Done second) without any special-case ordering logic. Regular notes use a real unix timestamp.
- `body` (string): Plaintext content (Markdown in a future iteration).

**Ordering:** Notes are stored in display order within the JSON array: Todo first, Done second, then regular notes sorted by `created` ascending. This means the file's array order IS the canonical display order.

**Special notes:**
- "Todo": Always present. Body carries over from the previous day during day initialization.
- "Done": Always present. Body is always blank on day initialization (never carries over).
- Neither can be deleted or renamed.

# REST API Endpoints

All endpoints are prefixed with `/api/`.

## Day Operations

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/days/<year>/<month>` | List days in a month that have notes. Returns `{"days": [1, 5, 12, ...]}` |
| `GET` | `/api/day/<year>/<month>/<day>` | Get all notes for a day. Returns `{"notes": [...]}` or 404 if no notes exist. |
| `POST` | `/api/day/<year>/<month>/<day>/init` | Initialize a new day. Copies notes from the most recent previous day with notes (except Done). Returns the new day's notes. Returns 409 if day already initialized. |
| `DELETE` | `/api/day/<year>/<month>/<day>` | Delete all notes for a day (deletes the JSON file). Returns 200 on success, 404 if not found. |

## Note Operations

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/day/<year>/<month>/<day>/notes` | Create a new note. Body: `{"title": "..."}`. Returns 201 with the new note, or 400/409 for validation errors. |
| `PUT` | `/api/day/<year>/<month>/<day>/notes/<title>` | Update a note. Body: `{"title": "...", "body": "..."}`. Either field is optional. Returns updated note. The `<title>` in the URL is the *current* title (URL-encoded). |
| `DELETE` | `/api/day/<year>/<month>/<day>/notes/<title>` | Delete a note. Returns 400 if attempting to delete Todo or Done. |

## Reports

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/weekly-report?date=<YYYY-MM-DD>` | Generate weekly report. Returns Done note contents from every day in the **previous** full week (Sun-Sat) relative to the given date. The `date` parameter defaults to today if omitted. Returns `{"report": "..."}` as formatted plaintext. |

## Validation Rules (enforced server-side)

- Note title max length: 80 characters.
- Note title must be unique within a day (case-sensitive).
- Regular notes cannot be titled "Todo" or "Done" (case-**in**sensitive — "todo", "TODO", "dOnE", etc. are all rejected).
- Cannot delete or rename the Todo or Done notes.
- Cannot initialize a day that already has notes (409 Conflict).
- Cannot initialize a day in the future (400 Bad Request).
- Day init finds the most recent previous day with notes (scanning backwards). If no previous day exists (first-ever use), creates only empty Todo and Done notes.

# Frontend Architecture

## Module Responsibilities

**`app.js`** - Application entry point and orchestrator
- Initializes all modules on DOMContentLoaded
- Coordinates inter-module communication via a simple event/callback pattern
- Manages the overall app state transitions (selected day, selected note)

**`state.js`** - Client-side state management
- Holds current application state: selected date, selected note title, notes list, dirty flags, lock states
- Provides getter/setter methods that trigger UI updates via callbacks
- Tracks which notes have unsaved changes (dirty map)
- Tracks lock state per note (UI-only, not persisted)

**`api.js`** - Backend communication
- Thin async fetch wrapper for each API endpoint
- Handles HTTP errors, returns parsed JSON
- Single point of change if API paths change

**`calendar.js`** - Calendar widget
- Renders a month grid (Sun-Sat columns)
- Shows trailing days from the previous month to fill the first row
- Highlights days that have notes (fetched via `GET /api/days/<year>/<month>`)
- Grays out / disables future days
- Supports navigating to previous/next months via arrows
- Click handler: selects a day, triggers sidebar update
- No right-click override; day deletion is handled via a sidebar button (see sidebar.js)
- Visually distinguishes: today, selected day, days with notes, days without notes, future days

**`sidebar.js`** - Left pane below calendar
- Displays selected day's date in format: `<DayOfWeek>, <Month> <Day> <Year>`
- Displays relative label: "Today" (normal), "Yesterday" (red), "X Days Ago" (red)
- Renders note list (note titles, clickable)
- **"New Day" / "Delete Day" button**: When the selected day has no notes, this button shows "New Day" and calls the init endpoint. When the selected day already has notes, this button becomes "Delete Day" (with a serious confirmation dialog). This repurposes the same button slot since "New Day" is irrelevant once a day is populated.
- "Add Note" button: calls create endpoint, refreshes sidebar, selects new note. Only visible/enabled when the selected day has notes.
- "Weekly Report" button: fetches report, shows in modal dialog

**`editor.js`** - Right pane
- Note header: editable title (click-to-edit), truncated with ellipsis and hover tooltip
- Note controls: Save (floppy disk), Lock/Unlock (padlock), Delete (trash can)
- Note body: textarea with monospaced font
- Manages auto-save timer (10 second idle after last edit)
- Saves on blur (focus leaves textarea)
- Save icon: red when dirty, gray when clean
- Lock behavior:
  - Current day: always unlocked, padlock icon grayed out / non-interactive
  - Previous days: locked by default, click padlock to unlock, auto-locks on note switch
- Warning banner for editing previous days' notes (visible when note is unlocked on a past day)

## Undo/Redo Strategy

The planning doc requires per-note undo buffers using the platform's native undo/redo.

**Approach: One textarea per note, show/hide**

Rather than reusing a single textarea and swapping its `.value` (which destroys the browser's native undo stack), we create a separate `<textarea>` element for each note in the current day. Only one is visible at a time; switching notes hides the current textarea and shows the target one. This preserves each note's native undo/redo history for the lifetime of the page session.

When the selected day changes, all textareas are destroyed and new ones are created for the new day's notes. Undo history does not persist across day switches (this is expected and acceptable).

## Auto-Save Logic

```
User types in textarea
  -> Mark note as dirty (save icon turns red)
  -> Reset 10-second idle timer
  -> If timer fires: save via PUT API, mark clean (icon turns gray)

User blurs textarea (clicks elsewhere)
  -> If dirty: save immediately

User clicks red save icon
  -> Save immediately

User switches notes
  -> If current note is dirty: save immediately
  -> Then switch to new note
```

**Debounce detail**: Each keystroke resets the timer. Only after 10 seconds of no keystrokes does auto-save fire. This prevents saving on every character while still saving reasonably promptly.

# UI Layout

**Header controls (right side of note header):**
- **Save** (floppy disk icon): Red when unsaved changes exist, gray/disabled when clean
- **Lock** (padlock icon): Shows locked/unlocked state; grayed out for current day's notes
- **Delete** (trash icon): Deletes note after confirmation; hidden/disabled for Todo and Done

# Key Behaviors and Logic

## Day Initialization ("New Day")

1. User selects a date in the calendar (must be today or in the past).
2. User clicks "New Day".
3. Backend finds the most recent previous date that has a notes file by scanning backwards from the target date.
4. Backend reads that previous day's notes.
5. Backend creates a new notes file for the target date containing:
   - "Todo" note with body copied from the previous day's Todo note
   - "Done" note with empty body (never carried over)
   - All regular notes from the previous day, with their bodies carried over and new `created` timestamps
6. If no previous day exists at all (first-ever use), create only empty Todo and Done.
7. Frontend refreshes the calendar (to highlight the new day) and sidebar (to show the notes).

**"Scanning backwards"**: To find the previous day with notes, we need an efficient strategy. Rather than scanning day-by-day (could be slow over gaps), we can:
- First, check days in the same month (we already have the month's day list from the calendar data).
- If not found, scan month directories backwards until we find one with day files, then take the latest day file in that month.
- Set a reasonable limit (e.g., 1 year back) to avoid infinite scanning.

## Retroactive Day Addition

The planning doc's example: Monday has notes, Wednesday has notes, user retroactively creates Tuesday.

1. User clicks on Tuesday in the calendar (no notes exist for Tuesday).
2. User clicks "New Day".
3. Backend finds the most recent day before Tuesday with notes = Monday.
4. Backend creates Tuesday's notes by copying from Monday (except Done).
5. Wednesday's notes are NOT affected in any way.

This works naturally with the "find most recent previous day" logic. No special handling needed.

## Calendar Month Scanning

When the calendar navigates to a month, the frontend calls `GET /api/days/<year>/<month>` to get which days have notes. This is implemented by listing files in `<data_dir>/<year>/<month>/` and returning the day numbers.

## Note Locking (Past Days)

Lock state is purely client-side (in `state.js`). It is NOT stored in JSON.

- When a past day's notes are loaded, all notes start in locked state.
- The textarea is set to `readonly` when locked.
- Clicking the padlock icon on a past-day note unlocks it and shows the warning banner.
- Switching to a different note auto-locks the previously viewed note.
- Current-day notes are always unlocked; the padlock icon is visible but grayed out / non-interactive.

## Weekly Report

When "Weekly Report" is clicked:

1. Frontend calls `GET /api/weekly-report` (optionally with `?date=` for the selected day, defaults to today).
2. Backend determines the previous full week (Sunday through Saturday) relative to the given date.
3. Backend reads the Done note from each day in that week that has notes.
4. Backend concatenates them with day headers in bold:

```
**Monday, April 6, 2026**

Contents of Monday's Done note...

**Tuesday, April 7, 2026**

Contents of Tuesday's Done note...
```

5. Frontend displays this in a modal dialog with a "Copy to Clipboard" button.
6. Days without notes (or with empty Done notes) are skipped.

## Note Title Editing

- Single-click on the title makes it editable (e.g., swap the title element for an input field, or use `contenteditable`).
- On blur or Enter, validate:
  - Not empty
  - Max 80 characters
  - Not "Todo" or "Done" (for regular notes)
  - Not a duplicate of another note's title in the same day
- If valid, send PUT to update title on backend.
- If invalid, revert to previous title and show a brief error message.

## Note Deletion

- Click trash icon -> confirmation dialog ("Are you sure you want to delete 'Note Title'?")
- On confirm: DELETE API call, remove note from sidebar, select the next note in the list (or Todo if no other notes remain).
- Trash icon is hidden or disabled for Todo and Done notes.

## Day Deletion (Sidebar Button)

- When the selected day already has notes, the "New Day" button becomes a "Delete Day" button.
- On click: serious confirmation dialog ("This will permanently delete all notes for Friday, April 10, 2026. This cannot be undone. Are you sure?")
- On confirm: DELETE API call, refresh calendar and sidebar. The button reverts to "New Day" since the day now has no notes.
- Available for any day including today.

# Configuration

App configuration is handled in `doneski/config.py` and is controlled by environment variables. These can be set on the command line or specified in the `.env` file (not included in the git repo). Some of the more important vars are:

- `DONESKI_DATA`: Overrides Flask's instance folder, which is where note files are stored. Defaults to `instance/` relative to the project root.
- `DONESKI_DEBUG`: Enables Werkzeug's debug mode.
- `DONESKI_HOST`: IP for development server to listen on.
- `DONESKI_PORT`: Port for development server to listen on.

# 11. Additional Observations and Potential Pitfalls

### Carried-over notes preserve their `created` timestamp

When notes are copied during day initialization, regular notes keep their original `created` value. This preserves their relative ordering in the sidebar. New notes added during the day get a current timestamp, so they naturally appear after carried-over notes.

### Todo always before Done in display order

Todo has `created=-2` and Done has `created=-1`, so they naturally sort before all regular notes (which have positive unix timestamps). No special-case sorting logic needed — a simple ascending sort by `created` produces the correct order.

### Per-note undo via hidden textareas

The approach of creating a separate `<textarea>` per note and showing/hiding them is simple and effective for preserving native undo/redo. For a personal app with ~5-10 notes per day, the DOM overhead is negligible. However, this means undo history is lost when switching to a different day (all textareas are destroyed and recreated). This is acceptable behavior.

### Atomic file writes prevent corruption

Since auto-save can fire frequently, and the user might also click save manually, all writes go through a write-to-temp-then-rename pattern (`os.replace()`). This ensures the JSON file is never in a half-written state.

### "Find previous day" scanning strategy

To avoid scanning day-by-day across potentially large gaps:
1. List day files in the target month, find the latest day before the target date.
2. If not found, scan month directories backwards (year/month), find the latest day file in the first non-empty month found.
3. Hard limit of ~2 years back to avoid pathological edge cases.

### "New Day" / "Delete Day" button dual purpose

The sidebar button slot serves double duty: "New Day" when the selected day has no notes, "Delete Day" when it does. This avoids the complexity of a custom right-click context menu and keeps the interaction discoverable. The button's label, style, and click handler swap based on whether notes exist for the selected day.
