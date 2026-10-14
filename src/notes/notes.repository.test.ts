import assert from "node:assert/strict";
import { before, beforeEach, describe, test } from "node:test";

let db: any;
let seedIfEmpty: any;
let notesRepository: any;
let usersRepository: any;
let teamsRepository: any;

before(async () => {
  process.env.DB_PATH = ":memory:";
  ({ db } = await import("../db"));
  ({ seedIfEmpty } = await import("../seed"));
  notesRepository = await import("./notes.repository");
  usersRepository = await import("../users/users.repository");
  teamsRepository = await import("../teams/teams.repository");
});

beforeEach(async () => {
  db.exec(`DELETE FROM notes; DELETE FROM memberships; DELETE FROM teams; DELETE FROM users;`);
  await seedIfEmpty();
});

describe("notes.repository", () => {
  test("filters and persists notes with author metadata", () => {
    const manager = usersRepository.findByEmail("manager@example.com")!;
    const team = teamsRepository.listForUser(manager.id).find((item: any) => item.name === "Demo Team")!;

    const note = notesRepository.findAll(team.id).find((item: any) => item.title === "Welcome to Demo Team");
    assert.ok(note);
    assert.equal(note.authorName, "manager");

    const filtered = notesRepository.findAll(team.id, { q: "welcome", pinned: true });
    assert.deepEqual(filtered.map((item: any) => item.id), [note.id]);

    assert.ok(notesRepository.listTags(team.id).includes("welcome"));

    notesRepository.update({
      ...note,
      title: "Updated welcome",
      tags: ["welcome", "updated"],
      pinned: false,
      updatedAt: new Date().toISOString(),
    });

    assert.equal(notesRepository.findById(team.id, note.id)?.title, "Updated welcome");
  });
});
