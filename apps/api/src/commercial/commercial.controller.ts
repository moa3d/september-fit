import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Req,
  UseGuards,
  BadRequestException,
  RawBodyRequest,
} from "@nestjs/common";
import type { Request } from "express";
import {
  MerchantRolesGuard,
  RequireMerchantRoles,
} from "../merchant-auth/merchant-roles";
import { MerchantSessionGuard } from "../merchant-auth/merchant-session.guard";
import type { DashboardRequest } from "../merchant-auth/merchant-auth.types";
import { MeteringService } from "./metering.service";
import { OnboardingService } from "./onboarding.service";
import { SubscriptionService } from "./subscription.service";
import { RequestPlanChangeDto } from "./dto/request-plan-change.dto";
import { CreateCheckoutDto } from "./dto/create-checkout.dto";
import { StripeBillingService } from "./stripe-billing.service";

@Controller()
export class CommercialController {
  constructor(
    private readonly subscriptions: SubscriptionService,
    private readonly metering: MeteringService,
    private readonly onboarding: OnboardingService,
    private readonly stripe: StripeBillingService,
  ) {}

  @Get("plans")
  plans() {
    return this.subscriptions.listPlans();
  }

  @Get("billing/overview")
  @UseGuards(
    MerchantSessionGuard,
    MerchantRolesGuard,
  )
  @RequireMerchantRoles(
    "OWNER",
    "ADMIN",
    "DEVELOPER",
    "ANALYST",
  )
  async billingOverview(
    @Req() req: DashboardRequest,
  ) {
    const merchantId =
      req.dashboardUser.merchantId;

    const [
      subscription,
      usage,
      plans,
      changeRequests,
    ] = await Promise.all([
      this.subscriptions.getSubscriptionSummary(
        merchantId,
      ),
      this.metering.summary(merchantId),
      this.subscriptions.listPlans(),
      this.subscriptions.listPlanChangeRequests(
        merchantId,
      ),
    ]);

    return {
      subscription,
      usage,
      plans,
      change_requests:
        changeRequests.data,
    };
  }

  @Get("billing/subscription")
  @UseGuards(
    MerchantSessionGuard,
    MerchantRolesGuard,
  )
  @RequireMerchantRoles(
    "OWNER",
    "ADMIN",
    "DEVELOPER",
    "ANALYST",
  )
  subscription(@Req() req: DashboardRequest) {
    return this.subscriptions.getSubscriptionSummary(
      req.dashboardUser.merchantId,
    );
  }

  @Get("billing/usage")
  @UseGuards(
    MerchantSessionGuard,
    MerchantRolesGuard,
  )
  @RequireMerchantRoles(
    "OWNER",
    "ADMIN",
    "DEVELOPER",
    "ANALYST",
  )
  usage(@Req() req: DashboardRequest) {
    return this.metering.summary(
      req.dashboardUser.merchantId,
    );
  }

  @Get("billing/plan-change-requests")
  @UseGuards(
    MerchantSessionGuard,
    MerchantRolesGuard,
  )
  @RequireMerchantRoles("OWNER", "ADMIN")
  changeRequests(@Req() req: DashboardRequest) {
    return this.subscriptions.listPlanChangeRequests(
      req.dashboardUser.merchantId,
    );
  }

  @Post("billing/plan-change-requests")
  @UseGuards(
    MerchantSessionGuard,
    MerchantRolesGuard,
  )
  @RequireMerchantRoles("OWNER", "ADMIN")
  requestPlanChange(
    @Req() req: DashboardRequest,
    @Body() dto: RequestPlanChangeDto,
  ) {
    return this.subscriptions.requestPlanChange(
      req.dashboardUser.merchantId,
      req.dashboardUser.userId,
      dto.plan_code,
    );
  }


  @Post("billing/checkout")
  @UseGuards(
    MerchantSessionGuard,
    MerchantRolesGuard,
  )
  @RequireMerchantRoles("OWNER", "ADMIN")
  checkout(
    @Req() req: DashboardRequest,
    @Body() dto: CreateCheckoutDto,
  ) {
    return this.stripe.createCheckout(
      req.dashboardUser.merchantId,
      req.dashboardUser.userId,
      dto.plan_code,
    );
  }

  @Post("billing/portal")
  @UseGuards(
    MerchantSessionGuard,
    MerchantRolesGuard,
  )
  @RequireMerchantRoles("OWNER", "ADMIN")
  portal(@Req() req: DashboardRequest) {
    return this.stripe.createPortal(
      req.dashboardUser.merchantId,
    );
  }

  @Get("billing/invoices")
  @UseGuards(
    MerchantSessionGuard,
    MerchantRolesGuard,
  )
  @RequireMerchantRoles(
    "OWNER",
    "ADMIN",
    "ANALYST",
  )
  invoices(@Req() req: DashboardRequest) {
    return this.stripe.listInvoices(
      req.dashboardUser.merchantId,
    );
  }

  @Post("billing/provider/stripe/webhook")
  async stripeWebhook(
    @Req()
    req: RawBodyRequest<Request>,
    @Headers("stripe-signature")
    signature?: string,
  ) {
    if (!signature || !req.rawBody) {
      throw new BadRequestException(
        "Stripe signature or raw body is missing.",
      );
    }

    const event =
      this.stripe.constructEvent(
        req.rawBody,
        signature,
      );

    return this.stripe.processEvent(event);
  }

  @Get("billing/onboarding")
  @UseGuards(
    MerchantSessionGuard,
    MerchantRolesGuard,
  )
  @RequireMerchantRoles(
    "OWNER",
    "ADMIN",
    "DEVELOPER",
    "ANALYST",
  )
  onboardingStatus(@Req() req: DashboardRequest) {
    return this.onboarding.status(
      req.dashboardUser.merchantId,
    );
  }

  @Post("billing/onboarding/complete")
  @UseGuards(
    MerchantSessionGuard,
    MerchantRolesGuard,
  )
  @RequireMerchantRoles("OWNER", "ADMIN")
  onboardingComplete(@Req() req: DashboardRequest) {
    return this.onboarding.complete(
      req.dashboardUser.merchantId,
    );
  }
}
