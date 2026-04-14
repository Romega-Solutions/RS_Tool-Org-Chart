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

  const setTheme = useCallback((nextTheme: Theme) => {
    setThemeState(nextTheme);
    localStorage.setItem("orgchart_theme", nextTheme);
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return { theme, setTheme, toggle };
}
