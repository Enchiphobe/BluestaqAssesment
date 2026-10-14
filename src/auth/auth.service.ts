import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import { BCRYPT_ROUNDS, JWT_EXPIRES_IN, JWT_SECRET } from "../config";
import { db } from "../db";
import { ConflictError, UnauthorizedError, ValidationError } from "../errors";
import * as teamsRepository from "../teams/teams.repository";
import * as usersRepository from "../users/users.repository";
import { User, UserWithHash } from "../types";

// Compared against when the email is unknown, so login takes the same time
// whether or not an account exists.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", BCRYPT_ROUNDS);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export async function register(input: {
  email?: unknown;
  password?: unknown;
  name?: unknown;
}): Promise<{ user: User; token: string }> {
  const errors: string[] = [];
  const { email, password, name } = input;

  if (typeof email !== "string" || !EMAIL_PATTERN.test(email.trim())) {
    errors.push("email must be a valid email address");
  }
  if (typeof password !== "string" || password.length < 8 || password.length > 200) {
    errors.push("password must be between 8 and 200 characters");
  }
  if (typeof name !== "string" || !name.trim() || name.trim().length > 100) {
    errors.push("name is required (max 100 characters)");
  }
  if (errors.length) throw new ValidationError(errors);

  const normalizedEmail = (email as string).trim().toLowerCase();
  if (usersRepository.findByEmail(normalizedEmail)) {
    throw new ConflictError("An account with that email already exists");
  }

  // The role is never read from the request, so nobody can self-register as an admin.
  const user: UserWithHash = {
    id: randomUUID(),
    email: normalizedEmail,
    name: (name as string).trim(),
    role: "user",
    passwordHash: await bcrypt.hash(password as string, BCRYPT_ROUNDS),
    createdAt: new Date().toISOString(),
  };

  // Every user gets a personal team. Both inserts succeed or neither does.
  db.transaction(() => {
    usersRepository.insert(user);
    teamsRepository.insertWithManager(
      {
        id: randomUUID(),
        name: "Personal",
        visibility: "personal",
        createdBy: user.id,
        createdAt: user.createdAt,
      },
      user.id
    );
  })();

  const { passwordHash, ...publicUser } = user;
  return { user: publicUser, token: signToken(user.id) };
}

export async function login(input: {
  email?: unknown;
  password?: unknown;
}): Promise<{ user: User; token: string }> {
  const { email, password } = input;
  if (typeof email !== "string" || typeof password !== "string") {
    throw new ValidationError(["email and password are required"]);
  }

  const found = usersRepository.findByEmail(email.trim().toLowerCase());
  const valid = await bcrypt.compare(password, found?.passwordHash ?? DUMMY_HASH);
  if (!found || !valid) throw new UnauthorizedError("Invalid email or password");

  const { passwordHash, ...publicUser } = found;
  return { user: publicUser, token: signToken(found.id) };
}