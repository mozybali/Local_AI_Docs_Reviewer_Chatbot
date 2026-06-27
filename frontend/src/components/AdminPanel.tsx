import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { ApiError, apiFetch } from "../lib/api";
import StatusBadge from "./StatusBadge";

// --- Tipler --------------------------------------------------------------

interface AdminUser {
  id: number;
  email: string;
  role: "user" | "admin";
  is_active: boolean;
  document_count: number;
}

interface AdminDocument {
  id: number;
  filename: string;
  file_type: string;
  status: string;
  error_msg: string | null;
  upload_date: string;
  user_id: number;
  owner_email: string;
}

interface AdminStats {
  total_users: number;
  active_users: number;
  total_documents: number;
  documents_by_status: Record<string, number>;
}

interface AdminPanelProps {
  token: string | null;
  currentUserId: number | undefined;
}

// --- Stiller -------------------------------------------------------------

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

const smallButton: CSSProperties = {
  borderRadius: 8,
  padding: "0.3rem 0.7rem",
  cursor: "pointer",
  fontSize: "0.8rem",
  background: "transparent",
  border: "1px solid #334155",
  color: "#cbd5e1",
};

const dangerButton: CSSProperties = {
  ...smallButton,
  color: "#f87171",
  border: "1px solid #7f1d1d",
};

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("tr-TR");
}

// --- Bileşen -------------------------------------------------------------

