import { norm } from "./format";
import type { CatalogItem } from "./types";

/** Suggestions for what the user is typing: prefix matches first, then contains; most-used first. */
export function searchCatalog(items: CatalogItem[], q: string, limit = 6): CatalogItem[] {
  const n = norm(q);
  const scored = items
    .map((it) => {
      const name = norm(it.name);
      const words = name.split(/\s+/);
      const rank = !n ? 2 : name.startsWith(n) ? 0 : words.some((w) => w.startsWith(n)) ? 1 : name.includes(n) ? 2 : 9;
      return { it, rank };
    })
    .filter((x) => x.rank < 9);
  scored.sort((a, b) => a.rank - b.rank || b.it.uses - a.it.uses || a.it.name.localeCompare(b.it.name, "es"));
  return scored.slice(0, limit).map((x) => x.it);
}
