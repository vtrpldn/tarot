# Stralsund Lenormand artwork

The 36 fronts and historic patterned back come from the Etteilla Foundation's native scans of the *Stralsund Mlle Lenormand oracle deck*, printed in Germany by Spielkartenfabrik Altenburg around 1890.

- Collection record: <https://etteilla.org/en/deck/7/stralsund-mlle-lenormand-oracle-deck>
- Scan credit: Etteilla Foundation
- Digital scan license: [Creative Commons Attribution-NonCommercial 4.0](https://creativecommons.org/licenses/by-nc/4.0/)
- Reuse terms: <https://etteilla.org/en/collection-tos>
- Physical card dimensions: 51×83 mm; the app preserves that aspect ratio.

The underlying nineteenth-century card artwork is public domain. Etteilla's distributed scan files include their embedded credit and are used here under CC BY-NC 4.0 because this application is a non-commercial product. Commercial reuse of these scan files requires separate permission from the Etteilla Foundation.

`source/` contains the native, transparent AVIF scans at approximately 1,300×2,160 pixels. The embedded credit, worn edges, and irregular corner transparency are intentionally preserved. `detail/` and `preview/` contain optimized WebP derivatives on uniform transparent 51:83 canvases for responsive rendering.

`scripts/build-lenormand-assets.mjs` reads the current official gallery, validates all 36 numbered fronts plus the back, downloads the native files, and regenerates the optimized derivatives. `scripts/validate-lenormand-assets.mjs` verifies formats, dimensions, completeness, and preserved transparency.
