import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { AuthenticatedRequest } from "./auth.types";
const SCOPES_KEY="september_fit_required_scopes";
export const RequireScopes=(...scopes:string[])=>SetMetadata(SCOPES_KEY,scopes);
@Injectable()
export class ScopesGuard implements CanActivate { constructor(private readonly reflector:Reflector){} canActivate(context:ExecutionContext){ const required=this.reflector.getAllAndOverride<string[]>(SCOPES_KEY,[context.getHandler(),context.getClass()])??[]; if(!required.length)return true; const request=context.switchToHttp().getRequest<AuthenticatedRequest>(); const granted=new Set(request.merchant?.scopes??[]); const missing=required.filter(s=>!granted.has(s)); if(missing.length)throw new ForbiddenException(`API key is missing required scope(s): ${missing.join(", ")}`); return true; } }
