import { useCallback, useEffect, useState, type ComponentType } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Files,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  Trash2,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import { apiFetch, getErrorMessage } from "../lib/api";
import { glass as g, tokens as t, ui } from "../lib/ui";
import StatusBadge from "./StatusBadge";
import Spinner from "./Spinner";

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

type Icon = ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;

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

  // setState'ler promise callback'lerinde çalışır; böylece efekt gövdesinden
  // doğrudan çağrılabilir (react-hooks/set-state-in-effect). Mutasyon sonrası
  // çağrılarda panel "Yükleniyor..." ekranına dönmez (sessiz tazeleme);
  // yalnızca ilk yükleme ve Yenile butonu tam yükleme durumu gösterir.
  const load = useCallback(() => {
    if (!token) return Promise.resolve();
    return Promise.all([
      apiFetch<AdminUser[]>("/admin/users", { token }),
      apiFetch<AdminDocument[]>("/admin/documents", { token }),
      apiFetch<AdminStats>("/admin/stats", { token }),
    ])
      .then(([u, d, s]) => {
        setUsers(u);
        setDocuments(d);
        setStats(s);
        setError(null);
      })
      .catch((err: unknown) => {
        setError(getErrorMessage(err, "Yönetim verileri yüklenemedi."));
      })
      .finally(() => setLoading(false));
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
      setError(getErrorMessage(err, "Kullanıcı güncellenemedi."));
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
      setError(getErrorMessage(err, "Doküman silinemedi."));
    } finally {
      setDeletingDocId(null);
    }
  }

  if (loading) {
    return (
      <p
        style={{
          color: t.color.muted,
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
        }}
      >
        <Spinner /> Yükleniyor...
      </p>
    );
  }

  return (
    <div className="ld-fade-in">
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: "1rem",
        }}
      >
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            void load();
          }}
          className="ld-btn"
          style={g.smallButton}
        >
          <RefreshCw size={12} />
          Yenile
        </button>
      </div>

      {error && (
        <div style={ui.error} role="alert">
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{error}</span>
        </div>
      )}

      {/* İstatistikler */}
      {stats && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
            gap: "0.75rem",
            marginBottom: "2rem",
          }}
        >
          <StatCard icon={Users} label="Kullanıcı" value={stats.total_users} />
          <StatCard
            icon={UserCheck}
            label="Aktif Kullanıcı"
            value={stats.active_users}
            accent={t.color.cyan}
          />
          <StatCard
            icon={Files}
            label="Doküman"
            value={stats.total_documents}
          />
          <StatCard
            icon={CheckCircle2}
            label="Hazır Doküman"
            value={stats.documents_by_status?.ready ?? 0}
            accent={t.color.emerald}
          />
        </div>
      )}

      {/* Kullanıcılar */}
      <h2 style={sectionHeading}>Kullanıcılar</h2>
      <div style={{ overflowX: "auto", marginBottom: "2rem" }}>
        <table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={g.tableHeadCell}>E-posta</th>
              <th style={g.tableHeadCell}>Rol</th>
              <th style={g.tableHeadCell}>Durum</th>
              <th style={{ ...g.tableHeadCell, textAlign: "right" }}>Doküman</th>
              <th style={{ ...g.tableHeadCell, textAlign: "right" }}>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const isSelf = user.id === currentUserId;
              const busy = busyUserId === user.id;
              const actionDisabledStyle =
                busy || isSelf ? { opacity: 0.5, cursor: "not-allowed" } : {};
              return (
                <tr key={user.id}>
                  <td style={g.tableCell}>
                    <span style={{ wordBreak: "break-all", color: t.color.heading }}>
                      {user.email}
                    </span>
                    {isSelf && (
                      <span style={{ color: t.color.subtle, fontSize: "0.75rem" }}>
                        {" "}
                        (siz)
                      </span>
                    )}
                  </td>
                  <td style={g.tableCell}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.35rem",
                        color: user.role === "admin" ? t.color.amber : "#cbd5e1",
                        fontWeight: 600,
                      }}
                    >
                      {user.role === "admin" && <ShieldCheck size={13} />}
                      {user.role}
                    </span>
                  </td>
                  <td style={g.tableCell}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.35rem",
                        color: user.is_active ? "#86efac" : "#fca5a5",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: user.is_active ? t.color.emerald : t.color.danger,
                        }}
                      />
                      {user.is_active ? "Aktif" : "Pasif"}
                    </span>
                  </td>
                  <td style={{ ...g.tableCell, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {user.document_count}
                  </td>
                  <td
                    style={{
                      ...g.tableCell,
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
                      className="ld-btn"
                      style={{
                        ...g.smallButton,
                        marginRight: "0.4rem",
                        ...actionDisabledStyle,
                      }}
                    >
                      {user.role === "admin" ? (
                        <ShieldOff size={12} />
                      ) : (
                        <ShieldCheck size={12} />
                      )}
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
                      className="ld-btn"
                      style={{
                        ...(user.is_active ? g.smallDangerButton : g.smallButton),
                        ...actionDisabledStyle,
                      }}
                    >
                      {user.is_active ? <UserX size={12} /> : <UserCheck size={12} />}
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
      <h2 style={sectionHeading}>Tüm Dokümanlar</h2>
      <div style={{ overflowX: "auto" }}>
        {documents.length === 0 ? (
          <p style={{ color: t.color.muted, fontSize: "0.9rem" }}>
            Sistemde doküman yok.
          </p>
        ) : (
          <table style={{ width: "100%", minWidth: 720, borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={g.tableHeadCell}>Dosya</th>
                <th style={g.tableHeadCell}>Sahip</th>
                <th style={g.tableHeadCell}>Tip</th>
                <th style={g.tableHeadCell}>Durum</th>
                <th style={g.tableHeadCell}>Yüklenme</th>
                <th style={{ ...g.tableHeadCell, textAlign: "right" }}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id}>
                  <td style={g.tableCell}>
                    <span style={{ wordBreak: "break-all", color: t.color.heading }}>
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
                  <td style={{ ...g.tableCell, color: t.color.muted }}>
                    {doc.owner_email}
                  </td>
                  <td style={{ ...g.tableCell, textTransform: "uppercase", color: t.color.muted }}>
                    {doc.file_type}
                  </td>
                  <td style={g.tableCell}>
                    <StatusBadge status={doc.status} />
                  </td>
                  <td style={{ ...g.tableCell, color: t.color.muted, whiteSpace: "nowrap" }}>
                    {formatDate(doc.upload_date)}
                  </td>
                  <td style={{ ...g.tableCell, textAlign: "right" }}>
                    <button
                      type="button"
                      disabled={deletingDocId === doc.id}
                      onClick={() => deleteDocument(doc)}
                      className="ld-btn"
                      style={{
                        ...g.smallDangerButton,
                        ...(deletingDocId === doc.id
                          ? { opacity: 0.6, cursor: "not-allowed" }
                          : {}),
                      }}
                    >
                      {deletingDocId === doc.id ? (
                        <Spinner size={12} thickness={2} />
                      ) : (
                        <Trash2 size={12} />
                      )}
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

const sectionHeading = {
  fontSize: "1.05rem",
  margin: "0 0 0.75rem",
  color: t.color.heading,
  letterSpacing: "-0.2px",
} as const;

function StatCard({
  icon: StatIcon,
  label,
  value,
  accent = t.color.primarySoft,
}: {
  icon: Icon;
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div style={g.statCard} className="ld-glass-soft">
      <span
        style={{
          ...g.iconWrap,
          width: 38,
          height: 38,
          color: accent,
          background: "rgba(148, 163, 184, 0.07)",
          border: `1px solid ${t.color.borderStrong}`,
        }}
      >
        <StatIcon size={17} />
      </span>
      <span>
        <span
          style={{
            display: "block",
            fontSize: "1.45rem",
            fontWeight: 700,
            color: t.color.heading,
            lineHeight: 1.2,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {value}
        </span>
        <span style={{ display: "block", fontSize: "0.74rem", color: t.color.muted }}>
          {label}
        </span>
      </span>
    </div>
  );
}
