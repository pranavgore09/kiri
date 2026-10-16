import { catalog, type Corner, type Rect, type Side, type StyleShape } from "./catalog";

export type Pt = [number, number];

const NS = "http://www.w3.org/2000/svg";
let host: SVGSVGElement | null = null;
const sampled = new Map<string, Pt[]>();

// Turn an SVG path into points, using the browser's own path maths.
function sample(d: string, n = 32): Pt[] {
  const key = `${n}|${d}`;
  const hit = sampled.get(key);
  if (hit) return hit;
  if (!host) {
    host = document.createElementNS(NS, "svg");
    host.setAttribute("style", "position:absolute;width:0;height:0;overflow:hidden");
    document.body.appendChild(host);
  }
  const path = document.createElementNS(NS, "path");
  path.setAttribute("d", d);
  host.appendChild(path);
  const len = path.getTotalLength();
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const p = path.getPointAtLength((len * i) / n);
    pts.push([p.x, p.y]);
  }
  path.remove();
  sampled.set(key, pts);
  return pts;
}

export interface ShapeSpec {
  rect: Rect;
  corners?: Corner[];
  mouth?: Side; // open side of a pocket, drawn with the edge style
  mirror?: boolean; // flip the edge style end to end
  open?: Side; // a straight side left unstitched (a slip pocket's opening)
}

export interface Shape {
  outline: Pt[];
  stitch: Pt[];
  stitchClosed: boolean;
}

// Builds a clockwise outline (in SVG coords) for a panel or pocket.
// `edge` is only needed when the shape has a mouth.
export function buildShape(spec: ShapeSpec, corner: StyleShape, edge?: StyleShape, stitchInset = 3): Shape {
  const [x, y, W, H] = spec.rect;
  const styled = new Set(spec.corners ?? []);
  const c = sample(corner.d); // drawn in mm, from (0,s) up to (s,0)
  const s = corner.w;
  const rev = [...c].reverse();
  const ew = edge?.w ?? 1;
  const e = !edge ? [] : spec.mirror ? sample(edge.d).map(([u, v]) => [ew - u, v] as Pt).reverse() : sample(edge.d);

  // The opening runs along one side, stopping short of any styled corner at either end.
  const mouthPts = (side: Side): Pt[] => {
    if (spec.mouth !== side) return [];
    const ends: Record<Side, [Corner, Corner]> = { top: ["tl", "tr"], right: ["tr", "br"], bottom: ["br", "bl"], left: ["bl", "tl"] };
    const [a, b] = ends[side].map((k) => (styled.has(k) ? s : 0));
    const len = side === "top" || side === "bottom" ? W : H;
    const span = len - a - b;
    const at = (u: number) => a + (u / ew) * span; // distance along the side
    const depth = (v: number) => (v / ew) * span;
    switch (side) {
      case "top": return e.map(([u, v]) => [x + at(u), y + depth(v)]);
      case "right": return e.map(([u, v]) => [x + W - depth(v), y + at(u)]);
      case "bottom": return e.map(([u, v]) => [x + W - at(u), y + H - depth(v)]);
      case "left": return e.map(([u, v]) => [x + depth(v), y + H - at(u)]);
    }
  };
  const touching: Record<Corner, Side[]> = { tl: ["top", "left"], tr: ["top", "right"], br: ["right", "bottom"], bl: ["bottom", "left"] };
  const cornerPts = (k: Corner): Pt[] => {
    const on = styled.has(k) && s > 0;
    if (!on && spec.mouth && touching[k].includes(spec.mouth)) return []; // the mouth's own end point replaces it
    switch (k) {
      case "tl": return on ? c.map(([u, v]) => [x + u, y + v]) : [[x, y]];
      case "tr": return on ? rev.map(([u, v]) => [x + W - u, y + v]) : [[x + W, y]];
      case "br": return on ? c.map(([u, v]) => [x + W - u, y + H - v]) : [[x + W, y + H]];
      case "bl": return on ? rev.map(([u, v]) => [x + u, y + H - v]) : [[x, y + H]];
    }
  };

  const parts: { pts: Pt[]; mouth: boolean }[] = [
    { pts: cornerPts("tl"), mouth: false },
    { pts: mouthPts("top"), mouth: true },
    { pts: cornerPts("tr"), mouth: false },
    { pts: mouthPts("right"), mouth: true },
    { pts: cornerPts("br"), mouth: false },
    { pts: mouthPts("bottom"), mouth: true },
    { pts: cornerPts("bl"), mouth: false },
    { pts: mouthPts("left"), mouth: true },
  ];

  const outline: Pt[] = [];
  const isMouth: boolean[] = [];
  for (const part of parts) {
    for (const p of part.pts) {
      const last = outline[outline.length - 1];
      if (last && Math.hypot(last[0] - p[0], last[1] - p[1]) < 1e-6) {
        if (part.mouth) isMouth[isMouth.length - 1] = true;
        continue;
      }
      outline.push(p);
      isMouth.push(part.mouth);
    }
  }
  while (outline.length > 1 && Math.hypot(outline[0][0] - outline[outline.length - 1][0], outline[0][1] - outline[outline.length - 1][1]) < 1e-6) {
    outline.pop();
    isMouth[0] = isMouth[0] || isMouth.pop()!;
  }

  const inset = offset(outline, stitchInset);
  // At each end of an opening the stitch carries on over the edge onto the leather behind,
  // the way a pocket is reinforced where it opens.
  const over = (end: Pt, along: Pt[]): Pt => {
    const from = along.find((p) => Math.hypot(p[0] - end[0], p[1] - end[1]) > 0.5) ?? end;
    const l = Math.hypot(end[0] - from[0], end[1] - from[1]) || 1;
    const k = (stitchInset + OVER_EDGE) / l;
    return [end[0] + (end[0] - from[0]) * k, end[1] + (end[1] - from[1]) * k];
  };
  const reinforce = (pts: Pt[]): Pt[] => {
    const last = pts.length - 1;
    return [over(pts[0], pts.slice(1)), ...pts, over(pts[last], pts.slice(0, last).reverse())];
  };

  if (spec.open) {
    // Leave out the stitch along the open side: start just after it and go round to just before it.
    const onSide = ([px, py]: Pt) =>
      ({ top: Math.abs(py - y), bottom: Math.abs(py - (y + H)), left: Math.abs(px - x), right: Math.abs(px - (x + W)) })[spec.open!] < 1e-6;
    const n = outline.length;
    const gap = outline.findIndex((p, i) => onSide(p) && onSide(outline[(i + 1) % n]));
    if (gap >= 0) {
      const pts = Array.from({ length: n }, (_, i) => inset[(gap + 1 + i) % n]);
      return { outline, stitch: reinforce(pts), stitchClosed: false };
    }
  }
  if (!spec.mouth) return { outline, stitch: inset, stitchClosed: true };

  // Open stitch line: from the end of the mouth, around the pocket, back to the start of the mouth.
  const n = outline.length;
  const first = isMouth.findIndex((m, i) => m && !isMouth[(i - 1 + n) % n]);
  let start = first;
  while (isMouth[(start + 1) % n]) start = (start + 1) % n;
  const stitch: Pt[] = [];
  for (let i = start; ; i = (i + 1) % n) {
    stitch.push(inset[i]);
    if (i === first && stitch.length > 1) break;
  }
  return { outline, stitch: reinforce(stitch), stitchClosed: false };
}

