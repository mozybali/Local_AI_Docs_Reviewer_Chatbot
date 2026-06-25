import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiFetch } from "../lib/api";

export interface User {
  id: number;
  email: string;
  role: "user" | "admin";
  is_active: boolean;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const TOKEN_STORAGE_KEY = "localdoc_token";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Uygulama açılışında localStorage'daki token ile oturumu geri yükle.
  useEffect(() => {
    const stored =
      typeof window !== "undefined"
        ? window.localStorage.getItem(TOKEN_STORAGE_KEY)
        : null;

    if (!stored) {
      setLoading(false);
      return;
    }

    setToken(stored);
    apiFetch<User>("/auth/me", { token: stored })
      .then((me) => setUser(me))
      .catch(() => {
        // Token geçersiz/expired: temizle.
        window.localStorage.removeItem(TOKEN_STORAGE_KEY);
        setToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const applyToken = useCallback(async (newToken: string) => {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, newToken);
    setToken(newToken);
    const me = await apiFetch<User>("/auth/me", { token: newToken });
    setUser(me);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await apiFetch<TokenResponse>("/auth/login", {
        method: "POST",
        json: { email, password },
      });
      await applyToken(res.access_token);
    },
    [applyToken],
  );

  const register = useCallback(
    async (email: string, password: string) => {
      await apiFetch<User>("/auth/register", {
        method: "POST",
        json: { email, password },
      });
      // Kayıt sonrası otomatik giriş.
      await login(email, password);
    },
    [login],
  );

  const logout = useCallback(() => {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      loading,
      isAuthenticated: Boolean(token && user),
      login,
      register,
      logout,
    }),
    [user, token, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error("useAuth, AuthProvider içinde kullanılmalıdır.");
  }
  return ctx;
}
