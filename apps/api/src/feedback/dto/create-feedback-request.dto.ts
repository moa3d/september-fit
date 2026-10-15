import {
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from "class-validator";

export class CreateFeedbackRequestDto {
  @IsOptional()
  @IsString()
  session_id?: string;

  @IsOptional()
  @IsString()
  result_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  external_order_id?: string;

  @IsOptional()
  @IsUrl({
    require_protocol: true,
    protocols: ["http", "https"],
  })
  return_url?: string;
}
