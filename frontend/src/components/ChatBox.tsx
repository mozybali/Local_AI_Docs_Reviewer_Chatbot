import { useEffect, useRef, useState, type FormEvent } from "react";
import { AlertTriangle, MessageSquare, SendHorizontal } from "lucide-react";
import { glass as g, tokens as t } from "../lib/ui";
import SourcePanel, { type Source } from "./SourcePanel";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  /** Backend hatası sohbet akışında gösterilirken işaretlenir. */
  isError?: boolean;
}

interface ChatBoxProps {
  messages: ChatMessage[];
  onSend: (question: string) => void;
  loading: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** Hiç mesaj yokken gösterilen açıklama (RAG ve normal sohbette farklı). */
  emptyStateText?: string;
}

/**
 * Sohbet görünümü: mesaj listesi + soru giriş alanı.
 * - Hem RAG (kaynaklı) hem normal sohbet ekranında kullanılır; kaynak paneli
 *   yalnızca mesajda `sources` varsa gösterilir.
 * - Kullanıcı ve asistan mesajlarını farklı hizalar.
 * - Cevap beklenirken giriş kilitlenir ve "yazıyor" göstergesi çıkar.
 */
export default function ChatBox({
  messages,
  onSend,
  loading,
  disabled = false,
  placeholder = "Dokümanlarınız hakkında bir soru sorun...",
  emptyStateText = "Henüz mesaj yok. Yüklediğiniz dokümanlar hakkında soru sorun; cevaplar kaynak referanslarıyla gelir.",
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

  const sendDisabled = disabled || loading || input.trim().length === 0;

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
          <div
            style={{
              margin: "auto",
              textAlign: "center",
              color: t.color.subtle,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.7rem",
              padding: "1.5rem 1rem",
            }}
          >
            <span style={{ ...g.iconWrap, width: 46, height: 46 }}>
              <MessageSquare size={21} />
            </span>
            <p style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.55, maxWidth: 320 }}>
              {emptyStateText}
            </p>
          </div>
        )}

        {messages.map((message, index) => (
          <MessageBubble key={index} message={message} />
        ))}

        {loading && <TypingIndicator />}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", gap: "0.5rem", marginTop: "0.85rem" }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          disabled={disabled || loading}
          aria-label="Sorunuz"
          style={{ ...g.input, flex: 1, width: "auto" }}
        />
        <button
          type="submit"
          disabled={sendDisabled}
          className="ld-btn"
          aria-label="Gönder"
          style={{
            ...g.glassButton,
            padding: "0.65rem 1rem",
            ...(sendDisabled
              ? { opacity: 0.55, cursor: "not-allowed", transform: "none" }
              : {}),
          }}
        >
          <SendHorizontal size={16} />
          <span className="ld-send-label">Gönder</span>
        </button>
      </form>
      <style jsx>{`
        @media (max-width: 560px) {
          .ld-send-label {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}

// Asistanın cevabı beklenirken gösterilen yanıp sönen üç nokta.
function TypingIndicator() {
  return (
    <div
      className="ld-fade-in ld-glass-soft"
      style={{
        alignSelf: "flex-start",
        display: "flex",
        alignItems: "center",
        gap: "0.3rem",
        background: t.color.assistantBubble,
        border: `1px solid ${t.color.border}`,
        borderRadius: t.radius.md,
        padding: "0.7rem 0.85rem",
        boxShadow: t.shadow.insetHi,
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
            background: t.color.muted,
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
  const isError = message.isError === true;

  return (
    <div
      className="ld-fade-in"
      style={{
        alignSelf: isUser ? "flex-end" : "flex-start",
        maxWidth: "85%",
        background: isUser
          ? t.color.userBubble
          : isError
            ? "var(--ld-danger-bg)"
            : t.color.assistantBubble,
        border: isUser
          ? `1px solid ${t.color.userBubbleBorder}`
          : isError
            ? "1px solid var(--ld-danger-border)"
            : `1px solid ${t.color.border}`,
        color: isUser ? t.color.userBubbleText : isError ? t.color.danger : t.color.text,
        borderRadius: t.radius.md,
        padding: "0.65rem 0.85rem",
        boxShadow: isUser ? t.shadow.soft : t.shadow.insetHi,
      }}
    >
      <p
        style={{
          margin: 0,
          whiteSpace: "pre-wrap",
          lineHeight: 1.55,
          fontSize: "0.92rem",
          display: isError ? "flex" : undefined,
          gap: isError ? "0.5rem" : undefined,
          alignItems: isError ? "flex-start" : undefined,
        }}
      >
        {isError && <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 2 }} />}
        {message.content}
      </p>
      {!isUser && message.sources && <SourcePanel sources={message.sources} />}
    </div>
  );
}
