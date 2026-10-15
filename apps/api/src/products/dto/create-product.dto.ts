import {
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class CreateProductDto {
  @IsString()
  @MaxLength(255)
  external_product_id!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  sku?: string;

  @IsString()
  @MaxLength(500)
  name!: string;

  @IsIn([
    "JACKET",
    "HOODIE",
    "SHIRT",
    "TSHIRT",
    "PANTS",
    "JEANS",
  ])
  category!:
    | "JACKET"
    | "HOODIE"
    | "SHIRT"
    | "TSHIRT"
    | "PANTS"
    | "JEANS";

  @IsOptional()
  @IsString()
  @MaxLength(255)
  brand?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  original_size_label?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
