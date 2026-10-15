"use client";

import { useEffect, useState } from "react";
import { verifyEmail } from "../../lib/api";

export default function VerifyEmailClient({ token }: { token: string }) {
  const [message, setMessage] = useState("جاري التحقق...");

  useEffect(() => {
    void verifyEmail(token)
      .then(() => setMessage("تم تأكيد البريد الإلكتروني بنجاح."))
      .catch((error) => setMessage(error instanceof Error ? error.message : "تعذر تأكيد البريد."));
  }, [token]);

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <section style={{ width: "min(100%, 440px)", background: "white", border: "1px solid #eadfd2", borderRadius: 18, padding: 22, textAlign: "center" }}>
        <h1>September Fit</h1>
        <p style={{ color: "#66565a" }}>{message}</p>
      </section>
    </main>
  );
}
