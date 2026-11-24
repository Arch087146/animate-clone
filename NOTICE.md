# Third-party asset notice

## CC0 Krita brush presets

This application bundles 37 painting presets converted from
[David Revoy's Krita brushes 2025-01 bundle](https://www.davidrevoy.com/article1060/krita-brushes-2025-01-bundle).
The brush presets and their embedded tip images are dedicated to the public
domain under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).

`scripts/import-krita-brushes.mjs` reads the `.kpp` preset XML, maps its size,
spacing, opacity, flow, texture, and dynamics to this app's brush engine, and
converts the embedded tip images to grayscale PNG masks. Run
`npm run import:krita` to regenerate `src/kritaBrushes.generated.ts` and the
tips under `src/assets/brushes/krita/`.

No proprietary or closed-source application assets are included.
