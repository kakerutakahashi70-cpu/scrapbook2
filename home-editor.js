
(() => {
  "use strict";

  const STORAGE_KEY = "scrapbook-home-editor-v1";

  const body = document.body;
  const panel = document.getElementById("home-editor-panel");

  if (!body.classList.contains("home-page") || !panel) return;

  body.classList.add("home-editor-enabled");

  const settingFields = [
    ...panel.querySelectorAll("[data-setting]")
  ];

  const colorFields = [
    ...panel.querySelectorAll("[data-color]")
  ];

  const editableElements = [
    ...document.querySelectorAll("[data-editable]")
  ].filter((element) => !panel.contains(element));

  const defaultText = {};
  const defaultColors = {
    paper: "#fffdf7",
    card: "#fffdf7",
    ink: "#493f36",
    accent: "#b77b86",
    border: "#ded3c2"
  };

  editableElements.forEach((element) => {
    const key = element.dataset.editable;
    defaultText[key] = element.textContent;
  });

  let savedSettings = {};

  try {
    savedSettings = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "{}"
    );
  } catch {
    savedSettings = {};
  }

  const settings = {
    text: {
      ...defaultText,
      ...(savedSettings.text || {})
    },
    colors: {
      ...defaultColors,
      ...(savedSettings.colors || {})
    }
  };

  let directEditing = false;

  function applyText() {
    editableElements.forEach((element) => {
      const key = element.dataset.editable;

      if (Object.prototype.hasOwnProperty.call(settings.text, key)) {
        element.textContent = settings.text[key];
      }
    });

    settingFields.forEach((field) => {
      const key = field.dataset.setting;

      if (Object.prototype.hasOwnProperty.call(settings.text, key)) {
        field.value = settings.text[key];
      }
    });
  }

  function applyColors() {
    const root = document.documentElement;

    root.style.setProperty("--home-editor-paper", settings.colors.paper);
    root.style.setProperty("--home-editor-card", settings.colors.card);
    root.style.setProperty("--home-editor-ink", settings.colors.ink);
    root.style.setProperty("--home-editor-accent", settings.colors.accent);
    root.style.setProperty("--home-editor-border", settings.colors.border);

    colorFields.forEach((field) => {
      const key = field.dataset.color;

      if (settings.colors[key]) {
        field.value = settings.colors[key];
      }
    });
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Keep the editor usable if browser storage is unavailable.
    }
  }

  function updateText(key, value) {
    settings.text[key] = value;

    editableElements.forEach((element) => {
      if (
        element.dataset.editable === key &&
        element !== document.activeElement
      ) {
        element.textContent = value;
      }
    });

    settingFields.forEach((field) => {
      if (
        field.dataset.setting === key &&
        field !== document.activeElement
      ) {
        field.value = value;
      }
    });
  }

  function setDirectEditing(enabled) {
    directEditing = enabled;

    editableElements.forEach((element) => {
      element.contentEditable = enabled ? "true" : "false";
      element.classList.toggle("home-editing-text", enabled);
      element.spellcheck = enabled;
    });

    const button = document.getElementById("home-direct-edit");

    if (button) {
      button.textContent = enabled
        ? "✓ Finish editing text"
        : "✎ Edit text directly";
      button.setAttribute("aria-pressed", String(enabled));
    }
  }

  // Create one launcher; reuse the existing panel in index.html.
  let launcher = document.getElementById("home-editor-launcher");

  if (!launcher) {
    launcher = document.createElement("button");
    launcher.id = "home-editor-launcher";
    launcher.type = "button";
    launcher.textContent = "✎ Edit homepage";
    launcher.setAttribute("aria-controls", "home-editor-panel");
    launcher.setAttribute("aria-expanded", "false");
    body.appendChild(launcher);
  }

  function openPanel() {
    panel.hidden = false;
    launcher.setAttribute("aria-expanded", "true");
  }

  function closePanel() {
    saveSettings();
    setDirectEditing(false);
    panel.hidden = true;
    launcher.setAttribute("aria-expanded", "false");
  }

  launcher.addEventListener("click", () => {
    if (panel.hidden) {
      openPanel();
    } else {
      closePanel();
    }
  });

  document
    .getElementById("home-editor-close")
    ?.addEventListener("click", closePanel);

  document
    .getElementById("home-direct-edit")
    ?.addEventListener("click", () => {
      setDirectEditing(!directEditing);
    });

  settingFields.forEach((field) => {
    field.addEventListener("input", () => {
      updateText(field.dataset.setting, field.value);
      saveSettings();
    });
  });

  colorFields.forEach((field) => {
    field.addEventListener("input", () => {
      const key = field.dataset.color;
      settings.colors[key] = field.value;
      applyColors();
      saveSettings();
    });
  });

  // Allow direct editing without navigating away through a card link.
  document.addEventListener("click", (event) => {
    if (!directEditing) return;

    const element = event.target.closest("[data-editable]");

    if (!element || panel.contains(element)) return;

    event.preventDefault();
    event.stopPropagation();
    element.focus();
  }, true);

  editableElements.forEach((element) => {
    element.addEventListener("input", () => {
      updateText(element.dataset.editable, element.textContent);
      saveSettings();
    });

    element.addEventListener("blur", () => {
      updateText(element.dataset.editable, element.textContent.trim());
      saveSettings();
    });
  });

  document.getElementById("home-save")?.addEventListener("click", () => {
    editableElements.forEach((element) => {
      settings.text[element.dataset.editable] = element.textContent.trim();
    });

    settingFields.forEach((field) => {
      settings.text[field.dataset.setting] = field.value;
    });

    saveSettings();
    setDirectEditing(false);
    closePanel();
  });

  // Export this editor's settings as a backup file.
  document.getElementById("home-export")?.addEventListener("click", () => {
    const file = new Blob(
      [JSON.stringify(settings, null, 2)],
      { type: "application/json" }
    );

    const url = URL.createObjectURL(file);
    const link = document.createElement("a");

    link.href = url;
    link.download = "my-little-internet-backup.json";
    link.click();

    URL.revokeObjectURL(url);
  });

  const importButton = document.getElementById("home-import");
  const importFile = document.getElementById("home-import-file");

  importButton?.addEventListener("click", () => {
    importFile?.click();
  });

  importFile?.addEventListener("change", async () => {
    const file = importFile.files?.[0];
    if (!file) return;

    try {
      const imported = JSON.parse(await file.text());

      if (
        !imported ||
        typeof imported !== "object" ||
        !imported.text ||
        !imported.colors
      ) {
        throw new Error("Invalid backup");
      }

      Object.keys(defaultText).forEach((key) => {
        if (typeof imported.text[key] === "string") {
          settings.text[key] = imported.text[key];
        }
      });

      Object.keys(defaultColors).forEach((key) => {
        if (
          typeof imported.colors[key] === "string" &&
          /^#[0-9a-f]{6}$/i.test(imported.colors[key])
        ) {
          settings.colors[key] = imported.colors[key];
        }
      });

      applyText();
      applyColors();
      saveSettings();
    } catch {
      // No popup or status message.
    }

    importFile.value = "";
  });

  // Reset only homepage-editor settings, not data from other pages.
  document.getElementById("home-reset-preview")?.addEventListener("click", () => {
    const confirmed = window.confirm(
      "Reset your homepage text and colors to their original defaults?"
    );

    if (!confirmed) return;

    settings.text = { ...defaultText };
    settings.colors = { ...defaultColors };

    applyText();
    applyColors();
    saveSettings();
    setDirectEditing(false);
  });

  // PERSONAL IMAGE CONTROLS
  const imageTools = document.createElement("section");
  imageTools.className = "home-image-tools";
  imageTools.innerHTML = `
    <h3>♡ Personal Images</h3>
    <p>Choose pictures from your computer.</p>

    <label for="home-banner-file">Homepage banner</label>
    <input id="home-banner-file" type="file" accept="image/*">

    <button type="button" id="home-remove-banner">Remove banner</button>

    <label for="home-background-file">Page background</label>
    <input id="home-background-file" type="file" accept="image/*">

    <button type="button" id="home-remove-background">Remove background</button>
  `;

  panel.appendChild(imageTools);

  const IMAGE_DB_NAME = "my-little-internet-images";
  let imageDb;
  const imageUrls = {};

  function openImageDatabase() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error("Image storage is unavailable."));
        return;
      }

      const request = indexedDB.open(IMAGE_DB_NAME, 1);

      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains("images")) {
          db.createObjectStore("images");
        }
      };

      request.onsuccess = () => {
        imageDb = request.result;
        resolve(imageDb);
      };

      request.onerror = () => reject(request.error);
    });
  }

  function storeImage(key, blob) {
    return new Promise((resolve, reject) => {
      const transaction = imageDb.transaction("images", "readwrite");

      transaction.objectStore("images").put(blob, key);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
  }

  function getImage(key) {
    return new Promise((resolve, reject) => {
      const transaction = imageDb.transaction("images", "readonly");
      const request = transaction.objectStore("images").get(key);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function deleteImage(key) {
    return new Promise((resolve, reject) => {
      const transaction = imageDb.transaction("images", "readwrite");

      transaction.objectStore("images").delete(key);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
  }

  function clearImageStyle(key) {
    if (imageUrls[key]) {
      URL.revokeObjectURL(imageUrls[key]);
      delete imageUrls[key];
    }

    if (key === "banner") {
      const header = document.querySelector(".home-header");

      if (header) {
        header.style.removeProperty("background-image");
        header.style.removeProperty("background-size");
        header.style.removeProperty("background-position");
      }
    }

    if (key === "background") {
      body.style.removeProperty("background-image");
      body.style.removeProperty("background-size");
      body.style.removeProperty("background-attachment");
    }
  }

  async function showSavedImage(key) {
    const blob = await getImage(key);
    clearImageStyle(key);

    if (!blob) return;

    const url = URL.createObjectURL(blob);
    imageUrls[key] = url;

    if (key === "banner") {
      const header = document.querySelector(".home-header");

      if (header) {
        header.style.backgroundImage =
          `linear-gradient(rgba(255,253,247,.62), rgba(255,253,247,.62)), url("${url}")`;
        header.style.backgroundSize = "cover";
        header.style.backgroundPosition = "center";
      }
    }

    if (key === "background") {
      body.style.backgroundImage =
        `linear-gradient(rgba(238,232,220,.28), rgba(238,232,220,.28)), url("${url}")`;
      body.style.backgroundSize = "cover";
      body.style.backgroundAttachment = "fixed";
    }
  }

  async function chooseImage(key, file) {
    if (!file || !file.type.startsWith("image/")) return;

    try {
      await storeImage(key, file);
      await showSavedImage(key);
    } catch {
      // No popup or status message.
    }
  }

  document
    .getElementById("home-banner-file")
    .addEventListener("change", (event) => {
      chooseImage("banner", event.target.files[0]);
      event.target.value = "";
    });

  document
    .getElementById("home-background-file")
    .addEventListener("change", (event) => {
      chooseImage("background", event.target.files[0]);
      event.target.value = "";
    });

  document
    .getElementById("home-remove-banner")
    .addEventListener("click", async () => {
      try {
        await deleteImage("banner");
        clearImageStyle("banner");
      } catch {}
    });

  document
    .getElementById("home-remove-background")
    .addEventListener("click", async () => {
      try {
        await deleteImage("background");
        clearImageStyle("background");
      } catch {}
    });

  openImageDatabase()
    .then(async () => {
      await showSavedImage("banner");
      await showSavedImage("background");
    })
    .catch(() => {});

  applyText();
  applyColors();
  setDirectEditing(false);
})();
