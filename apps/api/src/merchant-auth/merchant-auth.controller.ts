import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { LoginDto } from "./dto/login.dto";
import { MerchantAuthService } from "./merchant-auth.service";

@Controller("auth")
export class MerchantAuthController {
  constructor(
    private readonly auth: MerchantAuthService,
  ) {}

  @Post("login")
  login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.auth.login(dto, request, response);
  }

  @Get("me")
  me(@Req() request: Request) {
    return this.auth.me(request);
  }

  @Post("logout")
  logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.auth.logout(request, response);
  }
}
