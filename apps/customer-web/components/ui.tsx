"use client";

import type { CSSProperties, ReactNode } from "react";

export const colors = {
  accent: "#c83f4d",
  accentSoft: "#f4d7da",
  page: "#faf7f1",
  surface: "#ffffff",
  soft: "#f2eadf",
  text: "#261a1d",
  muted: "#66565a",
  border: "#eadfd2",
  green: "#3f7d56",
  greenSoft: "#e4f2e8",
  warning: "#a66a2c",
  danger: "#a43d42",
};

export function Shell({ children }: { children: ReactNode }) {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: colors.page,
        padding: "0 16px 48px",
      }}
    >
      <div
        style={{
          maxWidth: 560,
          margin: "0 auto",
        }}
      >
        {children}
      </div>
    </main>
  );
}

export function Header({
  merchant,
}: {
  merchant?: string | null;
}) {
  return (
    <header
      style={{
        height: 72,
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div style={{ color: colors.muted, fontSize: 12 }}>
        {merchant ?? ""}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 800,
          color: colors.accent,
        }}
      >
        September Fit
      </div>
      <div style={{ textAlign: "left", color: colors.muted }}>
        FIT
      </div>
    </header>
  );
}

export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <section
      style={{
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: 20,
        padding: 20,
        boxShadow: "0 10px 30px rgba(41, 26, 28, 0.06)",
        ...style,
      }}
    >
      {children}
    </section>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        height: 52,
        border: 0,
        borderRadius: 14,
        background: disabled ? "#d9b8bc" : colors.accent,
        color: "white",
        fontWeight: 800,
        fontSize: 15,
      }}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        height: 48,
        border: `1px solid ${colors.accent}`,
        borderRadius: 14,
        background: "white",
        color: colors.accent,
        fontWeight: 700,
        fontSize: 14,
      }}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  value,
  onChange,
  placeholder,
  suffix,
  required,
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  suffix?: string;
  required?: boolean;
  min?: number;
  max?: number;
}) {
  return (
    <label style={{ display: "block" }}>
      <span
        style={{
          display: "block",
          fontSize: 12,
          color: colors.muted,
          marginBottom: 7,
          fontWeight: 600,
        }}
      >
        {label}
        {required ? " *" : ""}
      </span>
      <div style={{ position: "relative" }}>
        <input
          type="number"
          min={min}
          max={max}
          step="0.1"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          style={{
            width: "100%",
            height: 48,
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            background: "white",
            color: colors.text,
            padding: suffix ? "0 14px 0 55px" : "0 14px",
            outline: "none",
          }}
        />
        {suffix ? (
          <span
            style={{
              position: "absolute",
              left: 14,
              top: 14,
              fontSize: 12,
              color: colors.muted,
            }}
          >
            {suffix}
          </span>
        ) : null}
      </div>
    </label>
  );
}

export function Choice({
  label,
  description,
  selected,
  onClick,
}: {
  label: string;
  description?: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "right",
        padding: "14px 16px",
        borderRadius: 14,
        border: `1px solid ${selected ? colors.accent : colors.border}`,
        background: selected ? colors.accentSoft : "white",
        color: colors.text,
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: description ? 4 : 0 }}>
        {label}
      </div>
      {description ? (
        <div style={{ fontSize: 12, color: colors.muted, lineHeight: 1.6 }}>
          {description}
        </div>
      ) : null}
    </button>
  );
}

export function Progress({ step }: { step: number }) {
  return (
    <div style={{ display: "flex", gap: 8, margin: "8px 0 22px" }}>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: 5,
            borderRadius: 999,
            background: i <= step ? colors.accent : colors.accentSoft,
          }}
        />
      ))}
    </div>
  );
}

export function Badge({
  children,
  tone = "green",
}: {
  children: ReactNode;
  tone?: "green" | "warning" | "danger" | "accent";
}) {
  const style =
    tone === "green"
      ? { background: colors.greenSoft, color: colors.green }
      : tone === "warning"
        ? { background: "#f8edd9", color: colors.warning }
        : tone === "danger"
          ? { background: "#f9e2e3", color: colors.danger }
          : { background: colors.accentSoft, color: colors.accent };

  return (
    <span
      style={{
        display: "inline-flex",
        borderRadius: 999,
        padding: "6px 10px",
        fontSize: 11,
        fontWeight: 800,
        ...style,
      }}
    >
      {children}
    </span>
  );
}
