import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, FileText, Plus, RefreshCw } from "lucide-react";
import { apiFetch, getErrorMessage } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { glass as g, tokens as t, ui } from "../lib/ui";
import ProtectedRoute from "../components/ProtectedRoute";
import Header from "../components/Header";
import Spinner from "../components/Spinner";
import ConfirmDialog from "../components/ConfirmDialog";
import DocumentList, { type DocumentItem } from "../components/DocumentList";

const PENDING_STATUSES = ["uploaded", "processing"];

function DocumentsContent() {
  const { token } = useAuth();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [reprocessingId, setReprocessingId] = useState<number | null>(null);
  // Silme onayı bekleyen doküman; ConfirmDialog bu state ile açılır.
  const [pendingDelete, setPendingDelete] = useState<DocumentItem | null>(null);

  // setState'ler promise callback'lerinde çalışır; böylece efekt gövdesinden
  // doğrudan çağrılabilir (react-hooks/set-state-in-effect).
  const load = useCallback(() => {
    return apiFetch<DocumentItem[]>("/documents", { token })
      .then((data) => {
        setDocuments(data);
        setError(null);
      })
      .catch((err: unknown) => {
        setError(getErrorMessage(err, "Dokümanlar yüklenemedi."));
      })
      .finally(() => setLoading(false));
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

  function handleDelete(id: number) {
    const doc = documents.find((d) => d.id === id);
    if (doc) setPendingDelete(doc);
  }

  // Hatalı / kısmen işlenmiş dokümanı yeniden işleme kuyruğuna alır
  // (dosya diskte durduğu için yeniden yükleme gerekmez).
  async function handleReprocess(id: number) {
    setReprocessingId(id);
    setError(null);
    try {
      await apiFetch(`/documents/${id}/reprocess`, { method: "POST", token });
      await load(); // durum "uploaded/processing" olur; polling devralır
    } catch (err) {
      setError(getErrorMessage(err, "Doküman yeniden işlenemedi."));
    } finally {
      setReprocessingId(null);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    setPendingDelete(null);
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
          style={{ ...ui.panel, maxWidth: 860 }}
          className="ld-card ld-glass ld-fade-up"
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "0.75rem",
              flexWrap: "wrap",
              marginBottom: "1.25rem",
            }}
          >
            <div>
              <h1 style={ui.pageTitle}>
                <span style={{ ...g.iconWrap, width: 34, height: 34 }}>
                  <FileText size={16} />
                </span>
                Dokümanlarım
              </h1>
              <p style={ui.pageSubtitle}>
                {loading
                  ? "Dokümanlar getiriliyor..."
                  : `${documents.length} doküman · işlenenler otomatik yenilenir`}
              </p>
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="button"
                onClick={() => void load()}
                disabled={loading}
                className="ld-btn"
                style={{
                  ...g.ghostButton,
                  padding: "0.5rem 0.9rem",
                  fontSize: "0.85rem",
                  ...(loading ? { opacity: 0.55, cursor: "not-allowed" } : {}),
                }}
              >
                <RefreshCw
                  size={14}
                  style={
                    hasPending
                      ? { animation: "ld-spin 1.2s linear infinite" }
                      : undefined
                  }
                />
                Yenile
              </button>
              <Link
                href="/upload"
                className="ld-btn"
                style={{ ...g.glassButton, padding: "0.5rem 1rem", fontSize: "0.85rem" }}
              >
                <Plus size={15} />
                Yükle
              </Link>
            </div>
          </div>

          {error && (
            <div style={ui.error} className="ld-fade-in" role="alert">
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <p
              style={{
                color: t.color.muted,
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
              onReprocess={(id) => void handleReprocess(id)}
              reprocessingId={reprocessingId}
            />
          )}
        </div>
      </main>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Dokümanı sil"
        message={
          <>
            <strong style={{ color: t.color.text }}>{pendingDelete?.filename}</strong>{" "}
            dokümanı ve ilişkili tüm arama verileri kalıcı olarak silinecek. Bu
            işlem geri alınamaz.
          </>
        }
        confirmLabel="Evet, sil"
        cancelLabel="Vazgeç"
        variant="danger"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
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
