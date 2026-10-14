import assert from "node:assert/strict";
import { before, beforeEach, describe, test } from "node:test";

let db: any;
let seedIfEmpty: any;
let usersRepository: any;

before(async () => {
  process.env.DB_PATH = ":memory:";
  ({ db } = await import("../db"));
  ({ seedIfEmpty } = await import("../seed"));
  usersRepository = await import("./users.repository");
});

beforeEach(async () => {
  db.exec(`DELETE FROM notes; DELETE FROM memberships; DELETE FROM teams; DELETE FROM users;`);
  await seedIfEmpty();
});

describe("users.repository", () => {
  test("finds users and tracks admin count", () => {
    const admin = usersRepository.findByEmail("admin@example.com");
    assert.ok(admin);
    assert.equal(admin.role, "admin");
    assert.equal(usersRepository.countAdmins(), 1);

    const manager = usersRepository.findByEmail("manager@example.com");
    assert.ok(manager);
    usersRepository.updateRole(manager.id, "admin");
    assert.equal(usersRepository.findById(manager.id)?.role, "admin");
  });
});
