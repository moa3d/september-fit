"use client";

import { useState } from "react";
import { resetPassword } from "../../lib/api";

export default function ResetPasswordClient({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function submit() {
    try {
      await resetPassword(token, password);
      setMessage("تم تغيير كلمة المرور وإلغاء جميع الجلسات السابقة.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر تغيير كلمة المرور.");
    }
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <section style={{ width: "min(100%, 440px)", background: "white", border: "1px solid #eadfd2", borderRadius: 18, padding: 22 }}>
        <h1>كلمة مرور جديدة</h1>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="10 أحرف على الأقل" style={{ width: "100%", height: 44, border: "1px solid #eadfd2", borderRadius: 10, padding: "0 12px", marginBottom: 12 }} />
        <button onClick={() => void submit()} style={{ width: "100%", height: 44, border: 0, borderRadius: 10, background: "#c83f4d", color: "white", fontWeight: 800 }}>تغيير كلمة المرور</button>
        {message ? <p style={{ color: "#66565a" }}>{message}</p> : null}
      </section>
    </main>
  );
}
