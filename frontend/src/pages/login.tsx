import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { AlertCircle, LogIn } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getErrorMessage } from "../lib/api";
import { ui } from "../lib/ui";
import Spinner from "../components/Spinner";
import AuthLayout from "../components/AuthLayout";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
        <h1 style={ui.title}>Giriş Yap</h1>
        <p style={ui.subtitle}>LocalDoc AI hesabınıza erişin.</p>

        {error && (
          <div style={ui.error} className="ld-fade-in" role="alert">
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{error}</span>
          </div>
        )}

        <label style={ui.label} htmlFor="email">
          E-posta
        </label>
        <input
          id="email"
          type="email"
          style={ui.input}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          placeholder="ornek@eposta.com"
        />

        <label style={ui.label} htmlFor="password">
          Şifre
        </label>
        <input
          id="password"
          type="password"
          style={ui.input}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          placeholder="••••••••"
        />

        <button
          type="submit"
          className="ld-btn"
          style={{
            ...ui.button,
            ...(submitting ? ui.buttonDisabled : {}),
          }}
          disabled={submitting}
        >
          {submitting ? <Spinner size={16} color="#fff" /> : <LogIn size={16} />}
          {submitting ? "Giriş yapılıyor..." : "Giriş Yap"}
        </button>

        <p style={ui.footerText}>
          Hesabın yok mu? <Link href="/register">Kayıt ol</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
