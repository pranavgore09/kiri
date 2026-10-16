import { toPng } from "html-to-image";
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { catalog, finish, inStock, piecesOf, threadInStock, previewBackground, slotsOf, styleShape, type Entry, type Len, type StyleKind, type View } from "./catalog";
import {
  allOneColour,
  freshDesign,
  leatherOf,
  load,
  place,
  productOf,
  removePocket,
  save,
  setBody,
  setCorner,
  setEdge,
  setFinish,
  setPiece,
  setThread,
  switchProduct,
  type Design,
} from "./design";
import { buildShape, toPath } from "./geometry";
import WalletSvg from "./WalletSvg";

const Preview3D = lazy(() => import("./Preview3D"));

const STEPS = ["Start", "Pockets", "Colours", "Review"];

export default function Builder() {
  const initial = useMemo(load, []);
  const [design, setDesign] = useState<Design | null>(initial.design);
  const [step, setStep] = useState(initial.step);

  useEffect(() => {
    save(design, step);
  }, [design, step]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  const choose = (productId: string) => {
    setDesign(design ? switchProduct(design, productId) : freshDesign(productId));
    setStep(1);
  };
  const startOver = () => {
    if (!confirm("Start a new design? Your current one will be cleared.")) return;
    setDesign(null);
    setStep(0);
  };

  const current = design && step > 0 ? design : null;

  return (
    <div className="builder">
      <header className="bar">
        {step === 0 ? (
          <a href="#/" className="icon-btn" aria-label="Back to home">←</a>
        ) : (
          <button className="icon-btn" aria-label="Back" onClick={() => setStep(step - 1)}>←</button>
        )}
        <ol className="dots" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
          {STEPS.map((s, i) => (
            <li key={s} className={i <= step ? "on" : ""} />
          ))}
        </ol>
        {design ? (
          <button className="text-btn" onClick={startOver}>Start over</button>
        ) : (
          <span className="text-btn" />
        )}
      </header>

      {!current && <Question onChoose={choose} />}
      {current && step === 1 && <Pockets design={current} onChange={setDesign} onNext={() => setStep(2)} />}
      {current && step === 2 && <Colours design={current} onChange={setDesign} onNext={() => setStep(3)} />}
      {current && step === 3 && <Review design={current} onEdit={() => setStep(1)} />}
    </div>
  );
}

function Question({ onChoose }: { onChoose: (productId: string) => void }) {
  return (
    <main className="step question">
      <p className="eyebrow">One question</p>
      <h1>Do you still carry cash?</h1>
      <p className="lede">Or are cards enough — even when you travel abroad?</p>
      <div className="choices">
        <button className="choice" onClick={() => onChoose("bifold")}>
          <WalletSvg design={freshDesign("bifold")} view={catalog.products.bifold.views[1]} />
          <strong>I carry cash</strong>
          <span>Notes and cards</span>
        </button>
        <button className="choice" onClick={() => onChoose("cardholder")}>
          <WalletSvg design={freshDesign("cardholder", "Ortensia")} view={catalog.products.cardholder.views[0]} />
          <strong>Cards are enough</strong>
          <span>Slim and light</span>
        </button>
      </div>
    </main>
  );
}

// Glossy or matte: each offers its own leathers.
function FinishSwitch({ design, onChange }: { design: Design; onChange: (d: Design) => void }) {
  return (
    <>
      <div className="segmented" role="tablist">
        {catalog.finishes.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={design.finish === f.id}
            className={design.finish === f.id ? "on" : ""}
            onClick={() => onChange(setFinish(design, f.id))}
          >
            {f.label}
          </button>
        ))}
      </div>
      <p className="finish-note">{finish(design.finish).note}</p>
    </>
  );
}

