import { randomBytes, randomUUID } from "crypto";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../errors";
import * as usersRepository from "../users/users.repository";
import { Member, Membership, Role, Team, TeamWithRole, User } from "../types";
import * as teamsRepository from "./teams.repository";

const isAdminOrOwner = (role: Role) => role === "owner" || role === "admin";

function newJoinCode(): string {
  return randomBytes(5).toString("hex").toUpperCase(); // e.g. "9F3A1C07BE"
}

function parseName(name: unknown): string {
  if (typeof name !== "string" || !name.trim() || name.trim().length > 100) {
    throw new ValidationError(["name is required (max 100 characters)"]);
  }
  return name.trim();
}

function parseRole(role: unknown): Role {
  if (role !== "admin" && role !== "member") {
    throw new ValidationError(["role must be 'admin' or 'member'"]);
  }
  return role;
}

export function create(user: User, nameInput: unknown): TeamWithRole {
  const team: Team = {
    id: randomUUID(),
    name: parseName(nameInput),
    joinCode: newJoinCode(),
    createdAt: new Date().toISOString(),
  };
  teamsRepository.insertWithOwner(team, user.id);
  return { ...team, role: "owner" };
}

export function listForUser(user: User): Omit<TeamWithRole, "joinCode">[] {
  // The join code is only shown to admins/owners, via get().
  return teamsRepository.listForUser(user.id).map(({ joinCode, ...team }) => team);
}

export function get(membership: Membership): {
  team: Omit<Team, "joinCode"> & { joinCode?: string };
  role: Role;
  members: Member[];
} {
  const team = teamsRepository.findById(membership.teamId);
  if (!team) throw new NotFoundError("Team not found");

  const { joinCode, ...rest } = team;
  return {
    team: isAdminOrOwner(membership.role) ? team : rest,
    role: membership.role,
    members: teamsRepository.listMembers(team.id),
  };
}

export function joinByCode(user: User, codeInput: unknown): TeamWithRole {
  if (typeof codeInput !== "string" || !codeInput.trim()) {
    throw new ValidationError(["joinCode is required"]);
  }
  const team = teamsRepository.findByJoinCode(codeInput.trim().toUpperCase());
  if (!team) throw new NotFoundError("No team matches that join code");

  if (teamsRepository.getMembership(team.id, user.id)) {
    throw new ConflictError("You are already a member of this team");
  }
  teamsRepository.addMember(team.id, user.id, "member");
  return { ...team, role: "member" };
}

export function addMember(actor: Membership, emailInput: unknown, roleInput: unknown): Member {
  if (!isAdminOrOwner(actor.role)) {
    throw new ForbiddenError("Only admins and owners can add members");
  }
  if (typeof emailInput !== "string" || !emailInput.trim()) {
    throw new ValidationError(["email is required"]);
  }
  const role = roleInput === undefined ? "member" : parseRole(roleInput);
  if (role === "admin" && actor.role !== "owner") {
    throw new ForbiddenError("Only the owner can add admins");
  }

  const target = usersRepository.findByEmail(emailInput.trim().toLowerCase());
  if (!target) throw new NotFoundError("No user with that email");
  if (teamsRepository.getMembership(actor.teamId, target.id)) {
    throw new ConflictError("That user is already a member of this team");
  }

  teamsRepository.addMember(actor.teamId, target.id, role);
  return teamsRepository.listMembers(actor.teamId).find((m) => m.userId === target.id)!;
}

export function removeMember(actor: Membership, targetUserId: string): void {
  const target = teamsRepository.getMembership(actor.teamId, targetUserId);
  if (!target) throw new NotFoundError("That user is not a member of this team");

  if (target.role === "owner") {
    throw new ForbiddenError("The owner can't be removed. Delete the team instead.");
  }

  const isSelf = actor.userId === targetUserId;
  const allowed =
    isSelf || // anyone (except the owner) may leave
    actor.role === "owner" ||
    (actor.role === "admin" && target.role === "member");
  if (!allowed) throw new ForbiddenError("You can't remove that member");

  teamsRepository.removeMember(actor.teamId, targetUserId);
}

export function changeRole(actor: Membership, targetUserId: string, roleInput: unknown): void {
  if (actor.role !== "owner") throw new ForbiddenError("Only the owner can change roles");
  const role = parseRole(roleInput);

  const target = teamsRepository.getMembership(actor.teamId, targetUserId);
  if (!target) throw new NotFoundError("That user is not a member of this team");
  if (target.role === "owner") throw new ForbiddenError("The owner's role can't be changed");

  teamsRepository.updateRole(actor.teamId, targetUserId, role);
}

export function regenerateJoinCode(actor: Membership): { joinCode: string } {
  if (!isAdminOrOwner(actor.role)) {
    throw new ForbiddenError("Only admins and owners can regenerate the join code");
  }
  const joinCode = newJoinCode();
  teamsRepository.updateJoinCode(actor.teamId, joinCode);
  return { joinCode };
}

export function remove(actor: Membership): void {
  if (actor.role !== "owner") throw new ForbiddenError("Only the owner can delete the team");
  teamsRepository.remove(actor.teamId);
}
