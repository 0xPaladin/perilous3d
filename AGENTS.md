# CLAUDE.md — Perilous Shores 3D

## Project Overview

Browser-based procedural terrain generator with **cartoon-style mountains** on a **50–400 km configurable** map + **Three.js r185** 3D rendering with low-poly styling.

**Live**: https://0xPaladin.github.io/Outlands/

## Directory Layout

```
perilous3d/
├── index.html          # shell with import maps (three, delaunator, lil-gui, simplex-noise) + inline CSS + UI chrome
├── README.md           # full architecture + algorithm notes
├── AGENTS.md           # 🤖 you are here
└── src/
    ├── prng.js      # seedFromString (legacy, kept for main.js)
    ├── noise.js     # Perlin + FractalNoise (retained, unused by current pipeline)
    ├── grid.js      # Vec2, hex grid, DCEL (retained, unused by current pipeline)
    ├── raisers.js   # Skeleton/midpoint-displacement raisers (retained, unused)
├── terrain/terrain.js   # FULL PIPELINE (simplex noise base + feature uplift):
    │                    #   Terrain state commands (Scale/Rainfall) + template scripts (Hill/Range/Apply)
    │                    #   → parseCommand → processTerrainCommands
    │                    #   Step 1: generateSimplexBase — FBM (6 octaves, persistence 0.5, lacunarity 2.0,
    │                    #     baseFreq 2.0) + redistribution (pow(e*1.2, 2.5)) → 0-1 height field
    │                    #   Step 2: Feature uplift — Hill/Pit with linear taper (1-d/r) within radius,
    │                    #     Range/Trough with Gaussian cross-section (wiggle+spurs), no skirt/noise jitter
    │                    #   Step 3: Manhattan distance island mask (|x|+|y| diamond shape, smoothstep)
    │                    #   Step 4: Water level fixed at 0.5 → fill sinks
    │                    #   + temperature (latitudinal + elevation lapse) + moisture (Azgaar neighbor-averaging)
    │                    #   + rivers (flux accumulation) + biomes (Azgaar 5×26 matrix)
    │                    #   + habitability (biome base × elevation gaussian × slope penalty + water proximity)
    │                    #   + cities (top habitability sites, ≥32 km separation, coastal + resource-biased)
    │                    #   + towns (3 per city or 4 standalone if 0 cities, within 30 km of parent,
    │                    #         ≥25 km separation, coastal + resource-biased)
    │                    #   + resources (Max(#cities,2) biome-weighted deposits: game/hide/fur, timber/clay,
    │                    #         herb/spice/dye, copper/tin/iron, silver/gold/gems, exotic)
    │                    #   + trouble (danger markers: 1 per resource + safety-based extras near
    │                    #         settlements/ruins, worst habitability within ~20–30 km, ≥15 km from cities/towns)
    │                    #   + features resolution (features loop expands: site→dungeon/ruin/landmark/outpost/
    │                    #         lair+dwelling generate place names + place map markers; hazard/obstacle/area roll
    │                    #         terrain type + filter subtype compatibility + find matching cells + place markers)
    ├── terrain/coast.js     # Chaikin smoothing (retained, unused by current pipeline)
    ├── mesh/mesher.js    # Delaunay triangles → indexed THREE.BufferGeometry + vertex colors
    │                    #   + river mesh (LineSegments)
    │                    #   + settlements: cities (keep+tower+roof) and towns (smaller hut/roof)
    │                    #   + resources: gold octahedron markers floating above deposit sites
    │                    #   + ruins: clustered stone pillars
    │                    #   + minor ruins: tall gray obelisks
    │                    #   + trouble: inverted red pyramids marking danger sites
    │                    #   + site features: outpost tower, cyan landmark pillar, orange hazard pyramid,
    │                    #     amber obstacle/area pillars
    ├── mesh/colors.js    # PS terrain palette (used by mountain & hill tile color palettes)
    ├── renderer.js  # scene, lights, clouds (Y=80-120), OrbitControls, render loop
    ├── gui/ui.js        # progress overlay, seed display, URL sync (seed display element removed; seed now in GUI)
    ├── mesh/mesh_noise.js    # Seeded Perlin noise, FBM, domain warp (from meshDev)
    ├── mesh/mesh_mountain.js # Mountain tile generator + vertex-colored mesh builder
    ├── mesh/mesh_terrain.js  # Hill & dune tile generators + mesh builders
    ├── mesh/mesh_tree.js     # Tree (5 presets) + forest (InstancedMesh) generators
    ├── mesh/mesh_features.js # Integration: places meshDev mountains & forests on terrain;
    │                    #   skips forest clusters within 5 km of any city or town so they stay visible
    ├── gui/gui.js         # lil-gui initialization: folders for Template, Parameters, Actions, Info
    ├── gui/items.js       # locations panel: category select (Cities, Towns, Resources, Dungeons,
    │                     #   Ruins, Landmarks, Outposts, Hazards, Obstacles, Areas, Trouble, Factions)
    │                     #   + clickable item list + fly-to camera + zoom out
    ├── terrain/features.js    # regional feature generator: 8+2d8 features per region,
    │                     #   1d12+safety → creature/hazard/obstacle/area/named place/
    │                     #   site/faction presence/settlement, each with sub-tables
    └── main.js         # bootstrap: parse URL / new seed → buildRegion → createScene → animate → initGUI
```

