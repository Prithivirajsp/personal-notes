
"use strict";

// ============================================================
// CONFIG
// ============================================================
const API_BASE = "https://personal-notes-2-4ezl.onrender.com/api";

const state = {
  view: "all",
  search: "",
  books: [],
  tasks: [],
  notes: [],
  events: [],
};

const NOTE_COLORS = [
  "#FAF6EE",
  "#F4D9A0",
  "#E7CDD3",
  "#CBDACD",
  "#CDE0E8",
];

const TAPE_BY_KIND = {
  book: "#C97B84",
  task: "#6B7A5E",
  note: "#E0A63A",
  event: "#6E96A8",
};

const VIEW_META = {
  all: ["Everything", "Books, plans, to-dos and notes — all pinned in one place."],
  books: ["Books", "What you're reading, finished, and saving for later."],
  scheduler: ["Scheduler", "Everything on the calendar, pinned by date."],
  tasks: ["To-dos", "Check them off. Feel great about it."],
  notes: ["Notes", "Quick thoughts, pinned to the board."],
};

// ============================================================
// API HELPERS
// ============================================================

async function apiSend(path, method = "GET", body) {
  let response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    throw new Error(
      "Backend connect aagala. Render URL and CORS settings check pannunga."
    );
  }

  if (response.status === 204) return null;

  // Response body-ai ore murai mattum read pannuvom.
  const responseText = await response.text();

  if (!response.ok) {
    let message = responseText;

    try {
      const data = JSON.parse(responseText);
      message = JSON.stringify(data.detail ?? data);
    } catch {
      // Response JSON illa na original text-ai use pannuvom.
    }

    throw new Error(
      `${method} ${path} failed (${response.status}): ${message}`
    );
  }

  if (!responseText) return null;

  try {
    return JSON.parse(responseText);
  } catch {
    throw new Error(`Invalid JSON returned by backend for ${path}`);
  }
}

// ============================================================
// HELPERS
// ============================================================
function getElement(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML;
}

function pluralize(kind) {
  return {
    book: "books",
    task: "tasks",
    note: "notes",
    event: "events",
  }[kind];
}

function tilt(id) {
  const angles = [-2.5, -1.2, 0, 1.4, 2.2, -1.8];
  return angles[Math.abs(Number(id) || 0) % angles.length];
}

function matchesSearch(text) {
  return String(text || "")
    .toLowerCase()
    .includes(state.search.toLowerCase());
}

function normalizeBookStatus(status) {
  if (status === "wanttoread" || status === "want_to_read") {
    return "want_to_read";
  }
  return status || "want_to_read";
}

function showError(error) {
  console.error(error);
  alert(error.message || "Something went wrong. Check the backend terminal.");
}

// ============================================================
// LOAD DATA
// ============================================================
async function loadAll() {
  const board = getElement("board");

  try {
    // Stats are optional. Their failure should not prevent notes loading.
    const results = await Promise.allSettled([
      apiGet("/books"),
      apiGet("/tasks"),
      apiGet("/notes"),
      apiGet("/events"),
      apiGet("/stats"),
    ]);

    const [booksResult, tasksResult, notesResult, eventsResult, statsResult] =
      results;

    const requiredResults = [
      booksResult,
      tasksResult,
      notesResult,
      eventsResult,
    ];

    const failed = requiredResults.find((result) => result.status === "rejected");

    if (failed) {
      throw failed.reason;
    }

    state.books = booksResult.value;
    state.tasks = tasksResult.value;
    state.notes = notesResult.value;
    state.events = eventsResult.value;

    if (statsResult.status === "fulfilled") {
      renderStats(statsResult.value);
    } else {
      renderStatsLocally();
    }

    render();
  } catch (error) {
    console.error("Could not load Pinboard data:", error);

    if (board) {
      board.innerHTML = `
        <p style="padding:20px;color:#b84a4a;">
          Data load aagala. Backend running-la irukka nu check pannunga.
          <br>${escapeHtml(error.message)}
        </p>`;
    }
  }
}

function renderStats(stats) {
  if (getElement("statBooks")) {
    getElement("statBooks").textContent =
      stats.books_finished ?? 0;
  }

  if (getElement("statTasks")) {
    getElement("statTasks").textContent =
      `${stats.tasks_done ?? 0}/${stats.tasks_total ?? 0}`;
  }

  if (getElement("statNotes")) {
    getElement("statNotes").textContent =
      stats.notes_total ?? state.notes.length;
  }

  if (getElement("statEvents")) {
    getElement("statEvents").textContent =
      stats.events_upcoming ?? 0;
  }
}

