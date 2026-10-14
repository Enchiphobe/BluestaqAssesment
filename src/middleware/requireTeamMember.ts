import { RequestHandler, Request } from "express";
import { ForbiddenError } from "../errors";
import * as teamsRepository from "../teams/teams.repository";
import { Membership } from "../types";
import { getUser } from "./authenticate";

/**
 * Answers one question: "is the caller in this team?"
 * Whether they may do a specific action is decided in the services.
 * Unknown teams get the same 403 as non-members, so team IDs can't be probed.
 */
export const requireTeamMember: RequestHandler = (req, res, next) => {
  const user = getUser(req);
  const membership = teamsRepository.getMembership(req.params.teamId as string, user.id);
  if (!membership) throw new ForbiddenError("You are not a member of this team");

  req.membership = membership;
  next();
};

/** Returns the caller's membership, or throws if requireTeamMember didn't run. */
export function getMembership(req: Request): Membership {
  if (!req.membership) throw new ForbiddenError("You are not a member of this team");
  return req.membership;
}
