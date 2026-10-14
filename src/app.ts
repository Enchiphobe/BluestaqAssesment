import express from "express";
import authRoutes from "./auth/auth.routes";
import usersRoutes from "./users/users.routes";
import teamsRoutes from "./teams/teams.routes";
import notesRoutes from "./notes/notes.routes";
import { authenticate } from "./middleware/authenticate";
import { requireTeamAccess } from "./middleware/requireTeamAccess";
import { errorHandler, notFound } from "./middleware/errorHandler";

const app = express();
app.use(express.json({ limit: "100kb" }));

// Public
app.get("/health", (req, res) => res.json({ status: "ok" }));
app.use("/auth", authRoutes);

// Everything below requires a valid login
app.use(authenticate);
app.use("/users", usersRoutes);
app.use("/teams", teamsRoutes);
// Notes live under a team, so access is checked before any note route runs
app.use("/teams/:teamId/notes", requireTeamAccess, notesRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;