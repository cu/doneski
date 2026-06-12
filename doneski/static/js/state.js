/**
 * Client-side application state management.
 */

const listeners = [];

const state = {
  // Currently selected date
  selectedYear: null,
  selectedMonth: null,
  selectedDay: null,

  // Notes for the selected day (null = no notes / day not loaded)
  notes: null,

  // Currently selected note title
  selectedNote: null,

  // Which days have notes in the currently viewed calendar month
  calendarYear: null,
  calendarMonth: null,
  daysWithNotes: [],

  // Per-note dirty (unsaved changes) tracking: { [title]: boolean }
  dirty: {},

  // Per-note lock state for past days: { [title]: boolean }
  // true = locked (read-only), false = unlocked
  locked: {},
};

export function getState() {
  return state;
}

export function subscribe(fn) {
  listeners.push(fn);
}

function notify(changes) {
  for (const fn of listeners) {
    fn(changes);
  }
}

export function setSelectedDate(year, month, day) {
  state.selectedYear = year;
  state.selectedMonth = month;
  state.selectedDay = day;
  state.notes = null;
  state.selectedNote = null;
  state.dirty = {};
  state.locked = {};
  notify(["selectedDate"]);
}

export function setNotes(notes) {
  state.notes = notes;
  state.dirty = {};
  state.locked = {};
  // Auto-select the Done note by default; fall back to the first note
  if (notes && notes.length > 0) {
    const doneNote = notes.find(n => n.title === "Done");
    state.selectedNote = doneNote ? doneNote.title : notes[0].title;
  } else {
    state.selectedNote = null;
  }
  notify(["notes"]);
}

export function setSelectedNote(title) {
  state.selectedNote = title;
  notify(["selectedNote"]);
}

export function setCalendarMonth(year, month, daysWithNotes) {
  state.calendarYear = year;
  state.calendarMonth = month;
  state.daysWithNotes = daysWithNotes;
  notify(["calendarMonth"]);
}

export function setDirty(title, isDirty) {
  state.dirty[title] = isDirty;
  notify(["dirty"]);
}

export function setLocked(title, isLocked) {
  state.locked[title] = isLocked;
  notify(["locked"]);
}

export function isNoteLocked(title) {
  // Default: locked for past days (handled by caller checking isToday)
  return state.locked[title] !== false;
}

export function isNoteDirty(title) {
  return !!state.dirty[title];
}

export function updateNoteInState(oldTitle, newTitle, body) {
  if (!state.notes) return;
  for (const note of state.notes) {
    if (note.title === oldTitle) {
      if (newTitle !== undefined) note.title = newTitle;
      if (body !== undefined) note.body = body;
      break;
    }
  }
  // Update selectedNote if the title changed
  if (state.selectedNote === oldTitle && newTitle !== undefined) {
    state.selectedNote = newTitle;
  }
  // Transfer dirty/locked state if title changed
  if (oldTitle !== newTitle && newTitle !== undefined) {
    state.dirty[newTitle] = state.dirty[oldTitle];
    delete state.dirty[oldTitle];
    state.locked[newTitle] = state.locked[oldTitle];
    delete state.locked[oldTitle];
  }
}

export function removeNoteFromState(title) {
  if (!state.notes) return;
  state.notes = state.notes.filter((n) => n.title !== title);
  delete state.dirty[title];
  delete state.locked[title];
  if (state.selectedNote === title) {
    const doneNote = state.notes.find(n => n.title === "Done");
    state.selectedNote = doneNote ? doneNote.title : (state.notes.length > 0 ? state.notes[0].title : null);
  }
  notify(["notes"]);
}
