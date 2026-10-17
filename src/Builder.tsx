import { toPng } from "html-to-image";
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { catalog, finish, frontView, inStock, piecesOf, previewBackground, styleShape, threadInStock, type Entry, type Len, type StyleKind, type View } from "./catalog";
import {
  accentIds,
  allOneColour,
  leatherOf,
  load,
  place,
  productOf,
  removePocket,
  save,
  setCorner,
  setEdge,
  setFinish,
  setPiece,
  setThread,
  starterDesign,
  starters,
  switchProduct,
  type Design,
} from "./design";
import { buildShape, toPath } from "./geometry";
import WalletSvg from "./WalletSvg";

const Film = lazy(() => import("./Film"));

const STEPS = ["Start", "Pockets", "Colours", "Film", "Specs"];

// `start`: a product picked on the home page (#/design/<product>), to begin with.
export default function Builder({ start }: { start?: string }) {
  const initial = useMemo(() => {
    const saved = load();
    if (!start || !catalog.products[start]) return saved;
    history.replaceState(null, "", "#/design"); // a reload keeps the design, not the link
    return { design: saved.design ? switchProduct(saved.design, start) : starterDesign(start), step: 1 };
  }, []);
  const [design, setDesign] = useState<Design | null>(initial.design);
  const [step, setStep] = useState(initial.step);

  useEffect(() => {
    save(design, step);
  }, [design, step]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  const choose = (productId: string) => {
    setDesign(design ? switchProduct(design, productId) : starterDesign(productId));
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

      {!current && <Start onChoose={choose} />}
      {current && step === 1 && <Pockets design={current} onChange={setDesign} onNext={() => setStep(2)} />}
      {current && step === 2 && <Colours design={current} onChange={setDesign} onNext={() => setStep(3)} />}
      {current && step === 3 && <FilmStep design={current} onSpecs={() => setStep(4)} onEdit={() => setStep(1)} />}
      {current && step === 4 && <Specs design={current} onEdit={() => setStep(1)} />}
    </div>
  );
}

// The first step: one picture per wallet, no words; tap one to start with it.
function Start({ onChoose }: { onChoose: (productId: string) => void }) {
  return (
    <main className="step start">
      <div className="choices">
        {starters.map((id) => (
          <button key={id} className="choice" aria-label={catalog.products[id].label} onClick={() => onChoose(id)}>
            <WalletSvg design={starterDesign(id)} view={frontView(catalog.products[id])} />
          </button>
        ))}
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

// One tab per product, or per group of variants (wrap wallet), then the variants to pick from.
function ProductSwitch({ design, onChange }: { design: Design; onChange: (d: Design) => void }) {
  const products = Object.entries(catalog.products);
  const current = productOf(design);
  const tabs = products.filter(([, p], i) => !p.group || products.findIndex(([, q]) => q.group === p.group) === i);
  const inTab = (id: string) => id === design.product || (!!current.group && catalog.products[id].group === current.group);
  const variants = current.group ? products.filter(([, p]) => p.group === current.group) : [];
  return (
    <>
      <div className="segmented" role="tablist">
        {tabs.map(([id, p]) => (
          <button
            key={id}
            role="tab"
            aria-selected={inTab(id)}
            className={inTab(id) ? "on" : ""}
            onClick={() => !inTab(id) && onChange(switchProduct(design, id))}
          >
            {p.label}
          </button>
        ))}
      </div>
      {variants.length > 1 && (
        <div className="segmented" role="tablist">
          {variants.map(([id, p]) => (
            <button
              key={id}
              role="tab"
              aria-selected={design.product === id}
              className={design.product === id ? "on" : ""}
              onClick={() => onChange(switchProduct(design, id))}
            >
              {p.variant}
            </button>
          ))}
        </div>
      )}
    </>
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
function Stage({ views, active, onActive, hint, children, aside }: {
  views: View<Len>[]; active: View<Len>; onActive: (id: string) => void; hint: ReactNode; children: ReactNode;
  aside?: [ReactNode, ReactNode]; // columns shown left and right of the wallet (the colour picker)
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
      <figure
        className={`stage ${aside ? "picking" : ""}`}
        onTouchStart={views.length > 1 ? onTouchStart : undefined}
        onTouchEnd={views.length > 1 ? onTouchEnd : undefined}
      >
        <div key={active.id} className={`slide from-${from}`}>{children}</div>
        {aside && (
          <>
            <div className="picker left">{aside[0]}</div>
            <div className="picker right">{aside[1]}</div>
          </>
        )}
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
  const product = productOf(design);
  const placing = product.pocket_types.length > 0; // the wrap wallet has no pockets to place
  const views = placing ? product.views.filter((v) => v.sides?.length) : product.views;
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
      <h1>{placing ? "Your pockets" : "Your wallet"}</h1>
      <ProductSwitch design={design} onChange={(d) => { setArmed(null); setSelected(null); onChange(d); }} />

      <Stage
        views={views}
        active={view}
        onActive={setView}
        hint={
          !placing ? "Swipe to see the back." : armed ? "Now tap where it goes." : selected ? "Tap × to remove it." : "Tap a pocket to remove it."
        }
      >
        <WalletSvg
          design={design}
          view={view}
          armed={!!armed}
          selected={selected}
          onSlot={onSlot}
          onPiece={() => setSelected(null)}
          onRemove={placing ? (id) => { onChange(removePocket(design, id)); setSelected(null); } : undefined}
        />
      </Stage>

      {placing && (
        <section className="panel">
          <h2>Add a pocket</h2>
          <div className="tiles">
            {product.pocket_types.map((entry) => (
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
      )}

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
  const label = selected ? piecesOf(product).find((p) => p.id === selected)?.label ?? "Pocket" : null;
  const [view, setView] = useActiveView(product.views, product.views.find((v) => v.sides?.length) ?? product.views[0]);

  // Tap a part: its colours appear on either side of the wallet. Pick one and they go away;
  // tap the part again, or anywhere off the wallet, to close them without a change.
  const pick = (name: string) => {
    if (selected) onChange(setPiece(design, selected, name));
    setSelected(null);
  };
  const toggle = (id: string) => setSelected(selected === id ? null : id);
  const leathers = finish(design.finish).leathers;
  const half = Math.ceil(leathers.length / 2);
  const column = (list: typeof leathers) =>
    list.map((l) => (
      <button
        key={l.name}
        className={`swatch ${design.colors[selected!] === l.name ? "on" : ""}`}
        disabled={!inStock(design.finish, l.name)}
        onClick={() => pick(l.name)}
      >
        <i style={{ background: l.color }} />
        <span>{l.name}</span>
      </button>
    ));

  return (
    <main className="step">
      <h1>Your colours</h1>
      <FinishSwitch design={design} onChange={onChange} />
      <Stage
        views={product.views}
        active={view}
        onActive={setView}
        aside={selected ? [column(leathers.slice(0, half)), column(leathers.slice(half))] : undefined}
        hint={
          label ? (
            <>
              Pick a colour for: <strong>{label}</strong>
            </>
          ) : (
            <>
              Tap a part to colour it ·{" "}
              <button className="link" onClick={() => onChange(allOneColour(design))}>all one colour</button>
            </>
          )
        }
      >
        <div onClick={(e) => (e.target as Element).tagName === "svg" && setSelected(null)}>
          <WalletSvg design={design} view={view} selected={selected} onPiece={toggle} />
        </div>
      </Stage>

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
        <button className="btn btn-primary btn-block" onClick={onNext}>Next: see it</button>
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

// The film of the finished wallet, then on to its specs.
function FilmStep({ design, onSpecs, onEdit }: { design: Design; onSpecs: () => void; onEdit: () => void }) {
  // Background contrasts with the main panel and the leather most pockets (or contrast pieces) are in.
  const main = leatherOf(design, "main").name;
  const leathers = accentIds(design).map((id) => leatherOf(design, id).name);
  const accent = leathers.sort((a, b) => leathers.filter((x) => x === b).length - leathers.filter((x) => x === a).length)[0] ?? main;

  return (
    <main className="step">
      <h1>Your wallet</h1>
      <div className={`viewer ${previewBackground(design.finish, main, accent)}`}>
        <Suspense fallback={<div className="viewer-loading">Loading…</div>}>
          <Film design={design} />
        </Suspense>
      </div>
      <div className="actions">
        <button className="btn btn-primary btn-block" onClick={onSpecs}>See specs</button>
        <button className="btn btn-ghost btn-block" onClick={onEdit}>Edit design</button>
      </div>
    </main>
  );
}

// Every detail of the design, to download as an image and send.
function Specs({ design, onEdit }: { design: Design; onEdit: () => void }) {
  const sheet = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const product = productOf(design);
  const date = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local time

  const pocketsBySide = product.views.flatMap((v) => v.sides ?? []).map((side) => ({
    side,
    pockets: side.slots.filter((s) => design.pockets[s.id]),
  }));

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
      <h1>Specs</h1>
      <div className="sheet" ref={sheet}>
        <header>
          <span className="brand">{catalog.site.name}</span>
          <span>{date}</span>
        </header>
        <h2>{product.variant ? `${product.variant} ${product.label.toLowerCase()}` : product.label}</h2>
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
          {product.corners.length > 1 && <div><dt>Corners</dt><dd>{cap(design.corner)}</dd></div>}
          <div><dt>Thread</dt><dd>{design.thread}</dd></div>
          {product.pocket_types.length > 0 && <div><dt>Total pockets</dt><dd>{Object.keys(design.pockets).length}</dd></div>}
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
