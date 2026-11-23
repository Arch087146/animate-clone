# Third-party asset notice

## CC0 GIMP brush tips

This application bundles 144 public-domain brush tips converted from
[vascoalexander/gimp-brush-collection](https://github.com/vascoalexander/gimp-brush-collection)
by Vasco Alexander Basque. The upstream collection is dedicated to the public
domain under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).

The `.gbr` files were parsed, downsampled, and converted to grayscale PNG stamp
images by `scripts/import-gimp-brushes.mjs`. Run `npm run import:brushes` to
regenerate the bundled tips and `src/cc0Brushes.generated.ts`.

No proprietary or closed-source application assets are included.
