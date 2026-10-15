import {
  Controller,
  Delete,
  Param,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiKeyGuard } from "../auth/api-key.guard";
import type { AuthenticatedRequest } from "../auth/auth.types";
import {
  RequireScopes,
  ScopesGuard,
} from "../auth/scopes";
import { PrivacyService } from "./privacy.service";

@Controller("privacy")
@UseGuards(ApiKeyGuard, ScopesGuard)
export class PrivacyController {
  constructor(
    private readonly privacy: PrivacyService,
  ) {}

  @Delete("customers/:externalCustomerId")
  @RequireScopes("profiles:write")
  eraseCustomer(
    @Req() req: AuthenticatedRequest,
    @Param("externalCustomerId")
    externalCustomerId: string,
  ) {
    return this.privacy.eraseCustomer(
      req.merchant.merchantId,
      externalCustomerId,
    );
  }
}
