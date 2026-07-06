import type { CSSProperties } from "react";

interface SpinnerProps {
  // Çap (px). Varsayılan küçük, satır içi kullanım için uygundur.
  size?: number;
  // Çizgi kalınlığı (px).
  thickness?: number;
  color?: string;
  // Boş (track) renk; varsayılan yarı saydam.
  trackColor?: string;
  style?: CSSProperties;
}

/**
 * Dönen yükleme göstergesi. Global `ld-spin` keyframe'ini kullanır
 * (bkz. `_app.tsx`). Düğme içinde veya tek başına kullanılabilir.
 */
export default function Spinner({
  size = 16,
  thickness = 2,
  color = "currentColor",
  // Metin rengini takip eder; her iki temada da bağlamla uyumlu kalır.
  trackColor = "color-mix(in srgb, currentColor 30%, transparent)",
  style,
}: SpinnerProps) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: size,
        height: size,
        border: `${thickness}px solid ${trackColor}`,
        borderTopColor: color,
        borderRadius: "50%",
        animation: "ld-spin 0.7s linear infinite",
        verticalAlign: "middle",
        flexShrink: 0,
        ...style,
      }}
    />
  );
}
