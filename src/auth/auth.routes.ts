import { Router } from "express";
import { authenticate, getUser } from "../middleware/authenticate";
import * as authService from "./auth.service";

const router = Router();

router.post("/register", async (req, res) => {
  const result = await authService.register(req.body ?? {});
  res.status(201).json(result);
});

router.post("/login", async (req, res) => {
  res.json(await authService.login(req.body ?? {}));
});

router.get("/me", authenticate, (req, res) => {
  res.json(getUser(req));
});

export default router;
