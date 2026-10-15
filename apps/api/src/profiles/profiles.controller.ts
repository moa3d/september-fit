import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiKeyGuard } from "../auth/api-key.guard";
import type { AuthenticatedRequest } from "../auth/auth.types";
import { RequireScopes, ScopesGuard } from "../auth/scopes";
import { CreateProfileDto } from "./dto/create-profile.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { ProfilesService } from "./profiles.service";

@Controller("profiles")
@UseGuards(ApiKeyGuard, ScopesGuard)
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Post()
  @RequireScopes("profiles:write")
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateProfileDto) {
    return this.profiles.create(req.merchant.merchantId, dto);
  }

  @Get(":profileId")
  @RequireScopes("profiles:read")
  get(@Req() req: AuthenticatedRequest, @Param("profileId") profileId: string) {
    return this.profiles.get(req.merchant.merchantId, profileId);
  }

  @Patch(":profileId")
  @RequireScopes("profiles:write")
  update(
    @Req() req: AuthenticatedRequest,
    @Param("profileId") profileId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.profiles.update(req.merchant.merchantId, profileId, dto);
  }
}
