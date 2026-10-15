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
import { CreateFeedbackRequestDto } from "./dto/create-feedback-request.dto";
import { FeedbackService } from "./feedback.service";

@Controller("feedback-requests")
@UseGuards(ApiKeyGuard, ScopesGuard)
export class FeedbackController {
  constructor(
    private readonly feedback: FeedbackService,
  ) {}

  @Post()
  @RequireScopes("feedback:write")
  create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateFeedbackRequestDto,
  ) {
    return this.feedback.createRequest(
      req.merchant.merchantId,
      dto,
    );
  }

  @Get(":requestId")
  @RequireScopes("feedback:write")
  get(
    @Req() req: AuthenticatedRequest,
    @Param("requestId") requestId: string,
  ) {
    return this.feedback.getRequest(
      req.merchant.merchantId,
      requestId,
    );
  }
}
