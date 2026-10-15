import {
  IsString,
  MaxLength,
} from "class-validator";

export class CreateCheckoutDto {
  @IsString()
  @MaxLength(50)
  plan_code!: string;
}
