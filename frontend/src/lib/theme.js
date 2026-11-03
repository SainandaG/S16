// Light / dark theme. The choice is stored per browser; without one, the system setting is used.
const KEY = "s16-theme";

export function currentTheme() {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

export function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

export function setTheme(theme) {
  applyTheme(theme);
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* storage blocked: the choice lasts for this visit only */
  }
}

export function toggleTheme() {
  const next = currentTheme() === "dark" ? "light" : "dark";
  setTheme(next);
  return next;
}

// Runs before the first paint (also called inline from index.html to avoid a flash).
export function initTheme() {
  let stored = null;
  try {
    stored = localStorage.getItem(KEY);
  } catch {
    /* ignore */
  }
  const system = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  applyTheme(stored === "dark" || stored === "light" ? stored : system);
}
