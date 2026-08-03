// Theme system: 7 brand colour swatches + light/dark mode.
// Default is always light + classic (#ccffcc), regardless of OS preference.
// Once the user picks something, it is persisted.

const APP_KEY = "stageconnect";

const COLOR_THEMES = [
  { id: "classic", label: "Classic", hex: "#ccffcc" },
  { id: "not-green-1", label: "Not green 1", hex: "#ffcccc" },
  { id: "not-green-2", label: "Not green 2", hex: "#ccccff" },
  { id: "not-green-3", label: "Not green 3", hex: "#ffffcc" },
  { id: "not-green-4", label: "Not green 4", hex: "#ffccff" },
  { id: "not-green-5", label: "Not green 5", hex: "#ccffff" },
  { id: "really-light-green", label: "Really really light green", hex: "#ffffff" },
];

const STORAGE_KEY_COLOR = `${APP_KEY}.colorTheme`;
const STORAGE_KEY_MODE = `${APP_KEY}.mode`;

// Old key was "sc-theme" with ids classic|ng1..ng5|light. Mode did not exist,
// so migrated users fall back to the light default.
const LEGACY_KEY = "sc-theme";
const LEGACY_IDS = {
  classic: "classic",
  ng1: "not-green-1",
  ng2: "not-green-2",
  ng3: "not-green-3",
  ng4: "not-green-4",
  ng5: "not-green-5",
  light: "really-light-green",
};

function migrateLegacyTheme() {
  const old = localStorage.getItem(LEGACY_KEY);
  if (!old) return;
  if (!localStorage.getItem(STORAGE_KEY_COLOR) && LEGACY_IDS[old]) {
    localStorage.setItem(STORAGE_KEY_COLOR, LEGACY_IDS[old]);
  }
  localStorage.removeItem(LEGACY_KEY);
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

function getStoredColorTheme() {
  return localStorage.getItem(STORAGE_KEY_COLOR) || "classic";
}

function getStoredMode() {
  return localStorage.getItem(STORAGE_KEY_MODE) || "light";
}

function applyColorTheme(id) {
  const theme = COLOR_THEMES.find((t) => t.id === id) || COLOR_THEMES[0];
  document.documentElement.setAttribute("data-color-theme", theme.id);
  document.documentElement.style.setProperty("--brand", theme.hex);
  document.documentElement.style.setProperty("--brand-rgb", hexToRgb(theme.hex));
  localStorage.setItem(STORAGE_KEY_COLOR, theme.id);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme.hex);
  return theme;
}

function applyMode(mode) {
  const resolved = mode === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-mode", resolved);
  localStorage.setItem(STORAGE_KEY_MODE, resolved);
  return resolved;
}

function initTheme() {
  migrateLegacyTheme();
  applyColorTheme(getStoredColorTheme());
  applyMode(getStoredMode());
}

// ---- modal wiring ----
// This project has one script per page rather than a shared app.js, so the
// wiring lives here next to the state it drives.

function buildThemeModal() {
  const grid = document.getElementById("swatchGrid");
  if (!grid) return;
  grid.innerHTML = COLOR_THEMES.map(
    (t) => `
      <button class="swatch" data-theme-id="${t.id}" style="--swatch-color:${t.hex}" type="button" aria-label="${t.label}">
        <span class="swatch-dot"></span>
        <span class="swatch-label">${t.label}</span>
      </button>`
  ).join("");

  syncThemeModalState();

  grid.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-theme-id]");
    if (!btn) return;
    applyColorTheme(btn.dataset.themeId);
    syncThemeModalState();
  });

  document.getElementById("modeToggle").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-mode]");
    if (!btn) return;
    applyMode(btn.dataset.mode);
    syncThemeModalState();
  });
}

function syncThemeModalState() {
  const activeTheme = getStoredColorTheme();
  const activeMode = getStoredMode();
  document.querySelectorAll("#swatchGrid .swatch").forEach((el) => {
    el.classList.toggle("active", el.dataset.themeId === activeTheme);
  });
  document.querySelectorAll("#modeToggle .mode-btn").forEach((el) => {
    el.classList.toggle("active", el.dataset.mode === activeMode);
    el.setAttribute("aria-pressed", String(el.dataset.mode === activeMode));
  });
  updateThemeButtonIcon();
}

function updateThemeButtonIcon() {
  const btn = document.getElementById("themeBtn");
  if (!btn) return;
  const span = btn.querySelector("[data-icon]");
  if (!span) return;
  span.setAttribute("data-icon", getStoredMode() === "dark" ? "moon" : "sun");
  hydrateIcons(btn);
}

function wireModals() {
  document.querySelectorAll("[data-close-modal]").forEach((btn) => {
    btn.addEventListener("click", () => closeModal(btn.dataset.closeModal));
  });
  document.querySelectorAll(".modal-backdrop").forEach((backdrop) => {
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) closeModal(backdrop.id);
    });
  });
  const themeBtn = document.getElementById("themeBtn");
  if (themeBtn) themeBtn.addEventListener("click", () => openModal("themeModal"));
}

initTheme();

document.addEventListener("DOMContentLoaded", () => {
  hydrateIcons();
  updateThemeButtonIcon();
  buildThemeModal();
  wireModals();
});

window.COLOR_THEMES = COLOR_THEMES;
window.applyColorTheme = applyColorTheme;
window.applyMode = applyMode;
window.getStoredColorTheme = getStoredColorTheme;
window.getStoredMode = getStoredMode;
window.initTheme = initTheme;
