import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { DB_PATH } from "./config";

if (DB_PATH !== ":memory:") {
  fs.mkdirSync(path.dirname(path.resolve(DB_PATH)), { recursive: true });
}

export const db: InstanceType<typeof Database> = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id           TEXT PRIMARY KEY,
    email        TEXT NOT NULL UNIQUE,
    name         TEXT NOT NULL,
    role         TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    passwordHash TEXT NOT NULL,
    createdAt    TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS teams (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    visibility TEXT NOT NULL CHECK (visibility IN ('public', 'private', 'personal')),
    createdBy  TEXT NOT NULL REFERENCES users(id),
    createdAt  TEXT NOT NULL
  );

  -- At most one personal team per user, enforced by the database itself.
  CREATE UNIQUE INDEX IF NOT EXISTS idx_one_personal_team
    ON teams(createdBy) WHERE visibility = 'personal';

  CREATE TABLE IF NOT EXISTS memberships (
    userId   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    teamId   TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    role     TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('manager', 'member')),
    joinedAt TEXT NOT NULL,
    PRIMARY KEY (userId, teamId)
  );

  CREATE TABLE IF NOT EXISTS notes (
    id        TEXT PRIMARY KEY,
    teamId    TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    authorId  TEXT NOT NULL REFERENCES users(id),
    title     TEXT NOT NULL,
    content   TEXT NOT NULL DEFAULT '',
    tags      TEXT NOT NULL DEFAULT '[]',
    pinned    INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_notes_team ON notes(teamId, updatedAt);
  CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships(userId);
`);