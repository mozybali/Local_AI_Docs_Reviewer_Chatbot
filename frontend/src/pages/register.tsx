import { useState, type CSSProperties, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  UserPlus,
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
const requirementRow: CSSProperties = {
  margin: 0,
  display: "flex",
  alignItems: "center",
  gap: "0.35rem",
  fontSize: "0.75rem",
};

// Backend'deki kurallarla senkron (bkz. backend/app/routers/auth.py UserCreate):
// şifre en az 8 karakter, bcrypt nedeniyle en fazla 72 byte.
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_BYTES = 72;

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const passwordLongEnough = password.length >= PASSWORD_MIN_LENGTH;
  const passwordTooManyBytes =
    new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!passwordLongEnough) {
      setError(`Şifre en az ${PASSWORD_MIN_LENGTH} karakter olmalıdır.`);
      return;
    }
    if (passwordTooManyBytes) {
      setError(
        `Şifre en fazla ${PASSWORD_MAX_BYTES} byte olabilir ` +
          "(Türkçe karakterler birden fazla byte sayılır).",
      );
      return;
    }

    setSubmitting(true);
    try {
      await register(email, password);
      await router.push("/upload");
    } catch (err) {
      setError(getErrorMessage(err, "Kayıt sırasında bir hata oluştu."));
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
            <Sparkles size={13} /> Bugün deneyin
          </span>
        </div>
        <h1 style={ui.title}>Hesap Oluştur</h1>
        <p style={ui.subtitle}>
          Şirket dokümanlarınızı güvenli AI bilgi merkezine dönüştürmeye
          dakikalar içinde başlayın.
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
        <div style={{ ...fieldWrap, marginBottom: "0.4rem" }}>
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
            minLength={PASSWORD_MIN_LENGTH}
            autoComplete="new-password"
            placeholder={`En az ${PASSWORD_MIN_LENGTH} karakter`}
            aria-describedby="password-requirements"
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
        <div
          id="password-requirements"
          style={{
            margin: "0 0 1rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.3rem",
          }}
        >
          <p
            style={{
              ...requirementRow,
              color: passwordLongEnough ? t.color.emerald : t.color.subtle,
            }}
          >
            {passwordLongEnough ? (
              <CheckCircle2 size={13} style={{ flexShrink: 0 }} />
            ) : (
              <Circle size={13} style={{ flexShrink: 0 }} />
            )}
            En az {PASSWORD_MIN_LENGTH} karakter
          </p>
          {passwordTooManyBytes && (
            <p
              className="ld-fade-in"
              style={{ ...requirementRow, color: t.color.danger }}
            >
              <AlertCircle size={13} style={{ flexShrink: 0 }} />
              En fazla {PASSWORD_MAX_BYTES} byte (Türkçe karakterler birden
              fazla byte sayılır)
            </p>
          )}
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
          {submitting ? <Spinner size={16} color={t.color.onPrimary} /> : <UserPlus size={16} />}
          {submitting ? "Hesap oluşturuluyor..." : "Hesap Oluştur"}
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
          Dokümanlarınız yalnızca size özel alanda işlenir ve saklanır.
        </p>

        <p style={ui.footerText}>
          Zaten hesabınız var mı? <Link href="/login">Giriş yapın</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
