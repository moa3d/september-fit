"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  calculateHostedFit,
  getHostedSession,
  saveHostedProfile,
} from "../lib/api";
import type {
  FitMetricDetail,
  FitPreference,
  HostedSession,
  ProfileType,
  FitResultPayload,
  PublicCalculateResponse,
  PublicProfilePayload,
} from "../lib/types";
import {
  Badge,
  Card,
  Choice,
  Field,
  Header,
  PrimaryButton,
  Progress,
  SecondaryButton,
  Shell,
  colors,
} from "./ui";

type Step = "loading" | "intro" | "basic" | "preference" | "precise" | "result" | "error";

interface FormState {
  profileType: ProfileType;
  preferredFit: FitPreference;
  height: string;
  weight: string;
  chest: string;
  waist: string;
  hips: string;
  shoulder: string;
  sleeve: string;
  inseam: string;
  thigh: string;
}

const initialForm: FormState = {
  profileType: "UNISEX",
  preferredFit: "REGULAR",
  height: "",
  weight: "",
  chest: "",
  waist: "",
  hips: "",
  shoulder: "",
  sleeve: "",
  inseam: "",
  thigh: "",
};

const upperCategories = new Set(["JACKET", "HOODIE", "SHIRT", "TSHIRT"]);
const lowerCategories = new Set(["PANTS", "JEANS"]);

