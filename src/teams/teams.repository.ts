import { db } from "../db";
import { DEFAULT_PAGINATION, PageResult, PaginationParams } from "../pagination";
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

export function listForUser(
  userId: string,
  pagination: PaginationParams = DEFAULT_PAGINATION
): PageResult<TeamWithRole> {
  const total = (db
    .prepare("SELECT COUNT(*) AS total FROM memberships WHERE userId = ?")
    .get(userId) as { total: number }).total;
  const items = db
    .prepare(
      `SELECT t.*, m.role FROM teams t
       JOIN memberships m ON m.teamId = t.id
       WHERE m.userId = ?
       ORDER BY t.name
       LIMIT ? OFFSET ?`
    )
    .all(userId, pagination.limit, pagination.offset) as TeamWithRole[];
  return { items, total };
}

export function listAll(pagination: PaginationParams = DEFAULT_PAGINATION): PageResult<Team> {
  const total = (db.prepare("SELECT COUNT(*) AS total FROM teams").get() as { total: number }).total;
  const items = db
    .prepare("SELECT * FROM teams ORDER BY name LIMIT ? OFFSET ?")
    .all(pagination.limit, pagination.offset) as Team[];
  return { items, total };
}

/** Public teams the user hasn't joined yet. */
export function listPublicNotJoined(
  userId: string,
  pagination: PaginationParams = DEFAULT_PAGINATION
): PageResult<PublicTeam> {
  const where = `t.visibility = 'public'
    AND NOT EXISTS (
      SELECT 1 FROM memberships m WHERE m.teamId = t.id AND m.userId = ?
    )`;
  const total = (db
    .prepare(`SELECT COUNT(*) AS total FROM teams t WHERE ${where}`)
    .get(userId) as { total: number }).total;
  const items = db
    .prepare(
      `SELECT t.id, t.name, t.createdAt FROM teams t
       WHERE ${where}
       ORDER BY t.name
       LIMIT ? OFFSET ?`
    )
    .all(userId, pagination.limit, pagination.offset) as PublicTeam[];
  return { items, total };
}

export function getMembership(teamId: string, userId: string): Membership | undefined {
  return db
    .prepare("SELECT userId, teamId, role FROM memberships WHERE teamId = ? AND userId = ?")
    .get(teamId, userId) as Membership | undefined;
}

export function listMembers(
  teamId: string,
  pagination: PaginationParams = DEFAULT_PAGINATION
): PageResult<Member> {
  const total = (db
    .prepare("SELECT COUNT(*) AS total FROM memberships WHERE teamId = ?")
    .get(teamId) as { total: number }).total;
  const items = db
    .prepare(
      `SELECT u.id AS userId, u.name, u.email, m.role, m.joinedAt
       FROM memberships m JOIN users u ON u.id = m.userId
       WHERE m.teamId = ?
       ORDER BY m.joinedAt
       LIMIT ? OFFSET ?`
    )
    .all(teamId, pagination.limit, pagination.offset) as Member[];
  return { items, total };
}

export function findMember(teamId: string, userId: string): Member | undefined {
  return db
    .prepare(
      `SELECT u.id AS userId, u.name, u.email, m.role, m.joinedAt
       FROM memberships m JOIN users u ON u.id = m.userId
       WHERE m.teamId = ? AND m.userId = ?`
    )
    .get(teamId, userId) as Member | undefined;
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