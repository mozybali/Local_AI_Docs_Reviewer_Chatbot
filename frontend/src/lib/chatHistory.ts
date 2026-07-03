// localStorage'da saklanan sohbet geçmişini okuma/yazma yardımcıları.
// RAG (chat) ve normal sohbet (general-chat) sayfaları ortak kullanır.
//
// localStorage içeriği güvenilmez girdidir: eski sürümden kalmış, elle
// değiştirilmiş ya da bozulmuş olabilir. Doğrulamadan render edilirse
// (örn. null öğenin `role` alanına erişim) sohbet sayfası açılışta çöker.
// Bu yüzden okunan veri şemaya göre süzülür; uymayan öğeler sessizce atılır.

import type { ChatMessage } from "../components/ChatBox";

function isValidSource(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const source = value as Record<string, unknown>;
  return (
    typeof source.document === "string" &&
    typeof source.text === "string" &&
    typeof source.score === "number" &&
    typeof source.chunk_index === "number" &&
    (source.page === null || typeof source.page === "number")
  );
}

function sanitizeMessage(value: unknown): ChatMessage | null {
  if (typeof value !== "object" || value === null) return null;
  const message = value as Record<string, unknown>;
  if (message.role !== "user" && message.role !== "assistant") return null;
  if (typeof message.content !== "string") return null;

  const result: ChatMessage = {
    role: message.role,
    content: message.content,
  };
  if (message.isError === true) result.isError = true;
  if (Array.isArray(message.sources) && message.sources.every(isValidSource)) {
    result.sources = message.sources as ChatMessage["sources"];
  }
  return result;
}

/** Kayıtlı geçmişi okur; bozuk/uyumsuz kayıtları eleyerek döner. */
export function readChatHistory(key: string): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(sanitizeMessage)
      .filter((m): m is ChatMessage => m !== null);
  } catch {
    // Bozuk/eski veri: yok say.
    return [];
  }
}

/** Geçmişi kaydeder; depolama dolu/erişilemezse sessizce geçer. */
export function persistChatHistory(key: string, messages: ChatMessage[]): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(messages));
  } catch {
    // Depolama dolu/erişilemez: sessizce geç.
  }
}
