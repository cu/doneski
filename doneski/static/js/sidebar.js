/**
 * Sidebar: note list, buttons, day metadata.
 */

import { formatDate, relativeLabel, isToday as isTodayUtil, SPECIAL_TITLES } from "./utils.js";
import { getState } from "./state.js";

let onNoteSelect;
let onNewDay;
let onDeleteDay;
let onAddNote;
let onWeeklyReport;

export function init(callbacks) {
  onNoteSelect = callbacks.onNoteSelect;
  onNewDay = callbacks.onNewDay;
  onDeleteDay = callbacks.onDeleteDay;
  onAddNote = callbacks.onAddNote;
  onWeeklyReport = callbacks.onWeeklyReport;

  document.getElementById("btn-new-day").addEventListener("click", () => onNewDay());
  document.getElementById("btn-add-note").addEventListener("click", handleAddNote);
  document.getElementById("btn-sidebar-menu").addEventListener("click", toggleMenu);
  document.getElementById("btn-weekly-report").addEventListener("click", () => {
    closeMenu();
    onWeeklyReport();
  });
  document.getElementById("btn-delete-day").addEventListener("click", () => {
    closeMenu();
    handleDeleteDay();
  });

  // Close menu when clicking outside
  document.addEventListener("click", (e) => {
    const container = document.getElementById("sidebar-menu-container");
    if (!container.contains(e.target)) {
      closeMenu();
    }
  });
}

function toggleMenu() {
  const menu = document.getElementById("sidebar-menu");
  menu.style.display = menu.style.display === "none" ? "" : "none";
}

function closeMenu() {
  document.getElementById("sidebar-menu").style.display = "none";
}

function handleAddNote() {
  const title = prompt("Enter a title for the new note:");
  if (title !== null && title.trim() !== "") {
    onAddNote(title.trim());
  }
}

function handleDeleteDay() {
  const state = getState();
  const dateStr = formatDate(state.selectedYear, state.selectedMonth, state.selectedDay);
  if (
    confirm(
      `This will permanently delete all notes for ${dateStr}. This cannot be undone. Are you sure?`
    )
  ) {
    onDeleteDay();
  }
}

export function render() {
  const state = getState();
  const { selectedYear, selectedMonth, selectedDay, notes, selectedNote } = state;

  // Day info
  const dayDateEl = document.getElementById("day-date");
  const dayRelativeEl = document.getElementById("day-relative");
  const btnNewDay = document.getElementById("btn-new-day");
  const btnAddNote = document.getElementById("btn-add-note");
  const btnDeleteDay = document.getElementById("btn-delete-day");

  if (selectedYear && selectedMonth && selectedDay) {
    dayDateEl.textContent = formatDate(selectedYear, selectedMonth, selectedDay);
    const rel = relativeLabel(selectedYear, selectedMonth, selectedDay);
    dayRelativeEl.textContent = rel.text;
    dayRelativeEl.className = rel.isPast ? "past-label" : "";
  } else {
    dayDateEl.textContent = "";
    dayRelativeEl.textContent = "";
    dayRelativeEl.className = "";
  }

  const hasNotes = notes && notes.length > 0;

  // New Day button: shown in place of notes list when a day is selected but has no notes
  btnNewDay.style.display = (selectedDay && !hasNotes) ? "" : "none";

  // Add Note button: only visible when day has notes
  btnAddNote.style.display = hasNotes ? "" : "none";

  // Delete Day menu item: only relevant when day has notes
  btnDeleteDay.style.display = hasNotes ? "" : "none";

  // Notes list
  const notesList = document.getElementById("notes-list");
  notesList.innerHTML = "";
  if (notes) {
    for (const note of notes) {
      const li = document.createElement("li");
      li.textContent = note.title;
      li.className = "note-item";
      if (note.title === selectedNote) {
        li.classList.add("active");
      }
      if (SPECIAL_TITLES.has(note.title.toLowerCase())) {
        li.classList.add("special-note");
      }
      li.addEventListener("click", () => onNoteSelect(note.title));
      notesList.appendChild(li);
    }
  }
}
