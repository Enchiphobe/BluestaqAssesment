import assert from "node:assert/strict";
import { before, beforeEach, describe, test } from "node:test";

let db: any;
let seedIfEmpty: any;
let authService: any;
let teamsService: any;
let teamsRepository: any;
let usersRepository: any;
let ErrorTypes: any;

before(async () => {
  process.env.DB_PATH = ":memory:";
  ({ db } = await import("../db"));
  ({ seedIfEmpty } = await import("../seed"));
  authService = await import("../auth/auth.service");
  teamsService = await import("./teams.service");
  teamsRepository = await import("./teams.repository");
  usersRepository = await import("../users/users.repository");
  ErrorTypes = await import("../errors");
});

beforeEach(async () => {
  db.exec(`DELETE FROM notes; DELETE FROM memberships; DELETE FROM teams; DELETE FROM users;`);
  await seedIfEmpty();
});

function getUser(name: string) {
  return usersRepository.findByEmail(`${name}@example.com`)!;
}

function getTeamForUser(userName: string, teamName: string) {
  const user = getUser(userName);
  return teamsRepository.listForUser(user.id).items.find((team: any) => team.name === teamName)!;
}

describe("teams.service", () => {
  test("creates team state, supports join + membership updates, and blocks personal-team changes", async () => {
    const manager = getUser("manager");
    const member = getUser("member");
    const admin = getUser("admin");

    const created = teamsService.create(manager, { name: "Launch Team" });
    assert.equal(created.role, "manager");
    assert.equal(created.visibility, "private");
    assert.ok(teamsService.listForUser(manager).items.some((team: any) => team.id === created.id));

    const updated = teamsService.update(
      { userId: manager.id, teamId: created.id, role: "manager" },
      { name: "Renamed Team", visibility: "public" }
    );
    assert.equal(updated.name, "Renamed Team");
    assert.equal(updated.visibility, "public");

    assert.throws(
      () => teamsService.listAll(manager),
      (error: any) => error instanceof ErrorTypes.ForbiddenError
    );
    assert.ok(teamsService.listAll(admin).items.some((team: any) => team.id === created.id));

    const publicTeam = getTeamForUser("member", "Open Team");
    const newcomer = await authService.register({ email: `joiner-${Date.now()}@example.com`, password: "password123", name: "Joiner" });
    teamsService.join(newcomer.user, publicTeam.id);
    assert.ok(teamsRepository.getMembership(publicTeam.id, newcomer.user.id));

    const actorMembership = { userId: manager.id, teamId: created.id, role: "manager" as const };
    const added = teamsService.addMember(actorMembership, newcomer.user.email, "member");
    assert.equal(added.userId, newcomer.user.id);

    teamsService.changeRole(actorMembership, newcomer.user.id, "manager");
    assert.equal(teamsRepository.getMembership(created.id, newcomer.user.id)?.role, "manager");

    teamsService.removeMember(actorMembership, newcomer.user.id);
    assert.equal(teamsRepository.getMembership(created.id, newcomer.user.id), undefined);

    const personalTeam = teamsRepository.listForUser(manager.id).items.find((team: any) => team.visibility === "personal")!;
    assert.throws(
      () => teamsService.update({ userId: manager.id, teamId: personalTeam.id, role: "manager" }, { name: "Nope" }),
      (error: any) => error instanceof ErrorTypes.ForbiddenError
    );
    assert.throws(
      () => teamsService.remove({ userId: manager.id, teamId: personalTeam.id, role: "manager" }),
      (error: any) => error instanceof ErrorTypes.ForbiddenError
    );

    const memberMembership = { userId: member.id, teamId: publicTeam.id, role: "member" as const };
    assert.throws(
      () => teamsService.removeMember(memberMembership, manager.id),
      (error: any) => error instanceof ErrorTypes.ForbiddenError
    );
  });
});
