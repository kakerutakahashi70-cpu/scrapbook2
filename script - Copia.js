
/* =====================================
   BALANCE TRACKER
   Existing transaction storage preserved
===================================== */

const STORAGE_KEY = "scrapbook-transactions";

const balanceDisplay = document.getElementById("balance-amount");
const transactionForm = document.getElementById("transaction-form");
const transactionList = document.getElementById("transaction-list");
const emptyMessage = document.getElementById("empty-message");

if (balanceDisplay && transactionForm && transactionList) {
  let transactions = [];

  function formatMoney(amount) {
    return amount.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });
  }

  function saveTransactions() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
      return true;
    } catch (error) {
      alert("Your transactions could not be saved in browser storage.");
      return false;
    }
  }

  function loadTransactions() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : [];

      if (
        Array.isArray(parsed) &&
        parsed.every(transaction =>
          typeof transaction.description === "string" &&
          typeof transaction.amount === "number" &&
          Number.isFinite(transaction.amount)
        )
      ) {
        transactions = parsed;
      }
    } catch (error) {
      transactions = [];
    }
  }

  function updateBalance() {
    const balance = transactions.reduce(
      (total, transaction) => total + transaction.amount,
      0
    );

    balanceDisplay.textContent = formatMoney(balance);
    transactionList.innerHTML = "";

    if (emptyMessage) {
      emptyMessage.hidden = transactions.length > 0;
    }

    transactions.forEach((transaction, index) => {
      const item = document.createElement("li");
      const description = document.createElement("span");
      const amount = document.createElement("span");
      const editButton = document.createElement("button");
      const removeButton = document.createElement("button");

      description.textContent = transaction.description;

      const formattedAmount = formatMoney(Math.abs(transaction.amount));

      amount.textContent = transaction.amount < 0
        ? "- " + formattedAmount
        : "+ " + formattedAmount;

      editButton.textContent = "Edit";
      editButton.type = "button";

      editButton.addEventListener("click", () => {
        const newDescription = prompt(
          "Change the description:",
          transaction.description
        );

        if (newDescription === null) return;

        const newAmount = prompt(
          "Change the amount (R$):",
          Math.abs(transaction.amount)
        );

        if (newAmount === null) return;

        const parsedAmount = Number(newAmount);

        if (
          newDescription.trim() === "" ||
          !Number.isFinite(parsedAmount) ||
          parsedAmount <= 0
        ) {
          alert("Please enter a valid description and amount.");
          return;
        }

        const oldDescription = transaction.description;
        const oldAmount = transaction.amount;

        transaction.description = newDescription.trim();
        transaction.amount = oldAmount < 0
          ? -parsedAmount
          : parsedAmount;

        if (saveTransactions()) {
          updateBalance();
        } else {
          transaction.description = oldDescription;
          transaction.amount = oldAmount;
        }
      });

      removeButton.textContent = "Remove";
      removeButton.type = "button";

      removeButton.addEventListener("click", () => {
        if (!confirm("Remove this transaction?")) return;

        const removed = transactions.splice(index, 1);
        if (saveTransactions()) {
          updateBalance();
        } else {
          transactions.splice(index, 0, ...removed);
        }
      });

      item.append(description, amount, editButton, removeButton);
      transactionList.appendChild(item);
    });
  }

  transactionForm.addEventListener("submit", event => {
    event.preventDefault();

    const description = document
      .getElementById("transaction-description")
      .value.trim();

    const amount = Number(
      document.getElementById("transaction-amount").value
    );

    const type = document.getElementById("transaction-type").value;

    if (!description || !Number.isFinite(amount) || amount <= 0) {
      alert("Please enter a description and a valid amount.");
      return;
    }

    transactions.push({
      description,
      amount: type === "income" ? amount : -amount
    });

    if (saveTransactions()) {
      transactionForm.reset();
      updateBalance();
    } else {
      transactions.pop();
    }
  });

  loadTransactions();
  updateBalance();
}


