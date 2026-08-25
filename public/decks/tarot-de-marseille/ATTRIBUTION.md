# Tarot de Marseille artwork

This complete 78-card set reproduces Jean Dodal's Tarot de Marseille, printed in Lyon between 1701 and 1715. The fronts and historic chevron back come from the Bibliothèque nationale de France's official Gallica scans.

- Bibliographic record: <https://catalogue.bnf.fr/ark:/12148/cb40918567t>
- Gallica viewer: <https://gallica.bnf.fr/ark:/12148/btv1b10537343h>
- IIIF manifest: <https://gallica.bnf.fr/iiif/ark:/12148/btv1b10537343h/manifest.json>
- Scan credit: Bibliothèque nationale de France, département Estampes et photographie, RESERVE BOITE FOL-KH-381 (5, 76)
- Gallica reuse terms: <https://gallica.bnf.fr/edit/und/conditions-dutilisation-des-contenus-de-gallica>
- Physical card dimensions: 66×122 mm; the app preserves that 33:61 aspect ratio.

The early-eighteenth-century card artwork is public domain. These Gallica reproductions are used with BnF attribution in this non-commercial application. Commercial reuse of Gallica reproductions may require a separate BnF licence under the current reuse terms.

The official manifest contains 156 canvases. The 78 card fronts are the odd canvases `f1` through `f155`; the even canvases are repeated backs. `f2` supplies the clean historic back. The source ordering is Deniers, Épées, Bâtons, Coupes, then trumps; the app maps it to a conventional major-then-minor order without relabeling the artwork. The untitled thirteenth trump remains `Arcane XIII` rather than receiving a title absent from the card.

`source/`, `detail/`, and `preview/` contain progressively optimized WebP derivatives generated from 1,200-pixel-wide official IIIF renditions. `scripts/build-marseille-assets.mjs` contains and validates the canvas mapping; `scripts/validate-marseille-assets.mjs` verifies completeness, formats, and dimensions.
