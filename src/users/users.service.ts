import { ForbiddenError, NotFoundError, ValidationError } from "../errors";
import { User } from "../types";
import * as usersRepository from "./users.repository";

function assertAdmin(actor: User): void {
  if (actor.role !== "admin") throw new ForbiddenError("Only admins can do that");
}

export function list(actor: User): User[] {
  assertAdmin(actor);
  return usersRepository.listAll();
}

export function changeRole(actor: User, targetUserId: string, roleInput: unknown): User {
  assertAdmin(actor);
  if (roleInput !== "admin" && roleInput !== "user") {
    throw new ValidationError(["role must be 'admin' or 'user'"]);
  }

  const target = usersRepository.findById(targetUserId);
  if (!target) throw new NotFoundError("User not found");

  if (target.role === "admin" && roleInput === "user" && usersRepository.countAdmins() <= 1) {
    throw new ForbiddenError("There must be at least one admin");
  }

  usersRepository.updateRole(targetUserId, roleInput);
  return { ...target, role: roleInput };
}