import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { AlertCircle, UserPlus } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getErrorMessage } from "../lib/api";
import { ui, tokens as t } from "../lib/ui";
import Spinner from "../components/Spinner";
import AuthLayout from "../components/AuthLayout";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Şifre en az 6 karakter olmalıdır.");
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
        <h1 style={ui.title}>Kayıt Ol</h1>
        <p style={ui.subtitle}>Yeni bir LocalDoc AI hesabı oluşturun.</p>

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
          style={{ ...ui.input, marginBottom: "0.4rem" }}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          autoComplete="new-password"
          placeholder="En az 6 karakter"
        />
        <p
          style={{
            margin: "0 0 1rem",
            fontSize: "0.75rem",
            color: t.color.subtle,
          }}
        >
          Şifreniz en az 6 karakter olmalıdır.
        </p>

        <button
          type="submit"
          className="ld-btn"
          style={{
            ...ui.button,
            ...(submitting ? ui.buttonDisabled : {}),
          }}
          disabled={submitting}
        >
          {submitting ? <Spinner size={16} color="#fff" /> : <UserPlus size={16} />}
          {submitting ? "Kayıt olunuyor..." : "Kayıt Ol"}
        </button>

        <p style={ui.footerText}>
          Zaten hesabın var mı? <Link href="/login">Giriş yap</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
