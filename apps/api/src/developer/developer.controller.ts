import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { MerchantSessionGuard } from "../merchant-auth/merchant-session.guard";
import type { DashboardRequest } from "../merchant-auth/merchant-auth.types";
import { MerchantRolesGuard, RequireMerchantRoles } from "../merchant-auth/merchant-roles";
import { CreateApiKeyDto } from "./dto/create-api-key.dto";
import { CreateOriginDto } from "./dto/create-origin.dto";
import { CreateWebhookDto } from "./dto/create-webhook.dto";
import { DeveloperService } from "./developer.service";
import { FeedbackService } from "../feedback/feedback.service";

@Controller("developer")
@UseGuards(MerchantSessionGuard, MerchantRolesGuard)
export class DeveloperController {
  constructor(
    private readonly developer: DeveloperService,
    private readonly feedback: FeedbackService,
  ) {}

  @Get("overview")
  @RequireMerchantRoles("OWNER", "ADMIN", "DEVELOPER", "ANALYST")
  overview(@Req() req: DashboardRequest) {
    return this.developer.overview(req.dashboardUser.merchantId);
  }

  @Get("api-keys")
  @RequireMerchantRoles("OWNER", "ADMIN", "DEVELOPER")
  listApiKeys(@Req() req: DashboardRequest) {
    return this.developer.listApiKeys(req.dashboardUser.merchantId);
  }

  @Post("api-keys")
  @RequireMerchantRoles("OWNER", "ADMIN", "DEVELOPER")
  createApiKey(
    @Req() req: DashboardRequest,
    @Body() dto: CreateApiKeyDto,
  ) {
    return this.developer.createApiKey(req.dashboardUser.merchantId, dto);
  }

  @Delete("api-keys/:id")
  @RequireMerchantRoles("OWNER", "ADMIN", "DEVELOPER")
  revokeApiKey(
    @Req() req: DashboardRequest,
    @Param("id") id: string,
  ) {
    return this.developer.revokeApiKey(req.dashboardUser.merchantId, id);
  }

  @Get("origins")
  @RequireMerchantRoles("OWNER", "ADMIN", "DEVELOPER")
  listOrigins(@Req() req: DashboardRequest) {
    return this.developer.listOrigins(req.dashboardUser.merchantId);
  }

  @Post("origins")
  @RequireMerchantRoles("OWNER", "ADMIN", "DEVELOPER")
  createOrigin(
    @Req() req: DashboardRequest,
    @Body() dto: CreateOriginDto,
  ) {
    return this.developer.createOrigin(req.dashboardUser.merchantId, dto);
  }

  @Delete("origins/:id")
  @RequireMerchantRoles("OWNER", "ADMIN", "DEVELOPER")
  deleteOrigin(
    @Req() req: DashboardRequest,
    @Param("id") id: string,
  ) {
    return this.developer.deleteOrigin(req.dashboardUser.merchantId, id);
  }

  @Get("webhooks")
  @RequireMerchantRoles("OWNER", "ADMIN", "DEVELOPER")
  listWebhooks(@Req() req: DashboardRequest) {
    return this.developer.listWebhooks(req.dashboardUser.merchantId);
  }

  @Post("webhooks")
  @RequireMerchantRoles("OWNER", "ADMIN", "DEVELOPER")
  createWebhook(
    @Req() req: DashboardRequest,
    @Body() dto: CreateWebhookDto,
  ) {
    return this.developer.createWebhook(req.dashboardUser.merchantId, dto);
  }

  @Delete("webhooks/:id")
  @RequireMerchantRoles("OWNER", "ADMIN", "DEVELOPER")
  disableWebhook(
    @Req() req: DashboardRequest,
    @Param("id") id: string,
  ) {
    return this.developer.disableWebhook(req.dashboardUser.merchantId, id);
  }


  @Get("webhook-deliveries")
  @RequireMerchantRoles("OWNER", "ADMIN", "DEVELOPER")
  webhookDeliveries(@Req() req: DashboardRequest) {
    return this.developer.listWebhookDeliveries(req.dashboardUser.merchantId);
  }

  @Get("feedback-analytics")
  @RequireMerchantRoles("OWNER", "ADMIN", "DEVELOPER", "ANALYST")
  feedbackAnalytics(@Req() req: DashboardRequest) {
    return this.feedback.analytics(
      req.dashboardUser.merchantId,
    );
  }

  @Get("request-logs")
  @RequireMerchantRoles("OWNER", "ADMIN", "DEVELOPER", "ANALYST")
  requestLogs(
    @Req() req: DashboardRequest,
    @Query("limit") limit?: string,
  ) {
    return this.developer.listRequestLogs(
      req.dashboardUser.merchantId,
      limit ? Number(limit) : 100,
    );
  }

  @Get("logs")
  @RequireMerchantRoles("OWNER", "ADMIN", "DEVELOPER", "ANALYST")
  logs(
    @Req() req: DashboardRequest,
    @Query("limit") limit?: string,
    @Query("event_type") eventType?: string,
  ) {
    return this.developer.listLogs(req.dashboardUser.merchantId, {
      limit: limit ? Number(limit) : 50,
      event_type: eventType,
    });
  }
}
