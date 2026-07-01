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
    ├── terrain/
    │   ├── config.js       # Constants: terrain/cmd maps, biome matrix, habitability, trouble/feature types,
    │   │                    # site tables, magic/elements/faction tables, place-name word lists, etc.
    │   ├── terrain.js      # FULL PIPELINE orchestration:
    │   │                    #   Terrain state commands (Scale/Rainfall/Radius/Ratio) + template scripts
    │   │                    #   (Hill/Pit/Range/Trough/IslandMask/Apply) → parseCommand → processTerrainCommands
    │   │                    #   Step 1: generateSimplexBase — FBM (6 octaves, persistence 0.5, lacunarity 2.0,
    │   │                    #     baseFreq 2.0) + redistribution (pow(e*1.2, 2.5)) → 0-1 height field
    │   │                    #   Step 2: Feature uplift → delegates to processTerrainCommands
    │   │                    #   Step 3: Manhattan distance island mask (|x|+|y| diamond shape, smoothstep)
    │   │                    #   Step 4: Water level fixed at 0.5; sink fill for rivers
    │   │                    #   + biomes delegated to buildBiomes() in biomes.js
    │   │                    #   + habitability + cities/towns/resources/trouble/ruins/minorRuins
    │   │                    #   + feature resolution delegated to resolveFeatures() in features.js
    │   │                    #   + mountain peak discovery delegated to findMountainPeaks()
    │   │                    #   Exports buildRegion() plus helpers: findMountainPeaks, findCities, findTowns, findRuins,
    │   │                    #   findMinorRuins, findTrouble, placeSiteFeature, findCellsByTerrain,
    │   │                    #   hazard/obstacle/areaCompatibleWithTerrain, rollFeatureTerrain,
    │   │                    #   findNeighborCells, computeNearResource, generateResources
    │   ├── biomes.js        # Biome pipeline (extracted from terrain.js):
    │   │                    #   buildBiomes(h, ctx) − sink fill → temperature → rivers → moisture → biome matrix
    │   │                    #   Helpers: downhill, zero, fillSinks, computeTemperature, biomeFromMatrix,
    │   │                    #   computeMoisture, computeRivers
    │   ├── features.js      # Feature generation + resolution:
    │   │                    #   generateFeatures(safety, extentSize, rng) — rolls 8+2d8 narrative features
    │   │                    #   resolveFeatures({...}) — cities/towns/ruins/trouble/resources + feature loop
    │   │                    #   Constants imported from config.js (MAGIC_TYPES, ELEMENTS, FACTION_TYPES,
    │   │                    #   PLACE_NAMES, SITE_*_TYPES, etc.)
    │   │                    #   Depends on helpers imported from terrain.js
    │   └── coast.js         # Chaikin smoothing (retained, unused by current pipeline)
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
- **terrain/terrain.js** exports `buildRegion(template, cols, rows, seed, terrain, baseTemp, cityCount, extentSize = 320)` → returns `{ pts, triangles, heights, heightMin, heightMax, extent, waterLevel, mounts, rivers, moisture, temperature, tempBand, biome, habitability, nearWater, cities, towns, resources, ruins, minorRuins, trouble, features, outpostSites, landmarkSites, factionSites, hazards, obstacles, areas, ... }` where `mounts` is an array of `{ x, y, r, peakHeight, _idx }` for each mountain/hill feature (discovered by `findMountainPeaks()` scanning the final height field for local maxima above `HILL_THRESHOLD(0.65)`, top `max(5, round(25×areaRatio))` by prominence); `rivers` has `segments` (downhill edges) and `flux` (flow accumulation); `moisture` has per-vertex values in ~4–50 range (× terrain rainfall); `biome` has per-vertex Azgaar biome indices (0–12); `habitability` is a Float64Array (~0–125) scoring how suitable each cell is for towns; `nearWater` is a Uint8Array marking cells within ~3 hops of a coast/river; `cities` is `[{ x, z, idx, habitability }]` top-sorted land cells spaced ≥32 km apart, coastal-biased; `towns` is the same shape, placed ≤30 km from parent city (3 per city) or 4 standalone sites when 0 cities exist, spaced ≥25 km apart, coastal-biased; `resources` is `[{ x, z, idx, type }]` for Max(#cities,2) biome-weighted mineral/food deposits; `ruins` is `[{ x, z, idx, name }]` for 1–2 elevated habitability sites near settlements (dungeon resolution adds `name`); `minorRuins` is `[{ x, z, idx, name }]` for 4+1d6 random obelisks anywhere on land (site→ruin and named→ruin resolution add `name`); `trouble` is `[{ x, z, idx, type }]` danger markers (1 per resource + safety-scaled extras near settlements/ruins, all ≥15 km from cities/towns, type drawn from TROUBLE_TYPES table); `factionSites` is `[{ x, z, idx, faction }]` for faction presence features bound to a city/town
- Heights are 0–1+ (simplex noise + feature uplift); water level is 0.5 (hardcoded, UI slider planned). All height normalization uses the fixed reference `1.0 - waterLevel` (not map max), capped at 1.0
- **mesh/mesher.js** flattens terrain to `Y = 0.1` for land and `Y = 0.0` for water; river lines float above at `0.2` (land) / `0.05` (water); biome colors are still derived from the original height field; settlements render as procedural Three.js meshes added to a `settlements` group
- Colors are linear RGB `[0-1]` floats; vertex colors assigned by Azgaar 5×26 biome matrix (temperature × moisture) in `terrain/terrain.js` → `BIOME_COLORS` lookup in `mesh/mesher.js`
- **mesh/mesh_features.js** places meshDev 3D meshes on the terrain surface using the `mounts` array for peak positions and nearest-neighbor terrain height lookup; skips forest clusters within **5 km** of any city or town so they stay visible
- **mesh/mesh_mountain.js**, **mesh/mesh_terrain.js`, **mesh/mesh_tree.js` use `MeshStandardMaterial` with `flatShading: true`, `vertexColors: true`; import `three` via importmap
- No external APIs, no build tooling, no bundler — keep it that way unless asked

## Key Extension Points

| What you want to do              | Where to look                                                                                                                                                                             |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tune mountain peak count         | `terrain/terrain.js` → `findMountainPeaks()` — `maxMounts = max(5, round(25×areaRatio))` controls number of 3D mountain meshes; `HILL_THRESHOLD(0.65)` controls minimum prominence. Indirectly tuned via terrain preset height scale and template scripts.          |
| Tune mountain/hill size          | `terrain/terrain.js` → `generateHillFeatures()` → `diameter: runif(8, 22, rng)` for hills, × `sizeScale × state.radiusScale`. Ridge peak radius: `runif(3, 6, rng)` in `generateRidgeFeature()`, both × `sizeScale × state.radiusScale`; effective height via `state.scale` (set by Scale command) / radius via `state.radiusScale` (set by Radius command) |
| Change mountain shape            | Hills: linear taper `1 - d/r` within radius, no skirt. Ridges: Gaussian cross-section (kept from original). Tune via hill/range height parameters in templates |
| Tune mountain range curvature    | `terrain/terrain.js` → `generateRidgeFeature()` — start/end endpoints define the line; auto-derives `peakCount = ridgeLen/peakSpacing` and `nSpurs = ridgeLen/spurInterval`; `wiggleAmp`, `wiggleFreq`, `wigglePhase` control the sinusoidal ridge centerline                                |
| Tune range/trough count via size | Add `Ratio <value>` before `Range`/`Trough` in template scripts to scale counts by `size/300` (default) or an explicit multiplier. Values apply to subsequent `Hill`/`Pit`/`Range`/`Trough` until changed.                                                                 |
| Tune base noise frequency        | `terrain/terrain.js` → `generateSimplexBase()` — `baseFreq` (2.0), `exponent` (2.5), `persistence` (0.5), `fudge` (1.2)                                                                   |
| Adjust water level               | `terrain/terrain.js` → `buildRegion()` — `waterLevel = 0.5` (hardcoded, planned as UI slider)                                                                                            |
| Tweak biome computation          | `terrain/biomes.js` → `buildBiomes(h, ctx)` — sink fill → temperature → rivers → moisture → biome matrix; helpers: `downhill`, `zero`, `fillSinks`, `computeTemperature`, `biomeFromMatrix`, `computeMoisture`, `computeRivers` |
| Tune temperature / moisture      | `terrain/biomes.js` → `computeTemperature()`, `computeMoisture()`                                                                                                                        |
| Tweak feature-generator tables   | `terrain/config.js` → `MAGIC_TYPES`, `ELEMENTS`, `FACTION_TYPES`, `PRIMARY_GOALS`, `CONDITIONS`, `PLACE_NAMES`, `PLACE_ADJECTIVES`, `PLACE_NOUNS`, `SITE_*_TYPES`                         |
| Tune feature resolution logic    | `terrain/features.js` → `resolveFeatures()` — receives terrain helpers via destructured params, resolves generated features into map objects (resources/cities/towns/ruins/trouble/hazards/obstacles/areas) |
| Give generated places names      | `terrain/features.js` exports `generatePlaceName(rng)`; `resolveFeatures()` uses it for ruins, landmarks, dungeons, named places                                                           |
| Generate regional features       | `terrain/features.js` → `generateFeatures(safety, extentSize, rng)` — 8+2d8 rolls of 1d12+safety: creature/hazard/obstacle/area/named place/site/faction presence/settlement, each with generator sub-tables |
| Feature terrain compatibility     | `terrain/terrain.js` exports `hazardCompatibleWithTerrain()`, `obstacleCompatibleWithTerrain()`, `areaCompatibleWithTerrain()`, `rollFeatureTerrain()`, `findNeighborCells()`             |

## Algorithm Notes (abridged)

- **PRNG**: Mulberry32 (embedded in `terrain/terrain.js`), seeded from `seedFromString()` via `prng.js`
- **Triangulation**: Delaunator — points scale with map area (3K minimum, ~15–20K at 320 km, ~23–31K at 400 km) → indexed triangle mesh
- **Base terrain**: `generateSimplexBase()` — FBM with 6 octaves using `simplex-noise` library. 6 independent seeded SimplexNoise instances (one per octave, mulberry32 PRNG). Normals rescaled 0–1, redistributed via `pow(e * 1.2, 2.5)` to create flat valleys. Base frequency 2.0 means ~2 major features across the map.
- **Feature uplift**: `processTerrainCommands()` runs on top of the simplex base. Supported commands:
  - `Hill <count>, <height>, <xRange>, <yRange>` — circular hill with linear taper `1 - d/r`.
  - `Pit <count>, <depth>, <xRange>, <yRange>` — circular depression (negative height).
  - `Range <count>, <height>, <xRange>, <yRange>` — sinusoidal ridgeline with spurs, Gaussian cross-section.
  - `Trough <count>, <depth>, <xRange>, <yRange>` — ridgeline depression.
  - `Apply` — flush accumulated feature queue into height field.
  - `Scale <value>` — set global height multiplier (`state.scale`).
  - `Rainfall <value>` — set global rainfall multiplier (`state.rainfall`).
  - `Radius <value>` — set radius multiplier (`state.radiusScale`) for Hill/Pit/Range/Trough.
  - `IslandMask <mix>` (optional, default `0.5`) — apply Manhattan-distance island shaping (`(|x|+|y|)` diamond + smoothstep).
  - `xRange`/`yRange` are 0–100 placement bounds. Hill/Pit diameters: `runif(8, 22) × sizeScale × radiusScale`. Ridge peak radii: `runif(3, 6) × sizeScale × radiusScale`.
- **Island shape**: Manhattan distance mask (`(|nx| + |ny|)/2`) with smoothstep multiplicative falloff `1−t²(3−2t)`. Diamond-shaped islands without angular perturbation. Per-template radius: island 0.44, archipelago 0.40, land 5.0 (effectively no clip).
- **Water level**: Fixed at 0.5. No quantile-based sea level cut, no erosion, no coast cleaning, no template-specific carving (fjord/lake/bay/landclamp removed). All height normalization uses the fixed `1.0 - waterLevel` reference (not map max), capped at 1.0.
- **Sink filling**: Kept so rivers flow correctly.
- **Scale**: Extent configurable 50–400 km (default 320), HEIGHT_SCALE 3.5 km, camera scales with extent
- **Clouds**: IcosahedronGeometry blobs at Y=80-120, drift slowly eastward
- **Rivers**: Downhill flow accumulation on the Delaunay graph (`computeRivers()` in `terrain/biomes.js`). Land points start with unit flow, accumulate downhill via sorted height traversal. Points in the top 10% of accumulated flow become river channels. River segments follow downhill edges between river points and are rendered as flat blue quads (width ∝ √flux) at Y = 0.2 (land) / 0.05 (water) via `buildRiverMesh()` in `mesh/mesher.js`, avoiding the flat terrain plane at Y = 0.1 / 0.0.
- **Moisture**: Azgaar-style two-phase computation (`computeMoisture()` in `terrain/biomes.js`). Phase A: BFS from rivers (10), ocean (8), and coast-adjacent land (7) with exponential decay (0.94× per hop inland). Phase B: neighbor averaging with river flux bonus (`4 + mean(raw + max(flux/10,2), neighbors)`). Output range ~4–50, stored in `region.moisture`.
- **Temperature**: `computeTemperature()` in `terrain/biomes.js`. Base temp ±2°C latitudinal gradient (south hot, north cold) with elevation lapse rate (−10°C max) against the fixed `1.0 - waterLevel` reference. Mapped to Azgaar's 26-band scale: `tempBand = round(clamp(20 − t, 0, 25))`. Stored in `region.temperature` and `region.tempBand`.
- **Biomes**: `biomeFromMatrix()` in `terrain/biomes.js` uses Azgaar's exact 5×26 biome matrix (5 moisture bands × 26 temperature bands). Overrides: normH ≤ 0 → Marine (0), normH > 0.80 → Glacier (11), using `effectiveNormH = Math.min(normH, 1.0)` against the fixed `1.0 - waterLevel` reference. Produces 13 biomes: Marine, Hot desert, Cold desert, Savanna, Grassland, Tropical seasonal forest, Temperate deciduous forest, Tropical rainforest, Temperate rainforest, Taiga, Tundra, Glacier, Wetland. Stored per-vertex in `region.biome`. Colors looked up via `BIOME_COLORS[13]` array in `mesh/mesher.js`.
- **Habitability**: `computeHabitability()` blends biome base scores (`HABITABILITY[13]` from Azgaar), elevation gaussian (favors 0.2–0.5 normH against fixed `1.0 - waterLevel` reference), slope penalty (`max(0.4, 1−slope×2)`), and a +10 bonus for cells within ~3 hops of coast/river. Output range ~0–125. Stored per-vertex in `region.habitatability` and used to rank settlement candidates.
- **Cities**: `findCities()` picks the top habitability land cells from a shuffled 20%-top candidate pool, greedy-selecting sites with ≥32 km separation. Coastal cells get a +20 score bonus. Resource proximity adds +15 within 15 km.
- **Towns**: `findTowns()` places either 4 standalone towns (no cities) or 3 towns per city within a 30 km radius. All towns enforce ≥25 km mutual separation. Coastal bonus (+20 habitability) applied. Resource proximity (+15) also applied.
- **Resources**: `generateResources()` picks 2–4 unique resource types per region (from `RESOURCE_TYPES[6]`), one per deposit. Each type has a biome-weighted favor map (`RESOURCE_BIOME_WEIGHT`) so deposits land in appropriate terrain (e.g., timber in forests, metals in highlands/cold). Metals also get an elevation bonus. Returns `[{x, z, idx, type}]` in `region.resources`.
- **Settlements (meshing)**: `buildSettlements()` in `mesh/mesher.js` renders cities as a stone keep (wide low cylinder) + tower + cone roof, and towns as a smaller single-wall hut + cone roof. All placed at Y = 0.1 (land flat height).
- **Resource markers**: `buildResources()` in `mesh/mesher.js` places a gold octahedron (radius 1.2) floating at Y = terrain + 2.0 above each resource deposit.
- **Forest clearing**: `buildMeshForests()` in `mesh/mesh_features.js` skips placing any forest cluster whose centroid falls within **5 km** of any city or town position, keeping settlements visually unobstructed.
- **Great ruins**: `findRuins()` picks 1–2 elevated habitability sites near existing settlements (within 60 km), avoiding occupied city/town cells (30 km exclusion) and enforcing ≥30 km separation between ruins themselves. Rendered as broken stone pillar clusters in `buildSettlements()`.
- **Minor ruins**: `findMinorRuins()` places 4 + 1d6 (5–10) random tall gray obelisks anywhere on land, ≥20 km apart, count scaled by map area. Rendered as tall `CylinderGeometry(0.3, 0.4, 3.5)` standing at terrain Y + 1.75.
- **Trouble**: `findTrouble()` creates danger markers: exactly 1 per resource (worst habitability cell within ~20 km), plus safety-scaled extras (scaled by map area) — Perilous=6, Dangerous=4, Unsafe=2, Safe=0 at default 320 km. Half the extras land within ~30 km of a city/town (worst habitability), the other half on random ruin sites. All trouble cells are ≥15 km from any city or town. Lair/dwelling features also push a trouble marker with type `'lair'`. Rendered as inverted red pyramids (`ConeGeometry` rotated π) in `buildTrouble()`.
- **meshDev Mountains**: `buildMeshMountains()` in `mesh/mesh_features.js` iterates the `mounts` array from `buildRegion()`. For each mount, it samples the terrain height; if normalized height > 0.65, it generates a mountain tile (scaled XY by `r/3.5`, Y by `r*0.35`), otherwise a hill tile (Y by `r*0.18`). Hills use `HILL_PALETTE` (green) from `mesh/colors.js`, mountains use `HEIGHT_COLORS` (forest→rock→snow). Mountains and hills render at Y = 0.0 (base terrain is flat). Mounts are discovered by `findMountainPeaks()` in `terrain.js`, which scans the final height field for local maxima above `HILL_THRESHOLD(0.65)` against the fixed `1.0 - waterLevel` reference and returns the top `max(5, round(25×areaRatio))` peaks — all features still shape the terrain height field.
- **Forests**: `buildMeshForests()` filters terrain vertices by normalized elevation (0.06–0.55 against fixed `1.0 - waterLevel` reference), clusters points within 8 km radius (min 5 per cluster, centroid-growing algorithm), and places InstancedMesh forest groups using `generateForest()` from `mesh/mesh_tree.js` at cluster centroids, raised to terrain Y = 0.1. Tree appearance varies by biome via `BIOME_TREE` config (Taiga: tall trunk, narrow conical canopy, dark green; Rainforest: tall, large round canopy, deep green; Savanna: short trunk, wide flat canopy, yellow-green; Deciduous: medium, round, includes autumn hues).
- **Features resolution**: The features loop in `buildRegion()` delegates to `resolveFeatures()` in `terrain/features.js`, which resolves generated features into map objects. It receives terrain helpers via destructured params (e.g., `placeSiteFeature()`, `findCellsByTerrain()`, terrain-compatibility filters). Named places resolve as ruin or landmark (1d2 roll), site→ruin/dungeon/landmark each call `generatePlaceName()`, lair/dwelling pushes a trouble marker, hazard/obstacle/area roll terrain type and find matching cells with ≥15 km city/town exclusion. Outposts, landmarks, hazards, obstacles, and areas are returned in new arrays (`outpostSites`, `landmarkSites`, `hazards`, `obstacles`, `areas`) and rendered by `buildSiteFeatures()` in `mesh/mesher.js`.
**UI**: All user controls are powered by `lil-gui` (`src/gui/gui.js`). The GUI is initialized by `main.js` and exposes:
- **Template** folder: map template dropdown (island, archipelago, bay, fjord, lake, land)
- **Parameters** folder: Terrain (wetland/lowland/woodland/highland/wasteland), Climate (Arctic/Sub-arctic/Temperate/Sub-tropical/Tropical), Safety (Perilous/Dangerous/Unsafe/Safe → 0/1/2/3 cities), Map Size (50–400 km)
- **Actions** folder: New Island (new random seed), Update (re-draw with same seed + current GUI params)
- **Info** folder: read-only Seed display (auto-updates on generation)
A **Locations panel** (`gui/items.js`) sits on the left with a category select (Cities, Towns, Resources, Dungeons, Ruins, Landmarks, Outposts, Hazards, Obstacles, Areas, Trouble), a clickable item list (fly-to camera on click), and a Zoom Out button. Dungeons, Ruins, Landmarks display generated names where available. Hazards/obstacles/areas display their type; trouble displays danger type; factions display faction type and are bound to a random city/town.
The FPS counter remains as a DOM overlay in the bottom-right corner (`index.html`), while the seed display was removed from DOM and moved into the GUI Info panel.
