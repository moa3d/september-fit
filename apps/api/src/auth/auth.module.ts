import { Module } from "@nestjs/common";
import { ApiKeyGuard } from "./api-key.guard";
import { ApiKeyService } from "./api-key.service";
import { ScopesGuard } from "./scopes";
@Module({providers:[ApiKeyService,ApiKeyGuard,ScopesGuard],exports:[ApiKeyService,ApiKeyGuard,ScopesGuard]})
export class AuthModule {}
