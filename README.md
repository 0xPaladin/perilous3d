# Perilous Shores 3D

A browser-based 3D terrain generator that combines **Perilous Shores**' procedural island/map generation pipeline with a **Three.js** first-person/OrbitControls 3D renderer.

**Live site:** https://0xPaladin.github.io/Outlands/

## Tech Stack

- **Three.js r185** — 3D rendering, `BufferGeometry`, `MeshLambertMaterial`, `OrbitControls`
- **Chance.js** — seeded pseudo-random number generation for deterministic map generation
- **Vanilla ES modules** — no bundler, served directly via `<script type="module">`
- **HTML5 import maps** — CDN-based dependency loading

## Architecture

```
index.html
└── src/
    ├── 01_prng.js      — seedFromString + chance.js integration
    ├── 02_noise.js     — Perlin noise (seeded perm-table, 4096-entry smoothstep)
    │                      + FractalNoise (6 octaves, configurable persistence)
    ├── 03_grid.js      — Vec2, DCEL primitives, hex grid builder, flood-fill
    ├── 04_raisers.js   — Skeleton/midpoint-displacement + Poisson-disc
    │                      + 8 template raisers (island, archipelago, bay, coast,
    │                      fjord, peninsula, lake, land)
    ├── 05_terrain.js   — full pipeline: noise → raiser → normalize → water
    │                      threshold → connected-component islands → biomes → rivers
    ├── 06_coast.js     — Chaikin corner-cutting smoothing + fractal midpoint displace
    ├── 07_mesher.js    — hex cells → high-res N×N grid → Three.js BufferGeometry
    │                      + per-vertex colors + trees (CylinderGeometry) + buildings
    ├── 08_colors.js    — PS terrain palette (Water, Beach, Wood, Desert, Swamp, Plain,
    │                      Mountain, River) in 0-1 RGB range
    ├── 10_renderer.js  — Three.js scene, HemisphereLight + DirectionalLight (shadows),
    │                      water plane (semi-transparent PlaneGeometry), cloud blobs
    │                      (IcosahedronGeometry), OrbitControls, render loop with FPS counter
    ├── 11_ui.js         — progress overlay (STEP x OF 4), "New Island" / "Reset View"
    │                      buttons, seed display, URL sync
    └── main.js          — bootstrap: seed → buildRegion → createScene → animate
```

## Terrain Generation Pipeline

```
Seed → Hex Grid (DCEL, 55×55)
     → Fractal Noise (6 octaves, gridSize=32, persistence=0.45)
     + Template Raiser (per-template height shaping)
     → Normalize heights [0, 1]
     → Water threshold (template-dependent: island=0.60, land=-0.15, etc.)
     → Flood-fill connected-component islands
     → Mark coastal / mountain / riverside cells
     → Biome spawning (Wood/Dark/Light/Dead, Desert, Swamp, Plain — flood-fill growth)
     → River generation (weighted random walk toward coast)
     → (optional) Chaikin-smoothed coastline for rendering
```

### Per-Template Behavior

| Template     | Raiser strategy               | Water level |
|--------------|-------------------------------|-------------|
| `island`     | Skeleton: midpoint-displaced bones from center to edges | 0.60 |
| `archipelago`| Poisson-disc seeded island blobs | 0.55 |
| `bay`        | Directional ramp (single vector) | 0.50 |
| `coast`      | Directional ramp (weaker)     | 0.50 |
| `fjord`      | Skeleton spine + perpendicular incisions | 0.52 |
| `peninsula`  | Single bone from interior to edge | 0.60 |
| `lake`       | Radial distance from center (inverted) | 0.55 |
| `land`       | Flat (no raiser) | -0.15 |

### 3D Mesh Construction (Mixed Approach)

Rather than rendering the raw hex grid (which looks faceted in 3D), this project *resamples* hex cell data onto a `160×160` regular grid for smooth vertex interpolation:

1. Walk the high-res grid, find the containing hex cell by nearest-center lookup
2. Assign each vertex a height lifted from the cell's `level` × `15` (world units)
3. Color each vertex from the cell's biome type

This gives smooth terrain geometry while preserving Perilous Shores' biome-based coloring.

## Running Locally

No build step — static files served from any HTTP server (ES modules require a server, not `file://`).

```bash
# Clone or navigate to the project
cd perilous3d

# Python
python3 -m http.server 8000

# Or npm (if you prefer)
npx serve .

# Open in browser
open http://localhost:8000
```

### URL Parameters

You can share direct links to generated worlds:

```
https://0xPaladin.github.io/Outlands/?template=island&seed=ABCD1234
```

| Param    | Values                    | Description                    |
|----------|---------------------------|--------------------------------|
| `template` | `island`, `archipelago`, `bay`, `coast`, `fjord`, `peninsula`, `lake`, `land` | Map template |
| `seed`    | any URL-safe string        | Deterministic map seed         |

## Controls

- **OrbitControls**: left-click rotate, right-click pan, scroll to zoom
- **"New Island"**: generates a new random seed + map
- **"Reset View"**: snaps camera back to overview

## Algorithm Notes

**Perlin Noise** — Classic gradient noise implementation matching Perilous Shores' original compiled Haxe/OpenFL output:
- Seeded permutation table (Fisher-Yates shuffle, 256 entries, doubled to 512 for mod8 fast path)
- 8 cardinal/intercardinal gradient vectors
- `6t⁵ − 15t⁴ + 10t³` smoothstep polynomial (4096-entry lookup table)
- Bilinear interpolation of gradient dot-products

**Skeleton Midpoint Displacement** — Used by Island and Fjord templates:
1. Start with a straight bone from center → edge
2. Repeatedly subdivide each segment and displace the midpoint perpendicularly
3. Distance to nearest bone segment controls height via `ridgeSharpness / (d² + rounding)²`

**Chaikin Smoothing** — Corner-cutting subdivision for organic coastlines:
- Each frame: new points at 3/4 of prev + 1/4 of next (and vice versa)
- Run twice per coastline, applied after midpoint displacement

**Biome Growth** — Flood-fill seeded expansion with edge probability:
- Forests: ~50% spread, 3 variants (dark/light/dead wood)
- Desert: prefers low elevation, ~35% spread
- Swamp: biases toward riverside/coastal cells, ~40% spread
- Plains: fills remaining land cells

## What's Missing (Compared to Original Perilous Shores)

Perilous Shores 3D is terrain + 3D visualization only. Perilous Shores proper also has:
- 2D canvas rendering library (OpenFL)
- Settlement placement with named towns/cities
- Road network generation (A* pathfinding)
- SVG export
- Name generation (Tracery grammar + word lists)
- Sound effects (Howler.js)

If you want settlements + roads + names added as 3D models, let me know.

## Credits

- **Terrain algorithms**: [Perilous Shores](https://github.com/somewhere/perilous-shores) by watabou — compact hex-based procedural generation with 8 map templates
- **3D rendering style**: inspired by **Procedural Island** by simsome/Norbet — warm, colorful, low-poly aesthetic
- **Noise math**: classic Perlin noise implementation

## License

MIT — do whatever you want with it.
