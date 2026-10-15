import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import type { Request, Response } from "express";
import { Observable, tap } from "rxjs";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedRequest } from "../auth/auth.types";
import type { DashboardRequest } from "../merchant-auth/merchant-auth.types";

function hashIp(req: Request) {
  const forwarded = req.header("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ??
    req.socket.remoteAddress ??
    "";

  return ip
    ? createHash("sha256").update(ip).digest("hex")
    : null;
}


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

@Injectable()
export class RequestLogInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const started = Date.now();

    const req = context.switchToHttp().getRequest<
      Request &
        Partial<AuthenticatedRequest> &
        Partial<DashboardRequest> & {
          requestId?: string;
        }
    >();

    const res = context.switchToHttp().getResponse<Response>();

    const route = sanitizePath(
      req.route?.path
        ? `${req.baseUrl ?? ""}${req.route.path}`
        : req.originalUrl.split("?")[0],
    );

    const requestId =
      req.requestId ?? req.header("x-request-id") ?? "unknown";

    const merchantId =
      req.merchant?.merchantId ??
      req.dashboardUser?.merchantId ??
      null;

    const apiKeyId =
      req.merchant?.apiKeyId ?? null;

    const userId =
      req.dashboardUser?.userId ?? null;

    const authKind = req.merchant
      ? "API_KEY"
      : req.dashboardUser
        ? "DASHBOARD_SESSION"
        : "PUBLIC";

    const persist = (
      statusCode: number,
      errorCode?: string | null,
    ) => {
      const durationMs = Date.now() - started;

      void this.prisma.apiRequestLog.create({
        data: {
          requestId,
          merchantId,
          apiKeyId,
          userId,
          authKind,
          method: req.method,
          route,
          statusCode,
          durationMs,
          errorCode: errorCode ?? null,
          ipHash: hashIp(req),
          userAgent: req.header("user-agent") ?? null,
        },
      });
    };

    return next.handle().pipe(
      tap({
        next: () => persist(res.statusCode),
        error: (error) =>
          persist(
            error?.status ?? 500,
            error?.response?.code ??
              error?.response?.error?.code ??
              error?.name ??
              "INTERNAL_ERROR",
          ),
      }),
    );
  }
}
