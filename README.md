# Perilous Shores 3D

A browser-based 3D terrain generator using a **cartoon-style mountain** approach on a **320×320 km** map, rendered with **Three.js** OrbitControls.

**Live site:** https://0xPaladin.github.io/Outlands/

## Tech Stack

- **Three.js r185** — 3D rendering, `BufferGeometry`, `MeshLambertMaterial`, `OrbitControls`
- **Delaunator** — Delaunay triangulation (mesh topology for 3D terrain)
- **lil-gui** — floating control panel for user parameters and actions
- **Mulberry32** — seeded PRNG for deterministic generation
- **Vanilla ES modules** — no bundler, served directly via `<script type="module">`
- **HTML5 import maps** — CDN-based dependency loading

## Architecture

```
index.html
└── src/
    ├── 01_prng.js      — seedFromString (legacy, kept for main.js)
    ├── 02_noise.js     — Perlin + FractalNoise (retained, unused by current pipeline)
    ├── 03_grid.js      — Vec2, hex grid, DCEL (retained, unused by current pipeline)
    ├── 04_raisers.js   — Skeleton/midpoint-displacement raisers (retained, unused)
    ├── 05_terrain.js   — full pipeline: Delaunay mesh → cartoon mountains (parabolic cones
    │                      + Gaussian ground skirts) → island mask → peaky transform →
    │                      hydraulic erosion → fjord trench carve → sea-level cut →
    │                      sink-fill → coast clean → template-specific features
    │                      (inverted depressions: lake basin / bay blob)
    ├── 06_coast.js     — Chaikin smoothing (retained, unused by current pipeline)
     ├── 07_mesher.js    — Delaunay triangles → Three.js indexed BufferGeometry
    │                      + per-vertex biome colors (Azgaar 5×26 temperature × moisture matrix)
    │                      + river mesh (LineSegments along downhill edges, width ∝ √flux)
    │                      + biome view mesh (non-indexed per-triangle colors + wireframe)
    ├── 08_colors.js    — PS terrain palette (used by mountain & hill tile color palettes)
    ├── 10_renderer.js  — Three.js scene, HemisphereLight + DirectionalLight (shadows),
     │                      cloud blobs (IcosahedronGeometry at Y=80–120), OrbitControls,
     │                      render loop with FPS counter
    ├── 11_ui.js         — progress overlay, seed display, URL sync
    ├── 17_gui.js         — lil-gui initialization: folders for Template, Parameters, Actions, Info
    └── main.js          — bootstrap: seed → buildRegion → createScene → animate → initGUI
```

## Terrain Generation Pipeline

```
Seed → Mulberry32 PRNG → 12000–20000 random points (320×320 km extent)
     → Delaunator triangulation → adjacency graph
     → N cartoon mountains (slider: 0–500, default 200)
         clustered along 2–6 range backbones (per-template configs)
         each with:
           - Parabolic cone core  (1.2–5 km radius, sharp peak, compact support)
           - Gaussian ground skirt (4× core radius, 20% amplitude)
     → Baseline subtraction (min → 0)
     → Island mask (smoothstep + angular perturbation, per-template radius/offset)
     → Normalize [0,1] → sqrt (peaky)
     → 8× hydraulic erosion (flux + slope → fill sinks)
     → Fjord trench carve (before sea-level, always below water cutoff)
     → Sea-level cut (quantile per template)
     → Fill sinks → clean coast (remove 1-cell artifacts)
     → Template-specific features (lake basin / bay blob inverted depressions)
     → Rivers (downhill flux accumulation) → Moisture (Azgaar BFS + neighbor averaging)
     → Temperature (latitudinal + elevation lapse) → Biomes (Azgaar 5×26 matrix)
     → Per-vertex heights, indexed mesh, vertex colors by biome index
```

### Per-Template Configuration

