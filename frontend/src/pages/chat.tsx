import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, getErrorMessage } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { ui } from "../lib/ui";
import ProtectedRoute from "../components/ProtectedRoute";
import Header from "../components/Header";
import ChatBox, { type ChatMessage } from "../components/ChatBox";
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

function ChatContent() {
  const { user, token } = useAuth();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Doküman listesi yüklenirken oluşan hata (backend kapalı, 401 vb.).
  // "boş liste" durumundan ayırmak için ayrı tutulur.
  const [docError, setDocError] = useState<string | null>(null);

  // Sohbet için yalnızca işlenmesi tamamlanmış (`ready`) dokümanlar kullanılabilir.
  const readyDocuments = documents.filter((d) => d.status === "ready");

  // Sohbet geçmişini yükle (kullanıcı belli olduğunda).
  useEffect(() => {
    if (!user) return;
    try {
      const raw = window.localStorage.getItem(historyKey(user.id));
      if (raw) setMessages(JSON.parse(raw) as ChatMessage[]);
    } catch {
      // Bozuk/eski veri: yok say.
    }
    setHistoryLoaded(true);
  }, [user]);

  // Mesajlar değiştikçe geçmişi kaydet.
  useEffect(() => {
    if (!user || !historyLoaded) return;
    try {
      window.localStorage.setItem(historyKey(user.id), JSON.stringify(messages));
    } catch {
      // Depolama dolu/erişilemez: sessizce geç.
    }
  }, [messages, user, historyLoaded]);

  const loadDocuments = useCallback(async () => {
    try {
      const data = await apiFetch<DocumentItem[]>("/documents", { token });
      setDocuments(data);
      setDocError(null);
    } catch (err) {
      // Hatayı yutma: kullanıcı "doküman yok" mu yoksa "liste yüklenemedi" mi
      // ayırt edebilmeli (README: hatalar anlaşılır mesajlarla gösterilmeli).
      setDocError(getErrorMessage(err, "Dokümanlar yüklenemedi."));
    }
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
    if (!window.confirm("Sohbet geçmişini temizlemek istediğinize emin misiniz?")) {
      return;
    }
    setMessages([]);
    setError(null);
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
        { role: "assistant", content: `⚠️ ${message}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={ui.contentPage}>
      <Header />
      <main
        style={{ ...ui.contentBody, minHeight: 0 }}
        className="ld-page"
      >
        <div
          style={{
            ...ui.panel,
            maxWidth: 820,
            display: "flex",
            flexDirection: "column",
            // Yüksekliği üst esnek kapsayıcıdan (stretch) alır; iç mesaj alanı
            // kaydırılabilir kalır.
            minHeight: 0,
          }}
          className="ld-card"
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "0.5rem",
              marginBottom: "0.75rem",
            }}
          >
            <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Sohbet</h1>
            <button
              type="button"
              onClick={clearHistory}
              disabled={messages.length === 0}
              style={{
                background: "transparent",
                color: "#94a3b8",
                border: "1px solid #334155",
                borderRadius: 8,
                padding: "0.35rem 0.7rem",
                cursor: messages.length === 0 ? "not-allowed" : "pointer",
                fontSize: "0.8rem",
                opacity: messages.length === 0 ? 0.5 : 1,
              }}
            >
              Geçmişi temizle
            </button>
          </div>

          {docError ? (
            <div
              style={{
                ...ui.error,
                marginBottom: "1rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "0.5rem",
              }}
              role="alert"
            >
              <span>{docError}</span>
              <button
                type="button"
                onClick={() => void loadDocuments()}
                style={{
                  background: "transparent",
                  color: "inherit",
                  border: "1px solid currentColor",
                  borderRadius: 8,
                  padding: "0.3rem 0.7rem",
                  cursor: "pointer",
                  fontSize: "0.8rem",
                  whiteSpace: "nowrap",
                }}
              >
                Tekrar dene
              </button>
            </div>
          ) : readyDocuments.length === 0 ? (
            <div
              style={{
                background: "#422006",
                color: "#fde68a",
                padding: "0.6rem 0.75rem",
                borderRadius: 8,
                marginBottom: "1rem",
                fontSize: "0.85rem",
              }}
            >
              Soru sorabilmek için önce en az bir doküman yükleyip işlenmesini
              (durum: <strong>Hazır</strong>) beklemelisiniz.{" "}
              <Link href="/upload">Doküman yükle</Link>.
            </div>
          ) : (
            <div style={{ marginBottom: "1rem" }}>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "#94a3b8",
                  marginBottom: "0.4rem",
                }}
              >
                Kaynak dokümanlar (seçilmezse tümünde aranır):
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                {readyDocuments.map((doc) => {
                  const active = selectedIds.includes(doc.id);
                  return (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => toggleDocument(doc.id)}
                      style={{
                        background: active ? "#2563eb" : "transparent",
                        color: active ? "#fff" : "#cbd5e1",
                        border: `1px solid ${active ? "#2563eb" : "#334155"}`,
                        borderRadius: 999,
                        padding: "0.3rem 0.7rem",
                        cursor: "pointer",
                        fontSize: "0.78rem",
                        maxWidth: 240,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                      title={doc.filename}
                    >
                      {doc.filename}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {error && (
            <div style={ui.error} className="ld-fade-in" role="alert">
              {error}
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
