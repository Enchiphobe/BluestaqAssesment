import { RequestHandler, Request } from "express";
import { ForbiddenError, NotFoundError } from "../errors";
import * as teamsRepository from "../teams/teams.repository";
import { Membership } from "../types";
import { getUser } from "./authenticate";

/**
 * Answers one question: "may the caller open this team?"
 * Whether they may do a specific action is decided in the services.
 *
 * Admins may open any team. They get a synthesized manager membership, so every
 * service rule written as "managers can do X" covers admins with no special case.
 * Personal teams need no extra check: their only member is their owner (plus admins).
 *
 * Non-admins get the same 403 for unknown teams and teams they aren't in,
 * so team IDs can't be probed.
 */
export const requireTeamAccess: RequestHandler = (req, res, next) => {
  const user = getUser(req);
  const teamId = req.params.teamId as string;

  if (user.role === "admin") {
    if (!teamsRepository.findById(teamId)) throw new NotFoundError("Team not found");
    req.membership = { userId: user.id, teamId, role: "manager" };
    return next();
  }

  const membership = teamsRepository.getMembership(teamId, user.id);
  if (!membership) throw new ForbiddenError("You are not a member of this team");

  req.membership = membership;
  next();
};

/** Returns the caller's membership, or throws if requireTeamAccess didn't run. */
export function getMembership(req: Request): Membership {
  if (!req.membership) throw new ForbiddenError("You are not a member of this team");
  return req.membership;
}