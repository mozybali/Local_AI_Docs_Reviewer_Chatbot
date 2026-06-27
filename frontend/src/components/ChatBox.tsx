import { useEffect, useRef, useState, type FormEvent } from "react";
import SourcePanel, { type Source } from "./SourcePanel";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
}

interface ChatBoxProps {
  messages: ChatMessage[];
  onSend: (question: string) => void;
  loading: boolean;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Sohbet görünümü: mesaj listesi + soru giriş alanı.
 * - Kullanıcı ve asistan mesajlarını farklı hizalar.
 * - Asistan mesajlarının altında kaynak panelini gösterir.
 * - Cevap beklenirken giriş kilitlenir ve "yazıyor" göstergesi çıkar.
 */
export default function ChatBox({
  messages,
  onSend,
  loading,
  disabled = false,
  placeholder = "Dokümanlarınız hakkında bir soru sorun...",
}: ChatBoxProps) {
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  // Yeni mesaj/akış geldikçe en alta kaydır.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading || disabled) return;
    onSend(trimmed);
    setInput("");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "0.85rem",
          padding: "0.25rem",
        }}
      >
        {messages.length === 0 && (
          <p style={{ color: "#64748b", fontSize: "0.9rem", margin: "auto" }}>
            Henüz mesaj yok. Yüklediğiniz dokümanlar hakkında soru sorun.
          </p>
        )}

        {messages.map((message, index) => (
          <MessageBubble key={index} message={message} />
        ))}

        {loading && <TypingIndicator />}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          disabled={disabled || loading}
          style={{
            flex: 1,
            padding: "0.65rem 0.75rem",
            background: "#0f172a",
            border: "1px solid #334155",
            borderRadius: 8,
            color: "#e2e8f0",
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={disabled || loading || input.trim().length === 0}
          style={{
            padding: "0.65rem 1.1rem",
            background: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            cursor:
              disabled || loading || input.trim().length === 0
                ? "not-allowed"
                : "pointer",
            fontWeight: 600,
            opacity:
              disabled || loading || input.trim().length === 0 ? 0.6 : 1,
          }}
        >
          Gönder
        </button>
      </form>
    </div>
  );
}

// Asistanın cevabı beklenirken gösterilen yanıp sönen üç nokta.
function TypingIndicator() {
  return (
    <div
      className="ld-fade-in"
      style={{
        alignSelf: "flex-start",
        display: "flex",
        alignItems: "center",
        gap: "0.3rem",
        background: "#1e293b",
        border: "1px solid #334155",
        borderRadius: 12,
        padding: "0.7rem 0.85rem",
      }}
      aria-label="Asistan yazıyor"
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: "#94a3b8",
            display: "inline-block",
            animation: "ld-blink 1.2s infinite both",
            animationDelay: `${i * 0.18}s`,
          }}
        />
      ))}
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div
      className="ld-fade-in"
      style={{
        alignSelf: isUser ? "flex-end" : "flex-start",
        maxWidth: "85%",
        background: isUser ? "#2563eb" : "#1e293b",
        border: isUser ? "none" : "1px solid #334155",
        color: isUser ? "#fff" : "#e2e8f0",
        borderRadius: 12,
        padding: "0.65rem 0.85rem",
      }}
    >
      <p style={{ margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
        {message.content}
      </p>
      {!isUser && message.sources && <SourcePanel sources={message.sources} />}
    </div>
  );
}
