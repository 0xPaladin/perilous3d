# CLAUDE.md — Perilous Shores 3D

## Project Overview

Browser-based procedural terrain generator with **cartoon-style mountains** on a **50–400 km configurable** map + **Three.js r185** 3D rendering with low-poly styling.

**Live**: https://0xPaladin.github.io/Outlands/

## Directory Layout

```
perilous3d/
    ├── index.html          # shell with import maps (three, d3-delaunay, lil-gui, simplex-noise) + inline CSS + UI chrome
    │                       #   loads lib/rot.min.js (ROT.js) as a global for ASCII tile-display mode
    │                       #   d3-delaunay replaces delaunator; provides Delaunay triangulation + built-in Voronoi diagram
├── lib/
    │   └── rot.min.js   # minified ROT.js (v2.x) — roguelike toolkit for ASCII tile rendering (global `ROT`)
├── README.md           # full architecture + algorithm notes
├── AGENTS.md           # 🤖 you are here
└── src/
    ├── core/
    │   ├── prng.js         # mulberry32 PRNG + seedFromString — consolidated PRNG utilities
    │   ├── voronoi.js        # Voronoi cell generation, point-to-cell lookup, cell adjacency
    │   ├── terrain_commands.js  # Voronoi command execution: BFS fill, line walking, cardinal filtering
    │   └── terrain_builder.js   # Voronoi pipeline orchestrator: commands → cell tagging → simplex → height mapping → biomes → display
    ├── terrain/
    │   ├── config.js       # Constants: terrain/cmd maps, terrain rainfall/scaling, biome matrix, habitability, trouble/feature types,
    │   │                    # site tables, magic/elements/faction tables, place-name word lists,
    │   │                    # VORONOI_TERRAIN_SCRIPTS and VORONOI_TEMPLATE_SCRIPTS,
    │   │                    # BIOME_NAMES, BIOME_GLYPHS, BIOME_GLYPHS_BY_INDEX (ASCII glyph/color per biome)
    │   ├── terrain.js      # buildRegion() — entry point. Calls buildDisplayFromState() from terrain_builder.js,
    │   │                    # then mountain peaks + resolveFeatures + generatePeoples.
    │   │                    # Returns { display, state } where display = geometry data, state = feature placements.
    │   │                    # Exports: buildRegion, createRng (re-export of mulberry32), findMountainPeaks
    │   ├── biomes.js        # Biome pipeline: buildBiomes(h, ctx) − sink fill → temperature → rivers → moisture → biome matrix
    │   │                    # Helpers: downhill, zero, fillSinks, computeTemperature, biomeFromMatrix,
    │   │                    # computeMoisture, computeRivers, computeHabitability
    │   ├── features.js      # Feature generation + resolution (all feature work):
    │   │                    # generateFeatures(safety, extentSize, rng) — rolls 8+2d8 narrative features
    │   │                    # resolveFeatures({...}) — voronoi cell-based assignment + placement for
    │   │                    #   cities/towns/ruins/trouble/resources/narrative features/outposts/
    │   │                    #   landmarks/factions/hazards/obstacles/areas
    │   │                    # Exports: resolveFeatures, generateFeatures, generatePlaceName,
    │   │                    #   computeNearResource
    ├── mesh/
    │   ├── mesher.js    # Delaunay triangles → indexed THREE.BufferGeometry + vertex colors
    │   │                    #   + river mesh (LineSegments)
    │   │                    #   + settlements: cities (keep+tower+roof) and towns (smaller hut/roof)
    │   │                    #   + resources: gold octahedron markers floating above deposit sites
    │   │                    #   + ruins: clustered stone pillars
    │   │                    #   + minor ruins: tall gray obelisks
    │   │                    #   + trouble: inverted red pyramids marking danger sites
    │   │                    #   + site features: outpost tower, cyan landmark pillar, orange hazard pyramid,
    │   │                    #     amber obstacle/area pillars
    │   ├── colors.js    # PS terrain palette (used by mountain & hill tile color palettes)
    │   ├── mesh_noise.js    # Seeded Perlin noise, FBM, domain warp (from meshDev)
    │   ├── mesh_mountain.js # Mountain tile generator + vertex-colored mesh builder
    │   ├── mesh_terrain.js  # Hill & dune tile generators + mesh builders
    │   ├── mesh_tree.js     # Tree (5 presets) + forest (InstancedMesh) generators
    │   └── mesh_features.js # Integration: places meshDev mountains & forests on terrain;
    │                       #   skips forest clusters within 5 km of any city or town so they stay visible
    ├── people/
    │   └── people.js       # generatePeoples() — regional population generation
    ├── sites/
    │   ├── index.js        # generateSite(opts) — entry point for site generation.
    │   │                    #   Returns { display, state } where display = { cols, rows, grid, width, height, walls }
    │   │                    #   (2D cell-type grid for ASCII rendering + wall line segments for organic floorplans)
    │   │                    #   and state = { template, floors, currentFloor, rooms, doors, stairs, walls }.
    │   │                    #   Templates: hideout (organic random walk), bandit-camp/lair (cellular automata),
    │   │                    #   warehouse (fill floor plan), dungeon (ROT.Map.Digger).
    │   │                    #   Exports: generateSite, SITE_GLYPHS, CELL
    │   ├── floorplan.js    # generateOrganicFloorPlan(seed, mapWidth, mapHeight, options?) — random walk on unit grid
    │   │                    #   Output: { rooms: string[], doors: [x,y][], walls: [x1,y1,x2,y2][] }
    │   │                    #   Rooms are cell IDs ("x,y"), walls are line segments for canvas rendering.
    │   ├── fill-floorplan.js # generateFillFloorPlan(seed, shape) — rectangle/circle tiling with no gaps,
    │   │                        #   randomized spanning tree connectivity.
    │   └── room.js         # Room class for ROT.js-style rectangular room rendering (used by digger/dungeon)
    ├── gui/
    │   ├── gui.js         # lil-gui initialization: folders for Template, Parameters, Display, Actions, Info
    │   ├── items.js       # locations panel: category select (Cities, Towns, Resources, Dungeons,
    │   │                     #   Ruins, Landmarks, Outposts, Hazards, Obstacles, Areas, Trouble, Factions)
    │   │                     #   + clickable item list + fly-to camera + zoom out
    │   ├── ascii.js       # ROT.js (ROT.Display) tile-based ASCII map renderer; biome glyphs with colors + feature overlays
    │   └── ui.js        # progress overlay, seed display, URL sync (seed display element removed; seed now in GUI)
    ├── renderer.js  # scene, lights, clouds (Y=80-120), OrbitControls, render loop
    └── main.js         # bootstrap: parse URL / new seed → buildRegion → createScene/animate or showAsciiMap → initGUI
```

