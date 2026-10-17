import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import raw from "../catalog.yaml?raw";
import { contrastTables } from "../scripts/contrast.mjs";
import { catalog } from "../src/catalog";
import { checkCatalog } from "../src/checkCatalog";

describe("catalog.yaml", () => {
  it("has no broken names, missing drawings or impossible defaults", () => {
    expect(checkCatalog(catalog)).toEqual([]);
  });

  it("has contrast tables that match its leather colours (else: npm run contrast)", () => {
    for (const finish of parse(raw).finishes) {
      const tables = contrastTables(finish);
      expect(finish.selection.except ?? [], `${finish.id} selection`).toEqual(tables.selection);
      expect(finish.preview_background.except ?? [], `${finish.id} preview_background`).toEqual(tables.preview_background);
    }
  });
});
