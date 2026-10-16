# Wallet Designer v1 — Spec

"Design your next wallet." Customers design a wallet within fixed rules; I make it by hand.

## Products
- Vertical bifold and card holder. Pure leather, no hardware.

## Entry
- One question: "Do you still carry cash, or are cards enough, even abroad?"
  - Cash → vertical bifold. Cards only → card holder.
- Customer can switch product later: pockets reset to that product's default layout, colours are kept.

## Editor
- Tap-only on all devices, mobile-first. On desktop, a centred phone-width column.
- Tray shows one pocket picture (top-entry: card goes in from the top), no labels. Pockets on a side fill in order; tap the side to add the next one. Removing one closes the gap.
  - Side-entry pockets were tried and dropped for both products, and removed from the code.
- Tap a pocket picture, then tap a side to add it. Tap a placed pocket → ✕ to remove.
- Pieces:
  - Vertical bifold: main panel (shows as a strip at the fold inside), left base, right base, pockets. No stitching on the spine, inside or outside. Each base is left unstitched on its spine side (left base: right edge, right base: left edge) so it works as a slip pocket for a card or cash; the stitch is reinforced over the edge at both ends of that opening. The outside stitching follows the same path.
  - Card holder: main panel, pockets on front and back faces.
- Starting layout comes from the template.
- Current design is held in memory; every change is checked against the template limits first (e.g. max 3 pockets per side). A change that breaks a rule is refused: the pocket goes back. No messages, no highlighting.
- Customers never see rules or construction terms (T-pocket etc.); construction is my call.

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
  - Matte = Badalassi Carlo Pueblo: Bone, Grigio, Cognac, Siena, Olmo, Tabacco, Ortensia, Navy, Bottiglia, Oliva, Napoli, R.Antico, Papavero, Mosto, Coccinella, Prugna.
  - Glossy = Badalassi Carlo Minerva: Bone, Cognac, Olmo, Tabacco, Oliva.
  - Nero and Nazionale are left out on purpose.
  - Switching finish keeps every colour the new finish also has; the rest start from its default (Cognac) and that leather's pocket colour.
  - Matte is drawn without shine (2D and 3D). The summary lists the finish.
- Stock (catalog `in_stock` per finish, `threads_in_stock`): colours not in stock still show, faded and struck through, but can't be picked. No message.
  - Now in stock: Matte Bone, Ortensia, Mosto; Glossy Bone; threads Cream, Brown.
  - Starting colours and pocket/thread pairings that are out of stock are swapped for one in stock (e.g. a fresh design starts Bone with Ortensia pockets and Brown thread).
- Starts two-tone. Tapping a leather swatch colours the body (main panel + bases); pockets take the contrast colour paired with that leather in the catalog.
- Tap a pocket, then a swatch, to recolour just that pocket.
- The selected piece gets an outline whose colour comes from a fixed table in the catalog (`selection`), keyed by the leathers just above and below it (behind / in front). Worked out in advance for contrast: white for every pair except Tan with Tan, which gets black.
- "All one colour" button makes everything match.
- One thread colour for the whole wallet. Default = thread paired with the main panel leather; changes when the main panel colour changes. Customer can override.
- No edge-finish (paint/burnish) or thickness choices. Edges drawn shiny in the leather's colour.
- Stitching is always drawn as saddle stitch (short slanted stitches, 3.38 mm apart like a French pricking iron) in the thread colour, in 2D and 3D, drawn at M50 thread thickness (0.45 mm). At each end of a pocket mouth the stitch runs over the pocket edge onto the leather behind. The spacing is never shown as text.

## Styles
- Pocket shape: e.g. straight / notch / slant / wave / step. Chosen per side (Left/Right on the bifold, Front/Back on the card holder); all pockets on a side share it. Direction is automatic: right-side pockets use the mirrored shape (slant drops towards the fold on both sides); the customer never picks a direction.
- Corners: e.g. rounded / square. One choice for the whole wallet.
- Customer picks from small pictures (no names/jargon). Only styles allowed for that product are offered. Default per product set in the catalog.

## Review
- 3D preview of the wallet open flat (never folded), plain slabs in the chosen colours, drag to rotate.
- Fixed leather thickness (catalog `thickness`, never shown): main panel 1.4 mm; everything else (bases, pockets) 1 mm. Pockets stack layer on layer.
- Background is dark or light from a fixed table in the catalog (`preview_background`), keyed by the main panel leather and the leather most pockets are in. Light for every pair except Tan with Tan, which stays dark.

## Output
- One PNG:
  - open wallet drawn flat, every piece in its chosen colour
  - list: product, each piece → colour name, thread colour, pocket count and direction per side
- Not a cutting pattern; it shows the build only.
- Final screen: **Download image** button saves the PNG locally. Trial users (friends and family) send it to me themselves.

## Catalog (`catalog.yaml`, single file)
- YAML so it's easy to edit by hand; adding/removing an option is one line.
- Products: panels, slots, which pocket types each slot accepts, limits, default layout, allowed pocket edges and corners, default style.
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
- react-three-fiber for the 3D preview.
- html-to-image for the PNG.
- Static hosting on Cloudflare Pages at my subdomain. No backend.

## Later (not v1)
- Captcha (Cloudflare Turnstile), email delivery, pricing.
- Sending the design to me directly (WhatsApp share / `wa.me` link).
- Folded 3D view, realistic texture.
