# Wallet Designer v1 — Spec

"Design your next wallet." Customers design a wallet within fixed rules; I make it by hand.

## Products
- Vertical bifold, card holder and wrap wallet (vertical or horizontal). Pure leather, no hardware.

## Entry
- First step: one picture per wallet (vertical bifold, card holder, wrap wallet), no words, each in its own two-tone pairing (bifold Bottiglia/Napoli, card holder Prugna/R.Antico, wrap Bone inner / Mosto outer). Tap one to start in those colours; the home page shows and links the same three.
- Customer can switch product later: pockets reset to that product's default layout, colours are kept.

## Editor
- Tap-only on all devices, mobile-first. On desktop, a centred phone-width column.
- Tray shows one pocket picture (top-entry: card goes in from the top), no labels. Pockets on a side fill in order; tap the side to add the next one. Removing one closes the gap.
  - Side-entry pockets were tried and dropped for both products, and removed from the code.
- Tap a pocket picture, then tap a side to add it. Tap a placed pocket → ✕ to remove.
- Pieces:
  - Vertical bifold: main panel (shows as a strip at the fold inside), left base, right base, pockets. No stitching on the spine, inside or outside. Each base is left unstitched on its spine side (left base: right edge, right base: left edge) so it works as a slip pocket for a card or cash; the stitch is reinforced over the edge at both ends of that opening. The outside stitching follows the same path.
  - Card holder: main panel, pockets on front and back faces.
  - Wrap wallet: no pockets to place; the customer only picks vertical or horizontal (on the first step), two colours (inner piece, outer piece) and thread.
- Starting layout comes from the template.
- Current design is held in memory; every change is checked against the template limits first (e.g. max 3 pockets per side). A change that breaks a rule is refused: the pocket goes back. No messages, no highlighting.
- Customers never see rules or construction terms (T-pocket etc.); construction is my call.

## Wrap wallet (from the pattern pack, measured against its 1-inch square)
- Two pieces, each folded once. The inner (plain) piece's spine is on the right; the outer (slanted) piece's spine is on the left and wraps the inner piece. Same on both faces.
- Seen from the front: the outer piece is high at its spine (left) and slopes down to the right, then runs flat to a rounded corner; a strip of the inner piece shows above it.
- 3 slots, all open at the top: front (outer/inner), middle (inside the inner piece), back (inner/outer).
- Stitched along the bottom and up the right side only as far as the outer piece's low end; the left spine is never stitched. The inner piece's slit (top of its spine) and the outer piece's notch (bottom of its spine) are construction detail, not drawn.
- Sizes (mm): vertical 72 × 97.5, outer piece 88 tall at its spine, slope drops 18.5 over 57. Horizontal 101 × 67.5, outer piece 61.5 tall at its spine, slope drops 18.5 over 85. Rounded corners only.

## Pocket maths (mm, in `catalog.yaml` → `card_pockets`)
- X = 56: card height (54) + ease. Card stops on the pocket's bottom stitch.
- Y = 10: every pocket is X − Y = 46 tall, so the card top shows above it.
- Z = 7: each pocket behind is stitched 7 higher.
- Stitch lines 2 from every edge.
- Width 93: card 85.6 + 3.4 ease = 89 between stitch lines, + 2 × 2.
- Card holder: front pocket stitched at the bottom edge, pockets behind step up by Z. Height = 2 + X + Z × (pockets − 1) + 2, from the fuller face: 3 pockets → 74, 2 → 67, 1 → 60. Up to 3 per face.
- Vertical bifold: halves 93 × 115 (height set by cash), 10 spine gap. Pockets stack down from the top: back pocket's card reaches the top stitch, each pocket in front 7 lower. The front pocket piece runs to the bottom edge; the T-pocket stitches behind it are hidden, so no stitch is drawn across it. Up to 3 per side.
- Hidden stitching (pocket bottoms behind other pockets) is never shown.
- Later: print these measurements on the downloaded image.

## Colours
- First choice on the colours step: **Matte** ("A soft, natural look with a quiet feel.", the default) or **Glossy** ("A warm shine that deepens as you use it."). Each offers its own leathers; the supplier leather behind each is internal only (catalog comment).
  - Kept short on purpose: the colours in stock, one generic, one or two fancy.
  - Matte = Badalassi Carlo Pueblo: Bone, Cognac, Ortensia, Mosto, R.Antico, Napoli, Bottiglia, Prugna. All in stock.
  - Glossy = Badalassi Carlo Minerva: Bone, Cognac, Oliva.
  - Switching finish keeps every colour the new finish also has; the rest start from its default and that leather's pocket colour. Each finish remembers its colours: switching back restores what the customer had picked there.
  - Matte is drawn without shine (2D and 3D). The summary lists the finish.
- Stock (catalog `in_stock` per finish, `threads_in_stock`): colours not in stock still show, faded and struck through, but can't be picked. No message.
  - Now in stock: every Matte leather; Glossy Bone; threads Cream, Brown.
  - Starting colours and pocket/thread pairings that are out of stock are swapped for one in stock (e.g. a fresh design starts Bone with Ortensia pockets and Brown thread).
