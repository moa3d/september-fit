"use client";

import { useEffect, useMemo, useState } from "react";
import {
  developerRequest,
  login,
  logout,
  me,
} from "../lib/api";

type Tab =
  | "overview"
  | "products"
  | "fitSessions"
  | "keys"
  | "origins"
  | "webhooks"
  | "deliveries"
  | "feedback"
  | "requestLogs"
  | "billing"
  | "onboarding"
  | "team"
  | "logs";

interface Identity {
  user: {
    id: string;
    email: string;
    role: string;
  };
  merchant: {
    id: string;
    name: string;
  };
}

const tabs: {
  id: Tab;
  label: string;
  roles: string[];
}[] = [
  {
    id: "overview",
    label: "نظرة عامة",
    roles: ["OWNER", "ADMIN", "DEVELOPER", "ANALYST"],
  },
  {
    id: "products",
    label: "المنتجات",
    roles: ["OWNER", "ADMIN", "DEVELOPER", "ANALYST"],
  },
  {
    id: "fitSessions",
    label: "Fit Sessions",
    roles: ["OWNER", "ADMIN", "DEVELOPER", "ANALYST"],
  },
  {
    id: "keys",
    label: "API Keys",
    roles: ["OWNER", "ADMIN", "DEVELOPER"],
  },
  {
    id: "origins",
    label: "Allowed Origins",
    roles: ["OWNER", "ADMIN", "DEVELOPER"],
  },
  {
    id: "webhooks",
    label: "Webhooks",
    roles: ["OWNER", "ADMIN", "DEVELOPER"],
  },
  {
    id: "deliveries",
    label: "Webhook Deliveries",
    roles: ["OWNER", "ADMIN", "DEVELOPER"],
  },
  {
    id: "feedback",
    label: "Feedback Analytics",
    roles: ["OWNER", "ADMIN", "DEVELOPER", "ANALYST"],
  },
  {
    id: "requestLogs",
    label: "Request Logs",
    roles: ["OWNER", "ADMIN", "DEVELOPER", "ANALYST"],
  },
  {
    id: "billing",
    label: "Plan & Usage",
    roles: ["OWNER", "ADMIN", "DEVELOPER", "ANALYST"],
  },
  {
    id: "onboarding",
    label: "Onboarding",
    roles: ["OWNER", "ADMIN", "DEVELOPER", "ANALYST"],
  },
  {
    id: "team",
    label: "Team",
    roles: ["OWNER", "ADMIN"],
  },
  {
    id: "logs",
    label: "Logs",
    roles: ["OWNER", "ADMIN", "DEVELOPER", "ANALYST"],
  },
];

function Card({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        background: "white",
        border: "1px solid #eadfd2",
        borderRadius: 18,
        padding: 18,
      }}
    >
      {children}
    </section>
  );
}

