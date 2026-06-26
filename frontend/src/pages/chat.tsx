import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, apiFetch } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import ProtectedRoute from "../components/ProtectedRoute";
import ChatBox, { type ChatMessage } from "../components/ChatBox";
import { type Source } from "../components/SourcePanel";
import { type DocumentItem } from "../components/DocumentList";

interface ChatResponse {
  answer: string;
  sources: Source[];
}

function ChatContent() {
  const { user, token, logout } = useAuth();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sohbet için yalnızca işlenmesi tamamlanmış (`ready`) dokümanlar kullanılabilir.
  const readyDocuments = documents.filter((d) => d.status === "ready");

  const loadDocuments = useCallback(async () => {
    try {
      const data = await apiFetch<DocumentItem[]>("/documents", { token });
      setDocuments(data);
    } catch {
      // Doküman listesi sohbet için kritik değil; sessizce geç.
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
      const message =
        err instanceof ApiError ? err.message : "Cevap alınırken bir hata oluştu.";
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
          display: "flex",
          flexDirection: "column",
          background: "#1e293b",
          border: "1px solid #334155",
          borderRadius: 12,
          padding: "2rem",
          boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
          height: "calc(100vh - 4rem)",
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

        <h1 style={{ margin: "0 0 0.75rem", fontSize: "1.5rem" }}>Sohbet</h1>

        {readyDocuments.length === 0 ? (
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
            (durum: <strong>ready</strong>) beklemelisiniz.{" "}
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

        <div style={{ flex: 1, minHeight: 0 }}>
          <ChatBox
            messages={messages}
            onSend={handleSend}
            loading={loading}
            disabled={readyDocuments.length === 0}
          />
        </div>

        <p
          style={{
            marginTop: "1rem",
            marginBottom: 0,
            fontSize: "0.85rem",
            color: "#94a3b8",
          }}
        >
          <Link href="/documents">Dokümanlarım</Link>
          {" · "}
          <Link href="/">Ana sayfa</Link>
        </p>
      </div>
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
