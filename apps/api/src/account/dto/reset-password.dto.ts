import {
  IsString,
  MinLength,
} from "class-validator";

export class ResetPasswordDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(10)
  new_password!: string;
}
