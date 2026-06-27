import Link from "next/link";
import { useRouter } from "next/router";
import type { CSSProperties } from "react";
import { useAuth } from "../context/AuthContext";

interface NavLink {
  href: string;
  label: string;
  adminOnly?: boolean;
}

const NAV_LINKS: NavLink[] = [
  { href: "/chat", label: "Sohbet" },
  { href: "/documents", label: "Dokümanlarım" },
  { href: "/upload", label: "Yükle" },
  { href: "/admin", label: "Admin", adminOnly: true },
];

const linkBase: CSSProperties = {
  textDecoration: "none",
  padding: "0.35rem 0.7rem",
  borderRadius: 8,
  fontSize: "0.85rem",
  fontWeight: 600,
  whiteSpace: "nowrap",
};

/**
 * Giriş yapılmış sayfalarda paylaşılan üst gezinme çubuğu.
 * Aktif sayfayı vurgular, role göre Admin bağlantısını gösterir ve çıkış sağlar.
 */
export default function Header() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const isAdmin = user?.role === "admin";

  return (
    <header
      style={{
        width: "100%",
        position: "sticky",
        top: 0,
        zIndex: 10,
        background: "rgba(15, 23, 42, 0.85)",
        backdropFilter: "blur(6px)",
        borderBottom: "1px solid #1e293b",
      }}
    >
      <nav
        style={{
          maxWidth: 980,
          margin: "0 auto",
          padding: "0.75rem 1.25rem",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          flexWrap: "wrap",
        }}
      >
        <Link
          href="/"
          style={{
            textDecoration: "none",
            color: "#e2e8f0",
            fontWeight: 700,
            fontSize: "1.05rem",
            marginRight: "0.5rem",
          }}
        >
          LocalDoc<span style={{ color: "#60a5fa" }}> AI</span>
        </Link>

        <div
          style={{
            display: "flex",
            gap: "0.25rem",
            flexWrap: "wrap",
            flex: 1,
          }}
        >
          {NAV_LINKS.filter((l) => !l.adminOnly || isAdmin).map((link) => {
            const active = router.pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  ...linkBase,
                  color: active ? "#fff" : "#94a3b8",
                  background: active ? "#2563eb" : "transparent",
                }}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        <span
          style={{
            fontSize: "0.8rem",
            color: "#94a3b8",
            maxWidth: 200,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={user?.email}
        >
          {user?.email}
          {isAdmin ? " (admin)" : ""}
        </span>
        <button
          type="button"
          onClick={logout}
          style={{
            background: "transparent",
            color: "#f87171",
            border: "1px solid #7f1d1d",
            borderRadius: 8,
            padding: "0.35rem 0.7rem",
            cursor: "pointer",
            fontSize: "0.8rem",
            fontWeight: 600,
          }}
        >
          Çıkış
        </button>
      </nav>
    </header>
  );
}
