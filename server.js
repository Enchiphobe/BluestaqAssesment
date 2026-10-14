const express = require("express");
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "notes.json");

app.use(express.json());

// ---------- Storage (simple JSON file so notes survive restarts) ----------
function loadNotes() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return [];
  }
}

function saveNotes() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(notes, null, 2));
}

let notes = loadNotes();

// ---------- Helpers ----------
function validateNote(body, { partial = false } = {}) {
  const errors = [];
  const { title, content, tags } = body;

  if (!partial || title !== undefined) {
    if (typeof title !== "string" || !title.trim()) {
      errors.push("title is required and must be a non-empty string");
    }
  }
  if (content !== undefined && typeof content !== "string") {
    errors.push("content must be a string");
  }
  if (tags !== undefined) {
    if (!Array.isArray(tags) || !tags.every((t) => typeof t === "string")) {
      errors.push("tags must be an array of strings");
    }
  }
  return errors;
}

function findNote(req, res) {
  const note = notes.find((n) => n.id === req.params.id);
  if (!note) res.status(404).json({ error: "Note not found" });
  return note;
}

// ---------- Routes ----------
app.get("/health", (req, res) => res.json({ status: "ok" }));

// List notes. Optional filters: ?q=text  ?tag=work  ?pinned=true
app.get("/notes", (req, res) => {
  const { q, tag, pinned } = req.query;
  let result = notes;

  if (q) {
    const term = q.toLowerCase();
    result = result.filter(
      (n) =>
        n.title.toLowerCase().includes(term) ||
        n.content.toLowerCase().includes(term)
    );
  }
  if (tag) {
    result = result.filter((n) => n.tags.includes(tag));
  }
  if (pinned !== undefined) {
    result = result.filter((n) => n.pinned === (pinned === "true"));
  }

  // Pinned first, then most recently updated
  result = [...result].sort(
    (a, b) =>
      Number(b.pinned) - Number(a.pinned) ||
      b.updatedAt.localeCompare(a.updatedAt)
  );
  res.json(result);
});

// List all tags in use
app.get("/tags", (req, res) => {
  const tags = [...new Set(notes.flatMap((n) => n.tags))].sort();
  res.json(tags);
});

app.get("/notes/:id", (req, res) => {
  const note = findNote(req, res);
  if (note) res.json(note);
});

app.post("/notes", (req, res) => {
  const errors = validateNote(req.body);
  if (errors.length) return res.status(400).json({ errors });

  const now = new Date().toISOString();
  const note = {
    id: randomUUID(),
    title: req.body.title.trim(),
    content: req.body.content || "",
    tags: req.body.tags || [],
    pinned: Boolean(req.body.pinned),
    createdAt: now,
    updatedAt: now,
  };
  notes.push(note);
  saveNotes();
  res.status(201).json(note);
});

// Partial update: send only the fields you want to change
app.patch("/notes/:id", (req, res) => {
  const note = findNote(req, res);
  if (!note) return;

  const errors = validateNote(req.body, { partial: true });
  if (errors.length) return res.status(400).json({ errors });

  const { title, content, tags, pinned } = req.body;
  if (title !== undefined) note.title = title.trim();
  if (content !== undefined) note.content = content;
  if (tags !== undefined) note.tags = tags;
  if (pinned !== undefined) note.pinned = Boolean(pinned);
  note.updatedAt = new Date().toISOString();

  saveNotes();
  res.json(note);
});

app.delete("/notes/:id", (req, res) => {
  const note = findNote(req, res);
  if (!note) return;

  notes = notes.filter((n) => n.id !== note.id);
  saveNotes();
  res.status(204).end();
});

// ---------- Fallbacks ----------
app.use((req, res) => res.status(404).json({ error: "Route not found" }));

app.use((err, req, res, next) => {
  // Catches malformed JSON bodies and anything unexpected
  const status = err.status || 500;
  res.status(status).json({ error: err.message || "Server error" });
});

app.listen(PORT, () =>
  console.log(`Notes API running on http://localhost:${PORT}`)
);