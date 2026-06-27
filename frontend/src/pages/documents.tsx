import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, getErrorMessage } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { ui } from "../lib/ui";
import ProtectedRoute from "../components/ProtectedRoute";
import Header from "../components/Header";
import Spinner from "../components/Spinner";
import DocumentList, { type DocumentItem } from "../components/DocumentList";

const PENDING_STATUSES = ["uploaded", "processing"];

function DocumentsContent() {
  const { token } = useAuth();
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
      setError(getErrorMessage(err, "Dokümanlar yüklenemedi."));
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
      setError(getErrorMessage(err, "Doküman silinemedi."));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div style={ui.contentPage}>
      <Header />
      <main style={ui.contentBody} className="ld-page">
        <div
          style={{ ...ui.panel, maxWidth: 820 }}
          className="ld-card ld-fade-in"
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "0.5rem",
              flexWrap: "wrap",
              marginBottom: "1.25rem",
            }}
          >
            <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Dokümanlarım</h1>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="button"
                onClick={() => void load()}
                disabled={loading}
                style={{
                  background: "transparent",
                  color: "#94a3b8",
                  border: "1px solid #334155",
                  borderRadius: 8,
                  padding: "0.5rem 0.9rem",
                  cursor: loading ? "not-allowed" : "pointer",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                }}
              >
                {hasPending && <Spinner size={13} />}
                Yenile
              </button>
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
          </div>

          {error && (
            <div style={ui.error} className="ld-fade-in" role="alert">
              {error}
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
          ) : (
            <DocumentList
              documents={documents}
              onDelete={handleDelete}
              deletingId={deletingId}
            />
          )}
        </div>
      </main>
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
