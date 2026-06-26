import { useState } from "react";

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
    <div style={{ marginTop: "0.5rem" }}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        style={{
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
          fontSize: "0.7rem",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: "#94a3b8",
          display: "inline-flex",
          alignItems: "center",
          gap: "0.3rem",
        }}
      >
        <span style={{ fontSize: "0.6rem" }}>{expanded ? "▼" : "▶"}</span>
        Kaynaklar ({sources.length})
      </button>
      {expanded && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.4rem",
            marginTop: "0.4rem",
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
        background: "#0f172a",
        border: "1px solid #334155",
        borderRadius: 8,
        padding: "0.5rem 0.6rem",
        fontSize: "0.8rem",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          background: "transparent",
          border: "none",
          color: "#e2e8f0",
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: 0,
          fontSize: "0.8rem",
        }}
      >
        <span style={{ wordBreak: "break-all", textAlign: "left" }}>
          📄 {source.document}
          {pageLabel}
        </span>
        <span style={{ color: "#64748b", whiteSpace: "nowrap", marginLeft: "0.5rem" }}>
          %{Math.round(source.score * 100)} {open ? "▲" : "▼"}
        </span>
      </button>
      {open && (
        <p
          style={{
            margin: "0.5rem 0 0",
            color: "#cbd5e1",
            lineHeight: 1.5,
            whiteSpace: "pre-wrap",
          }}
        >
          {source.text}
        </p>
      )}
    </div>
  );
}
