/**
 * Calendar widget rendering and interaction.
 */

import { daysInMonth, firstDayOfWeek, isFuture, isToday, monthName } from "./utils.js";

let container;
let onDayClick;
let viewYear;
let viewMonth;
let highlightedDays = new Set();
let selectedDay = null;

export function init(containerEl, dayClickCallback) {
  container = containerEl;
  onDayClick = dayClickCallback;
  const now = new Date();
  viewYear = now.getFullYear();
  viewMonth = now.getMonth() + 1;
}

export function setHighlightedDays(days) {
  highlightedDays = new Set(days);
  render();
}

export function setSelected(day) {
  selectedDay = day;
  render();
}

export function getViewYear() {
  return viewYear;
}

export function getViewMonth() {
  return viewMonth;
}

function navigateMonth(delta) {
  viewMonth += delta;
  if (viewMonth > 12) {
    viewMonth = 1;
    viewYear++;
  } else if (viewMonth < 1) {
    viewMonth = 12;
    viewYear--;
  }
  selectedDay = null;
  // Notify app to load new month's data
  container.dispatchEvent(
    new CustomEvent("monthchange", {
      detail: { year: viewYear, month: viewMonth },
      bubbles: true,
    })
  );
}

export function render() {
  const totalDays = daysInMonth(viewYear, viewMonth);
  const startDow = firstDayOfWeek(viewYear, viewMonth);

  // Previous month trailing days
  let prevYear = viewYear;
  let prevMonth = viewMonth - 1;
  if (prevMonth < 1) {
    prevMonth = 12;
    prevYear--;
  }
  const prevMonthDays = daysInMonth(prevYear, prevMonth);

  let html = `
    <div class="calendar-header">
      <button class="cal-nav" id="cal-prev">&lsaquo;</button>
      <span class="cal-title">${monthName(viewMonth)} ${viewYear}</span>
      <button class="cal-nav" id="cal-next">&rsaquo;</button>
    </div>
    <table class="calendar-grid">
      <thead>
        <tr>
          <th>Su</th><th>Mo</th><th>Tu</th><th>We</th><th>Th</th><th>Fr</th><th>Sa</th>
        </tr>
      </thead>
      <tbody>
  `;

  let dayNum = 1;
  let nextMonthDay = 1;
  const rows = Math.ceil((startDow + totalDays) / 7);

  for (let row = 0; row < rows; row++) {
    html += "<tr>";
    for (let col = 0; col < 7; col++) {
      const cellIndex = row * 7 + col;
      if (cellIndex < startDow) {
        // Previous month trailing days
        const pDay = prevMonthDays - startDow + cellIndex + 1;
        html += `<td class="cal-day other-month">${pDay}</td>`;
      } else if (dayNum > totalDays) {
        // Next month leading days
        html += `<td class="cal-day other-month">${nextMonthDay++}</td>`;
      } else {
        const d = dayNum;
        const classes = ["cal-day"];
        const future = isFuture(viewYear, viewMonth, d);
        const todayFlag = isToday(viewYear, viewMonth, d);
        const hasNotes = highlightedDays.has(d);
        const isSelected = d === selectedDay;

        if (future) classes.push("future");
        if (todayFlag) classes.push("today");
        if (hasNotes) classes.push("has-notes");
        if (isSelected) classes.push("selected");

        if (future) {
          html += `<td class="${classes.join(" ")}">${d}</td>`;
        } else {
          html += `<td class="${classes.join(" ")}" data-day="${d}">${d}</td>`;
        }
        dayNum++;
      }
    }
    html += "</tr>";
  }

  html += "</tbody></table>";
  container.innerHTML = html;

  // Attach event listeners
  container.querySelector("#cal-prev").addEventListener("click", () => navigateMonth(-1));
  container.querySelector("#cal-next").addEventListener("click", () => navigateMonth(1));

  container.querySelectorAll("td[data-day]").forEach((td) => {
    td.addEventListener("click", () => {
      const day = parseInt(td.dataset.day);
      selectedDay = day;
      render();
      onDayClick(viewYear, viewMonth, day);
    });
  });
}