function Button({
  children,
  onClick,
  secondary,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        border: secondary ? "1px solid #c83f4d" : 0,
        background: secondary ? "white" : "#c83f4d",
        color: secondary ? "#c83f4d" : "white",
        borderRadius: 10,
        padding: "10px 14px",
        fontWeight: 700,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

export default function Dashboard() {
  const [identity, setIdentity] =
    useState<Identity | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [email, setEmail] = useState(
    "owner@septemberfit.local",
  );
  const [password, setPassword] = useState("ChangeMe123!");

  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void checkAuth();
  }, []);

  async function checkAuth() {
    try {
      setIdentity(await me());
    } catch {
      setIdentity(null);
    } finally {
      setAuthChecked(true);
    }
  }

  async function signIn() {
    setBusy(true);
    setError("");

    try {
      const result = await login(email, password);
      setIdentity(result);
      setTab("overview");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "تعذر تسجيل الدخول.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await logout();
    setIdentity(null);
    setData(null);
  }

  const visibleTabs = useMemo(
    () =>
      identity
        ? tabs.filter((item) =>
            item.roles.includes(identity.user.role),
          )
        : [],
    [identity],
  );

  useEffect(() => {
    if (
      identity &&
      !visibleTabs.some((item) => item.id === tab)
    ) {
      setTab(visibleTabs[0]?.id ?? "overview");
    }
  }, [identity, tab, visibleTabs]);

  async function load(path?: string) {
    if (!identity) return;

    setBusy(true);
    setError("");

    try {
      const endpoint =
        path ??
        (tab === "overview"
          ? "/developer/overview"
          : tab === "products"
            ? "/developer/products"
            : tab === "fitSessions"
              ? "/developer/fit-sessions"
          : tab === "keys"
            ? "/developer/api-keys"
            : tab === "origins"
              ? "/developer/origins"
              : tab === "webhooks"
                ? "/developer/webhooks"
                : tab === "deliveries"
                  ? "/developer/webhook-deliveries"
                  : tab === "feedback"
                    ? "/developer/feedback-analytics"
                    : tab === "requestLogs"
                      ? "/developer/request-logs?limit=100"
                      : tab === "billing"
                        ? "/billing/overview"
                        : tab === "onboarding"
                          ? "/billing/onboarding"
                          : tab === "team"
                            ? "/team/members"
                            : "/developer/logs?limit=50");

      setData(await developerRequest(endpoint));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "حدث خطأ.",
      );

      if (
        e instanceof Error &&
        e.message.toLowerCase().includes("session")
      ) {
        setIdentity(null);
      }
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (identity) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, identity?.user.id]);

  async function createKey() {
    const name = window.prompt(
      "اسم المفتاح:",
      "Website production",
    );
    if (!name) return;

    const environment = (
      window.prompt(
        "البيئة: TEST أو LIVE",
        "LIVE",
      ) ?? "LIVE"
    ).toUpperCase();

    if (!["TEST", "LIVE"].includes(environment)) {
      window.alert("اختر TEST أو LIVE فقط.");
      return;
    }

    const created = await developerRequest<any>(
      "/developer/api-keys",
      {
        method: "POST",
        body: JSON.stringify({
          name,
          environment,
          scopes: [
            "products:read",
            "products:write",
            "profiles:read",
            "profiles:write",
            "fit:calculate",
            "sessions:write",
            "feedback:write",
            "analytics:read",
          ],
        }),
      },
    );

    window.alert(
      "انسخ المفتاح الآن، لن يظهر مرة ثانية:\n\n" +
        created.secret_key,
    );

    await load("/developer/api-keys");
  }

  async function createProduct() {
    const externalProductId = window.prompt(
      "معرّف المنتج الخارجي:",
      `TEST-${Date.now()}`,
    );
    if (!externalProductId) return;

    const name = window.prompt("اسم المنتج:", "جاكيت تجريبي");
    if (!name) return;

    const category = (
      window.prompt(
        "الفئة: JACKET / HOODIE / SHIRT / TSHIRT / PANTS / JEANS",
        "JACKET",
      ) ?? "JACKET"
    ).toUpperCase();

    if (
      !["JACKET", "HOODIE", "SHIRT", "TSHIRT", "PANTS", "JEANS"].includes(
        category,
      )
    ) {
      window.alert("الفئة غير مدعومة.");
      return;
    }

    const sku = window.prompt("SKU اختياري:", externalProductId) ?? "";
    const originalSizeLabel =
      window.prompt("المقاس المكتوب على القطعة:", "M") ?? "";

    await developerRequest("/developer/products", {
      method: "POST",
      body: JSON.stringify({
        external_product_id: externalProductId,
        sku: sku || undefined,
        name,
        category,
        original_size_label: originalSizeLabel || undefined,
        active: true,
      }),
    });

    await load("/developer/products");
  }

  async function saveMeasurements() {
    const products = data?.data ?? [];
    const first = products[0];
    const productId = window.prompt(
      "Product ID الذي تريد إدخال قياساته:",
      first?.id ?? "",
    );
    if (!productId) return;

    const product = products.find((item: any) => item.id === productId) ?? first;
    const category = product?.category ?? "JACKET";
    const isLower = ["PANTS", "JEANS"].includes(category);

    const num = (label: string, fallback = "") => {
      const value = window.prompt(label, fallback);
      if (!value) return undefined;
      const parsed = Number(value.replace(",", "."));
      return Number.isFinite(parsed) ? parsed : undefined;
    };

    const payload: Record<string, unknown> = {
      quality: "VERIFIED",
      fit_type: "REGULAR",
      stretch_level: "NONE",
      measured_by: identity?.user.email ?? "dashboard",
    };

    if (isLower) {
      payload.waist_width_cm = num("عرض الخصر سم (القطعة مفرودة):", "42");
      payload.hip_width_cm = num("عرض الورك سم:", "52");
      payload.thigh_width_cm = num("عرض الفخذ سم:", "30");
      payload.inseam_cm = num("طول الساق الداخلي سم:", "78");
      payload.garment_length_cm = num("الطول الكلي سم:", "104");
    } else {
      payload.chest_width_cm = num("عرض الصدر سم (القطعة مفرودة):", "56");
      payload.shoulder_width_cm = num("عرض الكتفين سم:", "47");
      payload.sleeve_length_cm = num("طول الكم سم:", "64");
      payload.garment_length_cm = num("طول القطعة سم:", "70");
    }

    await developerRequest(
      `/developer/products/${encodeURIComponent(productId)}/measurements`,
      {
        method: "PUT",
        body: JSON.stringify(payload),
      },
    );

    await load("/developer/products");
    window.alert("تم حفظ القياسات.");
  }

  async function createFitSession() {
    const productsResult = await developerRequest<any>("/developer/products");
    const products = productsResult?.data ?? [];
    const first = products[0];

    if (!first) {
      window.alert("أضف منتجًا أولًا.");
      return;
    }

    const externalProductId = window.prompt(
      "external_product_id:",
      first.external_product_id,
    );
    if (!externalProductId) return;

    const created = await developerRequest<any>("/developer/fit-sessions", {
      method: "POST",
      body: JSON.stringify({
        external_product_id: externalProductId,
        locale: "ar",
      }),
    });

    await load("/developer/fit-sessions");

    if (created.fit_url) {
      window.open(created.fit_url, "_blank", "noopener,noreferrer");
      window.alert(`تم إنشاء الجلسة.\n\n${created.fit_url}`);
    }
  }

  async function addOrigin() {
    const origin = window.prompt(
      "الدومين المسموح:",
      "https://shop.example.com",
    );
    if (!origin) return;

    await developerRequest("/developer/origins", {
      method: "POST",
      body: JSON.stringify({ origin }),
    });

    await load("/developer/origins");
  }

  async function addWebhook() {
    const url = window.prompt(
      "Webhook URL:",
      "https://shop.example.com/api/webhooks/september-fit",
    );
    if (!url) return;

    const created = await developerRequest<any>(
      "/developer/webhooks",
      {
        method: "POST",
        body: JSON.stringify({
          url,
          environment: "TEST",
          events: [
            "fit.completed",
            "profile.updated",
            "feedback.received",
          ],
        }),
      },
    );

    window.alert(
      "انسخ Webhook secret الآن:\n\n" +
        created.signing_secret,
    );

    await load("/developer/webhooks");
  }

  if (!authChecked) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 24,
        }}
      >
        جاري التحقق من الجلسة...
      </main>
    );
  }

  if (!identity) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 24,
        }}
      >
        <div style={{ width: "min(100%, 430px)" }}>
          <Card>
            <div
              style={{
                fontSize: 26,
                fontWeight: 900,
                color: "#c83f4d",
                marginBottom: 6,
              }}
            >
              September Fit
            </div>

            <div
              style={{
                color: "#66565a",
                marginBottom: 24,
              }}
            >
              Merchant Dashboard
            </div>

            <label style={{ display: "block", marginBottom: 12 }}>
              <span
                style={{
                  display: "block",
                  fontSize: 12,
                  color: "#66565a",
                  marginBottom: 6,
                }}
              >
                البريد الإلكتروني
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: "100%",
                  height: 44,
                  border: "1px solid #eadfd2",
                  borderRadius: 10,
                  padding: "0 12px",
                }}
              />
            </label>

            <label style={{ display: "block", marginBottom: 14 }}>
              <span
                style={{
                  display: "block",
                  fontSize: 12,
                  color: "#66565a",
                  marginBottom: 6,
                }}
              >
                كلمة المرور
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                style={{
                  width: "100%",
                  height: 44,
                  border: "1px solid #eadfd2",
                  borderRadius: 10,
                  padding: "0 12px",
                }}
              />
            </label>

            {error ? (
              <div
                style={{
                  background: "#f9e2e3",
                  color: "#a43d42",
                  padding: 10,
                  borderRadius: 10,
                  marginBottom: 12,
                  fontSize: 12,
                }}
              >
                {error}
              </div>
            ) : null}

            <Button
              onClick={() => void signIn()}
              disabled={busy}
            >
              {busy ? "جاري الدخول..." : "تسجيل الدخول"}
            </Button>

            <button
              type="button"
              onClick={async () => {
                try {
                  const { requestPasswordReset } =
                    await import("../lib/api");
                  await requestPasswordReset(email);
                  window.alert(
                    "إذا كان البريد موجودًا، تم إرسال رابط إعادة التعيين.",
                  );
                } catch {
                  window.alert(
                    "إذا كان البريد موجودًا، تم إرسال رابط إعادة التعيين.",
                  );
                }
              }}
              style={{
                marginTop: 12,
                border: 0,
                background: "transparent",
                color: "#c83f4d",
                fontWeight: 700,
              }}
            >
              نسيت كلمة المرور؟
            </button>
          </Card>
        </div>
      </main>
    );
  }

  const title =
    visibleTabs.find((item) => item.id === tab)?.label ??
    "";

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: "260px 1fr",
      }}
    >
      <aside
        style={{
          background: "white",
          borderLeft: "1px solid #eadfd2",
          padding: 20,
        }}
      >
        <div
          style={{
            fontSize: 24,
            fontWeight: 900,
            color: "#c83f4d",
          }}
        >
          September Fit
        </div>

        <div
          style={{
            color: "#66565a",
            fontSize: 11,
            margin: "6px 0 4px",
          }}
        >
          {identity.merchant.name}
        </div>

        <div
          style={{
            display: "inline-block",
            background: "#f4d7da",
            borderRadius: 999,
            padding: "5px 9px",
            fontSize: 10,
            fontWeight: 800,
            marginBottom: 22,
          }}
        >
          {identity.user.role}
        </div>

        <div style={{ display: "grid", gap: 7 }}>
          {visibleTabs.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              style={{
                border: 0,
                textAlign: "right",
                padding: "11px 12px",
                borderRadius: 10,
                background:
                  tab === item.id
                    ? "#f4d7da"
                    : "transparent",
                color:
                  tab === item.id
                    ? "#261a1d"
                    : "#66565a",
                fontWeight:
                  tab === item.id ? 800 : 600,
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 24 }}>
          <Button
            secondary
            onClick={() => void signOut()}
          >
            تسجيل الخروج
          </Button>
        </div>
      </aside>

      <section style={{ padding: 28, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            alignItems: "center",
            marginBottom: 22,
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 28 }}>
              {title}
            </h1>
            <p
              style={{
                color: "#66565a",
                marginBottom: 0,
              }}
            >
              {identity.user.email}
            </p>
          </div>
        </div>

        {error ? (
          <div
            style={{
              padding: 12,
              background: "#f9e2e3",
              color: "#a43d42",
              borderRadius: 10,
              marginBottom: 14,
            }}
          >
            {error}
          </div>
        ) : null}

        {busy ? (
          <Card>جاري التحميل...</Card>
        ) : tab === "overview" ? (
          <Overview data={data} />
        ) : tab === "products" ? (
          <ProductsView
            data={data}
            onCreate={() => void createProduct()}
            onMeasurements={() => void saveMeasurements()}
          />
        ) : tab === "fitSessions" ? (
          <FitSessionsView
            data={data}
            onCreate={() => void createFitSession()}
          />
        ) : tab === "keys" ? (
          <ListView
            title="API Keys"
            actionLabel="+ إنشاء API Key"
            onAction={createKey}
            rows={(data?.data ?? []).map((x: any) => ({
              title: x.name,
              subtitle: `${x.environment} · ${x.prefix}••••${x.last_four}`,
              meta: x.revoked_at ? "Revoked" : "Active",
            }))}
          />
        ) : tab === "origins" ? (
          <ListView
            title="Allowed Origins"
            actionLabel="+ إضافة Origin"
            onAction={addOrigin}
            rows={(data?.data ?? []).map((x: any) => ({
              title: x.origin,
              subtitle: `Created ${new Date(
                x.created_at,
              ).toLocaleString()}`,
              meta: "Allowed",
            }))}
          />
        ) : tab === "webhooks" ? (
          <ListView
            title="Webhooks"
            actionLabel="+ إضافة Webhook"
            onAction={addWebhook}
            rows={(data?.data ?? []).map((x: any) => ({
              title: x.url,
              subtitle: `${x.environment} · ${x.events.join(
                ", ",
              )}`,
              meta: x.enabled ? "Enabled" : "Disabled",
            }))}
          />
        ) : tab === "deliveries" ? (
          <ListView
            title="Webhook Deliveries"
            actionLabel="تحديث"
            onAction={() => void load()}
            rows={(data?.data ?? []).map((x: any) => ({
              title: `${x.event_type} → ${x.url}`,
              subtitle: `Attempts: ${
                x.attempt_count
              } · HTTP: ${
                x.last_response_code ?? "-"
              } · Next: ${
                x.next_attempt_at ?? "-"
              }`,
              meta: x.status,
            }))}
          />
        ) : tab === "feedback" ? (
          <FeedbackAnalytics data={data} />
        ) : tab === "requestLogs" ? (
          <ListView
            title="Request Logs"
            actionLabel="تحديث"
            onAction={() => void load()}
            rows={(data?.data ?? []).map((x: any) => ({
              title: `${x.method} ${x.route}`,
              subtitle: `HTTP ${x.status_code} · ${x.duration_ms}ms · ${x.auth_kind ?? "PUBLIC"} · ${x.error_code ?? "OK"}`,
              meta: new Date(x.created_at).toLocaleString(),
            }))}
          />
        ) : tab === "billing" ? (
          <BillingUsage data={data} />
        ) : tab === "onboarding" ? (
          <OnboardingView data={data} onRefresh={() => void load()} />
        ) : tab === "team" ? (
          <TeamView
            data={data}
            role={identity.user.role}
            onRefresh={() => void load()}
          />
        ) : (
          <ListView
            title="Recent events"
            actionLabel="تحديث"
            onAction={() => void load()}
            rows={(data?.data ?? []).map((x: any) => ({
              title: x.event_type,
              subtitle: JSON.stringify(
                x.properties ?? {},
              ),
              meta: new Date(
                x.created_at,
              ).toLocaleString(),
            }))}
          />
        )}
      </section>
    </main>
  );
}

