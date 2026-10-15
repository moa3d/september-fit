function getApiBase() {
  // In the browser always use the dashboard's same-origin proxy.
  // This avoids third-party cookie restrictions between Railway service domains.
  if (typeof window !== "undefined") {
    return "/api/backend";
  }

  return (
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "http://localhost:3000/v1"
  );
}

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${getApiBase()}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      body?.message ??
      body?.error?.message ??
      `HTTP ${response.status}`,
    );
  }

  return body as T;
}

export function login(email: string, password: string) {
  return request<{
    user: {
      id: string;
      email: string;
      role: string;
    };
    merchant: {
      id: string;
      name: string;
    };
  }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function logout() {
  return request<{ logged_out: boolean }>(
    "/auth/logout",
    { method: "POST" },
  );
}

export function me() {
  return request<{
    user: {
      id: string;
      email: string;
      role: string;
    };
    merchant: {
      id: string;
      name: string;
    };
  }>("/auth/me");
}

export function developerRequest<T>(
  path: string,
  init?: RequestInit,
) {
  return request<T>(path, init);
}


export function publicRequest<T>(
  path: string,
  init?: RequestInit,
) {
  return fetch(`${getApiBase()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  }).then(async (response) => {
    const body = await response.json();
    if (!response.ok) {
      throw new Error(
        body?.message ??
          body?.error?.message ??
          `HTTP ${response.status}`,
      );
    }
    return body as T;
  });
}


export function acceptInvitation(
  token: string,
  password: string,
) {
  return publicRequest<{
    accepted: boolean;
    user: {
      id: string;
      email: string;
      role: string;
    };
  }>("/auth/accept-invite", {
    method: "POST",
    body: JSON.stringify({
      token,
      password,
    }),
  });
}

export function requestPasswordReset(
  email: string,
) {
  return publicRequest<{
    accepted: boolean;
  }>("/auth/request-password-reset", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function resetPassword(
  token: string,
  password: string,
) {
  return publicRequest<{
    reset: boolean;
    sessions_revoked: boolean;
  }>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({
      token,
      new_password: password,
    }),
  });
}

export function verifyEmail(token: string) {
  return publicRequest<{
    verified: boolean;
  }>("/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}
