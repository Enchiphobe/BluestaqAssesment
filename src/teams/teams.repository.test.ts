import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { before, beforeEach, describe, test } from "node:test";

let db: any;
let seedIfEmpty: any;
let teamsRepository: any;
let usersRepository: any;

before(async () => {
  process.env.DB_PATH = ":memory:";
  ({ db } = await import("../db"));
  ({ seedIfEmpty } = await import("../seed"));
  teamsRepository = await import("./teams.repository");
  usersRepository = await import("../users/users.repository");
});

beforeEach(async () => {
  db.exec(`DELETE FROM notes; DELETE FROM memberships; DELETE FROM teams; DELETE FROM users;`);
  await seedIfEmpty();
});

describe("teams.repository", () => {
  test("reads membership metadata and updates roles safely", () => {
    const user = usersRepository.findByEmail("member@example.com")!;
    const team = teamsRepository.listForUser(user.id).items.find((item: any) => item.name === "Open Team")!;

    const freshUser = {
      id: randomUUID(),
      email: `fresh-${Date.now()}@example.com`,
      name: "Fresh Member",
      role: "user",
      passwordHash: "hash",
      createdAt: new Date().toISOString(),
    };
    usersRepository.insert(freshUser);

    assert.ok(teamsRepository.findById(team.id));
    assert.equal(teamsRepository.countManagers(team.id), 1);

    teamsRepository.addMember(team.id, freshUser.id, "member");
    assert.ok(teamsRepository.getMembership(team.id, freshUser.id));

    teamsRepository.updateRole(team.id, freshUser.id, "manager");
    assert.equal(teamsRepository.getMembership(team.id, freshUser.id)?.role, "manager");

    teamsRepository.removeMember(team.id, freshUser.id);
    assert.equal(teamsRepository.getMembership(team.id, freshUser.id), undefined);
  });
});
