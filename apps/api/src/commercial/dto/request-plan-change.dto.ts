import {
  IsString,
  MaxLength,
} from "class-validator";

export class RequestPlanChangeDto {
  @IsString()
  @MaxLength(50)
  plan_code!: string;
}
