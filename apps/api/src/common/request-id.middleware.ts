import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = req.header("x-request-id")?.trim() || `req_${randomUUID()}`;
  (req as Request & { requestId?: string }).requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  next();
}
