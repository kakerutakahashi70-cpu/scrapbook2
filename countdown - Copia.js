
(function () {
  "use strict";

  const STORAGE_KEY = "scrapbook-countdowns";
  const $ = id => document.getElementById(id);

  const form = $("countdown-form");
  const titleInput = $("countdown-title");
  const dateInput = $("countdown-date");
  const categoryInput = $("countdown-category");
  const noteInput = $("countdown-note");
  const list = $("countdown-list");
  const empty = $("countdown-empty");
  const status = $("countdown-status");

  let countdowns = [];
  let editingId = null;

  function getLocalToday() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function dateToDays(dateString) {
    const parts = dateString.split("-").map(Number);

    return Math.floor(
      Date.UTC(parts[0], parts[1] - 1, parts[2]) / 86400000
    );
  }

  function daysUntil(dateString) {
    return dateToDays(dateString) - dateToDays(getLocalToday());
  }

  function formatDate(dateString) {
    const [year, month, day] = dateString.split("-").map(Number);
    const date = new Date(year, month - 1, day);

    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  }

  function makeId() {
    return Date.now().toString() + "-" +
      Math.random().toString(36).slice(2);
  }

  function saveCountdowns() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(countdowns));
      return true;
    } catch (error) {
      status.textContent =
        "Couldn't save. Browser storage may be full.";
      return false;
    }
  }

  function loadCountdowns() {
    try {
      const saved = JSON.parse(
        localStorage.getItem(STORAGE_KEY) || "[]"
      );

      if (Array.isArray(saved)) {
        countdowns = saved.filter(item =>
          item &&
          typeof item.id === "string" &&
          typeof item.title === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(item.date) &&
          Number.isFinite(dateToDays(item.date))
        );
      }
    } catch (error) {
      countdowns = [];
    }
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);

    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;

    return element;
  }

  function makeCountdownMessage(days) {
    if (days < 0) {
      const passed = Math.abs(days);

      return {
        number: String(passed),
        label: passed === 1 ? "day ago" : "days ago",
        state: "past"
      };
    }

    if (days === 0) {
      return {
        number: "♡",
        label: "It's today!",
        state: "today"
      };
    }

    return {
      number: String(days),
      label: days === 1 ? "day to go!" : "days to go!",
      state: "future"
    };
  }

  function createCard(item) {
    const days = daysUntil(item.date);
    const message = makeCountdownMessage(days);

    const card = createElement(
      "article",
      "countdown-card countdown-" + message.state
    );

    const decoration = createElement(
      "div",
      "countdown-card-decoration",
      "✿"
    );

    const category = createElement(
      "p",
      "countdown-category",
      item.category || "Personal"
    );

    const title = createElement("h3", "countdown-card-title", item.title);

    const number = createElement(
      "div",
      "countdown-number",
      message.number
    );

    const label = createElement(
      "p",
      "countdown-days-label",
      message.label
    );

    const date = createElement(
      "p",
      "countdown-event-date",
      formatDate(item.date)
    );

    card.append(decoration, category, title, number, label, date);

    if (item.note) {
      card.appendChild(
        createElement("p", "countdown-card-note", item.note)
      );
    }

    const actions = createElement("div", "countdown-card-actions");

    const editButton = createElement("button", "", "Edit");
    editButton.type = "button";
    editButton.addEventListener("click", () => startEditing(item));

    const deleteButton = createElement("button", "", "Delete");
    deleteButton.type = "button";
    deleteButton.addEventListener("click", () => deleteCountdown(item));

    actions.append(editButton, deleteButton);
    card.appendChild(actions);

    return card;
  }

  function render() {
    list.replaceChildren();

    const sortBy = $("countdown-sort").value;
    const sorted = [...countdowns];

    if (sortBy === "soonest") {
      sorted.sort((a, b) => {
        const aDays = daysUntil(a.date);
        const bDays = daysUntil(b.date);

        // Put future events before past events.
        const aPast = aDays < 0;
        const bPast = bDays < 0;

        if (aPast !== bPast) return aPast ? 1 : -1;
        return aDays - bDays;
      });
    } else if (sortBy === "latest") {
      sorted.sort((a, b) => dateToDays(b.date) - dateToDays(a.date));
    } else {
      sorted.sort((a, b) => a.title.localeCompare(b.title));
    }

    sorted.forEach(item => list.appendChild(createCard(item)));

    empty.hidden = countdowns.length > 0;

    $("countdown-count").textContent =
      countdowns.length === 1
        ? "1 special date saved ♡"
        : `${countdowns.length} special dates saved ♡`;

    const today = new Date();

    $("countdown-today").textContent =
      "Today is " + today.toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric"
      }) + "."; 
    renderReminders();

  }

  function resetForm() {
    form.reset();
    editingId = null;

    $("countdown-form-heading").textContent = "Add a countdown";
    $("countdown-save-button").textContent = "Add countdown ♡";
    $("countdown-cancel-button").hidden = true;
    status.textContent = "";
  }

  function startEditing(item) {
    editingId = item.id;

    titleInput.value = item.title;
    dateInput.value = item.date;
    categoryInput.value = item.category || "Personal";
    noteInput.value = item.note || "";

    $("countdown-form-heading").textContent = "Edit your countdown";
    $("countdown-save-button").textContent = "Save changes ♡";
    $("countdown-cancel-button").hidden = false;

    form.scrollIntoView({ behavior: "smooth", block: "start" });
    titleInput.focus();
  }

  function deleteCountdown(item) {
    if (!confirm(`Delete the countdown for "${item.title}"?`)) {
      return;
    }

    const previous = countdowns;
    countdowns = countdowns.filter(entry => entry.id !== item.id);

    if (!saveCountdowns()) {
      countdowns = previous;
      return;
    }

    if (editingId === item.id) resetForm();

    render();
    status.textContent = "Countdown deleted.";
  }

  form.addEventListener("submit", event => {
    event.preventDefault();

    const title = titleInput.value.trim();
    const date = dateInput.value;

    if (!title || !date) {
      status.textContent = "Please enter a title and date.";
      return;
    }

    const [year, month, day] = date.split("-").map(Number);
    const check = new Date(year, month - 1, day);

    if (
      check.getFullYear() !== year ||
      check.getMonth() !== month - 1 ||
      check.getDate() !== day
    ) {
      status.textContent = "Please choose a valid date.";
      return;
    }

    const previous = countdowns;
    const existing = editingId
      ? countdowns.find(item => item.id === editingId)
      : null;

    const entry = {
      id: editingId || makeId(),
      title,
      date,
      category: categoryInput.value,
      note: noteInput.value.trim(),
      created: existing ? existing.created : new Date().toISOString()
    };

    if (editingId) {
      countdowns = countdowns.map(item =>
        item.id === editingId ? entry : item
      );
    } else {
      countdowns.push(entry);
    }

    if (!saveCountdowns()) {
      countdowns = previous;
      return;
    }

    resetForm();
    render();
    status.textContent = "Your countdown has been saved! ♡";
  });

  $("countdown-cancel-button").addEventListener("click", resetForm);
  $("countdown-sort").addEventListener("change", render);

  loadCountdowns();
  render();
})();
