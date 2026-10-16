import { Bounds, Line, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { catalog, styleShape, thread, type View } from "./catalog";
import { leatherOf, type Design } from "./design";
import { buildShape, saddleStitches, type Pt, type Shape } from "./geometry";
import { backToFront, viewsOf } from "./layout";

const BEVEL = 0.25;
const thick = (id: string) => (id === "main" ? catalog.thickness.main : catalog.thickness.other);
const STITCH = catalog.card_pockets.stitch;

// Saddle stitches on a surface at height z, as in the 2D drawing.
function Stitch({ shape, z, color }: { shape: Shape; z: number; color: string }) {
  const points = useMemo(
    () => saddleStitches(shape.stitch, shape.stitchClosed).flatMap((pair) => pair.map(([x, y]) => [x, -y, z] as [number, number, number])),
    [shape, z],
  );
  if (points.length < 2) return null;
  return <Line points={points} segments color={color} lineWidth={catalog.stitching.thread_width} worldUnits />;
}

// A piece of leather lying from z to z + thickness (the bevel is part of the thickness).
function Slab({ outline, thickness, z, color, matte }: { outline: Pt[]; thickness: number; z: number; color: string; matte: boolean }) {
  const depth = thickness - 2 * BEVEL;
  const geometry = useMemo(() => {
    const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, -y)));
    return new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelThickness: BEVEL,
      bevelSize: BEVEL,
      bevelSegments: 2,
      curveSegments: 4,
    });
  }, [outline, depth]);
  return (
    <mesh geometry={geometry} position={[0, 0, z + BEVEL]} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={matte ? 0.95 : 0.55} metalness={matte ? 0 : 0.05} />
    </mesh>
  );
}

function ViewGroup({ design, view, pieces }: { design: Design; view: View; pieces: View["pieces"] }) {
  const corner = styleShape("corner", design.corner);
  const threadColor = thread(design.thread).color;
  const [W] = view.size;
  // Pieces lie from z = 0; pockets stack on top of them. A view's back face is turned over,
  // so its z = 0 is the far side of the piece the other view drew (card holder main panel).
  const base = pieces.length ? Math.max(...pieces.map((p) => thick(p.id))) : 0;
  const surface = (id: string) => (pieces.some((p) => p.id === id) ? thick(id) : 0) + 0.05;
  const mainSurface = surface(view.pieces[0]?.id ?? "main");

  const content = (
    <>
      {pieces.map((p) => (
        <Slab
          key={p.id}
          outline={buildShape({ rect: p.rect, corners: p.corners }, corner).outline}
          thickness={thick(p.id)}
          matte={design.finish === "matte"}
          z={0}
          color={leatherOf(design, p.id).color}
        />
      ))}
      {view.pieces.filter((p) => p.stitch !== false).map((p) => (
        <Stitch key={`s-${p.id}`} shape={buildShape({ rect: p.rect, corners: p.corners, open: p.open }, corner, undefined, STITCH)} z={surface(p.id)} color={threadColor} />
      ))}
      {(view.stitch_lines ?? []).map((l, i) => (
        <Stitch key={`l-${i}`} shape={buildShape({ rect: l.rect, corners: l.corners, open: l.open }, corner, undefined, STITCH)} z={mainSurface} color={threadColor} />
      ))}
      {(view.sides ?? []).flatMap((side) => {
        const edge = styleShape("edge", design.edges[side.id]);
        return backToFront(side).filter((slot) => design.pockets[slot.id]).map((slot, i) => {
          const entry = design.pockets[slot.id];
          const mouth = entry === "top" ? "top" : slot.mouth ?? "right";
          const shape = buildShape({ rect: slot.rect, corners: slot.corners, mirror: slot.mirror, mouth }, corner, edge, STITCH);
          const z = base + i * catalog.thickness.other;
          const top = z + catalog.thickness.other + 0.05;
          return (
            <group key={slot.id}>
              <Slab outline={shape.outline} thickness={catalog.thickness.other} z={z} color={leatherOf(design, slot.id).color} matte={design.finish === "matte"} />
              <Stitch shape={shape} z={top} color={threadColor} />
            </group>
          );
        });
      })}
    </>
  );

  // A back view is the same wallet seen from behind: turn it around the vertical centre line.
  return view.face === "back" ? (
    <group position={[W, 0, 0]} rotation={[0, Math.PI, 0]}>{content}</group>
  ) : (
    <group>{content}</group>
  );
}

export default function Preview3D({ design }: { design: Design }) {
  const views = viewsOf(design);
  const [W, H] = views[0].size;
  // A piece shown in several views (card holder main panel) is drawn once, in the first.
  const drawn = new Set<string>();
  const piecesPerView = views.map((v) => {
    const own = v.pieces.filter((p) => !drawn.has(p.id));
    own.forEach((p) => drawn.add(p.id));
    return own;
  });
  return (
    <Canvas camera={{ position: [0, -150, 230], fov: 35 }} dpr={[1, 2]} gl={{ preserveDrawingBuffer: true }}>
      <hemisphereLight args={["#fff6ea", "#2a1f18", 1.1]} />
      <directionalLight position={[90, -70, 220]} intensity={2.2} />
      <directionalLight position={[-120, 90, -200]} intensity={0.8} />
      <Bounds fit clip observe margin={1.15}>
        <group position={[-W / 2, H / 2, 0]}>
          {views.map((v, i) => (
            <ViewGroup key={v.id} design={design} view={v} pieces={piecesPerView[i]} />
          ))}
        </group>
      </Bounds>
      <OrbitControls makeDefault enablePan={false} enableDamping />
    </Canvas>
  );
}
