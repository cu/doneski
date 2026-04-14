/**
 * Right pane: note header, controls, textarea, auto-save, locking.
 *
 * Uses one hidden textarea per note (show/hide) to preserve native undo/redo.
 */

import {
  getState,
  setDirty,
  setLocked,
  isNoteLocked,
  isNoteDirty,
  updateNoteInState,
} from "./state.js";
import { isToday, SPECIAL_TITLES } from "./utils.js";

const AUTOSAVE_DELAY = 10000; // 10 seconds

let editorBody;
let noteHeader;
let noteTitle;
let noteTitleInput;
let btnSave;
let btnLock;
let btnDelete;
let iconLocked;
let iconUnlocked;
let pastDayBanner;

// Map of note title -> textarea element
let textareas = {};
// Autosave timer per note
let autosaveTimers = {};

let onSave; // (title, body) => Promise
let onTitleChange; // (oldTitle, newTitle) => Promise
let onDelete; // (title) => void

export function init(callbacks) {
  onSave = callbacks.onSave;
  onTitleChange = callbacks.onTitleChange;
  onDelete = callbacks.onDelete;

  editorBody = document.getElementById("editor-body");
  noteHeader = document.getElementById("note-header");
  noteTitle = document.getElementById("note-title");
  noteTitleInput = document.getElementById("note-title-input");
  btnSave = document.getElementById("btn-save");
  btnLock = document.getElementById("btn-lock");
  btnDelete = document.getElementById("btn-delete");
  iconLocked = document.getElementById("icon-locked");
  iconUnlocked = document.getElementById("icon-unlocked");
  pastDayBanner = document.getElementById("past-day-banner");

  btnSave.addEventListener("click", handleSaveClick);
  btnLock.addEventListener("click", handleLockClick);
  btnDelete.addEventListener("click", handleDeleteClick);
  noteTitle.addEventListener("click", handleTitleClick);
  noteTitleInput.addEventListener("keydown", handleTitleKeydown);
  noteTitleInput.addEventListener("blur", handleTitleBlur);
}

/**
 * Build textareas for all notes in the current day.
 * Called when the day changes.
 */
export function buildTextareas(notes) {
  // Save any pending changes from previous day
  flushAll();
  // Clear old textareas
  editorBody.innerHTML = "";
  textareas = {};
  autosaveTimers = {};

  if (!notes) return;

  for (const note of notes) {
    const ta = document.createElement("textarea");
    ta.className = "note-textarea";
    ta.value = note.body;
    ta.style.display = "none";
    ta.spellcheck = false;

    ta.addEventListener("input", () => handleInput(note.title));
    ta.addEventListener("blur", () => handleBlur(note.title));

    editorBody.appendChild(ta);
    textareas[note.title] = ta;
  }
}

/**
 * Show the textarea for the selected note, hide all others.
 */
export function render() {
  const state = getState();
  const { selectedNote, notes, selectedYear, selectedMonth, selectedDay } = state;

  // Hide header and banner if nothing selected
  if (!selectedNote || !notes) {
    noteHeader.style.display = "none";
    pastDayBanner.style.display = "none";
    // Hide all textareas
    for (const ta of Object.values(textareas)) {
      ta.style.display = "none";
    }
    return;
  }

  noteHeader.style.display = "";
  const isCurrentDay = isToday(selectedYear, selectedMonth, selectedDay);
  const isSpecial = SPECIAL_TITLES.has(selectedNote.toLowerCase());
  const locked = !isCurrentDay && isNoteLocked(selectedNote);

  // Title
  noteTitle.textContent = selectedNote;
  noteTitle.title = selectedNote;
  noteTitleInput.style.display = "none";
  noteTitle.style.display = "";

  // Make title non-editable for special notes
  noteTitle.classList.toggle("editable", !isSpecial);

  // Save button
  const dirty = isNoteDirty(selectedNote);
  btnSave.disabled = !dirty;
  btnSave.classList.toggle("dirty", dirty);

  // Lock button
  if (isCurrentDay) {
    btnLock.disabled = true;
    btnLock.classList.add("disabled");
    iconLocked.style.display = "none";
    iconUnlocked.style.display = "";
  } else {
    btnLock.disabled = false;
    btnLock.classList.remove("disabled");
    iconLocked.style.display = locked ? "" : "none";
    iconUnlocked.style.display = locked ? "none" : "";
  }

  // Past day banner
  pastDayBanner.style.display = !isCurrentDay && !locked ? "" : "none";

  // Delete button: hidden for special notes
  btnDelete.style.display = isSpecial ? "none" : "";

  // Show/hide textareas
  for (const [title, ta] of Object.entries(textareas)) {
    if (title === selectedNote) {
      ta.style.display = "";
      ta.readOnly = locked;
      ta.classList.toggle("readonly", locked);
    } else {
      ta.style.display = "none";
    }
  }
}

function handleInput(title) {
  setDirty(title, true);
  renderSaveButton();

  // Reset autosave timer
  if (autosaveTimers[title]) {
    clearTimeout(autosaveTimers[title]);
  }
  autosaveTimers[title] = setTimeout(() => saveNote(title), AUTOSAVE_DELAY);
}