/* =====================================
   LIVE DATE AND TIME
===================================== */

function updateDateTime() {
  const dateDisplay = document.getElementById("current-date");
  const timeDisplay = document.getElementById("current-time");

  if (!dateDisplay || !timeDisplay) return;

  const now = new Date();

  dateDisplay.textContent = now.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric"
  });

  timeDisplay.textContent = now.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
}

updateDateTime();
setInterval(updateDateTime, 1000);


/* =====================================
   PERSONAL BLOG
===================================== */

(function setupBlog() {
  const blogForm = document.getElementById("blog-form");

  // Do nothing on pages that are not the blog.
  if (!blogForm) return;

  const BLOG_STORAGE_KEY = "scrapbook-blog-posts";

  const titleInput = document.getElementById("post-title");
  const editor = document.getElementById("post-content");
  const postsContainer = document.getElementById("blog-posts");
  const emptyMessage = document.getElementById("blog-empty");
  const postCount = document.getElementById("post-count");
  const status = document.getElementById("blog-status");
  const publishButton = document.getElementById("publish-button");
  const cancelEditButton = document.getElementById("cancel-edit");
  const clearButton = document.getElementById("clear-editor");
  const editorHeading = document.getElementById("editor-heading");
  const imageUpload = document.getElementById("image-upload");
  const addLocalImageButton = document.getElementById("add-local-image");
  const addImageUrlButton = document.getElementById("add-image-url");
  const colorPicker = document.getElementById("word-color");
  const applyColorButton = document.getElementById("apply-color");

  let posts = [];
  let editingId = null;

  // Keep a separate copy of the text selection so toolbar clicks
  // do not lose the selected words.
  let savedRange = null;

  function showStatus(message) {
    status.textContent = message;
  }

  function savePosts() {
    try {
      localStorage.setItem(BLOG_STORAGE_KEY, JSON.stringify(posts));
      return true;
    } catch (error) {
      showStatus(
        "Storage is full or unavailable. Your latest change was not saved. " +
        "Try using fewer or smaller images."
      );
      return false;
    }
  }

  function loadPosts() {
    try {
      const saved = localStorage.getItem(BLOG_STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : [];

      if (
        Array.isArray(parsed) &&
        parsed.every(post =>
          typeof post.id === "string" &&
          typeof post.title === "string" &&
          typeof post.content === "string" &&
          typeof post.date === "string"
        )
      ) {
        posts = parsed;
      }
    } catch (error) {
      posts = [];
      showStatus("Saved blog data could not be read.");
    }
  }

  // Remove dangerous elements and attributes before displaying
  // saved rich-text content.
  function cleanContent(html) {
    const parser = new DOMParser();
    const documentCopy = parser.parseFromString(html, "text/html");

    documentCopy.querySelectorAll(
      "script, style, iframe, object, embed, form, input, button, link, meta"
    ).forEach(element => element.remove());

    documentCopy.body.querySelectorAll("*").forEach(element => {
      [...element.attributes].forEach(attribute => {
        const name = attribute.name.toLowerCase();
        const value = attribute.value.trim();

        if (name.startsWith("on") || name === "srcdoc") {
          element.removeAttribute(attribute.name);
        }

        if (
          ["href", "src", "xlink:href", "formaction"].includes(name) &&
          /^\s*(javascript|vbscript):/i.test(value)
        ) {
          element.removeAttribute(attribute.name);
        }

        if (name === "style" && /url\s*\(/i.test(value)) {
          element.removeAttribute(attribute.name);
        }
      });

      if (element.tagName === "IMG") {
        const src = element.getAttribute("src") || "";

        if (
          !/^https?:\/\//i.test(src) &&
          !/^data:image\/(png|jpeg|jpg|gif|webp|avif);base64,/i.test(src)
        ) {
          element.remove();
        }

        element.removeAttribute("srcset");
      }
    });

    return documentCopy.body.innerHTML;
  }

  function rememberSelection() {
    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);

    if (
      editor.contains(range.startContainer) &&
      editor.contains(range.endContainer)
    ) {
      savedRange = range.cloneRange();
    }
  }

  editor.addEventListener("keyup", rememberSelection);
  editor.addEventListener("mouseup", rememberSelection);
  editor.addEventListener("input", rememberSelection);

  function restoreSelection() {
    editor.focus();

    if (!savedRange) return;

    const selection = window.getSelection();
    if (!selection) return;

    selection.removeAllRanges();

    try {
      selection.addRange(savedRange);
    } catch (error) {
      savedRange = null;
    }
  }

  function runFormattingCommand(command, value = null) {
    restoreSelection();

    if (command === "formatBlock") {
      document.execCommand(command, false, value);
    } else {
      document.execCommand(command, false, value);
    }

    rememberSelection();
  }

  document.querySelectorAll("[data-command]").forEach(button => {
    button.addEventListener("mousedown", event => {
      // Keep the editor selection when pressing a toolbar button.
      event.preventDefault();
    });

    button.addEventListener("click", () => {
      const command = button.dataset.command;
      const value = button.dataset.value || null;

      runFormattingCommand(command, value);
    });
  });

  applyColorButton.addEventListener("mousedown", event => {
    event.preventDefault();
  });

  applyColorButton.addEventListener("click", () => {
    restoreSelection();

    const selection = window.getSelection();

    if (!selection || selection.isCollapsed) {
      showStatus("Select a word or phrase in your post first.");
      return;
    }

    document.execCommand("styleWithCSS", false, true);
    document.execCommand("foreColor", false, colorPicker.value);

    rememberSelection();
    showStatus("Text color applied!");
  });

  function insertImage(src, altText) {
    restoreSelection();

    const image = document.createElement("img");
    image.src = src;
    image.alt = altText || "Blog image";
    image.loading = "lazy";

    const selection = window.getSelection();

    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);

      if (
        editor.contains(range.startContainer) &&
        editor.contains(range.endContainer)
      ) {
        range.deleteContents();
        range.insertNode(image);
        range.setStartAfter(image);
        range.collapse(true);

        selection.removeAllRanges();
        selection.addRange(range);
        savedRange = range.cloneRange();
      } else {
        editor.appendChild(image);
      }
    } else {
      editor.appendChild(image);
    }

    editor.focus();
    showStatus("Image added to your draft. Publish to save it.");
  }

  addLocalImageButton.addEventListener("click", () => {
    rememberSelection();
    imageUpload.click();
  });

  imageUpload.addEventListener("change", () => {
    const files = Array.from(imageUpload.files || []);

    if (!files.length) return;

    const validFiles = files.filter(file =>
      file.type.startsWith("image/")
    );

    if (validFiles.length !== files.length) {
      showStatus("Some files were skipped because they aren't images.");
    }

    validFiles.forEach(file => {
      const reader = new FileReader();

      reader.onload = () => {
        if (typeof reader.result === "string") {
          insertImage(reader.result, file.name);
        }
      };

      reader.onerror = () => {
        showStatus("Couldn't read " + file.name + ".");
      };

      reader.readAsDataURL(file);
    });

    // Let the same file be selected again later.
    imageUpload.value = "";
  });

  addImageUrlButton.addEventListener("mousedown", event => {
    event.preventDefault();
  });

  addImageUrlButton.addEventListener("click", () => {
    rememberSelection();

    const url = prompt(
      "Paste a direct image URL (https://...). Animated GIFs are supported."
    );

    if (url === null || !url.trim()) return;

    const trimmedUrl = url.trim();

    if (!/^https?:\/\//i.test(trimmedUrl)) {
      showStatus("Please use an image URL beginning with https:// or http://.");
      return;
    }

    insertImage(trimmedUrl, "Image from the web");
  });

  function resetEditor() {
    blogForm.reset();
    editor.innerHTML = "";
    savedRange = null;
    editingId = null;

    editorHeading.textContent = "Write a post";
    publishButton.textContent = "Publish post";
    cancelEditButton.hidden = true;

    showStatus("");
  }

  clearButton.addEventListener("click", () => {
    if (
      (titleInput.value.trim() || editor.innerHTML.trim()) &&
      !confirm("Clear your current draft?")
    ) {
      return;
    }

    resetEditor();
  });

  cancelEditButton.addEventListener("click", resetEditor);

  function renderPosts() {
    postsContainer.innerHTML = "";

    const sortedPosts = [...posts].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    emptyMessage.hidden = sortedPosts.length > 0;
    postCount.textContent =
      sortedPosts.length + (sortedPosts.length === 1 ? " post" : " posts");

    sortedPosts.forEach(post => {
      const article = document.createElement("article");
      article.className = "blog-post";

      const title = document.createElement("h3");
      title.textContent = post.title.trim() || "Untitled post";

      const meta = document.createElement("div");
      meta.className = "blog-post-meta";

      const date = new Date(post.date);
      meta.textContent = Number.isNaN(date.getTime())
        ? "Saved post"
        : date.toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short"
          });

      const body = document.createElement("div");
      body.className = "blog-post-body";
      body.innerHTML = cleanContent(post.content);

      const actions = document.createElement("div");
      actions.className = "blog-post-actions";

      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.textContent = "Edit post";

      editButton.addEventListener("click", () => {
        editingId = post.id;
        titleInput.value = post.title;
        editor.innerHTML = cleanContent(post.content);

        editorHeading.textContent = "Edit your post";
        publishButton.textContent = "Save changes";
        cancelEditButton.hidden = false;

        showStatus("Editing post. Publish your changes when ready.");

        blogForm.scrollIntoView({ behavior: "smooth", block: "start" });
      });

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.textContent = "Delete post";

      deleteButton.addEventListener("click", () => {
        if (!confirm("Permanently delete this blog post?")) return;

        const previousPosts = posts;
        posts = posts.filter(item => item.id !== post.id);

        if (savePosts()) {
          if (editingId === post.id) resetEditor();
          renderPosts();
          showStatus("Post deleted.");
        } else {
          posts = previousPosts;
          renderPosts();
        }
      });

      actions.append(editButton, deleteButton);
      article.append(title, meta, body, actions);
      postsContainer.appendChild(article);
    });
  }

  blogForm.addEventListener("submit", event => {
    event.preventDefault();

    const title = titleInput.value.trim();
    const content = editor.innerHTML.trim();

    const plainText = editor.textContent.trim();
    const hasImage = editor.querySelector("img") !== null;

    if (!title && !plainText && !hasImage) {
      showStatus("Write something or add an image before publishing.");
      return;
    }

    const safeContent = cleanContent(content);

    if (editingId) {
      const index = posts.findIndex(post => post.id === editingId);

      if (index === -1) {
        showStatus("Couldn't find that post. Please refresh and try again.");
        return;
      }

      const previousPost = posts[index];

      posts[index] = {
        ...previousPost,
        title,
        content: safeContent,
        date: new Date().toISOString()
      };

      if (!savePosts()) {
        posts[index] = previousPost;
        return;
      }

      resetEditor();
      renderPosts();
      showStatus("Your changes have been saved!");
      return;
    }

    const newPost = {
      id: Date.now().toString() + "-" + Math.random().toString(36).slice(2),
      title,
      content: safeContent,
      date: new Date().toISOString()
    };

    posts.push(newPost);

    if (!savePosts()) {
      posts.pop();
      return;
    }

    resetEditor();
    renderPosts();
    showStatus("Your post has been published!");
  });

  loadPosts();
  renderPosts();
})();