export default function AdminPanel({ token, currentUserId }: AdminPanelProps) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [documents, setDocuments] = useState<AdminDocument[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<number | null>(null);
  const [deletingDocId, setDeletingDocId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [u, d, s] = await Promise.all([
        apiFetch<AdminUser[]>("/admin/users", { token }),
        apiFetch<AdminDocument[]>("/admin/documents", { token }),
        apiFetch<AdminStats>("/admin/stats", { token }),
      ]);
      setUsers(u);
      setDocuments(d);
      setStats(s);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Yönetim verileri yüklenemedi.",
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patchUser(user: AdminUser, body: Partial<AdminUser>) {
    setBusyUserId(user.id);
    setError(null);
    try {
      const updated = await apiFetch<AdminUser>(`/admin/users/${user.id}`, {
        method: "PATCH",
        token,
        json: body,
      });
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      // İstatistik kartları (ör. "Aktif Kullanıcı") kaymasın diye yenile.
      void load();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Kullanıcı güncellenemedi.",
      );
    } finally {
      setBusyUserId(null);
    }
  }

  async function deleteDocument(doc: AdminDocument) {
    if (
      !window.confirm(
        `"${doc.filename}" dokümanını (${doc.owner_email}) silmek istediğinize emin misiniz?`,
      )
    ) {
      return;
    }
    setDeletingDocId(doc.id);
    setError(null);
    try {
      await apiFetch<void>(`/admin/documents/${doc.id}`, {
        method: "DELETE",
        token,
      });
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      // İstatistik sayıları kaymasın diye yenile.
      void load();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Doküman silinemedi.",
      );
    } finally {
      setDeletingDocId(null);
    }
  }

  if (loading) {
    return <p style={{ color: "#94a3b8" }}>Yükleniyor...</p>;
  }

  return (
    <div>
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

      {/* İstatistikler */}
      {stats && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
            gap: "0.75rem",
            marginBottom: "2rem",
          }}
        >
          <StatCard label="Kullanıcı" value={stats.total_users} />
          <StatCard label="Aktif Kullanıcı" value={stats.active_users} />
          <StatCard label="Doküman" value={stats.total_documents} />
          <StatCard
            label="Hazır Doküman"
            value={stats.documents_by_status?.ready ?? 0}
          />
        </div>
      )}

      {/* Kullanıcılar */}
      <h2 style={{ fontSize: "1.1rem", margin: "0 0 0.75rem" }}>Kullanıcılar</h2>
      <div style={{ overflowX: "auto", marginBottom: "2rem" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={headCell}>E-posta</th>
              <th style={headCell}>Rol</th>
              <th style={headCell}>Durum</th>
              <th style={{ ...headCell, textAlign: "right" }}>Doküman</th>
              <th style={{ ...headCell, textAlign: "right" }}>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const isSelf = user.id === currentUserId;
              const busy = busyUserId === user.id;
              return (
                <tr key={user.id}>
                  <td style={cell}>
                    <span style={{ wordBreak: "break-all" }}>{user.email}</span>
                    {isSelf && (
                      <span style={{ color: "#64748b", fontSize: "0.75rem" }}>
                        {" "}
                        (siz)
                      </span>
                    )}
                  </td>
                  <td style={cell}>
                    <span
                      style={{
                        color: user.role === "admin" ? "#fbbf24" : "#cbd5e1",
                        fontWeight: 600,
                      }}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td style={cell}>
                    <span
                      style={{
                        color: user.is_active ? "#86efac" : "#fca5a5",
                        fontSize: "0.8rem",
                      }}
                    >
                      {user.is_active ? "Aktif" : "Pasif"}
                    </span>
                  </td>
                  <td style={{ ...cell, textAlign: "right" }}>
                    {user.document_count}
                  </td>
                  <td
                    style={{
                      ...cell,
                      textAlign: "right",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <button
                      type="button"
                      disabled={busy || isSelf}
                      onClick={() =>
                        patchUser(user, {
                          role: user.role === "admin" ? "user" : "admin",
                        })
                      }
                      title={
                        isSelf ? "Kendi rolünüzü değiştiremezsiniz." : undefined
                      }
                      style={{
                        ...smallButton,
                        marginRight: "0.4rem",
                        opacity: busy || isSelf ? 0.5 : 1,
                        cursor: busy || isSelf ? "not-allowed" : "pointer",
                      }}
                    >
                      {user.role === "admin" ? "Admin'i kaldır" : "Admin yap"}
                    </button>
                    <button
                      type="button"
                      disabled={busy || isSelf}
                      onClick={() =>
                        patchUser(user, { is_active: !user.is_active })
                      }
                      title={
                        isSelf
                          ? "Kendi hesabınızı pasifleştiremezsiniz."
                          : undefined
                      }
                      style={{
                        ...(user.is_active ? dangerButton : smallButton),
                        opacity: busy || isSelf ? 0.5 : 1,
                        cursor: busy || isSelf ? "not-allowed" : "pointer",
                      }}
                    >
                      {user.is_active ? "Pasifleştir" : "Aktifleştir"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Dokümanlar */}
      <h2 style={{ fontSize: "1.1rem", margin: "0 0 0.75rem" }}>
        Tüm Dokümanlar
      </h2>
      <div style={{ overflowX: "auto" }}>
        {documents.length === 0 ? (
          <p style={{ color: "#94a3b8", fontSize: "0.9rem" }}>
            Sistemde doküman yok.
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={headCell}>Dosya</th>
                <th style={headCell}>Sahip</th>
                <th style={headCell}>Tip</th>
                <th style={headCell}>Durum</th>
                <th style={headCell}>Yüklenme</th>
                <th style={{ ...headCell, textAlign: "right" }}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id}>
                  <td style={cell}>
                    <span style={{ wordBreak: "break-all" }}>
                      {doc.filename}
                    </span>
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
                  <td style={{ ...cell, color: "#94a3b8" }}>{doc.owner_email}</td>
                  <td style={{ ...cell, textTransform: "uppercase" }}>
                    {doc.file_type}
                  </td>
                  <td style={cell}>
                    <StatusBadge status={doc.status} />
                  </td>
                  <td style={{ ...cell, color: "#94a3b8" }}>
                    {formatDate(doc.upload_date)}
                  </td>
                  <td style={{ ...cell, textAlign: "right" }}>
                    <button
                      type="button"
                      disabled={deletingDocId === doc.id}
                      onClick={() => deleteDocument(doc)}
                      style={{
                        ...dangerButton,
                        opacity: deletingDocId === doc.id ? 0.6 : 1,
                        cursor:
                          deletingDocId === doc.id ? "not-allowed" : "pointer",
                      }}
                    >
                      {deletingDocId === doc.id ? "Siliniyor..." : "Sil"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        background: "#0f172a",
        border: "1px solid #334155",
        borderRadius: 10,
        padding: "1rem",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: "1.6rem", fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.25rem" }}>
        {label}
      </div>
    </div>
  );
}
