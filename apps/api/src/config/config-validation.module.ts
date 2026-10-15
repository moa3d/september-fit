import { Module } from "@nestjs/common";
import { EnvironmentValidationService } from "./environment-validation.service";

@Module({
  providers: [EnvironmentValidationService],
})
export class ConfigValidationModule {}
