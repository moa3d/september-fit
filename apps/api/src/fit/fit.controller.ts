import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { ApiKeyGuard } from "../auth/api-key.guard";
import type { AuthenticatedRequest } from "../auth/auth.types";
import { RequireScopes, ScopesGuard } from "../auth/scopes";
import { CalculateFitDto } from "./dto/calculate-fit.dto";
import { FitService } from "./fit.service";
@Controller("fit")
@UseGuards(ApiKeyGuard,ScopesGuard)
export class FitController { constructor(private readonly fit:FitService){} @Post("calculate") @RequireScopes("fit:calculate") calculate(@Req() req:AuthenticatedRequest,@Body() dto:CalculateFitDto){return this.fit.calculate(req.merchant.merchantId,dto);} }
