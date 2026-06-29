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
    ├── 01_prng.js      # seedFromString (legacy, kept for main.js)
    ├── 02_noise.js     # Perlin + FractalNoise (retained, unused by current pipeline)
    ├── 03_grid.js      # Vec2, hex grid, DCEL (retained, unused by current pipeline)
    ├── 04_raisers.js   # Skeleton/midpoint-displacement raisers (retained, unused)
    ├── 05_terrain.js   # FULL PIPELINE: Delaunay mesh → cartoon mountains (parabolic cones
    │                    #   + Gaussian skirts) → island mask → peaky → hydraulic erosion →
    │                    #   fjord trench carve → sea-level → fill sinks → coast clean →
    │                    #   template-specific features (inverted depressions: lake basin / bay blob)
    │                    #   + temperature (latitudinal + elevation lapse) + moisture (Azgaar neighbor-averaging)
    │                    #   + rivers (flux accumulation) + biomes (Azgaar 5×26 matrix)
    │                    #   + habitability (biome base × elevation gaussian × slope penalty + water proximity)
    │                    #   + cities (top habitability sites, ≥32 km separation, coastal + resource-biased)
    │                    #   + towns (3 per city or 4 standalone if 0 cities, within 30 km of parent,
    │                    #         ≥25 km separation, coastal + resource-biased)
    │                    #   + resources (Max(#cities,2) biome-weighted deposits: game/hide/fur, timber/clay,
    │                    #         herb/spice/dye, copper/tin/iron, silver/gold/gems, exotic)
    │                    #   + trouble (danger markers: 1 per resource + safety-based extras near
    │                    #         settlements/ruins, worst habitability within ~20–30 km)
    ├── 06_coast.js     # Chaikin smoothing (retained, unused by current pipeline)
    ├── 07_mesher.js    # Delaunay triangles → indexed THREE.BufferGeometry + vertex colors
    │                    #   + river mesh (LineSegments)
    │                    #   + settlements: cities (keep+tower+roof) and towns (smaller hut/roof)
    │                    #   + resources: gold octahedron markers floating above deposit sites
    │                    #   + ruins: clustered stone pillars
    │                    #   + minor ruins: tall gray obelisks
    │                    #   + trouble: inverted red pyramids marking danger sites
    ├── 08_colors.js    # PS terrain palette (used by mountain & hill tile color palettes)
    ├── 10_renderer.js  # scene, lights, clouds (Y=80-120), OrbitControls, render loop
    ├── 11_ui.js        # progress overlay, seed display, URL sync (seed display element removed; seed now in GUI)
    ├── 12_mesh_noise.js    # Seeded Perlin noise, FBM, domain warp (from meshDev)
    ├── 13_mesh_mountain.js # Mountain tile generator + vertex-colored mesh builder
    ├── 14_mesh_terrain.js  # Hill & dune tile generators + mesh builders
    ├── 15_mesh_tree.js     # Tree (5 presets) + forest (InstancedMesh) generators
    ├── 16_mesh_features.js # Integration: places meshDev mountains & forests on terrain;
    │                    #   skips forest clusters within 5 km of any city or town so they stay visible
    ├── 17_gui.js         # lil-gui initialization: folders for Template, Parameters, Actions, Info
    ├── 18_items.js       # locations panel: category select + clickable item list + fly-to camera + zoom out
    └── main.js         # bootstrap: parse URL / new seed → buildRegion → createScene → animate → initGUI
