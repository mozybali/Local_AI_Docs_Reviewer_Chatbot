import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Check,
  FileText,
  FileWarning,
  MessageSquare,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { apiFetch, getErrorMessage } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { glass as g, tokens as t, ui } from "../lib/ui";
import ProtectedRoute from "../components/ProtectedRoute";
import Header from "../components/Header";
import ChatBox, { type ChatMessage } from "../components/ChatBox";
import ModelSelector from "../components/ModelSelector";
import ConfirmDialog from "../components/ConfirmDialog";
import { type Source } from "../components/SourcePanel";
import { type DocumentItem } from "../components/DocumentList";

interface ChatResponse {
  answer: string;
  sources: Source[];
}

// Sohbet geçmişi kullanıcı bazlı saklanır (Hafta 6 — sohbet geçmişi).
function historyKey(userId: number | undefined): string {
  return `localdoc_chat_${userId ?? "anon"}`;
}

// Kayıtlı geçmişi senkron okur. ChatContent yalnızca oturum doğrulandıktan
// sonra (ProtectedRoute altında, istemcide) mount edildiği için ilk render'da
// localStorage erişilebilir durumdadır; ayrıca bir yükleme efekti gerekmez.
function readHistory(userId: number | undefined): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(historyKey(userId));
    return raw ? (JSON.parse(raw) as ChatMessage[]) : [];
  } catch {
    // Bozuk/eski veri: yok say.
    return [];
  }
}