function ProductSwitch({ design, onChange }: { design: Design; onChange: (d: Design) => void }) {
  return (
    <div className="segmented" role="tablist">
      {Object.entries(catalog.products).map(([id, p]) => (
        <button
          key={id}
          role="tab"
          aria-selected={design.product === id}
          className={design.product === id ? "on" : ""}
          onClick={() => onChange(switchProduct(design, id))}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

function PocketIcon() {
  return (
    <svg viewBox="0 0 60 44" className="pocket-icon" aria-hidden="true">
      <rect x="14" y="2" width="32" height="22" rx="2" className="card" />
      <rect x="6" y="12" width="44" height="30" rx="3" className="pocket" />
      <rect x="9" y="15" width="38" height="24" rx="1.5" className="stitch" />
    </svg>
  );
}

function StyleThumb({ kind, name, mirror }: { kind: StyleKind; name: string; mirror?: boolean }) {
  const shape =
    kind === "edge"
      ? buildShape({ rect: [4, 6, 52, 30], mouth: "top", mirror }, styleShape("corner", "square"), styleShape("edge", name), 2.5)
      : buildShape({ rect: [4, 4, 52, 32], corners: ["tl", "tr", "br", "bl"] }, styleShape("corner", name), undefined, 2.5);
  return (
    <svg viewBox="0 0 60 40" className="style-thumb" aria-hidden="true">
      <path d={toPath(shape.outline)} className="pocket" />
      <path d={toPath(shape.stitch, shape.stitchClosed)} className="stitch" />
    </svg>
  );
}

function StyleTiles({ kind, options, value, mirror, onPick }: {
  kind: StyleKind; options: string[]; value: string; mirror?: boolean; onPick: (name: string) => void;
}) {
  return (
    <div className="tiles">
      {options.map((name) => (
        <button
          key={name}
          className={`tile ${value === name ? "on" : ""}`}
          aria-label={name}
          aria-pressed={value === name}
          onClick={() => onPick(name)}
        >
          <StyleThumb kind={kind} name={name} mirror={mirror} />
        </button>
      ))}
    </div>
  );
}

// One pocket shape per side; right-hand sides show the shape already flipped.
function EdgePicker({ design, onChange, onSide }: { design: Design; onChange: (d: Design) => void; onSide: (sideId: string) => void }) {
  const product = productOf(design);
  if (product.edges.length < 2) return null;
  return (
    <section className="panel">
      <h2>{catalog.styles.edge.label}</h2>
      {product.views.flatMap((v) => v.sides ?? []).map((side) => (
        <div key={side.id} className="side-row">
          <h3>{side.label}</h3>
          <StyleTiles
            kind="edge"
            options={product.edges}
            value={design.edges[side.id]}
            mirror={side.slots.some((s) => s.mirror)}
            onPick={(name) => { onChange(setEdge(design, side.id, name)); onSide(side.id); }}
          />
        </div>
      ))}
    </section>
  );
}

function CornerPicker({ design, onChange }: { design: Design; onChange: (d: Design) => void }) {
  const product = productOf(design);
  if (product.corners.length < 2) return null;
  return (
    <section className="panel">
      <h2>{catalog.styles.corner.label}</h2>
      <StyleTiles kind="corner" options={product.corners} value={design.corner} onPick={(name) => onChange(setCorner(design, name))} />
    </section>
  );
}

// The wallet preview stays pinned under the top bar while the choices scroll beneath it,
// so every tap shows its result without scrolling back up. One view at a time; swipe or tap a tab to switch.
function Stage({ views, active, onActive, hint, children }: {
  views: View<Len>[]; active: View<Len>; onActive: (id: string) => void; hint: ReactNode; children: ReactNode;
}) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const [from, setFrom] = useState<"left" | "right">("right");
  const index = views.findIndex((v) => v.id === active.id);
  const go = (i: number) => {
    if (i < 0 || i >= views.length || i === index) return;
    setFrom(i > index ? "right" : "left");
    onActive(views[i].id);
  };
  const onTouchStart = (e: React.TouchEvent) => {
    start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!start.current) return;
    const dx = e.changedTouches[0].clientX - start.current.x;
    const dy = e.changedTouches[0].clientY - start.current.y;
    start.current = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) go(index + (dx < 0 ? 1 : -1));
  };
  return (
    <div className="stage-pin">
      {views.length > 1 && (
        <div className="view-tabs" role="tablist">
          {views.map((v) => (
            <button key={v.id} role="tab" aria-selected={v.id === active.id} className={v.id === active.id ? "on" : ""} onClick={() => go(views.indexOf(v))}>
              {v.label}
            </button>
          ))}
        </div>
      )}
      <figure className="stage" onTouchStart={views.length > 1 ? onTouchStart : undefined} onTouchEnd={views.length > 1 ? onTouchEnd : undefined}>
        <div key={active.id} className={`slide from-${from}`}>{children}</div>
      </figure>
      <p className="hint">{hint}</p>
    </div>
  );
}

function useActiveView(views: View<Len>[], preferred: View<Len>) {
  const [id, setId] = useState(preferred.id);
  return [views.find((v) => v.id === id) ?? preferred, setId] as const;
}

function Pockets({ design, onChange, onNext }: { design: Design; onChange: (d: Design) => void; onNext: () => void }) {
  const [armed, setArmed] = useState<Entry | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const views = productOf(design).views.filter((v) => v.sides?.length);
  const [view, setView] = useActiveView(views, views[0]);

  const onSlot = (id: string) => {
    if (armed) {
      onChange(place(design, id, armed)); // a refused placement simply does nothing
      setArmed(null);
    } else if (design.pockets[id]) {
      setSelected(selected === id ? null : id);
    }
  };

  return (
    <main className="step">
      <h1>Your pockets</h1>
      <ProductSwitch design={design} onChange={(d) => { setArmed(null); setSelected(null); onChange(d); }} />

      <Stage
        views={views}
        active={view}
        onActive={setView}
        hint={armed ? "Now tap where it goes." : selected ? "Tap × to remove it." : "Tap a pocket to remove it."}
      >
        <WalletSvg
          design={design}
          view={view}
          armed={!!armed}
          selected={selected}
          onSlot={onSlot}
          onPiece={() => setSelected(null)}
          onRemove={(id) => { onChange(removePocket(design, id)); setSelected(null); }}
        />
      </Stage>

      <section className="panel">
        <h2>Add a pocket</h2>
        <div className="tiles">
          {productOf(design).pocket_types.map((entry) => (
            <button
              key={entry}
              className={`tile ${armed === entry ? "on" : ""}`}
              aria-label="Add a pocket"
              aria-pressed={armed === entry}
              onClick={() => { setSelected(null); setArmed(armed === entry ? null : entry); }}
            >
              <PocketIcon />
            </button>
          ))}
        </div>
      </section>

      <EdgePicker
        design={design}
        onChange={onChange}
        onSide={(sideId) => setView(views.find((v) => v.sides?.some((s) => s.id === sideId))?.id ?? view.id)}
      />
      <CornerPicker design={design} onChange={onChange} />

      <div className="actions">
        <button className="btn btn-primary btn-block" onClick={onNext}>Next: colours</button>
      </div>
    </main>
  );
}

function Colours({ design, onChange, onNext }: { design: Design; onChange: (d: Design) => void; onNext: () => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const product = productOf(design);
  const label = selected
    ? piecesOf(product).find((p) => p.id === selected)?.label ?? "Pocket"
    : null;
  const active = design.colors[selected ?? "main"];
  const [view, setView] = useActiveView(product.views, product.views.find((v) => v.sides?.length) ?? product.views[0]);

  // The selected piece stays selected, so several colours can be tried on it in a row.
  const pick = (name: string) => onChange(selected ? setPiece(design, selected, name) : setBody(design, name));
  const toggle = (id: string) => setSelected(selected === id ? null : id);

  return (
    <main className="step">
      <h1>Your colours</h1>
      <FinishSwitch design={design} onChange={onChange} />
      <Stage
        views={product.views}
        active={view}
        onActive={setView}
        hint={
          label ? (
            <>
              Colouring: <strong>{label}</strong>{" "}
              <button className="link" onClick={() => setSelected(null)}>done</button>
            </>
          ) : (
            "Tap any piece to give it its own colour."
          )
        }
      >
        <WalletSvg design={design} view={view} selected={selected} onPiece={toggle} />
      </Stage>

      <section className="panel">
        <h2>Leather</h2>
        <div className="swatches">
          {finish(design.finish).leathers.map((l) => (
            <button
              key={l.name}
              className={`swatch ${active === l.name ? "on" : ""}`}
              disabled={!inStock(design.finish, l.name)}
              onClick={() => pick(l.name)}
            >
              <i style={{ background: l.color }} />
              <span>{l.name}</span>
            </button>
          ))}
        </div>
        <button className="link" onClick={() => { onChange(allOneColour(design)); setSelected(null); }}>
          Make it all one colour
        </button>
      </section>

      <section className="panel">
        <h2>Thread</h2>
        <div className="swatches">
          {catalog.threads.map((t) => (
            <button
              key={t.name}
              className={`swatch ${design.thread === t.name ? "on" : ""}`}
              disabled={!threadInStock(t.name)}
              onClick={() => onChange(setThread(design, t.name))}
            >
              <i style={{ background: t.color }} />
              <span>{t.name}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="actions">
        <button className="btn btn-primary btn-block" onClick={onNext}>Next: review</button>
      </div>
    </main>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ["A", "A", "B"] → "2 × A, B"
function describe(items: string[]): string {
  if (!items.length) return "None";
  const counts = new Map<string, number>();
  for (const i of items) counts.set(i, (counts.get(i) ?? 0) + 1);
  return [...counts].map(([i, n]) => (n > 1 ? `${n} × ${i}` : i)).join(", ");
}

function Review({ design, onEdit }: { design: Design; onEdit: () => void }) {
  const sheet = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const product = productOf(design);
  const date = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local time

  const pocketsBySide = product.views.flatMap((v) => v.sides ?? []).map((side) => ({
    side,
    pockets: side.slots.filter((s) => design.pockets[s.id]),
  }));
  const placed = slotsOf(product).filter((r) => design.pockets[r.slot.id]);
  // Background contrasts with the main panel and the leather most pockets are in.
  const main = leatherOf(design, "main").name;
  const pocketLeathers = placed.map((r) => leatherOf(design, r.slot.id).name);
  const pocketLeather = pocketLeathers.sort((a, b) => pocketLeathers.filter((x) => x === b).length - pocketLeathers.filter((x) => x === a).length)[0] ?? main;

  const download = async () => {
    if (!sheet.current) return;
    setBusy(true);
    try {
      const url = await toPng(sheet.current, { pixelRatio: 2, backgroundColor: "#f7f2ea" });
      const a = document.createElement("a");
      a.href = url;
      a.download = `wallet-design-${date}.png`;
      a.click();
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="step">
      <h1>Your wallet</h1>
      <div className={`viewer ${previewBackground(design.finish, main, pocketLeather)}`}>
        <Suspense fallback={<div className="viewer-loading">Loading 3D…</div>}>
          <Preview3D design={design} />
        </Suspense>
        <span className="viewer-hint">Drag to turn</span>
      </div>

      <div className="sheet" ref={sheet}>
        <header>
          <span className="brand">{catalog.site.name}</span>
          <span>{date}</span>
        </header>
        <h2>{product.label}</h2>
        <div className="sheet-views">
          {product.views.map((view) => (
            <figure key={view.id}>
              <WalletSvg design={design} view={view} />
              <figcaption>{view.label}</figcaption>
            </figure>
          ))}
        </div>
        <dl className="specs">
          {piecesOf(product).map((p) => (
            <div key={p.id}>
              <dt>{p.label}</dt>
              <dd>{leatherOf(design, p.id).name}</dd>
            </div>
          ))}
          {pocketsBySide.map(({ side, pockets }) => (
            <div key={side.id}>
              <dt>{side.label} pockets</dt>
              <dd>
                {describe(
                  pockets.map(
                    (s) =>
                      `${cap(design.edges[side.id])} · ${leatherOf(design, s.id).name}`,
                  ),
                )}
              </dd>
            </div>
          ))}
          <div><dt>Finish</dt><dd>{finish(design.finish).label}</dd></div>
          <div><dt>Corners</dt><dd>{cap(design.corner)}</dd></div>
          <div><dt>Thread</dt><dd>{design.thread}</dd></div>
          <div><dt>Total pockets</dt><dd>{placed.length}</dd></div>
        </dl>
      </div>

      <div className="actions">
        <button className="btn btn-primary btn-block" onClick={download} disabled={busy}>
          {busy ? "Preparing…" : "Download image"}
        </button>
        <button className="btn btn-ghost btn-block" onClick={onEdit}>Edit design</button>
        <p className="hint">Save the image and send it to me — I'll take it from there.</p>
      </div>
    </main>
  );
}
