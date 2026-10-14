import type { Response } from "express";
import { ValidationError } from "./errors";

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export interface PageResult<T> {
  items: T[];
  total: number;
}

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGINATION: PaginationParams = {
  page: 1,
  limit: DEFAULT_PAGE_SIZE,
  offset: 0,
};

function parsePositiveInteger(value: unknown, fallback: number, name: string): number {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    throw new ValidationError([`${name} must be a positive integer`]);
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new ValidationError([`${name} must be a safe integer`]);
  }
  return parsed;
}

export function parsePagination(pageInput: unknown, limitInput: unknown): PaginationParams {
  const page = parsePositiveInteger(pageInput, 1, "page");
  const limit = parsePositiveInteger(limitInput, DEFAULT_PAGE_SIZE, "limit");
  if (limit > MAX_PAGE_SIZE) {
    throw new ValidationError([`limit must not exceed ${MAX_PAGE_SIZE}`]);
  }

  const offset = (page - 1) * limit;
  if (!Number.isSafeInteger(offset)) {
    throw new ValidationError(["page is too large"]);
  }

  return { page, limit, offset };
}

export function sendPaginated<T>(
  res: Response,
  result: PageResult<T>,
  pagination: PaginationParams
): void {
  res.set({
    "X-Page": String(pagination.page),
    "X-Page-Size": String(pagination.limit),
    "X-Total-Count": String(result.total),
    "X-Total-Pages": String(Math.ceil(result.total / pagination.limit)),
  });
  res.json(result.items);
}