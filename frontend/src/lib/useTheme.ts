import { useCallback, useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "ld-theme";

// Aktif tema tek bir dış kaynakta tutulur: <html data-theme> özniteliği
// (_document.tsx'teki script ilk boyamadan önce ayarlar). Bileşenler bu
// özniteliği useSyncExternalStore ile okur; toggle DOM'u günceller ve
// aboneleri uyarır. Böylece SSR/hydration uyumsuzluğu ve effect içinde
// setState çağrısı olmadan tema paylaşılır.
const listeners = new Set<() => void>();

function currentTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

/**
 * Aktif temayı okur ve değiştirir. SSR'da "light" döner; istemcide gerçek
 * `data-theme` değerine eşitlenir. Toggle seçimi localStorage'a kalıcılaşır.
 */
export function useTheme() {
  const theme = useSyncExternalStore(
    subscribe,
    currentTheme,
    () => "light" as Theme,
  );

  const toggle = useCallback(() => {
    const next: Theme = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage kapalıysa tema yalnızca bu oturum için değişir.
    }
    listeners.forEach((notify) => notify());
  }, []);

  return { theme, toggle };
}
