/**
 * Right pane: note header, controls, CodeMirror editor, auto-save, locking.
 *
 * Uses a single CodeMirror 5 instance with swapDoc() to switch between notes.
 * Each note gets its own CodeMirror.Doc, which preserves undo/redo history.
 */

import {
  getState,
  setDirty,
  setLocked,
  isNoteLocked,
  isNoteDirty,
  getNetworkError,
  updateNoteInState,
} from "./state.js";
import { isToday, SPECIAL_TITLES } from "./utils.js";
import { showDialog } from "./modal.js";

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
let editorBanners;
let bannerPastDay;
let bannerNetworkError;

// Single CodeMirror editor instance
let cm = null;
// Map of note title -> CodeMirror.Doc
let docs = {};
// Autosave timer per note
let autosaveTimers = {};
// Title of the note currently loaded in the editor (may differ from selectedNote
// briefly during transitions)
let activeDocTitle = null;

let onSave; // (title, body) => Promise
let onTitleChange; // (oldTitle, newTitle) => Promise
let onDelete; // (title) => void

/**
 * Create the CodeMirror instance (once) inside the editor-body container.
 */
function ensureEditor() {
  if (cm) return;
  cm = CodeMirror(editorBody, {
    mode: "gfm",
    lineWrapping: true,
    inputStyle: "contenteditable",
    spellcheck: false,
    extraKeys: { Enter: "newlineAndIndentContinueMarkdownList" },
    lineNumbers: false,
    // Start with an empty read-only doc until a note is selected
    readOnly: true,
  });

  cm.on("changes", () => {
    if (activeDocTitle) handleInput(activeDocTitle);
  });
  cm.on("blur", () => {
    if (activeDocTitle) handleBlur(activeDocTitle);
  });
}

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
  editorBanners = document.getElementById("editor-banners");
  bannerPastDay = document.getElementById("banner-past-day");
  bannerNetworkError = document.getElementById("banner-network-error");

  btnSave.addEventListener("click", handleSaveClick);
  btnLock.addEventListener("click", handleLockClick);
  btnDelete.addEventListener("click", handleDeleteClick);
  noteTitle.addEventListener("click", handleTitleClick);
  noteTitleInput.addEventListener("keydown", handleTitleKeydown);
  noteTitleInput.addEventListener("blur", handleTitleBlur);

  ensureEditor();
}

/**
 * Build docs for all notes in the current day.
 * Called when the day changes.
 */
export function buildTextareas(notes) {
  // Save any pending changes from previous day
  flushAll();
  // Clear old docs
  docs = {};
  autosaveTimers = {};
  activeDocTitle = null;

  if (!notes) return;

  for (const note of notes) {
    docs[note.title] = CodeMirror.Doc(note.body, "gfm");
  }
}

/**
 * Swap in the doc for the selected note, update header and controls.
 */
export function render() {
  const state = getState();
  const { selectedNote, notes, selectedYear, selectedMonth, selectedDay } = state;

  // Hide header and editor if nothing selected
  if (!selectedNote || !notes) {
    noteHeader.style.display = "none";
    bannerPastDay.style.display = "none";
    updateBannersVisibility();
    if (cm) cm.getWrapperElement().style.display = "none";
    activeDocTitle = null;
    return;
  }

  noteHeader.style.display = "";
  if (cm) cm.getWrapperElement().style.display = "";

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
  bannerPastDay.style.display = !isCurrentDay && !locked ? "" : "none";
  updateBannersVisibility();

  // Delete button: hidden for special notes
  btnDelete.style.display = isSpecial ? "none" : "";

  // Swap to the selected note's doc
  if (cm && docs[selectedNote]) {
    activeDocTitle = selectedNote;
    cm.swapDoc(docs[selectedNote]);
    cm.setOption("readOnly", locked);
    cm.getWrapperElement().classList.toggle("readonly", locked);
    cm.refresh();
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

  const doc = docs[title];
  if (!doc) return;

  const body = doc.getValue();
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

  const title = state.selectedNote;
  const content = document.createElement("p");
  content.textContent = `Are you sure you want to delete "${title}"?`;

  showDialog({
    title: "Delete Note",
    content,
    actionLabel: "Delete",
    actionVariant: "danger",
    onAction: async () => {
      await onDelete(title);
    },
  });
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
    // Update docs map
    if (docs[oldTitle]) {
      docs[newTitle] = docs[oldTitle];
      delete docs[oldTitle];
    }
    if (activeDocTitle === oldTitle) {
      activeDocTitle = newTitle;
    }
    // Update autosave timer key
    if (autosaveTimers[oldTitle]) {
      autosaveTimers[newTitle] = autosaveTimers[oldTitle];
      delete autosaveTimers[oldTitle];
    }
    noteTitle.textContent = newTitle;
    noteTitle.title = newTitle;
  } catch (err) {
    const p = document.createElement("p");
    p.textContent = err.message;
    showDialog({
      title: "Error renaming note",
      content: p,
    });
  }
}

function cancelTitleEdit() {
  noteTitleInput.style.display = "none";
  noteTitle.style.display = "";
}

/**
 * Show or hide the banners container based on whether any child is visible.
 */
function updateBannersVisibility() {
  const anyVisible = Array.from(editorBanners.querySelectorAll("li"))
    .some(li => li.style.display !== "none");
  editorBanners.style.display = anyVisible ? "" : "none";
}

export function showNetworkBanner() {
  bannerNetworkError.style.display = "";
  updateBannersVisibility();
}

export function hideNetworkBanner() {
  bannerNetworkError.style.display = "none";
  updateBannersVisibility();
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
      clearTimeout(autosaveTimers[title]);
      const doc = docs[title];
      if (doc) {
        const body = doc.getValue();
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
 * Remove a doc when a note is deleted.
 */
export function removeTextarea(title) {
  delete docs[title];
  if (activeDocTitle === title) {
    activeDocTitle = null;
  }
  if (autosaveTimers[title]) {
    clearTimeout(autosaveTimers[title]);
    delete autosaveTimers[title];
  }
}

/**
 * Add a doc for a newly created note.
 */
export function addTextarea(note) {
  docs[note.title] = CodeMirror.Doc(note.body, "gfm");
}
