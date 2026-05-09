/**
 * Thin fetch wrapper for all backend API calls.
 */

async function request(method, path, body = null) {
  const opts = {
    method,
    headers: {},
  };
  if (body !== null) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const resp = await fetch(path, opts);
  if (!resp.ok) {
    let message = `Request failed: ${resp.status}`;
    try {
      const errData = await resp.json();
      if (errData && errData.error) message = errData.error;
    } catch (_) { /* fall back to generic message */ }
    throw new Error(message);
  }
  const data = await resp.json();
  return data;
}

function datePath(year, month, day) {
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `/api/day/${year}/${m}/${d}`;
}

export async function listDaysInMonth(year, month) {
  const m = String(month).padStart(2, "0");
  const data = await request("GET", `/api/days/${year}/${m}`);
  return data.days;
}

export async function getDay(year, month, day) {
  const data = await request("GET", datePath(year, month, day));
  return data.notes;
}

export async function initDay(year, month, day) {
  const data = await request("POST", `${datePath(year, month, day)}/init`);
  return data.notes;
}

export async function deleteDay(year, month, day) {
  return request("DELETE", datePath(year, month, day));
}

export async function createNote(year, month, day, title) {
  return request("POST", `${datePath(year, month, day)}/notes`, { title });
}

export async function updateNote(year, month, day, currentTitle, updates) {
  const encodedTitle = encodeURIComponent(currentTitle);
  return request(
    "PUT",
    `${datePath(year, month, day)}/notes/${encodedTitle}`,
    updates
  );
}

export async function deleteNote(year, month, day, title) {
  const encodedTitle = encodeURIComponent(title);
  return request(
    "DELETE",
    `${datePath(year, month, day)}/notes/${encodedTitle}`
  );
}

export async function getWeeklyReport() {
  const data = await request("GET", "/api/weekly-report");
  return data.report;
}
