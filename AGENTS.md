# CLAUDE.md — Perilous Shores 3D

## Project Overview

Browser-based procedural terrain generator with **cartoon-style mountains** on a **320×320 km** map + **Three.js r185** 3D rendering with low-poly styling.

**Live**: https://0xPaladin.github.io/Outlands/

## Directory Layout

```
perilous3d/
├── index.html          # shell with import maps (three, delaunator, lil-gui) + inline CSS + UI chrome
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
    │                    #   + temperature (latitudinal + elevation lapse) + moisture (Azgaar neighbor-averaging)
    │                    #   + rivers (flux accumulation) + biomes (Azgaar 5×26 matrix)
    ├── 06_coast.js     # Chaikin smoothing (retained, unused by current pipeline)
    ├── 07_mesher.js    # Delaunay triangles → indexed THREE.BufferGeometry + vertex colors
    ├── 08_colors.js    # PS terrain palette (used by mountain & hill tile color palettes)
    ├── 10_renderer.js  # scene, lights, clouds (Y=80-120), OrbitControls, render loop
    ├── 11_ui.js        # progress overlay, seed display, URL sync (seed display element removed; seed now in GUI)
    ├── 12_mesh_noise.js    # Seeded Perlin noise, FBM, domain warp (from meshDev)
    ├── 13_mesh_mountain.js # Mountain tile generator + vertex-colored mesh builder
    ├── 14_mesh_terrain.js  # Hill & dune tile generators + mesh builders
    ├── 15_mesh_tree.js     # Tree (5 presets) + forest (InstancedMesh) generators
    ├── 16_mesh_features.js # Integration: places meshDev mountains & forests on terrain
    ├── 17_gui.js         # lil-gui initialization: folders for Template, Parameters, Actions, Info
    └── main.js         # bootstrap: parse URL / new seed → buildRegion → createScene → animate → initGUI
```

## Conventions

- ES module syntax (`import`/`export`), one responsibility per file
- **05_terrain.js** exports `buildRegion(template, cols, rows, seed, mountainCount, baseTemp)` → returns `{ pts, triangles, heights, heightMin, heightMax, extent, waterLevel, mounts, rivers, moisture, temperature, tempBand, biome, ... }` where `mounts` is an array of `{ x, y, r, peakHeight }` for each mountain peak; `rivers` has `segments` (downhill edges) and `flux` (flow accumulation); `moisture` has per-vertex values in ~4–50 range; `biome` has per-vertex Azgaar biome indices (0–12)
- Heights are raw values (post-sea-level-cut); underwater vertices are negative, sea level = 0
- **07_mesher.js** flattens terrain to `Y = 0.1` for land and `Y = 0.0` for water; river lines float above at `0.2` (land) / `0.05` (water); biome colors are still derived from the original height field
- Colors are linear RGB `[0-1]` floats; vertex colors assigned by Azgaar 5×26 biome matrix (temperature × moisture) in `05_terrain.js` → `BIOME_COLORS` lookup in `07_mesher.js`
- **16_mesh_features.js** places meshDev 3D meshes on the terrain surface using the `mounts` array for peak positions and nearest-neighbor terrain height lookup
- **13_mesh_mountain.js**, **14_mesh_terrain.js**, **15_mesh_tree.js** use `MeshStandardMaterial` with `flatShading: true`, `vertexColors: true`; import `three` via importmap
- No external APIs, no build tooling, no bundler — keep it that way unless asked

## Key Extension Points