function ChatContent() {
  const { user, token } = useAuth();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  // Seçili model id'si; ModelSelector varsayılanı backend'den alıp doldurur.
  const [modelId, setModelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    readHistory(user?.id),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Doküman listesi yüklenirken oluşan hata (backend kapalı, 401 vb.).
  // "boş liste" durumundan ayırmak için ayrı tutulur.
  const [docError, setDocError] = useState<string | null>(null);
  // Geçmiş temizleme onay modalı.
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  // Sohbet için yalnızca işlenmesi tamamlanmış (`ready`) dokümanlar kullanılabilir.
  const readyDocuments = documents.filter((d) => d.status === "ready");

  // Mesajlar değiştikçe geçmişi kaydet.
  useEffect(() => {
    if (!user) return;
    try {
      window.localStorage.setItem(historyKey(user.id), JSON.stringify(messages));
    } catch {
      // Depolama dolu/erişilemez: sessizce geç.
    }
  }, [messages, user]);

  // setState'ler promise callback'lerinde çalışır; böylece efekt gövdesinden
  // doğrudan çağrılabilir (react-hooks/set-state-in-effect).
  const loadDocuments = useCallback(() => {
    return apiFetch<DocumentItem[]>("/documents", { token })
      .then((data) => {
        setDocuments(data);
        setDocError(null);
      })
      .catch((err: unknown) => {
        // Hatayı yutma: kullanıcı "doküman yok" mu yoksa "liste yüklenemedi" mi
        // ayırt edebilmeli (README: hatalar anlaşılır mesajlarla gösterilmeli).
        setDocError(getErrorMessage(err, "Dokümanlar yüklenemedi."));
      });
  }, [token]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  function toggleDocument(id: number) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function clearHistory() {
    if (messages.length === 0) return;
    setConfirmClearOpen(true);
  }

  function confirmClearHistory() {
    setMessages([]);
    setError(null);
    setConfirmClearOpen(false);
  }

  async function handleSend(question: string) {
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setLoading(true);
    try {
      const data = await apiFetch<ChatResponse>("/chat/ask", {
        method: "POST",
        token,
        json: {
          question,
          // Hiç doküman seçilmezse tüm `ready` dokümanlarda ara (null).
          document_ids: selectedIds.length > 0 ? selectedIds : null,
          // Backend allowlist'e göre doğrular; null ise varsayılan model.
          model_id: modelId,
        },
      });
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer, sources: data.sources },
      ]);
    } catch (err) {
      const message = getErrorMessage(err, "Cevap alınırken bir hata oluştu.");
      setError(message);
      // Hatayı sohbet akışında da göster ki kullanıcı bağlamı kaybetmesin.
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: message, isError: true },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={ui.contentPage}>
      <Header />
      <main style={{ ...ui.contentBody, minHeight: 0 }} className="ld-page">
        <div
          style={{
            ...ui.panel,
            maxWidth: 860,
            display: "flex",
            flexDirection: "column",
            // Yüksekliği üst esnek kapsayıcıdan (stretch) alır; iç mesaj alanı
            // kaydırılabilir kalır.
            minHeight: 0,
          }}
          className="ld-card ld-glass"
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "0.75rem",
              marginBottom: "1rem",
            }}
          >
            <div>
              <h1 style={ui.pageTitle}>
                <span style={{ ...g.iconWrap, width: 34, height: 34 }}>
                  <MessageSquare size={16} />
                </span>
                Sohbet
              </h1>
              <p style={ui.pageSubtitle}>
                Cevaplar yalnızca yüklediğiniz dokümanlara dayanır.
              </p>
            </div>
            <button
              type="button"
              onClick={clearHistory}
              disabled={messages.length === 0}
              className="ld-btn"
              style={{
                ...g.smallDangerButton,
                ...(messages.length === 0
                  ? { opacity: 0.45, cursor: "not-allowed" }
                  : {}),
              }}
            >
              <Trash2 size={13} />
              Geçmişi temizle
            </button>
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <ModelSelector mode="rag" value={modelId} onChange={setModelId} />
          </div>

          {docError ? (
            <div
              style={{
                ...ui.error,
                justifyContent: "space-between",
                alignItems: "center",
              }}
              role="alert"
            >
              <span style={{ display: "inline-flex", gap: "0.5rem", alignItems: "flex-start" }}>
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                {docError}
              </span>
              <button
                type="button"
                onClick={() => void loadDocuments()}
                className="ld-btn"
                style={{
                  ...g.smallButton,
                  color: "inherit",
                  border: "1px solid currentColor",
                  background: "transparent",
                  flexShrink: 0,
                }}
              >
                <RefreshCw size={12} />
                Tekrar dene
              </button>
            </div>
          ) : readyDocuments.length === 0 ? (
            <div style={{ ...g.alertWarning, marginBottom: "1rem" }}>
              <FileWarning size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                Soru sorabilmek için önce en az bir doküman yükleyip işlenmesini
                (durum: <strong>Hazır</strong>) beklemelisiniz.{" "}
                <Link href="/upload" style={{ color: "#fde68a", fontWeight: 600 }}>
                  Doküman yükle
                </Link>
                .
              </span>
            </div>
          ) : (
            <div style={{ marginBottom: "1rem" }}>
              <div
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  color: t.color.subtle,
                  marginBottom: "0.45rem",
                }}
              >
                Kaynak dokümanlar{" "}
                <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>
                  (seçilmezse tümünde aranır)
                </span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                {readyDocuments.map((doc) => {
                  const active = selectedIds.includes(doc.id);
                  return (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => toggleDocument(doc.id)}
                      aria-pressed={active}
                      style={{
                        ...g.chip,
                        ...(active ? g.chipActive : {}),
                      }}
                      title={doc.filename}
                    >
                      {active ? (
                        <Check size={12} style={{ flexShrink: 0 }} />
                      ) : (
                        <FileText size={12} style={{ flexShrink: 0 }} />
                      )}
                      <span
                        style={{
                          minWidth: 0,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {doc.filename}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {error && (
            <div style={ui.error} className="ld-fade-in" role="alert">
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{error}</span>
            </div>
          )}

          <div style={{ flex: 1, minHeight: 0 }}>
            <ChatBox
              messages={messages}
              onSend={handleSend}
              loading={loading}
              disabled={readyDocuments.length === 0}
            />
          </div>
        </div>
      </main>

      <ConfirmDialog
        open={confirmClearOpen}
        title="Sohbet geçmişini temizle"
        message="Bu cihazda kayıtlı sohbet geçmişiniz silinecek. Bu işlem geri alınamaz."
        confirmLabel="Evet, temizle"
        cancelLabel="Vazgeç"
        variant="danger"
        onConfirm={confirmClearHistory}
        onCancel={() => setConfirmClearOpen(false)}
      />
    </div>
  );
}

export default function ChatPage() {
  return (
    <ProtectedRoute>
      <ChatContent />
    </ProtectedRoute>
  );
}
