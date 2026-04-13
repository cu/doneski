/**
 * Date formatting and helper utilities.
 */

const DAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday",
  "Thursday", "Friday", "Saturday"
];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

/**
 * Format a date as "DayOfWeek, Month Day Year".
 * e.g. "Friday, April 10 2026"
 */
export function formatDate(year, month, day) {
  const d = new Date(year, month - 1, day);
  const dow = DAY_NAMES[d.getDay()];
  const mon = MONTH_NAMES[month - 1];
  return `${dow}, ${mon} ${day} ${year}`;
}

/**
 * Get a relative label for a date.
 * Returns { text, isPast } where isPast is true for anything other than "Today".
 */
export function relativeLabel(year, month, day) {
  const target = new Date(year, month - 1, day);
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs = today - target;
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return { text: "Today", isPast: false };
  if (diffDays === 1) return { text: "Yesterday", isPast: true };
  if (diffDays > 1) return { text: `${diffDays} Days Ago`, isPast: true };
  // Future dates
  return { text: "", isPast: false };
}

/**
 * Get today's date components.
 */
export function today() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

/**
 * Check if a date is in the future.
 */
export function isFuture(year, month, day) {
  const t = today();
  const target = new Date(year, month - 1, day);
  const now = new Date(t.year, t.month - 1, t.day);
  return target > now;
}

/**
 * Check if a date is today.
 */
export function isToday(year, month, day) {
  const t = today();
  return year === t.year && month === t.month && day === t.day;
}

/**
 * Get the number of days in a month.
 */
export function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

/**
 * Get the day of week (0=Sun, 6=Sat) for the first of a month.
 */
export function firstDayOfWeek(year, month) {
  return new Date(year, month - 1, 1).getDay();
}

/**
 * Short month name for calendar header.
 */
export function monthName(month) {
  return MONTH_NAMES[month - 1];
}