function numberOrUndefined(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function labelForPreference(value: FitPreference) {
  return value === "SLIM"
    ? "ضيقة"
    : value === "LOOSE"
      ? "واسعة"
      : "عادية — Regular";
}

function metricArabic(metric: string) {
  const map: Record<string, string> = {
    chestEase: "الصدر",
    shoulderDelta: "الكتف",
    sleeveDelta: "طول الكم",
    waistEase: "الخصر",
    hipEase: "الورك",
    thighEase: "الفخذ",
    inseamDelta: "طول الرجل",
  };
  return map[metric] ?? metric;
}

function metricStatusArabic(status?: string) {
  const map: Record<string, string> = {
    EXCELLENT: "ممتاز",
    GOOD: "مناسب",
    BORDERLINE: "على الحد",
    POOR: "غير مناسب",
  };
  return map[status ?? ""] ?? status ?? "";
}

function metricTone(status?: string): "green" | "warning" | "danger" {
  if (status === "EXCELLENT" || status === "GOOD") return "green";
  if (status === "BORDERLINE") return "warning";
  return "danger";
}


function getEmbedContext() {
  if (typeof window === "undefined") {
    return { embedded: false, parentOrigin: null as string | null };
  }

  const params = new URLSearchParams(window.location.search);
  const embedded = params.get("embed") === "1" && window.parent !== window;
  const parentOrigin = params.get("parent_origin");

  return { embedded, parentOrigin };
}

export default function HostedFitFlow({ token }: { token: string }) {
  const [step, setStep] = useState<Step>("loading");
  const [session, setSession] = useState<HostedSession | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const [result, setResult] = useState<FitResultPayload | null>(null);
  const [returnUrl, setReturnUrl] = useState<string | null>(null);
  const [error, setError] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setStep("loading");
      const data = await getHostedSession(token);
      setSession(data);
      setReturnUrl(data.return_url);

      if (data.result) {
        setResult({
          id: data.result.id,
          fit_score: data.result.fit_score,
          label: data.result.label,
          label_ar: data.result.label_ar ?? "",
          confidence: data.result.confidence,
          confidence_score:
            data.result.confidence_score,
          predicted_fit:
            data.result.predicted_fit,
          engine_version:
            data.result.engine_version,
          coverage: data.result.coverage,
          details: data.result.details ?? {},
          warnings: data.result.warnings ?? [],
        });
        setStep("result");
      } else {
        setStep("intro");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر فتح جلسة September Fit.");
      setStep("error");
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const category = session?.product.category ?? "";
  const requiresChest = upperCategories.has(category);
  const requiresWaist = lowerCategories.has(category);

  const preciseReady = useMemo(() => {
    if (requiresChest) return Number(form.chest) > 0;
    if (requiresWaist) return Number(form.waist) > 0;
    return Number(form.chest) > 0 || Number(form.waist) > 0;
  }, [form.chest, form.waist, requiresChest, requiresWaist]);

  const basicReady = true;

  const patch = (key: keyof FormState, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  async function submitProfileAndCalculate() {
    if (!preciseReady) return;

    const payload: PublicProfilePayload = {
      profile_type: form.profileType,
      preferred_fit: form.preferredFit,
      height_cm: numberOrUndefined(form.height),
      weight_kg: numberOrUndefined(form.weight),
      chest_cm: numberOrUndefined(form.chest),
      waist_cm: numberOrUndefined(form.waist),
      hips_cm: numberOrUndefined(form.hips),
      shoulder_cm: numberOrUndefined(form.shoulder),
      sleeve_cm: numberOrUndefined(form.sleeve),
      inseam_cm: numberOrUndefined(form.inseam),
      thigh_cm: numberOrUndefined(form.thigh),
    };

    try {
      setBusy(true);
      setError("");
      await saveHostedProfile(token, payload);
      const response = await calculateHostedFit(token);

      if (!response.result) {
        throw new Error("لم نستطع حساب الملاءمة بهذه البيانات.");
      }

      setResult(response.result);
      setReturnUrl(response.return_url ?? session?.return_url ?? null);
      setStep("result");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "تعذر حساب الملاءمة.",
      );
    } finally {
      setBusy(false);
    }
  }

  function goBackToMerchant() {
    const embed = getEmbedContext();

    if (embed.embedded && embed.parentOrigin) {
      window.parent.postMessage(
        {
          type: "september-fit:complete",
          sessionId: session.session_id,
          returnUrl,
          fitScore: result?.fit_score,
          label: result?.label,
          confidence: result?.confidence,
        },
        embed.parentOrigin,
      );
      return;
    }

    if (returnUrl) {
      window.location.assign(returnUrl);
    }
  }

  if (step === "loading") {
    return (
      <Shell>
        <Header />
        <Card style={{ marginTop: 80, textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 10 }}>
            جاري تحميل September Fit...
          </div>
          <div style={{ color: colors.muted }}>
            نتحقق من الجلسة والقطعة.
          </div>
        </Card>
      </Shell>
    );
  }

  if (step === "error" || !session) {
    return (
      <Shell>
        <Header />
        <Card style={{ marginTop: 80 }}>
          <Badge tone="danger">تعذر فتح الجلسة</Badge>
          <h1 style={{ fontSize: 25 }}>رابط Fit غير صالح أو انتهت صلاحيته</h1>
          <p style={{ color: colors.muted, lineHeight: 1.8 }}>
            {error || "ارجع إلى المتجر وابدأ عملية Fit جديدة."}
          </p>
          <PrimaryButton onClick={() => void load()}>
            إعادة المحاولة
          </PrimaryButton>
        </Card>
      </Shell>
    );
  }

  if (step === "intro") {
    return (
      <Shell>
        <Header merchant={session.merchant.name} />
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div
            style={{
              minHeight: 270,
              background: colors.soft,
              display: "grid",
              placeItems: "center",
              padding: 24,
              textAlign: "center",
            }}
          >
            <div>
              <div
                style={{
                  width: 88,
                  height: 88,
                  margin: "0 auto 16px",
                  borderRadius: 999,
                  background: colors.accent,
                  color: "white",
                  display: "grid",
                  placeItems: "center",
                  fontWeight: 900,
                  fontSize: 22,
                }}
              >
                FIT
              </div>
              <div style={{ fontWeight: 800, color: colors.text }}>
                {session.product.name}
              </div>
            </div>
          </div>

          <div style={{ padding: 20 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              {session.product.original_size_label ? (
                <Badge tone="accent">
                  المقاس {session.product.original_size_label}
                </Badge>
              ) : null}
              {session.product.measurement_quality ? (
                <Badge>
                  قياسات {session.product.measurement_quality}
                </Badge>
              ) : null}
            </div>

            <h1 style={{ fontSize: 25, marginBottom: 10 }}>
              هل تناسبك هذه القطعة؟
            </h1>
            <p style={{ color: colors.muted, lineHeight: 1.8 }}>
              نقارن قياسات جسمك مع القياسات الحقيقية لهذه القطعة ونشرح
              لك النتيجة قبل الطلب.
            </p>

            <div
              style={{
                background: colors.greenSoft,
                borderRadius: 14,
                padding: 14,
                fontSize: 12,
                color: colors.green,
                lineHeight: 1.8,
                margin: "18px 0",
              }}
            >
              بيانات قياسات جسمك تبقى داخل September Fit ولا نعرض
              القياسات الخام للمتجر ضمن نتيجة Fit العادية.
            </div>

            <PrimaryButton onClick={() => setStep("basic")}>
              ابدأ — أقل من دقيقة
            </PrimaryButton>
          </div>
        </Card>
      </Shell>
    );
  }

  if (step === "basic") {
    return (
      <Shell>
        <Header merchant={session.merchant.name} />
        <Progress step={1} />
        <Card>
          <h1 style={{ fontSize: 24, marginTop: 0 }}>
            معلومات سريعة عنك
          </h1>
          <p style={{ color: colors.muted, lineHeight: 1.8 }}>
            الطول والوزن يساعداننا في بناء ملفك، لكن نتيجة V1 الدقيقة
            تعتمد أيضًا على قياس أساسي من الجسم.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              margin: "20px 0",
            }}
          >
            <Field
              label="الطول — اختياري"
              value={form.height}
              onChange={(v) => patch("height", v)}
              suffix="سم"
              min={80}
              max={250}
              required
            />
            <Field
              label="الوزن — اختياري"
              value={form.weight}
              onChange={(v) => patch("weight", v)}
              suffix="كغ"
              min={20}
              max={350}
              required
            />
          </div>

          <div style={{ marginBottom: 14, fontSize: 12, color: colors.muted }}>
            نوع الملف
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 8,
              marginBottom: 22,
            }}
          >
            <Choice
              label="رجالي"
              selected={form.profileType === "MENS"}
              onClick={() =>
                setForm((x) => ({ ...x, profileType: "MENS" }))
              }
            />
            <Choice
              label="نسائي"
              selected={form.profileType === "WOMENS"}
              onClick={() =>
                setForm((x) => ({ ...x, profileType: "WOMENS" }))
              }
            />
            <Choice
              label="عام"
              selected={form.profileType === "UNISEX"}
              onClick={() =>
                setForm((x) => ({ ...x, profileType: "UNISEX" }))
              }
            />
          </div>

          <PrimaryButton
            disabled={!basicReady}
            onClick={() => setStep("preference")}
          >
            التالي
          </PrimaryButton>
        </Card>
      </Shell>
    );
  }

  if (step === "preference") {
    return (
      <Shell>
        <Header merchant={session.merchant.name} />
        <Progress step={2} />
        <Card>
          <h1 style={{ fontSize: 24, marginTop: 0 }}>
            كيف بتحب تلبس القطعة؟
          </h1>
          <p style={{ color: colors.muted, lineHeight: 1.8 }}>
            نفس القياسات قد تكون ممتازة لشخص يفضل Regular وأوسع من
            المطلوب لشخص يفضل Slim.
          </p>

          <div style={{ display: "grid", gap: 10, margin: "20px 0" }}>
            <Choice
              label="ضيقة — Slim"
              description="قريبة من الجسم ومساحة الحركة أقل."
              selected={form.preferredFit === "SLIM"}
              onClick={() =>
                setForm((x) => ({ ...x, preferredFit: "SLIM" }))
              }
            />
            <Choice
              label="عادية — Regular"
              description="قصة متوازنة وراحة طبيعية."
              selected={form.preferredFit === "REGULAR"}
              onClick={() =>
                setForm((x) => ({ ...x, preferredFit: "REGULAR" }))
              }
            />
            <Choice
              label="واسعة — Loose"
              description="مساحة وراحة إضافية حول الجسم."
              selected={form.preferredFit === "LOOSE"}
              onClick={() =>
                setForm((x) => ({ ...x, preferredFit: "LOOSE" }))
              }
            />
          </div>

          <PrimaryButton onClick={() => setStep("precise")}>
            التالي
          </PrimaryButton>
        </Card>
      </Shell>
    );
  }

  if (step === "precise") {
    const primaryCopy = requiresChest
      ? "محيط الصدر مطلوب لهذه القطعة"
      : requiresWaist
        ? "محيط الخصر مطلوب لهذه القطعة"
        : "أدخل القياس الأساسي الأقرب لهذه الفئة";

    return (
      <Shell>
        <Header merchant={session.merchant.name} />
        <Progress step={3} />
        <Card>
          <h1 style={{ fontSize: 24, marginTop: 0 }}>
            القياسات الدقيقة
          </h1>
          <p style={{ color: colors.muted, lineHeight: 1.8 }}>
            {primaryCopy}. كل قياس إضافي يزيد Coverage ومستوى الثقة.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              margin: "20px 0",
            }}
          >
            <Field
              label="محيط الصدر"
              value={form.chest}
              onChange={(v) => patch("chest", v)}
              suffix="سم"
              required={requiresChest}
              min={30}
              max={250}
            />
            <Field
              label="عرض الكتف"
              value={form.shoulder}
              onChange={(v) => patch("shoulder", v)}
              suffix="سم"
              min={20}
              max={100}
            />
            <Field
              label="محيط الخصر"
              value={form.waist}
              onChange={(v) => patch("waist", v)}
              suffix="سم"
              required={requiresWaist}
              min={30}
              max={250}
            />
            <Field
              label="محيط الورك"
              value={form.hips}
              onChange={(v) => patch("hips", v)}
              suffix="سم"
              min={30}
              max={250}
            />
            <Field
              label="طول الذراع"
              value={form.sleeve}
              onChange={(v) => patch("sleeve", v)}
              suffix="سم"
              min={20}
              max={120}
            />
            <Field
              label="محيط الفخذ"
              value={form.thigh}
              onChange={(v) => patch("thigh", v)}
              suffix="سم"
              min={20}
              max={150}
            />
            <Field
              label="طول الرجل الداخلي"
              value={form.inseam}
              onChange={(v) => patch("inseam", v)}
              suffix="سم"
              min={20}
              max={150}
            />
          </div>

          {error ? (
            <div
              style={{
                background: "#f9e2e3",
                color: colors.danger,
                padding: 12,
                borderRadius: 12,
                fontSize: 12,
                lineHeight: 1.6,
                marginBottom: 14,
              }}
            >
              {error}
            </div>
          ) : null}

          <PrimaryButton
            disabled={!preciseReady || busy}
            onClick={() => void submitProfileAndCalculate()}
          >
            {busy ? "جاري الحساب..." : "احسب الملاءمة"}
          </PrimaryButton>
        </Card>
      </Shell>
    );
  }

  if (step === "result" && result) {
    const metrics = Object.entries(
      result.details ?? {},
    ) as Array<[string, FitMetricDetail]>;
    const score = result.fit_score;
    const tone =
      score >= 80 ? "green" : score >= 65 ? "warning" : "danger";

    return (
      <Shell>
        <Header merchant={session.merchant.name} />

        <Card style={{ marginBottom: 14 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "center",
            }}
          >
            <Badge tone={tone}>
              {result.label_ar ||
                (result.label === "EXCELLENT"
                  ? "مناسبة لك جدًا"
                  : result.label)}
            </Badge>
            <div style={{ color: colors.muted, fontSize: 12 }}>
              {session.product.name}
            </div>
          </div>

          <div
            style={{
              fontSize: 52,
              lineHeight: 1,
              fontWeight: 900,
              margin: "26px 0 8px",
            }}
          >
            {score}
            <span
              style={{
                fontSize: 18,
                color: colors.muted,
                fontWeight: 600,
              }}
            >
              {" "}
              / 100
            </span>
          </div>

          <div style={{ color: colors.muted, marginBottom: 18 }}>
            التوقع الأقرب:{" "}
            <strong style={{ color: colors.text }}>
              {result.predicted_fit
                ? labelForPreference(result.predicted_fit)
                : "غير محدد"}
            </strong>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
              marginBottom: 18,
            }}
          >
            <div
              style={{
                background: colors.soft,
                borderRadius: 14,
                padding: 12,
              }}
            >
              <div style={{ color: colors.muted, fontSize: 11 }}>
                مستوى الثقة
              </div>
              <strong>{result.confidence}</strong>
            </div>
            <div
              style={{
                background: colors.soft,
                borderRadius: 14,
                padding: 12,
              }}
            >
              <div style={{ color: colors.muted, fontSize: 11 }}>
                Engine
              </div>
              <strong>{result.engine_version || "rules-1.0.0"}</strong>
            </div>
          </div>

          {metrics.length > 0 ? (
            <div style={{ display: "grid", gap: 9 }}>
              {metrics.map(([key, metric]) => (
                <div
                  key={key}
                  style={{
                    borderTop: `1px solid ${colors.border}`,
                    paddingTop: 10,
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>
                      {metricArabic(key)}
                    </div>
                    {metric.explanation ? (
                      <div
                        style={{
                          color: colors.muted,
                          fontSize: 11,
                          lineHeight: 1.6,
                          marginTop: 3,
                        }}
                      >
                        {metric.explanation}
                      </div>
                    ) : null}
                  </div>
                  <Badge tone={metricTone(metric.status)}>
                    {metricStatusArabic(metric.status)}
                  </Badge>
                </div>
              ))}
            </div>
          ) : null}
        </Card>

        {result.warnings?.length ? (
          <Card
            style={{
              background: "#f8edd9",
              borderColor: "#ead4ac",
              marginBottom: 14,
            }}
          >
            <strong style={{ color: colors.warning }}>
              ملاحظة حول دقة النتيجة
            </strong>
            <ul
              style={{
                color: colors.warning,
                fontSize: 12,
                lineHeight: 1.8,
                paddingRight: 20,
                marginBottom: 0,
              }}
            >
              {result.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </Card>
        ) : null}

        {returnUrl ? (
          <PrimaryButton onClick={goBackToMerchant}>
            العودة إلى {session.merchant.name}
          </PrimaryButton>
        ) : null}

        <div style={{ height: 10 }} />

        <SecondaryButton onClick={() => setStep("precise")}>
          تعديل القياسات وإعادة الحساب
        </SecondaryButton>

        <p
          style={{
            color: colors.muted,
            fontSize: 11,
            lineHeight: 1.7,
            textAlign: "center",
            padding: "14px 24px",
          }}
        >
          Fit Score هو تقييم ملاءمة للمنتج، وليس نسبة دقة علمية أو
          ضمانًا للمقاس.
        </p>
      </Shell>
    );
  }

  return null;
}
