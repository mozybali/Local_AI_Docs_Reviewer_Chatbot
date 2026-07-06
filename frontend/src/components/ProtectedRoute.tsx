import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";
import { tokens as t, ui } from "../lib/ui";
import Spinner from "./Spinner";

interface ProtectedRouteProps {
  children: ReactNode;
  // Yalnızca admin erişimine açmak için (Hafta 5'te admin paneli kullanır).
  adminOnly?: boolean;
}

/**
 * Korumalı sayfalar için sarmalayıcı.
 * - Oturum yoksa `/login`'e yönlendirir.
 * - `adminOnly` ise ve kullanıcı admin değilse `/`'a yönlendirir.
 * - Yükleme/yönlendirme sırasında basit bir bekleme ekranı gösterir.
 */
export default function ProtectedRoute({
  children,
  adminOnly = false,
}: ProtectedRouteProps) {
  const { user, loading, isAuthenticated } = useAuth();
  const router = useRouter();

  const isAdmin = user?.role === "admin";
  const allowed = isAuthenticated && (!adminOnly || isAdmin);

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      router.replace("/login");
    } else if (adminOnly && !isAdmin) {
      // Giriş yapmış ama yetkisi olmayan kullanıcıyı login'e değil ana sayfaya
      // yönlendiriyoruz; `denied` parametresi ana sayfada neden döndüğünü
      // açıklayan bir bilgilendirme göstermek için kullanılır.
      router.replace({ pathname: "/", query: { denied: "admin" } });
    }
  }, [loading, isAuthenticated, adminOnly, isAdmin, router]);

  if (loading || !allowed) {
    return (
      <div style={ui.page} className="ld-page">
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
      </div>
    );
  }

  return <>{children}</>;
}
