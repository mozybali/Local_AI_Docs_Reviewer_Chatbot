import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";
import { ApiError, apiFetch } from "../lib/api";
import { ui } from "../lib/ui";

interface UploadResult {
  document_id: number;
  filename: string;
  status: string;
}

export default function UploadPage() {
  const { user, token, loading, isAuthenticated, logout } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Korumalı sayfa: giriş yapılmamışsa login'e yönlendir.
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [loading, isAuthenticated, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!file) {
      setError("Lütfen bir dosya seçin.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setUploading(true);
    try {
      const data = await apiFetch<UploadResult>("/documents/upload", {
        method: "POST",
        token,
        body: formData,
      });
      setResult(data);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Yükleme sırasında bir hata oluştu.",
      );
    } finally {
      setUploading(false);
    }
  }

  if (loading || !isAuthenticated) {
    return (
      <div style={ui.page}>
        <p style={{ color: "#94a3b8" }}>Yükleniyor...</p>
      </div>
    );
  }

  return (
    <div style={ui.page}>
      <div style={ui.card}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1rem",
          }}
        >
          <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
            {user?.email}
          </span>
          <button
            type="button"
            onClick={logout}
            style={{
              background: "transparent",
              color: "#f87171",
              border: "1px solid #7f1d1d",
              borderRadius: 8,
              padding: "0.3rem 0.7rem",
              cursor: "pointer",
              fontSize: "0.8rem",
            }}
          >
            Çıkış
          </button>
        </div>

        <h1 style={ui.title}>Doküman Yükle</h1>
        <p style={ui.subtitle}>PDF veya TXT dosyası yükleyin (maks. 50 MB).</p>

        {error && <div style={ui.error}>{error}</div>}
        {result && (
          <div style={ui.success}>
            Dosya yüklendi: <strong>{result.filename}</strong>
            <br />
            Doküman ID: {result.document_id} — Durum: {result.status}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <label style={ui.label} htmlFor="file">
            Dosya
          </label>
          <input
            id="file"
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt"
            style={ui.input}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />

          <button
            type="submit"
            style={{
              ...ui.button,
              ...(uploading ? ui.buttonDisabled : {}),
            }}
            disabled={uploading}
          >
            {uploading ? "Yükleniyor..." : "Yükle"}
          </button>
        </form>

        <p style={ui.footerText}>
          <Link href="/">Ana sayfa</Link>
        </p>
      </div>
    </div>
  );
}