## Conventions

- ES module syntax (`import`/`export`), one responsibility per file
- **terrain/terrain.js** exports `buildRegion(template, seed, terrainType, baseTemp = 22, cityCount = 0, extentSize = 320, numPoints = 0, featuresEnabled = true)` → returns `{ display, state }` where `display` contains geometry (pts, triangles, heights, biome, rivers, mounts, etc.) and `state` contains configuration + resolved feature placements (cities, towns, resources, ruins, trouble, outpostSites, landmarkSites, factionSites, hazards, obstacles, areas, features, peoples)
- `display.waterLevel` is always 0 for voronoi terrain — cell types determine water vs land (water cells ≤ 0, land cells > 0)
- **ASCII glyph convention** (`terrain/config.js` → `BIOME_GLYPHS`, `BIOME_GLYPHS_BY_INDEX`): each biome maps to `{ glyph, type, color, passable, transparent }`. Glyph is the character rendered in the tile display; `color` is the CSS hex used as the tile background. Used by `gui/ascii.js` to render the ROT.js tile display.
  - `Hill` and `Mountain` glyph entries exist for potential hill-specific tiles beyond biomes
- **mesh/mesher.js** flattens terrain to `Y = 0.1` for land and `Y = 0.0` for water; river lines float above at `0.2` (land) / `0.05` (water); settlements render as procedural Three.js meshes added to a `settlements` group
- Colors are linear RGB `[0-1]` floats; vertex colors assigned by Azgaar 5×26 biome matrix (temperature × moisture) → `BIOME_COLORS` lookup in `mesh/mesher.js`
- **mesh/mesh_features.js** places meshDev 3D meshes on the terrain surface using the `mounts` array for peak positions and nearest-neighbor terrain height lookup; skips forest clusters within **5 km** of any city or town so they stay visible
- **mesh/mesh_mountain.js**, **mesh/mesh_terrain.js**, **mesh/mesh_tree.js** use `MeshStandardMaterial` with `flatShading: true`, `vertexColors: true`; import `three` via importmap
- No external APIs, no build tooling, no bundler — keep it that way unless asked
- **Site generation** (`src/sites/index.js`): `generateSite(opts)` returns `{ display, state }` matching the `buildRegion()` shape. `display` = `{ cols, rows, grid, width, height }` where `grid` is a 2D array of cell-type codes (0=wall, 1=floor, 2=door, 3=stairs). `state` = `{ template, floors, currentFloor, rooms, doors, stairs, width, height }`. Site generation is ASCII-only — 3D rendering is not available for sites. The `CELL` enum and `SITE_GLYPHS` map are exported for ASCII rendering.

