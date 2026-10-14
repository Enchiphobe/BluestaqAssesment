import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { BCRYPT_ROUNDS } from "./config";
import { db } from "./db";
import * as notesRepository from "./notes/notes.repository";
import * as teamsRepository from "./teams/teams.repository";
import * as usersRepository from "./users/users.repository";
import { Role } from "./types";

const ROLES: Role[] = ["owner", "admin", "member"];

/**
 * Fills an empty database with demo data: one user per role (name = password = the
 * role), a team they all belong to, and a note. Does nothing if any user exists,
 * so restarting never duplicates data, and never runs in production.
 *
 * It writes through the repositories on purpose: going through the services would
 * reject these deliberately weak passwords.
 */
export async function seedIfEmpty(): Promise<void> {
  if (process.env.NODE_ENV === "production") return;

  const { count } = db.prepare("SELECT COUNT(*) AS count FROM users").get() as { count: number };
  if (count > 0) return;

  const now = new Date().toISOString();

  const users = await Promise.all(
    ROLES.map(async (role) => ({
      role,
      user: {
        id: randomUUID(),
        email: `${role}@example.com`,
        name: role,
        passwordHash: await bcrypt.hash(role, BCRYPT_ROUNDS),
        createdAt: now,
      },
    }))
  );
  const owner = users.find((u) => u.role === "owner")!.user;

  const team = {
    id: randomUUID(),
    name: "Demo Team",
    joinCode: "DEMO123456",
    createdAt: now,
  };

  // All or nothing: a half-seeded database would block the "is it empty?" check next time.
  db.transaction(() => {
    for (const { user } of users) usersRepository.insert(user);
    teamsRepository.insertWithOwner(team, owner.id);
    for (const { role, user } of users) {
      if (role !== "owner") teamsRepository.addMember(team.id, user.id, role);
    }
    notesRepository.insert({
      id: randomUUID(),
      teamId: team.id,
      authorId: owner.id,
      title: "Welcome to Demo Team",
      content: "This note was created by the seed script. Edit or delete it freely.",
      tags: ["welcome"],
      pinned: true,
      createdAt: now,
      updatedAt: now,
    });
  })();

  console.log("[seed] Created demo data (login with email + password):");
  for (const { role, user } of users) {
    console.log(`[seed]   ${user.email} / ${role}`);
  }
  console.log(`[seed]   team "${team.name}" (join code ${team.joinCode})`);
}