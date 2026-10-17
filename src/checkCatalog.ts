import { hasStyle, type Catalog } from "./catalog";

// Every mistake in catalog.yaml that would otherwise fall back quietly or break deep inside the
// drawing code: names that point nowhere, missing drawings, impossible defaults. Returns one
// readable line per problem; an empty list means the catalog is sound.
export function checkCatalog(c: Catalog): string[] {
  const problems: string[] = [];
  const need = (ok: unknown, what: string) => ok || problems.push(what);
  const threads = new Set(c.threads.map((t) => t.name));

  for (const t of c.threads_in_stock ?? []) need(threads.has(t), `threads_in_stock: no thread "${t}"`);

  for (const f of c.finishes) {
    const at = `finish ${f.id}`;
    const leathers = new Set(f.leathers.map((l) => l.name));
    need(leathers.has(f.default), `${at}: default "${f.default}" isn't one of its leathers`);
    for (const n of f.in_stock ?? []) need(leathers.has(n), `${at}: in_stock "${n}" isn't one of its leathers`);
    for (const l of f.leathers) {
      need(/^#[0-9a-fA-F]{6}$/.test(l.color), `${at}: ${l.name} colour "${l.color}" isn't #rrggbb`);
      need(leathers.has(l.pocket), `${at}: ${l.name} pocket pairing "${l.pocket}" isn't one of its leathers`);
      need(threads.has(l.thread), `${at}: ${l.name} thread pairing "${l.thread}" isn't a thread`);
    }
    for (const [table, rows] of [["selection", f.selection.except], ["preview_background", f.preview_background.except]] as const) {
      for (const [a, b] of rows) need(leathers.has(a) && leathers.has(b), `${at}: ${table} row [${a}, ${b}] names a leather it doesn't have`);
    }
  }

  const firstFinish = c.finishes[0];
  for (const [id, p] of Object.entries(c.products)) {
    const at = `product ${id}`;
    for (const e of p.edges) need(hasStyle("edge", e), `${at}: no drawing for pocket shape "${e}"`);
    for (const k of p.corners) need(hasStyle("corner", k), `${at}: no drawing for corner "${k}"`);
    need(p.corners.includes(p.default.corner), `${at}: default corner "${p.default.corner}" isn't offered`);
    if (p.default.edge) need(p.edges.includes(p.default.edge), `${at}: default pocket shape "${p.default.edge}" isn't offered`);
    need(p.preview === "fold" || p.preview === "turn", `${at}: preview must be fold or turn`);
    need(!p.group === !p.variant, `${at}: group and variant go together`);

    const sides = p.views.flatMap((v) => v.sides ?? []);
    for (const [side, n] of Object.entries(p.default.pockets)) {
      const s = sides.find((x) => x.id === side);
      need(s, `${at}: default pockets for unknown side "${side}"`);
      if (s) need(n <= s.max_pockets, `${at}: ${n} default pockets on ${side}, but it holds ${s.max_pockets}`);
    }
    if (sides.length) need(p.pocket_types.length > 0 && p.edges.length > 0, `${at}: has pocket sides but no pocket types or shapes`);

    for (const v of p.views) {
      need(v.pieces.some((x) => x.id === "main"), `${at}, view ${v.id}: has no main panel`);
      for (const piece of v.pieces) if (piece.edge) need(hasStyle("edge", piece.edge), `${at}: no drawing for "${piece.edge}" (piece ${piece.id})`);
    }

    if (p.starter) {
      const leathers = new Set(firstFinish.leathers.map((l) => l.name));
      need(leathers.has(p.starter.body), `${at}: starter body "${p.starter.body}" isn't a ${firstFinish.id} leather`);
      need(leathers.has(p.starter.accent), `${at}: starter accent "${p.starter.accent}" isn't a ${firstFinish.id} leather`);
      if (p.starter.thread) need(threads.has(p.starter.thread), `${at}: starter thread "${p.starter.thread}" isn't a thread`);
    }
  }
  return problems;
}
