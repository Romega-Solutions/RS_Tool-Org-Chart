"use client";

import { useEffect } from "react";

export function RootUrlNormalizer() {
  useEffect(() => {
    if (window.location.pathname === "/org-chart" || window.location.pathname === "/org-chart/tools") {
      window.history.replaceState(window.history.state, "", "/");
    }
  }, []);

  return null;
}
