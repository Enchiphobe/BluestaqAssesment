import { ErrorRequestHandler, RequestHandler } from "express";
import { AppError } from "../errors";

export const notFound: RequestHandler = (req, res) => {
  res.status(404).json({ error: "Route not found" });
};

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err instanceof AppError) {
    res.status(err.status).json({
      error: err.message,
      ...(err.details && { details: err.details }),
    });
    return;
  }

  // Malformed JSON bodies and similar errors raised by express.json()
  if (err?.type === "entity.parse.failed") {
    res.status(400).json({ error: "Request body is not valid JSON" });
    return;
  }
  if (err?.type === "entity.too.large") {
    res.status(413).json({ error: "Request body too large" });
    return;
  }

  console.error(err);
  res.status(500).json({ error: "Internal server error" });
};