| Template     | Water quantile | Mountain ranges | Coastline |
|--------------|---------------|-----------------|-----------|
| `island`     | 0.40 | 2–4 moderate ranges | Jagged circular island |
| `archipelago`| 0.55 | 4–6 short narrow ranges | Small broken islands |
| `bay`        | 0.005 | 1–3 long heavy ranges | Full land except bay blob from random edge |
| `fjord`      | 0.01  | 3–5 very narrow ranges | Full land except fjord trench from random edge |
| `lake`       | 0.005 | 2–4 ranges ringing center | Full land except central lake basin |
| `land`       | 0.00 | 3–6 big continental belts | Fully continental, no water |

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
https://0xPaladin.github.io/Outlands/?template=island&seed=ABCD1234&mountains=200&temp=22
```

| Param      | Values                    | Description                              |
|------------|---------------------------|------------------------------------------|
| `template` | `island`, `archipelago`, `bay`, `fjord`, `lake`, `land` | Map template (affects sea level) |
| `seed`     | any URL-safe string        | Deterministic map seed                   |
| `mountains` | 0–500                    | Number of mountain peaks                 |
| `temp`     | 0–35                      | Base temperature in °C                   |

## Controls

- **OrbitControls**: left-click rotate, right-click pan, scroll to zoom
- **lil-gui** (top-right panel):
  - **Template** → map template dropdown
  - **Parameters** → Mountains (0–500) and Base Temp (0–35°C) sliders
  - **Actions** → `New Island`, `Reset View`, `Biome View` toggle
  - **Info** → current seed (read-only)

## Algorithm Notes

**PRNG** — Mulberry32 seeded RNG for deterministic generation (embedded in `05_terrain.js`).

**Delaunay Triangulation** — [Delaunator](https://github.com/mapbox/delaunator) provides mesh topology from 12K–20K random points across a 320×320 km extent.

**Cartoon Mountains** — Each mountain is a **parabolic cone** (`max(0, 1 − d²/r²)`) giving a sharp peak with no fuzzy tails, plus a wide **Gaussian skirt** at 20% amplitude to raise the surrounding ground. This produces distinct, steep peaks with continuous rolling terrain between them. Radii vary 1.2–5 km per cone. Peaks are **clustered along 2–6 range backbones** (lines defined by center, angle, length, and width). Per-template configurations control range count, length, width, and spatial spread. 15% of peaks are random outliers (foothills and isolated cones).

**Island Mask** — A smoothstep multiplier (`1 − t²(3−2t)`) based on distance from center, with **angular perturbation** (4-frequency sine waves) to create jagged coastlines with bays, headlands, and fjord channels. Per-template configs control base radius, center offset, and perturbation amplitudes. Templates marked "full map" use radius ≥ 1.0× extent so the terrain fills the entire 320×320 km area.

**Hydraulic Erosion** — For each vertex: compute downhill direction → collect upstream flux → compute slope → `erosion = √flux × slope + slope²` (capped at 200). 8 iterations with sink-filling between passes to prevent depressions.

**Coast Cleaning** — Two-pass removal of single-cell land/water artifacts on the boundary (3-neighbor triangles).

**Template-Specific Features** — Bay, Fjord, Lake, and Land use a full-coverage island mask (no angular clipping), so only their named features create water:
- **Lake**: Broad gaussian basin near the map center (radius 25–50 km, depth 0.25–0.5) pushed below sea level to form an inland lake.
- **Fjord**: Carved *before* the sea-level cut so the trench always reaches below the water cutoff. A linear Gaussian trench (len 80–180 km, width 6–16 km, depth 0.3–0.6) starting from a random map edge, creating flooded glacial valleys.
- **Bay**: Wide gaussian blob (radius 35–65 km, depth 0.2–0.4) placed near a random map edge. Creates a large bay opening.
- **Land**: No carve; heights are clamped to ≥ 0 (no cells at exactly 0), producing a fully continental terrain without ocean.

**Rivers** — Downhill flow accumulation on the Delaunay graph (`computeRivers()` in `05_terrain.js`). Each land point starts with unit flow, accumulates downstream via sorted height traversal. Points in the top 10% of accumulated flow become river channels. River segments follow downhill edges between river points and are rendered as blue `LineSegments` slightly above the terrain surface, with width proportional to √flux.

**Moisture** — Azgaar-style two-phase computation (`computeMoisture()` in `05_terrain.js`). Phase A: BFS from rivers (10), ocean (8), and coast-adjacent land (7) with exponential decay (0.94× per hop inland). Phase B: neighbor averaging with river flux bonus (`4 + mean(raw + max(flux/10, 2), neighbors)`). Output range ~4–50, stored in `region.moisture`.

**Temperature** — `computeTemperature()` in `05_terrain.js`. Base temp parameter (±0.5°C latitudinal gradient across 320 km, south hot / north cold) with elevation lapse rate (−10°C max). Mapped to Azgaar's 26-band scale: `tempBand = round(clamp(20 − t, 0, 25))`. Stored in `region.temperature` and `region.tempBand`.

**Biomes** — `biomeId()` in `05_terrain.js` uses Azgaar's exact 5×26 biome matrix (5 moisture bands × 26 temperature bands). Overrides: normH < 0 → Marine (0), normH > 0.80 → Glacier (11). Produces 13 biomes: Marine, Hot desert, Cold desert, Savanna, Grassland, Tropical seasonal forest, Temperate deciduous forest, Tropical rainforest, Temperate rainforest, Taiga, Tundra, Glacier, Wetland. Colors looked up via `BIOME_COLORS[13]` array in `07_mesher.js`.

**Forests** — `buildMeshForests()` in `16_mesh_features.js` filters terrain vertices by normalized elevation (0.06–0.55), then applies a biome-index density lookup (`FOREST_DENSITY` array) with a 0.5 survival multiplier. Candidate points are clustered using a centroid-growing algorithm (8 km radius, min 5 per cluster). Each cluster centroid receives an InstancedMesh forest group via `generateForest()` from `15_mesh_tree.js`, which varies tree appearance by dominant biome (Taiga: tall trunk, narrow conical canopy, dark green; Rainforest: tall, large round canopy, deep green; Savanna: short trunk, wide flat canopy, yellow-green; Deciduous: medium, round, includes autumn hues).

**Biome View** — `buildBiomeViewMesh()` in `07_mesher.js` creates a non-indexed per-triangle mesh where each Delaunay triangle is colored flat by its majority biome, overlaid with a 15% opacity wireframe showing cell boundaries. Toggled via the "Biome View" action in the `Actions` folder of the lil-gui panel (`src/17_gui.js`).

## Credits

- **Terrain concept**: inspired by [mewo2/terrain](https://github.com/mewo2/terrain) — Voronoi-based fantasy map generator
- **Original Perilous Shores**: [watabou](https://github.com/watabou/perilous-shores) — hex-based procedural generation
- **3D rendering**: inspired by **Procedural Island** by simsome/Norbet

## License

MIT
