# CLAUDE.md — Perilous Shores 3D

## Project Overview

Browser-based procedural terrain generator with **cartoon-style mountains** on a **320×320 km** map + **Three.js r185** 3D rendering with low-poly styling.

**Live**: https://0xPaladin.github.io/Outlands/

## Directory Layout

```
perilous3d/
├── index.html          # shell with import maps (three, delaunator) + inline CSS + UI chrome
├── README.md           # full architecture + algorithm notes
├── AGENTS.md           # 🤖 you are here
└── src/
    ├── 01_prng.js      # seedFromString → chance.js (legacy, kept for main.js)
    ├── 02_noise.js     # Perlin + FractalNoise (retained, unused by current pipeline)
    ├── 03_grid.js      # Vec2, hex grid, DCEL (retained, unused by current pipeline)
    ├── 04_raisers.js   # Skeleton/midpoint-displacement raisers (retained, unused)
    ├── 05_terrain.js   # FULL PIPELINE: Delaunay mesh → cartoon mountains (parabolic cones
    │                    #   + Gaussian skirts) → island mask → peaky → hydraulic erosion →
    │                    #   sea-level → fill sinks → coast clean → template-specific features
    │                    #   (inverted depressions: lake basin / fjord trench / bay blob)
    ├── 06_coast.js     # Chaikin smoothing (retained, unused by current pipeline)
    ├── 07_mesher.js    # Delaunay triangles → indexed THREE.BufferGeometry + vertex colors
    ├── 08_colors.js    # PS terrain palette (legacy, kept for reference)
    ├── 10_renderer.js  # scene, lights, water plane, clouds, OrbitControls, render loop
    ├── 11_ui.js        # progress overlay, seed display, URL sync
    └── main.js         # bootstrap: parse URL / new seed → buildRegion → createScene → animate
```

## Build & Run

No build step. Static ES modules served via HTTP.

```bash
cd perilous3d
python -m http.server 8000
# open http://localhost:8000
```

## Conventions

- ES module syntax (`import`/`export`), one responsibility per file
- **05_terrain.js** exports `buildRegion(template, cols, rows, seed, mountainCount)` → returns `{ pts, triangles, heights, heightMin, heightMax, extent, waterLevel, ... }`
- Heights are raw values (post-sea-level-cut); underwater vertices are negative, sea level = 0
- **07_mesher.js** scales heights by `HEIGHT_SCALE / maxLandH` for world-Y; water plane at Y=0.02
- Colors are linear RGB `[0-1]` floats; vertex colors assigned by elevation bands
- No external APIs, no build tooling, no bundler — keep it that way unless asked

## Key Extension Points

| What you want to do               | Where to look                                         |
|-----------------------------------|--------------------------------------------------------|
| Tune mountain count               | `index.html` slider (0–500) + `05_terrain.js` `mountains()` n param |
| Tune mountain size                | `05_terrain.js` → `mountains()` → `r: runif(1.2, 2.0 + sizeFactor * 4, rng)` |
| Change mountain shape             | `05_terrain.js` → `mountains()` — `peak` (cone) + `skirt` (gaussian) formulas |
| Tune mountain range clustering    | `05_terrain.js` → `mountains()` `configs` per template (range count, length, width, spread) |
| Tune coastline jaggedness         | `05_terrain.js` → `maskConfigs` perturbation amplitudes |
| Change erosion amount             | `05_terrain.js` → `doErosion()` parameters |
| Adjust sea level per template     | `05_terrain.js` → `waterQuantile` lookup |
| Tweak vertex colors               | `07_mesher.js` → `COLORS` + `terrainColor()` thresholds |
| Increase mesh detail              | `05_terrain.js` → `npts` (point count) |
| Add trees/buildings               | `07_mesher.js` → `buildTrees()` / `buildSettlements()` |
| Add noise detail layer            | Reintegrate `02_noise.js` into `05_terrain.js` pipeline |
| Share a world                     | URL auto-updated with `?template=X&seed=Y&mountains=N` |

## Algorithm Notes (abridged)

- **PRNG**: Mulberry32 (embedded in `05_terrain.js`), seeded from `seedFromString()` via `01_prng.js`
- **Triangulation**: Delaunator — 12K–20K random points over 320×320 km → indexed triangle mesh
- **Mountains**: Parabolic cone `max(0, 1−d²/r²)` for sharp cartoon peaks + Gaussian skirt `exp(−d²/(2·(4r)²))·0.2` to raise ground between peaks. Radii 1.5–5 km. Slider default 200. Peaks are clustered along 2–6 range backbones per template (range count, length, and width vary by template).
- **Island shape**: Smoothstep multiplicative mask (`1−t²(3−2t)`), with angular perturbation (4-frequency sine waves) for jagged coastlines. Per-template radius, center offset, and perturbation amplitudes control coastline shape.
- **Erosion**: Flux-based hydraulic erosion (downhill → accumulate → `√flux × slope + creep`), 8 iterations with sink-filling
- **Coast cleaning**: Two-pass removal of isolated land/water cells at boundary
- **Template features**: After coast cleaning, Bay/Fjord/Lake get inverted gaussian depressions — lake (central basin), fjord (linear trench from random edge), bay (broad blob from random edge). These push terrain below sea level to form the named water feature.
- **Water plane**: Opaque `PlaneGeometry(320, 320)` at Y=0.02 with polygonOffset, only rendered for island/archipelago/coast/peninsula. Land/lake/fjord/bay have no water plane — water is represented by the terrain mesh colored via vertex colors.
- **Scale**: Extent 320×320 km, HEIGHT_SCALE 3.5 km, camera (0, 120, 260)

## Testing

Manual only — open http://localhost:8000, adjust mountains slider, click "New Island", rotate with mouse. All 8 templates must render without console errors before merging.
