"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type ThemePref } from "@/lib/use-theme";

const OPTIONS: { value: ThemePref; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Claro", Icon: Sun },
  { value: "dark", label: "Escuro", Icon: Moon },
  { value: "system", label: "Sistema", Icon: Monitor },
];

export function ThemeToggle() {
  const { pref, setTheme } = useTheme();

  return (
    <div
      className="inline-flex rounded-full p-1"
      role="radiogroup"
      aria-label="Tema"
      style={{ background: "color-mix(in srgb, var(--arena-foreground) 6%, transparent)" }}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const on = pref === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => setTheme(value)}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition"
            style={
              on
                ? { background: "var(--arena-primary)", color: "#fff" }
                : { color: "var(--arena-muted)" }
            }
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
