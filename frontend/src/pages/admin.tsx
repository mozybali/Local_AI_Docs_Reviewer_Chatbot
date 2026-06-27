import { useAuth } from "../context/AuthContext";
import { ui } from "../lib/ui";
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
          style={{ ...ui.panel, maxWidth: 980 }}
          className="ld-card ld-fade-in"
        >
          <h1 style={{ margin: "0 0 1.5rem", fontSize: "1.5rem" }}>
            Admin Paneli
          </h1>

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