- Starts two-tone: body in one leather, pockets (and the wrap wallet's outer leather) in its paired contrast colour.
- Tap a part: the finish's leathers appear in a column on each side of the wallet. Pick one and that part takes it; the columns go away. Tapping the part again, or off the wallet, closes them with no change. Thread stays as a row below.
- A wrap wallet's inner and outer leathers are each one colour on both faces.
- The selected piece gets an outline whose colour comes from a fixed table in the catalog (`selection`), keyed by the leathers just above and below it (behind / in front). Worked out in advance for contrast: white, or black where the pair includes a light leather like Bone.
- "all one colour" link, in the hint under the wallet, makes everything match the main panel.
- One thread colour for the whole wallet. Default = thread paired with the main panel leather; changes when the main panel colour changes. Customer can override.
- No edge-finish (paint/burnish) or thickness choices. Edges drawn shiny in the leather's colour.
- Stitching is always drawn as saddle stitch (short slanted stitches, 3.38 mm apart like a French pricking iron) in the thread colour, in 2D and 3D, drawn at M50 thread thickness (0.45 mm). At each end of a pocket mouth the stitch runs over the pocket edge onto the leather behind. The spacing is never shown as text.

## Styles
- Pocket shape: e.g. straight / notch / slant / wave / step. Chosen per side (Left/Right on the bifold, Front/Back on the card holder); all pockets on a side share it. Direction is automatic: right-side pockets use the mirrored shape (slant drops towards the fold on both sides); the customer never picks a direction.
- Corners: e.g. rounded / square. One choice for the whole wallet.
- Customer picks from small pictures (no names/jargon). Only styles allowed for that product are offered. Default per product set in the catalog.

## Final steps
- Film: the wallet's film (below), with **See specs** and **Edit design**.
- Specs: every detail and both faces, with **Download image** and **Edit design**.

## Film
- A short, self-playing, looping film of the customer's own design: no controls at all (no drag, zoom, speed or seek). Plays at 25 frames a second, pauses when off screen or the tab is hidden, and stops after two loops on its opening view (reload to watch again).
  - Vertical bifold (catalog `preview: fold`, about 14 s): closed → opens on its spine → the inside → close-ups of the left and right pockets → closes as the camera swings to the other side → a full turn round the closed wallet.
  - Card holder (`preview: turn`, about 12 s): the front → its pockets up close → over the edge to the back → its pockets up close → round to the front.
  - Look: leather grain, faint tonal mottling, a soft sheen (Matte) or light finish (Glossy); the spine bends into a smooth U sized to the leather stack; the outer edge is one solid, rounded band in the main panel's colour (burnished), pocket mouths in their own colour; soft contact shadows, cast shadows and a table shadow; a gliding camera with a long lens.
- Fixed leather thickness (catalog `thickness`, never shown): main panel 1.4 mm; everything else (bases, pockets) 1 mm. Pockets stack layer on layer.
- Background is dark or light from a fixed table in the catalog (`preview_background`), keyed by the main panel leather and the leather most pockets are in. Light for every pair except Tan with Tan, which stays dark.

## Output
- One PNG:
  - open wallet drawn flat, every piece in its chosen colour
  - list: product, each piece → colour name, thread colour, pocket count and direction per side
- Not a cutting pattern; it shows the build only.
- Specs page: **Download image** button saves the PNG locally. Trial users (friends and family) send it to me themselves.

## Catalog (`catalog.yaml`, single file)
- YAML so it's easy to edit by hand; adding/removing an option is one line.
- Products: panels, pocket sides and limits, which pocket types can be added, default layout, allowed pocket edges and corners, default style, film.
- Each style has an SVG in `styles/<kind>/<name>.svg` (e.g. `styles/pocket-edge/slant.svg`). Adding a style = add the SVG + its name in the catalog. No code change.
  - SVGs are made by Claude from my paper sketches (photo, dark pen, one shape per photo, drawn inside a card-sized 85 × 54 mm rectangle).
- Leather colours (name + screen colour), each with a paired contrast pocket colour and paired thread colour.
- Thread colours (name + screen colour).
- Leathers per finish (above); screen colours approximate the supplier swatches. Threads (M50 linen): Cream MS006, Brown MS003, Yellow MS016, Navy Blue MS019, Red MS009, Orange MS014. Codes are internal. Default thread per leather: Cream, except Bone, Napoli, R.Antico → Brown; Grigio, Bottiglia → Yellow.

## Saving
- Design-in-progress kept in browser storage. "Start over" button.

## Stack
- React + Vite + TypeScript.
- SVG for the 2D editor.
- react-three-fiber for the review films.
- html-to-image for the PNG.
- Static hosting on Cloudflare Pages at my subdomain. No backend.

## Later (not v1)
- Captcha (Cloudflare Turnstile), email delivery, pricing.
- Sending the design to me directly (WhatsApp share / `wa.me` link).

## Working on it
- `npm run dev`: the site locally.
- `npm test`: checks catalog.yaml (names, drawings, defaults, contrast tables) and the design rules. Also runs in `npm run build`, so a broken catalog can't be deployed.
- `npm run smoke`: walks every wallet from the first step to the specs page in Chrome.
- `npm run contrast`: after adding a leather or changing a colour, rewrites the selection-outline and film-background tables in catalog.yaml.
- A mistake in catalog.yaml shows in the browser as a list of what's wrong.
