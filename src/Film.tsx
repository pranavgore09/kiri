import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { catalog, finish, styleShape, thread, type Corner, type Rect, type SideDef, type View } from "./catalog";
import { leatherOf, productOf, type Design } from "./design";
import { buildShape, type Pt } from "./geometry";
import { backToFront, viewsOf } from "./layout";
import { Contact, EdgeBand, LeatherSurface, SHADOW_PAD, Slab, Stitch, STITCH, Studio, shadowTexture, thick } from "./leather3d";

// A short, self-playing film of the customer's wallet, looping, with no controls at all.
//   fold (bifold): closed → opens → the inside → a closer look at the left and right pockets →
//     closes as the camera swings round to the other side → a full turn around the closed wallet.
//   turn (card holder): the front → its pockets up close → over the edge to the back → its
//     pockets up close → round to the front.

const FPS = 25; // frames drawn per second: smooth enough to watch, and easy on phones
const LENS = 24; // degrees: a longer lens, like a product camera, flattens the perspective
const TILT = 0.5; // the camera looks from a little below eye level
const OTHER = catalog.thickness.other;

// A script: keyframes the camera glides through on one smooth path (it never stops). turn is the
// camera's trip around the wallet in half turns; fold (bifold only) is 0 open flat, 1 closed.
// The last key is the first one a full turn later, so the loop is seamless.
interface Key<F extends string> { t: number; focus: F; turn: number; fold?: number }
type Focus = { target: THREE.Vector3; size: [number, number] }; // where to look, how much to frame

const ease = (u: number) => u * u * (3 - 2 * u);

// Key i of the endless loop (i may run past either end).
function keyAt<F extends string>(keys: Key<F>[], i: number): Key<F> {
  const m = keys.length - 1;
  const lap = Math.floor(i / m);
  const k = keys[i - lap * m];
  return { ...k, t: k.t + lap * keys[m].t, turn: k.turn + lap * 2 };
}

// Where the film is at time t: the segment between two keys, and the camera's view from a smooth
// (Hermite) path through all the keys' views.
function pathAt<F extends string>(keys: Key<F>[], t: number, focusOf: (f: F) => Focus) {
  const k = keys.findIndex((key, i) => t >= key.t && t < keys[i + 1].t);
  const view = (i: number) => {
    const key = keyAt(keys, i);
    const f = focusOf(key.focus);
    return { t: key.t, v: [f.target.x, f.target.y, f.target.z, f.size[0], f.size[1], key.turn] };
  };
  const [p0, p1, p2, p3] = [view(k - 1), view(k), view(k + 1), view(k + 2)];
  const s = (t - p1.t) / (p2.t - p1.t);
  const span = p2.t - p1.t;
  const [h00, h10, h01, h11] = [2 * s ** 3 - 3 * s ** 2 + 1, s ** 3 - 2 * s ** 2 + s, -2 * s ** 3 + 3 * s ** 2, s ** 3 - s ** 2];
  const [tx, ty, tz, w, h, turn] = p1.v.map((v1, n) => {
    const m1 = (p2.v[n] - p0.v[n]) / (p2.t - p0.t);
    const m2 = (p3.v[n] - p1.v[n]) / (p3.t - p1.t);
    return h00 * v1 + h10 * span * m1 + h01 * p2.v[n] + h11 * span * m2;
  });
  return { a: keys[k], b: keys[k + 1], s, target: new THREE.Vector3(tx, ty, tz), w, h, turn: turn * Math.PI };
}

// Put the camera round the target by `turn`, far enough back to frame w × h (times `pull`).
function placeCamera(camera: THREE.PerspectiveCamera, target: THREE.Vector3, w: number, h: number, turn: number, pull = 1) {
  const half = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  const dist = Math.max(((w / 2) * 1.2) / (half * camera.aspect), ((h / 2) * 1.2) / half) * pull;
  camera.position.set(
    target.x + Math.sin(turn) * Math.cos(TILT) * dist,
    target.y - Math.sin(TILT) * dist,
    target.z + Math.cos(turn) * Math.cos(TILT) * dist,
  );
  camera.lookAt(target);
}

