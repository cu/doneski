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

  document.getElementById("btn-new-day").addEventListener("click", handleNewDayOrDelete);
  document.getElementById("btn-add-note").addEventListener("click", handleAddNote);
  document.getElementById("btn-weekly-report").addEventListener("click", onWeeklyReport);
}

function handleNewDayOrDelete() {
  const state = getState();
  if (state.notes && state.notes.length > 0) {
    // Day has notes -> this is the "Delete Day" button
    const dateStr = formatDate(state.selectedYear, state.selectedMonth, state.selectedDay);
    if (
      confirm(
        `This will permanently delete all notes for ${dateStr}. This cannot be undone. Are you sure?`
      )
    ) {
      onDeleteDay();
    }
  } else {
    // No notes -> this is the "New Day" button
    onNewDay();
  }
}

function handleAddNote() {
  const title = prompt("Enter a title for the new note:");
  if (title !== null && title.trim() !== "") {
    onAddNote(title.trim());
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

  // New Day / Delete Day button
  const hasNotes = notes && notes.length > 0;
  if (hasNotes) {
    btnNewDay.textContent = "Delete Day";
    btnNewDay.classList.add("danger");
  } else {
    btnNewDay.textContent = "New Day";
    btnNewDay.classList.remove("danger");
  }
  // Only show the button if a day is selected
  btnNewDay.style.display = selectedDay ? "" : "none";

  // Add Note button: only visible when day has notes
  btnAddNote.style.display = hasNotes ? "" : "none";

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
        li.classList.add("special-note")
      }
      li.addEventListener("click", () => onNoteSelect(note.title));
      notesList.appendChild(li);
    }
  }
}
