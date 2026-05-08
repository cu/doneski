/**
 * Generic dialog modal. Provides showDialog() for displaying a titled dialog
 * with a content area, error display, and Close/action button pair.
 *
 * Call initDialog() once during app startup, then showDialog() as needed.
 */

let overlay, titleEl, contentEl, errorEl, cancelBtn, actionBtn, closeBtn;

function close() {
  overlay.style.display = "none";
  contentEl.innerHTML = "";
  errorEl.style.display = "none";
  errorEl.textContent = "";
  actionBtn.onclick = null;
  actionBtn.style.display = "";
}

/**
 * Show the generic dialog.
 *
 * @param {Object} options
 * @param {string} options.title - Dialog title text.
 * @param {HTMLElement} options.content - Element to insert into the dialog body.
 * @param {string} [options.actionLabel] - Label for the primary action button. If omitted,
 *   the action button is hidden and only the "Close" button is shown.
 * @param {Function} [options.onAction] - Async function called on action button click.
 *   Should resolve on success (dialog closes) or throw an Error on failure
 *   (error message is shown and dialog stays open).
 * @param {"primary"|"danger"} [options.actionVariant="primary"] - Visual style for the action button.
 */
export function showDialog({ title, content, actionLabel, onAction, actionVariant = "primary" }) {
  titleEl.textContent = title;
  actionBtn.disabled = false;
  cancelBtn.disabled = false;

  if (actionLabel) {
    actionBtn.textContent = actionLabel;
    actionBtn.className = `dlg-btn dlg-btn-${actionVariant}`;
    actionBtn.style.display = "";
  } else {
    actionBtn.style.display = "none";
  }
  errorEl.style.display = "none";
  errorEl.textContent = "";

  contentEl.innerHTML = "";
  contentEl.appendChild(content);

  overlay.style.display = "";

  // Focus the first interactive element after the overlay becomes visible.
  setTimeout(() => {
    const first = contentEl.querySelector("input, textarea, select");
    if (first) first.focus();
  }, 50);

  actionBtn.onclick = async () => {
    errorEl.style.display = "none";
    actionBtn.disabled = true;
    cancelBtn.disabled = true;
    try {
      await onAction();
      close();
    } catch (err) {
      errorEl.textContent = err.message || "An unexpected error occurred.";
      errorEl.style.display = "";
      actionBtn.disabled = false;
      cancelBtn.disabled = false;
      const first = contentEl.querySelector("input, textarea, select");
      if (first) first.focus();
    }
  };
}

/** Initialize dialog event listeners. Call once at app startup. */
export function initDialog() {
  overlay = document.getElementById("generic-dialog-overlay");
  titleEl = document.getElementById("generic-dialog-title");
  contentEl = document.getElementById("generic-dialog-content");
  errorEl = document.getElementById("generic-dialog-error");
  cancelBtn = document.getElementById("generic-dialog-cancel");
  actionBtn = document.getElementById("generic-dialog-action");
  closeBtn = document.getElementById("generic-dialog-close");

  closeBtn.addEventListener("click", close);
  cancelBtn.addEventListener("click", close);

  // Close on backdrop click.
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  // Escape closes; Enter in an input triggers the action button.
  document.addEventListener("keydown", (e) => {
    if (overlay.style.display === "none") return;
    if (e.key === "Escape") {
      close();
    } else if (e.key === "Enter" && !e.shiftKey) {
      const active = document.activeElement;
      if (active && (active.tagName === "INPUT" || active.tagName === "SELECT")) {
        e.preventDefault();
        if (!actionBtn.disabled) actionBtn.click();
      }
    }
  });
}
