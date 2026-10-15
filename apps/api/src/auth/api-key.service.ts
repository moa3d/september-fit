import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { verifySecret } from "./api-key.crypto";
import type { MerchantPrincipal } from "./auth.types";
@Injectable()
export class ApiKeyService {
  constructor(private readonly prisma: PrismaService) {}
  async authenticate(rawKey:string):Promise<MerchantPrincipal>{
    if(!rawKey.startsWith("sk_test_")&&!rawKey.startsWith("sk_live_")) throw new UnauthorizedException("Invalid September Fit API key.");
    const candidates=await this.prisma.apiKey.findMany({where:{prefix:rawKey.slice(0,20),revokedAt:null},include:{merchant:true},take:5});
    const apiKey=candidates.find(c=>verifySecret(rawKey,c.secretHash));
    if(!apiKey||apiKey.merchant.status!=="ACTIVE") throw new UnauthorizedException("Invalid or revoked September Fit API key.");
    if(apiKey.expiresAt&&apiKey.expiresAt<=new Date()) throw new UnauthorizedException("September Fit API key has expired.");
    if(
      process.env.NODE_ENV === "production" &&
      apiKey.environment === "TEST" &&
      process.env.ALLOW_TEST_KEYS_IN_PRODUCTION !== "true"
    ) throw new UnauthorizedException("TEST API keys are disabled in production.");
    void this.prisma.apiKey
      .update({
        where: { id: apiKey.id },
        data: { lastUsedAt: new Date() },
      })
      .catch(() => undefined);
    return {merchantId:apiKey.merchantId,merchantPublicId:apiKey.merchant.publicId,merchantName:apiKey.merchant.name,apiKeyId:apiKey.id,environment:apiKey.environment,scopes:apiKey.scopes};
  }
}
