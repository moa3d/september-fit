import {
  Injectable,
  NestMiddleware,
} from "@nestjs/common";
import type {
  NextFunction,
  Request,
  Response,
} from "express";
import pino from "pino";

function sanitizePath(path: string) {
  return path
    .replace(
      /(\/v1\/public\/fit-sessions\/)[^/]+/,
      "$1:token",
    )
    .replace(
      /(\/v1\/public\/feedback\/)[^/]+/,
      "$1:token",
    );
}

const logger = pino({
  level:
    process.env.LOG_LEVEL ?? "info",
  transport:
    process.env.NODE_ENV === "production"
      ? undefined
      : {
          target: "pino-pretty",
        },
});

@Injectable()
export class StructuredLoggerMiddleware
  implements NestMiddleware
{
  use(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    const started = Date.now();

    res.on("finish", () => {
      logger.info({
        type: "http_request",
        method: req.method,
        path: sanitizePath(
          req.originalUrl.split("?")[0],
        ),
        status: res.statusCode,
        duration_ms:
          Date.now() - started,
        request_id:
          res.getHeader(
            "x-request-id",
          ) ?? null,
      });
    });

    next();
  }
}
