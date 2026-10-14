import { db } from "../db";
import { GlobalRole, User, UserWithHash } from "../types";

export function findById(id: string): User | undefined {
  return db
    .prepare("SELECT id, email, name, role, createdAt FROM users WHERE id = ?")
    .get(id) as User | undefined;
}

export function findByEmail(email: string): UserWithHash | undefined {
  return db.prepare("SELECT * FROM users WHERE email = ?").get(email) as
    | UserWithHash
    | undefined;
}

export function listAll(): User[] {
  return db
    .prepare("SELECT id, email, name, role, createdAt FROM users ORDER BY createdAt")
    .all() as User[];
}

export function insert(user: UserWithHash): void {
  db.prepare(
    `INSERT INTO users (id, email, name, role, passwordHash, createdAt)
     VALUES (@id, @email, @name, @role, @passwordHash, @createdAt)`
  ).run(user);
}

export function updateRole(userId: string, role: GlobalRole): void {
  db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, userId);
}

export function countAdmins(): number {
  const row = db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'").get() as {
    count: number;
  };
  return row.count;
}