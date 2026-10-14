import { randomUUID } from "crypto";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../errors";
import * as usersRepository from "../users/users.repository";
import { Member, Membership, PublicTeam, Team, TeamRole, TeamWithRole, User } from "../types";
import * as teamsRepository from "./teams.repository";

// ---------- Helpers ----------

function getTeam(teamId: string): Team {
  const team = teamsRepository.findById(teamId);
  if (!team) throw new NotFoundError("Team not found");
  return team;
}

function assertManager(actor: Membership): void {
  if (actor.role !== "manager") throw new ForbiddenError("Only managers can do that");
}

function assertNotPersonal(team: Team): void {
  if (team.visibility === "personal") {
    throw new ForbiddenError("Personal teams can't be shared or changed");
  }
}

function parseName(name: unknown): string {
  if (typeof name !== "string" || !name.trim() || name.trim().length > 100) {
    throw new ValidationError(["name is required (max 100 characters)"]);
  }
  return name.trim();
}

// "personal" is deliberately not accepted: personal teams are only created at registration.
function parseVisibility(value: unknown): "public" | "private" {
  if (value !== "public" && value !== "private") {
    throw new ValidationError(["visibility must be 'public' or 'private'"]);
  }
  return value;
}

function parseTeamRole(value: unknown): TeamRole {
  if (value !== "manager" && value !== "member") {
    throw new ValidationError(["role must be 'manager' or 'member'"]);
  }
  return value;
}

// ---------- Teams ----------

export function create(user: User, input: { name?: unknown; visibility?: unknown }): TeamWithRole {
  const team: Team = {
    id: randomUUID(),
    name: parseName(input.name),
    visibility: input.visibility === undefined ? "private" : parseVisibility(input.visibility),
    createdBy: user.id,
    createdAt: new Date().toISOString(),
  };
  teamsRepository.insertWithManager(team, user.id);
  return { ...team, role: "manager" };
}

export function listForUser(user: User): TeamWithRole[] {
  return teamsRepository.listForUser(user.id);
}

export function listAll(user: User): Team[] {
  if (user.role !== "admin") throw new ForbiddenError("Only admins can list every team");
  return teamsRepository.listAll();
}

export function listPublic(user: User): PublicTeam[] {
  return teamsRepository.listPublicNotJoined(user.id);
}

export function get(actor: Membership): { team: Team; role: TeamRole; members: Member[] } {
  return {
    team: getTeam(actor.teamId),
    role: actor.role,
    members: teamsRepository.listMembers(actor.teamId),
  };
}

export function update(actor: Membership, input: { name?: unknown; visibility?: unknown }): Team {
  assertManager(actor);
  const team = getTeam(actor.teamId);
  assertNotPersonal(team);

  if (input.name === undefined && input.visibility === undefined) {
    throw new ValidationError(["provide name and/or visibility"]);
  }
  if (input.name !== undefined) team.name = parseName(input.name);
  if (input.visibility !== undefined) team.visibility = parseVisibility(input.visibility);

  teamsRepository.update(team);
  return team;
}

export function remove(actor: Membership): void {
  assertManager(actor);
  assertNotPersonal(getTeam(actor.teamId));
  teamsRepository.remove(actor.teamId);
}

// ---------- Joining ----------

/** Self-service join. Only public teams; everything else looks like "not found". */
export function join(user: User, teamId: string): void {
  const team = teamsRepository.findById(teamId);
  if (!team || team.visibility !== "public") {
    throw new NotFoundError("No public team with that ID");
  }
  if (teamsRepository.getMembership(teamId, user.id)) {
    throw new ConflictError("You are already a member of this team");
  }
  teamsRepository.addMember(teamId, user.id, "member");
}

// ---------- Members ----------

export function addMember(actor: Membership, emailInput: unknown, roleInput: unknown): Member {
  assertManager(actor);
  assertNotPersonal(getTeam(actor.teamId));

  if (typeof emailInput !== "string" || !emailInput.trim()) {
    throw new ValidationError(["email is required"]);
  }
  const role = roleInput === undefined ? "member" : parseTeamRole(roleInput);

  const target = usersRepository.findByEmail(emailInput.trim().toLowerCase());
  if (!target) throw new NotFoundError("No user with that email");
  if (teamsRepository.getMembership(actor.teamId, target.id)) {
    throw new ConflictError("That user is already a member of this team");
  }

  teamsRepository.addMember(actor.teamId, target.id, role);
  return teamsRepository.listMembers(actor.teamId).find((m) => m.userId === target.id)!;
}

export function removeMember(actor: Membership, targetUserId: string): void {
  assertNotPersonal(getTeam(actor.teamId));

  const target = teamsRepository.getMembership(actor.teamId, targetUserId);
  if (!target) throw new NotFoundError("That user is not a member of this team");

  // Anyone may leave; removing someone else takes a manager.
  if (actor.userId !== targetUserId) assertManager(actor);

  if (target.role === "manager" && teamsRepository.countManagers(actor.teamId) <= 1) {
    throw new ForbiddenError(
      "A team must keep at least one manager. Promote someone else first, or delete the team."
    );
  }
  teamsRepository.removeMember(actor.teamId, targetUserId);
}

export function changeRole(actor: Membership, targetUserId: string, roleInput: unknown): void {
  assertManager(actor);
  assertNotPersonal(getTeam(actor.teamId));
  const role = parseTeamRole(roleInput);

  const target = teamsRepository.getMembership(actor.teamId, targetUserId);
  if (!target) throw new NotFoundError("That user is not a member of this team");

  if (
    target.role === "manager" &&
    role === "member" &&
    teamsRepository.countManagers(actor.teamId) <= 1
  ) {
    throw new ForbiddenError("A team must keep at least one manager");
  }
  teamsRepository.updateRole(actor.teamId, targetUserId, role);
}