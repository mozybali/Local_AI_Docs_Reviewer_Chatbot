import Link from "next/link";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";
import { ui } from "../lib/ui";
import Spinner from "../components/Spinner";

export default function HomePage() {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const router = useRouter();
  // ProtectedRoute, yetkisiz bir sayfadan (ör. /admin) buraya yönlendirdiğinde
  // `?denied=admin` ekler; kullanıcı neden ana sayfaya düştüğünü görsün.
  const accessDenied = router.query.denied === "admin";

  return (
    <div style={ui.page} className="ld-page">
      <div style={ui.card} className="ld-card ld-fade-in">
        <h1 style={ui.title}>LocalDoc AI</h1>
        <p style={ui.subtitle}>
          Lokal AI destekli doküman soru-cevap sistemi.
        </p>

        {accessDenied && (
          <div style={ui.error} className="ld-fade-in" role="alert">
            Bu sayfaya erişim yetkiniz yok; ana sayfaya yönlendirildiniz.
          </div>
        )}

        {loading ? (
          <p
            style={{
              color: "#94a3b8",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <Spinner /> Yükleniyor...
          </p>
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
            {user?.role === "admin" && (
              <Link href="/admin">
                <button
                  style={{
                    ...ui.button,
                    background: "transparent",
                    color: "#fbbf24",
                    border: "1px solid #78350f",
                    marginTop: "0.75rem",
                  }}
                >
                  Admin Paneli
                </button>
              </Link>
            )}
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
