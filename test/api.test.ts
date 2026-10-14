import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

let server: Server;
let base: string;

async function api(method: string, path: string, token?: string, body?: unknown) {
  const res = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}

const login = async (name: string) =>
  (await api("POST", "/auth/login", undefined, { email: `${name}@example.com`, password: name }))
    .data.token as string;

async function register(label: string) {
  const email = `${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  const res = await api("POST", "/auth/register", undefined, {
    email,
    password: "password123",
    name: label,
  });
  return { email, token: res.data.token as string, user: res.data.user, status: res.status };
}

let admin: string, manager: string, member: string;
let demoId: string, openId: string, personalId: string;

before(async () => {
  // The env var must be set before the app is imported, because db.ts reads it on load.
  process.env.DB_PATH = ":memory:";
  const { default: app } = await import("../src/app");
  const { seedIfEmpty } = await import("../src/seed");
  await seedIfEmpty();

  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, () => resolve(s)); // port 0 = any free port
  });
  base = `http://localhost:${(server.address() as AddressInfo).port}`;

  admin = await login("admin");
  manager = await login("manager");
  member = await login("member");

  const teams = (await api("GET", "/teams", manager)).data;
  demoId = teams.find((t: any) => t.name === "Demo Team").id;
  openId = teams.find((t: any) => t.name === "Open Team").id;
  personalId = teams.find((t: any) => t.visibility === "personal").id;
});

after(() => {
  server.closeAllConnections(); // otherwise keep-alive connections keep the process open
  server.close();
});

describe("seed data and auth", () => {
  test("seeded users can log in; bad credentials and missing tokens are rejected", async () => {
    assert.ok(admin && manager && member);
    const bad = await api("POST", "/auth/login", undefined, { email: "admin@example.com", password: "nope" });
    assert.equal(bad.status, 401);
    assert.equal((await api("GET", "/teams")).status, 401);
  });

  test("one user can manage one team and be a member of another", async () => {
    const teams = (await api("GET", "/teams", manager)).data;
    assert.equal(teams.length, 3); // personal + Demo + Open
    assert.equal(teams.find((t: any) => t.id === demoId).role, "manager");
    assert.equal(teams.find((t: any) => t.id === openId).role, "member");
  });
});

describe("notes and roles", () => {
  test("searches notes by title and content within the team", async () => {
    const notes = `/teams/${demoId}/notes`;
    const titleMatch = await api("POST", notes, member, {
      title: "Search probe: nebula",
      content: "A title match",
    });
    const contentMatch = await api("POST", notes, member, {
      title: "Routine note",
      content: "A content match mentioning nebula",
    });
    const unrelated = await api("POST", notes, member, {
      title: "Unrelated note",
      content: "Nothing to find here",
    });

    assert.equal(titleMatch.status, 201);
    assert.equal(contentMatch.status, 201);
    assert.equal(unrelated.status, 201);

    const result = await api("GET", `${notes}?q=nebula`, member);
    assert.equal(result.status, 200);
    const resultIds = result.data.map((note: any) => note.id);
    assert.ok(resultIds.includes(titleMatch.data.id));
    assert.ok(resultIds.includes(contentMatch.data.id));
    assert.ok(!resultIds.includes(unrelated.data.id));
  });

  test("members edit their own notes; managers and admins edit any", async () => {
    const notes = `/teams/${demoId}/notes`;
    const welcome = (await api("GET", notes, member)).data.find(
      (n: any) => n.title === "Welcome to Demo Team"
    );
    assert.ok(welcome, "seeded note should exist");

    const created = await api("POST", notes, member, { title: "Member note" });
    assert.equal(created.status, 201);
    const mine = `${notes}/${created.data.id}`;

    assert.equal((await api("PATCH", mine, member, { content: "edited" })).status, 200);
    assert.equal((await api("PATCH", `${notes}/${welcome.id}`, member, { title: "hacked" })).status, 403);
    assert.equal((await api("DELETE", `${notes}/${welcome.id}`, member)).status, 403);
    assert.equal((await api("PATCH", mine, manager, { content: "by manager" })).status, 200);
    assert.equal((await api("PATCH", `${notes}/${welcome.id}`, admin, { content: "by admin" })).status, 200);
    assert.equal((await api("DELETE", mine, manager)).status, 204);
  });
});

