import { describe, expect, it } from "vitest";
import { catalog, slotsOf } from "../src/catalog";
import { allOneColour, freshDesign, nextSlot, place, removePocket, setFinish, setPiece, starterDesign, starters, switchProduct } from "../src/design";
import { laidOut } from "../src/layout";

const placedOn = (d: ReturnType<typeof freshDesign>, side: string) => Object.keys(d.pockets).filter((id) => id.startsWith(`${side}-`)).sort();

describe("starters", () => {
  it("start each offered wallet in its catalog colours", () => {
    expect(starters.length).toBeGreaterThan(0);
    for (const id of starters) {
      const s = catalog.products[id].starter!;
      const d = starterDesign(id);
      expect(d.colors.main).toBe(s.body);
      if (s.thread) expect(d.thread).toBe(s.thread);
    }
    expect(starterDesign("wrap_vertical").colors.outer).toBe(catalog.products.wrap_vertical.starter!.accent);
  });
});

describe("pockets", () => {
  it("fill a side in order, up to its limit", () => {
    let d = freshDesign("cardholder");
    const side = catalog.products.cardholder.views[0].sides![0];
    while (nextSlot(d, side.id)) d = place(d, nextSlot(d, side.id)!, "top");
    expect(placedOn(d, side.id)).toHaveLength(side.max_pockets);
    expect(nextSlot(d, side.id)).toBeNull();
    expect(place(d, side.slots[0].id, "top")).toBe(d); // a taken slot is refused
  });

  it("close the gap when one is removed", () => {
    let d = freshDesign("cardholder");
    d = place(d, nextSlot(d, "front")!, "top"); // front-1..3
    d = setPiece(d, "front-3", "Mosto");
    d = removePocket(d, "front-2");
    expect(placedOn(d, "front")).toEqual(["front-1", "front-2"]);
    expect(d.colors["front-2"]).toBe("Mosto"); // the pocket behind moved up, with its colour
    expect(d.colors["front-3"]).toBeUndefined();
  });

  it("set the card holder's height: 2 + 56 + 7 per extra pocket + 2", () => {
    let d = freshDesign("cardholder");
    expect(laidOut(d, catalog.products.cardholder.views[0]).size[1]).toBe(67);
    d = place(d, nextSlot(d, "front")!, "top");
    expect(laidOut(d, catalog.products.cardholder.views[0]).size[1]).toBe(74);
  });
});

describe("colours", () => {
  it("refuse a leather that isn't in stock", () => {
    const glossy = catalog.finishes.find((f) => f.id === "glossy")!;
    const out = glossy.leathers.find((l) => glossy.in_stock && !glossy.in_stock.includes(l.name));
    const d = setFinish(freshDesign("bifold"), "glossy");
    if (out) expect(setPiece(d, "main", out.name)).toBe(d);
  });

  it("remember each finish's choices across a switch", () => {
    let d = starterDesign("bifold");
    const matte = { ...d.colors };
    d = setFinish(d, "glossy");
    d = setFinish(d, "matte");
    expect(d.colors).toEqual(matte);
  });

  it("keep the leathers when switching product", () => {
    const d = switchProduct(setPiece(freshDesign("bifold"), "main", "Mosto"), "cardholder");
    expect(d.colors.main).toBe("Mosto");
    expect(slotsOf(catalog.products.cardholder).length).toBeGreaterThan(0);
  });

  it("all one colour matches everything to the main panel", () => {
    const d = allOneColour(starterDesign("cardholder"));
    expect(new Set(Object.values(d.colors))).toEqual(new Set([d.colors.main]));
  });
});
