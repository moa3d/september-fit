import {
  Injectable,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES_PER_EMAIL = 8;
const MAX_FAILURES_PER_IP = 20;

@Injectable()
export class LoginThrottleService {
  constructor(private readonly prisma: PrismaService) {}

  private hash(value: string) {
    return createHash("sha256")
      .update(value.trim().toLowerCase())
      .digest("hex");
  }

  async assertAllowed(email: string, ip: string) {
    const since = new Date(Date.now() - WINDOW_MS);

    const [emailFailures, ipFailures] =
      await Promise.all([
        this.prisma.loginAttempt.count({
          where: {
            emailHash: this.hash(email),
            success: false,
            createdAt: { gte: since },
          },
        }),
        this.prisma.loginAttempt.count({
          where: {
            ipHash: this.hash(ip),
            success: false,
            createdAt: { gte: since },
          },
        }),
      ]);

    if (
      emailFailures >= MAX_FAILURES_PER_EMAIL ||
      ipFailures >= MAX_FAILURES_PER_IP
    ) {
      throw new HttpException(
        "Too many failed login attempts. Try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async record(
    email: string,
    ip: string,
    success: boolean,
  ) {
    await this.prisma.loginAttempt.create({
      data: {
        emailHash: this.hash(email),
        ipHash: this.hash(ip),
        success,
      },
    });
  }
}