describe("personal teams", () => {
  test("only the owner and admins can open one, and nobody can share or change it", async () => {
    assert.equal((await api("GET", `/teams/${personalId}`, manager)).status, 200);
    assert.equal((await api("GET", `/teams/${personalId}`, member)).status, 403);
    assert.equal((await api("GET", `/teams/${personalId}`, admin)).status, 200);

    const add = { email: "member@example.com" };
    assert.equal((await api("POST", `/teams/${personalId}/members`, manager, add)).status, 403);
    assert.equal((await api("POST", `/teams/${personalId}/members`, admin, add)).status, 403);
    assert.equal((await api("PATCH", `/teams/${personalId}`, manager, { name: "x" })).status, 403);
    assert.equal((await api("DELETE", `/teams/${personalId}`, manager)).status, 403);
    assert.equal((await api("POST", `/teams/${personalId}/join`, member)).status, 404);
  });

  test("registration creates a personal team and ignores a requested role", async () => {
    const reg = await register("newbie");
    assert.equal(reg.status, 201);
    const teams = (await api("GET", "/teams", reg.token)).data;
    assert.equal(teams.length, 1);
    assert.equal(teams[0].visibility, "personal");

    const sneaky = await api("POST", "/auth/register", undefined, {
      email: `sneaky-${Date.now()}@example.com`,
      password: "password123",
      name: "S",
      role: "admin",
    });
    assert.equal(sneaky.data.user.role, "user");
  });
});

describe("public and private teams", () => {
  test("anyone can join a public team, but private teams can't be joined or read", async () => {
    const { token } = await register("joiner");

    const publicList = (await api("GET", "/teams/public", token)).data;
    assert.ok(publicList.some((t: any) => t.id === openId));
    assert.ok(!publicList.some((t: any) => t.id === demoId));

    assert.equal((await api("GET", `/teams/${openId}/notes`, token)).status, 403); // not joined yet
    assert.equal((await api("POST", `/teams/${openId}/join`, token)).status, 204);
    assert.equal((await api("POST", `/teams/${openId}/join`, token)).status, 409);
    assert.equal((await api("GET", `/teams/${openId}/notes`, token)).status, 200);

    assert.equal((await api("POST", `/teams/${demoId}/join`, token)).status, 404);
    assert.equal((await api("GET", `/teams/${demoId}/notes`, token)).status, 403);
  });
});

describe("team managers", () => {
  test("creating teams, adding members, and the last-manager guard", async () => {
    const other = await register("teammate");

    const created = await api("POST", "/teams", manager, { name: "Secret" });
    assert.equal(created.status, 201);
    assert.equal(created.data.visibility, "private"); // default
    assert.equal(created.data.role, "manager");
    const id = created.data.id;

    const badVisibility = await api("POST", "/teams", other.token, { name: "x", visibility: "personal" });
    assert.equal(badVisibility.status, 400);

    assert.equal((await api("POST", `/teams/${id}/members`, manager, { email: other.email })).status, 201);
    assert.equal((await api("POST", `/teams/${id}/members`, manager, { email: other.email })).status, 409);
    assert.equal((await api("POST", `/teams/${id}/members`, other.token, { email: "member@example.com" })).status, 403);
    assert.equal((await api("PATCH", `/teams/${id}`, other.token, { visibility: "public" })).status, 403);
    assert.equal((await api("PATCH", `/teams/${id}`, manager, { visibility: "public" })).status, 200);

    const managerId = (await api("GET", "/auth/me", manager)).data.id;
    assert.equal((await api("DELETE", `/teams/${id}/members/${managerId}`, manager)).status, 403); // sole manager
    assert.equal((await api("PATCH", `/teams/${id}/members/${other.user.id}`, manager, { role: "manager" })).status, 204);
    assert.equal((await api("DELETE", `/teams/${id}/members/${managerId}`, manager)).status, 204); // now allowed
    assert.equal((await api("GET", `/teams/${id}`, manager)).status, 403);
  });
});

describe("admins", () => {
  test("admins can list teams and users, promote others, but never demote the last admin", async () => {
    assert.equal((await api("GET", "/teams?all=true", admin)).data.length >= 5, true);
    assert.equal((await api("GET", "/teams?all=true", manager)).status, 403);
    assert.equal((await api("GET", "/users", member)).status, 403);
    assert.equal((await api("GET", "/users", admin)).status, 200);

    const other = await register("future-admin");
    assert.equal((await api("PATCH", `/users/${other.user.id}/role`, member, { role: "admin" })).status, 403);
    assert.equal((await api("PATCH", `/users/${other.user.id}/role`, admin, { role: "admin" })).status, 200);
    assert.equal((await api("GET", "/users", other.token)).status, 200);
    assert.equal((await api("PATCH", `/users/${other.user.id}/role`, admin, { role: "user" })).status, 200);
    assert.equal((await api("GET", "/users", other.token)).status, 403);

    const adminId = (await api("GET", "/auth/me", admin)).data.id;
    assert.equal((await api("PATCH", `/users/${adminId}/role`, admin, { role: "user" })).status, 403);
  });
});