```

## Conventions

- ES module syntax (`import`/`export`), one responsibility per file
- **05_terrain.js** exports `buildRegion(template, cols, rows, seed, mountainCount, baseTemp, cityCount)` → returns `{ pts, triangles, heights, heightMin, heightMax, extent, waterLevel, mounts, rivers, moisture, temperature, tempBand, biome, habitability, nearWater, cities, towns, resources, ruins, minorRuins, trouble, ... }` where `mounts` is an array of `{ x, y, r, peakHeight }` for each mountain peak; `rivers` has `segments` (downhill edges) and `flux` (flow accumulation); `moisture` has per-vertex values in ~4–50 range; `biome` has per-vertex Azgaar biome indices (0–12); `habitability` is a Float64Array (~0–125) scoring how suitable each cell is for towns; `nearWater` is a Uint8Array marking cells within ~3 hops of a coast/river; `cities` is `[{ x, z, idx, habitability }]` top-sorted land cells spaced ≥32 km apart, coastal-biased; `towns` is the same shape, placed ≤30 km from parent city (3 per city) or 4 standalone sites when 0 cities exist, spaced ≥25 km apart, coastal-biased; `resources` is `[{ x, z, idx, type }]` for Max(#cities,2) biome-weighted mineral/food deposits; `ruins` is `[{ x, z, idx }]` for 1–2 elevated habitability sites near settlements; `minorRuins` is `[{ x, z, idx }]` for 4+1d6 random obelisks anywhere on land; `trouble` is `[{ x, z, idx, type }]` danger markers (1 per resource + safety-scaled extras near settlements/ruins)
- Heights are raw values (post-sea-level-cut); underwater vertices are negative, sea level = 0
- **07_mesher.js** flattens terrain to `Y = 0.1` for land and `Y = 0.0` for water; river lines float above at `0.2` (land) / `0.05` (water); biome colors are still derived from the original height field; settlements render as procedural Three.js meshes added to a `settlements` group
- Colors are linear RGB `[0-1]` floats; vertex colors assigned by Azgaar 5×26 biome matrix (temperature × moisture) in `05_terrain.js` → `BIOME_COLORS` lookup in `07_mesher.js`
- **16_mesh_features.js** places meshDev 3D meshes on the terrain surface using the `mounts` array for peak positions and nearest-neighbor terrain height lookup; skips forest clusters within **5 km** of any city or town so they stay visible
- **13_mesh_mountain.js**, **14_mesh_terrain.js`, **15_mesh_tree.js` use `MeshStandardMaterial` with `flatShading: true`, `vertexColors: true`; import `three` via importmap
- No external APIs, no build tooling, no bundler — keep it that way unless asked

## Key Extension Points

| What you want to do              | Where to look                                                                                                                                                                             |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tune mountain count              | `src/17_gui.js` `Parameters.Mountains` (0–500) → passed to `05_terrain.js` `mountains()` n param                                                                                          |
| Tune mountain size               | `05_terrain.js` → `mountains()` → `r: runif(1.2, 2.0 + sizeFactor * 4, rng)`                                                                                                              |
| Change mountain shape            | `05_terrain.js` → `mountains()` — `peak` (cone) + `skirt` (gaussian) formulas                                                                                                             |
| Tune mountain range clustering   | `05_terrain.js` → `mountains()` `configs` per template (range count, length, width, spread)                                                                                               |
| Tune coastline jaggedness        | `05_terrain.js` → `maskConfigs` perturbation amplitudes                                                                                                                                   |
| Change erosion amount            | `05_terrain.js` → `doErosion()` parameters                                                                                                                                                |
| Adjust sea level per template    | `05_terrain.js` → `waterQuantile` lookup                                                                                                                                                  |
| Tweak biome colors               | `07_mesher.js` → `BIOME_COLORS` array (index 0–12 → RGB)                                                                                                                                  |
| Increase mesh detail             | `05_terrain.js` → `npts` (point count)                                                                                                                                                    |
| Add habitability score           | `05_terrain.js` → `HABITABILITY` array + `computeHabitability()` (biome base × elevation gaussian × slope penalty + water proximity)                                                     |
| Tune city/town count / coastal bias | `src/17_gui.js` `Parameters.Safety` (Perilous=0, Dangerous=1, Unsafe=2, Safe=3) → passed as `cityCount` to `buildRegion()` → `findCities()` / `findTowns()`                             |
| Place 3 towns per city           | `05_terrain.js` → `findTowns()` — 3 towns ≤30 km of each city, or 4 standalone if 0 cities; ≥25 km separation; coastal + resource bonuses via `nearWater` / `nearResource`                                             |
| Generate resources               | `05_terrain.js` → `generateResources()` picks Max(#cities,2) unique resource types per region, weighted by biome (e.g., timber in forests, metals in highlands)                                                               |
| Resource proximity bonus         | Cities/towns add +15 to their placement score when within 15 km of a generated resource deposit                                                                                                                        |
| Generate resources               | `05_terrain.js` → `generateResources()` picks Max(#cities,2) unique resource types per region, weighted by biome (e.g., timber in forests, metals in highlands/cold)                                                               |
| Generate great ruins             | `05_terrain.js` → `findRuins()` — 1–2 abandoned city sites near existing settlements, ≥30 km apart, rendered as broken stone pillar clusters in `07_mesher.js`                                                         |
| Generate minor ruins             | `05_terrain.js` → `findMinorRuins()` — 4 + 1d6 (5-10) random tall gray obelisks anywhere on land, ≥20 km apart, rendered as tall `CylinderGeometry(0.3, 0.4, 3.5)` in `07_mesher.js`                                    |
| Generate trouble markers        | `05_terrain.js` → `findTrouble()` — 1 per resource (worst habitability within 20 km) + safety-scaled extras: half near cities/towns (~30 km), half on ruin sites; rendered as inverted red pyramids in `07_mesher.js`                               |
| Prevent forest obscuring cities/towns/ruins | `16_mesh_features.js` → `CLEAR_RADIUS_SQ` (5 km) around `region.cities` + `region.towns`; 3 km around `region.minorRuins`                                                               |
| Adjust forest elevation range    | `16_mesh_features.js` → `normH` filter thresholds (0.06–0.55) in `buildMeshForests()`                                                                                                     |
| Tune mesh mountain placement     | `16_mesh_features.js` → `buildMeshMountains()` — xyScale/yScale multipliers, tileH formula, hill yScale (r*0.18) vs mountain yScale (r*0.35)                                              |
| Add noise detail layer           | Reintegrate `02_noise.js` into `05_terrain.js` pipeline                                                                                                                                   |
| Share a world                    | URL auto-updated with `?template=X&seed=Y&mountains=N&temp=T&safety=S`                                                                                                                    |

## Algorithm Notes (abridged)

- **PRNG**: Mulberry32 (embedded in `05_terrain.js`), seeded from `seedFromString()` via `01_prng.js`
- **Triangulation**: Delaunator — 12K–20K random points over 320×320 km → indexed triangle mesh
- **Mountains**: Parabolic cone `max(0, 1−d²/r²)` for sharp cartoon peaks + Gaussian skirt `exp(−d²/(2·(4r)²))·0.2` to raise ground between peaks. Radii 1.5–5 km. Slider default 200. Peaks are clustered along 2–6 range backbones per template (range count, length, and width vary by template).
- **Island shape**: Smoothstep multiplicative mask (`1−t²(3−2t)`), with angular perturbation (4-frequency sine waves) for jagged coastlines. Per-template radius, center offset, and perturbation amplitudes control coastline shape. Bay, Fjord, Lake, and Land use a full-coverage mask (radius large enough to never clip), so their coastlines come only from their carved features.
- **Erosion**: Flux-based hydraulic erosion (downhill → accumulate → `√flux × slope + creep`), 8 iterations with sink-filling
- **Coast cleaning**: Two-pass removal of isolated land/water cells at boundary
- **Template features**: After coast cleaning, Bay and Lake get inverted gaussian depressions — lake (central basin), bay (broad blob from random edge). Fjord is carved earlier (before sea-level cut) — a linear Gaussian trench (120–300 km long, 6–16 km wide, depth 0.3–0.6) from a random map edge inward, always reaching below the water cutoff. Land has no carve and heights are clamped to ≥0 for a fully continental terrain.
- **Scale**: Extent 320×320 km, HEIGHT_SCALE 3.5 km, camera (0, 120, 260)
- **Clouds**: IcosahedronGeometry blobs at Y=80-120, drift slowly eastward
- **Rivers**: Downhill flow accumulation on the Delaunay graph (`computeRivers()` in `05_terrain.js`). Land points start with unit flow, accumulate downhill via sorted height traversal. Points in the top 10% of accumulated flow become river channels. River segments follow downhill edges between river points and are rendered as flat blue quads (width ∝ √flux) at Y = 0.2 (land) / 0.05 (water) via `buildRiverMesh()` in `07_mesher.js`, avoiding the flat terrain plane at Y = 0.1 / 0.0.
- **Moisture**: Azgaar-style two-phase computation (`computeMoisture()` in `05_terrain.js`). Phase A: BFS from rivers (10), ocean (8), and coast-adjacent land (7) with exponential decay (0.94× per hop inland). Phase B: neighbor averaging with river flux bonus (`4 + mean(raw + max(flux/10,2), neighbors)`). Output range ~4–50, stored in `region.moisture`.
- **Temperature**: `computeTemperature()` in `05_terrain.js`. Base temp ±2°C latitudinal gradient (south hot, north cold) with elevation lapse rate (−10°C max). Mapped to Azgaar's 26-band scale: `tempBand = round(clamp(20 − t, 0, 25))`. Stored in `region.temperature` and `region.tempBand`.
- **Biomes**: `biomeId()` in `05_terrain.js` uses Azgaar's exact 5×26 biome matrix (5 moisture bands × 26 temperature bands). Overrides: normH < 0 → Marine (0), normH > 0.80 → Glacier (11). Produces 13 biomes: Marine, Hot desert, Cold desert, Savanna, Grassland, Tropical seasonal forest, Temperate deciduous forest, Tropical rainforest, Temperate rainforest, Taiga, Tundra, Glacier, Wetland. Stored per-vertex in `region.biome`. Colors looked up via `BIOME_COLORS[13]` array in `07_mesher.js`.
- **Habitability**: `computeHabitability()` blends biome base scores (`HABITABILITY[13]` from Azgaar), elevation gaussian (favors 0.2–0.5 normH), slope penalty (`max(0.4, 1−slope×2)`), and a +10 bonus for cells within ~3 hops of coast/river. Output range ~0–125. Stored per-vertex in `region.habitatability` and used to rank settlement candidates.
- **Cities**: `findCities()` picks the top habitability land cells from a shuffled 20%-top candidate pool, greedy-selecting sites with ≥32 km separation. Coastal cells get a +20 score bonus. Resource proximity adds +15 within 15 km.
- **Towns**: `findTowns()` places either 4 standalone towns (no cities) or 3 towns per city within a 30 km radius. All towns enforce ≥25 km mutual separation. Coastal bonus (+20 habitability) applied. Resource proximity (+15) also applied.
- **Resources**: `generateResources()` picks 2–4 unique resource types per region (from `RESOURCE_TYPES[6]`), one per deposit. Each type has a biome-weighted favor map (`RESOURCE_BIOME_WEIGHT`) so deposits land in appropriate terrain (e.g., timber in forests, metals in highlands/cold). Metals also get an elevation bonus. Returns `[{x, z, idx, type}]` in `region.resources`.
- **Settlements (meshing)**: `buildSettlements()` in `07_mesher.js` renders cities as a stone keep (wide low cylinder) + tower + cone roof, and towns as a smaller single-wall hut + cone roof. All placed at Y = 0.1 (land flat height).
- **Resource markers**: `buildResources()` in `07_mesher.js` places a gold octahedron (radius 1.2) floating at Y = terrain + 2.0 above each resource deposit.
- **Forest clearing**: `buildMeshForests()` in `16_mesh_features.js` skips placing any forest cluster whose centroid falls within **5 km** of any city or town position, keeping settlements visually unobstructed.
- **Great ruins**: `findRuins()` picks 1–2 elevated habitability sites near existing settlements (within 60 km), avoiding occupied city/town cells (30 km exclusion) and enforcing ≥30 km separation between ruins themselves. Rendered as broken stone pillar clusters in `buildSettlements()`.
- **Minor ruins**: `findMinorRuins()` places 4 + 1d6 (5–10) random tall gray obelisks anywhere on land, ≥20 km apart. Rendered as tall `CylinderGeometry(0.3, 0.4, 3.5)` standing at terrain Y + 1.75.
- **Trouble**: `findTrouble()` creates danger markers: exactly 1 per resource (worst habitability cell within ~20 km), plus safety-scaled extras — Perilous=6, Dangerous=4, Unsafe=2, Safe=0. Half the extras land within ~30 km of a city/town (worst habitability), the other half on random ruin sites. Rendered as inverted red pyramids (`ConeGeometry` rotated π) in `buildTrouble()`.
- **meshDev Mountains**: `buildMeshMountains()` in `16_mesh_features.js` iterates the `mounts` array from `buildRegion()`. For each mount, it samples the terrain height; if normalized height > 0.65, it generates a mountain tile (scaled XY by `r/3.5`, Y by `r*0.35`), otherwise a hill tile (Y by `r*0.18`). Hills use `HILL_PALETTE` (green) from `08_colors.js`, mountains use `HEIGHT_COLORS` (forest→rock→snow). Mountains and hills render at Y = 0.0 (base terrain is flat).
- **Forests**: `buildMeshForests()` filters terrain vertices by normalized elevation (0.06–0.55), clusters points within 8 km radius (min 5 per cluster, centroid-growing algorithm), and places InstancedMesh forest groups using `generateForest()` from `15_mesh_tree.js` at cluster centroids, raised to terrain Y = 0.1. Tree appearance varies by biome via `BIOME_TREE` config (Taiga: tall trunk, narrow conical canopy, dark green; Rainforest: tall, large round canopy, deep green; Savanna: short trunk, wide flat canopy, yellow-green; Deciduous: medium, round, includes autumn hues).
**UI**: All user controls are powered by `lil-gui` (`src/17_gui.js`). The GUI is initialized by `main.js` and exposes:
- **Template** folder: map template dropdown (island, archipelago, bay, fjord, lake, land)
- **Parameters** folder: Mountains (0–500), Base Temp (0–35°C), and Safety (Perilous/Dangerous/Unsafe/Safe → 0/1/2/3 cities)
- **Actions** folder: New Island (new random seed), Update (re-draw with same seed + current GUI params)
- **Info** folder: read-only Seed display (auto-updates on generation)
A **Locations panel** (`18_items.js`) sits below the GUI with a category select (Cities, Towns, Resources, Ruins, Trouble), a clickable item list (fly-to camera on click), and a Zoom Out button.
The FPS counter remains as a DOM overlay in the top-left corner (`index.html`), while the seed display was removed from DOM and moved into the GUI Info panel.