// The film's clock: draws at FPS while on screen, nothing at all otherwise, and returns the
// time within the loop. After PLAYS loops it stops on the opening view (each loop ends where it
// began) and draws nothing more; reloading the page plays it again.
const PLAYS = 2;
function useClock(active: MutableRefObject<boolean>, loop: number) {
  const { invalidate } = useThree();
  const time = useRef(0);
  useEffect(() => {
    const id = setInterval(() => {
      if (time.current >= loop * PLAYS) clearInterval(id);
      else if (active.current) invalidate();
    }, 1000 / FPS);
    return () => clearInterval(id);
  }, [active, invalidate, loop]);
  return (delta: number) => {
    time.current = Math.min(time.current + Math.min(delta, 0.05), loop * PLAYS);
    return time.current >= loop * PLAYS ? 0 : time.current % loop;
  };
}

// Soft shadow on the table under a w × h footprint (top-left at x, 0), slightly offset as if lit
// from the top left. `mesh` lets a scene change its opacity as it plays.
function TableShadow({ x, w, h, z, opacity, mesh }: {
  x: number; w: number; h: number; z: number; opacity: number; mesh?: MutableRefObject<THREE.Mesh | null>;
}) {
  const texture = useMemo(() => shadowTexture(w, h), [w, h]);
  return (
    <mesh ref={mesh} position={[x + w / 2 + 4, -h / 2 - 6, z]}>
      <planeGeometry args={[w + SHADOW_PAD * 2, h + SHADOW_PAD * 2]} />
      <meshBasicMaterial map={texture} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
}

const covers = (r: Rect, [x, y]: Pt) => x >= r[0] - 0.6 && x <= r[0] + r[2] + 0.6 && y >= r[1] - 0.6 && y <= r[1] + r[3] + 0.6;
const placedOn = (design: Design, sides: SideDef[]) => sides.flatMap((s) => backToFront(s).filter((slot) => design.pockets[slot.id]));

// Pockets stacked on a face, each with its soft contact shadow and stitching, from height `base`.
function Pockets({ design, sides, base, edge }: { design: Design; sides: SideDef[]; base: number; edge: string }) {
  const corner = styleShape("corner", design.corner);
  const threadColor = thread(design.thread).color;
  const matte = !finish(design.finish).shine;
  return (
    <>
      {sides.flatMap((s) => {
        const mouth = styleShape("edge", design.edges[s.id]);
        return backToFront(s).filter((slot) => design.pockets[slot.id]).map((slot, i) => {
          const shape = buildShape({ rect: slot.rect, corners: slot.corners, mirror: slot.mirror, mouth: "top" }, corner, mouth, STITCH);
          const z = base + i * OTHER;
          return (
            <group key={slot.id}>
              <Contact outline={shape.outline} z={z} />
              <Slab outline={shape.outline} thickness={OTHER} z={z} color={leatherOf(design, slot.id).color} matte={matte} edge={edge} lip={slot.rect} />
              <Stitch shape={shape} z={z + OTHER + 0.05} color={threadColor} />
            </group>
          );
        });
      })}
    </>
  );
}

/* ---------- fold: the bifold ---------- */

type FoldFocus = "closed" | "open" | "left" | "right";
const FOLD_KEYS: Key<FoldFocus>[] = [
  { t: 0, fold: 1, focus: "closed", turn: -0.06 },
  { t: 1.2, fold: 1, focus: "closed", turn: 0 },
  { t: 3.6, fold: 0, focus: "open", turn: 0 },
  { t: 4.6, fold: 0, focus: "open", turn: -0.04 },
  { t: 6.0, fold: 0, focus: "left", turn: -0.1 },
  { t: 7.4, fold: 0, focus: "right", turn: 0.1 },
  { t: 8.6, fold: 0, focus: "open", turn: 0.04 },
  { t: 11.0, fold: 1, focus: "closed", turn: 1 },
  { t: 14, fold: 1, focus: "closed", turn: 1.94 },
];
const SPINE_STEPS = 16; // the spine is one bending piece of leather, curved in this many steps

// Mirror a rect drawn on the outside (seen from behind) into inside coordinates.
const flipCorner: Record<Corner, Corner> = { tl: "tr", tr: "tl", bl: "br", br: "bl" };
const flipSide = { left: "right", right: "left", top: "top", bottom: "bottom" } as const;

interface FoldLayout {
  W: number;
  H: number;
  spine: [number, number]; // x where the spine starts and ends
  inside: View;
  outsideLines: NonNullable<View["stitch_lines"]>;
}

function foldLayout(design: Design): FoldLayout {
  const views = viewsOf(design);
  const inside = views.find((v) => v.sides?.length)!;
  const outside = views.find((v) => v.face === "back");
  const [W, H] = inside.size;
  const own = inside.pieces.filter((p) => p.id !== "main");
  const left = own.filter((p) => p.rect[0] + p.rect[2] / 2 < W / 2);
  const right = own.filter((p) => p.rect[0] + p.rect[2] / 2 >= W / 2);
  const spine: [number, number] = [Math.max(...left.map((p) => p.rect[0] + p.rect[2])), Math.min(...right.map((p) => p.rect[0]))];
  const outsideLines = (outside?.stitch_lines ?? []).map((l) => ({
    rect: [W - l.rect[0] - l.rect[2], l.rect[1], l.rect[2], l.rect[3]] as Rect,
    corners: l.corners?.map((c) => flipCorner[c]),
    open: l.open && flipSide[l.open],
  }));
  return { W, H, spine, inside, outsideLines };
}

// One half of the bifold in flat (inside) coordinates: its part of the main panel underneath
// (z from -T to 0), then the base and pockets stacked on top.
function Half({ design, layout, side }: { design: Design; layout: FoldLayout; side: "left" | "right" }) {
  const { W, H, spine, inside, outsideLines } = layout;
  const corner = styleShape("corner", design.corner);
  const threadColor = thread(design.thread).color;
  const matte = !finish(design.finish).shine;
  const T = thick("main");
  const isMine = (r: Rect) => (r[0] + r[2] / 2 < W / 2) === (side === "left");
  const main = inside.pieces.find((p) => p.id === "main")!;
  const mainRect: Rect = side === "left" ? [0, 0, spine[0], H] : [spine[1], 0, W - spine[1], H];
  const mainCorners = (main.corners ?? []).filter((c) => (side === "left" ? c === "tl" || c === "bl" : c === "tr" || c === "br"));
  const pieces = inside.pieces.filter((p) => p.id !== "main" && isMine(p.rect));
  const base = Math.max(0, ...pieces.map((p) => thick(p.id)));
  const sides = (inside.sides ?? []).filter((s) => isMine(s.area));
  const burnished = leatherOf(design, "main").color; // stacked edges are burnished together

  // The burnished outer edge: how high the leather stands at each point of it (the frontmost
  // pocket over that point, else the base, else just the main panel). The spine side is left
  // open: it's the slip pocket's mouth.
  const band = useMemo(() => {
    const placed = placedOn(design, sides);
    const spineX = side === "left" ? spine[0] : spine[1];
    return {
      outline: buildShape({ rect: mainRect, corners: mainCorners }, corner).outline,
      top: (p: Pt) => {
        const front = placed.reduce((n, slot, i) => (covers(slot.rect, p) ? i + 1 : n), 0);
        if (front) return base + front * OTHER;
        return pieces.some((q) => covers(q.rect, p)) ? base : 0;
      },
      open: (a: Pt, b: Pt) => Math.abs(a[0] - spineX) < 0.3 && Math.abs(b[0] - spineX) < 0.3,
    };
  }, [layout, design, side]);

  return (
    <>
      <EdgeBand outline={band.outline} bottom={-T} top={band.top} open={band.open} color={burnished} />
      <Slab outline={band.outline} thickness={T} z={-T} color={burnished} matte={matte} edge={burnished} />
      {outsideLines.filter((l) => isMine(l.rect)).map((l, i) => (
        <Stitch key={`o${i}`} shape={buildShape({ rect: l.rect, corners: l.corners, open: l.open }, corner, undefined, STITCH)} z={-T - 0.05} color={threadColor} />
      ))}
      {pieces.map((p) => (
        <group key={p.id}>
          <Contact outline={buildShape({ rect: p.rect, corners: p.corners }, corner).outline} z={0} />
          <Slab outline={buildShape({ rect: p.rect, corners: p.corners }, corner).outline} thickness={thick(p.id)} z={0} color={leatherOf(design, p.id).color} matte={matte} edge={burnished} />
          {p.stitch !== false && (
            <Stitch shape={buildShape({ rect: p.rect, corners: p.corners, open: p.open }, corner, undefined, STITCH)} z={thick(p.id) + 0.05} color={threadColor} />
          )}
        </group>
      ))}
      <Pockets design={design} sides={sides} base={base} edge={burnished} />
    </>
  );
}

function FoldScene({ design, active }: { design: Design; active: MutableRefObject<boolean> }) {
  const layout = useMemo(() => foldLayout(design), [design]);
  const { W, H, spine } = layout;
  const T = thick("main");
  const matte = !finish(design.finish).shine;
  const mainColor = leatherOf(design, "main").color;
  // Closed, the halves are as far apart as their leather is thick: main panel, base and pockets.
  const sideThickness = (s: "left" | "right") => {
    const sides = (layout.inside.sides ?? []).filter((d) => (d.area[0] + d.area[2] / 2 < W / 2) === (s === "left"));
    return T + OTHER * (1 + placedOn(design, sides).length);
  };
  // Closed, the spine wraps round the stack in a half circle, so its outside is a smooth U.
  const closedLength = (Math.PI * (sideThickness("left") + sideThickness("right"))) / 2;
  const rightHinge = useRef<THREE.Group>(null);
  const rightShadow = useRef<THREE.Mesh>(null);
  const shadows = useRef<THREE.Group>(null);
  const tick = useClock(active, FOLD_KEYS[FOLD_KEYS.length - 1].t);
  const spineW = spine[1] - spine[0];

  // The spine: one strip of leather, its outer and inner skins plus the two cut ends, as a mesh
  // whose points are moved every frame as it bends. Texture coordinates stay those of the flat
  // panel, so the grain runs on from the halves.
  const spineMesh = useMemo(() => {
    const n = SPINE_STEPS + 1;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 8 * 3), 3));
    const uv: number[] = [];
    const index: number[] = [];
    // Per step k, 8 points: inner skin top/bottom, outer skin top/bottom, then the same four
    // again for the cut ends (separate points, so the ends get their own sharp shading).
    for (let k = 0; k < n; k++) {
      const x = spine[0] + (spineW * k) / SPINE_STEPS;
      for (let r = 0; r < 2; r++) uv.push(x, 0, x, -H, x, 0, x, -H);
      if (k === 0) continue;
      const [a, b] = [(k - 1) * 8, k * 8];
      index.push(a, a + 1, b + 1, a, b + 1, b); // inner skin
      index.push(a + 2, b + 3, a + 3, a + 2, b + 2, b + 3); // outer skin
      index.push(a + 4, b + 4, b + 6, a + 4, b + 6, a + 6); // top cut end
      index.push(a + 5, a + 7, b + 7, a + 5, b + 7, b + 5); // bottom cut end
    }
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(index);
    return g;
  }, [spine, spineW, H]);

  // Bend the spine to `fold` (0 flat, 1 closed): it turns evenly along its length, half a step at
  // each end so it meets the halves smoothly, while its length eases from flat to the closed U.
  // Returns where the right half hangs: the outer skin's end point and its angle.
  const bend = (fold: number) => {
    const step = (spineW + (closedLength - spineW) * fold) / SPINE_STEPS;
    const turn = (fold * Math.PI) / SPINE_STEPS;
    const pos = spineMesh.getAttribute("position") as THREE.BufferAttribute;
    let [x, z] = [spine[0], -T];
    for (let k = 0; k <= SPINE_STEPS; k++) {
      const angle = k === 0 ? 0 : k === SPINE_STEPS ? fold * Math.PI : k * turn; // skin direction here
      const [ix, iz] = [x - Math.sin(angle) * T, z + Math.cos(angle) * T]; // inner skin, T inwards
      const pts = [[ix, 0, iz], [ix, -H, iz], [x, 0, z], [x, -H, z]];
      pts.concat(pts).forEach(([px, py, pz], v) => pos.setXYZ(k * 8 + v, px, py, pz));
      if (k < SPINE_STEPS) {
        const seg = turn / 2 + k * turn;
        x += Math.cos(seg) * step;
        z += Math.sin(seg) * step;
      }
    }
    pos.needsUpdate = true;
    spineMesh.computeVertexNormals();
    return { x, z, angle: fold * Math.PI };
  };

  // Where the camera looks, and how much it frames, for each focus.
  const closedMid = spineW / 2 - T; // half way up the closed wallet
  const centreX = (a: number, b: number) => -W / 2 + (a + b) / 2;
  const focusOf = (f: FoldFocus): Focus => {
    switch (f) {
      case "closed": return { target: new THREE.Vector3(centreX(0, spine[0]), 0, closedMid), size: [spine[0], H] };
      case "open": return { target: new THREE.Vector3(0, 0, 0), size: [W, H] };
      // Close-ups: one half, nudged up towards the pocket tops.
      case "left": return { target: new THREE.Vector3(centreX(0, spine[0]), H * 0.08, 2), size: [spine[0] * 1.05, H * 0.95] };
      case "right": return { target: new THREE.Vector3(centreX(spine[1], W), H * 0.08, 2), size: [(W - spine[1]) * 1.05, H * 0.95] };
    }
  };

  useFrame((state, delta) => {
    const path = pathAt(FOLD_KEYS, tick(delta), focusOf);
    const { a, b } = path;
    // Fold: the spine bends and carries the right half over the left.
    const fold = a.fold! + (b.fold! - a.fold!) * ease(path.s);
    const hinge = bend(fold);
    if (rightHinge.current) {
      rightHinge.current.position.set(hinge.x, 0, hinge.z);
      rightHinge.current.rotation.y = -hinge.angle;
    }
    if (rightShadow.current) (rightShadow.current.material as THREE.MeshBasicMaterial).opacity = 0.45 * (1 - fold) ** 2;
    // While a half swings up (opening or closing) the camera pulls back a little to keep it in frame.
    const pull = a.fold !== b.fold ? 1 + 0.35 * Math.sin(Math.PI * path.s) : 1;
    placeCamera(state.camera as THREE.PerspectiveCamera, path.target, path.w, path.h, path.turn, pull);
    if (shadows.current) shadows.current.visible = Math.cos(path.turn) > 0.95;
  });

  return (
    <group position={[-W / 2, H / 2, 0]}>
      <Half design={design} layout={layout} side="left" />
      <mesh geometry={spineMesh} castShadow receiveShadow>
        <LeatherSurface color={mainColor} matte={matte} side={THREE.DoubleSide} />
      </mesh>
      {/* The right half hangs off the spine's end, on its outer skin. */}
      <group ref={rightHinge} position={[spine[1], 0, -T]}>
        <group position={[-spine[1], 0, T]}>
          <Half design={design} layout={layout} side="right" />
        </group>
      </group>
      {/* Table shadow (only while the camera looks from the front): under the left half always,
          under the right half only while open. */}
      <group ref={shadows}>
        <TableShadow x={0} w={spine[1]} h={H} z={-T - 2} opacity={0.45} />
        <TableShadow x={spine[1]} w={W - spine[1]} h={H} z={-T - 2} opacity={0} mesh={rightShadow} />
      </group>
    </group>
  );
}

