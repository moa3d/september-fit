import { NextRequest, NextResponse } from "next/server";

/**
 * Example MERCHANT endpoint.
 *
 * This code belongs in the merchant's backend, not in September Fit customer-web.
 *
 * Required merchant environment variables:
 *   SEPTEMBER_FIT_API_URL=https://api.septemberfit.com/v1
 *   SEPTEMBER_FIT_SECRET_KEY=sk_live_...
 */
export async function POST(request: NextRequest) {
  const input = await request.json();

  if (!input?.product_id) {
    return NextResponse.json(
      { error: { message: "product_id is required" } },
      { status: 400 },
    );
  }

  const apiUrl =
    process.env.SEPTEMBER_FIT_API_URL ??
    "https://api.septemberfit.com/v1";

  const secretKey = process.env.SEPTEMBER_FIT_SECRET_KEY;

  if (!secretKey) {
    return NextResponse.json(
      { error: { message: "September Fit is not configured." } },
      { status: 500 },
    );
  }

  /**
   * Map the merchant's local product ID to the external_product_id
   * previously synced with September Fit.
   *
   * For this example they are the same value.
   */
  const externalProductId = String(input.product_id);

  const response = await fetch(`${apiUrl}/fit-sessions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${secretKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key":
        request.headers.get("x-request-id") ??
        `fit-${externalProductId}-${Date.now()}`,
    },
    body: JSON.stringify({
      external_product_id: externalProductId,
      external_customer_id: input.external_customer_id ?? undefined,
      profile_id: input.profile_id ?? undefined,
      return_url: input.return_url ?? undefined,
      locale: input.locale ?? "ar",
    }),
  });

  const body = await response.json();

  return NextResponse.json(body, { status: response.status });
}
