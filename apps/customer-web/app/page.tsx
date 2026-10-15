export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <section
        style={{
          maxWidth: 720,
          width: "100%",
          background: "white",
          border: "1px solid #eadfd2",
          borderRadius: 24,
          padding: 32,
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "inline-grid",
            placeItems: "center",
            width: 76,
            height: 76,
            borderRadius: 999,
            background: "#c83f4d",
            color: "white",
            fontWeight: 800,
            fontSize: 20,
            marginBottom: 18,
          }}
        >
          FIT
        </div>
        <h1 style={{ fontSize: 34, margin: "0 0 12px" }}>
          September Fit
        </h1>
        <p style={{ color: "#66565a", lineHeight: 1.8, margin: 0 }}>
          هذه الخدمة تُفتح من رابط Fit Session ينشئه المتجر.
          إذا وصلت إلى هذه الصفحة مباشرة، ارجع إلى المتجر واضغط
          زر «هل تناسبني هذه القطعة؟».
        </p>
      </section>
    </main>
  );
}