function renderStatsLocally() {
  const finished = state.books.filter(
    (book) => normalizeBookStatus(book.status) === "finished"
  ).length;

  const tasksDone = state.tasks.filter((task) => task.is_done).length;

  const upcoming = state.events.filter((event) => !event.is_done).length;

  if (getElement("statBooks")) {
    getElement("statBooks").textContent = finished;
  }

  if (getElement("statTasks")) {
    getElement("statTasks").textContent =
      `${tasksDone}/${state.tasks.length}`;
  }

  if (getElement("statNotes")) {
    getElement("statNotes").textContent = state.notes.length;
  }

  if (getElement("statEvents")) {
    getElement("statEvents").textContent = upcoming;
  }
}

// ============================================================
// RENDER BOARD
// ============================================================
function render() {
  const board = getElement("board");
  if (!board) return;

  let cards = [];

  if (state.view === "all" || state.view === "notes") {
    state.notes.forEach((note) => {
      if (matchesSearch(`${note.title} ${note.content || ""}`)) {
        cards.push(renderNoteCard(note));
      }
    });
  }

  if (state.view === "all" || state.view === "tasks") {
    state.tasks.forEach((task) => {
      if (matchesSearch(`${task.title} ${task.description || ""}`)) {
        cards.push(renderTaskCard(task));
      }
    });
  }

  if (state.view === "all" || state.view === "books") {
    state.books.forEach((book) => {
      if (matchesSearch(`${book.title} ${book.author || ""}`)) {
        cards.push(renderBookCard(book));
      }
    });
  }

  if (state.view === "all" || state.view === "scheduler") {
    state.events.forEach((event) => {
      if (matchesSearch(`${event.title} ${event.description || ""}`)) {
        cards.push(renderEventCard(event));
      }
    });
  }

  // Show pinned notes first.
  if (state.view === "all" || state.view === "notes") {
    cards = cards.sort((a, b) => {
      const aPinned = a.includes('data-pinned="true"');
      const bPinned = b.includes('data-pinned="true"');
      return Number(bPinned) - Number(aPinned);
    });
  }

  board.innerHTML = cards.join("");

  if (getElement("emptyState")) {
    getElement("emptyState").hidden = cards.length !== 0;
  }

  attachCardHandlers();
}

function renderNoteCard(note) {
  const color = note.color || TAPE_BY_KIND.note;

  return `
    <article class="card"
      style="--tilt:${tilt(note.id)}deg;--tape:${color};background:${color};"
      data-kind="note"
      data-id="${note.id}"
      data-pinned="${Boolean(note.pinned)}">

      <div class="card-actions">
        <button type="button" class="icon-btn"
          data-action="pin"
          title="${note.pinned ? "Unpin note" : "Pin note"}">
          ${note.pinned ? "📌" : "📍"}
        </button>

        <button type="button" class="icon-btn"
          data-action="delete" title="Delete">✕</button>
      </div>

      <span class="card-kind"
        style="--kind-color:${TAPE_BY_KIND.note}">Note</span>

      <h3 class="card-title">${escapeHtml(note.title)}</h3>

      ${
        note.content
          ? `<p class="card-body">${escapeHtml(note.content)}</p>`
          : ""
      }
    </article>`;
}

function renderTaskCard(task) {
  const doneClass = task.is_done ? "task-done" : "";
  const priority = task.priority || "medium";

  return `
    <article class="card ${doneClass}"
      style="--tilt:${tilt(task.id)}deg;--tape:${TAPE_BY_KIND.task};"
      data-kind="task" data-id="${task.id}">

      <div class="card-actions">
        <button type="button" class="icon-btn"
          data-action="delete" title="Delete">✕</button>
      </div>

      <span class="card-kind">To-do</span>

      <label class="task-check">
        <input type="checkbox" data-action="toggle-task"
          ${task.is_done ? "checked" : ""} />

        <div>
          <h3 class="card-title">${escapeHtml(task.title)}</h3>

          ${
            task.description
              ? `<p class="card-body">${escapeHtml(task.description)}</p>`
              : ""
          }

          <div class="card-meta">
            <span class="priority-pill priority-${escapeHtml(priority)}">
              ${escapeHtml(priority)}
            </span>

            ${
              task.due_date
                ? `<span>Due ${escapeHtml(task.due_date)}</span>`
                : ""
            }
          </div>
        </div>
      </label>
    </article>`;
}

