# Perilous 3D

A browser-based 3D terrain generator inspired by: 

* [Perilous Wilds](https://www.drivethrurpg.com/en/product/407161/the-perilous-wilds-revised-edition) by Jason Lutes (Lampblack & Brimstone)
* [An Echo, Resounding](https://www.drivethrurpg.com/en/product/99063/an-echo-resounding-a-sourcebook-for-lordship-and-war) by Kevin Crawford (Sine Nomine Publishing)

Code inspiration:

* [Polygonal Map Generation for Games](http://www-cs-students.stanford.edu/~amitp/game-programming/polygon-map-generation/) by Amit Patel (Red Blob Games)
* [Perilous Shores](https://watabou.github.io/perilous-shores/) by Watabou
* [Azgaar's Fantasy Map Generator](https://github.com/Azgaar/Fantasy-Map-Generator)
* https://github.com/mewo2/terrain by Martin O'Leary

Perilous 3D generates a  **50–400 km configurable** map (default 320×320 km) with biome shading on a flat base mesh and low-poly terrain features. It uses **Three.js** for rendering and interaction.  

## Tech Stack

- **Three.js r185** — 3D rendering, `BufferGeometry`, `MeshLambertMaterial`, `OrbitControls`
- **Delaunator** — Delaunay triangulation (mesh topology for 3D terrain)
- **lil-gui** — floating control panel for user parameters and actions
- **Mulberry32 / ChanceJS** — seeded PRNG for deterministic generation
- **HTML5 import maps** — CDN-based dependency loading

## Architecture

```
index.html
└── src/
    ├── prng.js      — seedFromString (legacy, kept for main.js)
    ├── noise.js     — Perlin + FractalNoise (retained, unused by current pipeline)
    ├── grid.js      — Vec2, hex grid, DCEL (retained, unused by current pipeline)
    ├── raisers.js   — Skeleton/midpoint-displacement raisers (retained, unused)
    ├── terrain/terrain.js   — full pipeline (queue-based command architecture):
    │                      Terrain state commands (Scale/Rainfall) + template scripts
    │                      (Hill/Range/Apply/Mask/SeaLevel/Fjord/Lake/Bay/LandClamp)
    │                      → parseCommand → processTerrainCommands
    │                      → Delaunay mesh → cartoon mountains → island mask → peaky →
    │                      hydraulic erosion → fjord/lake/bay/land features → sea-level →
    │                      sink-fill → coast clean
    │                      + habitability scoring + cities/towns placement + resource deposits
    ├── terrain/coast.js     — Chaikin smoothing (retained, unused by current pipeline)
      ├── mesh/mesher.js    — Delaunay triangles → Three.js indexed BufferGeometry
     │                      + per-vertex biome colors (Azgaar 5×26 temperature × moisture matrix)
     │                      + river mesh (LineSegments along downhill edges, width ∝ √flux)
     │                      + settlement rendering (cities + towns) + resource markers (gold octahedrons)
     │                      + ruins (stone pillar clusters) + minor ruins (tall gray obelisks)
     │                      + trouble markers (inverted red pyramids)
     │                      + site features: outpost tower, cyan landmark pillar, orange hazard pyramid,
     │                        amber obstacle/area pillars
    ├── mesh/colors.js    — PS terrain palette (used by mountain & hill tile color palettes)
    ├── renderer.js  — Three.js scene, HemisphereLight + DirectionalLight (shadows),
     │                      cloud blobs (IcosahedronGeometry at Y=80–120), OrbitControls,
     │                      render loop with FPS counter
    ├── gui/ui.js         — progress overlay, seed display, URL sync
      ├── gui/gui.js         — lil-gui initialization: folders for Template, Parameters, Actions, Info
      ├── gui/items.js       — locations panel (Cities, Towns, Resources, Dungeons, Ruins,
       │                         Landmarks, Outposts, Hazards, Obstacles, Areas, Trouble)
       │                         + item list + fly-to camera + zoom out
      ├── terrain/features.js    — regional feature generator: 8+2d8 features per region, each
     │                         rolled 1d12+safety → creature/hazard/obstacle/area/named place/
     │                         site/faction presence/settlement with sub-tables for each type
     └── main.js          — bootstrap: seed → buildRegion → createScene → animate → initGUI
```

## Terrain Generation Pipeline

```
Seed → ChanceJS PRNG → points scaled by map area (~3000 at 50 km, ~15000 at 320 km)
     → Delaunator triangulation → adjacency graph
     → Terrain preset (wetland/lowland/woodland/highland/wasteland) + Map template (island/archipelago/bay/fjord/lake/land)
         → terrain state commands (Scale/Rainfall) + template command script (Hill/Range/Apply/Mask/SeaLevel/Fjord/Lake/Bay/LandClamp)
         → parseCommand → processTerrainCommands
             → queue-based mountain/ridge generation: Hill/Pit push circular features, Range/Trough push ridgeline
               with sinusoidal wiggle + branching spurs, Apply flushes queue with shapePower/noiseAmp
             → height field
       → Baseline subtraction (min → 0)
       → Island mask (smoothstep + angular perturbation, per-template radius/offset)
       → Normalize [0,1] → sqrt (peaky)
       → 8× hydraulic erosion (flux + slope → fill sinks)
       → Fjord/Lake/Bay carve or LandClamp (template-specific, per commands)
       → Sea-level cut (quantile per template)
       → Fill sinks → clean coast (remove 1-cell artifacts)
       → Rivers (downhill flux accumulation) → Moisture (Azgaar BFS + neighbor averaging) × terrain rainfall
       → Temperature (latitudinal + elevation lapse) → Biomes (Azgaar 5×26 matrix)
       → Habitability (biome × elevation × slope × water proximity, 0–125)
       → Cities (top habitability sites, ≥32 km apart, coastal-biased)
       → Towns (3 per city ≤30 km radius or 4 standalone, ≥25 km apart, coastal-biased)
        → Resources (Max(#cities,2) biome-weighted deposits, one type per deposit)
        → Great Ruins (1–2 abandoned city sites near settlements, ≥30 km apart)
        → Minor Ruins (4+1d6 random tall gray obelisks anywhere on land, ≥20 km apart)
         → Trouble (1 per resource + safety-based danger markers near settlements/ruins, all ≥15 km from cities/towns, typed from TROUBLE_TYPES table)
         → Features (8+2d8 narrative features: creature/hazard/obstacle/area/named place/site/faction presence/settlement)
           → Site→resource/ruin/dungeon/landmark/outpost resolved with placeSiteFeature + names from generatePlaceName
           → Hazard/obstacle/area: roll terrain type + filter subtype compatibility + find matching cells
           → Named place: 1d2 → ruin (minorRuins) or landmark (landmarkSites), carries name
           → Faction presence: random city/town selected, stored in factionSites[]
           → Lair/dwelling: push trouble marker with type from TROUBLE_TYPES
           → Per-vertex heights, indexed mesh, vertex colors by biome index
```

### Per-Template Configuration

| Template      | Water quantile | Mountain ranges           | Coastline                                      |
| ------------- | -------------- | ------------------------- | ---------------------------------------------- |
| `island`      | 0.40           | 2–4 moderate ranges       | Jagged circular island                         |
| `archipelago` | 0.55           | 4–6 short narrow ranges   | Small broken islands                           |
| `bay`         | 0.005          | 1–3 long heavy ranges     | Full land except bay blob from random edge     |
| `fjord`       | 0.01           | 3–5 very narrow ranges    | Full land except fjord trench from random edge |
| `lake`        | 0.005          | 2–4 ranges ringing center | Full land except central lake basin            |
| `land`        | 0.00           | 3–6 big continental belts | Fully continental, no water                    |

### Terrain Presets

| Terrain    | Mountain count | Height scale | Rainfall | Distribution                                  |
| ---------- | -------------- | ------------ | -------- | ---------------------------------------------- |
| `wetland`  | 10–40          | 0.5×         | 1.8×     | 1–2 short wide ranges, low outlier             |
| `lowland`  | 20–80          | 0.8×         | 1.0×     | 1–3 short medium ranges, low outlier           |
| `woodland` | 40–120         | 1.0×         | 1.3×     | 2–4 moderate ranges, moderate outlier          |
| `highland` | 100–300        | 1.5×         | 0.8×     | 2–4 moderate ranges, higher outlier            |
| `wasteland`| 5–30           | 0.6×         | 0.4×     | 1–3 long narrow ranges, high outlier           |

### 3D Mesh

- Delaunay triangles used directly as geometry (low-poly aesthetic)
- `flatShading: true` for faceted look
- Vertex colors mapped by Azgaar 5×26 biome matrix (temperature × moisture → 13 biome types)
- HEIGHT_SCALE = 3.5 km max elevation (vertical exaggeration for readability)

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
| `template`  | `island`, `archipelago`, `bay`, `fjord`, `lake`, `land` | Map template (affects sea level)                         |
| `seed`      | any URL-safe string                                     | Deterministic map seed                                   |
| `terrain`   | `wetland`, `lowland`, `woodland`, `highland`, `wasteland` | Terrain preset (counts, heights, rainfall)           |
| `climate`   | `Arctic`, `Sub-arctic`, `Temperate`, `Sub-tropical`, `Tropical` | Climate preset (base temperature)           |
| `safety`    | 0–3                                                     | Cities: Perilous(0) / Dangerous(1) / Unsafe(2) / Safe(3) |
| `size`      | 50–400                                                   | Map extent in km (default 320). Scales points, mountains, cities, features by area |

## Controls

- **OrbitControls**: left-click rotate, right-click pan, scroll to zoom
- **lil-gui** (top-right panel):
  - **Template** → map template dropdown
  - **Parameters** → Terrain (wetland/lowland/woodland/highland/wasteland), Climate (Arctic/Sub-arctic/Temperate/Sub-tropical/Tropical), Safety (Perilous/Dangerous/Unsafe/Safe), Map Size (50–400 km)
  - **Actions** → `New Island`, `Update`
  - **Info** → current seed (read-only)
- **Locations panel** (left panel, below GUI): category select (Cities, Towns, Resources, Dungeons, Ruins, Landmarks, Outposts, Hazards, Obstacles, Areas, Trouble) → clickable item list → smooth fly-to camera; Zoom Out button returns to default view. Dungeons, Ruins, and Landmarks display generated names where available. Hazards, obstacles, areas display type; trouble displays danger type; factions display faction type.

## Habitability & Settlements

### Habitability Score
Each terrain vertex is scored 0–125 based on:
- **Biome base** (`HABITABILITY[13]` — Temperate deciduous forest = 100, Glacier/Marine = 0)
- **Elevation gaussian** (favors 0.2–0.5 normalized height)
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
All placed at Y = 0.1 (land flat height).

### Forest Clearing
`buildMeshForests()` skips any forest cluster whose centroid falls within **5 km** of a city or town, and **3 km** of a minor ruin, keeping settlements visually clear of tree cover.

### Resource Deposits
`generateResources()` picks **Max(#cities, 2) unique resource types** per region (at least 2), each placed at its biome-weighted best location:
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

Site → resource and site → ruin/dungeon features are resolved in `buildRegion()` using `generateResources()` and `findRuins()`/`findMinorRuins()` from `terrain/terrain.js`, placing actual map resources, minor ruins, and great ruins at the generated locations. Named place, site→landmark, site→ruin, and site→dungeon all call `generatePlaceName()` (exported from `terrain/features.js`) to produce names like "The Broken Tower" or "The Doomed Gate".

Outpost → `placeSiteFeature()` helper (random land cell ≥15 km from cities/towns, tracked for mutual separation). Landmark → `generatePlaceName()` + `placeSiteFeature()`, stored in `region.landmarkSites[]` with name. Named place → 1d2 roll: ruin (pushed to `region.minorRuins[]`) or landmark (pushed to `region.landmarkSites[]`). Lair/dwelling → pushes a trouble marker with type `'lair'` to `region.trouble[]`.

Hazard/obstacle/area features roll a terrain type (`land`/`mountains`/`hills`/`forest`/`river`/`water`), filter sub-type against terrain compatibility (checking `hazardCompatibleWithTerrain()` / `obstacleCompatibleWithTerrain()` / `areaCompatibleWithTerrain()`), then find matching cells via `findCellsByTerrain()` and place markers. Meteorological hazards are region-wide (no marker). Area markers include neighbor cells within ~3 km to suggest extent. All placed features enforce ≥15 km from any city or town and ≥10 km from other same-type markers.

Outpost, landmark, hazard, obstacle, and area data is stored in `region.outpostSites[]`, `region.landmarkSites[]`, `region.hazards[]`, `region.obstacles[]`, `region.areas[]` respectively, and rendered by `buildSiteFeatures()` in `mesh/mesher.js`:
- **Outpost**: gray stone cylinder + red cone roof tower (`CylinderGeometry(0.4,0.5,0.8)` + `ConeGeometry(0.5,0.3)`)
- **Landmark**: cyan emissive pillar (`CylinderGeometry(0.2,0.3,1.5)`, emissive color `0x44ddff`)
- **Hazard**: orange inverted pyramid (`ConeGeometry(0.6,1.0,4)`, color `0xdd6633`)
- **Obstacle/Area**: amber pillars (`CylinderGeometry(0.2,0.3,1.2)`, color `0xbb8844`); area includes neighbor markers

## Algorithm Notes

**PRNG** — Mulberry32 seeded RNG for deterministic generation (embedded in `terrain/terrain.js`).

**Delaunay Triangulation** — [Delaunator](https://github.com/mapbox/delaunator) provides mesh topology from random points (scales with map area: ~3K minimum, ~15–20K at 320 km, ~23–31K at 400 km).

**Cartoon Mountains** — Generated via a **queue-based command architecture** (`TEMPLATE_SCRIPTS` + `TERRAIN_STATE_CMDS` → `parseCommand()` → `processTerrainCommands()`). Hill/Pit commands push circular features to a queue; Range/Trough commands generate ridgelines with sinusoidal wiggle and branching spurs; `Apply shapePower, noiseAmp` flushes the queue, rendering all queued features to the height field via `mountainFalloff()` with power-law `max(0, 1−t²)^shapePower` core + linear skirt (r→2r, 3.5% strength), plus per-point noise jitter (±noiseAmp). Radii vary 2.5–12.5 km. Ridgelines use sinusoidal wiggle (`wiggleFreq × wiggleAmp`) and branching prominence spurs (perpendicular segments every ~20 km). Multiple Apply batches per template enable layered terrain (e.g., broad fjord trough at low shapePower, then sharp hills at higher shapePower).

**Island Mask** — A smoothstep multiplier (`1 − t²(3−2t)`) based on distance from center, with **angular perturbation** (4-frequency sine waves) to create jagged coastlines with bays, headlands, and fjord channels. Per-template configs control base radius, center offset, and perturbation amplitudes. Templates marked "full map" use radius ≥ 1.0× extent so the terrain fills the entire configurable map area.

**Hydraulic Erosion** — For each vertex: compute downhill direction → collect upstream flux → compute slope → `erosion = √flux × slope + slope²` (capped at 200). 8 iterations with sink-filling between passes to prevent depressions.

**Coast Cleaning** — Two-pass removal of single-cell land/water artifacts on the boundary (3-neighbor triangles).

**Template-Specific Features** — Bay, Fjord, Lake, and Land use a full-coverage island mask (no angular clipping), so only their named features create water:
- **Lake**: Broad gaussian basin near the map center (radius 25–50 km, depth 0.25–0.5) pushed below sea level to form an inland lake.
- **Fjord**: Carved *before* the sea-level cut so the trench always reaches below the water cutoff. A linear Gaussian trench (len 80–180 km, width 6–16 km, depth 0.3–0.6) starting from a random map edge, creating flooded glacial valleys.
- **Bay**: Wide gaussian blob (radius 35–65 km, depth 0.2–0.4) placed near a random map edge. Creates a large bay opening.
- **Land**: No carve; heights are clamped to ≥ 0 (no cells at exactly 0), producing a fully continental terrain without ocean.

**Rivers** — Downhill flow accumulation on the Delaunay graph (`computeRivers()` in `terrain/terrain.js`). Each land point starts with unit flow, accumulates downstream via sorted height traversal. Points in the top 10% of accumulated flow become river channels. River segments follow downhill edges between river points and are rendered as blue `LineSegments` slightly above the terrain surface, with width proportional to √flux.

**Moisture** — Azgaar-style two-phase computation (`computeMoisture()` in `terrain/terrain.js`). Phase A: BFS from rivers (10), ocean (8), and coast-adjacent land (7) with exponential decay (0.94× per hop inland). Phase B: neighbor averaging with river flux bonus (`4 + mean(raw + max(flux/10, 2), neighbors)`). Output range ~4–50, stored in `region.moisture`.

**Temperature** — `computeTemperature()` in `terrain/terrain.js`. Base temp parameter (±0.5°C latitudinal gradient across map extent, south hot / north cold) with elevation lapse rate (−10°C max). Mapped to Azgaar's 26-band scale: `tempBand = round(clamp(20 − t, 0, 25))`. Stored in `region.temperature` and `region.tempBand`.

**Biomes** — `biomeId()` in `terrain/terrain.js` uses Azgaar's exact 5×26 biome matrix (5 moisture bands × 26 temperature bands). Overrides: normH < 0 → Marine (0), normH > 0.80 → Glacier (11). Produces 13 biomes: Marine, Hot desert, Cold desert, Savanna, Grassland, Tropical seasonal forest, Temperate deciduous forest, Tropical rainforest, Temperate rainforest, Taiga, Tundra, Glacier, Wetland. Colors looked up via `BIOME_COLORS[13]` array in `mesh/mesher.js`.

**Forests** — `buildMeshForests()` in `mesh/mesh_features.js` filters terrain vertices by normalized elevation (0.06–0.55), then applies a biome-index density lookup (`FOREST_DENSITY` array) with a 0.5 survival multiplier. Candidate points are clustered using a centroid-growing algorithm (8 km radius, min 5 per cluster). Each cluster centroid receives an InstancedMesh forest group via `generateForest()` from `mesh/mesh_tree.js`, which varies tree appearance by dominant biome (Taiga: tall trunk, narrow conical canopy, dark green; Rainforest: tall, large round canopy, deep green; Savanna: short trunk, wide flat canopy, yellow-green; Deciduous: medium, round, includes autumn hues).

**Great Ruins** — `findRuins()` in `terrain/terrain.js` picks 1–2 high-habitability land cells near existing settlements (within 60 km), avoiding occupied city/town cells (30 km exclusion) and enforcing ≥30 km separation between ruins themselves. Rendered as clusters of broken stone pillars in `buildSettlements()`.

**Minor Ruins** — `findMinorRuins()` scatters 4 + 1d6 (5–10) tall gray obelisks at random land cells, spaced ≥20 km apart, count scaled by map area. Rendered as `CylinderGeometry(0.3, 0.4, 3.5)` standing at terrain Y + 1.75.

**Trouble** — `findTrouble()` in `terrain/terrain.js` places danger markers: exactly 1 per resource (worst habitability within ~20 km), plus safety-scaled extras (scaled by map area) — Perilous=6, Dangerous=4, Unsafe=2, Safe=0 at default 320 km. Half the extras land within ~30 km of a city/town (worst habitability), the other half on random ruin sites. All trouble cells are ≥15 km from any city or town (added to the inner `addTrouble()` function). Lair/dwelling features from the resolution loop also push a `'lair'` trouble marker using the same distance constraints. Rendered as inverted red pyramids (`ConeGeometry` rotated π) in `buildTrouble()`.

## License

MIT
