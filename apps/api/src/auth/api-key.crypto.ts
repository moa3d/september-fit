import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
const KEY_BYTES = 32;
export function hashSecret(secret: string): string { const salt=randomBytes(16); const derived=scryptSync(secret,salt,KEY_BYTES); return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`; }
export function verifySecret(secret: string, stored: string): boolean { const [algorithm,saltHex,hashHex]=stored.split("$"); if(algorithm!=="scrypt"||!saltHex||!hashHex)return false; const expected=Buffer.from(hashHex,"hex"); const actual=scryptSync(secret,Buffer.from(saltHex,"hex"),expected.length); return expected.length===actual.length&&timingSafeEqual(expected,actual); }
export function generateApiKey(environment:"TEST"|"LIVE") { const raw=`sk_${environment.toLowerCase()}_${randomBytes(32).toString("base64url")}`; return { raw, prefix:raw.slice(0,20), lastFour:raw.slice(-4), secretHash:hashSecret(raw) }; }