## Conventions

- ES module syntax (`import`/`export`), one responsibility per file
- **terrain/terrain.js** exports `buildRegion(template, cols, rows, seed, terrain, baseTemp, cityCount, extentSize = 320)` → returns `{ pts, triangles, heights, heightMin, heightMax, extent, waterLevel, mounts, rivers, moisture, temperature, tempBand, biome, habitability, nearWater, cities, towns, resources, ruins, minorRuins, trouble, features, outpostSites, landmarkSites, factionSites, hazards, obstacles, areas, ... }` where `mounts` is an array of `{ x, y, r, peakHeight }` for each mountain/hill feature (only the most prominent are returned — all hills still shape the terrain); `rivers` has `segments` (downhill edges) and `flux` (flow accumulation); `moisture` has per-vertex values in ~4–50 range (× terrain rainfall); `biome` has per-vertex Azgaar biome indices (0–12); `habitability` is a Float64Array (~0–125) scoring how suitable each cell is for towns; `nearWater` is a Uint8Array marking cells within ~3 hops of a coast/river; `cities` is `[{ x, z, idx, habitability }]` top-sorted land cells spaced ≥32 km apart, coastal-biased; `towns` is the same shape, placed ≤30 km from parent city (3 per city) or 4 standalone sites when 0 cities exist, spaced ≥25 km apart, coastal-biased; `resources` is `[{ x, z, idx, type }]` for Max(#cities,2) biome-weighted mineral/food deposits; `ruins` is `[{ x, z, idx, name }]` for 1–2 elevated habitability sites near settlements (dungeon resolution adds `name`); `minorRuins` is `[{ x, z, idx, name }]` for 4+1d6 random obelisks anywhere on land (site→ruin and named→ruin resolution add `name`); `trouble` is `[{ x, z, idx, type }]` danger markers (1 per resource + safety-scaled extras near settlements/ruins, all ≥15 km from cities/towns, type drawn from TROUBLE_TYPES table); `factionSites` is `[{ x, z, idx, faction }]` for faction presence features bound to a city/town
- Heights are 0–1+ (simplex noise + feature uplift); water level is 0.5 (hardcoded, UI slider planned)
- **mesh/mesher.js** flattens terrain to `Y = 0.1` for land and `Y = 0.0` for water; river lines float above at `0.2` (land) / `0.05` (water); biome colors are still derived from the original height field; settlements render as procedural Three.js meshes added to a `settlements` group
- Colors are linear RGB `[0-1]` floats; vertex colors assigned by Azgaar 5×26 biome matrix (temperature × moisture) in `terrain/terrain.js` → `BIOME_COLORS` lookup in `mesh/mesher.js`
- **mesh/mesh_features.js** places meshDev 3D meshes on the terrain surface using the `mounts` array for peak positions and nearest-neighbor terrain height lookup; skips forest clusters within **5 km** of any city or town so they stay visible
- **mesh/mesh_mountain.js**, **mesh/mesh_terrain.js`, **mesh/mesh_tree.js` use `MeshStandardMaterial` with `flatShading: true`, `vertexColors: true`; import `three` via importmap
- No external APIs, no build tooling, no bundler — keep it that way unless asked

## Key Extension Points

| What you want to do              | Where to look                                                                                                                                                                             |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tune mountain count/distribution | `src/gui/gui.js` `Parameters.Terrain` (wetland/lowland/woodland/highland/wasteland) → mapped in `terrain/terrain.js` `TERRAIN_STATE_CMDS` (Scale/Rainfall strings) + `TEMPLATE_SCRIPTS` (Hill/Range/Apply strings per template)          |
| Tune mountain/hill size          | `terrain/terrain.js` → `generateHillFeatures()` → `diameter: runif(8, 22, rng)` for hills, × `sizeScale`. Ridge peak radius: `runif(3, 6, rng)` in `generateRidgeFeature()`, both × `sizeScale` / effective height via `state.scale` (set by Scale command) |
| Change mountain shape            | Hills: linear taper `1 - d/r` within radius, no skirt. Ridges: Gaussian cross-section (kept from original). Tune via hill/range height parameters in templates |
| Tune mountain range curvature    | `terrain/terrain.js` → `generateRidgeFeature()` — `wiggleAmp` (ridgeWidth × 0.5–1.0), `wiggleFreq` (1.5–3.5 oscillations), `wigglePhase` control the sinusoidal ridge centerline                                |
| Tune base noise frequency        | `terrain/terrain.js` → `generateSimplexBase()` — `baseFreq` (2.0), `exponent` (2.5), `persistence` (0.5), `fudge` (1.2)                         |
| Adjust water level               | `terrain/terrain.js` → `buildRegion()` — `waterLevel = 0.5` (hardcoded, planned as UI slider)                                  |
| Tune island shape / mask radius  | `terrain/terrain.js` → `MASK_RADII` — `island: 0.44`, `archipelago: 0.40`, `land: 5.0` (Manhattan distance)                                                                   |
| Tweak biome colors               | `mesh/mesher.js` → `BIOME_COLORS` array (index 0–12 → RGB)                                                                                                                                  |
| Increase mesh detail             | `terrain/terrain.js` → `npts` (point count, scales with area)                                                                                                                                 |
| Change map size                  | `src/gui/gui.js` `Parameters.Map Size (km)` (50–400) → passed as `extentSize` to `buildRegion()` — scales point count, mountain count/dimensions, city/resource/feature counts by area    |
| Add habitability score           | `terrain/terrain.js` → `HABITABILITY` array + `computeHabitability()` (biome base × elevation gaussian × slope penalty + water proximity)                                                     |
| Tune city/town count / coastal bias | `src/gui/gui.js` `Parameters.Safety` (Perilous=0, Dangerous=1, Unsafe=2, Safe=3) → passed as `cityCount` to `buildRegion()` → `findCities()` / `findTowns()`                             |
| Place 3 towns per city           | `terrain/terrain.js` → `findTowns()` — 3 towns ≤30 km of each city, or 4 standalone if 0 cities; ≥25 km separation; coastal + resource bonuses via `nearWater` / `nearResource`                                             |
| Generate resources               | `terrain/terrain.js` → `generateResources()` picks Max(#cities,2) unique resource types per region, weighted by biome (e.g., timber in forests, metals in highlands)                                                               |
| Resource proximity bonus         | Cities/towns add +15 to their placement score when within 15 km of a generated resource deposit                                                                                                                        |
| Generate great ruins             | `terrain/terrain.js` → `findRuins()` — 1–2 abandoned city sites near existing settlements, ≥30 km apart, rendered as broken stone pillar clusters in `mesh/mesher.js`                                                         |
| Generate minor ruins             | `terrain/terrain.js` → `findMinorRuins()` — 4 + 1d6 (5-10) random tall gray obelisks anywhere on land, ≥20 km apart, rendered as tall `CylinderGeometry(0.3, 0.4, 3.5)` in `mesh/mesher.js`                                    |
| Generate trouble markers        | `terrain/terrain.js` → `findTrouble()` — 1 per resource (worst habitability within 20 km) + safety-scaled extras: half near cities/towns (~30 km), half on ruin sites; typed from TROUBLE_TYPES; rendered as inverted red pyramids in `mesh/mesher.js`                               |
| Bind faction presence to cities/towns | `terrain/terrain.js` → features loop `faction presence` case: pick random city/town, push `{ x, z, idx, faction }` to `factionSites[]`                                                               |
| Give generated places names      | `terrain/terrain.js` → `findRuins()` and `findMinorRuins()` call `generatePlaceName(rng)`; `terrain/features.js` exports `generatePlaceName`                                                            |
| Prevent forest obscuring cities/towns/ruins | `mesh/mesh_features.js` → `CLEAR_RADIUS_SQ` (5 km) around `region.cities` + `region.towns`; 3 km around `region.minorRuins`                                                               |
| Adjust forest elevation range    | `mesh/mesh_features.js` → `normH` filter thresholds (0.06–0.55) in `buildMeshForests()`                                                                                                     |
| Tune mesh mountain placement     | `mesh/mesh_features.js` → `buildMeshMountains()` — xyScale/yScale multipliers, tileH formula, hill yScale (r*0.18) vs mountain yScale (r*0.35)                                              |
| Filter visible 3D mounts         | `terrain/terrain.js` → `generateTerrain()` post-loop: sorts by `peakHeight`, keeps top ~25 (scaled by area) in returned `mounts` array. All hills still shape the height field.              |
| Tune noise detail / frequencies  | `terrain/terrain.js` → `generateSimplexBase()` — `octaves`, `persistence`, `lacunarity`, `baseFreq`, `exponent`, `fudge`                                                                     |
| Share a world                    | URL auto-updated with `?template=X&seed=Y&terrain=Z&climate=W&safety=S&size=N`                                                                                                               |
| Show feature types in UI         | `gui/items.js` labels for hazards (`item.type`), obstacles (`item.type`), areas (`item.type`), trouble (`item.type`), factions (`item.faction.type`)                                           |
| Generate regional features       | `terrain/features.js` → `generateFeatures(safety, rng)` — 8+2d8 rolls of 1d12+safety: creature/hazard/obstacle/area/named place/site/faction presence/settlement, each with generator sub-tables |

## Algorithm Notes (abridged)

- **PRNG**: Mulberry32 (embedded in `terrain/terrain.js`), seeded from `seedFromString()` via `prng.js`
- **Triangulation**: Delaunator — points scale with map area (3K minimum, ~15–20K at 320 km, ~23–31K at 400 km) → indexed triangle mesh
- **Base terrain**: `generateSimplexBase()` — FBM with 6 octaves using `simplex-noise` library. 6 independent seeded SimplexNoise instances (one per octave, mulberry32 PRNG). Normals rescaled 0–1, redistributed via `pow(e * 1.2, 2.5)` to create flat valleys. Base frequency 2.0 means ~2 major features across the map.
- **Feature uplift**: `processTerrainCommands()` runs on top of the simplex base. Hill/Pit push circular features with **linear taper** `1 - d/r` within radius (no skirt, no noise jitter). Range/Trough push sinusoidal ridgelines + spurs with Gaussian cross-section (unchanged from original). Apply flushes queue — no shapePower/noiseAmp parameters (irrelevant for linear taper).
- **Island shape**: Manhattan distance mask (`(|nx| + |ny|)/2`) with smoothstep multiplicative falloff `1−t²(3−2t)`. Diamond-shaped islands without angular perturbation. Per-template radius: island 0.44, archipelago 0.40, land 5.0 (effectively no clip).
- **Water level**: Fixed at 0.5. No quantile-based sea level cut, no erosion, no coast cleaning, no template-specific carving (fjord/lake/bay/landclamp removed).
- **Sink filling**: Kept so rivers flow correctly.
- **Scale**: Extent configurable 50–400 km (default 320), HEIGHT_SCALE 3.5 km, camera scales with extent
- **Clouds**: IcosahedronGeometry blobs at Y=80-120, drift slowly eastward
- **Rivers**: Downhill flow accumulation on the Delaunay graph (`computeRivers()` in `terrain/terrain.js`). Land points start with unit flow, accumulate downhill via sorted height traversal. Points in the top 10% of accumulated flow become river channels. River segments follow downhill edges between river points and are rendered as flat blue quads (width ∝ √flux) at Y = 0.2 (land) / 0.05 (water) via `buildRiverMesh()` in `mesh/mesher.js`, avoiding the flat terrain plane at Y = 0.1 / 0.0.
- **Moisture**: Azgaar-style two-phase computation (`computeMoisture()` in `terrain/terrain.js`). Phase A: BFS from rivers (10), ocean (8), and coast-adjacent land (7) with exponential decay (0.94× per hop inland). Phase B: neighbor averaging with river flux bonus (`4 + mean(raw + max(flux/10,2), neighbors)`). Output range ~4–50, stored in `region.moisture`.
- **Temperature**: `computeTemperature()` in `terrain/terrain.js`. Base temp ±2°C latitudinal gradient (south hot, north cold) with elevation lapse rate (−10°C max). Mapped to Azgaar's 26-band scale: `tempBand = round(clamp(20 − t, 0, 25))`. Stored in `region.temperature` and `region.tempBand`.
- **Biomes**: `biomeId()` in `terrain/terrain.js` uses Azgaar's exact 5×26 biome matrix (5 moisture bands × 26 temperature bands). Overrides: normH < 0 → Marine (0), normH > 0.80 → Glacier (11). Produces 13 biomes: Marine, Hot desert, Cold desert, Savanna, Grassland, Tropical seasonal forest, Temperate deciduous forest, Tropical rainforest, Temperate rainforest, Taiga, Tundra, Glacier, Wetland. Stored per-vertex in `region.biome`. Colors looked up via `BIOME_COLORS[13]` array in `mesh/mesher.js`.
- **Habitability**: `computeHabitability()` blends biome base scores (`HABITABILITY[13]` from Azgaar), elevation gaussian (favors 0.2–0.5 normH), slope penalty (`max(0.4, 1−slope×2)`), and a +10 bonus for cells within ~3 hops of coast/river. Output range ~0–125. Stored per-vertex in `region.habitatability` and used to rank settlement candidates.
- **Cities**: `findCities()` picks the top habitability land cells from a shuffled 20%-top candidate pool, greedy-selecting sites with ≥32 km separation. Coastal cells get a +20 score bonus. Resource proximity adds +15 within 15 km.
- **Towns**: `findTowns()` places either 4 standalone towns (no cities) or 3 towns per city within a 30 km radius. All towns enforce ≥25 km mutual separation. Coastal bonus (+20 habitability) applied. Resource proximity (+15) also applied.
- **Resources**: `generateResources()` picks 2–4 unique resource types per region (from `RESOURCE_TYPES[6]`), one per deposit. Each type has a biome-weighted favor map (`RESOURCE_BIOME_WEIGHT`) so deposits land in appropriate terrain (e.g., timber in forests, metals in highlands/cold). Metals also get an elevation bonus. Returns `[{x, z, idx, type}]` in `region.resources`.
- **Settlements (meshing)**: `buildSettlements()` in `mesh/mesher.js` renders cities as a stone keep (wide low cylinder) + tower + cone roof, and towns as a smaller single-wall hut + cone roof. All placed at Y = 0.1 (land flat height).
- **Resource markers**: `buildResources()` in `mesh/mesher.js` places a gold octahedron (radius 1.2) floating at Y = terrain + 2.0 above each resource deposit.
- **Forest clearing**: `buildMeshForests()` in `mesh/mesh_features.js` skips placing any forest cluster whose centroid falls within **5 km** of any city or town position, keeping settlements visually unobstructed.
- **Great ruins**: `findRuins()` picks 1–2 elevated habitability sites near existing settlements (within 60 km), avoiding occupied city/town cells (30 km exclusion) and enforcing ≥30 km separation between ruins themselves. Rendered as broken stone pillar clusters in `buildSettlements()`.
- **Minor ruins**: `findMinorRuins()` places 4 + 1d6 (5–10) random tall gray obelisks anywhere on land, ≥20 km apart, count scaled by map area. Rendered as tall `CylinderGeometry(0.3, 0.4, 3.5)` standing at terrain Y + 1.75.
- **Trouble**: `findTrouble()` creates danger markers: exactly 1 per resource (worst habitability cell within ~20 km), plus safety-scaled extras (scaled by map area) — Perilous=6, Dangerous=4, Unsafe=2, Safe=0 at default 320 km. Half the extras land within ~30 km of a city/town (worst habitability), the other half on random ruin sites. All trouble cells are ≥15 km from any city or town. Lair/dwelling features also push a trouble marker with type `'lair'`. Rendered as inverted red pyramids (`ConeGeometry` rotated π) in `buildTrouble()`.
- **meshDev Mountains**: `buildMeshMountains()` in `mesh/mesh_features.js` iterates the `mounts` array from `buildRegion()`. For each mount, it samples the terrain height; if normalized height > 0.65, it generates a mountain tile (scaled XY by `r/3.5`, Y by `r*0.35`), otherwise a hill tile (Y by `r*0.18`). Hills use `HILL_PALETTE` (green) from `mesh/colors.js`, mountains use `HEIGHT_COLORS` (forest→rock→snow). Mountains and hills render at Y = 0.0 (base terrain is flat). Only the most prominent mounts (by peakHeight, top ~25 at 320 km scaled by area) are returned in the `mounts` array — all hills still shape the terrain height field.
- **Forests**: `buildMeshForests()` filters terrain vertices by normalized elevation (0.06–0.55), clusters points within 8 km radius (min 5 per cluster, centroid-growing algorithm), and places InstancedMesh forest groups using `generateForest()` from `mesh/mesh_tree.js` at cluster centroids, raised to terrain Y = 0.1. Tree appearance varies by biome via `BIOME_TREE` config (Taiga: tall trunk, narrow conical canopy, dark green; Rainforest: tall, large round canopy, deep green; Savanna: short trunk, wide flat canopy, yellow-green; Deciduous: medium, round, includes autumn hues).
- **Features resolution**: The features loop in `buildRegion()` resolves site/named-place/hazard/obstacle/area features into map objects using helpers: `placeSiteFeature()` (random land cell ≥15 km from cities/towns), `findCellsByTerrain()` (filters vertices by terrain type), and terrain-compatibility filters. Named places resolve as ruin or landmark (1d2 roll), site→ruin/dungeon/landmark each call `generatePlaceName()`, lair/dwelling pushes a trouble marker, hazard/obstacle/area roll terrain type and find matching cells with ≥15 km city/town exclusion. Outposts, landmarks, hazards, obstacles, and areas are returned in new arrays (`outpostSites`, `landmarkSites`, `hazards`, `obstacles`, `areas`) and rendered by `buildSiteFeatures()` in `mesh/mesher.js`.
**UI**: All user controls are powered by `lil-gui` (`src/gui/gui.js`). The GUI is initialized by `main.js` and exposes:
- **Template** folder: map template dropdown (island, archipelago, bay, fjord, lake, land)
- **Parameters** folder: Terrain (wetland/lowland/woodland/highland/wasteland), Climate (Arctic/Sub-arctic/Temperate/Sub-tropical/Tropical), Safety (Perilous/Dangerous/Unsafe/Safe → 0/1/2/3 cities), Map Size (50–400 km)
- **Actions** folder: New Island (new random seed), Update (re-draw with same seed + current GUI params)
- **Info** folder: read-only Seed display (auto-updates on generation)
A **Locations panel** (`gui/items.js`) sits on the left with a category select (Cities, Towns, Resources, Dungeons, Ruins, Landmarks, Outposts, Hazards, Obstacles, Areas, Trouble), a clickable item list (fly-to camera on click), and a Zoom Out button. Dungeons, Ruins, Landmarks display generated names where available. Hazards/obstacles/areas display their type; trouble displays danger type; factions display faction type and are bound to a random city/town.
The FPS counter remains as a DOM overlay in the bottom-right corner (`index.html`), while the seed display was removed from DOM and moved into the GUI Info panel.
