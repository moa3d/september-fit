import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

export class SaveMeasurementsDto {
  @IsIn(["BASIC", "STANDARD", "VERIFIED"])
  quality!: "BASIC" | "STANDARD" | "VERIFIED";

  @IsOptional()
  @IsIn(["SLIM", "REGULAR", "LOOSE"])
  fit_type?: "SLIM" | "REGULAR" | "LOOSE";

  @IsIn(["NONE", "LOW", "MEDIUM", "HIGH"])
  stretch_level!: "NONE" | "LOW" | "MEDIUM" | "HIGH";

  @IsOptional() @IsNumber() @Min(1) @Max(250)
  chest_width_cm?: number;

  @IsOptional() @IsNumber() @Min(1) @Max(150)
  shoulder_width_cm?: number;

  @IsOptional() @IsNumber() @Min(1) @Max(150)
  sleeve_length_cm?: number;

  @IsOptional() @IsNumber() @Min(1) @Max(250)
  garment_length_cm?: number;

  @IsOptional() @IsNumber() @Min(1) @Max(200)
  waist_width_cm?: number;

  @IsOptional() @IsNumber() @Min(1) @Max(200)
  hip_width_cm?: number;

  @IsOptional() @IsNumber() @Min(1) @Max(150)
  thigh_width_cm?: number;

  @IsOptional() @IsNumber() @Min(1) @Max(180)
  inseam_cm?: number;

  @IsOptional()
  @IsString()
  measured_by?: string;
}
