"use client";
import { useState, useEffect, useCallback } from "react";

type Theme = "light" | "dark";

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    const stored = localStorage.getItem("orgchart_theme") as Theme | null;
    const initial = stored || "dark";
    document.documentElement.classList.toggle("dark", initial === "dark");

    const frameId = window.requestAnimationFrame(() => {
      setThemeState(initial);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem("orgchart_theme", t);
    document.documentElement.classList.toggle("dark", t === "dark");
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return { theme, setTheme, toggle };
}
