import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class SubmitFeedbackDto {
  @IsIn(["TOO_SMALL", "PERFECT", "TOO_LARGE"])
  overall!: "TOO_SMALL" | "PERFECT" | "TOO_LARGE";

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  problem_areas?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
