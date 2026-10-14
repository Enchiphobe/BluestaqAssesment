import { Router } from "express";
import { getMembership } from "../middleware/requireTeamAccess";
import { parsePagination, sendPaginated } from "../pagination";
import * as notesService from "./notes.service";

// Mounted at /teams/:teamId/notes, behind authenticate + requireTeamMember.
const router = Router({ mergeParams: true });

const asString = (value: unknown): string | undefined =>
  typeof value === "string" && value ? value : undefined;

// List notes. Optional filters: ?q=text  ?tag=work  ?pinned=true
router.get("/", (req, res) => {
  const { teamId } = getMembership(req);
  const pinned = asString(req.query.pinned);
  const q = asString(req.query.q);
  const tag = asString(req.query.tag);
  const pagination = parsePagination(req.query.page, req.query.limit);
  sendPaginated(
    res,
    notesService.list(teamId, {
      ...(q ? { q } : {}),
      ...(tag ? { tag } : {}),
      ...(pinned === undefined ? {} : { pinned: pinned === "true" }),
    }, pagination),
    pagination
  );
});

// Must be declared before "/:noteId" so "tags" isn't treated as an ID.
router.get("/tags", (req, res) => {
  res.json(notesService.listTags(getMembership(req).teamId));
});

router.post("/", (req, res) => {
  res.status(201).json(notesService.create(getMembership(req), req.body ?? {}));
});

router.get("/:noteId", (req, res) => {
  res.json(notesService.get(getMembership(req).teamId, req.params.noteId as string));
});

router.patch("/:noteId", (req, res) => {
  res.json(notesService.update(getMembership(req), req.params.noteId as string, req.body ?? {}));
});

router.delete("/:noteId", (req, res) => {
  notesService.remove(getMembership(req), req.params.noteId as string);
  res.status(204).end();
});

export default router;
