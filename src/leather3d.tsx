// The 3D pieces the review films are built from: leather (grain, sheen, burnished edges),
// saddle stitching, contact and table shadows, and the studio light.
import { Environment, Lightformer, Line } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import { catalog, type Rect } from "./catalog";
import { grow, saddleStitches, type Pt, type Shape } from "./geometry";

const BEVEL = 0.25;
export const thick = (id: string) => (id === "main" ? catalog.thickness.main : catalog.thickness.other);

// Saddle stitches on a surface at height z, as in the 2D drawing.
export function Stitch({ shape, z, color }: { shape: Shape; z: number; color: string }) {
  const points = useMemo(
    () => saddleStitches(shape.stitch, shape.stitchClosed).flatMap((pair) => pair.map(([x, y]) => [x, -y, z] as [number, number, number])),
    [shape, z],
  );
  if (points.length < 2) return null;
  return <Line points={points} segments color={color} lineWidth={catalog.stitching.thread_width} worldUnits />;
}

// Tileable value noise, N × N, summed over octaves of [cells, amplitude]. Same seed, same hide.
function valueNoise(N: number, octaves: [number, number][], seed: number): Float32Array {
  const out = new Float32Array(N * N);
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const ease = (t: number) => t * t * (3 - 2 * t);
  for (const [cells, amp] of octaves) {
    const g = Array.from({ length: cells * cells }, rnd);
    const at = (i: number, j: number) => g[((j + cells) % cells) * cells + ((i + cells) % cells)];
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const u = (x / N) * cells, v = (y / N) * cells;
        const i = Math.floor(u), j = Math.floor(v);
        const fu = ease(u - i), fv = ease(v - j);
        const top = at(i, j) + (at(i + 1, j) - at(i, j)) * fu;
        const bottom = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * fu;
        out[y * N + x] += (top + (bottom - top) * fv) * amp;
      }
    }
  }
  return out;
}

// A texture drawn pixel by pixel, repeating every `tile` mm (texture coordinates are in mm).
function texture(N: number, tile: number, pixel: (x: number, y: number) => [number, number, number]): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = N;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(N, N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const o = (y * N + x) * 4;
      [img.data[o], img.data[o + 1], img.data[o + 2]] = pixel(x, y);
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1 / tile, 1 / tile);
  return tex;
}

// Leather grain as a normal map, made in code (no image files). Matte gets a coarser, deeper
// grain than glossy.
const textures = new Map<string, THREE.Texture>();
function grain(matte: boolean): THREE.Texture {
  const key = matte ? "grain-matte" : "grain-glossy";
  if (!textures.has(key)) {
    const N = 256;
    const height = valueNoise(N, matte ? [[48, 1], [96, 0.55], [192, 0.3]] : [[96, 1], [192, 0.5]], 20240917);
    const h = (x: number, y: number) => height[((y + N) % N) * N + ((x + N) % N)];
    textures.set(key, texture(N, matte ? 22 : 16, (x, y) => {
      const dx = h(x + 1, y) - h(x - 1, y);
      const dy = h(x, y + 1) - h(x, y - 1);
      const l = Math.hypot(dx, dy, 1);
      return [(-dx / l * 0.5 + 0.5) * 255, (dy / l * 0.5 + 0.5) * 255, (1 / l * 0.5 + 0.5) * 255];
    }));
  }
  return textures.get(key)!;
}

// A hide's soft tonal variation: wide, faint blotches, used to shade the colour and the shine
// a little, so a panel never looks like evenly painted metal.
function mottle(): THREE.Texture {
  if (!textures.has("mottle")) {
    const N = 128;
    const n = valueNoise(N, [[4, 1], [8, 0.6], [16, 0.3]], 1907);
    const lo = Math.min(...n), hi = Math.max(...n);
    textures.set("mottle", texture(N, 70, (x, y) => {
      const v = (0.93 + 0.07 * ((n[y * N + x] - lo) / (hi - lo))) * 255;
      return [v, v, v];
    }));
  }
  return textures.get("mottle")!;
}

// The surface of a piece of leather. Matte: grain plus a soft, velvety sheen at low angles.
// Glossy: finer grain and a light finish over it. Both are mottled a little.
export function LeatherSurface({ color, matte, attach, side }: { color: string; matte: boolean; attach?: string; side?: THREE.Side }) {
  const normalScale = useMemo(() => new THREE.Vector2(matte ? 0.55 : 0.22, matte ? 0.55 : 0.22), [matte]);
  const sheenColor = useMemo(() => new THREE.Color(color).lerp(new THREE.Color("#ffffff"), 0.35), [color]);
  return (
    <meshPhysicalMaterial
      attach={attach}
      side={side}
      color={color}
      map={mottle()}
      roughness={matte ? 0.85 : 0.5}
      roughnessMap={mottle()}
      metalness={0}
      normalMap={grain(matte)}
      normalScale={normalScale}
      envMapIntensity={matte ? 0.3 : 0.75}
      sheen={matte ? 0.6 : 0.25}
      sheenRoughness={0.75}
      sheenColor={sheenColor}
      clearcoat={matte ? 0 : 0.3}
      clearcoatRoughness={0.4}
    />
  );
}

