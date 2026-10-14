import assert from "node:assert/strict";
import { before, beforeEach, describe, test } from "node:test";

let db: any;
let seedIfEmpty: any;
let authService: any;
let usersRepository: any;
let ErrorTypes: any;

before(async () => {
  process.env.DB_PATH = ":memory:";
  ({ db } = await import("../db"));
  ({ seedIfEmpty } = await import("../seed"));
  authService = await import("./auth.service");
  usersRepository = await import("../users/users.repository");
  ErrorTypes = await import("../errors");
});

beforeEach(async () => {
  db.exec(`DELETE FROM notes; DELETE FROM memberships; DELETE FROM teams; DELETE FROM users;`);
  await seedIfEmpty();
});

describe("auth.service", () => {
  test("registers a user and logs in with a valid password", async () => {
    const email = `new-user-${Date.now()}@example.com`;
    const result = await authService.register({ email, password: "password123", name: "New User" });

    assert.equal(result.user.email, email);
    assert.equal(result.user.role, "user");
    assert.ok(result.token);

    const personalTeam = usersRepository.listAll().items.find((user: any) => user.email === email) ? true : false;
    assert.equal(personalTeam, true);

    const loginResult = await authService.login({ email, password: "password123" });
    assert.equal(loginResult.user.email, email);
    assert.equal(loginResult.user.role, "user");
  });

  test("rejects invalid credentials and duplicate emails", async () => {
    await assert.rejects(
      () => authService.register({ email: "bad-email", password: "short", name: "   " }),
      (error: any) =>
        error instanceof ErrorTypes.ValidationError &&
        error.details?.includes("email must be a valid email address") &&
        error.details?.includes("password must be between 8 and 200 characters")
    );

    await assert.rejects(
      () => authService.login({ email: "admin@example.com", password: "wrong-password" }),
      (error: any) => error instanceof ErrorTypes.UnauthorizedError
    );

    await assert.rejects(
      () => authService.register({ email: "admin@example.com", password: "password123", name: "Admin" }),
      (error: any) => error instanceof ErrorTypes.ConflictError
    );
  });
});
