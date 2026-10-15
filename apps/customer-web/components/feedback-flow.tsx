"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  getPublicFeedback,
  submitPublicFeedback,
} from "../lib/api";
import type {
  PublicFeedbackPage,
  SubmitFeedbackPayload,
} from "../lib/types";
import {
  Badge,
  Card,
  Header,
  PrimaryButton,
  SecondaryButton,
  Shell,
  colors,
} from "./ui";

type Overall =
  | "TOO_SMALL"
  | "PERFECT"
  | "TOO_LARGE";

const areas = [
  ["CHEST", "الصدر"],
  ["SHOULDER", "الكتف"],
  ["WAIST", "الخصر"],
  ["HIPS", "الورك"],
  ["LENGTH", "الطول"],
  ["SLEEVE", "الكم"],
  ["THIGH", "الفخذ"],
  ["INSEAM", "طول الرجل"],
] as const;

function overallLabel(value: Overall) {
  if (value === "TOO_SMALL")
    return "أضيق من المطلوب";
  if (value === "TOO_LARGE")
    return "أوسع من المطلوب";
  return "ممتازة";
}

export default function FeedbackFlow({
  token,
}: {
  token: string;
}) {
  const [page, setPage] =
    useState<PublicFeedbackPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [overall, setOverall] =
    useState<Overall | null>(null);
  const [problemAreas, setProblemAreas] =
    useState<string[]>([]);
  const [note, setNote] = useState("");
  const [success, setSuccess] =
    useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      setError("");
      const data =
        await getPublicFeedback(token);
      setPage(data);
      if (data.submitted) {
        setSuccess(true);
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "تعذر فتح رابط التقييم.",
      );
    } finally {
      setLoading(false);
    }
  }

  const visibleAreas = useMemo(() => {
    const category = page?.product.category ?? "";

    if (
      ["JACKET", "HOODIE", "SHIRT", "TSHIRT"].includes(
        category,
      )
    ) {
      return areas.filter(([key]) =>
        [
          "CHEST",
          "SHOULDER",
          "LENGTH",
          "SLEEVE",
        ].includes(key),
      );
    }

    if (
      ["PANTS", "JEANS"].includes(
        category,
      )
    ) {
      return areas.filter(([key]) =>
        [
          "WAIST",
          "HIPS",
          "THIGH",
          "LENGTH",
          "INSEAM",
        ].includes(key),
      );
    }

    return areas;
  }, [page?.product.category]);

  function toggleArea(area: string) {
    setProblemAreas((current) =>
      current.includes(area)
        ? current.filter((x) => x !== area)
        : [...current, area],
    );
  }

  async function submit() {
    if (!overall) return;

    const payload: SubmitFeedbackPayload = {
      overall,
      problem_areas:
        overall === "PERFECT"
          ? []
          : problemAreas,
      note: note.trim() || undefined,
    };

    try {
      setBusy(true);
      setError("");

      const response =
        await submitPublicFeedback(
          token,
          payload,
        );

      setSuccess(true);

      if (response.return_url && page) {
        setPage({
          ...page,
          return_url:
            response.return_url,
        });
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "تعذر إرسال التقييم.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <Shell>
        <Header />
        <Card
          style={{
            marginTop: 80,
            textAlign: "center",
          }}
        >
          جاري فتح تقييم المقاس...
        </Card>
      </Shell>
    );
  }

  if (!page || error && !success) {
    return (
      <Shell>
        <Header />
        <Card style={{ marginTop: 80 }}>
          <Badge tone="danger">
            رابط غير صالح
          </Badge>
          <h1>تعذر فتح التقييم</h1>
          <p
            style={{
              color: colors.muted,
              lineHeight: 1.8,
            }}
          >
            {error ||
              "قد يكون الرابط منتهي الصلاحية."}
          </p>
        </Card>
      </Shell>
    );
  }

  if (success) {
    return (
      <Shell>
        <Header merchant={page.merchant.name} />
        <Card
          style={{
            marginTop: 40,
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 78,
              height: 78,
              margin: "0 auto 18px",
              borderRadius: 999,
              background: colors.greenSoft,
              color: colors.green,
              display: "grid",
              placeItems: "center",
              fontSize: 34,
              fontWeight: 900,
            }}
          >
            ✓
          </div>

          <h1 style={{ fontSize: 26 }}>
            شكراً! صار September Fit أذكى
          </h1>

          <p
            style={{
              color: colors.muted,
              lineHeight: 1.8,
            }}
          >
            سنستخدم هذا التقييم لتحسين قواعد
            الملاءمة لهذه الفئة مع تراكم
            بيانات كافية.
          </p>

          {page.return_url ? (
            <PrimaryButton
              onClick={() =>
                window.location.assign(
                  page.return_url!,
                )
              }
            >
              العودة إلى {page.merchant.name}
            </PrimaryButton>
          ) : null}
        </Card>
      </Shell>
    );
  }

  return (
    <Shell>
      <Header merchant={page.merchant.name} />

      <Card style={{ marginBottom: 14 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <Badge tone="accent">
            تقييم بعد الاستلام
          </Badge>

          {page.prediction ? (
            <div
              style={{
                color: colors.muted,
                fontSize: 12,
              }}
            >
              توقعنا{" "}
              <strong>
                {page.prediction.fit_score}/100
              </strong>
            </div>
          ) : null}
        </div>

        <h1
          style={{
            fontSize: 24,
            marginBottom: 8,
          }}
        >
          كيف كانت القطعة فعليًا؟
        </h1>

        <p
          style={{
            color: colors.muted,
            lineHeight: 1.8,
          }}
        >
          {page.product.name}
          {page.product.original_size_label
            ? ` · ${page.product.original_size_label}`
            : ""}
        </p>

        <div
          style={{
            display: "grid",
            gap: 10,
            margin: "22px 0",
          }}
        >
          {(
            [
              "TOO_SMALL",
              "PERFECT",
              "TOO_LARGE",
            ] as Overall[]
          ).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setOverall(value);
                if (value === "PERFECT") {
                  setProblemAreas([]);
                }
              }}
              style={{
                height: 54,
                borderRadius: 14,
                border:
                  overall === value
                    ? `2px solid ${colors.accent}`
                    : `1px solid ${colors.border}`,
                background:
                  overall === value
                    ? colors.accentSoft
                    : "white",
                color: colors.text,
                fontWeight: 800,
              }}
            >
              {overallLabel(value)}
            </button>
          ))}
        </div>

        {overall &&
        overall !== "PERFECT" ? (
          <>
            <div
              style={{
                fontWeight: 800,
                marginBottom: 10,
              }}
            >
              أين كانت المشكلة؟
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginBottom: 18,
              }}
            >
              {visibleAreas.map(
                ([key, label]) => {
                  const selected =
                    problemAreas.includes(key);

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() =>
                        toggleArea(key)
                      }
                      style={{
                        borderRadius: 999,
                        border: `1px solid ${
                          selected
                            ? colors.accent
                            : colors.border
                        }`,
                        background: selected
                          ? colors.accentSoft
                          : "white",
                        padding: "9px 12px",
                        color: colors.text,
                        fontWeight: 700,
                      }}
                    >
                      {label}
                    </button>
                  );
                },
              )}
            </div>
          </>
        ) : null}

        <label
          style={{
            display: "block",
            marginBottom: 18,
          }}
        >
          <span
            style={{
              display: "block",
              color: colors.muted,
              fontSize: 12,
              marginBottom: 7,
            }}
          >
            ملاحظة إضافية — اختياري
          </span>

          <textarea
            value={note}
            onChange={(e) =>
              setNote(e.target.value)
            }
            maxLength={1000}
            rows={4}
            placeholder="مثلاً: الصدر ممتاز لكن الكم أطول قليلاً..."
            style={{
              width: "100%",
              resize: "vertical",
              border: `1px solid ${colors.border}`,
              borderRadius: 12,
              padding: 12,
              color: colors.text,
            }}
          />
        </label>

        {error ? (
          <div
            style={{
              background: "#f9e2e3",
              color: colors.danger,
              borderRadius: 12,
              padding: 11,
              marginBottom: 12,
            }}
          >
            {error}
          </div>
        ) : null}

        <PrimaryButton
          disabled={!overall || busy}
          onClick={() => void submit()}
        >
          {busy
            ? "جاري الإرسال..."
            : "إرسال التقييم"}
        </PrimaryButton>
      </Card>

      <p
        style={{
          color: colors.muted,
          fontSize: 11,
          lineHeight: 1.7,
          textAlign: "center",
          padding: "0 24px",
        }}
      >
        لا نعرض قياسات جسمك الخام للمتجر ضمن
        هذه الإحصاءات. نستخدم نتيجة Fit
        والتقييم الفعلي لتحسين النظام.
      </p>
    </Shell>
  );
}