function renderBookCard(book) {
  const status = normalizeBookStatus(book.status);

  const statusLabel = {
    want_to_read: "Want to read",
    reading: "Reading",
    finished: "Finished",
  }[status] || "Want to read";

  const rating = Math.max(0, Math.min(5, Number(book.rating) || 0));
  const stars = "★".repeat(rating) + "☆".repeat(5 - rating);

  return `
    <article class="card"
      style="--tilt:${tilt(book.id)}deg;--tape:${book.cover_color || TAPE_BY_KIND.book};"
      data-kind="book" data-id="${book.id}">

      <div class="card-actions">
        <button type="button" class="icon-btn"
          data-action="cycle-status" title="Advance status">↻</button>

        <button type="button" class="icon-btn"
          data-action="delete" title="Delete">✕</button>
      </div>

      <span class="card-kind">${statusLabel}</span>
      <h3 class="card-title">${escapeHtml(book.title)}</h3>

      ${
        book.author
          ? `<p class="card-body">by ${escapeHtml(book.author)}</p>`
          : ""
      }

      ${rating ? `<div class="card-stars">${stars}</div>` : ""}
    </article>`;
}

function renderEventCard(event) {
  return `
    <article class="card ${event.is_done ? "task-done" : ""}"
      style="--tilt:${tilt(event.id)}deg;--tape:${TAPE_BY_KIND.event};"
      data-kind="event" data-id="${event.id}">

      <div class="card-actions">
        <button type="button" class="icon-btn"
          data-action="delete" title="Delete">✕</button>
      </div>

      <span class="card-kind">
        ${escapeHtml(event.category || "general")}
      </span>

      <label class="task-check">
        <input type="checkbox" data-action="toggle-event"
          ${event.is_done ? "checked" : ""} />

        <div>
          <h3 class="card-title">${escapeHtml(event.title)}</h3>

          ${
            event.description
              ? `<p class="card-body">${escapeHtml(event.description)}</p>`
              : ""
          }

          <div class="card-meta">
            <span>
              ${escapeHtml(event.event_date || "")}
              ${event.event_time ? " · " + escapeHtml(event.event_time) : ""}
            </span>
          </div>
        </div>
      </label>
    </article>`;
}

// ============================================================
// CARD BUTTON HANDLERS
// ============================================================
function attachCardHandlers() {
  document.querySelectorAll('[data-action="delete"]').forEach((button) => {
    button.addEventListener("click", async (event) => {
      const card = event.currentTarget.closest(".card");
      if (!card) return;

      const { kind, id } = card.dataset;

      if (!confirm("Indha item-ai delete pannava?")) return;

      try {
        await apiDelete(`/${pluralize(kind)}/${id}`);
        await loadAll();
      } catch (error) {
        showError(error);
      }
    });
  });

  // Pin / unpin existing note.
  document.querySelectorAll('[data-action="pin"]').forEach((button) => {
    button.addEventListener("click", async (event) => {
      const card = event.currentTarget.closest(".card");
      if (!card) return;

      const id = Number(card.dataset.id);
      const note = state.notes.find((item) => Number(item.id) === id);
      if (!note) return;

      try {
        await apiPut(`/notes/${id}`, {
          pinned: !note.pinned,
        });

        await loadAll();
      } catch (error) {
        showError(error);
      }
    });
  });

  // Cycle book status.
  document.querySelectorAll('[data-action="cycle-status"]').forEach((button) => {
    button.addEventListener("click", async (event) => {
      const card = event.currentTarget.closest(".card");
      if (!card) return;

      const id = Number(card.dataset.id);
      const book = state.books.find((item) => Number(item.id) === id);
      if (!book) return;

      const order = ["wanttoread", "reading", "finished"];
      const current = normalizeBookStatus(book.status).replace("_", "");
      const index = order.indexOf(current);
      const next = order[(index + 1) % order.length];

      try {
        await apiPut(`/books/${id}`, { status: next });

        if (next === "finished") celebrate("Finished a book! 📚🎉");

        await loadAll();
      } catch (error) {
        showError(error);
      }
    });
  });

  // Toggle task using the existing PUT update endpoint.
  document.querySelectorAll('[data-action="toggle-task"]').forEach((checkbox) => {
    checkbox.addEventListener("change", async (event) => {
      const card = event.currentTarget.closest(".card");
      if (!card) return;

      const id = Number(card.dataset.id);
      const task = state.tasks.find((item) => Number(item.id) === id);
      if (!task) return;

      try {
        await apiPut(`/tasks/${id}`, {
          is_done: !task.is_done,
        });

        if (!task.is_done) celebrate("Task done! ✅🎉");

        await loadAll();
      } catch (error) {
        showError(error);
        await loadAll();
      }
    });
  });

  // Toggle event.
  document.querySelectorAll('[data-action="toggle-event"]').forEach((checkbox) => {
    checkbox.addEventListener("change", async (event) => {
      const card = event.currentTarget.closest(".card");
      if (!card) return;

      const id = Number(card.dataset.id);
      const item = state.events.find((entry) => Number(entry.id) === id);
      if (!item) return;

      try {
        await apiPut(`/events/${id}`, {
          is_done: !item.is_done,
        });

        if (!item.is_done) celebrate("All set! 🎉");

        await loadAll();
      } catch (error) {
        showError(error);
        await loadAll();
      }
    });
  });
}

