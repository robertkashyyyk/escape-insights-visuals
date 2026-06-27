import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";

export type Theme = "dark" | "brand" | "light";
const THEMES: Theme[] = ["dark", "brand", "light"];
const STORAGE_KEY = "eg-theme";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void; // cycles dark → brand → light → dark
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  // Keep the .dark/.light classes too, so existing Tailwind `dark:` variants and
  // `.light` CSS selectors still resolve. Brand is a dark-ground theme → use .dark.
  root.classList.remove("light", "dark");
  root.classList.add(theme === "light" ? "light" : "dark");
  root.style.colorScheme = theme === "light" ? "light" : "dark";
}

function getInitialTheme(): Theme {
  // Default stays "dark" until the colour-utility migration (phase 2) lands, so
  // nobody gets the not-yet-polished brand/light by default. Flip to "brand" after.
  if (typeof window === "undefined") return "dark";
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored && THEMES.includes(stored)) return stored;
  } catch {}
  return "dark";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const t = getInitialTheme();
    if (typeof document !== "undefined") applyTheme(t);
    return t;
  });

  useEffect(() => {
    applyTheme(theme);
    try { localStorage.setItem(STORAGE_KEY, theme); } catch {}
  }, [theme]);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);
  const toggleTheme = useCallback(
    () => setThemeState((t) => THEMES[(THEMES.indexOf(t) + 1) % THEMES.length]),
    [],
  );

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
