import { IsOptional, IsString, Matches } from "class-validator";
export class CalculateFitDto { @IsString() product_id!:string; @IsString() profile_id!:string; @IsOptional() @IsString() session_id?:string; @IsOptional() @Matches(/^(SLIM|REGULAR|LOOSE)$/) preferred_fit_override?:"SLIM"|"REGULAR"|"LOOSE"; }
