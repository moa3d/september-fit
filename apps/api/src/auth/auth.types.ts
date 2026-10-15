import type { Request } from "express";
export interface MerchantPrincipal { merchantId: string; merchantPublicId: string; merchantName: string; apiKeyId: string; environment: "TEST" | "LIVE"; scopes: string[]; }
export interface AuthenticatedRequest extends Request { merchant: MerchantPrincipal; requestId?: string; }
