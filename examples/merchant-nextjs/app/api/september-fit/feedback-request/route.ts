import {
  NextRequest,
  NextResponse,
} from "next/server";

/**
 * Merchant backend example.
 *
 * Call this AFTER delivery / order completion.
 * The merchant secret stays server-side.
 */
export async function POST(
  request: NextRequest,
) {
  const input = await request.json();

  const apiUrl =
    process.env.SEPTEMBER_FIT_API_URL ??
    "https://api.septemberfit.com/v1";

  const secretKey =
    process.env.SEPTEMBER_FIT_SECRET_KEY;

  if (!secretKey) {
    return NextResponse.json(
      {
        error: {
          message:
            "September Fit is not configured.",
        },
      },
      { status: 500 },
    );
  }

  const response = await fetch(
    `${apiUrl}/feedback-requests`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type":
          "application/json",
        "Idempotency-Key":
          input.idempotency_key ??
          `feedback-${input.session_id}-${input.external_order_id ?? "order"}`,
      },
      body: JSON.stringify({
        session_id: input.session_id,
        result_id: input.result_id,
        external_order_id:
          input.external_order_id,
        return_url:
          input.return_url,
      }),
    },
  );

  const body = await response.json();

  return NextResponse.json(body, {
    status: response.status,
  });
}
