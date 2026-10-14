import { Router } from "express";
import { getUser } from "../middleware/authenticate";
import * as usersService from "./users.service";

const router = Router();

router.get("/", (req, res) => {
  res.json(usersService.list(getUser(req)));
});

router.patch("/:userId/role", (req, res) => {
  res.json(usersService.changeRole(getUser(req), req.params.userId as string, req.body?.role));
});

export default router;