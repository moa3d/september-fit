import {
  IsIn,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from "class-validator";

export class PublicProfileDto {
  @IsIn(["MENS", "WOMENS", "UNISEX"])
  profile_type!: "MENS" | "WOMENS" | "UNISEX";

  @IsIn(["SLIM", "REGULAR", "LOOSE"])
  preferred_fit!: "SLIM" | "REGULAR" | "LOOSE";

  @IsOptional() @IsNumber() @Min(80) @Max(250)
  height_cm?: number;

  @IsOptional() @IsNumber() @Min(20) @Max(350)
  weight_kg?: number;

  @IsOptional() @IsNumber() @Min(30) @Max(250)
  chest_cm?: number;

  @IsOptional() @IsNumber() @Min(30) @Max(250)
  waist_cm?: number;

  @IsOptional() @IsNumber() @Min(30) @Max(250)
  hips_cm?: number;

  @IsOptional() @IsNumber() @Min(20) @Max(100)
  shoulder_cm?: number;

  @IsOptional() @IsNumber() @Min(20) @Max(120)
  sleeve_cm?: number;

  @IsOptional() @IsNumber() @Min(20) @Max(150)
  inseam_cm?: number;

  @IsOptional() @IsNumber() @Min(20) @Max(150)
  thigh_cm?: number;
}
