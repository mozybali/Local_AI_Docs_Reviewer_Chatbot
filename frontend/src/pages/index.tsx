import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import { ui } from "../lib/ui";

export default function HomePage() {
  const { user, isAuthenticated, loading, logout } = useAuth();

  return (
    <div style={ui.page}>
      <div style={ui.card}>
        <h1 style={ui.title}>LocalDoc AI</h1>
        <p style={ui.subtitle}>
          Lokal AI destekli doküman soru-cevap sistemi.
        </p>

        {loading ? (
          <p style={{ color: "#94a3b8" }}>Yükleniyor...</p>
        ) : isAuthenticated ? (
          <>
            <p style={{ marginBottom: "1rem" }}>
              Hoş geldin, <strong>{user?.email}</strong>
              {user?.role === "admin" ? " (admin)" : ""}.
            </p>
            <Link href="/chat">
              <button style={ui.button}>Soru Sor (Sohbet)</button>
            </Link>
            <Link href="/upload">
              <button
                style={{
                  ...ui.button,
                  background: "transparent",
                  color: "#60a5fa",
                  border: "1px solid #334155",
                  marginTop: "0.75rem",
                }}
              >
                Doküman Yükle
              </button>
            </Link>
            <Link href="/documents">
              <button
                style={{
                  ...ui.button,
                  background: "transparent",
                  color: "#60a5fa",
                  border: "1px solid #334155",
                  marginTop: "0.75rem",
                }}
              >
                Dokümanlarım
              </button>
            </Link>
            <button
              type="button"
              onClick={logout}
              style={{
                ...ui.button,
                background: "transparent",
                color: "#f87171",
                border: "1px solid #7f1d1d",
                marginTop: "0.75rem",
              }}
            >
              Çıkış Yap
            </button>
          </>
        ) : (
          <>
            <Link href="/login">
              <button style={ui.button}>Giriş Yap</button>
            </Link>
            <Link href="/register">
              <button
                style={{
                  ...ui.button,
                  background: "transparent",
                  color: "#60a5fa",
                  border: "1px solid #334155",
                  marginTop: "0.75rem",
                }}
              >
                Kayıt Ol
              </button>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
