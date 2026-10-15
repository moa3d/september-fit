import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { ApiKeyService } from "./api-key.service";
import type { AuthenticatedRequest } from "./auth.types";
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeys:ApiKeyService){}
  async canActivate(context:ExecutionContext){ const request=context.switchToHttp().getRequest<AuthenticatedRequest>(); const authorization=request.header("authorization"); if(!authorization?.startsWith("Bearer ")) throw new UnauthorizedException("Missing Authorization: Bearer <September Fit API key>."); request.merchant=await this.apiKeys.authenticate(authorization.slice(7).trim()); return true; }
}
