import { db } from "../db";
import { Member, Membership, PublicTeam, Team, TeamRole, TeamWithRole } from "../types";

export function insertWithManager(team: Team, managerId: string): void {
  const insertTeam = db.prepare(
    `INSERT INTO teams (id, name, visibility, createdBy, createdAt)
     VALUES (@id, @name, @visibility, @createdBy, @createdAt)`
  );
  const insertMember = db.prepare(
    "INSERT INTO memberships (userId, teamId, role, joinedAt) VALUES (?, ?, 'manager', ?)"
  );
  // Both inserts succeed or neither does.
  db.transaction(() => {
    insertTeam.run(team);
    insertMember.run(managerId, team.id, team.createdAt);
  })();
}

export function findById(teamId: string): Team | undefined {
  return db.prepare("SELECT * FROM teams WHERE id = ?").get(teamId) as Team | undefined;
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

export function listAll(): Team[] {
  return db.prepare("SELECT * FROM teams ORDER BY name").all() as Team[];
}

/** Public teams the user hasn't joined yet. */
export function listPublicNotJoined(userId: string): PublicTeam[] {
  return db
    .prepare(
      `SELECT t.id, t.name, t.createdAt FROM teams t
       WHERE t.visibility = 'public'
         AND NOT EXISTS (
           SELECT 1 FROM memberships m WHERE m.teamId = t.id AND m.userId = ?
         )
       ORDER BY t.name`
    )
    .all(userId) as PublicTeam[];
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

export function countManagers(teamId: string): number {
  const row = db
    .prepare("SELECT COUNT(*) AS count FROM memberships WHERE teamId = ? AND role = 'manager'")
    .get(teamId) as { count: number };
  return row.count;
}

export function addMember(teamId: string, userId: string, role: TeamRole): void {
  db.prepare(
    "INSERT INTO memberships (userId, teamId, role, joinedAt) VALUES (?, ?, ?, ?)"
  ).run(userId, teamId, role, new Date().toISOString());
}

export function removeMember(teamId: string, userId: string): void {
  db.prepare("DELETE FROM memberships WHERE teamId = ? AND userId = ?").run(teamId, userId);
}

export function updateRole(teamId: string, userId: string, role: TeamRole): void {
  db.prepare("UPDATE memberships SET role = ? WHERE teamId = ? AND userId = ?").run(
    role,
    teamId,
    userId
  );
}

export function update(team: Pick<Team, "id" | "name" | "visibility">): void {
  db.prepare("UPDATE teams SET name = @name, visibility = @visibility WHERE id = @id").run({
    id: team.id,
    name: team.name,
    visibility: team.visibility,
  });
}

/** Memberships and notes are removed too (ON DELETE CASCADE). */
export function remove(teamId: string): void {
  db.prepare("DELETE FROM teams WHERE id = ?").run(teamId);
}