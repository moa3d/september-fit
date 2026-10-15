"use client";

import { useState } from "react";
import { acceptInvitation } from "../../lib/api";

export default function AcceptInviteClient({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function submit() {
    try {
      await acceptInvitation(token, password);
      setMessage("تم إنشاء الحساب. يمكنك الآن العودة وتسجيل الدخول.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر قبول الدعوة.");
    }
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <section style={{ width: "min(100%, 440px)", background: "white", border: "1px solid #eadfd2", borderRadius: 18, padding: 22 }}>
        <h1>قبول دعوة September Fit</h1>
        <p style={{ color: "#66565a" }}>اختر كلمة مرور لحسابك.</p>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="10 أحرف على الأقل" style={{ width: "100%", height: 44, border: "1px solid #eadfd2", borderRadius: 10, padding: "0 12px", marginBottom: 12 }} />
        <button onClick={() => void submit()} style={{ width: "100%", height: 44, border: 0, borderRadius: 10, background: "#c83f4d", color: "white", fontWeight: 800 }}>إنشاء الحساب</button>
        {message ? <p style={{ color: "#66565a", lineHeight: 1.7 }}>{message}</p> : null}
      </section>
    </main>
  );
}
