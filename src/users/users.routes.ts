import { Router } from "express";
import { getUser } from "../middleware/authenticate";
import { parsePagination, sendPaginated } from "../pagination";
import * as usersService from "./users.service";

const router = Router();

router.get("/", (req, res) => {
  const pagination = parsePagination(req.query.page, req.query.limit);
  sendPaginated(res, usersService.list(getUser(req), pagination), pagination);
});

router.patch("/:userId/role", (req, res) => {
  res.json(usersService.changeRole(getUser(req), req.params.userId as string, req.body?.role));
});

export default router;