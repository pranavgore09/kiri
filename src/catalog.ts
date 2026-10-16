import { parse } from "yaml";
import raw from "../catalog.yaml?raw";

export type Rect = [number, number, number, number];
export type Corner = "tl" | "tr" | "br" | "bl";
export type Side = "top" | "right" | "bottom" | "left";
export type Entry = "top"; // card goes in from the top

export interface Leather { name: string; color: string; pocket: string; thread: string }
interface PairTable<T> { default: T; except: [string, string, T][] }
export interface Finish {
  id: string;
  label: string;
  note: string;
  shine: boolean; // false = drawn matte
  default: string;
  in_stock?: string[]; // only these can be picked; left out = all
  leathers: Leather[];
  selection: PairTable<string>;
  preview_background: PairTable<"dark" | "light">;
}
export interface Thread { name: string; color: string }
// Heights in the catalog may be "fit": worked out from the pockets (see layout.ts).
export type Len = number | "fit";
type Box<H> = [number, number, number, H];

// A pocket position. Its rect is worked out by layout.ts from the card pocket maths.
export interface Slot { id: string; rect: Rect; accepts: Entry[]; corners?: Corner[]; mirror?: boolean }
export interface SideDef<H = number> {
  id: string;
  label: string;
  max_pockets: number;
  area: Box<H>;
  stack: "top" | "bottom";
  corners?: Corner[];
  mirror?: boolean;
  slots: Slot[]; // from the stack's fixed end outwards; filled in order
}
export interface PieceDef<H = number> { id: string; label: string; rect: Box<H>; corners?: Corner[]; stitch?: boolean; open?: Side }
export interface StitchLine<H = number> { rect: Box<H>; corners?: Corner[]; open?: Side }
export interface View<H = number> {
  id: string;
  label: string;
  face?: "front" | "back";
  size: [number, H];
  pieces: PieceDef<H>[];
  stitch_lines?: StitchLine<H>[];
  sides?: SideDef<H>[];
}
export interface Product {
  label: string;
  pocket_types: Entry[];
  edges: string[];
  corners: string[];
  default: { edge: string; corner: string; pockets: Record<string, number> };
  views: View<Len>[];
}
export interface CardPockets { space: number; show: number; step: number; stitch: number }
export type StyleKind = "edge" | "corner";
export interface Catalog {
  site: { name: string; tagline: string };
  finishes: Finish[];
  threads: Thread[];
  threads_in_stock?: string[]; // only these can be picked; left out = all
  styles: Record<StyleKind, { folder: string; label: string }>;
  card_pockets: CardPockets;
  stitching: { pitch: number; thread_width: number };
  thickness: { main: number; other: number };
  products: Record<string, Product>;
}

export const catalog: Catalog = parse(raw);

// Each side gets one slot per allowed pocket: left-1, left-2, … counted from the stack's fixed end.
for (const product of Object.values(catalog.products)) {
  for (const side of product.views.flatMap((v) => v.sides ?? [])) {
    side.slots = Array.from({ length: side.max_pockets }, (_, k) => ({
      id: `${side.id}-${k + 1}`,
      rect: [0, 0, 0, 0],
      accepts: product.pocket_types,
      corners: side.corners,
      mirror: side.mirror,
    }));
  }
}

// Style drawings: styles/<folder>/<name>.svg — we only need the viewBox and the first path.
const svgFiles = import.meta.glob("../styles/**/*.svg", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

export interface StyleShape { d: string; w: number; h: number }

const shapes = new Map<string, StyleShape>();

export function styleShape(kind: StyleKind, name: string): StyleShape {
  const key = `${kind}/${name}`;
  const hit = shapes.get(key);
  if (hit) return hit;
  const file = svgFiles[`../styles/${catalog.styles[kind].folder}/${name}.svg`];
  if (!file) throw new Error(`Missing drawing: styles/${catalog.styles[kind].folder}/${name}.svg`);
  const box = /viewBox="([^"]+)"/.exec(file)![1].trim().split(/[\s,]+/).map(Number);
  const d = /<path[^>]*\sd="([^"]+)"/.exec(file)![1];
  const shape = { d, w: box[2], h: box[3] };
  shapes.set(key, shape);
  return shape;
}

export const finish = (id: string) => catalog.finishes.find((f) => f.id === id) ?? catalog.finishes[0];
// Stock: colours not in stock are shown but can't be picked.
export const inStock = (finishId: string, name: string) => {
  const f = finish(finishId);
  return f.leathers.some((l) => l.name === name) && (!f.in_stock || f.in_stock.includes(name));
};
export const threadInStock = (name: string) =>
  catalog.threads.some((t) => t.name === name) && (!catalog.threads_in_stock || catalog.threads_in_stock.includes(name));
export function defaultLeather(finishId: string): string {
  const f = finish(finishId);
  return inStock(f.id, f.default) ? f.default : f.leathers.find((l) => inStock(f.id, l.name))?.name ?? f.default;
}

// A leather with its pocket and thread pairing, swapped for something in stock where needed.
export function leather(name: string, finishId: string): Leather {
  const f = finish(finishId);
  const l = f.leathers.find((x) => x.name === name) ?? f.leathers.find((x) => x.name === defaultLeather(f.id)) ?? f.leathers[0];
  const pocket = inStock(f.id, l.pocket)
    ? l.pocket
    : f.leathers.find((x) => x.name !== l.name && inStock(f.id, x.name))?.name ?? l.name;
  const thread = threadInStock(l.thread) ? l.thread : catalog.threads.find((t) => threadInStock(t.name))?.name ?? l.thread;
  return { ...l, pocket, thread };
}
const lookup = <T,>(table: PairTable<T>, a: string, b: string) =>
  table.except.find(([x, y]) => (x === a && y === b) || (x === b && y === a))?.[2] ?? table.default;
// Outline colour for a selected piece sitting between leathers a and b (from the catalog table).
export const selectionColor = (finishId: string, a: string, b: string) => lookup(finish(finishId).selection, a, b);
// 3D preview background for a wallet in leathers a and b (from the catalog table).
export const previewBackground = (finishId: string, a: string, b: string) => lookup(finish(finishId).preview_background, a, b);
export const thread = (name: string) => catalog.threads.find((t) => t.name === name) ?? catalog.threads[0];

export interface SlotRef { slot: Slot; side: SideDef<Len>; view: View<Len>; index: number }

export function slotsOf(product: Product): SlotRef[] {
  return product.views.flatMap((view) =>
    (view.sides ?? []).flatMap((side) => side.slots.map((slot, index) => ({ slot, side, view, index }))),
  );
}

export function piecesOf(product: Product): PieceDef<Len>[] {
  const seen = new Map<string, PieceDef<Len>>();
  for (const v of product.views) for (const p of v.pieces) if (!seen.has(p.id)) seen.set(p.id, p);
  return [...seen.values()];
}
