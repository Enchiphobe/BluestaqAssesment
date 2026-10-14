import { db } from "../db";
import { DEFAULT_PAGINATION, PageResult, PaginationParams } from "../pagination";
import { Note } from "../types";

// Every function takes teamId, so an unscoped note query can't be written by accident.

interface NoteRow extends Omit<Note, "tags" | "pinned"> {
  tags: string;
  pinned: number;
}

export interface NoteFilters {
  q?: string;
  tag?: string;
  pinned?: boolean;
}

const SELECT_NOTE = `
  SELECT n.*, u.name AS authorName
  FROM notes n JOIN users u ON u.id = n.authorId
`;

function toNote(row: NoteRow): Note {
  return { ...row, tags: JSON.parse(row.tags), pinned: row.pinned === 1 };
}

export function findAll(
  teamId: string,
  filters: NoteFilters = {},
  pagination: PaginationParams = DEFAULT_PAGINATION
): PageResult<Note> {
  const where = ["n.teamId = ?"];
  const params: (string | number)[] = [teamId];

  if (filters.q) {
    const pattern = `%${filters.q.replace(/[\\%_]/g, "\\$&")}%`;
    where.push("(n.title LIKE ? ESCAPE '\\' OR n.content LIKE ? ESCAPE '\\')");
    params.push(pattern, pattern);
  }
  if (filters.tag) {
    where.push("EXISTS (SELECT 1 FROM json_each(n.tags) WHERE value = ?)");
    params.push(filters.tag);
  }
  if (filters.pinned !== undefined) {
    where.push("n.pinned = ?");
    params.push(filters.pinned ? 1 : 0);
  }

  const total = (db
    .prepare(`SELECT COUNT(*) AS total FROM notes n WHERE ${where.join(" AND ")}`)
    .get(...params) as { total: number }).total;
  const rows = db
    .prepare(
      `${SELECT_NOTE} WHERE ${where.join(" AND ")} ORDER BY n.pinned DESC, n.updatedAt DESC LIMIT ? OFFSET ?`
    )
    .all(...params, pagination.limit, pagination.offset) as NoteRow[];
  return { items: rows.map(toNote), total };
}

export function findById(teamId: string, noteId: string): Note | undefined {
  const row = db
    .prepare(`${SELECT_NOTE} WHERE n.teamId = ? AND n.id = ?`)
    .get(teamId, noteId) as NoteRow | undefined;
  return row && toNote(row);
}

export function insert(note: Omit<Note, "authorName">): void {
  db.prepare(
    `INSERT INTO notes (id, teamId, authorId, title, content, tags, pinned, createdAt, updatedAt)
     VALUES (@id, @teamId, @authorId, @title, @content, @tags, @pinned, @createdAt, @updatedAt)`
  ).run({ ...note, tags: JSON.stringify(note.tags), pinned: note.pinned ? 1 : 0 });
}

export function update(note: Note): void {
  db.prepare(
    `UPDATE notes
     SET title = @title, content = @content, tags = @tags, pinned = @pinned, updatedAt = @updatedAt
     WHERE id = @id AND teamId = @teamId`
  ).run({
    id: note.id,
    teamId: note.teamId,
    title: note.title,
    content: note.content,
    tags: JSON.stringify(note.tags),
    pinned: note.pinned ? 1 : 0,
    updatedAt: note.updatedAt,
  });
}

export function remove(teamId: string, noteId: string): void {
  db.prepare("DELETE FROM notes WHERE teamId = ? AND id = ?").run(teamId, noteId);
}

export function listTags(teamId: string): string[] {
  const rows = db
    .prepare(
      `SELECT DISTINCT j.value AS tag
       FROM notes n, json_each(n.tags) j
       WHERE n.teamId = ?
       ORDER BY tag`
    )
    .all(teamId) as { tag: string }[];
  return rows.map((r) => r.tag);
}
