# The Forty Servants artwork

The 40 card fronts are Tommie Kelly's official low-resolution edition of *The Forty Servants*, first published in 2016. Kelly's free-resource post supplies the complete low-resolution ZIP specifically so people can work with the system without buying the printable edition.

- Creator and copyright: Tommie Kelly
- Official deck index: <https://www.adventuresinwoowoo.com/thefortyservants/>
- Official free-resource post: <https://www.adventuresinwoowoo.com/2017/08/fortyservantsfree/>
- Low-resolution deck ZIP: <https://www.adventuresinwoowoo.com/wp-content/uploads/2017/08/Low-Res-Deck.zip>
- Reviewed ZIP SHA-256: `f74d0ecef95080b76c454cda92ed317b907b97a5cc0a1a6dfe04f3f309daa348`
- Official quick guide: <https://www.adventuresinwoowoo.com/wp-content/uploads/2017/04/The-Forty-Servants-Cheat-Sheet.pdf>
- Creator's store: <https://www.thegamecrafter.com/designers/tommie-kelly>

The free-resource post makes the low-resolution images available for working with The Forty Servants, but does not state a standard open-source or Creative Commons license. They are retained here with their embedded `www.thefortyservants.com` credit for this non-commercial divination application. Do not reuse these files commercially or remove the embedded credit without permission from Tommie Kelly.

`source/` contains the 40 unmodified 216x395 PNG files from Kelly's ZIP. `preview/` and `detail/` contain WebP derivatives for responsive rendering. The symmetrical `back.svg` is original artwork created for this application because the free archive contains card fronts only; it is not an official Forty Servants card back.

`scripts/build-forty-servants-assets.mjs` validates the official archive, normalizes its filenames, preserves the source files, and regenerates the optimized derivatives. `scripts/validate-forty-servants-assets.mjs` verifies formats, dimensions, and completeness.
