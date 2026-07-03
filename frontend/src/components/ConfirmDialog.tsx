import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, HelpCircle } from "lucide-react";
import { glass as g, tokens as t } from "../lib/ui";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  /** Onay butonu metni (varsayılan: "Onayla"). */
  confirmLabel?: string;
  /** Vazgeç butonu metni (varsayılan: "Vazgeç"). */
  cancelLabel?: string;
  /** danger: geri alınamaz/silme aksiyonları; primary: nötr onaylar. */
  variant?: "danger" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * window.confirm yerine kullanılan, tasarım diliyle uyumlu onay modalı.
 * - document.body'ye portal ile basılır (transform'lu ata elemanlardan etkilenmez).
 * - ESC ve backdrop tıklaması iptal eder; Tab odağı diyalog içinde döner.
 * - Açılınca odak Vazgeç butonuna gider (yanlışlıkla onay engellenir),
 *   kapanınca tetikleyen elemana geri döner.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Onayla",
  cancelLabel = "Vazgeç",
  variant = "danger",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descId = useId();

  // Açılışta odak + arka plan kaydırma kilidi; kapanışta ikisini de geri al.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onCancel();
      return;
    }
    // Basit odak tuzağı: Tab, diyalog içindeki butonlar arasında döner.
    if (e.key === "Tab" && panelRef.current) {
      const focusable = panelRef.current.querySelectorAll<HTMLElement>("button");
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  const danger = variant === "danger";
  const Icon = danger ? AlertTriangle : HelpCircle;
  const accent = danger ? t.color.danger : t.color.primarySoft;

  return createPortal(
    <div
      role="presentation"
      onKeyDown={handleKeyDown}
      onMouseDown={(e) => {
        // Yalnızca backdrop'a tıklanınca kapat; panel içi tıklamalar hariç.
        if (e.target === e.currentTarget) onCancel();
      }}
      className="ld-modal-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.25rem",
        background: "rgba(2, 6, 16, 0.62)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        animation: "ld-fade-in 0.18s ease both",
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="ld-glass-strong"
        style={{
          ...g.glassPanelStrong,
          width: "100%",
          maxWidth: 440,
          padding: "1.5rem",
          animation: "ld-modal-in 0.22s cubic-bezier(0.22, 0.61, 0.36, 1) both",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: "0.85rem" }}>
          <span
            style={{
              ...g.iconWrap,
              background: danger ? "rgba(248, 113, 113, 0.1)" : "rgba(37, 99, 235, 0.12)",
              border: `1px solid ${danger ? "rgba(248, 113, 113, 0.3)" : "rgba(96, 165, 250, 0.22)"}`,
              color: accent,
            }}
          >
            <Icon size={19} />
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2
              id={titleId}
              style={{
                margin: "0 0 0.35rem",
                fontSize: "1.05rem",
                color: t.color.heading,
                letterSpacing: "-0.2px",
              }}
            >
              {title}
            </h2>
            <div
              id={descId}
              style={{
                fontSize: "0.87rem",
                lineHeight: 1.6,
                color: t.color.muted,
                overflowWrap: "break-word",
              }}
            >
              {message}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "0.6rem",
            marginTop: "1.4rem",
            flexWrap: "wrap",
          }}
        >
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="ld-btn"
            style={{ ...g.ghostButton, padding: "0.55rem 1rem", fontSize: "0.85rem" }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="ld-btn"
            style={{
              ...g.buttonBase,
              padding: "0.55rem 1rem",
              fontSize: "0.85rem",
              color: "#ffffff",
              background: danger
                ? "linear-gradient(180deg, #ef4444 0%, #dc2626 100%)"
                : "linear-gradient(180deg, #2f6bff 0%, #2356e6 100%)",
              border: `1px solid ${danger ? "rgba(252, 165, 165, 0.5)" : "rgba(96, 165, 250, 0.6)"}`,
              boxShadow: danger
                ? "0 10px 26px rgba(220, 38, 38, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.18)"
                : t.shadow.glowPrimary,
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
