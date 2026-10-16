import { catalog, defaultLeather, finish, inStock, leather, piecesOf, threadInStock, slotsOf, type Entry, type Product } from "./catalog";

// The customer's current design. Every change goes through the functions below,
// which check it against the catalog first and refuse anything that breaks a rule.
export interface Design {
  product: string;
  finish: string; // glossy / matte: decides which leathers are on offer
  pockets: Record<string, Entry>; // slot id → pocket type
  colors: Record<string, string>; // piece id or slot id → leather name
  thread: string;
  edges: Record<string, string>; // side id → pocket shape
  corner: string;
}

export const productOf = (d: Design): Product => catalog.products[d.product];
const sidesOf = (product: Product) => product.views.flatMap((v) => v.sides ?? []);

// The leather a piece is in, from the design's finish.
export const leatherOf = (d: Design, id: string) => leather(d.colors[id], d.finish);

const bodyColor = (d: Design) => leatherOf(d, "main").name;

function pocketColorFor(d: Design): string {
  const existing = Object.keys(d.pockets).map((id) => d.colors[id]).find(Boolean);
  return existing ?? leather(bodyColor(d), d.finish).pocket;
}

export function freshDesign(productId: string, body?: string, finishId = catalog.finishes[0].id): Design {
  const product = catalog.products[productId];
  const l = leather(body && inStock(finishId, body) ? body : defaultLeather(finishId), finishId);
  const colors: Record<string, string> = {};
  const pockets: Record<string, Entry> = {};
  for (const p of piecesOf(product)) colors[p.id] = l.name;
  for (const side of sidesOf(product)) {
    for (const slot of side.slots.slice(0, product.default.pockets[side.id] ?? 0)) {
      pockets[slot.id] = product.pocket_types[0];
      colors[slot.id] = l.pocket;
    }
  }
  return {
    product: productId,
    finish: finish(finishId).id,
    pockets,
    colors,
    thread: l.thread,
    edges: Object.fromEntries(sidesOf(product).map((s) => [s.id, product.default.edge])),
    corner: product.default.corner,
  };
}

// New product layout, same colours.
export function switchProduct(d: Design, productId: string): Design {
  if (d.product === productId) return d;
  const next = freshDesign(productId, bodyColor(d), d.finish);
  const pocketColor = pocketColorFor(d);
  for (const id of Object.keys(next.pockets)) next.colors[id] = pocketColor;
  return { ...next, thread: d.thread };
}

export function canPlace(d: Design, slotId: string, entry: Entry): boolean {
  const ref = slotsOf(productOf(d)).find((r) => r.slot.id === slotId);
  if (!ref || !ref.slot.accepts.includes(entry)) return false;
  if (d.pockets[slotId]) return false;
  const used = ref.side.slots.filter((s) => d.pockets[s.id]).length;
  return ref.index === used && used < ref.side.max_pockets; // pockets fill a side in order
}

// Where the next pocket on a side goes, or null when the side is full.
export function nextSlot(d: Design, sideId: string): string | null {
  const side = sidesOf(productOf(d)).find((s) => s.id === sideId);
  const free = side?.slots.find((s) => !d.pockets[s.id]);
  return free && canPlace(d, free.id, productOf(d).pocket_types[0]) ? free.id : null;
}

export function place(d: Design, slotId: string, entry: Entry): Design {
  if (!canPlace(d, slotId, entry)) return d;
  return {
    ...d,
    pockets: { ...d.pockets, [slotId]: entry },
    colors: { ...d.colors, [slotId]: pocketColorFor(d) },
  };
}

// The pockets after it move up one place, so a side never has a gap.
export function removePocket(d: Design, slotId: string): Design {
  const ref = slotsOf(productOf(d)).find((r) => r.slot.id === slotId);
  if (!ref || !d.pockets[slotId]) return d;
  const ids = ref.side.slots.map((s) => s.id);
  const pockets = { ...d.pockets };
  const colors = { ...d.colors };
  for (let k = ref.index; k < ids.length; k++) {
    const next = ids[k + 1];
    if (next && pockets[next]) {
      pockets[ids[k]] = pockets[next];
      colors[ids[k]] = colors[next];
    } else {
      delete pockets[ids[k]];
      delete colors[ids[k]];
    }
  }
  return { ...d, pockets, colors };
}

