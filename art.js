
(() => {
  "use strict";

  const DB_NAME = "my-little-internet-pinterest";
  const STORE_NAME = "pins";

  const COLORS = [
    "#f5dce4", "#f7edbd", "#dcebd8",
    "#e5ddf5", "#dce9f4", "#fff8e9"
  ];

  const $ = id => document.getElementById(id);

  let db;
  let pins = [];
  let editingId = null;
  let selectedImage = null;
  let activeCategory = "All";
  let searchTerm = "";

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);

      request.onupgradeneeded = () => {
        const database = request.result;

        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function databaseAction(mode, action) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, mode);
      const request = action(transaction.objectStore(STORE_NAME));

      let result;

      request.onsuccess = () => {
        result = request.result;
      };

      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }

  const readPins = () =>
    databaseAction("readonly", store => store.getAll());

  const writePin = pin =>
    databaseAction("readwrite", store => store.put(pin));

  const erasePin = id =>
    databaseAction("readwrite", store => store.delete(id));

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);
  }

  function newId() {
    return window.crypto?.randomUUID?.() ||
      `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function renderCategories() {
    document.querySelectorAll("#mood-categories [data-category]")
      .forEach(button => {
        button.classList.toggle(
          "active",
          button.dataset.category === activeCategory
        );
      });
  }

  function renderPins() {
    const grid = $("mood-grid");
    const sort = $("mood-sort").value;

    let visiblePins = pins.filter(pin => {
      const matchesCategory =
        activeCategory === "All" || pin.category === activeCategory;

      const text = [
        pin.title,
        pin.description,
        pin.category
      ].join(" ").toLowerCase();

      return matchesCategory && text.includes(searchTerm.toLowerCase());
    });

    if (sort === "newest") {
      visiblePins.sort((a, b) => b.created - a.created);
    } else if (sort === "oldest") {
      visiblePins.sort((a, b) => a.created - b.created);
    } else if (sort === "title") {
      visiblePins.sort((a, b) =>
        (a.title || "").localeCompare(b.title || "")
      );
    }

    if (visiblePins.length === 0) {
      grid.innerHTML = `
        <div class="mood-empty">
          <div style="font-size:2rem">♡</div>
          <strong>${pins.length ? "No pins found." : "Your little board is waiting!"}</strong>
          <div>Add a picture, write a note, or save something lovely.</div>
        </div>
      `;
      return;
    }

    grid.innerHTML = visiblePins.map(pin => {
      const color = COLORS.includes(pin.color) ? pin.color : COLORS[5];
      const date = new Date(pin.created).toLocaleDateString();

      return `
        <article class="mood-pin" style="background:${color}">
          ${pin.image
            ? `<img src="${pin.image}" alt="${escapeHTML(pin.title || "Saved picture")}" loading="lazy">`
            : ""}
          <div class="mood-pin-category">${escapeHTML(pin.category)}</div>
          ${pin.title ? `<h2>${escapeHTML(pin.title)}</h2>` : ""}
          ${pin.description ? `<p>${escapeHTML(pin.description)}</p>` : ""}
          <div class="mood-pin-date">${escapeHTML(date)}</div>
          <div class="mood-pin-actions">
            <button type="button" data-edit="${escapeHTML(pin.id)}">Edit</button>
            <button type="button" data-delete="${escapeHTML(pin.id)}">Delete</button>
          </div>
        </article>
      `;
    }).join("");
  }

  function render() {
    renderCategories();
    renderPins();
  }

  function showImagePreview() {
    const preview = $("mood-preview");
    preview.hidden = !selectedImage;
    preview.src = selectedImage || "";
  }

  function openEditor(pin = null) {
    editingId = pin ? pin.id : null;
    selectedImage = pin?.image || null;

    $("mood-form").reset();

    $("mood-dialog-title").textContent =
      pin ? "Edit your pin ♡" : "Make a little pin ♡";

    $("mood-title").value = pin?.title || "";
    $("mood-description").value = pin?.description || "";
    $("mood-category").value = pin?.category || "Fashion";

    const color = COLORS.includes(pin?.color) ? pin.color : COLORS[0];

    const colorInput = document.querySelector(
      `input[name="mood-color"][value="${color}"]`
    );

    if (colorInput) colorInput.checked = true;

    showImagePreview();
    $("mood-dialog").showModal();
  }

  async function readImage(file) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please choose an image file.");
      $("mood-image").value = "";
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      alert("Please choose an image smaller than 8 MB.");
      $("mood-image").value = "";
      return;
    }

    try {
      selectedImage = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });

      showImagePreview();
    } catch {
      alert("Couldn't load that image. Please try another.");
    }
  }

  async function saveFromForm(event) {
    event.preventDefault();

    const previous = pins.find(pin => pin.id === editingId);

    const pin = {
      id: editingId || newId(),
      title: $("mood-title").value.trim(),
      description: $("mood-description").value.trim(),
      category: $("mood-category").value,
      color: document.querySelector(
        'input[name="mood-color"]:checked'
      )?.value || COLORS[0],
      image: selectedImage,
      created: previous?.created || Date.now(),
      updated: Date.now()
    };

    if (!pin.title && !pin.description && !pin.image) {
      alert("Add a title, a note, or a picture first ♡");
      return;
    }

    try {
      await writePin(pin);
      pins = await readPins();
      $("mood-dialog").close();
      render();
    } catch (error) {
      console.error("Pin saving failed:", error);
      alert("Couldn't save this pin. Your browser may be low on storage.");
    }
  }

  async function deletePin(id) {
    const pin = pins.find(item => item.id === id);
    if (!pin) return;

    if (!confirm(`Delete "${pin.title || "this pin"}"?`)) return;

    try {
      await erasePin(id);
      pins = await readPins();
      render();
    } catch (error) {
      console.error("Pin deletion failed:", error);
      alert("Couldn't delete this pin. Please try again.");
    }
  }

  function attachEvents() {
    $("mood-add").addEventListener("click", () => openEditor());

    $("mood-search").addEventListener("input", event => {
      searchTerm = event.target.value;
      renderPins();
    });

    $("mood-sort").addEventListener("change", renderPins);

    $("mood-categories").addEventListener("click", event => {
      const button = event.target.closest("[data-category]");
      if (!button) return;

      activeCategory = button.dataset.category;
      render();
    });

    $("mood-grid").addEventListener("click", event => {
      const editButton = event.target.closest("[data-edit]");
      const deleteButton = event.target.closest("[data-delete]");

      if (editButton) {
        const pin = pins.find(item => item.id === editButton.dataset.edit);
        if (pin) openEditor(pin);
      }

      if (deleteButton) {
        deletePin(deleteButton.dataset.delete);
      }
    });

    $("mood-form").addEventListener("submit", saveFromForm);

    $("mood-image").addEventListener("change", event => {
      readImage(event.target.files?.[0]);
    });

    $("mood-remove-image").addEventListener("click", () => {
      selectedImage = null;
      $("mood-image").value = "";
      showImagePreview();
    });

    $("mood-cancel").addEventListener("click", () => {
      $("mood-dialog").close();
    });
  }

  async function start() {
    attachEvents();

    try {
      db = await openDatabase();
      pins = await readPins();
      render();
    } catch (error) {
      console.error("Moodboard initialization failed:", error);

      $("mood-grid").innerHTML = `
        <div class="mood-empty">
          <strong>Your board couldn't open its saved data.</strong>
          <div>Try opening this page in the same browser you normally use for your scrapbook.</div>
        </div>
      `;

      $("mood-add").disabled = true;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
