import {
  CanActivate,
  ExecutionContext,
  Injectable,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import type { Request, Response } from "express";
import { RateLimitService } from "./rate-limit.service";

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly limits: RateLimitService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const req =
      context.switchToHttp().getRequest<Request>();
    const res =
      context.switchToHttp().getResponse<Response>();

    const path = req.originalUrl.split("?")[0];

    if (req.method === "OPTIONS") {
      return true;
    }

    if (
      path.startsWith("/v1/health") ||
      path ===
        "/v1/billing/provider/stripe/webhook"
    ) {
      return true;
    }

    const ip =
      req.header("x-forwarded-for")
        ?.split(",")[0]
        ?.trim() ??
      req.socket.remoteAddress ??
      "unknown";

    const ipHash = createHash("sha256")
      .update(ip)
      .digest("hex");

    const authorization =
      req.header("authorization") ?? "";

    const hasApiCredential =
      authorization.startsWith("Bearer sk_");

    const dashboardPath = [
      "/v1/developer",
      "/v1/billing",
      "/v1/team",
      "/v1/account",
    ].some((prefix) =>
      path.startsWith(prefix),
    );

    const sessionCookie = dashboardPath
      ? req
          .header("cookie")
          ?.match(
            /(?:^|;\s*)september_fit_session=([^;]+)/,
          )?.[1]
      : undefined;

    const publicTokenMatch = path.match(
      /^\/v1\/public\/(?:fit-sessions|feedback)\/([^/]+)/,
    );

    // Always enforce an IP ceiling first so an attacker cannot
    // bypass rate limiting simply by inventing many fake API keys.
    // Tokenized hosted flows get a higher shared-IP ceiling because
    // many legitimate users may sit behind the same NAT.
    const isLogin =
      path === "/v1/auth/login";
    const isPasswordResetRequest =
      path ===
      "/v1/auth/request-password-reset";

    const ipLimit =
      hasApiCredential || sessionCookie
        ? 600
        : isPasswordResetRequest
        ? 10
        : isLogin
          ? 30
          : publicTokenMatch
            ? 1000
            : 120;

    const ipResult = await this.limits.consume(
      `ip:${ipHash}`,
      ipLimit,
      60_000,
    );

    if (!ipResult.allowed) {
      res.setHeader(
        "Retry-After",
        String(ipResult.retryAfterSeconds),
      );
      throw new HttpException(
        "Rate limit exceeded.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (
      !hasApiCredential &&
      sessionCookie
    ) {
      const sessionHash = createHash("sha256")
        .update(sessionCookie)
        .digest("hex");

      const sessionLimit = 300;
      const sessionResult =
        await this.limits.consume(
          `dashboard-session:${sessionHash}`,
          sessionLimit,
          60_000,
        );

      res.setHeader(
        "X-RateLimit-Limit",
        String(sessionLimit),
      );
      res.setHeader(
        "X-RateLimit-Remaining",
        String(sessionResult.remaining),
      );

      if (!sessionResult.allowed) {
        res.setHeader(
          "Retry-After",
          String(
            sessionResult.retryAfterSeconds,
          ),
        );
        throw new HttpException(
          "Rate limit exceeded.",
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      return true;
    }

    if (!hasApiCredential) {
      if (publicTokenMatch) {
        const tokenHash = createHash("sha256")
          .update(publicTokenMatch[1])
          .digest("hex");

        const tokenLimit =
          path.endsWith("/embed-policy")
            ? 120
            : 60;

        const tokenResult =
          await this.limits.consume(
            `public-token:${tokenHash}`,
            tokenLimit,
            60_000,
          );

        res.setHeader(
          "X-RateLimit-Limit",
          String(tokenLimit),
        );
        res.setHeader(
          "X-RateLimit-Remaining",
          String(tokenResult.remaining),
        );

        if (!tokenResult.allowed) {
          res.setHeader(
            "Retry-After",
            String(
              tokenResult.retryAfterSeconds,
            ),
          );
          throw new HttpException(
            "Rate limit exceeded.",
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }

        return true;
      }

      res.setHeader(
        "X-RateLimit-Limit",
        String(ipLimit),
      );
      res.setHeader(
        "X-RateLimit-Remaining",
        String(ipResult.remaining),
      );
      return true;
    }

    const credentialHash = createHash("sha256")
      .update(authorization)
      .digest("hex");

    const credentialLimit =
      path.includes("/fit/calculate") ||
      path.includes("/fit-sessions")
        ? 120
        : 300;

    const credentialResult =
      await this.limits.consume(
        `credential:${credentialHash}`,
        credentialLimit,
        60_000,
      );

    res.setHeader(
      "X-RateLimit-Limit",
      String(credentialLimit),
    );
    res.setHeader(
      "X-RateLimit-Remaining",
      String(credentialResult.remaining),
    );

    if (!credentialResult.allowed) {
      res.setHeader(
        "Retry-After",
        String(
          credentialResult.retryAfterSeconds,
        ),
      );
      throw new HttpException(
        "Rate limit exceeded.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
