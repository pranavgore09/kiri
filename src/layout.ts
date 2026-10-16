import { catalog, styleShape, type Len, type Rect, type SideDef, type Slot, type View } from "./catalog";
import { productOf, type Design } from "./design";
import { buildShape, type Shape } from "./geometry";

// Where every pocket sits, worked out from the card pocket maths in the catalog:
// each pocket is X − Y tall, the card stops on its bottom stitch, and the stack steps by Z.

// A "fit" panel is just tall enough for its deepest bottom-stacked side.
function fitHeight(d: Design): number {
  const { space, step, stitch } = catalog.card_pockets;
  const sides = productOf(d).views.flatMap((v) => v.sides ?? []).filter((s) => s.stack === "bottom");
  const n = Math.max(1, ...sides.map((s) => placed(d, s).length));
  return stitch + space + (n - 1) * step + stitch;
}

// Pocket k of a side holding n pockets.
function pocket(side: SideDef, k: number, n: number): Pick<Slot, "rect"> {
  const { space, show, step, stitch } = catalog.card_pockets;
  const [x, y, w, h] = side.area;
  const tall = space - show;
  if (side.stack === "bottom") {
    const stop = y + h - stitch - k * step; // k = 0 is the front pocket, on the bottom edge
    return { rect: [x, stop - tall, w, tall + stitch] };
  }
  const stop = y + stitch + space + k * step; // k = 0 is the back pocket, its card up to the top stitch
  const top = stop - tall;
  // The front pocket runs to the bottom edge; the stitch where its card stops is hidden behind it.
  if (k === n - 1) return { rect: [x, top, w, y + h - top] };
  return { rect: [x, top, w, tall + stitch] };
}

export function laidOut(d: Design, view: View<Len>): View {
  const H = fitHeight(d);
  const len = (v: Len) => (v === "fit" ? H : v);
  const box = ([x, y, w, h]: [number, number, number, Len]): Rect => [x, y, w, len(h)];
  return {
    ...view,
    size: [view.size[0], len(view.size[1])],
    pieces: view.pieces.map((p) => ({ ...p, rect: box(p.rect) })),
    stitch_lines: view.stitch_lines?.map((l) => ({ ...l, rect: box(l.rect) })),
    sides: view.sides?.map((s) => {
      const side = { ...s, area: box(s.area) };
      const n = Math.max(1, placed(d, s).length);
      return { ...side, slots: s.slots.map((slot, k) => ({ ...slot, ...pocket(side, k, n) })) };
    }),
  };
}

export const viewsOf = (d: Design): View[] => productOf(d).views.map((v) => laidOut(d, v));

// Slots in drawing order: the pocket furthest back first.
const backToFront = (side: SideDef<Len>): Slot[] => (side.stack === "bottom" ? [...side.slots].reverse() : side.slots);

// The pockets placed on a side, furthest back first.
export const placed = (d: Design, side: SideDef<Len>): Slot[] => backToFront(side).filter((slot) => d.pockets[slot.id]);

// A pocket's shape: its slot, with the side's pocket edge along its mouth.
export const pocketShape = (d: Design, side: SideDef<Len>, slot: Slot): Shape =>
  buildShape(
    { rect: slot.rect, corners: slot.corners, mirror: slot.mirror, mouth: "top" },
    styleShape("corner", d.corner),
    styleShape("edge", d.edges[side.id]),
  );