| What you want to do              | Where to look                                                                                                 |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Tune mountain count              | `src/17_gui.js` `Parameters.Mountains` (0–500) → passed to `05_terrain.js` `mountains()` n param              |
| Tune mountain size               | `05_terrain.js` → `mountains()` → `r: runif(1.2, 2.0 + sizeFactor * 4, rng)`                                  |
| Change mountain shape            | `05_terrain.js` → `mountains()` — `peak` (cone) + `skirt` (gaussian) formulas                                 |
| Tune mountain range clustering   | `05_terrain.js` → `mountains()` `configs` per template (range count, length, width, spread)                   |
| Tune coastline jaggedness        | `05_terrain.js` → `maskConfigs` perturbation amplitudes                                                       |
| Change erosion amount            | `05_terrain.js` → `doErosion()` parameters                                                                    |
| Adjust sea level per template    | `05_terrain.js` → `waterQuantile` lookup                                                                      |
| Tweak biome colors               | `07_mesher.js` → `BIOME_COLORS` array (index 0–12 → RGB)                                                     |
| Increase mesh detail             | `05_terrain.js` → `npts` (point count)                                                                        |
| Add trees/buildings              | `07_mesher.js` → `buildTrees()` / `buildSettlements()`                                                        |
| Tune meshDev mountain appearance | `13_mesh_mountain.js` → `generateMountainTile()` (peak count, falloff, sub-peaks) + `HEIGHT_COLORS` palette (references `08_colors.js`) |
| Adjust terrain flat height        | `07_mesher.js` → `buildTerrainMesh()` / `buildBiomeViewMesh()` land Y (0.1), water Y (0.0); river Y (0.2 land / 0.05 water); feature bases are set independently in `16_mesh_features.js` |
| Tune hill appearance             | `14_mesh_terrain.js` → `generateHillTile()` (peak count, falloff) + `HILL_PALETTE` (references `08_colors.js`)         |
| Tune mountain vs hill threshold  | `16_mesh_features.js` → `HILL_THRESHOLD` (0.65) — normH above this renders mountain tile, below renders hill tile     |
| Tune forest density              | `16_mesh_features.js` → `FOREST_DENSITY` array — biome-index→density lookup (0.0–1.0), density multiplier (0.5), centroid-growing clustering (8 km radius, min 5 per cluster) |
| Tune forest tree shape           | `15_mesh_tree.js` → `BIOME_TREE` array — per-biome leaf palette, height range, canopy/y scale, trunk fraction |
| Toggle biome cell view           | `src/17_gui.js` "Biome View" action + `07_mesher.js` → `buildBiomeViewMesh()` (non-indexed per-triangle colors + wireframe) |
| Adjust forest elevation range    | `16_mesh_features.js` → `normH` filter thresholds (0.06–0.55) in `buildMeshForests()`                         |
| Tune mesh mountain placement     | `16_mesh_features.js` → `buildMeshMountains()` — xyScale/yScale multipliers, tileH formula, hill yScale (r*0.18) vs mountain yScale (r*0.35) |
| Add noise detail layer           | Reintegrate `02_noise.js` into `05_terrain.js` pipeline                                                       |
| Share a world                    | URL auto-updated with `?template=X&seed=Y&mountains=N`                                                        |

## Algorithm Notes (abridged)