/* ---------- turn: the card holder ---------- */

type TurnFocus = "whole" | "front" | "back";
const TURN_KEYS: Key<TurnFocus>[] = [
  { t: 0, focus: "whole", turn: -0.06 },
  { t: 2.2, focus: "front", turn: 0.04 },
  { t: 4.6, focus: "whole", turn: 0.5 },
  { t: 6.6, focus: "whole", turn: 0.96 },
  { t: 8.6, focus: "back", turn: 1.04 },
  { t: 10.4, focus: "whole", turn: 1.45 },
  { t: 12, focus: "whole", turn: 1.94 },
];

// A flat holder: the main panel in the middle (z from -T/2 to T/2), pockets stacked on the front
// face (towards +z) and on the back face, which is drawn in its own (mirrored) coordinates and
// turned over.
function TurnScene({ design, active }: { design: Design; active: MutableRefObject<boolean> }) {
  const views = useMemo(() => viewsOf(design), [design]);
  const front = views.find((v) => v.face !== "back")!;
  const back = views.find((v) => v.face === "back");
  const [W, H] = front.size;
  const T = thick("main");
  const corner = styleShape("corner", design.corner);
  const threadColor = thread(design.thread).color;
  const matte = !finish(design.finish).shine;
  const burnished = leatherOf(design, "main").color;
  const main = front.pieces.find((p) => p.id === "main")!;
  const shadows = useRef<THREE.Group>(null);
  const tick = useClock(active, TURN_KEYS[TURN_KEYS.length - 1].t);

  // The burnished outer edge runs from the back pockets' surface to the front pockets', point by
  // point (a back-face point mirrors to W - x).
  const band = useMemo(() => {
    const frontPlaced = placedOn(design, front.sides ?? []);
    const backPlaced = placedOn(design, back?.sides ?? []);
    const stack = (placed: typeof frontPlaced, p: Pt) => placed.reduce((n, slot, i) => (covers(slot.rect, p) ? i + 1 : n), 0) * OTHER;
    return {
      outline: buildShape({ rect: main.rect, corners: main.corners }, corner).outline,
      top: (p: Pt) => T / 2 + stack(frontPlaced, p),
      bottom: ([x, y]: Pt) => -T / 2 - stack(backPlaced, [W - x, y]),
      depth: T / 2 + backPlaced.length * OTHER,
    };
  }, [views, design]);

  // Framing: while the holder turns, its corners swing towards and away from the camera, so the
  // whole view leaves room for its diagonal; the close-ups still show the whole pocket area.
  const diagonal = Math.hypot(W, H);
  const focusOf = (f: TurnFocus): Focus => {
    switch (f) {
      case "whole": return { target: new THREE.Vector3(0, 0, 0), size: [diagonal * 0.95, diagonal * 0.95] };
      // Close-ups on the pockets, which sit in the lower part of each face.
      case "front": return { target: new THREE.Vector3(0, -H * 0.08, 2), size: [W * 1.05, H * 1.05] };
      case "back": return { target: new THREE.Vector3(0, -H * 0.08, -2), size: [W * 1.05, H * 1.05] };
    }
  };

  useFrame((state, delta) => {
    const path = pathAt(TURN_KEYS, tick(delta), focusOf);
    placeCamera(state.camera as THREE.PerspectiveCamera, path.target, path.w, path.h, path.turn);
    if (shadows.current) shadows.current.visible = Math.cos(path.turn) > 0.95;
  });

  const face = (view: View) => (
    <>
      {view.pieces.filter((p) => p.stitch !== false).map((p) => (
        <Stitch key={p.id} shape={buildShape({ rect: p.rect, corners: p.corners, open: p.open }, corner, undefined, STITCH)} z={T / 2 + 0.05} color={threadColor} />
      ))}
      <Pockets design={design} sides={view.sides ?? []} base={T / 2} edge={burnished} />
    </>
  );

  return (
    <group position={[-W / 2, H / 2, 0]}>
      <EdgeBand outline={band.outline} bottom={band.bottom} top={band.top} color={burnished} />
      <Slab outline={band.outline} thickness={T} z={-T / 2} color={leatherOf(design, "main").color} matte={matte} edge={burnished} />
      {face(front)}
      {/* The back, seen from behind: turned over about the vertical centre line. */}
      {back && (
        <group position={[W, 0, 0]} rotation={[0, Math.PI, 0]}>
          {face(back)}
        </group>
      )}
      <group ref={shadows}>
        <TableShadow x={0} w={W} h={H} z={-band.depth - 2} opacity={0.45} />
      </group>
    </group>
  );
}

export default function Film({ design }: { design: Design }) {
  const box = useRef<HTMLDivElement>(null);
  const active = useRef(true);

  // Pause when the film is scrolled out of view or the tab is hidden.
  useEffect(() => {
    let onScreen = true;
    const update = () => (active.current = onScreen && document.visibilityState === "visible");
    const io = new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting;
      update();
    });
    if (box.current) io.observe(box.current);
    document.addEventListener("visibilitychange", update);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  const Scene = productOf(design).preview === "fold" ? FoldScene : TurnScene;
  return (
    <div ref={box} style={{ width: "100%", height: "100%" }}>
      <Canvas
        flat
        shadows="soft"
        frameloop="demand"
        dpr={[1, 1.5]}
        camera={{ fov: LENS, near: 20, far: 3000 }}
        gl={{ preserveDrawingBuffer: true }}
        style={{ pointerEvents: "none" }}
      >
        <Studio />
        <Scene design={design} active={active} />
      </Canvas>
    </div>
  );
}
