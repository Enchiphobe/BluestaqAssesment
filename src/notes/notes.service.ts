import { randomUUID } from "crypto";
import { ForbiddenError, NotFoundError, ValidationError } from "../errors";
import { Membership, Note } from "../types";
import * as notesRepository from "./notes.repository";
import { NoteFilters } from "./notes.repository";

interface NoteInput {
  title?: unknown;
  content?: unknown;
  tags?: unknown;
  pinned?: unknown;
}

const MAX_TITLE = 200;
const MAX_CONTENT = 50_000;
const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 50;

/** Validates the fields that are present. Required-ness is handled by the caller. */
function validate(input: NoteInput): string[] {
  const errors: string[] = [];
  const { title, content, tags, pinned } = input;

  if (title !== undefined && (typeof title !== "string" || !title.trim() || title.trim().length > MAX_TITLE)) {
    errors.push(`title must be a non-empty string (max ${MAX_TITLE} characters)`);
  }
  if (content !== undefined && (typeof content !== "string" || content.length > MAX_CONTENT)) {
    errors.push(`content must be a string (max ${MAX_CONTENT} characters)`);
  }
  if (
    tags !== undefined &&
    (!Array.isArray(tags) ||
      tags.length > MAX_TAGS ||
      !tags.every((t) => typeof t === "string" && t.trim() && t.trim().length <= MAX_TAG_LENGTH))
  ) {
    errors.push(`tags must be an array of up to ${MAX_TAGS} non-empty strings (max ${MAX_TAG_LENGTH} characters each)`);
  }
  if (pinned !== undefined && typeof pinned !== "boolean") {
    errors.push("pinned must be true or false");
  }
  return errors;
}

function cleanTags(tags: string[]): string[] {
  return [...new Set(tags.map((t) => t.trim()))];
}

/** Managers (and admins, who get a manager membership) may change any note; members only their own. */
function assertCanModify(membership: Membership, note: Note): void {
  if (membership.role !== "manager" && note.authorId !== membership.userId) {
    throw new ForbiddenError("You can only modify your own notes");
  }
}

function getOrThrow(teamId: string, noteId: string): Note {
  const note = notesRepository.findById(teamId, noteId);
  if (!note) throw new NotFoundError("Note not found");
  return note;
}

export function list(teamId: string, filters: NoteFilters): Note[] {
  return notesRepository.findAll(teamId, filters);
}

export function listTags(teamId: string): string[] {
  return notesRepository.listTags(teamId);
}

export function get(teamId: string, noteId: string): Note {
  return getOrThrow(teamId, noteId);
}

export function create(membership: Membership, input: NoteInput): Note {
  const errors = validate(input);
  if (input.title === undefined) errors.unshift("title is required");
  if (errors.length) throw new ValidationError(errors);

  const now = new Date().toISOString();
  const id = randomUUID();
  notesRepository.insert({
    id,
    teamId: membership.teamId,
    authorId: membership.userId,
    title: (input.title as string).trim(),
    content: (input.content as string | undefined) ?? "",
    tags: cleanTags((input.tags as string[] | undefined) ?? []),
    pinned: (input.pinned as boolean | undefined) ?? false,
    createdAt: now,
    updatedAt: now,
  });
  return getOrThrow(membership.teamId, id);
}

export function update(membership: Membership, noteId: string, input: NoteInput): Note {
  const note = getOrThrow(membership.teamId, noteId);
  assertCanModify(membership, note);

  const errors = validate(input);
  if (errors.length) throw new ValidationError(errors);

  if (input.title !== undefined) note.title = (input.title as string).trim();
  if (input.content !== undefined) note.content = input.content as string;
  if (input.tags !== undefined) note.tags = cleanTags(input.tags as string[]);
  if (input.pinned !== undefined) note.pinned = input.pinned as boolean;
  note.updatedAt = new Date().toISOString();

  notesRepository.update(note);
  return note;
}

export function remove(membership: Membership, noteId: string): void {
  const note = getOrThrow(membership.teamId, noteId);
  assertCanModify(membership, note);
  notesRepository.remove(membership.teamId, noteId);
}
