import { IsUrl } from "class-validator";

export class CreateOriginDto {
  @IsUrl({
    require_protocol: true,
    protocols: ["http", "https"],
  })
  origin!: string;
}