// A burnished edge: the leather's own colour, a little darker, with a soft sheen (not a mirror).
const burnish = (c: string) => new THREE.Color(c).multiplyScalar(0.85);

// Splits an extruded piece's side walls into two material groups: the outer edges (1) and the
// pocket mouth along the top of `lip` (2). The geometry is not indexed: every 3 vertices are a
// triangle, so triangles can simply be reordered.
function splitMouth(geometry: THREE.ExtrudeGeometry, lip: Rect): THREE.BufferGeometry {
  const [x, y, w, h] = lip;
  const side = geometry.groups.find((g) => g.materialIndex === 1);
  if (!side) return geometry;
  const pos = geometry.getAttribute("position");
  const isMouth = (tri: number) => {
    let cx = 0, cy = 0;
    for (let v = 0; v < 3; v++) {
      cx += pos.getX(tri * 3 + v) / 3;
      cy += -pos.getY(tri * 3 + v) / 3; // back to drawing coordinates (y down)
    }
    return cx > x + 0.6 && cx < x + w - 0.6 && cy < y + h - 0.6;
  };
  const first = side.start / 3, count = side.count / 3;
  const order = [...Array(first).keys()];
  const sides = Array.from({ length: count }, (_, i) => first + i);
  const edges = sides.filter((t) => !isMouth(t));
  const mouth = sides.filter(isMouth);
  order.push(...edges, ...mouth, ...Array.from({ length: pos.count / 3 - first - count }, (_, i) => first + count + i));
  const out = new THREE.BufferGeometry();
  for (const name of Object.keys(geometry.attributes)) {
    const src = geometry.getAttribute(name);
    const arr = new Float32Array(order.length * 3 * src.itemSize);
    order.forEach((t, i) => {
      for (let k = 0; k < 3 * src.itemSize; k++) arr[i * 3 * src.itemSize + k] = (src.array as Float32Array)[t * 3 * src.itemSize + k];
    });
    out.setAttribute(name, new THREE.BufferAttribute(arr, src.itemSize));
  }
  out.addGroup(0, first * 3, 0);
  out.addGroup(first * 3, edges.length * 3, 1);
  out.addGroup((first + edges.length) * 3, mouth.length * 3, 2);
  out.addGroup((first + count) * 3, (pos.count / 3 - first - count) * 3, 0);
  return out;
}

// A piece of leather lying from z to z + thickness (the bevel is part of the thickness).
// Faces get the grain; the rounded edges are burnished: darker and smoother. `edge` is the edge
// colour (makers burnish the stacked outer edges together, so they take the main panel's
// colour); `lip` marks a pocket whose mouth edge, finished before assembly, keeps its own colour.
export function Slab({ outline, thickness, z, color, matte, edge, lip }: {
  outline: Pt[]; thickness: number; z: number; color: string; matte: boolean; edge?: string; lip?: Rect;
}) {
  const depth = thickness - 2 * BEVEL;
  const geometry = useMemo(() => {
    const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, -y)));
    const g = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelThickness: BEVEL,
      bevelSize: BEVEL,
      bevelSegments: 3,
      curveSegments: 4,
    });
    return lip ? splitMouth(g, lip) : g;
  }, [outline, depth, lip]);
  const edgeColor = useMemo(() => burnish(edge ?? color), [color, edge]);
  const mouthColor = useMemo(() => burnish(color), [color]);
  return (
    <mesh geometry={geometry} position={[0, 0, z + BEVEL]} castShadow receiveShadow>
      <LeatherSurface attach="material-0" color={color} matte={matte} />
      <meshStandardMaterial attach="material-1" color={edgeColor} roughness={0.55} metalness={0} envMapIntensity={0.35} />
      <meshStandardMaterial attach="material-2" color={mouthColor} roughness={0.55} metalness={0} envMapIntensity={0.35} />
    </mesh>
  );
}

