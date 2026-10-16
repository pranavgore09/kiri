import { useId, useMemo } from "react";
import { catalog, finish, selectionColor, styleShape, thread, type Len, type View } from "./catalog";
import { leatherOf, nextSlot, type Design } from "./design";
import { buildShape, saddleStitches, toPath, type Shape } from "./geometry";
import { backToFront, laidOut } from "./layout";

interface Props {
  design: Design;
  view: View<Len>;
  armed?: boolean; // a pocket is picked from the tray: show where it can go
  selected?: string | null;
  onSlot?: (slotId: string) => void;
  onPiece?: (pieceId: string) => void;
  onRemove?: (slotId: string) => void;
}

export function lighten(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amt);
  return `rgb(${mix(n >> 16)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
}

function Stitch({ shape, color }: { shape: Shape; color: string }) {
  const d = useMemo(
    () => saddleStitches(shape.stitch, shape.stitchClosed).map(([a, b]) => `M${a[0].toFixed(2)} ${a[1].toFixed(2)}L${b[0].toFixed(2)} ${b[1].toFixed(2)}`).join(""),
    [shape],
  );
  return <path d={d} fill="none" stroke={color} strokeWidth={catalog.stitching.thread_width} strokeLinecap="round" pointerEvents="none" />;
}

function Leather({ shape, color, threadColor, sheen, shadow, selected, matte, onClick }: {
  shape: Shape; color: string; threadColor?: string; sheen: string; shadow?: string; selected?: string; matte?: boolean; onClick?: () => void;
}) {
  const d = toPath(shape.outline);
  return (
    <g onClick={onClick} style={onClick ? { cursor: "pointer" } : undefined}>
      <path d={d} fill={color} filter={shadow ? `url(#${shadow})` : undefined} />
      <path d={d} fill={`url(#${sheen})`} stroke={lighten(color, matte ? 0.12 : 0.28)} strokeWidth={0.7} strokeLinejoin="round" />
      {threadColor && <Stitch shape={shape} color={threadColor} />}
      {selected && <path d={d} fill="none" stroke={selected} strokeWidth={1.6} strokeLinejoin="round" />}
    </g>
  );
}

const STITCH = catalog.card_pockets.stitch;

export default function WalletSvg({ design, view: raw, armed, selected, onSlot, onPiece, onRemove }: Props) {
  const view = useMemo(() => laidOut(design, raw), [design, raw]);
  const uid = useId().replace(/:/g, "");
  const sheen = `sheen${uid}`;
  const shadow = `shadow${uid}`;
  const corner = styleShape("corner", design.corner);
  const threadColor = thread(design.thread).color;
  const [W, H] = view.size;
  const matte = !finish(design.finish).shine; // no sheen, softer edge highlight
  const colorOf = (id: string) => leatherOf(design, id).name;

  // The selection outline contrasts with the leathers just above and below the selected piece:
  // for a pocket, the one behind it (or its base panel) and the one in front of it.
  const outline = useMemo(() => {
    if (!selected) return undefined;
    for (const side of view.sides ?? []) {
      const placed = backToFront(side).filter((s) => design.pockets[s.id]);
      const i = placed.findIndex((s) => s.id === selected);
      if (i < 0) continue;
      const base = view.pieces.find((p) => p.rect.every((v, j) => v === side.area[j]));
      const above = i > 0 ? colorOf(placed[i - 1].id) : base ? colorOf(base.id) : undefined;
      const below = placed[i + 1] ? colorOf(placed[i + 1].id) : undefined;
      const own = above ?? below ?? colorOf(selected);
      return selectionColor(design.finish, above ?? own, below ?? own);
    }
    return selectionColor(design.finish, colorOf(selected), colorOf(selected));
  }, [selected, view, design]);

  const pieces = useMemo(
    () => view.pieces.map((p) => ({ p, shape: buildShape({ rect: p.rect, corners: p.corners, open: p.open }, corner, undefined, STITCH) })),
    [view, corner],
  );
  const stitchLines = useMemo(
    () => (view.stitch_lines ?? []).map((l) => buildShape({ rect: l.rect, corners: l.corners, open: l.open }, corner, undefined, STITCH)),
    [view, corner],
  );
  const slots = useMemo(
    () =>
      (view.sides ?? []).flatMap((side) => {
        const edge = styleShape("edge", design.edges[side.id]);
        return backToFront(side).map((slot) => ({
          slot,
          shape: buildShape({ rect: slot.rect, corners: slot.corners, mirror: slot.mirror, mouth: "top" }, corner, edge, STITCH),
        }));
      }),
    [view, corner, design.edges],
  );

  return (
    <svg viewBox={`-4 -4 ${W + 8} ${H + 8}`} className="wallet-svg" role="img" aria-label={view.label}>
      <defs>
        <linearGradient id={sheen} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity={matte ? 0.04 : 0.14} />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity={matte ? 0.08 : 0.16} />
        </linearGradient>
        <filter id={shadow} x="-10%" y="-10%" width="120%" height="130%">
          <feDropShadow dx="0" dy="0.9" stdDeviation="0.9" floodColor="#000" floodOpacity="0.35" />
        </filter>
      </defs>

      {pieces.map(({ p, shape }) => (
        <Leather
          key={p.id}
          shape={shape}
          color={leatherOf(design, p.id).color}
          threadColor={p.stitch === false ? undefined : threadColor}
          sheen={sheen}
          matte={matte}
          selected={selected === p.id ? outline : undefined}
          onClick={onPiece && (() => onPiece(p.id))}
        />
      ))}
      {stitchLines.map((shape, i) => (
        <Stitch key={i} shape={shape} color={threadColor} />
      ))}

      {slots.map(({ slot, shape }) => {
        if (!design.pockets[slot.id]) return null;
        return (
          <g key={slot.id}>
            <Leather
              shape={shape}
              color={leatherOf(design, slot.id).color}
              threadColor={threadColor}
              sheen={sheen}
              matte={matte}
              shadow={shadow}
              selected={selected === slot.id ? outline : undefined}
              onClick={(onSlot || onPiece) && (() => (onSlot ?? onPiece)!(slot.id))}
            />
          </g>
        );
      })}

      {armed &&
        (view.sides ?? []).map((side) => {
          const next = nextSlot(design, side.id);
          if (!next) return null;
          const [x, y, w, h] = side.area;
          return <rect key={side.id} x={x + 1} y={y + 1} width={w - 2} height={h - 2} rx={2} className="slot-target" onClick={() => onSlot?.(next)} />;
        })}

      {onRemove && selected && design.pockets[selected] && (() => {
        const slot = slots.find((s) => s.slot.id === selected)?.slot;
        if (!slot) return null;
        const [x, y, w] = slot.rect;
        return (
          <g className="remove" onClick={() => onRemove(selected)}>
            <circle cx={x + w - 9} cy={y + 8} r={6} />
            <path d={`M${x + w - 11.2} ${y + 5.8} l4.4 4.4 m0 -4.4 l-4.4 4.4`} />
          </g>
        );
      })()}
    </svg>
  );
}
