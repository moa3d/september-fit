import { IsArray, IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateApiKeyDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsIn(["TEST", "LIVE"])
  environment?: "TEST" | "LIVE";

  @IsArray()
  @IsString({ each: true })
  scopes!: string[];
}
