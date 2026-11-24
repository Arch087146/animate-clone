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

## CC0 Krita brush presets

This application also bundles 37 painting presets converted from
[David Revoy's Krita brushes 2025-01 bundle](https://www.davidrevoy.com/article1060/krita-brushes-2025-01-bundle).
The brush presets and their embedded tip images are dedicated to the public
domain under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).

`scripts/import-krita-brushes.mjs` reads the `.kpp` preset XML, maps its size,
spacing, opacity, flow, texture, and dynamics to this app's brush engine, and
converts the embedded tip images to grayscale PNG masks. Run
`npm run import:krita` to regenerate `src/kritaBrushes.generated.ts` and the
tips under `src/assets/brushes/krita/`.

No proprietary or closed-source application assets are included.
