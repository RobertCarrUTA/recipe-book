import { useEffect, useState } from "react";
import type { Theme } from "./types";
export const themeKey = "offline_recipebook_theme_v1";
export function readTheme(): Theme {
  try {
    const value = localStorage.getItem(themeKey);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}
export function applyTheme(theme: Theme) {
  const dark =
    theme === "dark" ||
    (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", dark ? "#17231d" : "#f8f6f0");
}
export function useTheme() {
  const [theme, setValue] = useState<Theme>(readTheme);
  useEffect(() => {
    applyTheme(theme);
    const media = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme(theme);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === themeKey) setValue(readTheme());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  function setTheme(value: Theme) {
    setValue(value);
    applyTheme(value);
    try {
      localStorage.setItem(themeKey, value);
      return true;
    } catch {
      return false;
    }
  }
  return { theme, setTheme };
}
