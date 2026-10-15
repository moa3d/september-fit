import type {
  HostedSession,
  PublicCalculateResponse,
  PublicProfilePayload,
  PublicFeedbackPage,
  SubmitFeedbackPayload,
  SubmitFeedbackResponse,
} from "./types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000/v1";

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      body?.message ??
      body?.error?.message ??
      "تعذر الاتصال بخدمة September Fit.";

    throw new Error(
      Array.isArray(message) ? message.join("، ") : String(message),
    );
  }

  return body as T;
}

export function getHostedSession(token: string) {
  return request<HostedSession>(
    `/public/fit-sessions/${encodeURIComponent(token)}`,
  );
}

export function saveHostedProfile(
  token: string,
  payload: PublicProfilePayload,
) {
  return request<{
    profile_id: string;
    session_id: string;
    status: "READY";
  }>(
    `/public/fit-sessions/${encodeURIComponent(token)}/profile`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function calculateHostedFit(token: string) {
  return request<PublicCalculateResponse>(
    `/public/fit-sessions/${encodeURIComponent(token)}/calculate`,
    { method: "POST" },
  );
}


export function getPublicFeedback(token: string) {
  return request<PublicFeedbackPage>(
    `/public/feedback/${encodeURIComponent(token)}`,
  );
}

export function submitPublicFeedback(
  token: string,
  payload: SubmitFeedbackPayload,
) {
  return request<SubmitFeedbackResponse>(
    `/public/feedback/${encodeURIComponent(token)}`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}
