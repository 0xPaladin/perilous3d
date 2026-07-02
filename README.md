# Perilous 3D

A browser-based 3D terrain generator inspired by:

* [Perilous Wilds](https://www.drivethrurpg.com/en/product/407161/the-perilous-wilds-revised-edition) by Jason Lutes (Lampblack & Brimstone)
* [An Echo, Resounding](https://www.drivethrurpg.com/en/product/99063/an-echo-resounding-a-sourcebook-for-lordship-and-war) by Kevin Crawford (Sine Nomine Publishing)

Code inspiration:

* [Polygonal Map Generation for Games](http://www-cs-students.stanford.edu/~amitp/game-programming/polygon-map-generation/) by Amit Patel (Red Blob Games)
* [Perilous Shores](https://watabou.github.io/perilous-shores/) by Watabou
* [Azgaar's Fantasy Map Generator](https://github.com/Azgaar/Fantasy-Map-Generator)
* https://github.com/mewo2/terrain by Martin O'Leary

Perilous 3D generates a **50–400 km configurable** map (default 320×320 km) with biome shading on a flat base mesh and low-poly terrain features. It uses **Three.js** for rendering and interaction.

## Tech Stack

- **Three.js r185** — 3D rendering, `BufferGeometry`, `MeshLambertMaterial`, `OrbitControls`
- **d3-delaunay** — Delaunay triangulation + Voronoi diagram for mesh topology and cell-based terrain shaping
- **lil-gui** — floating control panel for user parameters and actions
- **simplex-noise** — seeded simplex noise for base terrain FBM generation
- **HTML5 import maps** — CDN-based dependency loading

## Architecture

```
index.html
└── src/
    ├── prng.js      — seedFromString (legacy, kept for main.js)
    ├── noise.js     — Perlin + FractalNoise (retained, unused by current pipeline)
    ├── grid.js      — Vec2, hex grid, DCEL (retained, unused by current pipeline)
    ├── raisers.js   — Skeleton/midpoint-displacement raisers (retained, unused)
    ├── core/
    │   ├── state.js           — RegionState + DisplayData JSDoc typedefs
    │   ├── voronoi.js         — Voronoi cell generation, nearest-centroid lookup, cell adjacency
    │   ├── terrain_commands.js   — Voronoi command execution (Land/Hill/Lake/Range/Trough)
    │   └── terrain_builder.js    — Voronoi pipeline orchestrator → display object
    ├── terrain/
    │   ├── config.js          — Constants: terrain/cmd maps, biome matrix, habitability,
    │   │                       trouble/feature types, site tables, place-name word lists,
    │   │                       VORONOI_TERRAIN_SCRIPTS and VORONOI_TEMPLATE_SCRIPTS
    │   ├── terrain.js         — buildRegion() entry point, calls buildDisplayFromState()
    │   │                       from terrain_builder.js, then mountain peaks + features
    │   │                       resolution. Returns { display, state }.
    │   ├── biomes.js           — buildBiomes() — sink fill → temperature → rivers → moisture → biome matrix
    │   ├── features.js         — generateFeatures() + resolveFeatures()
    │   └── coast.js            — Chaikin smoothing (retained, unused by current pipeline)
    ├── mesh/mesher.js        — Delaunay → Three.js BufferGeometry + vertex colors
    │                           + rivers + settlements + resources + ruins + trouble + site features
    ├── mesh/colors.js         — PS terrain palette
    ├── renderer.js            — Three.js scene, lights, clouds, OrbitControls, render loop
    ├── gui/ui.js              — progress overlay, seed display, URL sync
    ├── gui/gui.js             — lil-gui initialization
    ├── gui/items.js           — locations panel
    ├── mesh/mesh_noise.js     — Seeded Perlin (from meshDev)
    ├── mesh/mesh_mountain.js  — Mountain tile generator
    ├── mesh/mesh_terrain.js   — Hill & dune tile generators
    ├── mesh/mesh_tree.js      — Tree + InstancedMesh forest generator
    ├── mesh/mesh_features.js  — Places meshDev mountains & forests on terrain
    └── main.js                — Bootstrap: seed → buildRegion → createScene → animate → initGUI
```

## Terrain Generation Pipeline

### Voronoi Pipeline (current)

```
Seed → mulberry32 PRNG → random points scaled by map area (~3K min, ~15-20K at 320 km)
  → d3-delaunay triangulation → adjacency graph
  → Voronoi cells (~25 at 50 km, scales with area) uniformly distributed across extent
  → Terrain preset (pre + post) + template → VORONOI_TERRAIN_SCRIPTS + VORONOI_TEMPLATE_SCRIPTS
    → Parse commands (Scale/Land/Hill/Lake/Range/Trough) → processVoronoiCommands
      → Scale: sets terrainScale multiplier for hill/range heightRange (lowland=0.25, highland=1.5, etc.)
      → Land: BFS fill from seed cells, with optional noedge or cardinal-direction constraint.
              Each Land command creates an island group. Subsequent Land noedge commands
              avoid cells adjacent to existing island groups, keeping islands separate.
      → Hill: randomly tag land cells (pct% of land), sets heightBase=0.25, heightRange=1.25×scale
      → Lake: convert land cells back to water, optionally BFS from random start
      → Range/Trough: walk line between named locations, tag land cells along the line;
                       range tags as high (heightBase=0.25, heightRange=1.25×scale),
                       trough tags as water
  → Per-point simplex noise (FBM, 6 octaves, persistence 0.5, lacunarity 2.0, baseFreq 2.0, exponent 3)
  → Height mapping by cell type (0 is the water boundary):
      Water/lake/trough: -1 + simplex → [-1, 0]
      Land:             0.01 + simplex × 0.25 → [0.01, 0.26]
      Hill:             heightBase + simplex × heightRange → [0.25, 0.25+1.25×scale]
      Range:            heightBase + simplex × heightRange → [0.25, 0.25+1.25×scale]
  → Sink fill → rivers → moisture × terrain rainfall multiplier → temperature → biomes (Azgaar 5×26 matrix)
    → Habitability (biome × elevation × slope × water proximity, 0–125)
    → Mountain Peaks (glacier biome local maxima, top N by prominence)
    → Cities (top habitability sites, ≥32 km apart, coastal-biased)
    → Towns (3 per city ≤30 km radius or 4 standalone, ≥25 km apart, coastal-biased)
    → Resources (Max(#cities,2) biome-weighted deposits)
    → Great Ruins (1–2 abandoned sites near settlements, ≥30 km apart)
    → Minor Ruins (4+1d6 random obelisks on land, ≥20 km apart)
    → Trouble (1 per resource + safety-based markers, all ≥15 km from cities/towns)
    → Features (8+2d8 narrative features resolved into map objects)
```

### Per-Template Configuration

Each template is defined by a command script in `VORONOI_TEMPLATE_SCRIPTS` in `src/terrain/config.js`.

| Template      | Command approach                                              |
| ------------- | ------------------------------------------------------------ |
| `island`      | Land 45% interior + Hills + Range across center              |
| `archipelago` | Land 5% + 10% + 5% interior (3 passes, separate islands) + Hills |
| `bay`         | Land 60% east side + Hills                                   |
| `lake`        | Land 100% (full map) + Lake clusters in center               |
| `land`        | Land 100% (full map) + Hills + Range                         |

### Terrain Presets

Terrain scripts now use `{ pre: [...], post: [...] }` format — `pre` runs before the template, `post` after.

| Terrain    | pre (Scale) | post (terrain shaping) | Rainfall multiplier | Effect                                 |
| ---------- | ----------- | ---------------------- | ------------------- | -------------------------------------- |
| `wetland`  | `Scale 0.5` | `Lake 25 random`       | 1.5                 | Gentle terrain, many lakes, wettest    |
| `lowland`  | `Scale 0.25`| (none)                 | 0.8                 | Very flat terrain, moderate moisture   |
| `woodland` | `Scale 0.75`| `Hill 20 random`       | 1.2                 | Rolling hills, moist                   |
| `highland` | `Scale 1.5` | `Hill 30 random` + `Range 60 random random` | 1.0 | Tall hills + ridge, neutral moisture   |
| `wasteland`| `Scale 1.0` | (none)                 | 0.4                 | Flat, driest settings                  |

Land commands are exclusively in templates — terrain scripts only provide Scale, Hill, Lake, and Range/Trough.

### 3D Mesh

- Delaunay triangles used directly as geometry (low-poly aesthetic)
- `flatShading: true` for faceted look
- Vertex colors mapped by Azgaar 5×26 biome matrix (temperature × moisture → 13 biome types)
- Terrain mesh: land vertices at `rawHeight × 3.0` Y, water vertices flat at Y=0.0
- Mountain meshes are separate 3D tiles (procedural mountain/hill generators from meshDev) scaled by peak prominence, placed only on glacier-biome cells

## Running Locally

No build step — static files served from any HTTP server (ES modules require a server, not `file://`).

```bash
cd perilous3d
python -m http.server 8000
# open http://localhost:8000
```

### URL Parameters

```
?template=island&seed=ABCD1234&terrain=highland&climate=Temperate&safety=1&size=320
```

| Param       | Values                                                  | Description                                              |
| ----------- | ------------------------------------------------------- | -------------------------------------------------------- |
| `template`  | `island`, `archipelago`, `bay`, `lake`, `land`          | Map template (affects land/water distribution)           |
| `seed`      | any URL-safe string                                     | Deterministic map seed                                   |
| `terrain`   | `wetland`, `lowland`, `woodland`, `highland`, `wasteland` | Terrain preset (land%, hills, ranges, lakes)           |
| `climate`   | `Arctic`, `Sub-arctic`, `Temperate`, `Sub-tropical`, `Tropical` | Climate preset (base temperature)           |
| `safety`    | 0–3                                                     | Cities: Perilous(0) / Dangerous(1) / Unsafe(2) / Safe(3) |
| `size`      | 50–400                                                  | Map extent in km (default 320). Scales points, cells, mountains, cities, features by area |

## Controls

- **OrbitControls**: left-click rotate, right-click pan, scroll to zoom
- **lil-gui** (top-right panel):
  - **Template** → map template dropdown
  - **Parameters** → Terrain (wetland/lowland/woodland/highland/wasteland), Climate (Arctic/Sub-arctic/Temperate/Sub-tropical/Tropical), Safety (Perilous/Dangerous/Unsafe/Safe), Map Size (50–400 km)
  - **Actions** → `New Island`, `Update`
  - **Info** → current seed (read-only)
- **Locations panel** (left panel, below GUI): category select (Cities, Towns, Resources, Dungeons, Ruins, Landmarks, Outposts, Hazards, Obstacles, Areas, Trouble) → clickable item list → smooth fly-to camera; Zoom Out button returns to default view.

## Habitability & Settlements

### Habitability Score
Each terrain vertex is scored 0–125 based on:
- **Biome base** (`HABITABILITY[13]` — Temperate deciduous forest = 100, Glacier/Marine = 0)
- **Elevation gaussian** (favors `normH` 0.2–0.5, where `normH = height / maxLandH` with `maxLandH = 1.0` for voronoi terrain)
- **Slope penalty** (`max(0.4, 1 − slope×2)`)
- **Water proximity bonus** (+10 within ~3 hops of coast/river)
- **Coastal bias** (+20 extra for city selection)

### Cities
`findCities()` greedy-selects sites from the top 20% of habitability scores, shuffled for randomness, with **≥32 km** mutual separation. Coastal cells get an additional +20 score bonus, and resource proximity adds +15 within 15 km.

### Towns
`findTowns()` places either **4 standalone towns** (no cities present) or **3 per city** within a **30 km radius**. All towns enforce **≥25 km** mutual separation. Coastal bonus (+20 habitability) and resource proximity (+15 within 15 km) also applied.

### Settlement Rendering
`buildSettlements()` in `mesh/mesher.js` renders:
- **Cities**: stone keep (wide low cylinder) + tower + cone roof
- **Towns**: smaller single-wall hut + cone roof
All placed at terrain Y = `rawHeights[idx] × 3.0` (land) or 0.0 (water).

### Forest Clearing
`buildMeshForests()` skips any forest cluster whose centroid falls within **5 km** of a city or town, and **3 km** of a minor ruin, keeping settlements visually clear of tree cover.

### Resource Deposits
`generateResources()` picks **Max(#cities, 2) unique resource types** per region (at least 2), each placed at its biome-weighted best location, with **≥20 km** mutual separation enforced between deposits:
- **game/hide/fur** — Savanna, Grassland, Taiga, Tundra
- **timber/clay** — Temperate deciduous/rainforest, Taiga
- **herb/spice/dye** — Tropical seasonal/rainforest, Temperate rainforest
- **copper/tin/iron** — Cold desert, Taiga, Tundra (elevation bonus)
- **silver/gold/gems** — Cold desert, Taiga, Tundra (elevation bonus)
- **exotic** — Tropical seasonal/rainforest, Temperate rainforest, Wetland

Cities and towns receive a **+15 placement score bonus** when within **15 km** of a resource deposit, encouraging settlement near economically important sites.

Rendered as **gold octahedrons** (radius 1.2) floating Y = terrain + 2.0 in `buildResources()`.

### Great Ruins
`findRuins()` places **1–2 abandoned city sites** near existing settlements (within 60 km of any city/town), avoiding occupied cells (30 km exclusion) and enforcing **≥30 km** separation between ruins themselves. Rendered as clusters of **broken stone pillars** (gray cylinders of varying heights) in `buildSettlements()`.

### Minor Ruins
`findMinorRuins()` scatters **4 + 1d6 (5–10)** random **tall gray obelisks** anywhere on land with **≥20 km** separation. Rendered as `CylinderGeometry(0.3, 0.4, 3.5)` standing at terrain Y + 1.75.

### Trouble
`findTrouble()` places danger markers in two tiers (all cells ≥15 km from any city or town):
- **Resource trouble**: exactly **1 per resource** — the worst-habitability land cell within **~20 km** of each deposit
- **Safety-scaled extras**: `(3 − safety) × 2 × areaRatio` additional markers (scaled by map area; values shown for default 320 km)
  - **Perilous (0)**: 6 extras (default)
  - **Dangerous (1)**: 4 extras (default)
  - **Unsafe (2)**: 2 extras (default)
  - **Safe (3)**: 0 extras
  - Half land within **~30 km** of a city/town (worst habitability)
  - Half land directly on random ruin sites

Rendered as **inverted red pyramids** (`ConeGeometry` rotated π) in `buildTrouble()`.

### Regional Features
`generateFeatures()` in `terrain/features.js` generates `8 + 2d8` narrative features per region — prompts for the Judge to develop during play. Each feature is rolled `1d12 + safety`, mapping to:

- **1–4 Creature**: sub-type rolled 1d12 → Monster (legendary/extraplanar/undead/fearsome), Beast (water-going/airborne/earthbound), or Humanoid (rare/uncommon/common)
- **5 Hazard**: 1d10 category (unnatural → taint/magical/planar/divine; natural → oddity/tectonic/precipitous/ensnaring/defensive/meteorological/seasonal/impairing)
- **6 Obstacle**: 1d10 category (unnatural → magical/planar/divine; natural → oddity/defensive/impenetrable/penetrable/traversable)
- **7 Area**: 1d10 category (unnatural → magical/planar/divine; natural → oddity/hazard-based/obstacle-based/hunting ground/claimed territory/difficult terrain)
- **8 Named Place**: rolled from Random Place name tables (d12 template × d100 components)
- **9–11 Site**: 1d10 subcategory → dungeon, lair/dwelling, ruin, outpost, landmark, or resource (each with weighted sub-tables)
- **12 Faction Presence**: 1d10 faction type, 1d8 primary goal, 1d6 condition
- **13+ Settlement**: placeholder for settlement generation

Feature resolution is handled by `resolveFeatures()` in `terrain/features.js`, which receives terrain helpers from `terrain/terrain.js` via destructured params. Site/resource, site/ruin, site/dungeon, named place, site/landmark, and site/outpost features are resolved there. Hazard/obstacle/area features find matching terrain cells using `findCellsByTerrain()` and terrain-compatibility filters from `terrain/terrain.js`.

Outpost → `placeSiteFeature()` helper (random land cell ≥15 km from cities/towns, tracked for mutual separation). Landmark → `generatePlaceName()` + `placeSiteFeature()`, stored in `region.landmarkSites[]` with name. Named place → 1d2 roll: ruin (pushed to `region.minorRuins[]`) or landmark (pushed to `region.landmarkSites[]`). Lair/dwelling → pushes a trouble marker with type `'lair'` to `region.trouble[]`.

Hazard/obstacle/area features roll a terrain type (`land`/`mountains`/`hills`/`forest`/`river`/`water`), filter sub-type against terrain compatibility (checking `hazardCompatibleWithTerrain()` / `obstacleCompatibleWithTerrain()` / `areaCompatibleWithTerrain()`), then find matching cells via `findCellsByTerrain()` and place markers. Meteorological hazards are region-wide (no marker). Area markers include neighbor cells within ~3 km to suggest extent. All placed features enforce ≥15 km from any city or town and ≥10 km from other same-type markers.

Outpost, landmark, hazard, obstacle, and area data is stored in `region.outpostSites[]`, `region.landmarkSites[]`, `region.hazards[]`, `region.obstacles[]`, `region.areas[]` respectively, and rendered by `buildSiteFeatures()` in `mesh/mesher.js`:
- **Outpost**: gray stone cylinder + red cone roof tower (`CylinderGeometry(0.4,0.5,0.8)` + `ConeGeometry(0.5,0.3)`)
- **Landmark**: cyan emissive pillar (`CylinderGeometry(0.2,0.3,1.5)`, emissive color `0x44ddff`)
- **Hazard**: orange inverted pyramid (`ConeGeometry(0.6,1.0,4)`, color `0xdd6633`)
- **Obstacle/Area**: amber pillars (`CylinderGeometry(0.2,0.3,1.2)`, color `0xbb8844`); area includes neighbor markers

## Algorithm Notes

**PRNG** — Mulberry32 seeded RNG for deterministic generation (embedded in `terrain/terrain.js`).

**Delaunay Triangulation** — [d3-delaunay](https://github.com/d3/d3-delaunay) provides mesh topology from random points (scales with map area: ~3K minimum, ~15–20K at 320 km, ~23–31K at 400 km) plus Voronoi diagram for cell-based terrain shaping.

**Voronoi Cells** — `generateVoronoiCells()` in `src/core/voronoi.js` generates uniformly distributed centroid points across the extent. Cell count: `max(25, floor(25 × areaRatio))` — 25 at 50 km (areaRatio = 0.024), 25 at 320 km (areaRatio = 1.0), 39 at 400 km (areaRatio = 1.56). Each cell starts as type `water`. Commands tag cells with terrain types (land/hill/lake/range/trough). Each point in the display `pts` array maps to the nearest cell centroid for height assignment.

**Voronoi Commands** — Executed by `processVoronoiCommands()` in `src/core/terrain_commands.js`:

| Command | Behavior |
| ------- | -------- |
| `Scale` | Sets terrainScale multiplier for hill/range heightRange. Applied as `heightRange = 1.25 × scale`. |
| `Land` | BFS fill from seed cells. With `noedge` constraint, only non-edge cells are candidates (seed prefers cell nearest origin, falls back to random); with cardinal direction, only cells in that direction's edge region (beyond 65% of half-extent) are seeded and expanded inward. Each Land command creates an island group — subsequent `Land noedge` excludes neighbor cells of existing groups. |
| `Hill` | Tags `pct`% of existing land cells. `placement=random` shuffles and picks; `placement=neighbors` BFS from a random land cell. Sets `heightBase=0.25`, `heightRange=1.25×scale`. |
| `Lake` | Converts `pct`% of land cells back to water. `placement=neighbors` BFS from a random land cell. |
| `Range` | Walks the line between `start` and `stop` named locations (topleft/top/topright/left/center/right/bottomleft/bottom/bottomright/random). Tags `pct`% of land cells along the line as `range` type. Sets `heightBase=0.25`, `heightRange=1.25×scale`. Range/trough continues past water cells — the walk doesn't stop at water, it just doesn't tag them; cells on the far shore are eligible. |
| `Trough` | Same as Range but tags cells as water instead of high terrain. |

**Base Terrain (Simplex Noise)** — `generateSimplexForPts()` in `src/core/terrain_builder.js` generates per-point noise using 6 octaves of simplex noise (`simplex-noise` library). Each octave uses an independent seeded `SimplexNoise` instance (mulberry32 PRNG). Noise values are normalized 0–1 per octave, averaged, then redistributed via `pow(e, 3)`. Parameters: `octaves=6`, `persistence=0.5`, `lacunarity=2.0`, `baseFreq=2.0`, `exponent=3`. Octave seeds: `(seed ^ 0xABCD) + o × 7919`.

**Height Mapping** — Per-point heights are computed from simplex noise scaled by the point's voronoi cell type. Water boundary is always **0** — cells with height ≤ 0 are water, cells with height > 0 are land:

| Cell type | Height range | Formula |
| --------- | ------------ | ------- |
| `water` / `lake` / `trough` | [-1, 0] | `-1 + simplex` |
| `land` | [0.01, 0.26] | `0.01 + simplex × 0.25` |
| `hill` | [0.25, 0.25+1.25×scale] | `heightBase + simplex × heightRange` where `heightBase=0.25`, `heightRange=1.25×scale` |
| `range` | [0.25, 0.25+1.25×scale] | `heightBase + simplex × heightRange` where `heightBase=0.25`, `heightRange=1.25×scale` |

No quantile-based sea level cut, no erosion, no coast cleaning, no island mask. Height ranges: land `0.01–0.26`, hill/range `0.25–0.25+1.25×scale`.

**Height Normalization** — All height-relative calculations (temperature lapse, biome thresholds, mountain classification, feature-terrain typing, resource elevation bonuses, habitability scoring) use a **fixed reference** of `maxLandH = 1.0` (since waterLevel is 0). Normalized height is `normH = Math.min(height / 1.0, 1.0)`, effectively `normH = height` capped at 1.0. This keeps classification straightforward — a land cell at height 0.55 has normH 0.55.

**Rivers** — Downhill flow accumulation on the Delaunay graph (`computeRivers()` in `terrain/biomes.js`). Each land point starts with unit flow, accumulates downstream via sorted height traversal. Points in the top 10% of accumulated flow become river channels. River segments follow downhill edges between river points and are rendered as blue `LineSegments` slightly above the terrain surface, with width proportional to √flux.

**Moisture** — Azgaar-style two-phase computation (`computeMoisture()` in `terrain/biomes.js`). Phase A: BFS from rivers (10), ocean (8), and coast-adjacent land (7) with exponential decay (0.94× per hop inland). Phase B: neighbor averaging with river flux bonus (`4 + mean(raw + max(flux/10, 2), neighbors)`). Output range ~4–50. Final moisture is multiplied by the terrain's **rainfall multiplier** (`VORONOI_TERRAIN_RAINFALL` in `config.js`): wetland=1.5, woodland=1.2, highland=1.0, lowland=0.8, wasteland=0.4.

**Temperature** — `computeTemperature()` in `terrain/biomes.js`. Base temp parameter ±0.5°C latitudinal gradient across map extent (south hot / north cold) with elevation lapse rate (−10°C max) computed against `maxLandH = 1.0`. Mapped to Azgaar's 26-band scale: `tempBand = round(clamp(20 − t, 0, 25))`.

**Biomes** — `biomeFromMatrix()` in `terrain/biomes.js` uses Azgaar's exact 5×26 biome matrix (5 moisture bands × 26 temperature bands). Overrides: `normH ≤ 0` → Marine (0), `normH > 0.80` → Glacier (11). Produces 13 biomes: Marine, Hot desert, Cold desert, Savanna, Grassland, Tropical seasonal forest, Temperate deciduous forest, Tropical rainforest, Temperate rainforest, Taiga, Tundra, Glacier, Wetland. Colors looked up via `BIOME_COLORS[13]` array in `mesh/mesher.js`.

**Mountain Peak Discovery** — `findMountainPeaks()` in `terrain/terrain.js` scans the final height field for local maxima, restricted to **glacier biome cells** (biome index 11, which covers vertices where `normH > 0.80`). Each land vertex above `HILL_THRESHOLD(0.65)` normalized height is checked against its adjacency neighbors. True peaks are sorted by height, and the top `max(5, round(25 × areaRatio))` are returned as `{x, y, r, peakHeight, _idx}` for 3D mesh rendering. Peak radius: `r = 3 + (normH − HILL_THRESHOLD) × 8`.

**Forests** — `buildMeshForests()` in `mesh/mesh_features.js` filters terrain vertices by height (0.06–0.55) against `maxLandH = 1.0`, then applies a biome-index density lookup (`FOREST_DENSITY` array) with a 0.5 survival multiplier. Candidate points are clustered using a centroid-growing algorithm (8 km radius, min 5 per cluster). Each cluster centroid receives an InstancedMesh forest group via `generateForest()` from `mesh/mesh_tree.js`, which varies tree appearance by dominant biome (Taiga: tall trunk, narrow conical canopy, dark green; Rainforest: tall, large round canopy, deep green; Savanna: short trunk, wide flat canopy, yellow-green; Deciduous: medium, round, includes autumn hues).

**Great Ruins** — `findRuins()` in `terrain/terrain.js` picks 1–2 high-habitability land cells near existing settlements (within 60 km), avoiding occupied city/town cells (30 km exclusion) and enforcing ≥30 km separation between ruins themselves. Rendered as clusters of broken stone pillars in `buildSettlements()`.

**Minor Ruins** — `findMinorRuins()` scatters 4 + 1d6 (5–10) tall gray obelisks at random land cells, spaced ≥20 km apart, count scaled by map area. Rendered as `CylinderGeometry(0.3, 0.4, 3.5)` standing at terrain Y + 1.75.

**Trouble** — `findTrouble()` in `terrain/terrain.js` places danger markers: exactly 1 per resource (worst habitability within ~20 km), plus safety-scaled extras (scaled by map area) — Perilous=6, Dangerous=4, Unsafe=2, Safe=0 at default 320 km. Half the extras land within ~30 km of a city/town (worst habitability), the other half on random ruin sites. All trouble cells are ≥15 km from any city or town. Lair/dwelling features from the resolution loop also push a `'lair'` trouble marker. Rendered as inverted red pyramids (`ConeGeometry` rotated π) in `buildTrouble()`.

**3D Mountains** — `buildMeshMountains()` in `mesh/mesh_features.js` iterates the `mounts` array from `buildRegion()`. For each mount, if normalized height > 0.65, it generates a mountain tile (scaled XY by `r/3.5`, Y by `r*0.35`), otherwise a hill tile (Y by `r*0.18`). Hills use `HILL_PALETTE` (green) from `mesh/colors.js`, mountains use `HEIGHT_COLORS` (forest→rock→snow). Mountains and hills use `MeshStandardMaterial` with `flatShading: true` and vertex colors. Rendered at Y = 0.0 (base terrain is at Y = `rawHeight × 3.0`).

**Scale** — Extent configurable 50–400 km (default 320). Camera, lights, and clouds scale via `s = extentSize / 320`. Voronoi cell count, point count, mountain count, settlement counts, and trouble marker counts all scale via `areaRatio = (extentSize / 320)²`.

## Response Format

`buildRegion()` returns `{ display, state }`:

```js
display = {
  pts, triangles, halfedges, adj,        // mesh geometry
  heights, rawHeights, heightMin, heightMax, // height field (heights = sink-filled Float64Array)
  extent, waterLevel: 0,                 // map bounds; waterLevel always 0 for voronoi
  temperature, tempBand, moisture, biome, // climate data (per-vertex)
  rivers: { segments, flux, dh },        // river network
  habitability, nearWater,               // settlement suitability
  mountainCount, mounts,                 // mountain peaks [{ x, y, r, peakHeight, _idx }]
}

state = {
  seed, extent, waterLevel, template, terrain, baseTemp, cityCount,
  cities, towns, resources, ruins, minorRuins, trouble, features,
  outpostSites, landmarkSites, factionSites, hazards, obstacles, areas,
  peoples,
}
```

## License

MIT