const OVER_EDGE = 1.5; // how far the stitch runs past a pocket's edge, mm

// Moves every point of a closed outline inwards by d (mitred corners).
function offset(pts: Pt[], d: number): Pt[] {
  const n = pts.length;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % n];
    area += x1 * y2 - x2 * y1;
  }
  const sign = area > 0 ? 1 : -1;
  const normal = (a: Pt, b: Pt): Pt => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    return [-dy / l, dx / l];
  };
  return pts.map((p, i) => {
    const n1 = normal(pts[(i - 1 + n) % n], p);
    const n2 = normal(p, pts[(i + 1) % n]);
    let nx = n1[0] + n2[0];
    let ny = n1[1] + n2[1];
    const l = Math.hypot(nx, ny) || 1;
    nx /= l;
    ny /= l;
    const m = d / Math.max(nx * n1[0] + ny * n1[1], 0.35);
    return [p[0] + sign * nx * m, p[1] + sign * ny * m];
  });
}

// The same closed outline pushed outwards by d.
export const grow = (pts: Pt[], d: number): Pt[] => offset(pts, -d);

export function toPath(pts: Pt[], closed = true): string {
  const body = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");
  return closed ? `${body} Z` : body;
}

// Saddle stitch: evenly spaced short stitches, each leaning at the same angle to the line,
// like the slanted holes of a diamond stitching iron. Returns one [start, end] pair per stitch.
export function saddleStitches(pts: Pt[], closed: boolean, pitch = catalog.stitching.pitch, length = pitch * 0.72, lean = 0.45): [Pt, Pt][] {
  const path = closed && pts.length ? [...pts, pts[0]] : pts;
  const segs: { a: Pt; b: Pt; len: number }[] = [];
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const len = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
    if (len > 1e-6) segs.push({ a: path[i - 1], b: path[i], len });
    total += len;
  }
  const n = Math.max(1, Math.round(total / pitch));
  const step = total / n;
  const out: [Pt, Pt][] = [];
  let seg = 0;
  let before = 0; // path length before segs[seg]
  for (let k = 0; k < n; k++) {
    const at = step * (k + 0.5);
    while (seg < segs.length - 1 && before + segs[seg].len < at) before += segs[seg++].len;
    const { a, b, len } = segs[seg];
    const t = (at - before) / len;
    const [cx, cy] = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const [ux, uy] = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    const [dx, dy] = [Math.cos(lean) * ux - Math.sin(lean) * uy, Math.sin(lean) * ux + Math.cos(lean) * uy];
    const h = Math.min(length, step * 0.8) / 2;
    out.push([[cx - dx * h, cy - dy * h], [cx + dx * h, cy + dy * h]]);
  }
  return out;
}