## Key Extension Points

| What you want to do              | Where to look                                                                                                                                                                             |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tune voronoi cell count          | `src/core/voronoi.js` → `generateVoronoiCells()` — `nCells = max(25, floor(25 × areaRatio))` at `extent.width`. Change the base or scaling factor.                                       |
| Add/edit terrain presets         | `src/terrain/config.js` → `VORONOI_TERRAIN_SCRIPTS` — `pre`/`post` command arrays per terrain type, applied around template commands                                                              |
| Add/edit map templates           | `src/terrain/config.js` → `VORONOI_TEMPLATE_SCRIPTS` — command strings per template (island/archipelago/coast/lake/land)                                                                    |
| Tune mountain peak count         | `terrain/terrain.js` → `findMountainPeaks()` — `maxMounts = max(5, round(25×areaRatio))` controls number of 3D mountain meshes; `HILL_THRESHOLD(0.65)` controls minimum prominence. Only glacier-biome cells qualify. |
| Tune base noise frequency        | `src/core/terrain_builder.js` → `generateSimplexForPts()` — `baseFreq` (2.0), `exponent` (3), `persistence` (0.5), `lacunarity` (2.0)                                                     |
| Tweak voronoi command logic      | `src/core/terrain_commands.js` — BFS fill, cardinal filtering, line walking, edge detection for Land/Hill/Lake/Range/Trough                                                               |
| Tweak height-per-cell mapping    | `src/core/terrain_builder.js` → `buildHeightFieldFromVoronoi()` — simplex noise scaled by cell type (water ≤ 0, land 0–0.5, hill/range 0.5+)                                              |
| Adjust camera/scale              | `src/renderer.js` → `createScene()` — `camera.position.set(0, 120*s, 260*s)` where `s = extentSize / 320`                                                                                 |
| Tweak biome computation          | `terrain/biomes.js` → `buildBiomes(h, ctx)` — sink fill → temperature → rivers → moisture → biome matrix                                                                                 |
| Tune temperature / moisture      | `terrain/biomes.js` → `computeTemperature()`, `computeMoisture()`                                                                                                                        |
| Tweak feature-generator tables   | `terrain/config.js` → `MAGIC_TYPES`, `ELEMENTS`, `FACTION_TYPES`, `PRIMARY_GOALS`, `CONDITIONS`, `PLACE_NAMES`, `PLACE_ADJECTIVES`, `PLACE_NOUNS`, `SITE_*_TYPES`                         |
| Tune feature resolution logic    | `terrain/features.js` → `resolveFeatures()` — voronoi cell-based assignment; receives cells, cellAdj, cellIndexForPoint, pts, h, biome, habitability, etc. via destructured params                                                                     |
| Give generated places names      | `terrain/features.js` exports `generatePlaceName(rng)`; `resolveFeatures()` uses it for ruins, landmarks, dungeons, named places                                                           |
| Generate regional features       | `terrain/features.js` → `generateFeatures(safety, extentSize, rng)` — 8+2d8 rolls of 1d12+safety                                                                                        |
| Generate site maps               | `src/sites/index.js` → `generateSite(opts)` — calls `generateMultiFloorPlan` (hideout), `ROT.Map.Cellular` (bandit-camp/lair), `generateFillFloorPlan` (warehouse), `ROT.Map.Digger` (dungeon) |
| Tune site room sizes             | `src/sites/floorplan.js` → `generateMultiFloorPlan()` options: `minLeafSize`, `minRoomSize`, `padding`, `maxDepth`, `stopProb`, `stairCount`                                               |
| Tune site fill density           | `src/sites/fill-floorplan.js` → `generateFillFloorPlan()` options: `minRoomSize`, `maxDepth`, `stopProb`, `extraConnectionChance`                                                         |

## Algorithm Notes

### Voronoi Terrain Pipeline (current)