// The outer edge of a stack of layers, burnished into one solid, slightly rounded band (as a
// maker does with water and a slicker), so the separate layers never show. `outline` is the
// stack's footprint; `top(point)` / `bottom(point)` give how high and low the leather stands at
// that point of the edge; segments where `open(a, b)` is true are left out (a slip pocket's mouth).
const BAND_ROWS = 6; // steps up the rounded profile
export function EdgeBand({ outline, bottom, top, open, color }: {
  outline: Pt[]; bottom: number | ((p: Pt) => number); top: (p: Pt) => number; open?: (a: Pt, b: Pt) => boolean; color: string;
}) {
  const geometry = useMemo(() => {
    // Resample every half millimetre, so the band can step up and down with the layers.
    const pts: Pt[] = [];
    outline.forEach((a, i) => {
      const b = outline[(i + 1) % outline.length];
      const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.5));
      for (let k = 0; k < n; k++) pts.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
    });
    const tops = pts.map(top);
    const bottoms = pts.map((p) => (typeof bottom === "number" ? bottom : bottom(p)));
    const inner = grow(pts, BEVEL + 0.05); // just outside the pieces' rounded edges
    const outer = grow(pts, BEVEL + 1.05); // one millimetre further out: the outward direction
    const verts: number[] = [];
    pts.forEach((_, i) => {
      const [x, y] = inner[i];
      const [dx, dy] = [outer[i][0] - x, outer[i][1] - y];
      const tall = tops[i] - bottoms[i];
      const bulge = Math.min(0.5, tall * 0.18); // rounded out at mid-height, flush at top and bottom
      for (let r = 0; r <= BAND_ROWS; r++) {
        const t = r / BAND_ROWS;
        const out = bulge * Math.sin(Math.PI * t);
        verts.push(x + dx * out, -(y + dy * out), bottoms[i] + tall * t);
      }
    });
    const row = BAND_ROWS + 1;
    const index: number[] = [];
    pts.forEach((a, i) => {
      const j = (i + 1) % pts.length;
      if (open?.(a, pts[j])) return;
      for (let r = 0; r < BAND_ROWS; r++) {
        const [p, q] = [i * row + r, j * row + r];
        index.push(p, q, q + 1, p, q + 1, p + 1);
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    g.setIndex(index);
    g.computeVertexNormals();
    return g;
  }, [outline, bottom, top, open]);
  // The main panel's colour, a touch deeper, with a soft burnished sheen. It doesn't take the
  // wallet's own shadow: under a top light that turns a thin edge grey.
  const burnished = useMemo(() => new THREE.Color(color).multiplyScalar(0.92), [color]);
  return (
    <mesh geometry={geometry} castShadow>
      <meshPhysicalMaterial color={burnished} roughness={0.5} metalness={0} envMapIntensity={0.2} sheen={0.5} sheenRoughness={0.5} sheenColor={burnished} side={THREE.DoubleSide} />
    </mesh>
  );
}

// Soft darkening where a piece sits on the leather under it: a few faint, ever wider copies of
// its outline just above the surface below, so only a thin, fading rim shows around the piece.
export function Contact({ outline, z }: { outline: Pt[]; z: number }) {
  const layers = useMemo(
    () => [0.5, 1.1, 1.8].map((d) => new THREE.ShapeGeometry(new THREE.Shape(grow(outline, d).map(([x, y]) => new THREE.Vector2(x, -y))))),
    [outline],
  );
  return (
    <group position={[0, 0, z + 0.06]}>
      {layers.map((g, i) => (
        <mesh key={i} geometry={g} renderOrder={1}>
          <meshBasicMaterial color="#1a120c" transparent opacity={0.11} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

// A blurred rounded rectangle, drawn once into a texture, used as a soft shadow under a wallet
// of the given size (mm). The texture has SHADOW_PAD mm of blur room on every side.
export const SHADOW_PAD = 24;
export function shadowTexture(width: number, height: number): THREE.Texture {
  const k = 4; // texture pixels per mm
  const canvas = document.createElement("canvas");
  canvas.width = (width + SHADOW_PAD * 2) * k;
  canvas.height = (height + SHADOW_PAD * 2) * k;
  const ctx = canvas.getContext("2d")!;
  ctx.filter = `blur(${7 * k}px)`;
  ctx.fillStyle = "rgba(26, 18, 12, 1)";
  ctx.beginPath();
  ctx.roundRect(SHADOW_PAD * k, SHADOW_PAD * k, width * k, height * k, 6 * k);
  ctx.fill();
  return new THREE.CanvasTexture(canvas);
}

// Studio light: a big soft box overhead, two smaller side panels and a softer box underneath for
// when the wallet is turned over, all made in the scene (no files). Used with a flat Canvas (no
// colour grading), so each leather shows its catalog colour.
export function Studio() {
  return (
    <>
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={1.8} position={[0, -60, 320]} scale={[360, 260, 1]} />
        <Lightformer form="rect" intensity={0.9} position={[-300, 120, 140]} scale={[160, 320, 1]} />
        <Lightformer form="rect" intensity={0.6} position={[300, -160, 120]} scale={[200, 160, 1]} />
        <Lightformer form="rect" intensity={1.2} position={[0, -60, -320]} scale={[360, 260, 1]} />
      </Environment>
      <hemisphereLight args={["#fff6ea", "#2a1f18", 0.4]} />
      <directionalLight
        position={[90, -70, 220]}
        intensity={1.2}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.15}
        shadow-camera-left={-150}
        shadow-camera-right={150}
        shadow-camera-top={150}
        shadow-camera-bottom={-150}
        shadow-camera-near={1}
        shadow-camera-far={600}
      />
      <directionalLight position={[-90, -70, -220]} intensity={1.4} />
    </>
  );
}
