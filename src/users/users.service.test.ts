import assert from "node:assert/strict";
import { before, beforeEach, describe, test } from "node:test";

let db: any;
let seedIfEmpty: any;
let usersService: any;
let usersRepository: any;
let ErrorTypes: any;

before(async () => {
  process.env.DB_PATH = ":memory:";
  ({ db } = await import("../db"));
  ({ seedIfEmpty } = await import("../seed"));
  usersService = await import("./users.service");
  usersRepository = await import("./users.repository");
  ErrorTypes = await import("../errors");
});

beforeEach(async () => {
  db.exec(`DELETE FROM notes; DELETE FROM memberships; DELETE FROM teams; DELETE FROM users;`);
  await seedIfEmpty();
});

function getUser(name: string) {
  return usersRepository.findByEmail(`${name}@example.com`)!;
}

describe("users.service", () => {
  test("admin can list users and change roles while preserving the last admin", () => {
    const admin = getUser("admin");
    const manager = getUser("manager");

    const list = usersService.list(admin);
    assert.ok(list.some((user: any) => user.email === "manager@example.com"));

    assert.throws(
      () => usersService.list(manager),
      (error: any) => error instanceof ErrorTypes.ForbiddenError
    );

    assert.throws(
      () => usersService.changeRole(admin, admin.id, "user"),
      (error: any) => error instanceof ErrorTypes.ForbiddenError
    );

    const updated = usersService.changeRole(admin, manager.id, "admin");
    assert.equal(updated.role, "admin");
  });
});
