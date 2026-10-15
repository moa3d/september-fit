import {
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { PrismaService } from "../prisma/prisma.service";
import { verifyPassword } from "./password.crypto";
import { MerchantSessionService } from "./merchant-session.service";
import type { LoginDto } from "./dto/login.dto";
import { LoginThrottleService } from "../security/login-throttle.service";

@Injectable()
export class MerchantAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: MerchantSessionService,
    private readonly loginThrottle: LoginThrottleService,
  ) {}

  async login(
    dto: LoginDto,
    request: Request,
    response: Response,
  ) {
    this.assertDashboardOrigin(request);

    const normalizedEmail = dto.email.trim().toLowerCase();

    const forwarded = request.header("x-forwarded-for");
    const ip =
      forwarded?.split(",")[0]?.trim() ??
      request.socket.remoteAddress ??
      "unknown";

    await this.loginThrottle.assertAllowed(
      normalizedEmail,
      ip,
    );

    const users = await this.prisma.merchantUser.findMany({
      where: {
        email: normalizedEmail,
        disabledAt: null,
        merchant: {
          status: "ACTIVE",
        },
      },
      include: {
        merchant: true,
      },
      take: 5,
    });

    const matchingUsers = users.filter(
      (candidate) =>
        candidate.passwordHash &&
        verifyPassword(dto.password, candidate.passwordHash),
    );

    if (matchingUsers.length > 1) {
      throw new UnauthorizedException(
        "This account belongs to multiple workspaces, which is not supported in V1.",
      );
    }

    const user = matchingUsers[0];

    if (!user) {
      await this.loginThrottle.record(
        normalizedEmail,
        ip,
        false,
      );

      throw new UnauthorizedException(
        "Invalid email or password.",
      );
    }

    const { expiresAt } =
      await this.sessions.createSession({
        merchantId: user.merchantId,
        userId: user.id,
        request,
        response,
      });

    await this.prisma.merchantUser.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        merchantId: user.merchantId,
        actorType: "merchant_user",
        actorId: user.id,
        action: "auth.login",
        objectType: "merchant_user",
        objectId: user.id,
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      merchant: {
        id: user.merchant.publicId,
        name: user.merchant.name,
      },
      expires_at: expiresAt,
    };
  }

  async me(request: Request) {
    const principal =
      await this.sessions.authenticateRequest(request);

    return {
      user: {
        id: principal.userId,
        email: principal.email,
        role: principal.role,
      },
      merchant: {
        id: principal.merchantPublicId,
        name: principal.merchantName,
      },
    };
  }

  async logout(request: Request, response: Response) {
    await this.sessions.revokeCurrent(request, response);
    return { logged_out: true };
  }

  private assertDashboardOrigin(
    request: Request,
  ) {
    const origin = request.header("origin");
    const allowed = (
      process.env.DASHBOARD_ORIGINS ??
      "http://localhost:3002"
    )
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    if (!origin || !allowed.includes(origin)) {
      throw new UnauthorizedException(
        "Login request origin is not allowed.",
      );
    }
  }

}