```
Seed → mulberry32 PRNG → random points scaled by map area (~3K min, ~15-20K at 320 km, ~23-31K at 400 km via `generatePoints(npts, extent, rng)` in `terrain_builder.js`)
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
      → Range/Trough: walk line between named locations (top/center/bottomleft/random/etc.),
                       stop at water cells, continue on opposite shore; range tags as high
                       (heightBase=0.25, heightRange=1.25×scale), trough tags as water
  → Per-point simplex noise (FBM, 6 octaves, persistence 0.5, lacunarity 2.0, baseFreq 2.0, exponent 3)
  → Height mapping by cell type (0 = water boundary):
      Water/lake/trough: -1 + simplex → [-1, 0]
      Land:             0.01 + simplex × 0.25 → [0.01, 0.26]
      Hill:             heightBase + simplex × heightRange → [0.25, 0.25+1.25×scale]
      Range:            heightBase + simplex × heightRange → [0.25, 0.25+1.25×scale]
  → Sink fill → rivers → moisture × terrain rainfall multiplier → temperature → biomes (Azgaar 5×26 matrix)
  → Habitability → mountain peaks → feature resolution (cities/towns/resources/ruins/trouble)
```

### Voronoi Commands

| Command | Syntax | Effect |
| ------- | ------ | ------ |
| `Land` | `<pct> [constraint]` | Tag `pct`% of cells as land via BFS from random/cardinal-edge seed. `constraint`: `noedge` (interior only) or cardinal direction (`north`/`south`/`east`/`west`/`northeast`/`northwest`/`southeast`/`southwest`). |
| `Hill` | `<pct> [placement]` | Tag `pct`% of land cells as hill type (height 0.25+). `placement`: `random` (shuffle) or `neighbors` (BFS cluster). |
| `Lake` | `<pct> [placement]` | Convert `pct`% of land cells back to water. `placement`: `random` or `neighbors` (BFS cluster). |
| `Range` | `<pct> <start> <stop>` | Walk line from `start` to `stop` (named locations: topleft/top/topright/left/center/right/bottomleft/bottom/bottomright/random). Tag `pct`% of land cells along the line as range (height 0.25+). |
| `Trough` | `<pct> <start> <stop>` | Same as Range but tags cells as water (drains the line). |
| `Scale` | `<multiplier>` | Sets terrainScale multiplier for hill/range heightRange. Applied as heightRange = 1.25 × scale. |

### Shared Pipeline

