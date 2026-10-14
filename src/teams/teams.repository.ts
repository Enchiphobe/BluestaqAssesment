import { db } from "../db";
import { Member, Membership, Role, Team, TeamWithRole } from "../types";

export function insertWithOwner(team: Team, ownerId: string): void {
  const insertTeam = db.prepare(
    "INSERT INTO teams (id, name, joinCode, createdAt) VALUES (@id, @name, @joinCode, @createdAt)"
  );
  const insertMember = db.prepare(
    "INSERT INTO memberships (userId, teamId, role, joinedAt) VALUES (?, ?, 'owner', ?)"
  );
  // Both inserts succeed or neither does.
  db.transaction(() => {
    insertTeam.run(team);
    insertMember.run(ownerId, team.id, team.createdAt);
  })();
}

export function findById(teamId: string): Team | undefined {
  return db.prepare("SELECT * FROM teams WHERE id = ?").get(teamId) as Team | undefined;
}

export function findByJoinCode(joinCode: string): Team | undefined {
  return db.prepare("SELECT * FROM teams WHERE joinCode = ?").get(joinCode) as
    | Team
    | undefined;
}

export function listForUser(userId: string): TeamWithRole[] {
  return db
    .prepare(
      `SELECT t.*, m.role FROM teams t
       JOIN memberships m ON m.teamId = t.id
       WHERE m.userId = ?
       ORDER BY t.name`
    )
    .all(userId) as TeamWithRole[];
}

export function getMembership(teamId: string, userId: string): Membership | undefined {
  return db
    .prepare("SELECT userId, teamId, role FROM memberships WHERE teamId = ? AND userId = ?")
    .get(teamId, userId) as Membership | undefined;
}

export function listMembers(teamId: string): Member[] {
  return db
    .prepare(
      `SELECT u.id AS userId, u.name, u.email, m.role, m.joinedAt
       FROM memberships m JOIN users u ON u.id = m.userId
       WHERE m.teamId = ?
       ORDER BY m.joinedAt`
    )
    .all(teamId) as Member[];
}

export function addMember(teamId: string, userId: string, role: Role): void {
  db.prepare(
    "INSERT INTO memberships (userId, teamId, role, joinedAt) VALUES (?, ?, ?, ?)"
  ).run(userId, teamId, role, new Date().toISOString());
}

export function removeMember(teamId: string, userId: string): void {
  db.prepare("DELETE FROM memberships WHERE teamId = ? AND userId = ?").run(teamId, userId);
}

export function updateRole(teamId: string, userId: string, role: Role): void {
  db.prepare("UPDATE memberships SET role = ? WHERE teamId = ? AND userId = ?").run(
    role,
    teamId,
    userId
  );
}

export function updateJoinCode(teamId: string, joinCode: string): void {
  db.prepare("UPDATE teams SET joinCode = ? WHERE id = ?").run(joinCode, teamId);
}

/** Memberships and notes are removed too (ON DELETE CASCADE). */
export function remove(teamId: string): void {
  db.prepare("DELETE FROM teams WHERE id = ?").run(teamId);
}
