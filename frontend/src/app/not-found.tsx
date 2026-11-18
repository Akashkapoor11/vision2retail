import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--canvas)",
      fontFamily: "Inter, system-ui, sans-serif",
      gap: 16,
    }}>
      <div style={{ fontSize: 64, fontWeight: 800, color: "var(--blue)", lineHeight: 1 }}>404</div>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--ink)" }}>Page not found</h1>
      <p style={{ margin: 0, color: "var(--muted)", fontSize: 15 }}>
        The analysis job or page you are looking for does not exist.
      </p>
      <Link
        href="/"
        style={{
          marginTop: 8,
          padding: "10px 22px",
          background: "var(--blue)",
          color: "#fff",
          borderRadius: 10,
          textDecoration: "none",
          fontWeight: 600,
          fontSize: 14,
        }}
      >
        Back to Dashboard
      </Link>
    </div>
  );
}