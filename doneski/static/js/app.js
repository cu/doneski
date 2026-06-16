/**
 * Application entry point and orchestrator.
 */

import * as api from "./api.js";
import * as calendar from "./calendar.js";
import * as sidebar from "./sidebar.js";
import * as editor from "./editor.js";
import { initDialog, showDialog } from "./modal.js";
import {
  setSelectedDate,
  setNotes,
  setSelectedNote,
  setCalendarMonth,
  setLocked,
  getState,
  getNetworkError,
  setNetworkError,
  removeNoteFromState,
  updateNoteInState,
} from "./state.js";
import { today } from "./utils.js";

async function loadMonth(year, month) {
  let prevYear = year, prevMonth = month - 1;
  if (prevMonth < 1) { prevMonth = 12; prevYear--; }
  let nextYear = year, nextMonth = month + 1;
  if (nextMonth > 12) { nextMonth = 1; nextYear++; }

  const [days, prevDays, nextDays] = await Promise.all([
    api.listDaysInMonth(year, month),
    api.listDaysInMonth(prevYear, prevMonth),
    api.listDaysInMonth(nextYear, nextMonth),
  ]);

  setCalendarMonth(year, month, days);
  calendar.setAdjacentHighlightedDays(prevDays, nextDays);
  calendar.setHighlightedDays(days);
}

async function selectDay(year, month, day) {
  // Save current note if dirty before switching days
  await editor.saveCurrentIfDirty();

  // Remember the selected note so we can restore it if it exists on the new day
  const prevNote = getState().selectedNote;

  setSelectedDate(year, month, day);
  sidebar.render();
  editor.render();

  try {
    const notes = await api.getDay(year, month, day);
    setNotes(notes);
    // Restore the previously selected note if it exists in the new day
    if (prevNote && notes.some(n => n.title === prevNote)) {
      setSelectedNote(prevNote);
    }
    editor.buildTextareas(notes);
  } catch {
    // 404 = day has no notes, which is fine
    setNotes(null);
    editor.buildTextareas(null);
  }

  sidebar.render();
  editor.render();
}

async function handleDayClick(year, month, day) {
  if (getNetworkError()) return;
  await selectDay(year, month, day);
}

async function handleNoteSelect(title) {
  const state = getState();
  if (state.selectedNote === title) return;

  // Save and lock current note before switching
  await editor.saveCurrentIfDirty();
  editor.lockCurrent();

  setSelectedNote(title);
  sidebar.render();
  editor.render();
}

async function handleNewDay() {
  if (getNetworkError()) return;
  const state = getState();
  const { selectedYear, selectedMonth, selectedDay } = state;
  try {
    const notes = await api.initDay(selectedYear, selectedMonth, selectedDay);
    setNotes(notes);
    editor.buildTextareas(notes);
    sidebar.render();
    editor.render();
    // Refresh calendar to show the new day as highlighted
    await loadMonth(calendar.getViewYear(), calendar.getViewMonth());
  } catch (err) {
    const p = document.createElement("p");
    p.textContent = err.message;
    showDialog({ title: "Error", content: p });
  }
}

async function handleDeleteDay() {
  if (getNetworkError()) return;
  const state = getState();
  const { selectedYear, selectedMonth, selectedDay } = state;
  // Errors intentionally not caught here; the modal displays them.
  await api.deleteDay(selectedYear, selectedMonth, selectedDay);
  setNotes(null);
  editor.buildTextareas(null);
  sidebar.render();
  editor.render();
  await loadMonth(calendar.getViewYear(), calendar.getViewMonth());
}

async function handleAddNote(title) {
  if (getNetworkError()) return;
  const state = getState();
  const { selectedYear, selectedMonth, selectedDay } = state;
  // Errors are intentionally not caught here; the caller (modal) handles them.
  const note = await api.createNote(selectedYear, selectedMonth, selectedDay, title);
  state.notes.push(note);
  editor.addTextarea(note);
  setSelectedNote(note.title);
  sidebar.render();
  editor.render();
}

async function handleSaveNote(title, body) {
  const state = getState();
  await api.updateNote(
    state.selectedYear,
    state.selectedMonth,
    state.selectedDay,
    title,
    { body }
  );
}

async function handleTitleChange(oldTitle, newTitle) {
  const state = getState();
  await api.updateNote(
    state.selectedYear,
    state.selectedMonth,
    state.selectedDay,
    oldTitle,
    { title: newTitle }
  );
  updateNoteInState(oldTitle, newTitle, undefined);
  sidebar.render();
}

async function handleDeleteNote(title) {
  if (getNetworkError()) return;
  const state = getState();
  await api.deleteNote(
    state.selectedYear,
    state.selectedMonth,
    state.selectedDay,
    title
  );
  editor.removeTextarea(title);
  removeNoteFromState(title);
  sidebar.render();
  editor.render();
}

async function handleWeeklyReport() {
  try {
    const report = await api.getWeeklyReport();
    const modalOverlay = document.getElementById("modal-overlay");
    const modalBody = document.getElementById("modal-body");
    modalBody.textContent = report || "(No completed items for last week.)";
    modalOverlay.style.display = "";
  } catch (err) {
    const p = document.createElement("p");
    p.textContent = err.message;
    showDialog({ title: "Error", content: p });
  }
}

function initModal() {
  const modalOverlay = document.getElementById("modal-overlay");
  const modalClose = document.getElementById("modal-close");
  const btnCopy = document.getElementById("btn-copy-report");

  modalClose.addEventListener("click", () => {
    modalOverlay.style.display = "none";
  });

  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) {
      modalOverlay.style.display = "none";
    }
  });

  btnCopy.addEventListener("click", () => {
    const text = document.getElementById("modal-body").textContent;
    navigator.clipboard.writeText(text).then(
      () => {
        btnCopy.textContent = "Copied!";
        setTimeout(() => {
          btnCopy.textContent = "Copy to Clipboard";
        }, 2000);
      },
      () => {
        const p = document.createElement("p");
        p.textContent = "Failed to copy to clipboard.";
        showDialog({ title: "Error", content: p });
      }
    );
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  // Wire up network error detection
  api.setNetworkCallbacks({
    onNetworkError: () => {
      setNetworkError(true);
      editor.showNetworkBanner();
    },
    onNetworkSuccess: () => {
      if (getNetworkError()) {
        setNetworkError(false);
        editor.hideNetworkBanner();
      }
    },
  });

  // Init modules
  calendar.init(document.getElementById("calendar-container"), handleDayClick);
  sidebar.init({
    onNoteSelect: handleNoteSelect,
    onNewDay: handleNewDay,
    onDeleteDay: handleDeleteDay,
    onAddNote: handleAddNote,
    onWeeklyReport: handleWeeklyReport,
  });
  editor.init({
    onSave: handleSaveNote,
    onTitleChange: handleTitleChange,
    onDelete: handleDeleteNote,
  });
  initModal();
  initDialog();

  // Listen for month navigation
  document.getElementById("calendar-container").addEventListener("monthchange", async (e) => {
    if (getNetworkError()) return;
    await loadMonth(e.detail.year, e.detail.month);
    if (e.detail.day != null) {
      calendar.setSelected(e.detail.day);
      await selectDay(e.detail.year, e.detail.month, e.detail.day);
    }
  });

  // Load current month and select today
  const t = today();
  await loadMonth(t.year, t.month);
  calendar.render();
  calendar.setSelected(t.day);
  await selectDay(t.year, t.month, t.day);
});
