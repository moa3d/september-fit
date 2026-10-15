import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { PublicProfileDto } from "./dto/public-profile.dto";
import { PublicFitService } from "./public-fit.service";

@Controller("public/fit-sessions")
export class PublicFitController {
  constructor(private readonly publicFit: PublicFitService) {}

  @Get(":token")
  get(@Param("token") token: string) {
    return this.publicFit.getSession(token);
  }

  @Get(":token/embed-policy")
  embedPolicy(
    @Param("token") token: string,
    @Query("parent_origin") parentOrigin: string,
  ) {
    return this.publicFit.embedPolicy(
      token,
      parentOrigin,
    );
  }

  @Post(":token/profile")
  saveProfile(
    @Param("token") token: string,
    @Body() dto: PublicProfileDto,
  ) {
    return this.publicFit.saveProfile(token, dto);
  }

  @Post(":token/calculate")
  calculate(@Param("token") token: string) {
    return this.publicFit.calculate(token);
  }
}
