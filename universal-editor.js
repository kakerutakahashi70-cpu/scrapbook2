(() => {
  "use strict";

  // Shared appearance editor for the non-home pages.
  // It intentionally uses a NEW storage key and never reads or writes
  // blog posts, OC entries, transactions, countdowns, or moodboard pins.
  const pageId = decodeURIComponent(location.pathname.split("/").pop() || "page.html");
  const SETTINGS_KEY = `scrapbook-page-editor-v1:${pageId}`;
  const IMAGE_DB_NAME = "my-little-internet-images";
  const IMAGE_STORE = "images";

  const DEFAULTS = {
    colors: {
      background: "#eee8dc",
      card: "#fffdf7",
      ink: "#493f36",
      accent: "#b77b86",
      border: "#ded3c2"
    },
    text: {}
  };

  const validColor = value => /^#[0-9a-f]{6}$/i.test(value || "");
  const clone = value => JSON.parse(JSON.stringify(value));
  let settings = clone(DEFAULTS);
  let imageDb = null;
  let backgroundUrl = null;
  let editingText = false;
  let editableElements = [];

  function readSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
      if (saved && typeof saved === "object") {
        if (saved.colors && typeof saved.colors === "object") {
          Object.keys(DEFAULTS.colors).forEach(key => {
            if (validColor(saved.colors[key])) settings.colors[key] = saved.colors[key];
          });
        }
        if (saved.text && typeof saved.text === "object") {
          settings.text = { ...saved.text };
        }
      }
    } catch {
      // Keep defaults if storage is unavailable or invalid.
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // The editor remains usable if storage is unavailable.
    }
  }

  function findEditableText() {
    const selector = [
      "header h1",
      "header p:not([id])",
      "main h2:not([id])",
      "main h3:not([id])",
      "main p:not([id])",
      ".mood-header h1",
      ".mood-header p:not([id])",
      ".wiki-kicker",
      ".countdown-kicker"
    ].join(",");

    const candidates = [...document.querySelectorAll(selector)];
    let index = 0;

    editableElements = candidates.filter(element => {
      if (element.closest(
        "form, nav, aside, .blog-post, .blog-posts, .wiki-entry-list, " +
        ".countdown-grid, .mood-grid, .mood-toolbar, .mood-categories, " +
        ".date-time-note, #countdown-reminders, [data-page-editor-ui]"
      )) return false;
      if (element.dataset.pageEditorTarget === "no") return false;
      if (!element.textContent.trim()) return false;
      if (element.children.length) return false;
      if (element.querySelector("input, button, select, textarea, img")) return false;
      return true;
    });

    editableElements.forEach(element => {
      if (!element.dataset.pageEditKey) {
        element.dataset.pageEditKey = `text-${index}`;
      }
      if (!element.dataset.pageEditDefault) {
        element.dataset.pageEditDefault = element.textContent.trim();
      }
      index += 1;
    });
  }

  function applyText() {
    editableElements.forEach(element => {
      const key = element.dataset.pageEditKey;
      if (typeof settings.text[key] === "string") {
        element.textContent = settings.text[key];
      } else {
        settings.text[key] = element.textContent.trim();
      }
    });
  }

  function applyColors() {
    const root = document.documentElement;
    Object.entries(settings.colors).forEach(([key, value]) => {
      root.style.setProperty(`--page-${key}`, value);
    });
    document.querySelectorAll("[data-page-color]").forEach(input => {
      input.value = settings.colors[input.dataset.pageColor];
    });
  }

  function setTextEditing(enabled) {
    editingText = enabled;
    editableElements.forEach(element => {
      element.contentEditable = enabled ? "true" : "false";
      element.spellcheck = enabled;
      element.classList.toggle("page-editor-text-active", enabled);
    });
    const button = document.getElementById("page-editor-text-toggle");
    if (button) button.textContent = enabled ? "Finish editing text" : "Edit text on the page";
  }

  function openImageDatabase() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error("IndexedDB unavailable"));
        return;
      }
      const request = indexedDB.open(IMAGE_DB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(IMAGE_STORE)) {
          request.result.createObjectStore(IMAGE_STORE);
        }
      };
      request.onsuccess = () => {
        imageDb = request.result;
        resolve(imageDb);
      };
      request.onerror = () => reject(request.error);
    });
  }

  function getImage(key) {
    return new Promise((resolve, reject) => {
      if (!imageDb) return reject(new Error("Image database unavailable"));
      const request = imageDb.transaction(IMAGE_STORE, "readonly")
        .objectStore(IMAGE_STORE).get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function putImage(key, blob) {
    return new Promise((resolve, reject) => {
      if (!imageDb) return reject(new Error("Image database unavailable"));
      const transaction = imageDb.transaction(IMAGE_STORE, "readwrite");
      transaction.objectStore(IMAGE_STORE).put(blob, key);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }

  function deleteImage(key) {
    return new Promise((resolve, reject) => {
      if (!imageDb) return reject(new Error("Image database unavailable"));
      const transaction = imageDb.transaction(IMAGE_STORE, "readwrite");
      transaction.objectStore(IMAGE_STORE).delete(key);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }

  function clearBackgroundStyle() {
    if (backgroundUrl) {
      URL.revokeObjectURL(backgroundUrl);
      backgroundUrl = null;
    }
    document.body.style.removeProperty("background-image");
    document.body.style.removeProperty("background-size");
    document.body.style.removeProperty("background-position");
    document.body.style.removeProperty("background-attachment");
  }

  async function showBackground() {
    clearBackgroundStyle();
    if (!imageDb) return;
    try {
      const blob = await getImage(`page-background:${pageId}`);
      if (!blob) return;
      backgroundUrl = URL.createObjectURL(blob);
      document.body.style.backgroundImage =
        `linear-gradient(${settings.colors.background}55, ${settings.colors.background}55), url("${backgroundUrl}")`;
      document.body.style.backgroundSize = "cover";
      document.body.style.backgroundPosition = "center";
      document.body.style.backgroundAttachment = "fixed";
    } catch {
      // Background images are optional.
    }
  }

  function createPanel() {
    const launcher = document.createElement("button");
    launcher.type = "button";
    launcher.id = "page-editor-launcher";
    launcher.dataset.pageEditorUi = "true";
    launcher.textContent = "✎ Customize page";
    launcher.setAttribute("aria-controls", "page-editor-panel");
    launcher.setAttribute("aria-expanded", "false");

    const panel = document.createElement("aside");
    panel.id = "page-editor-panel";
    panel.className = "page-editor-panel";
    panel.dataset.pageEditorUi = "true";
    panel.hidden = true;
    panel.innerHTML = `
      <div class="page-editor-panel-heading">
        <div>
          <p class="page-editor-eyebrow">MY LITTLE INTERNET</p>
          <h2>Page editor ♡</h2>
          <p class="page-editor-description">Personalize this page without changing your saved posts, pins, entries, transactions, or countdowns.</p>
        </div>
        <button type="button" id="page-editor-close" aria-label="Close page editor">×</button>
      </div>

      <button type="button" id="page-editor-text-toggle" class="page-editor-wide-button">Edit text on the page</button>
      <p class="page-editor-hint">When text editing is on, click a highlighted heading or paragraph and type directly. Your changes save automatically.</p>

      <h3>♡ Colors</h3>
      <div class="page-editor-color-grid">
        <label>Page background <input type="color" data-page-color="background"></label>
        <label>Cards & sections <input type="color" data-page-color="card"></label>
        <label>Text <input type="color" data-page-color="ink"></label>
        <label>Accent <input type="color" data-page-color="accent"></label>
        <label>Borders <input type="color" data-page-color="border"></label>
      </div>

      <h3>♡ Background picture</h3>
      <label class="page-editor-file-label" for="page-editor-background-file">Choose an image from your computer</label>
      <input id="page-editor-background-file" type="file" accept="image/*">
      <button type="button" id="page-editor-remove-background" class="page-editor-wide-button">Remove background picture</button>
      <p class="page-editor-hint">Images are saved in this browser's local storage. Choose a reasonably small image for best results.</p>

      <div class="page-editor-actions">
        <button type="button" id="page-editor-reset">Reset this page's customizations</button>
        <button type="button" id="page-editor-done" class="page-editor-primary">Done ♡</button>
      </div>
    `;

    document.body.append(launcher, panel);

    function closePanel() {
      panel.hidden = true;
      launcher.setAttribute("aria-expanded", "false");
      setTextEditing(false);
    }

    launcher.addEventListener("click", () => {
      panel.hidden = !panel.hidden;
      launcher.setAttribute("aria-expanded", String(!panel.hidden));
    });
    panel.querySelector("#page-editor-close").addEventListener("click", closePanel);
    panel.querySelector("#page-editor-done").addEventListener("click", closePanel);
    panel.querySelector("#page-editor-text-toggle").addEventListener("click", () => {
      setTextEditing(!editingText);
    });

    panel.querySelectorAll("[data-page-color]").forEach(input => {
      input.addEventListener("input", () => {
        settings.colors[input.dataset.pageColor] = input.value;
        applyColors();
        saveSettings();
        if (imageDb) showBackground();
      });
    });

    panel.querySelector("#page-editor-background-file").addEventListener("change", async event => {
      const file = event.target.files && event.target.files[0];
      event.target.value = "";
      if (!file || !file.type.startsWith("image/") || file.size > 8 * 1024 * 1024) return;
      try {
        if (!imageDb) await openImageDatabase();
        await putImage(`page-background:${pageId}`, file);
        await showBackground();
      } catch {
        // No disruptive status message; the rest of the editor still works.
      }
    });

    panel.querySelector("#page-editor-remove-background").addEventListener("click", async () => {
      try {
        if (!imageDb) await openImageDatabase();
        await deleteImage(`page-background:${pageId}`);
      } catch {
        // The style is still cleared even if storage is unavailable.
      }
      clearBackgroundStyle();
    });

    panel.querySelector("#page-editor-reset").addEventListener("click", async () => {
      const confirmed = window.confirm(
        "Reset this page's custom text, colors, and background picture? Saved page content will not be deleted."
      );
      if (!confirmed) return;

      settings = clone(DEFAULTS);
      editableElements.forEach(element => {
        settings.text[element.dataset.pageEditKey] = element.dataset.pageEditDefault || element.textContent.trim();
      });
      applyText();
      applyColors();
      saveSettings();
      setTextEditing(false);
      try {
        if (!imageDb) await openImageDatabase();
        await deleteImage(`page-background:${pageId}`);
      } catch {}
      clearBackgroundStyle();
    });
  }

  function attachTextEvents() {
    editableElements.forEach(element => {
      element.addEventListener("input", () => {
        settings.text[element.dataset.pageEditKey] = element.textContent;
        saveSettings();
      });
      element.addEventListener("blur", () => {
        settings.text[element.dataset.pageEditKey] = element.textContent.trim();
        saveSettings();
      });
    });
  }

  function start() {
    if (document.body.classList.contains("home-page")) return;
    readSettings();
    findEditableText();
    applyText();
    attachTextEvents();
    createPanel();
    applyColors();

    openImageDatabase().then(showBackground).catch(() => {});
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
