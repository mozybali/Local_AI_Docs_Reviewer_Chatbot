import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

interface RevealProps {
  children: ReactNode;
  /** Giriş animasyonu türü (bkz. _app.tsx `.ld-reveal` stilleri). */
  variant?: "up" | "blur" | "left" | "right";
  /** Kademeli (stagger) giriş için gecikme — ms. */
  delay?: number;
  style?: CSSProperties;
  className?: string;
}

/**
 * IntersectionObserver tabanlı scroll reveal sarmalayıcısı.
 * Element viewport'a girince görünür olur, çıkınca sıfırlanır; böylece
 * aşağı/yukarı her iki yönde de animasyon tutarlı çalışır. Animasyon yalnızca
 * opacity/transform kullandığı için layout shift üretmez;
 * prefers-reduced-motion tercihinde CSS tarafında devre dışı kalır.
 */
export default function Reveal({
  children,
  variant = "up",
  delay = 0,
  style,
  className,
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      // Eski tarayıcı: gözlemcisiz, doğrudan görünür işaretle (render tetiklemeden).
      el.classList.add("is-visible");
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setVisible(entry.isIntersecting);
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-variant={variant}
      className={`ld-reveal${visible ? " is-visible" : ""}${className ? ` ${className}` : ""}`}
      style={{ transitionDelay: visible ? `${delay}ms` : "0ms", ...style }}
    >
      {children}
    </div>
  );
}