// ============================================================
// SIDEBAR NAVIGATION
// ============================================================
document.querySelectorAll(".nav-item").forEach((item) => {
  item.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach((nav) => {
      nav.classList.remove("active");
    });

    item.classList.add("active");
    state.view = item.dataset.view || "all";

    const meta = VIEW_META[state.view] || VIEW_META.all;

    if (getElement("viewTitle")) {
      getElement("viewTitle").textContent = meta[0];
    }

    if (getElement("viewSub")) {
      getElement("viewSub").textContent = meta[1];
    }

    render();
  });
});

// ============================================================
// SEARCH
// ============================================================
if (getElement("searchInput")) {
  getElement("searchInput").addEventListener("input", (event) => {
    state.search = event.target.value || "";
    render();
  });
}

// ============================================================
// ADD MODAL
// ============================================================
const modalOverlay = getElement("modalOverlay");
const itemForm = getElement("itemForm");

let selectedNoteColor = NOTE_COLORS[0];

function buildNoteSwatches() {
  const wrap = getElement("noteColorSwatches");
  if (!wrap) return;

  wrap.innerHTML = NOTE_COLORS.map(
    (color, index) => `
      <span
        class="swatch ${index === 0 ? "selected" : ""}"
        data-color="${color}"
        style="background:${color}"
        role="button"
        tabindex="0"
        aria-label="Select note color">
      </span>`
  ).join("");

  wrap.querySelectorAll(".swatch").forEach((swatch) => {
    const selectColor = () => {
      wrap.querySelectorAll(".swatch").forEach((item) => {
        item.classList.remove("selected");
      });

      swatch.classList.add("selected");
      selectedNoteColor = swatch.dataset.color;
    };

    swatch.addEventListener("click", selectColor);

    swatch.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectColor();
      }
    });
  });
}

function setModalType(type) {
  if (getElement("formType")) {
    getElement("formType").value = type;
  }

  document.querySelectorAll(".modal-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.type === type);
  });

  document.querySelectorAll(".field-group").forEach((group) => {
    group.hidden = group.dataset.group !== type;
  });
}

function openModal(defaultType = "note") {
  if (!modalOverlay || !itemForm) return;

  itemForm.reset();
  selectedNoteColor = NOTE_COLORS[0];
  buildNoteSwatches();

  modalOverlay.hidden = false;
  modalOverlay.classList.add("open");

  setModalType(defaultType);

  if (getElement("fieldTitle")) {
    getElement("fieldTitle").focus();
  }
}

function closeModal() {
  if (!modalOverlay) return;

  modalOverlay.classList.remove("open");
  modalOverlay.hidden = true;
}

if (getElement("openAddModal")) {
  getElement("openAddModal").addEventListener("click", () => {
    openModal("note");
  });
}

if (getElement("closeModal")) {
  const closeButton = getElement("closeModal");
  closeButton.type = "button";

  closeButton.addEventListener("click", (event) => {
    event.preventDefault();
    closeModal();
  });
}

if (modalOverlay) {
  modalOverlay.addEventListener("click", (event) => {
    if (event.target === modalOverlay) {
      closeModal();
    }
  });
}

document.querySelectorAll(".modal-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    setModalType(tab.dataset.type);
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && modalOverlay && !modalOverlay.hidden) {
    closeModal();
  }
});

