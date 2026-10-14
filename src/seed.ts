import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { BCRYPT_ROUNDS } from "./config";
import { db } from "./db";
import * as notesRepository from "./notes/notes.repository";
import * as teamsRepository from "./teams/teams.repository";
import * as usersRepository from "./users/users.repository";
import { GlobalRole, Team, Visibility } from "./types";

// Name = password = the label. Only "admin" gets the global admin role;
// manager/member are normal users who differ by their role inside teams.
const SEED_USERS: { name: string; role: GlobalRole }[] = [
  { name: "admin", role: "admin" },
  { name: "manager", role: "user" },
  { name: "member", role: "user" },
];

/**
 * Fills an empty database with demo data. Does nothing if any user exists,
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
    SEED_USERS.map(async ({ name, role }) => ({
      id: randomUUID(),
      email: `${name}@example.com`,
      name,
      role,
      passwordHash: await bcrypt.hash(name, BCRYPT_ROUNDS),
      createdAt: now,
    }))
  );
  const byName = (name: string) => users.find((u) => u.name === name)!;
  const manager = byName("manager");
  const member = byName("member");

  const makeTeam = (name: string, visibility: Visibility, createdBy: string): Team => ({
    id: randomUUID(),
    name,
    visibility,
    createdBy,
    createdAt: now,
  });
  const demoTeam = makeTeam("Demo Team", "private", manager.id);
  const openTeam = makeTeam("Open Team", "public", member.id);

  // All or nothing: a half-seeded database would block the "is it empty?" check next time.
  db.transaction(() => {
    for (const user of users) {
      usersRepository.insert(user);
      teamsRepository.insertWithManager(makeTeam("Personal", "personal", user.id), user.id);
    }

    // Demo Team: "manager" manages it, "member" is a plain member.
    teamsRepository.insertWithManager(demoTeam, manager.id);
    teamsRepository.addMember(demoTeam.id, member.id, "member");

    // Open Team: roles flipped, showing one user can manage one team and belong to another.
    teamsRepository.insertWithManager(openTeam, member.id);
    teamsRepository.addMember(openTeam.id, manager.id, "member");

    notesRepository.insert({
      id: randomUUID(),
      teamId: demoTeam.id,
      authorId: manager.id,
      title: "Welcome to Demo Team",
      content: "This note was created by the seed script. Edit or delete it freely.",
      tags: ["welcome"],
      pinned: true,
      createdAt: now,
      updatedAt: now,
    });
  })();

  console.log("[seed] Created demo data (login with email + password):");
  for (const user of users) {
    console.log(`[seed]   ${user.email} / ${user.name}  (global role: ${user.role})`);
  }
  console.log(`[seed]   teams: "${demoTeam.name}" (private), "${openTeam.name}" (public), plus a personal team each`);
}