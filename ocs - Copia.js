
(function () {
  "use strict";

  const STORAGE_KEY = "scrapbook-oc-wiki";
  const $ = id => document.getElementById(id);

  const search = $("wiki-search");
  const library = $("wiki-library-section");
  const entryList = $("wiki-entry-list");
  const emptyMessage = $("wiki-empty");
  const editor = $("wiki-editor-section");
  const article = $("wiki-article");
  const form = $("wiki-form");
  const status = $("wiki-status");
  const imageInput = $("wiki-local-image");

  let entries = [];
  let editingId = null;
  let openEntryId = null;
  let portraitData = "";

  const fields = [
    "name", "aliases", "role", "age", "species",
    "portrait", "summary", "personality", "backstory",
    "abilities", "relationships", "notes"
  ];

  function setStatus(text) {
    status.textContent = text;
  }

  function saveEntries() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
      return true;
    } catch (error) {
      setStatus("Couldn't save. The browser's storage may be full. Try a smaller portrait.");
      return false;
    }
  }

  function loadEntries() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");

      if (
        Array.isArray(saved) &&
        saved.every(item =>
          item &&
          typeof item.id === "string" &&
          typeof item.name === "string"
        )
      ) {
        entries = saved;
      }
    } catch (error) {
      entries = [];
    }
  }

  function showLibrary() {
    library.hidden = false;
    $("wiki-intro").hidden = false;
    editor.hidden = true;
    article.hidden = true;
    $("wiki-back-button").hidden = false;
    search.closest("section").hidden = false;
    renderList();
  }

  function makeElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function renderList() {
    entryList.replaceChildren();

    const query = search.value.trim().toLowerCase();

    const matching = entries
      .filter(entry => fields.some(field =>
        String(entry[field] || "").toLowerCase().includes(query)
      ))
      .sort((a, b) => a.name.localeCompare(b.name));

    $("wiki-search-count").textContent =
      `${matching.length} ${matching.length === 1 ? "entry" : "entries"}`;

    emptyMessage.hidden = matching.length > 0;

    if (entries.length === 0) {
      emptyMessage.querySelector("h3").textContent = "Your archive is waiting!";
      emptyMessage.querySelectorAll("p")[1].textContent =
        "Create your first character entry to get started.";
    } else if (matching.length === 0) {
      emptyMessage.querySelector("h3").textContent = "No matches found";
      emptyMessage.querySelectorAll("p")[1].textContent =
        "Try another search term.";
    }

    matching.forEach(entry => {
      const card = makeElement("article", "wiki-entry-card");

      if (entry.portrait) {
        const image = makeElement("img", "wiki-entry-portrait");
        image.src = entry.portrait;
        image.alt = `Portrait of ${entry.name}`;
        image.loading = "lazy";
        image.addEventListener("error", () => image.hidden = true);
        card.appendChild(image);
      }

      const details = makeElement("div", "wiki-entry-details");
      const name = makeElement("h3", "", entry.name);
      const role = makeElement("p", "wiki-entry-role", entry.role || "Character entry");
      const summary = makeElement(
        "p", "", entry.summary || "No overview has been added yet."
      );

      const readButton = makeElement("button", "", "Read entry →");
      readButton.type = "button";
      readButton.addEventListener("click", () => openArticle(entry.id));

      details.append(name, role, summary, readButton);
      card.appendChild(details);
      entryList.appendChild(card);
    });
  }

  function updatePortraitPreview() {
    const wrapper = $("wiki-current-image-preview");
    const image = $("wiki-image-preview");

    if (portraitData) {
      image.src = portraitData;
      wrapper.hidden = false;
    } else {
      image.removeAttribute("src");
      wrapper.hidden = true;
    }
  }

  function showEditor(entry = null) {
    editingId = entry ? entry.id : null;
    portraitData = entry ? entry.portrait || "" : "";

    form.reset();

    fields.forEach(field => {
      const element = $("wiki-" + field);
      if (element && element.type !== "file") {
        element.value = entry ? entry[field] || "" : "";
      }
    });

    imageInput.value = "";
    updatePortraitPreview();

    $("wiki-editor-heading").textContent =
      entry ? "Edit character entry" : "Create a character entry";

    $("wiki-save-button").textContent =
      entry ? "Save changes ♡" : "Save entry ♡";

    library.hidden = true;
    $("wiki-intro").hidden = true;
    editor.hidden = false;
    article.hidden = true;

    setStatus("");
    editor.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function showArticleSection(id, value) {
    const section = $(id + "-section");
    $(id).textContent = value || "";
    section.hidden = !value;
  }

  function openArticle(id) {
    const entry = entries.find(item => item.id === id);
    if (!entry) return;

    openEntryId = id;

    library.hidden = true;
    $("wiki-intro").hidden = true;
    editor.hidden = true;
    article.hidden = false;

    $("article-name").textContent = entry.name;
    $("article-aliases").textContent =
      entry.aliases ? "Also known as: " + entry.aliases : "";

    $("article-role").textContent = entry.role || "Not specified";
    $("article-age").textContent = entry.age || "Not specified";
    $("article-species").textContent = entry.species || "Not specified";

    showArticleSection("article-summary", entry.summary);
    showArticleSection("article-personality", entry.personality);
    showArticleSection("article-backstory", entry.backstory);
    showArticleSection("article-abilities", entry.abilities);
    showArticleSection("article-relationships", entry.relationships);
    showArticleSection("article-notes", entry.notes);

    const portrait = $("article-portrait");

    if (entry.portrait) {
      portrait.src = entry.portrait;
      portrait.alt = "Portrait of " + entry.name;
      portrait.hidden = false;
      portrait.onerror = () => portrait.hidden = true;
    } else {
      portrait.hidden = true;
      portrait.removeAttribute("src");
    }

    renderRelated(entry);
    article.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderRelated(entry) {
    const container = $("article-related");
    container.replaceChildren();

    const related = entries.filter(item =>
      item.id !== entry.id && (entry.related || []).includes(item.id)
    );

    if (!related.length) {
      container.appendChild(
        makeElement("p", "wiki-muted", "No linked characters yet.")
      );
    }

    related.forEach(item => {
      const button = makeElement("button", "", item.name);
      button.type = "button";
      button.addEventListener("click", () => openArticle(item.id));
      container.appendChild(button);
    });

    const linkButton = makeElement("button", "", "+ Link a character");
    linkButton.type = "button";
    linkButton.addEventListener("click", () => editRelated(entry));
    container.appendChild(linkButton);
  }

  function editRelated(entry) {
    const candidates = entries.filter(item => item.id !== entry.id);

    if (!candidates.length) {
      alert("Create another character entry first!");
      return;
    }

    const options = candidates
      .map((item, index) => `${index + 1}. ${item.name}`)
      .join("\n");

    const answer = prompt(
      "Enter the number of the character to link:\n\n" + options
    );

    if (answer === null) return;

    const index = Number(answer) - 1;

    if (!Number.isInteger(index) || index < 0 || index >= candidates.length) {
      alert("Please enter a valid number.");
      return;
    }

    const target = candidates[index];
    const previous = JSON.stringify(entries);

    entry.related = entry.related || [];
    target.related = target.related || [];

    if (!entry.related.includes(target.id)) entry.related.push(target.id);
    if (!target.related.includes(entry.id)) target.related.push(entry.id);

    if (!saveEntries()) {
      entries = JSON.parse(previous);
      return;
    }

    openArticle(entry.id);
  }

  imageInput.addEventListener("change", () => {
    const file = imageInput.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setStatus("Please choose an image file.");
      imageInput.value = "";
      return;
    }

    if (file.size > 1.5 * 1024 * 1024) {
      setStatus("Please choose an image under 1.5 MB.");
      imageInput.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      portraitData = reader.result;
      $("wiki-portrait").value = "";
      updatePortraitPreview();
      setStatus("Portrait added! Save the entry to keep it.");
    };

    reader.onerror = () => setStatus("Couldn't read that image.");
    reader.readAsDataURL(file);
  });

  $("wiki-portrait").addEventListener("input", () => {
    if ($("wiki-portrait").value.trim()) {
      portraitData = "";
      updatePortraitPreview();
    }
  });

  $("wiki-remove-image").addEventListener("click", () => {
    portraitData = "";
    $("wiki-portrait").value = "";
    imageInput.value = "";
    updatePortraitPreview();
  });

  $("new-character").addEventListener("click", () => showEditor());

  $("wiki-cancel-edit").addEventListener("click", showLibrary);
  $("wiki-back-button").addEventListener("click", showLibrary);
  $("wiki-article-back").addEventListener("click", showLibrary);
  search.addEventListener("input", renderList);

  form.addEventListener("submit", event => {
    event.preventDefault();

    const name = $("wiki-name").value.trim();

    if (!name) {
      setStatus("Please enter a character name.");
      return;
    }

    const oldEntry = editingId
      ? entries.find(item => item.id === editingId)
      : null;

    const portraitUrl = $("wiki-portrait").value.trim();

    if (portraitUrl && !portraitData && !/^https?:\/\//i.test(portraitUrl)) {
      setStatus("Please use an image URL beginning with http:// or https://.");
      return;
    }

    const entry = {
      id: editingId || (
        Date.now().toString() + "-" +
        Math.random().toString(36).slice(2)
      ),
      name,
      aliases: $("wiki-aliases").value.trim(),
      role: $("wiki-role").value.trim(),
      age: $("wiki-age").value.trim(),
      species: $("wiki-species").value.trim(),
      portrait: portraitData || portraitUrl,
      summary: $("wiki-summary").value.trim(),
      personality: $("wiki-personality").value.trim(),
      backstory: $("wiki-backstory").value.trim(),
      abilities: $("wiki-abilities").value.trim(),
      relationships: $("wiki-relationships").value.trim(),
      notes: $("wiki-notes").value.trim(),
      related: oldEntry ? oldEntry.related || [] : [],
      created: oldEntry ? oldEntry.created : new Date().toISOString(),
      updated: new Date().toISOString()
    };

    const previous = entries;

    entries = editingId
      ? entries.map(item => item.id === editingId ? entry : item)
      : [...entries, entry];

    if (!saveEntries()) {
      entries = previous;
      return;
    }

    search.value = "";
    editingId = null;
    showLibrary();
    setStatus("");
  });

  $("wiki-edit-button").addEventListener("click", () => {
    const entry = entries.find(item => item.id === openEntryId);
    if (entry) showEditor(entry);
  });

  $("wiki-delete-button").addEventListener("click", () => {
    const entry = entries.find(item => item.id === openEntryId);
    if (!entry || !confirm(`Delete "${entry.name}"? This cannot be undone.`)) {
      return;
    }

    const previous = entries;

    entries = entries
      .filter(item => item.id !== entry.id)
      .map(item => ({
        ...item,
        related: (item.related || []).filter(id => id !== entry.id)
      }));

    if (!saveEntries()) {
      entries = previous;
      return;
    }

    openEntryId = null;
    showLibrary();
  });

  loadEntries();
  showLibrary();
})();
