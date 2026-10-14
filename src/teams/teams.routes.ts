import { Router } from "express";
import { getUser } from "../middleware/authenticate";
import { getMembership, requireTeamAccess } from "../middleware/requireTeamAccess";
import { parsePagination, sendPaginated } from "../pagination";
import * as teamsService from "./teams.service";

const router = Router();

// Create a team. Body: { name, visibility?: "public" | "private" } (default private)
router.post("/", (req, res) => {
  res.status(201).json(teamsService.create(getUser(req), req.body ?? {}));
});

// My teams. Admins can pass ?all=true to list every team.
router.get("/", (req, res) => {
  const user = getUser(req);
  const pagination = parsePagination(req.query.page, req.query.limit);
  const result = req.query.all === "true"
    ? teamsService.listAll(user, pagination)
    : teamsService.listForUser(user, pagination);
  sendPaginated(res, result, pagination);
});

// Public teams I haven't joined. Must be declared before "/:teamId".
router.get("/public", (req, res) => {
  const pagination = parsePagination(req.query.page, req.query.limit);
  sendPaginated(res, teamsService.listPublic(getUser(req), pagination), pagination);
});

// Join a public team. Deliberately has no requireTeamAccess: you aren't a member yet.
router.post("/:teamId/join", (req, res) => {
  teamsService.join(getUser(req), req.params.teamId as string);
  res.status(204).end();
});

router.get("/:teamId/members", requireTeamAccess, (req, res) => {
  const pagination = parsePagination(req.query.page, req.query.limit);
  sendPaginated(res, teamsService.listMembers(getMembership(req), pagination), pagination);
});

router.get("/:teamId", requireTeamAccess, (req, res) => {
  res.json(teamsService.get(getMembership(req)));
});

router.patch("/:teamId", requireTeamAccess, (req, res) => {
  res.json(teamsService.update(getMembership(req), req.body ?? {}));
});

router.delete("/:teamId", requireTeamAccess, (req, res) => {
  teamsService.remove(getMembership(req));
  res.status(204).end();
});

router.post("/:teamId/members", requireTeamAccess, (req, res) => {
  const member = teamsService.addMember(getMembership(req), req.body?.email, req.body?.role);
  res.status(201).json(member);
});

router.patch("/:teamId/members/:userId", requireTeamAccess, (req, res) => {
  teamsService.changeRole(getMembership(req), req.params.userId as string, req.body?.role);
  res.status(204).end();
});

router.delete("/:teamId/members/:userId", requireTeamAccess, (req, res) => {
  teamsService.removeMember(getMembership(req), req.params.userId as string);
  res.status(204).end();
});

export default router;