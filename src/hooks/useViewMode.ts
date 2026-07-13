import { useEffect, useState } from "react";

export type ViewMode = "table" | "cards";

export function useViewMode(key: string, initial: ViewMode = "table") {
  const storageKey = `view-mode:${key}`;
  const [mode, setMode] = useState<ViewMode>(initial);

  useEffect(() => {
    try {
      const v = localStorage.getItem(storageKey);
      if (v === "table" || v === "cards") {
        setMode(v);
        return;
      }
      if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
        setMode("cards");
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (v: ViewMode) => {
    setMode(v);
    try { localStorage.setItem(storageKey, v); } catch {}
  };

  return [mode, update] as const;
}
