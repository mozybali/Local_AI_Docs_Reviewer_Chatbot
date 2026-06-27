import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import ProtectedRoute from "../components/ProtectedRoute";
import AdminPanel from "../components/AdminPanel";

function AdminContent() {
  const { user, token, logout } = useAuth();

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "2rem 1.5rem",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 960,
          background: "#1e293b",
          border: "1px solid #334155",
          borderRadius: 12,
          padding: "2rem",
          boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1rem",
          }}
        >
          <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
            {user?.email} (admin)
          </span>
          <button
            type="button"
            onClick={logout}
            style={{
              background: "transparent",
              color: "#f87171",
              border: "1px solid #7f1d1d",
              borderRadius: 8,
              padding: "0.3rem 0.7rem",
              cursor: "pointer",
              fontSize: "0.8rem",
            }}
          >
            Çıkış
          </button>
        </div>

        <h1 style={{ margin: "0 0 1.5rem", fontSize: "1.5rem" }}>
          Admin Paneli
        </h1>

        <AdminPanel token={token} currentUserId={user?.id} />

        <p
          style={{
            marginTop: "1.5rem",
            fontSize: "0.85rem",
            color: "#94a3b8",
          }}
        >
          <Link href="/">Ana sayfa</Link>
        </p>
      </div>
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
