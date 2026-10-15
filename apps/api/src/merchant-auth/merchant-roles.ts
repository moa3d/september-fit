import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type {
  DashboardRequest,
  DashboardRole,
} from "./merchant-auth.types";

const ROLES_KEY = "september_fit_dashboard_roles";

export const RequireMerchantRoles = (
  ...roles: DashboardRole[]
) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class MerchantRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const required =
      this.reflector.getAllAndOverride<DashboardRole[]>(
        ROLES_KEY,
        [
          context.getHandler(),
          context.getClass(),
        ],
      ) ?? [];

    if (required.length === 0) return true;

    const request =
      context.switchToHttp().getRequest<DashboardRequest>();

    if (!required.includes(request.dashboardUser.role)) {
      throw new ForbiddenException(
        `Role ${request.dashboardUser.role} cannot access this resource.`,
      );
    }

    return true;
  }
}
