import { useState, type CSSProperties, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  AlertCircle,
  Eye,
  EyeOff,
  Lock,
  LogIn,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getErrorMessage } from "../lib/api";
import { glass as g, tokens as t, ui } from "../lib/ui";
import Spinner from "../components/Spinner";
import AuthLayout from "../components/AuthLayout";

// Form alanlarında paylaşılan küçük stiller.
const fieldWrap: CSSProperties = { position: "relative", marginBottom: "1rem" };
const fieldIcon: CSSProperties = {
  position: "absolute",
  left: 12,
  top: "50%",
  transform: "translateY(-50%)",
  pointerEvents: "none",
};
const eyeButton: CSSProperties = {
  position: "absolute",
  right: 6,
  top: "50%",
  transform: "translateY(-50%)",
  display: "inline-flex",
  padding: "0.35rem",
  background: "transparent",
  border: "none",
  color: t.color.subtle,
  cursor: "pointer",
};

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      await router.push("/upload");
    } catch (err) {
      setError(getErrorMessage(err, "Giriş sırasında bir hata oluştu."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <form
        style={{ ...ui.card, maxWidth: "none" }}
        className="ld-card ld-glass ld-fade-up"
        onSubmit={handleSubmit}
      >
        <div style={{ marginBottom: "1rem" }}>
          <span style={g.kicker}>
            <ShieldCheck size={13} /> Güvenli oturum
          </span>
        </div>
        <h1 style={ui.title}>Giriş Yap</h1>
        <p style={ui.subtitle}>
          Kurumsal doküman çalışma alanınıza erişin; kaldığınız yerden devam
          edin.
        </p>

        {error && (
          <div style={ui.error} className="ld-fade-in" role="alert">
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{error}</span>
          </div>
        )}

        <label style={ui.label} htmlFor="email">
          Kurumsal e-posta
        </label>
        <div style={fieldWrap}>
          <Mail size={15} color={t.color.subtle} style={fieldIcon} />
          <input
            id="email"
            type="email"
            style={{ ...ui.input, marginBottom: 0, paddingLeft: "2.4rem" }}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="ad.soyad@sirketiniz.com"
          />
        </div>

        <label style={ui.label} htmlFor="password">
          Şifre
        </label>
        <div style={fieldWrap}>
          <Lock size={15} color={t.color.subtle} style={fieldIcon} />
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            style={{
              ...ui.input,
              marginBottom: 0,
              paddingLeft: "2.4rem",
              paddingRight: "2.6rem",
            }}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
            style={eyeButton}
          >
            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>

        <button
          type="submit"
          className="ld-btn"
          style={{
            ...ui.button,
            ...(submitting ? ui.buttonDisabled : {}),
          }}
          disabled={submitting}
        >
          {submitting ? <Spinner size={16} color={t.color.onPrimary} /> : <LogIn size={16} />}
          {submitting ? "Giriş yapılıyor..." : "Giriş Yap"}
        </button>

        <p
          style={{
            margin: "0.9rem 0 0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.4rem",
            fontSize: "0.75rem",
            color: t.color.subtle,
          }}
        >
          <ShieldCheck size={13} style={{ flexShrink: 0 }} />
          Oturumunuz kurumsal kimlik doğrulamasıyla korunur.
        </p>

        <p style={ui.footerText}>
          Hesabınız yok mu? <Link href="/register">Hesap oluşturun</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
