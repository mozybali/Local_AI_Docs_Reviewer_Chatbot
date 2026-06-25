import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, apiFetch } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import ProtectedRoute from "../components/ProtectedRoute";
import DocumentList, { type DocumentItem } from "../components/DocumentList";

const PENDING_STATUSES = ["uploaded", "processing"];

function DocumentsContent() {
  const { user, token, logout } = useAuth();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<DocumentItem[]>("/documents", { token });
      setDocuments(data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Dokümanlar yüklenemedi.",
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  // İlk yükleme.
  useEffect(() => {
    void load();
  }, [load]);

  // İşlenmekte olan doküman varsa durumu periyodik olarak yenile (polling).
  const hasPending = documents.some((d) => PENDING_STATUSES.includes(d.status));
  useEffect(() => {
    if (!hasPending) return;
    const id = setInterval(() => {
      void load();
    }, 3000);
    return () => clearInterval(id);
  }, [hasPending, load]);

  async function handleDelete(id: number) {
    if (!window.confirm("Bu dokümanı silmek istediğinize emin misiniz?")) {
      return;
    }
    setDeletingId(id);
    setError(null);
    try {
      await apiFetch<void>(`/documents/${id}`, { method: "DELETE", token });
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Doküman silinemedi.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "2rem 1.5rem",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 760,
          background: "#1e293b",
          border: "1px solid #334155",
          borderRadius: 12,
          padding: "2rem",
          boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
        }}
      >
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

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1.25rem",
          }}
        >
          <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Dokümanlarım</h1>
          <Link href="/upload">
            <button
              style={{
                background: "#2563eb",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "0.5rem 1rem",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "0.85rem",
              }}
            >
              + Yükle
            </button>
          </Link>
        </div>

        {error && (
          <div
            style={{
              background: "#7f1d1d",
              color: "#fecaca",
              padding: "0.6rem 0.75rem",
              borderRadius: 8,
              marginBottom: "1rem",
              fontSize: "0.85rem",
            }}
          >
            {error}
          </div>
        )}

        {loading ? (
          <p style={{ color: "#94a3b8" }}>Yükleniyor...</p>
        ) : (
          <DocumentList
            documents={documents}
            onDelete={handleDelete}
            deletingId={deletingId}
          />
        )}

        <p
          style={{
            marginTop: "1.5rem",
            fontSize: "0.85rem",
            color: "#94a3b8",
          }}
        >
          <Link href="/">Ana sayfa</Link>
        </p>
      </div>
    </div>
  );
}

export default function DocumentsPage() {
  return (
    <ProtectedRoute>
      <DocumentsContent />
    </ProtectedRoute>
  );
}
