import { RequestHandler, Request } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config";
import { UnauthorizedError } from "../errors";
import * as usersRepository from "../users/users.repository";
import { User } from "../types";

export const authenticate: RequestHandler = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    throw new UnauthorizedError("Missing Authorization: Bearer <token> header");
  }

  let userId: string;
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    if (typeof payload === "string" || typeof payload.sub !== "string") {
      throw new Error("bad payload");
    }
    userId = payload.sub;
  } catch {
    throw new UnauthorizedError("Invalid or expired token");
  }

  // Load the user on every request so deleted accounts lose access immediately.
  const user = usersRepository.findById(userId);
  if (!user) throw new UnauthorizedError("User no longer exists");

  req.user = user;
  next();
};

/** Returns the authenticated user, or throws if authenticate didn't run. */
export function getUser(req: Request): User {
  if (!req.user) throw new UnauthorizedError();
  return req.user;
}