- **PRNG**: Mulberry32 (in `src/core/prng.js`), seeded from `seedFromString()` (also in `prng.js`). All modules import `mulberry32` from `src/core/prng.js`.
- **Triangulation**: d3-delaunay — points scale with map area (3K minimum, ~15–20K at 320 km, ~23–31K at 400 km) → indexed triangle mesh
- **Rivers**: Downhill flow accumulation on the Delaunay graph (`computeRivers()`). Land points start with unit flow, accumulate downhill via sorted height traversal. Points in the top 10% of accumulated flow become river channels. River segments follow downhill edges between river points and are rendered as flat blue quads (width ∝ √flux).
- **Moisture**: Azgaar-style two-phase computation. Phase A: BFS from rivers (10), ocean (8), and coast-adjacent land (7) with exponential decay (0.94× per hop inland). Phase B: neighbor averaging with river flux bonus.
- **Temperature**: Base temp ±0.5°C latitudinal gradient with elevation lapse rate (−10°C max). Mapped to 26-band scale: `tempBand = round(clamp(20 − t, 0, 25))`.
- **Biomes**: Azgaar 5×26 matrix (5 moisture bands × 26 temperature bands). Overrides: normH ≤ 0 → Marine, normH > 0.80 → Glacier. 13 biomes total.
- **Habitability**: Biome base × elevation gaussian × slope penalty × water proximity bonus. Scored 0–125.
- **Cities**: Top habitability land cells, coastal-biased (+20 score).
- **Towns**: 3 per city ≤30 km radius or 4 standalone, coastal-biased.
- **Resources**: Max(#cities, 2) biome-weighted deposits, one type per deposit.
- **Great Ruins**: 1–2 abandoned city sites near settlements.
- **Minor Ruins**: 4+1d6 random obelisks anywhere on land.
- **Trouble**: 1 per resource + safety-based extras near settlements/ruins.
- **Features**: 8+2d8 narrative features resolved into map objects.
- **Feature placement**: All features are initially pre-assigned to voronoi cells (Phase 1 — cities/towns/ruins/outposts restricted to land/hill cells, everything else to any cell), then placed at the best qualifying point within their assigned cell after biomes/habitability (Phase 2), falling back to neighboring cells if needed. Hazards/obstacles/areas use no terrain compatibility or distance constraints — they place at any land point in their cell.

### Rendering

- Delaunay triangles used directly as geometry (low-poly aesthetic)
- `flatShading: true` for faceted look
- Vertex colors by biome index (`BIOME_COLORS[13]`)
- Terrain mesh: land at `rawHeight × 3.0`, water flat at Y=0.0
- Mountain/hill tiles: separate 3D meshes scaled by peak prominence, only for glacier-biome peaks
- Forests: InstancedMesh at cluster centroids, biome-variable tree appearance
- Clouds: IcosahedronGeometry blobs at Y=80-120, drift eastward
- Settlements: procedural meshes (keep+tower+roof for cities, hut+roof for towns)
- Resource markers: gold octahedrons floating above deposits
- Ruins: broken stone pillar clusters (great) / tall gray obelisks (minor)
- Trouble: inverted red pyramids
- Site features: outpost tower, cyan landmark pillar, orange hazard pyramid, amber obstacle/area pillars

### ASCII Tile Display (ROT.js)

- **lib/rot.min.js** — ROT.js loaded globally as `window.ROT` via a `<script>` tag in `index.html`
- **`gui/ascii.js`** — `showAsciiMap(display, state, tileSize)` creates a `ROT.Display` grid (width = cols, height = rows) where each cell is drawn via `display.draw(x, y, glyph, fgColor, bgColor)`.
  - The map extent is divided into tiles of `tileSize` km (configurable 5–80 km via GUI).
  - Each tile's biome is determined by nearest-neighbor search among the random points (spatial grid + BFS ring search).
  - Biome glyphs and colors come from `BIOME_GLYPHS_BY_INDEX` in `terrain/config.js`.
  - Features (cities `@`, towns `+`, ruins `R`, resources `*`, trouble `!`, outposts `O`, landmarks `L`, hazards `H`, obstacles `X`, areas `A`, factions `F`, etc.) overlay the biome glyphs with their own colored characters.
  - A legend below the map shows all biome and feature glyphs with their colors.
- **`hideAsciiMap()`** — hides the ROT.js container and restores the FPS overlay when switching back to 3D mode.
- **`showAsciiSite(display, state, tileSize)`** — renders a site (dungeon/hideout/etc.) as a ROT.Display grid. Each cell is drawn using `SITE_GLYPHS` from `src/sites/index.js` (wall `#`, floor `.`, door `+`, stairs `>`). A site-specific legend is shown below the grid.
- **`gui/gui.js`** — Display folder with `displayMode` dropdown (`3d` / `ascii`) and `tileSize` slider (5–80 km, enabled only in ASCII mode). Scope dropdown (`terrain` / `site`) in the Display folder switches between terrain and site parameter folders.

### Scale

- Extent configurable 50–400 km (default 320)
- `s = extentSize / 320` scales camera position, light position, cloud distance
- Area ratio `(extentSize / 320)²` scales point count, voronoi cell count, mountain count, feature counts

### UI

All user controls are powered by `lil-gui` (`src/gui/gui.js`). The GUI is initialized by `main.js` and exposes:
- **Display** folder: Scope dropdown (`terrain` / `site`), Display Mode dropdown (`3d` / `ascii`), Tile Size slider (5–80 km, enabled only in ASCII mode). When Scope=Site, Display Mode is locked to ASCII and Tile Size is disabled.
- **Parameters** folder (terrain): Terrain (wetland/lowland/woodland/highland/wasteland), Climate (Arctic/Sub-arctic/Temperate/Sub-tropical/Tropical), Safety (Perilous/Dangerous/Unsafe/Safe → 0/1/2/3 cities), Map Size (50–400 km), Points (0=auto), Place Features (toggle)
- **Parameters** folder (site): Template (hideout, bandit-camp, lair, warehouse, dungeon), Width (10–256), Height (10–256), Floors (1–10)
- **Actions** folder: New Region, Update (re-draw with same seed + current GUI params)
- **Info** folder: read-only Seed display (auto-updates on generation)

When Scope=Site, the terrain Parameters folder is hidden and the site Parameters folder is shown. The Generate flow calls `generateSite()` instead of `buildRegion()`, and the ASCII renderer draws the site grid using `SITE_GLYPHS`.

A **Locations panel** (`gui/items.js`) sits on the left with a category select (Cities, Towns, Resources, Dungeons, Ruins, Landmarks, Outposts, Hazards, Obstacles, Areas, Trouble), a clickable item list (fly-to camera on click), and a Zoom Out button. In site mode, the panel shows Rooms, Doors, and Stairs lists instead. Dungeons, Ruins, Landmarks display generated names where available. Hazards/obstacles/areas display their type; trouble displays danger type; factions display faction type and are bound to a random city/town.

The FPS counter remains as a DOM overlay in the bottom-right corner (`index.html`) and is hidden when ASCII mode is active, while the seed display was removed from DOM and moved into the GUI Info panel.