import { useState } from "react";
import { ChevronDown, ChevronRight, ChevronUp, FileText } from "lucide-react";
import { tokens as t } from "../lib/ui";

// `/chat/ask` cevabındaki tek bir kaynak (retrieval sonucu).
export interface Source {
  document: string;
  page: number | null;
  chunk_index: number;
  score: number;
  text: string;
}

interface SourcePanelProps {
  sources: Source[];
}

/**
 * Bir asistan cevabının dayandığı kaynakları (doküman adı, sayfa, skor ve
 * ilgili metin) gösterir. Cevabın altında yer kaplamaması için tüm kaynak
 * listesi tek bir "Kaynaklar" düğmesinin arkasına gizlenir; varsayılan olarak
 * kapalıdır. Açıldığında her kaynak metni de tek tek genişletilebilir.
 */
export default function SourcePanel({ sources }: SourcePanelProps) {
  const [expanded, setExpanded] = useState(false);

  if (sources.length === 0) return null;

  return (
    <div style={{ marginTop: "0.55rem" }}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        style={{
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
          fontSize: "0.7rem",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: t.color.muted,
          display: "inline-flex",
          alignItems: "center",
          gap: "0.3rem",
        }}
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        Kaynaklar ({sources.length})
      </button>
      {expanded && (
        <div
          className="ld-fade-in"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.4rem",
            marginTop: "0.45rem",
          }}
        >
          {sources.map((source, index) => (
            <SourceItem
              key={`${source.document}-${source.chunk_index}-${index}`}
              source={source}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SourceItem({ source }: { source: Source }) {
  const [open, setOpen] = useState(false);
  const pageLabel = source.page != null ? ` · s. ${source.page}` : "";

  return (
    <div
      style={{
        background: t.color.codeBg,
        border: `1px solid ${t.color.border}`,
        borderRadius: t.radius.md,
        padding: "0.5rem 0.6rem",
        fontSize: "0.8rem",
        boxShadow: t.shadow.insetHi,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          width: "100%",
          background: "transparent",
          border: "none",
          color: t.color.text,
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "0.5rem",
          padding: 0,
          fontSize: "0.8rem",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            wordBreak: "break-all",
            textAlign: "left",
            minWidth: 0,
          }}
        >
          <FileText size={13} color={t.color.primarySoft} style={{ flexShrink: 0 }} />
          {source.document}
          {pageLabel}
        </span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.35rem",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: "0.68rem",
              fontWeight: 700,
              color: t.color.cyan,
              background: "var(--ld-info-bg)",
              border: "1px solid var(--ld-info-border)",
              borderRadius: t.radius.xs,
              padding: "0.08rem 0.4rem",
            }}
          >
            %{Math.round(source.score * 100)}
          </span>
          {open ? (
            <ChevronUp size={13} color={t.color.subtle} />
          ) : (
            <ChevronDown size={13} color={t.color.subtle} />
          )}
        </span>
      </button>
      {open && (
        <p
          className="ld-fade-in"
          style={{
            margin: "0.5rem 0 0",
            paddingTop: "0.5rem",
            borderTop: `1px solid ${t.color.border}`,
            color: t.color.text,
            lineHeight: 1.55,
            whiteSpace: "pre-wrap",
          }}
        >
          {source.text}
        </p>
      )}
    </div>
  );
}