const closeButton = document.getElementById("closeModal");

function closeModal() {
  if (modalOverlay) {
    modalOverlay.hidden = true;
    modalOverlay.classList.remove("open", "active");
  }
}

if (closeButton) {
  closeButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeModal();
  });
}

// Overlay background click pannina close aagum
if (modalOverlay) {
  modalOverlay.addEventListener("click", (event) => {
    if (event.target === modalOverlay) {
      closeModal();
    }
  });
}


// ============================================================
// SUBMIT FORM: NOTE / TASK / BOOK / EVENT
// ============================================================
if (itemForm) {
  itemForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const type = getElement("formType")?.value || "note";
    const title = getElement("fieldTitle")?.value.trim() || "";

    if (!title) {
      alert("Title enter pannunga.");
      getElement("fieldTitle")?.focus();
      return;
    }

    const submitButton = itemForm.querySelector(
      'button[type="submit"], button:not([type])'
    );

    if (submitButton) submitButton.disabled = true;

    try {
      if (type === "note") {
        await apiPost("/notes", {
          title,
          content: getElement("fieldContent")?.value || "",
          color: selectedNoteColor,
          pinned: true,
        });
      } else if (type === "task") {
        await apiPost("/tasks", {
          title,
          description: getElement("fieldTaskDesc")?.value || "",
          priority: getElement("fieldPriority")?.value || "medium",
          due_date: getElement("fieldDueDate")?.value || null,
        });
      } else if (type === "book") {
        const statusValue = getElement("fieldBookStatus")?.value || "wanttoread";

        await apiPost("/books", {
          title,
          author: getElement("fieldAuthor")?.value || "",
          status: statusValue.replaceAll("_", ""),
          rating: Number(getElement("fieldRating")?.value || 0),
          cover_color: ["#C97B84", "#E0A63A", "#6E96A8", "#6B7A5E"][
            state.books.length % 4
          ],
        });
      } else if (type === "event") {
        const eventDate = getElement("fieldEventDate")?.value || "";

        if (!eventDate) {
          alert("Event date select pannunga.");
          return;
        }

        await apiPost("/events", {
          title,
          description: getElement("fieldEventDesc")?.value || "",
          event_date: eventDate,
          event_time: getElement("fieldEventTime")?.value || null,
          category: getElement("fieldEventCategory")?.value || "general",
        });
      }

      closeModal();
      await loadAll();
    } catch (error) {
      showError(error);
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
}

// ============================================================
// CONFETTI
// ============================================================
const canvas = getElement("confettiCanvas");
const ctx = canvas ? canvas.getContext("2d") : null;

const CONFETTI_COLORS = [
  "#E0A63A",
  "#C97B84",
  "#6E96A8",
  "#6B7A5E",
  "#F4D9A0",
];

function resizeCanvas() {
  if (!canvas) return;

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

function celebrate(message) {
  if (getElement("celebrateBanner") && getElement("celebrateText")) {
    getElement("celebrateText").textContent = message;
    getElement("celebrateBanner").classList.add("show");

    setTimeout(() => {
      getElement("celebrateBanner")?.classList.remove("show");
    }, 1800);
  }

  if (!canvas || !ctx) return;

  const particles = [];

  for (let i = 0; i < 100; i++) {
    particles.push({
      x: canvas.width / 2 + (Math.random() - 0.5) * 200,
      y: canvas.height / 3,
      vx: (Math.random() - 0.5) * 10,
      vy: Math.random() * -10 - 4,
      size: Math.random() * 7 + 4,
      color: CONFETTI_COLORS[
        Math.floor(Math.random() * CONFETTI_COLORS.length)
      ],
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 12,
    });
  }

  let frame = 0;

  function step() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    frame++;

    particles.forEach((particle) => {
      particle.vy += 0.35;
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.rotation += particle.rotationSpeed;

      ctx.save();
      ctx.translate(particle.x, particle.y);
      ctx.rotate((particle.rotation * Math.PI) / 180);
      ctx.fillStyle = particle.color;
      ctx.fillRect(
        -particle.size / 2,
        -particle.size / 4,
        particle.size,
        particle.size / 2
      );
      ctx.restore();
    });

    if (frame < 130) {
      requestAnimationFrame(step);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  requestAnimationFrame(step);
}

// ============================================================
// INITIALIZE
// ============================================================
buildNoteSwatches();
loadAll();

setInterval(() => {
  loadAll();
}, 60000);
