import {
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import {
  createHash,
  randomBytes,
} from "node:crypto";
import type { Request, Response } from "express";
import { PrismaService } from "../prisma/prisma.service";

const COOKIE_NAME = "september_fit_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class MerchantSessionService {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(input: {
    merchantId: string;
    userId: string;
    request: Request;
    response: Response;
  }) {
    const rawToken = `ms_${randomBytes(32).toString("base64url")}`;
    const tokenHash = this.hashToken(rawToken);

    const forwarded = input.request.header("x-forwarded-for");
    const ip =
      forwarded?.split(",")[0]?.trim() ??
      input.request.socket.remoteAddress ??
      "";

    const ipHash = ip
      ? createHash("sha256").update(ip).digest("hex")
      : null;

    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    await this.prisma.merchantSession.create({
      data: {
        merchantId: input.merchantId,
        userId: input.userId,
        tokenHash,
        expiresAt,
        ipHash,
        userAgent: input.request.header("user-agent") ?? null,
      },
    });

    input.response.cookie(COOKIE_NAME, rawToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_TTL_MS,
      path: "/",
      ...(process.env.DASHBOARD_COOKIE_DOMAIN
        ? { domain: process.env.DASHBOARD_COOKIE_DOMAIN }
        : {}),
    });

    return { expiresAt };
  }

  async authenticateRequest(request: Request) {
    const rawToken = request.cookies?.[COOKIE_NAME];

    if (!rawToken || typeof rawToken !== "string") {
      throw new UnauthorizedException("Dashboard session required.");
    }

    const session = await this.prisma.merchantSession.findUnique({
      where: {
        tokenHash: this.hashToken(rawToken),
      },
      include: {
        merchant: true,
        user: true,
      },
    });

    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      session.user.disabledAt ||
      session.merchant.status !== "ACTIVE"
    ) {
      throw new UnauthorizedException(
        "Dashboard session is invalid or expired.",
      );
    }

    return {
      sessionId: session.id,
      merchantId: session.merchantId,
      merchantPublicId: session.merchant.publicId,
      merchantName: session.merchant.name,
      userId: session.userId,
      email: session.user.email,
      role: session.user.role,
    };
  }

  async revokeCurrent(request: Request, response: Response) {
    const rawToken = request.cookies?.[COOKIE_NAME];

    if (rawToken && typeof rawToken === "string") {
      await this.prisma.merchantSession.updateMany({
        where: {
          tokenHash: this.hashToken(rawToken),
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });
    }

    response.clearCookie(COOKIE_NAME, {
      path: "/",
      ...(process.env.DASHBOARD_COOKIE_DOMAIN
        ? { domain: process.env.DASHBOARD_COOKIE_DOMAIN }
        : {}),
    });
  }

  private hashToken(raw: string) {
    return createHash("sha256").update(raw).digest("hex");
  }
}
