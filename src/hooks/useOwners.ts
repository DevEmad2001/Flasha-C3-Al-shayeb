import { useMemo } from "react";

/** Unique owner names from projects (trimmed, case-insensitive dedup). */
export function useOwners(projects: { owner_name?: string | null }[]) {
  return useMemo(() => {
    const map = new Map<string, string>();
    for (const p of projects) {
      const name = (p.owner_name ?? "").trim();
      if (!name) continue;
      const key = name.toLocaleLowerCase("ar");
      if (!map.has(key)) map.set(key, name);
    }
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, "ar"));
  }, [projects]);
}
