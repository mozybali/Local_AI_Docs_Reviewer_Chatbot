import { useEffect, useState } from "react";
import { AlertCircle, Bot, Trash2 } from "lucide-react";
import { apiFetch, getErrorMessage } from "../lib/api";
import { readChatHistory, persistChatHistory } from "../lib/chatHistory";
import { useAuth } from "../context/AuthContext";
import { glass as g, ui } from "../lib/ui";
import ProtectedRoute from "../components/ProtectedRoute";
import Header from "../components/Header";
import ChatBox, { type ChatMessage } from "../components/ChatBox";
import ModelSelector from "../components/ModelSelector";
import ConfirmDialog from "../components/ConfirmDialog";

interface GeneralChatResponse {
  answer: string;
}

// Backend'e gönderilecek geçmişteki azami mesaj sayısı. Sunucu zaten bağlam
// bütçesine göre kırpar; bu yalnızca isteği makul boyutta tutar.
const MAX_HISTORY_MESSAGES = 30;

// Normal sohbet geçmişi RAG sohbetinden AYRI bir anahtarla saklanır.
// Okuma/yazma (şema doğrulamalı) lib/chatHistory içinde ortaktır; sayfa
// ProtectedRoute altında (istemcide) mount edildiği için ilk render'da
// localStorage erişilebilir durumdadır.
function historyKey(userId: number | undefined): string {
  return `localdoc_general_chat_${userId ?? "anon"}`;
}

function GeneralChatContent() {
  const { user, token } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    readChatHistory(historyKey(user?.id)),
  );
  const [modelId, setModelId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Geçmiş temizleme onay modalı.
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  // Mesajlar değiştikçe geçmişi kaydet.
  useEffect(() => {
    if (!user) return;
    persistChatHistory(historyKey(user.id), messages);
  }, [messages, user]);

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
    const userMessage: ChatMessage = { role: "user", content: question };
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);
    try {
      // Son geçmiş + yeni mesaj gönderilir. İstemci tarafı hata balonları
      // (isError) gerçek asistan cevabı olmadığından geçmişe dahil edilmez;
      // sistem mesajını her zaman backend ekler.
      const history = [...messages, userMessage]
        .filter((m) => !m.isError)
        .slice(-MAX_HISTORY_MESSAGES)
        .map((m) => ({ role: m.role, content: m.content }));
      const data = await apiFetch<GeneralChatResponse>("/chat/general", {
        method: "POST",
        token,
        json: {
          model_id: modelId,
          messages: history,
        },
      });
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer },
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
                  <Bot size={16} />
                </span>
                Normal Sohbet
              </h1>
              <p style={ui.pageSubtitle}>
                Dokümanlardan bağımsız genel sohbet; yüklediğiniz dokümanlar
                kullanılmaz.
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
            <ModelSelector
              mode="general"
              value={modelId}
              onChange={setModelId}
            />
          </div>

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
              placeholder="Bir soru sorun..."
              emptyStateText="Henüz mesaj yok. Genel bir soru sorun; bu ekran dokümanlarınızı kullanmaz."
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

export default function GeneralChatPage() {
  return (
    <ProtectedRoute>
      <GeneralChatContent />
    </ProtectedRoute>
  );
}