function Overview({ data }: { data: any }) {
  const cards = [
    ["API Keys", data?.api_keys ?? 0],
    ["Allowed Origins", data?.allowed_origins ?? 0],
    ["Active Webhooks", data?.active_webhooks ?? 0],
    ["Products", data?.active_products ?? 0],
    ["Fit Sessions", data?.fit_sessions ?? 0],
    ["Fit Results", data?.fit_results ?? 0],
    ["Feedback", data?.feedback_count ?? 0],
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          "repeat(auto-fit, minmax(190px, 1fr))",
        gap: 14,
      }}
    >
      {cards.map(([label, value]) => (
        <Card key={String(label)}>
          <div
            style={{
              color: "#66565a",
              fontSize: 12,
            }}
          >
            {label}
          </div>
          <div
            style={{
              fontSize: 34,
              fontWeight: 900,
              marginTop: 8,
            }}
          >
            {value}
          </div>
        </Card>
      ))}
    </div>
  );
}

function ListView({
  title,
  actionLabel,
  onAction,
  rows,
}: {
  title: string;
  actionLabel: string;
  onAction: () => void;
  rows: {
    title: string;
    subtitle: string;
    meta: string;
  }[];
}) {
  return (
    <Card>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <h2 style={{ margin: 0 }}>{title}</h2>
        <Button onClick={onAction}>
          {actionLabel}
        </Button>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {rows.length === 0 ? (
          <div style={{ color: "#66565a" }}>
            لا توجد بيانات بعد.
          </div>
        ) : (
          rows.map((row, index) => (
            <div
              key={`${row.title}-${index}`}
              style={{
                border: "1px solid #eadfd2",
                borderRadius: 12,
                padding: 13,
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 12,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800 }}>
                  {row.title}
                </div>
                <div
                  style={{
                    color: "#66565a",
                    fontSize: 11,
                    marginTop: 4,
                    overflowWrap: "anywhere",
                  }}
                >
                  {row.subtitle}
                </div>
              </div>
              <div
                style={{
                  color: "#3f7d56",
                  fontSize: 11,
                }}
              >
                {row.meta}
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}


function ProductsView({
  data,
  onCreate,
  onMeasurements,
}: {
  data: any;
  onCreate: () => void;
  onMeasurements: () => void;
}) {
  const products = data?.data ?? [];

  return (
    <Card>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        <h2 style={{ margin: 0 }}>المنتجات</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button secondary onClick={onMeasurements}>
            إدخال / تحديث القياسات
          </Button>
          <Button onClick={onCreate}>+ إضافة منتج</Button>
        </div>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {products.length === 0 ? (
          <div style={{ color: "#66565a" }}>لا توجد منتجات.</div>
        ) : (
          products.map((product: any) => (
            <div
              key={product.id}
              style={{
                border: "1px solid #eadfd2",
                borderRadius: 12,
                padding: 14,
              }}
            >
              <div style={{ fontWeight: 900 }}>{product.name}</div>
              <div style={{ color: "#66565a", fontSize: 12, marginTop: 4 }}>
                {product.category} · {product.external_product_id}
                {product.original_size_label
                  ? ` · Size ${product.original_size_label}`
                  : ""}
              </div>
              <div
                style={{
                  marginTop: 7,
                  fontSize: 11,
                  overflowWrap: "anywhere",
                }}
              >
                Product ID: {product.id}
              </div>
              <div
                style={{
                  marginTop: 7,
                  color: product.latest_measurement ? "#3f7d56" : "#a43d42",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {product.latest_measurement
                  ? `القياسات جاهزة · v${product.latest_measurement.version} · ${product.latest_measurement.quality}`
                  : "لا توجد قياسات بعد"}
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

function FitSessionsView({
  data,
  onCreate,
}: {
  data: any;
  onCreate: () => void;
}) {
  const sessions = data?.data ?? [];

  return (
    <Card>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <h2 style={{ margin: 0 }}>Fit Sessions</h2>
        <Button onClick={onCreate}>+ جلسة اختبار</Button>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {sessions.length === 0 ? (
          <div style={{ color: "#66565a" }}>لا توجد جلسات بعد.</div>
        ) : (
          sessions.map((session: any) => (
            <div
              key={session.id}
              style={{
                border: "1px solid #eadfd2",
                borderRadius: 12,
                padding: 14,
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontWeight: 900 }}>{session.product_name}</div>
                <div style={{ color: "#66565a", fontSize: 12, marginTop: 4 }}>
                  {session.external_product_id} · {session.id}
                </div>
                {session.result ? (
                  <div style={{ marginTop: 7, fontSize: 12 }}>
                    Fit Score: <b>{session.result.fit_score}</b> · {session.result.label}
                  </div>
                ) : null}
              </div>
              <div style={{ color: "#3f7d56", fontSize: 12, fontWeight: 800 }}>
                {session.status}
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

function FeedbackAnalytics({
  data,
}: {
  data: any;
}) {
  const cards = [
    [
      "Total Feedback",
      data?.total_feedback ?? 0,
    ],
    [
      "Perfect",
      `${data?.perfect_rate ?? 0}%`,
    ],
    [
      "Too Small",
      `${data?.too_small_rate ?? 0}%`,
    ],
    [
      "Too Large",
      `${data?.too_large_rate ?? 0}%`,
    ],
  ];

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
        }}
      >
        {cards.map(([label, value]) => (
          <Card key={String(label)}>
            <div
              style={{
                color: "#66565a",
                fontSize: 12,
              }}
            >
              {label}
            </div>
            <div
              style={{
                fontSize: 32,
                fontWeight: 900,
                marginTop: 8,
              }}
            >
              {value}
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <h2 style={{ marginTop: 0 }}>
          هل الـFit Score العالي يطابق الواقع؟
        </h2>

        <div style={{ display: "grid", gap: 8 }}>
          {(data?.score_buckets ?? []).map(
            (row: any) => (
              <div
                key={row.bucket}
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "1fr auto auto",
                  gap: 12,
                  borderTop:
                    "1px solid #eadfd2",
                  paddingTop: 10,
                }}
              >
                <strong>
                  Score {row.bucket}
                </strong>
                <span>
                  {row.feedback_count} تقييم
                </span>
                <span
                  style={{
                    color: "#3f7d56",
                  }}
                >
                  Perfect {row.perfect_rate}%
                </span>
              </div>
            ),
          )}
        </div>
      </Card>

      <Card>
        <h2 style={{ marginTop: 0 }}>
          أكثر مناطق المشكلة
        </h2>

        <div style={{ display: "grid", gap: 8 }}>
          {(data?.problem_areas ?? []).map(
            (row: any) => (
              <div
                key={row.area}
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  borderTop:
                    "1px solid #eadfd2",
                  paddingTop: 9,
                }}
              >
                <strong>{row.area}</strong>
                <span>{row.count}</span>
              </div>
            ),
          )}

          {(data?.problem_areas ?? [])
            .length === 0 ? (
            <div
              style={{
                color: "#66565a",
              }}
            >
              لا توجد بيانات كافية بعد.
            </div>
          ) : null}
        </div>
      </Card>

      <Card>
        <h2 style={{ marginTop: 0 }}>
          حسب الفئة
        </h2>

        <div style={{ display: "grid", gap: 8 }}>
          {(data?.categories ?? []).map(
            (row: any) => (
              <div
                key={row.category}
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "1fr auto auto auto",
                  gap: 12,
                  borderTop:
                    "1px solid #eadfd2",
                  paddingTop: 10,
                }}
              >
                <strong>
                  {row.category}
                </strong>
                <span>
                  n={row.total}
                </span>
                <span>
                  Perfect {row.perfect_rate}%
                </span>
                <span>
                  Small {row.tooSmall} · Large{" "}
                  {row.tooLarge}
                </span>
              </div>
            ),
          )}
        </div>
      </Card>
    </div>
  );
}


function UsageBar({
  label,
  item,
}: {
  label: string;
  item: any;
}) {
  const percent =
    item?.percent === null ||
    item?.percent === undefined
      ? 0
      : item.percent;

  return (
    <div
      style={{
        borderTop: "1px solid #eadfd2",
        paddingTop: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: 7,
        }}
      >
        <strong>{label}</strong>
        <span style={{ color: "#66565a" }}>
          {item?.used ?? 0} /{" "}
          {item?.limit === null ||
          item?.limit === undefined
            ? "∞"
            : item.limit}
        </span>
      </div>

      <div
        style={{
          height: 9,
          borderRadius: 999,
          background: "#f2eadf",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${
              item?.limit === null
                ? 0
                : Math.min(percent, 100)
            }%`,
            background:
              percent >= 90
                ? "#a43d42"
                : percent >= 70
                  ? "#a66a2c"
                  : "#3f7d56",
          }}
        />
      </div>
    </div>
  );
}

function BillingUsage({
  data,
}: {
  data: any;
}) {
  const subscription =
    data?.subscription ?? {};
  const usage =
    data?.usage?.usage ?? {};
  const plans =
    data?.plans?.data ?? [];
  const requests =
    data?.change_requests ?? [];

  async function requestPlan(
    planCode: string,
    monthlyPriceCents: number,
  ) {
    try {
      if (monthlyPriceCents <= 0) {
        const result =
          await developerRequest<any>(
            "/billing/plan-change-requests",
            {
              method: "POST",
              body: JSON.stringify({
                plan_code: planCode,
              }),
            },
          );

        window.alert(
          `تم إنشاء طلب تغيير الخطة إلى ${planCode}: ${result.status}`,
        );
        return;
      }

      const result =
        await developerRequest<any>(
          "/billing/checkout",
          {
            method: "POST",
            body: JSON.stringify({
              plan_code: planCode,
            }),
          },
        );

      if (result.checkout_url) {
        window.location.assign(
          result.checkout_url,
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "تعذر بدء الدفع.";

      if (
        message.includes(
          "BILLING_PORTAL_REQUIRED",
        ) ||
        message.toLowerCase().includes(
          "billing portal",
        )
      ) {
        await openPortal();
        return;
      }

      window.alert(message);
    }
  }

  async function openPortal() {
    try {
      const result =
        await developerRequest<any>(
          "/billing/portal",
          {
            method: "POST",
          },
        );

      if (result.portal_url) {
        window.location.assign(
          result.portal_url,
        );
      }
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "تعذر فتح Billing Portal.",
      );
    }
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Card>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
          }}
        >
          <div>
            <div
              style={{
                color: "#66565a",
                fontSize: 12,
              }}
            >
              Current plan
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 900,
                marginTop: 5,
              }}
            >
              {subscription?.plan?.name ??
                subscription?.plan?.code ??
                "-"}
            </div>
          </div>
          <div
            style={{
              background: "#f4d7da",
              borderRadius: 999,
              padding: "7px 11px",
              fontWeight: 800,
              fontSize: 11,
            }}
          >
            {subscription?.status ?? "-"}
          </div>
        </div>

        <p
          style={{
            color: "#66565a",
            fontSize: 12,
          }}
        >
          الفترة:{" "}
          {subscription?.current_period_start
            ? new Date(
                subscription.current_period_start,
              ).toLocaleDateString()
            : "-"}{" "}
          —{" "}
          {subscription?.current_period_end
            ? new Date(
                subscription.current_period_end,
              ).toLocaleDateString()
            : "-"}
        </p>

        {subscription?.trial_ends_at ? (
          <p
            style={{
              color: "#a66a2c",
              fontSize: 12,
              marginBottom: 10,
            }}
          >
            Trial ends:{" "}
            {new Date(
              subscription.trial_ends_at,
            ).toLocaleDateString()}
          </p>
        ) : null}

        {subscription?.billing_managed ? (
          <Button
            onClick={() =>
              void openPortal()
            }
          >
            إدارة الدفع والفواتير
          </Button>
        ) : null}
      </Card>

      <Card>
        <h2 style={{ marginTop: 0 }}>
          Usage & Quotas
        </h2>

        <div style={{ display: "grid", gap: 13 }}>
          <UsageBar
            label="Fit Calculations"
            item={usage.fit_calculations}
          />
          <UsageBar
            label="Fit Sessions"
            item={usage.fit_sessions}
          />
          <UsageBar
            label="Products"
            item={usage.products}
          />
          <UsageBar
            label="Webhooks"
            item={usage.webhooks}
          />
          <UsageBar
            label="API Keys"
            item={usage.api_keys}
          />
          <UsageBar
            label="Team Members"
            item={usage.team_members}
          />
        </div>
      </Card>

      <Card>
        <h2 style={{ marginTop: 0 }}>
          Plans
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(190px, 1fr))",
            gap: 10,
          }}
        >
          {plans.map((plan: any) => {
            const current =
              subscription?.plan?.code ===
              plan.code;

            return (
              <div
                key={plan.code}
                style={{
                  border: `1px solid ${
                    current
                      ? "#c83f4d"
                      : "#eadfd2"
                  }`,
                  borderRadius: 14,
                  padding: 14,
                }}
              >
                <div
                  style={{
                    fontWeight: 900,
                    fontSize: 18,
                  }}
                >
                  {plan.name}
                </div>

                <div
                  style={{
                    fontSize: 25,
                    fontWeight: 900,
                    margin: "8px 0",
                  }}
                >
                  €{(
                    plan.monthly_price_cents /
                    100
                  ).toFixed(0)}
                  <span
                    style={{
                      fontSize: 11,
                      color: "#66565a",
                    }}
                  >
                    {" "}
                    / شهر
                  </span>
                </div>

                <div
                  style={{
                    color: "#66565a",
                    fontSize: 11,
                    lineHeight: 1.7,
                    minHeight: 38,
                  }}
                >
                  {plan.description}
                </div>

                <div style={{ marginTop: 12 }}>
                  {current ? (
                    <div
                      style={{
                        color: "#3f7d56",
                        fontWeight: 800,
                      }}
                    >
                      الخطة الحالية
                    </div>
                  ) : (
                    <Button
                      onClick={() =>
                        void requestPlan(
                          plan.code,
                          plan.monthly_price_cents,
                        )
                      }
                    >
                      طلب الخطة
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p
          style={{
            color: "#a66a2c",
            fontSize: 11,
            lineHeight: 1.7,
            marginBottom: 0,
          }}
        >
          الأسعار الحالية Draft تقني، وليست
          التسعيرة النهائية المعتمدة.
        </p>
      </Card>

      {requests.length > 0 ? (
        <Card>
          <h2 style={{ marginTop: 0 }}>
            Plan-change requests
          </h2>

          <div style={{ display: "grid", gap: 8 }}>
            {requests.map((request: any) => (
              <div
                key={request.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  borderTop:
                    "1px solid #eadfd2",
                  paddingTop: 9,
                }}
              >
                <strong>
                  {request.plan?.name ??
                    request.plan?.code}
                </strong>
                <span>{request.status}</span>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function OnboardingView({
  data,
  onRefresh,
}: {
  data: any;
  onRefresh: () => void;
}) {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Card>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
          }}
        >
          <div>
            <div
              style={{
                color: "#66565a",
                fontSize: 12,
              }}
            >
              Setup progress
            </div>
            <div
              style={{
                fontSize: 34,
                fontWeight: 900,
              }}
            >
              {data?.progress_percent ?? 0}%
            </div>
          </div>

          <div
            style={{
              color: data?.ready_for_live
                ? "#3f7d56"
                : "#a66a2c",
              fontWeight: 800,
            }}
          >
            {data?.ready_for_live
              ? "Ready for live"
              : "Setup required"}
          </div>
        </div>
      </Card>

      <Card>
        <h2 style={{ marginTop: 0 }}>
          Checklist
        </h2>

        <div style={{ display: "grid", gap: 9 }}>
          {(data?.checklist ?? []).map(
            (item: any) => (
              <div
                key={item.key}
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "auto 1fr auto",
                  gap: 10,
                  alignItems: "center",
                  borderTop:
                    "1px solid #eadfd2",
                  paddingTop: 10,
                }}
              >
                <span
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 999,
                    display: "grid",
                    placeItems: "center",
                    background: item.complete
                      ? "#e4f2e8"
                      : "#f8edd9",
                    color: item.complete
                      ? "#3f7d56"
                      : "#a66a2c",
                    fontWeight: 900,
                  }}
                >
                  {item.complete ? "✓" : "•"}
                </span>
                <strong>{item.label}</strong>
                <span
                  style={{
                    color: "#66565a",
                    fontSize: 11,
                  }}
                >
                  {item.required
                    ? "Required"
                    : "Optional"}
                </span>
              </div>
            ),
          )}
        </div>

        <div style={{ marginTop: 16 }}>
          <Button onClick={onRefresh}>
            تحديث
          </Button>
        </div>
      </Card>
    </div>
  );
}


function TeamView({
  data,
  role,
  onRefresh,
}: {
  data: any;
  role: string;
  onRefresh: () => void;
}) {
  async function invite() {
    const email = window.prompt(
      "البريد الإلكتروني للعضو:",
    );

    if (!email) return;

    const role = window.prompt(
      "الدور: ADMIN / DEVELOPER / ANALYST / STAFF",
      "DEVELOPER",
    );

    if (!role) return;

    try {
      const result =
        await developerRequest<any>(
          "/team/invitations",
          {
            method: "POST",
            body: JSON.stringify({
              email,
              role: role.toUpperCase(),
            }),
          },
        );

      window.alert(
        result.dev_accept_url
          ? `تم إنشاء الدعوة.\n\nللتطوير:\n${result.dev_accept_url}`
          : "تم إرسال الدعوة.",
      );

      onRefresh();
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "تعذر إرسال الدعوة.",
      );
    }
  }

  async function changeRole(
    id: string,
    currentRole: string,
  ) {
    if (role !== "OWNER") {
      window.alert(
        "تغيير الأدوار متاح للـOWNER فقط.",
      );
      return;
    }

    const next = window.prompt(
      "الدور الجديد:",
      currentRole,
    );

    if (!next) return;

    try {
      await developerRequest(
        `/team/members/${id}/role`,
        {
          method: "PATCH",
          body: JSON.stringify({
            role: next.toUpperCase(),
          }),
        },
      );

      onRefresh();
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "تعذر تغيير الدور.",
      );
    }
  }

  async function disable(
    id: string,
    email: string,
  ) {
    if (
      !window.confirm(
        `تعطيل ${email} وإلغاء جلساته؟`,
      )
    ) {
      return;
    }

    try {
      await developerRequest(
        `/team/members/${id}`,
        {
          method: "DELETE",
        },
      );

      onRefresh();
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "تعذر تعطيل العضو.",
      );
    }
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Card>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>
              Team Members
            </h2>
            <p
              style={{
                color: "#66565a",
                marginBottom: 0,
              }}
            >
              إدارة من يستطيع الدخول إلى
              لوحة September Fit.
            </p>
          </div>

          <Button
            onClick={() => void invite()}
          >
            + دعوة عضو
          </Button>
        </div>
      </Card>

      <Card>
        <div style={{ display: "grid", gap: 9 }}>
          {(data?.data ?? []).map(
            (member: any) => (
              <div
                key={member.id}
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "1fr auto auto",
                  gap: 10,
                  alignItems: "center",
                  borderTop:
                    "1px solid #eadfd2",
                  paddingTop: 11,
                }}
              >
                <div>
                  <strong>
                    {member.email}
                  </strong>
                  <div
                    style={{
                      color: "#66565a",
                      fontSize: 11,
                      marginTop: 3,
                    }}
                  >
                    {member.verified
                      ? "Verified"
                      : "Not verified"}{" "}
                    ·{" "}
                    {member.disabled
                      ? "Disabled"
                      : "Active"}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    void changeRole(
                      member.id,
                      member.role,
                    )
                  }
                  disabled={
                    member.role === "OWNER"
                  }
                  style={{
                    border:
                      "1px solid #eadfd2",
                    borderRadius: 999,
                    background: "#fff",
                    padding: "7px 10px",
                    fontWeight: 800,
                  }}
                >
                  {member.role}
                </button>

                {member.role !== "OWNER" ? (
                  <button
                    type="button"
                    onClick={() =>
                      void disable(
                        member.id,
                        member.email,
                      )
                    }
                    style={{
                      border:
                        "1px solid #f0c4c6",
                      borderRadius: 9,
                      background: "#fff",
                      color: "#a43d42",
                      padding: "7px 10px",
                    }}
                  >
                    تعطيل
                  </button>
                ) : (
                  <span />
                )}
              </div>
            ),
          )}
        </div>
      </Card>
    </div>
  );
}
