import assert from "node:assert/strict";
import { before, beforeEach, describe, test } from "node:test";

let db: any;
let seedIfEmpty: any;
let notesService: any;
let usersRepository: any;
let teamsRepository: any;
let ErrorTypes: any;

before(async () => {
  process.env.DB_PATH = ":memory:";
  ({ db } = await import("../db"));
  ({ seedIfEmpty } = await import("../seed"));
  notesService = await import("./notes.service");
  usersRepository = await import("../users/users.repository");
  teamsRepository = await import("../teams/teams.repository");
  ErrorTypes = await import("../errors");
});

beforeEach(async () => {
  db.exec(`DELETE FROM notes; DELETE FROM memberships; DELETE FROM teams; DELETE FROM users;`);
  await seedIfEmpty();
});

function getUser(name: string) {
  return usersRepository.findByEmail(`${name}@example.com`)!;
}

function getDemoTeam() {
  return teamsRepository.listForUser(getUser("manager").id).items.find((team: any) => team.name === "Demo Team")!;
}

describe("notes.service", () => {
  test("creates and updates notes with validation and author restrictions", () => {
    const manager = getUser("manager");
    const member = getUser("member");
    const demoTeam = getDemoTeam();

    const managerMembership = { userId: manager.id, teamId: demoTeam.id, role: "manager" as const };
    const memberMembership = { userId: member.id, teamId: demoTeam.id, role: "member" as const };

    const note = notesService.create(managerMembership, {
      title: "Quarterly review",
      content: "Need follow-up notes.",
      tags: ["work", "work", " planning "],
      pinned: true,
    });

    assert.equal(note.title, "Quarterly review");
    assert.deepEqual(note.tags, ["work", "planning"]);
    assert.equal(notesService.list(demoTeam.id, { pinned: true }).items.length > 0, true);
    assert.ok(notesService.listTags(demoTeam.id).includes("welcome"));

    const memberNote = notesService.create(memberMembership, {
      title: "Member note",
      content: "Created by member",
    });
    const updated = notesService.update(memberMembership, memberNote.id, {
      content: "Updated by member",
      tags: ["mine", "mine"],
    });
    assert.equal(updated.content, "Updated by member");
    assert.deepEqual(updated.tags, ["mine"]);

    assert.throws(
      () => notesService.update(memberMembership, note.id, { content: "Attempted change" }),
      (error: any) => error instanceof ErrorTypes.ForbiddenError
    );

    assert.throws(
      () => notesService.create(managerMembership, { title: "", content: "content" }),
      (error: any) => error instanceof ErrorTypes.ValidationError
    );
  });
});
