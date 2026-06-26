# Claude Code Instructions — Perilous Shores 3D

## What This Project Is

A single-page ES-module app:
- **Perilous Shores** hex-terrain generation (noise → raiser → biomes → rivers) in pure JS
- **Three.js r185** 3D rendering with warm procedural-island coloring / tree / cloud styling

No bundler. No build step. ES modules over CDN + local `src/`.

## Where to Start Reading

1. `index.html` — thin shell, shows what UI chrome exists and how modules load
2. `src/main.js` — bootstrap, shows the full pipeline call order
3. `src/05_terrain.js` — the most interesting logic (the whole generation pipeline)
4. `src/04_raisers.js` — Skeleton / midpoint-displacement / Poisson-disc (the PS magic)
5. `src/10_renderer.js` — Three.js scene construction

## Hard Rules

- **Keep files under ~400 lines**. If a file grows past that, split by responsibility.
- **No new dependencies**. Three.js (CDN via importmap) + Chance.js (CDN) are the only external libs. Everything else is local ES modules in `src/`.
- **No bundlers, no transpilers, no build step**. Code must run directly in the browser as `<script type="module">`.
- **Do not remove or rename existing source files** without updating all imports everywhere.
- **Colors go in `08_colors.js`**. Do not inline hex literals in renderer code.
- **Terrain state lives on `Face.data`** inside the array returned by `buildRegion()`. Do not shadow or duplicate it into parallel data structures — every downstream module (mesher, trees, settlements) reads from the same `Face.data` object.
- **Internal heights are always `[0, 1]` normalized**. Only multiply by a world scale factor at the final meshing step (currently `* 15` in `07_mesher.js`).
- **Water position is always `region.waterLevel * HEIGHT_SCALE`**. Don't hardcode a Y value in the renderer if the water level changes per template.

## Naming

- `Region` = the object returned by `buildRegion(template, cols, rows, seed)`
- `Cell` / `Face.data` = one hex in the grid (the things with `.land`, `.level`, `.terrain`, `.coastal`, etc.)
- `template` = one of: `island`, `archipelago`, `bay`, `coast`, `fjord`, `peninsula`, `lake`, `land`

## Verification Before Committing

```bash
cd /home/paladin/workspace/perilous3d
python3 -m http.server 8000 &
# open http://localhost:8000
# must: open dev console → no errors
# must: click "New Island" 5× → each of the 8 templates must render without errors
# must: mouse-rotate / zoom works
# must: seed display in top-left updates on each generation
```

## Common Pitfalls / Watch-Outs

- **CORS / MIME types**: everything is served from the same origin; only `three` and `chance` come from CDN.
- **Import cycles**: `05_terrain.js` imports from `03_grid.js` and `04_raisers.js`. Do not add back-imports from terrain into grid or raisers.
- **Chance.js is NOT a PRNG** — it's a wrapper around `Math.random`. The *only* source of deterministic randomness is the noise layer + the raiser constructors which capture `Math.random()` calls at construction time. If you need deterministic biome placement, seed from the FractalNoise instance, not `Math.random()`.
- **`buildHexGrid` in `03_grid.js` uses plain `Math.random()`** for jitter. It is not seeded. If you need seeded hex jitter, refactor `03_grid.js` to accept a seeded function.

## Useful Imports Cheat Sheet

```js
import Chance          from 'https://cdn.jsdelivr.net/npm/chance@1.1.11/+esm';
import * as THREE      from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { seedFromString, createChance }  from './01_prng.js';
import { Perlin, FractalNoise }          from './02_noise.js';
import { Vec2, buildHexGrid, floodFill } from './03_grid.js';
import { getRaiser, Skeleton, poissonDiscSamples } from './04_raisers.js';
import { buildRegion, TERRAIN }          from './05_terrain.js';
import { buildCoastline }                from './06_coast.js';
import { buildTerrainMesh, buildTrees, buildSettlements } from './07_mesher.js';
import { terrainColor, TERRAIN_COLORS }  from './08_colors.js';
import { createScene, animate, resetView } from './10_renderer.js';
import { progressPanel }                 from './11_ui.js';
```

## When to Stop and Ask

- If you need to change the output of `buildRegion()` shape (adding/removing fields on `Face.data`)
- If you want to add a npm dependency (justify why CDN + local module isn't sufficient)
- If you need to replace Chance.js with a different PRNG (keep `01_prng.js` interface stable)
- If terrain generation takes >10s on a 55×55 grid (something is wrong algorithmically)

## TODO / Icebox

- [ ] Replace `buildHexGrid` jitter with seeded jitter (currently uses `Math.random()`)
- [ ] Biomes currently use `Math.random()` for spread — not seeded across regenerations from same seed
- [ ] `MESH_RES = 160` is arbitrary; could vary by template or map size
- [ ] Trees/buildings placed by random sampling over cells — not seeded, desync on same-seed regen
- [ ] Coastline refinement (`06_coast.js`) is computed but not wired into `buildRegion()` or `07_mesher.js`
- [ ] Settlement placement is basic (random colored boxes) — real PS has named towns, density, road network
- [ ] Water is a static flat plane — could add simple vertex wave in animate loop
- [ ] Missing module `09_*.js` (intentionally — nothing slotted there yet; could use for audio or particle system)
- [ ] Tests: zero automated tests; add a minimal smoke test harness if `perilous.js` is ever re-incorporated
