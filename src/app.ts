import express from "express";
import authRoutes from "./auth/auth.routes";
import teamsRoutes from "./teams/teams.routes";
import notesRoutes from "./notes/notes.routes";
import { authenticate } from "./middleware/authenticate";
import { requireTeamMember } from "./middleware/requireTeamMember";
import { errorHandler, notFound } from "./middleware/errorHandler";

const app = express();
app.use(express.json({ limit: "100kb" }));

// Public
app.get("/health", (req, res) => res.json({ status: "ok" }));
app.use("/auth", authRoutes);

// Everything below requires a valid login
app.use(authenticate);
app.use("/teams", teamsRoutes);
// Notes live under a team, so membership is checked before any note route runs
app.use("/teams/:teamId/notes", requireTeamMember, notesRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
