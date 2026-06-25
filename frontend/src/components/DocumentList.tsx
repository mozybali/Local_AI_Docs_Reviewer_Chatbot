import type { CSSProperties } from "react";
import StatusBadge from "./StatusBadge";

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

const cell: CSSProperties = {
  padding: "0.6rem 0.5rem",
  borderBottom: "1px solid #334155",
  textAlign: "left",
  verticalAlign: "top",
  fontSize: "0.85rem",
};

const headCell: CSSProperties = {
  ...cell,
  color: "#94a3b8",
  fontWeight: 600,
  fontSize: "0.75rem",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
};

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
      <p style={{ color: "#94a3b8", fontSize: "0.9rem" }}>
        Henüz doküman yüklemediniz.
      </p>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={headCell}>Dosya</th>
            <th style={headCell}>Tip</th>
            <th style={headCell}>Durum</th>
            <th style={{ ...headCell, textAlign: "right" }}>Chunk</th>
            <th style={headCell}>Yüklenme</th>
            <th style={{ ...headCell, textAlign: "right" }}>İşlem</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => (
            <tr key={doc.id}>
              <td style={cell}>
                <span style={{ wordBreak: "break-all" }}>{doc.filename}</span>
                {doc.status === "error" && doc.error_msg && (
                  <div
                    style={{
                      color: "#fca5a5",
                      fontSize: "0.75rem",
                      marginTop: "0.25rem",
                    }}
                  >
                    {doc.error_msg}
                  </div>
                )}
              </td>
              <td style={{ ...cell, textTransform: "uppercase" }}>
                {doc.file_type}
              </td>
              <td style={cell}>
                <StatusBadge status={doc.status} />
              </td>
              <td style={{ ...cell, textAlign: "right" }}>{doc.chunk_count}</td>
              <td style={{ ...cell, color: "#94a3b8" }}>
                {formatDate(doc.upload_date)}
              </td>
              <td style={{ ...cell, textAlign: "right" }}>
                <button
                  type="button"
                  onClick={() => onDelete(doc.id)}
                  disabled={deletingId === doc.id}
                  style={{
                    background: "transparent",
                    color: "#f87171",
                    border: "1px solid #7f1d1d",
                    borderRadius: 8,
                    padding: "0.3rem 0.7rem",
                    cursor: deletingId === doc.id ? "not-allowed" : "pointer",
                    fontSize: "0.8rem",
                    opacity: deletingId === doc.id ? 0.6 : 1,
                  }}
                >
                  {deletingId === doc.id ? "Siliniyor..." : "Sil"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
