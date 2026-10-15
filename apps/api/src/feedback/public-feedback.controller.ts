import {
  Body,
  Controller,
  Get,
  Param,
  Post,
} from "@nestjs/common";
import { SubmitFeedbackDto } from "./dto/submit-feedback.dto";
import { FeedbackService } from "./feedback.service";

@Controller("public/feedback")
export class PublicFeedbackController {
  constructor(
    private readonly feedback: FeedbackService,
  ) {}

  @Get(":token")
  get(@Param("token") token: string) {
    return this.feedback.getPublic(token);
  }

  @Post(":token")
  submit(
    @Param("token") token: string,
    @Body() dto: SubmitFeedbackDto,
  ) {
    return this.feedback.submitPublic(
      token,
      dto,
    );
  }
}
