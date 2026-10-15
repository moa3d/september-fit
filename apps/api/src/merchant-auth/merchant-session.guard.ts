import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { MerchantSessionService } from "./merchant-session.service";
import type { DashboardRequest } from "./merchant-auth.types";

@Injectable()
export class MerchantSessionGuard implements CanActivate {
  constructor(
    private readonly sessions: MerchantSessionService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request =
      context.switchToHttp().getRequest<DashboardRequest>();

    const method = request.method.toUpperCase();
    if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
      const origin = request.header("origin");
      const allowed = (
        process.env.DASHBOARD_ORIGINS ??
        "http://localhost:3002"
      )
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);

      if (!origin || !allowed.includes(origin)) {
        throw new ForbiddenException(
          "Invalid dashboard request origin.",
        );
      }
    }

    request.dashboardUser =
      await this.sessions.authenticateRequest(request);

    return true;
  }
}
