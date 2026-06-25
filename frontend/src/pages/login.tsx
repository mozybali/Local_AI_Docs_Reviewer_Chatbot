import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../lib/api";
import { ui } from "../lib/ui";

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
      setError(
        err instanceof ApiError ? err.message : "Giriş sırasında bir hata oluştu.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={ui.page}>
      <form style={ui.card} onSubmit={handleSubmit}>
        <h1 style={ui.title}>Giriş Yap</h1>
        <p style={ui.subtitle}>LocalDoc AI hesabınıza erişin.</p>

        {error && <div style={ui.error}>{error}</div>}

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
        />

        <button
          type="submit"
          style={{
            ...ui.button,
            ...(submitting ? ui.buttonDisabled : {}),
          }}
          disabled={submitting}
        >
          {submitting ? "Giriş yapılıyor..." : "Giriş Yap"}
        </button>

        <p style={ui.footerText}>
          Hesabın yok mu? <Link href="/register">Kayıt ol</Link>
        </p>
      </form>
    </div>
  );
}
