import { Router } from "express";
import { getUser } from "../middleware/authenticate";
import { getMembership, requireTeamMember } from "../middleware/requireTeamMember";
import * as teamsService from "./teams.service";

const router = Router();

router.post("/", (req, res) => {
  res.status(201).json(teamsService.create(getUser(req), req.body?.name));
});

router.get("/", (req, res) => {
  res.json(teamsService.listForUser(getUser(req)));
});

router.post("/join", (req, res) => {
  res.json(teamsService.joinByCode(getUser(req), req.body?.joinCode));
});

router.get("/:teamId", requireTeamMember, (req, res) => {
  res.json(teamsService.get(getMembership(req)));
});

router.delete("/:teamId", requireTeamMember, (req, res) => {
  teamsService.remove(getMembership(req));
  res.status(204).end();
});

router.post("/:teamId/join-code", requireTeamMember, (req, res) => {
  res.json(teamsService.regenerateJoinCode(getMembership(req)));
});

router.post("/:teamId/members", requireTeamMember, (req, res) => {
  const member = teamsService.addMember(getMembership(req), req.body?.email, req.body?.role);
  res.status(201).json(member);
});

router.patch("/:teamId/members/:userId", requireTeamMember, (req, res) => {
  teamsService.changeRole(getMembership(req), req.params.userId as string, req.body?.role);
  res.status(204).end();
});

router.delete("/:teamId/members/:userId", requireTeamMember, (req, res) => {
  teamsService.removeMember(getMembership(req), req.params.userId as string);
  res.status(204).end();
});

export default router;
