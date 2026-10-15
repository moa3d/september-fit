import {
  IsIn,
} from "class-validator";

export class UpdateRoleDto {
  @IsIn(["ADMIN", "DEVELOPER", "ANALYST", "STAFF"])
  role!: "ADMIN" | "DEVELOPER" | "ANALYST" | "STAFF";
}
