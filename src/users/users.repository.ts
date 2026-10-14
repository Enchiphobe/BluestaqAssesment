import { db } from "../db";
import { User, UserWithHash } from "../types";

export function findById(id: string): User | undefined {
  return db
    .prepare("SELECT id, email, name, createdAt FROM users WHERE id = ?")
    .get(id) as User | undefined;
}

export function findByEmail(email: string): UserWithHash | undefined {
  return db.prepare("SELECT * FROM users WHERE email = ?").get(email) as
    | UserWithHash
    | undefined;
}

export function insert(user: UserWithHash): void {
  db.prepare(
    `INSERT INTO users (id, email, name, passwordHash, createdAt)
     VALUES (@id, @email, @name, @passwordHash, @createdAt)`
  ).run(user);
}
