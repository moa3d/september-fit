import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiKeyGuard } from "../auth/api-key.guard";
import type { AuthenticatedRequest } from "../auth/auth.types";
import { RequireScopes, ScopesGuard } from "../auth/scopes";
import { CreateFitSessionDto } from "./dto/create-fit-session.dto";
import { FitSessionsService } from "./fit-sessions.service";

@Controller("fit-sessions")
@UseGuards(ApiKeyGuard, ScopesGuard)
export class FitSessionsController {
  constructor(private readonly sessions: FitSessionsService) {}

  @Post()
  @RequireScopes("sessions:write")
  create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateFitSessionDto,
  ) {
    return this.sessions.create(req.merchant.merchantId, dto);
  }

  @Get(":sessionId")
  @RequireScopes("sessions:write")
  get(
    @Req() req: AuthenticatedRequest,
    @Param("sessionId") sessionId: string,
  ) {
    return this.sessions.get(req.merchant.merchantId, sessionId);
  }
}
