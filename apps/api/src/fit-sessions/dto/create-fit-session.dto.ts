import {
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from "class-validator";

export class CreateFitSessionDto {
  @IsString()
  @MaxLength(255)
  external_product_id!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  external_customer_id?: string;

  @IsOptional()
  @IsString()
  profile_id?: string;

  @IsOptional()
  @IsUrl({
    require_protocol: true,
    protocols: ["http", "https"],
  })
  return_url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  locale?: string;
}
