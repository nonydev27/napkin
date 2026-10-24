"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { Moon, Sun } from "lucide-react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "napkin-theme";
const ThemeContext = createContext<{
  theme: Theme;
  toggleTheme: () => void;
} | null>(null);

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener("napkin-theme-change", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("napkin-theme-change", onChange);
  };
}

function getSnapshot(): Theme {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function getServerSnapshot(): Theme {
  return "dark";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggleTheme = useCallback(() => {
    const nextTheme = getSnapshot() === "dark" ? "light" : "dark";
    try {
      window.localStorage.setItem(STORAGE_KEY, nextTheme);
    } catch {
      // The theme still updates for this tab if browser storage is unavailable.
    }
    document.documentElement.dataset.theme = nextTheme;
    window.dispatchEvent(new Event("napkin-theme-change"));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function ThemeSwitch() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("ThemeSwitch must be used inside ThemeProvider.");

  const { theme, toggleTheme } = context;
  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <button
      aria-label={`Switch to ${nextTheme} theme`}
      aria-pressed={theme === "light"}
      className="theme-switch"
      onClick={toggleTheme}
      title={`Switch to ${nextTheme} theme`}
      type="button"
    >
      {theme === "dark" ? <Sun aria-hidden="true" size={16} /> : <Moon aria-hidden="true" size={16} />}
      <span>{theme === "dark" ? "Light" : "Dark"}</span>
    </button>
  );
}
