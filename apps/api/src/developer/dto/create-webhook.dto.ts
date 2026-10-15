import { IsArray, IsIn, IsString, IsUrl } from "class-validator";

export class CreateWebhookDto {
  @IsUrl({
    require_protocol: true,
    protocols: ["http", "https"],
  })
  url!: string;

  @IsArray()
  @IsString({ each: true })
  events!: string[];

  @IsIn(["TEST", "LIVE"])
  environment!: "TEST" | "LIVE";
}
