import { Shield } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { glass as g, tokens as t, ui } from "../lib/ui";
import ProtectedRoute from "../components/ProtectedRoute";
import Header from "../components/Header";
import AdminPanel from "../components/AdminPanel";

function AdminContent() {
  const { user, token } = useAuth();

  return (
    <div style={ui.contentPage}>
      <Header />
      <main style={ui.contentBody} className="ld-page">
        <div
          style={{ ...ui.panel, maxWidth: 1020 }}
          className="ld-card ld-glass ld-fade-up"
        >
          <div style={{ marginBottom: "1.5rem" }}>
            <h1 style={ui.pageTitle}>
              <span
                style={{
                  ...g.iconWrap,
                  width: 34,
                  height: 34,
                  background: "var(--ld-warning-bg)",
                  border: "1px solid var(--ld-warning-border)",
                  color: t.color.amber,
                }}
              >
                <Shield size={16} />
              </span>
              Admin Paneli
            </h1>
            <p style={ui.pageSubtitle}>
              Kullanıcıları ve sistemdeki tüm dokümanları yönetin.
            </p>
          </div>

          <AdminPanel token={token} currentUserId={user?.id} />
        </div>
      </main>
    </div>
  );
}

export default function AdminPage() {
  return (
    <ProtectedRoute adminOnly>
      <AdminContent />
    </ProtectedRoute>
  );
}