export function setCorner(d: Design, name: string): Design {
  return productOf(d).corners.includes(name) ? { ...d, corner: name } : d;
}

export function setEdge(d: Design, sideId: string, name: string): Design {
  const ok = productOf(d).edges.includes(name) && sidesOf(productOf(d)).some((s) => s.id === sideId);
  return ok ? { ...d, edges: { ...d.edges, [sideId]: name } } : d;
}

// Other finish: pieces keep their colour where the new finish has it, the rest start from its default.
export function setFinish(d: Design, finishId: string): Design {
  const f = catalog.finishes.find((x) => x.id === finishId);
  if (!f || f.id === d.finish) return d;
  const has = (name: string) => inStock(f.id, name);
  const body = has(bodyColor(d)) ? bodyColor(d) : defaultLeather(f.id);
  const colors: Record<string, string> = {};
  for (const [id, name] of Object.entries(d.colors)) {
    colors[id] = has(name) ? name : id === "main" || piecesOf(productOf(d)).some((p) => p.id === id) ? body : leather(body, f.id).pocket;
  }
  const thread = has(bodyColor(d)) ? d.thread : leather(body, f.id).thread;
  return { ...d, finish: f.id, colors, thread };
}

// Body swatch: body pieces take the leather, pockets its contrast, thread its pair.
export function setBody(d: Design, name: string): Design {
  if (!inStock(d.finish, name)) return d;
  const l = leather(name, d.finish);
  const colors = { ...d.colors };
  for (const p of piecesOf(productOf(d))) colors[p.id] = l.name;
  for (const id of Object.keys(d.pockets)) colors[id] = l.pocket;
  return { ...d, colors, thread: l.thread };
}

export function setPiece(d: Design, id: string, name: string): Design {
  if (!inStock(d.finish, name)) return d;
  const l = leather(name, d.finish);
  const next = { ...d, colors: { ...d.colors, [id]: l.name } };
  return id === "main" ? { ...next, thread: l.thread } : next;
}

export function allOneColour(d: Design): Design {
  const body = bodyColor(d);
  const colors = { ...d.colors };
  for (const id of Object.keys(colors)) colors[id] = body;
  return { ...d, colors };
}

export function setThread(d: Design, name: string): Design {
  return threadInStock(name) ? { ...d, thread: name } : d;
}

// Re-check a whole design (e.g. one loaded from storage after the catalog changed).
export function sanitize(input: unknown): Design | null {
  const d = input as Design;
  if (!d || typeof d !== "object" || !catalog.products[d.product]) return null;
  const product = catalog.products[d.product];
  const f = finish(d.finish);
  const base = freshDesign(d.product, undefined, f.id);
  const valid = (n: unknown) => typeof n === "string" && inStock(f.id, n);
  const colors: Record<string, string> = {};
  for (const p of piecesOf(product)) colors[p.id] = valid(d.colors?.[p.id]) ? d.colors[p.id] : base.colors[p.id];
  // Keep each side's pockets in order, closing any gaps.
  const pockets: Record<string, Entry> = {};
  for (const side of sidesOf(product)) {
    const kept = side.slots.filter((s) => d.pockets?.[s.id] && s.accepts.includes(d.pockets[s.id]));
    kept.forEach((from, k) => {
      const to = side.slots[k].id;
      pockets[to] = d.pockets[from.id];
      colors[to] = valid(d.colors?.[from.id]) ? d.colors[from.id] : leather(colors.main, f.id).pocket;
    });
  }
  return {
    product: d.product,
    finish: f.id,
    pockets,
    colors,
    thread: threadInStock(d.thread) ? d.thread : base.thread,
    edges: Object.fromEntries(
      sidesOf(product).map((s) => [s.id, product.edges.includes(d.edges?.[s.id]) ? d.edges[s.id] : base.edges[s.id]]),
    ),
    corner: product.corners.includes(d.corner) ? d.corner : base.corner,
  };
}

const KEY = "wallet-designer-v3";

export function load(): { design: Design | null; step: number } {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null");
    const design = sanitize(saved?.design);
    return { design, step: design ? Number(saved.step) || 0 : 0 };
  } catch {
    return { design: null, step: 0 };
  }
}

export function save(design: Design | null, step: number) {
  try {
    if (design) localStorage.setItem(KEY, JSON.stringify({ design, step }));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable: the design just won't survive a reload */
  }
}
