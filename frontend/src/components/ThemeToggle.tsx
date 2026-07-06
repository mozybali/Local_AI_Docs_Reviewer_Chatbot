import { Moon, Sun } from "lucide-react";
import { glass as g } from "../lib/ui";
import { useTheme } from "../lib/useTheme";

/** Aydınlık/karanlık tema anahtarı; nav ve auth ekranlarında kullanılır. */
export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";
  const label = dark ? "Aydınlık moda geç" : "Karanlık moda geç";

  return (
    <button
      type="button"
      onClick={toggle}
      className="ld-btn"
      aria-label={label}
      title={label}
      style={{
        ...g.smallButton,
        padding: 0,
        width: 32,
        height: 32,
        borderRadius: 8,
        flexShrink: 0,
      }}
    >
      {dark ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}
