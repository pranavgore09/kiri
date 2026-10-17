// Works out each finish's `selection` and `preview_background` tables in catalog.yaml from the
// leather colours, so the site never decides contrast at runtime. Run after adding a leather or
// changing a colour:   npm run contrast
// Only the table lines are rewritten; the rest of the file keeps its layout and comments.
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const OUTLINES = ["#FFFFFF", "#000000"]; // selection outline candidates
const BACKGROUNDS = { dark: "#2A1F18", light: "#EFE7DC" }; // film background candidates

const luminance = (hex) => {
  const f = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = [1, 3, 5].map((i) => f(parseInt(hex.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [lo, hi] = [luminance(a), luminance(b)].sort((x, y) => x - y);
  return (hi + 0.05) / (lo + 0.05);
};
// The candidate with the best contrast against both leathers of a pair.
const best = (candidates, a, b) =>
  candidates.reduce((p, q) => (Math.min(ratio(q[1], a), ratio(q[1], b)) > Math.min(ratio(p[1], a), ratio(p[1], b)) ? q : p))[0];

// The `except` rows (pairs that don't take the table's default) for one finish.
export function contrastTables(finish) {
  const selection = [];
  const background = [];
  const ls = finish.leathers;
  ls.forEach((a, i) =>
    ls.slice(i).forEach((b) => {
      const outline = best(OUTLINES.map((c) => [c, c]), a.color, b.color);
      if (outline !== finish.selection.default) selection.push([a.name, b.name, outline]);
      const bg = best(Object.entries(BACKGROUNDS), a.color, b.color);
      if (bg !== finish.preview_background.default) background.push([a.name, b.name, bg]);
    }),
  );
  return { selection, preview_background: background };
}

function rewrite(file) {
  let text = fs.readFileSync(file, "utf8");
  for (const finish of parse(text).finishes) {
    const tables = contrastTables(finish);
    const start = text.indexOf(`  - id: ${finish.id}\n`);
    const next = text.indexOf("\n  - id: ", start + 1);
    const end = next < 0 ? text.indexOf("\n\n", start) + 1 : next;
    let block = text.slice(start, end);
    for (const key of ["selection", "preview_background"]) {
      const rows = tables[key].map(([a, b, v]) => `      - [${a}, ${b}, ${key === "selection" ? `"${v}"` : v}]`);
      block = block.replace(
        new RegExp(`(    ${key}:\\n      default: [^\\n]+\\n      except:\\n)((?:      - \\[[^\\n]*\\n|        \\[\\]\\n)*)`),
        (_, head) => head + (rows.length ? rows.join("\n") : "        []") + "\n",
      );
    }
    text = text.slice(0, start) + block + text.slice(end);
    console.log(`${finish.id}: ${tables.selection.length} outline and ${tables.preview_background.length} background exceptions`);
  }
  fs.writeFileSync(file, text);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) rewrite(process.argv[2] ?? "catalog.yaml");
