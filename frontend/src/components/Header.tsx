import Link from "next/link";
import { useRouter } from "next/router";
import type { ComponentType } from "react";
import {
  Database,
  FileText,
  LogOut,
  MessageSquare,
  Shield,
  UploadCloud,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { glass as g, tokens as t } from "../lib/ui";

type Icon = ComponentType<{ size?: number; strokeWidth?: number }>;

interface NavLink {
  href: string;
  label: string;
  icon: Icon;
  adminOnly?: boolean;
}

const NAV_LINKS: NavLink[] = [
  { href: "/chat", label: "Sohbet", icon: MessageSquare },
  { href: "/documents", label: "Dokümanlarım", icon: FileText },
  { href: "/upload", label: "Yükle", icon: UploadCloud },
  { href: "/admin", label: "Admin", icon: Shield, adminOnly: true },
];

/**
 * Giriş yapılmış sayfalarda paylaşılan üst gezinme çubuğu (app shell nav).
 * Segment görünümlü sekmelerle aktif sayfayı vurgular, role göre Admin
 * bağlantısını gösterir ve çıkış sağlar.
 */
export default function Header() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const isAdmin = user?.role === "admin";

  return (
    <header style={g.nav} className="ld-glass">
      <nav
        className="ld-header-inner"
        style={{
          maxWidth: 1120,
          margin: "0 auto",
          padding: "0.6rem 1.25rem",
          display: "flex",
          alignItems: "center",
          gap: "0.85rem",
        }}
      >
        <Link href="/" style={g.brand}>
          <span style={g.brandMark}>
            <Database size={15} />
          </span>
          <span className="ld-header-brand-text">
            LocalDoc <span style={{ color: t.color.primarySoft }}>AI</span>
          </span>
        </Link>

        {/* Segment görünümlü sekmeler */}
        <div
          className="ld-header-tabs"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.2rem",
            padding: "0.22rem",
            borderRadius: t.radius.md,
            background: "rgba(15, 23, 42, 0.5)",
            border: `1px solid ${t.color.border}`,
            boxShadow: t.shadow.insetHi,
            overflowX: "auto",
            flex: 1,
            minWidth: 0,
          }}
        >
          {NAV_LINKS.filter((l) => !l.adminOnly || isAdmin).map((link) => {
            const active = router.pathname === link.href;
            const LinkIcon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  textDecoration: "none",
                  padding: "0.38rem 0.75rem",
                  borderRadius: t.radius.sm,
                  fontSize: "0.83rem",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  color: active ? "#ffffff" : t.color.muted,
                  background: active
                    ? "linear-gradient(180deg, #2f6bff, #2356e6)"
                    : "transparent",
                  border: `1px solid ${active ? "rgba(96, 165, 250, 0.55)" : "transparent"}`,
                  boxShadow: active ? t.shadow.insetHi : undefined,
                  transition:
                    "background 0.15s ease, color 0.15s ease, border-color 0.15s ease",
                }}
              >
                <LinkIcon size={14} />
                {link.label}
              </Link>
            );
          })}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.6rem",
            marginLeft: "auto",
            minWidth: 0,
          }}
        >
          <span
            className="ld-header-email"
            style={{
              fontSize: "0.78rem",
              color: t.color.muted,
              maxWidth: 190,
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
            className="ld-btn"
            style={{
              ...g.smallDangerButton,
              padding: "0.4rem 0.75rem",
            }}
          >
            <LogOut size={13} />
            Çıkış
          </button>
        </div>
      </nav>
      <style jsx>{`
        @media (max-width: 760px) {
          .ld-header-email {
            display: none;
          }
        }
        @media (max-width: 560px) {
          .ld-header-inner {
            flex-wrap: wrap;
            gap: 0.5rem !important;
          }
          .ld-header-tabs {
            order: 3;
            flex-basis: 100%;
          }
        }
      `}</style>
    </header>
  );
}
