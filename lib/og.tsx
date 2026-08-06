export function OgContent({ subtitle }: { subtitle?: string }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#ffffff",
        backgroundImage: "linear-gradient(to bottom, #fef2f2, #ffffff)",
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: 96,
          fontWeight: 700,
          color: "#18181b",
          letterSpacing: -2,
        }}
      >
        PDF
        <span style={{ color: "#dc2626" }}>Compact</span>
      </div>
      <div style={{ display: "flex", fontSize: 32, color: "#52525b", marginTop: 28 }}>
        {subtitle ?? "Free PDF tools that run entirely in your browser"}
      </div>
    </div>
  );
}
