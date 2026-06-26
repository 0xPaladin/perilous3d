# CLAUDE.md — Perilous Shores 3D

## Project Overview

Perilous Shores 3D: browser-based procedural terrain generator.
Perilous Shores (hex map, biomes, noise) + Three.js r185 3D visualization with warm procedural-island styling.

**Live**: https://0xPaladin.github.io/Outlands/

## Directory Layout

```
perilous3d/
├── index.html          # shell with import maps + minimal inline CSS + UI chrome
├── README.md           # full architecture + algorithm notes
├── AGENTS.md           # 🤖 you are here
└── src/
    ├── 01_prng.js      # seedFromString → chance.js
    ├── 02_noise.js     # Perlin + FractalNoise (6 oct, smoothed, seeded perm table)
    ├── 03_grid.js      # Vec2, hex grid, DCEL, floodFill
    ├── 04_raisers.js   # Skeleton/midpoint-displacement, Poisson-disc, 8 template raisers
    ├── 05_terrain.js   # pipeline: noise → raiser → normalize → water → islands → biomes → rivers
    ├── 06_coast.js     # Chaikin smoothing + fractal midpoint displace for coastline refinement
    ├── 07_mesher.js    # hex cells → 160×N resampled grid → THREE.BufferGeometry + trees/buildings
    ├── 08_colors.js    # PS terrain palette in 0-1 RGB (Water, Beach, Wood*, Desert, Swamp, Plain, Mountain, River)
    ├── 10_renderer.js  # scene, lights (hemi + directional+shadows), water plane, cloud blobs,
    │                    # OrbitControls, render loop with FPS counter, resetView()
    ├── 11_ui.js         # progress overlay (STEP x OF 4), seed display
    └── main.js          # bootstrap: parse URL / new seed → buildRegion → createScene → animate

# note: files 09 skipped to align with original sequence
```

## Build & Run

No build step. Static ES modules served via HTTP (browser ESM requires server, not `file://`).

```bash
cd /home/paladin/workspace/perilous3d
python3 -m http.server 8000
# open http://localhost:8000
```

## Conventions

- ES module syntax (`import`/`export`), one responsibility per file
- All terrain state lives on `Cell.data` inside `Face` objects returned by `buildRegion()`
- Heights are normalized `[0, 1]` internally; mesher multiplies by `15` for world-Y
- Water level is template-dependent; mesher positions water Y plane from `region.waterLevel * 15`
- Colors are linear RGB `[0-1]` floats; Three.js `BufferAttribute` accepts them directly
- No external APIs, no build tooling, no bundler — keep it that way unless asked

## Key Extension Points

| What you want to do               | Where to look                                         |
|-----------------------------------|--------------------------------------------------------|
| Add a new map template             | `04_raisers.js` → new Raiser class + `getRaiser()`     |
| Tweak biome colors                | `08_colors.js`                                         |
| Increase terrain detail            | `07_mesher.js` → `MESH_RES`, also PS grid `cols/rows` in `buildRegion()` call in `main.js` |
| Add first-person flight controls   | Swap `OrbitControls` in `10_renderer.js` for `FirstPersonControls` (copy from `procedural-island/`) |
| Add settlements / roads / names   | Pull the `spawnTowns()` / `createRoads()` / grammar logic from `perilous.js` (compiled Haxe) |
| Tune water / waves                | `10_renderer.js` water plane material + vertex drift in animate loop |
| Share a world                     | URL is auto-updated with `?template=X&seed=Y`           |

## Algorithm Notes (abridged)

- **PRNG**: Chance.js, seeded from arbitrary string via `seedFromString()`
- **Noise**: Perlin with seeded permutation table + `6t⁵ - 15t⁴ + 10t³` smoothstep (4096-entry lookup), 6 octaves fractally
- **Parisers / Raisers**: Skeleton builds midpoint-displaced bone tree from center → edge; `distSoftRidge()` is height lookup; Archipelago uses Poisson-disc
- **Biomes**: flood-fill seeded spread (Wood 50%, Desert 35%, Swamp 40%, Plains fill remainder)
- **Rivers**: weighted random walk biased toward lower elevation + water adjacency
- **No phonological / no sound / no SVG export yet**

## Testing

Manual only — open http://localhost:8000, click "New Island", rotate with mouse. All 8 templates must render without console errors before merging.