function handleBlur(title) {
  if (isNoteDirty(title)) {
    saveNote(title);
  }
}

async function saveNote(title) {
  if (autosaveTimers[title]) {
    clearTimeout(autosaveTimers[title]);
    delete autosaveTimers[title];
  }

  const ta = textareas[title];
  if (!ta) return;

  const body = ta.value;
  updateNoteInState(title, undefined, body);
  try {
    await onSave(title, body);
    setDirty(title, false);
    renderSaveButton();
  } catch (err) {
    console.error("Failed to save note:", err);
  }
}

function renderSaveButton() {
  const state = getState();
  if (!state.selectedNote) return;
  const dirty = isNoteDirty(state.selectedNote);
  btnSave.disabled = !dirty;
  btnSave.classList.toggle("dirty", dirty);
}

function handleSaveClick() {
  const state = getState();
  if (state.selectedNote && isNoteDirty(state.selectedNote)) {
    saveNote(state.selectedNote);
  }
}

function handleLockClick() {
  const state = getState();
  if (!state.selectedNote) return;
  const isCurrentDay = isToday(state.selectedYear, state.selectedMonth, state.selectedDay);
  if (isCurrentDay) return;

  const currentlyLocked = isNoteLocked(state.selectedNote);
  setLocked(state.selectedNote, !currentlyLocked);
  render();
}

function handleDeleteClick() {
  const state = getState();
  if (!state.selectedNote) return;
  if (SPECIAL_TITLES.has(state.selectedNote.toLowerCase())) return;

  if (confirm(`Are you sure you want to delete "${state.selectedNote}"?`)) {
    onDelete(state.selectedNote);
  }
}

function handleTitleClick() {
  const state = getState();
  if (!state.selectedNote) return;
  if (SPECIAL_TITLES.has(state.selectedNote.toLowerCase())) return;

  // Switch to edit mode
  noteTitle.style.display = "none";
  noteTitleInput.style.display = "";
  noteTitleInput.value = state.selectedNote;
  noteTitleInput.focus();
  noteTitleInput.select();
}

function handleTitleKeydown(e) {
  if (e.key === "Enter") {
    e.preventDefault();
    commitTitleEdit();
  } else if (e.key === "Escape") {
    cancelTitleEdit();
  }
}

function handleTitleBlur() {
  // Small delay to allow Escape to cancel first
  setTimeout(() => {
    if (noteTitleInput.style.display !== "none") {
      commitTitleEdit();
    }
  }, 100);
}

async function commitTitleEdit() {
  const state = getState();
  const newTitle = noteTitleInput.value.trim();
  const oldTitle = state.selectedNote;

  noteTitleInput.style.display = "none";
  noteTitle.style.display = "";

  if (!newTitle || newTitle === oldTitle) return;

  try {
    await onTitleChange(oldTitle, newTitle);
    // Update textarea map
    if (textareas[oldTitle]) {
      textareas[newTitle] = textareas[oldTitle];
      delete textareas[oldTitle];
    }
    noteTitle.textContent = newTitle;
    noteTitle.title = newTitle;
  } catch (err) {
    alert(err.message);
  }
}

function cancelTitleEdit() {
  noteTitleInput.style.display = "none";
  noteTitle.style.display = "";
}

/**
 * Save the currently selected note if dirty. Used before switching notes.
 */
export async function saveCurrentIfDirty() {
  const state = getState();
  if (state.selectedNote && isNoteDirty(state.selectedNote)) {
    await saveNote(state.selectedNote);
  }
}

/**
 * Lock the currently selected note (for past days, on note switch).
 */
export function lockCurrent() {
  const state = getState();
  if (!state.selectedNote) return;
  const isCurrentDay = isToday(state.selectedYear, state.selectedMonth, state.selectedDay);
  if (!isCurrentDay) {
    setLocked(state.selectedNote, true);
  }
}

/**
 * Flush all pending saves (e.g., before switching days).
 */
function flushAll() {
  for (const title of Object.keys(autosaveTimers)) {
    if (isNoteDirty(title)) {
      // Fire save synchronously (best-effort; the timer is cleared)
      clearTimeout(autosaveTimers[title]);
      const ta = textareas[title];
      if (ta) {
        const body = ta.value;
        updateNoteInState(title, undefined, body);
        onSave(title, body).catch((err) =>
          console.error("Failed to flush save:", err)
        );
        setDirty(title, false);
      }
    }
  }
  autosaveTimers = {};
}

/**
 * Remove a textarea when a note is deleted.
 */
export function removeTextarea(title) {
  if (textareas[title]) {
    textareas[title].remove();
    delete textareas[title];
  }
  if (autosaveTimers[title]) {
    clearTimeout(autosaveTimers[title]);
    delete autosaveTimers[title];
  }
}

/**
 * Add a textarea for a newly created note.
 */
export function addTextarea(note) {
  const ta = document.createElement("textarea");
  ta.className = "note-textarea";
  ta.value = note.body;
  ta.style.display = "none";
  ta.spellcheck = false;

  ta.addEventListener("input", () => handleInput(note.title));
  ta.addEventListener("blur", () => handleBlur(note.title));

  editorBody.appendChild(ta);
  textareas[note.title] = ta;
}
