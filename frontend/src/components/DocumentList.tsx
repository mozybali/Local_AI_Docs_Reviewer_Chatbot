import Link from "next/link";
import { FileText, Trash2, UploadCloud } from "lucide-react";
import { glass as g, tokens as t } from "../lib/ui";
import StatusBadge from "./StatusBadge";
import Spinner from "./Spinner";

export interface DocumentItem {
  id: number;
  filename: string;
  file_type: string;
  status: string;
  error_msg: string | null;
  upload_date: string;
  chunk_count: number;
}

interface DocumentListProps {
  documents: DocumentItem[];
  onDelete: (id: number) => void;
  deletingId?: number | null;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("tr-TR");
}

export default function DocumentList({
  documents,
  onDelete,
  deletingId,
}: DocumentListProps) {
  if (documents.length === 0) {
    return (
      <div
        style={{
          ...g.glassPanelSoft,
          padding: "2.5rem 1.5rem",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.8rem",
        }}
      >
        <span style={{ ...g.iconWrap, width: 46, height: 46 }}>
          <FileText size={21} />
        </span>
        <p style={{ margin: 0, color: t.color.muted, fontSize: "0.9rem", maxWidth: 340, lineHeight: 1.55 }}>
          Henüz doküman yüklemediniz. İlk dokümanınızı yükleyin; işlendikten
          sonra sohbette kaynak olarak kullanılabilir.
        </p>
        <Link href="/upload" className="ld-btn" style={{ ...g.glassButton, marginTop: "0.3rem" }}>
          <UploadCloud size={15} />
          Doküman Yükle
        </Link>
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table
        className="ld-doc-table"
        style={{ width: "100%", minWidth: 640, borderCollapse: "collapse" }}
      >
        <thead>
          <tr>
            <th style={g.tableHeadCell}>Dosya</th>
            <th style={g.tableHeadCell}>Tip</th>
            <th style={g.tableHeadCell}>Durum</th>
            <th style={{ ...g.tableHeadCell, textAlign: "right" }}>Chunk</th>
            <th style={g.tableHeadCell}>Yüklenme</th>
            <th style={{ ...g.tableHeadCell, textAlign: "right" }}>İşlem</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => (
            <tr key={doc.id} className="ld-doc-row">
              <td style={g.tableCell}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "flex-start",
                    gap: "0.45rem",
                    wordBreak: "break-all",
                    color: t.color.heading,
                  }}
                >
                  <FileText
                    size={14}
                    color={t.color.primarySoft}
                    style={{ flexShrink: 0, marginTop: 2 }}
                  />
                  {doc.filename}
                </span>
                {doc.status === "error" && doc.error_msg && (
                  <div
                    style={{
                      color: "#fca5a5",
                      fontSize: "0.75rem",
                      marginTop: "0.3rem",
                      lineHeight: 1.45,
                    }}
                  >
                    {doc.error_msg}
                  </div>
                )}
              </td>
              <td style={{ ...g.tableCell, textTransform: "uppercase", color: t.color.muted }}>
                {doc.file_type}
              </td>
              <td style={g.tableCell}>
                <StatusBadge status={doc.status} />
              </td>
              <td style={{ ...g.tableCell, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                {doc.chunk_count}
              </td>
              <td style={{ ...g.tableCell, color: t.color.muted, whiteSpace: "nowrap" }}>
                {formatDate(doc.upload_date)}
              </td>
              <td style={{ ...g.tableCell, textAlign: "right" }}>
                <button
                  type="button"
                  onClick={() => onDelete(doc.id)}
                  disabled={deletingId === doc.id}
                  className="ld-btn"
                  style={{
                    ...g.smallDangerButton,
                    ...(deletingId === doc.id
                      ? { opacity: 0.6, cursor: "not-allowed" }
                      : {}),
                  }}
                >
                  {deletingId === doc.id ? (
                    <Spinner size={12} thickness={2} />
                  ) : (
                    <Trash2 size={12} />
                  )}
                  {deletingId === doc.id ? "Siliniyor..." : "Sil"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <style jsx>{`
        .ld-doc-table :global(.ld-doc-row) {
          transition: background 0.15s ease;
        }
        .ld-doc-table :global(.ld-doc-row:hover) {
          background: rgba(37, 99, 235, 0.05);
        }
      `}</style>
    </div>
  );
}
