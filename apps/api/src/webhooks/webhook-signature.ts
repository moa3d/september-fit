import { createHmac, timingSafeEqual } from "node:crypto";

export function signWebhookPayload(
  secret: string,
  timestamp: number,
  rawBody: string,
) {
  const signed = `${timestamp}.${rawBody}`;
  return createHmac("sha256", secret)
    .update(signed)
    .digest("hex");
}

export function verifyWebhookSignature(
  secret: string,
  timestamp: number,
  rawBody: string,
  signature: string,
) {
  const expected = signWebhookPayload(secret, timestamp, rawBody);

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");

  return a.length === b.length && timingSafeEqual(a, b);
}