- **PRNG**: Mulberry32 (embedded in `05_terrain.js`), seeded from `seedFromString()` via `01_prng.js`
- **Triangulation**: Delaunator — 12K–20K random points over 320×320 km → indexed triangle mesh
- **Mountains**: Parabolic cone `max(0, 1−d²/r²)` for sharp cartoon peaks + Gaussian skirt `exp(−d²/(2·(4r)²))·0.2` to raise ground between peaks. Radii 1.5–5 km. Slider default 200. Peaks are clustered along 2–6 range backbones per template (range count, length, and width vary by template).
- **Island shape**: Smoothstep multiplicative mask (`1−t²(3−2t)`), with angular perturbation (4-frequency sine waves) for jagged coastlines. Per-template radius, center offset, and perturbation amplitudes control coastline shape.
- **Erosion**: Flux-based hydraulic erosion (downhill → accumulate → `√flux × slope + creep`), 8 iterations with sink-filling
- **Coast cleaning**: Two-pass removal of isolated land/water cells at boundary
- **Template features**: After coast cleaning, Bay/Fjord/Lake get inverted gaussian depressions — lake (central basin), fjord (linear trench from random edge), bay (broad blob from random edge). These push terrain below sea level to form the named water feature.
- **Scale**: Extent 320×320 km, HEIGHT_SCALE 3.5 km, camera (0, 120, 260)
- **Clouds**: IcosahedronGeometry blobs at Y=80-120, drift slowly eastward
- **Rivers**: Downhill flow accumulation on the Delaunay graph (`computeRivers()` in `05_terrain.js`). Land points start with unit flow, accumulate downhill via sorted height traversal. Points in the top 10% of accumulated flow become river channels. River segments follow downhill edges between river points and are rendered as flat blue quads (width ∝ √flux) at Y = 0.2 (land) / 0.05 (water) via `buildRiverMesh()` in `07_mesher.js`, avoiding the flat terrain plane at Y = 0.1 / 0.0.
- **Moisture**: Azgaar-style two-phase computation (`computeMoisture()` in `05_terrain.js`). Phase A: BFS from rivers (10), ocean (8), and coast-adjacent land (7) with exponential decay (0.94× per hop inland). Phase B: neighbor averaging with river flux bonus (`4 + mean(raw + max(flux/10,2), neighbors)`). Output range ~4–50, stored in `region.moisture`.
- **Temperature**: `computeTemperature()` in `05_terrain.js`. Base temp ±2°C latitudinal gradient (south hot, north cold) with elevation lapse rate (−10°C max). Mapped to Azgaar's 26-band scale: `tempBand = round(clamp(20 − t, 0, 25))`. Stored in `region.temperature` and `region.tempBand`.
- **Biomes**: `biomeId()` in `05_terrain.js` uses Azgaar's exact 5×26 biome matrix (5 moisture bands × 26 temperature bands). Overrides: normH < 0 → Marine (0), normH > 0.80 → Glacier (11). Produces 13 biomes: Marine, Hot desert, Cold desert, Savanna, Grassland, Tropical seasonal forest, Temperate deciduous forest, Tropical rainforest, Temperate rainforest, Taiga, Tundra, Glacier, Wetland. Stored per-vertex in `region.biome`. Colors looked up via `BIOME_COLORS[13]` array in `07_mesher.js`.
- **meshDev Mountains**: `buildMeshMountains()` in `16_mesh_features.js` iterates the `mounts` array from `buildRegion()`. For each mount, it samples the terrain height; if normalized height > 0.65, it generates a mountain tile (scaled XY by `r/3.5`, Y by `r*0.35`), otherwise a hill tile (Y by `r*0.18`). Hills use `HILL_PALETTE` (green) from `08_colors.js`, mountains use `HEIGHT_COLORS` (forest→rock→snow). Mountains and hills render at Y = 0.0 (base terrain is flat).
- **Forests**: `buildMeshForests()` filters terrain vertices by normalized elevation (0.06–0.55), clusters points within 8 km radius (min 5 per cluster, centroid-growing algorithm), and places InstancedMesh forest groups using `generateForest()` from `15_mesh_tree.js` at cluster centroids, raised to terrain Y = 0.1. Tree appearance varies by biome via `BIOME_TREE` config (Taiga: tall trunk, narrow conical canopy, dark green; Rainforest: tall, large round canopy, deep green; Savanna: short trunk, wide flat canopy, yellow-green; Deciduous: medium, round, includes autumn hues).
- **Biome View**: `buildBiomeViewMesh()` in `07_mesher.js` creates a non-indexed per-triangle mesh colored by the dominant biome of each triangle's vertices, with a 15% opacity wireframe overlay showing Delaunay cell boundaries. Terrain is flattened to 0.1 (land) / 0.0 (water). Toggled via the "Biome View" action in `src/17_gui.js`.

**UI**: All user controls are powered by `lil-gui` (`src/17_gui.js`). The GUI is initialized by `main.js` and exposes:
- **Template** folder: map template dropdown (island, archipelago, bay, coast, fjord, peninsula, lake, land)
- **Parameters** folder: Mountains (0–500) and Base Temp (0–35°C) sliders
- **Actions** folder: New Island, Reset View, Biome View toggle
- **Info** folder: read-only Seed display (auto-updates on generation)
The FPS counter remains as a DOM overlay in the top-left corner (`index.html`), while the seed display was removed from DOM and moved into the GUI Info panel.
