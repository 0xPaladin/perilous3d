# Plan: Remove Unused Old Pipeline Code

## Summary

After scanning the entire codebase, the old pipeline code has already been **mostly removed**. The files mentioned in AGENTS.md as "retained, unused" (`noise.js`, `grid.js`, `raisers.js`, `coast.js`) **do not exist** on disk. The old pipeline functions (`generateSimplexBase`, `processTerrainCommands`, `IslandMask`, `TEMPLATE_SCRIPTS`, `TERRAIN_STATE_CMDS`) have already been **completely removed** from `terrain.js`.

However, there are still **remnants of dead code** and **documentation references** that should be cleaned up. Below is the detailed plan.

---

## Phase 1: Dead Code in Active Files

### 1.1 `src/core/terrain_builder.js` — Remove dead `createRng` and `runif`

**Status:** `createRng` is defined locally but **never used** in this file. `runif` is only used by `generatePoints` which is used.

- **Line 16-24:** `createRng(seed)` function — **unused**. The file imports nothing from it and never calls it. The `createRng` in `terrain.js` is the one used by the rest of the pipeline.
- **Line 26-28:** `runif(lo, hi, rng)` — **used** by `generatePoints`. Keep.

**Action:** Remove the `createRng` function (lines 16-24).

### 1.2 `src/core/terrain_builder.js` — Remove dead `islandGroups` from return

**Status:** `islandGroups` is returned from `buildHeightFieldFromVoronoi` (line 211) and destructured in `buildDisplayFromState` (line 171), but **never used** anywhere downstream.

- `terrain.js` does not destructure or use `islandGroups` from the return of `buildDisplayFromState`.
- `features.js` does not use `islandGroups`.
- `renderer.js` / `mesher.js` do not use `islandGroups`.

**Action:** Remove `islandGroups` from the return object of `buildHeightFieldFromVoronoi` and from the destructuring in `buildDisplayFromState`.

### 1.3 `src/core/terrain_builder.js` — Remove dead `hullSet` from return

**Status:** `hullSet` is returned from `buildCellAdjacency` (line 52 of `voronoi.js`) and destructured in `buildHeightFieldFromVoronoi` (line 106), but **never used** anywhere.

- `terrain_commands.js` receives `edgeSet` but not `hullSet`.
- No other file references `hullSet`.

**Action:** Remove `hullSet` from the destructuring in `buildHeightFieldFromVoronoi` (line 106). Optionally remove from `voronoi.js` return as well.

### 1.4 `src/core/terrain_commands.js` — Remove dead `totalCells` variable

**Status:** `const totalCells = n;` on line 103 is **never used** anywhere in the function.

**Action:** Remove line 103.

### 1.5 `src/core/terrain_commands.js` — Remove dead `centroids` parameter in `lineCellsBetween`

**Status:** `lineCellsBetween(startLoc, stopLoc, cells, centroids, extent, cellDelaunay)` — the `centroids` parameter is **never used** inside the function body.

**Action:** Remove `centroids` from the function signature and the call site (line 299).

### 1.6 `src/core/terrain_commands.js` — Remove dead `cells` parameter in `lineCellsBetween`

**Status:** `lineCellsBetween(startLoc, stopLoc, cells, centroids, extent, cellDelaunay)` — the `cells` parameter is **never used** inside the function body.

**Action:** Remove `cells` from the function signature and the call site (line 299).

### 1.7 `src/core/voronoi.js` — Remove dead `hullSet` from return

**Status:** `buildCellAdjacency` returns `hullSet` (line 52) but it's never used by any caller.

**Action:** Remove `hullSet` from the return object and update the JSDoc comment.

### 1.8 `src/terrain/terrain.js` — Remove duplicate `createRng`

**Status:** `createRng` is defined and exported in `terrain.js` (line 5). It's also defined locally (but unused) in `terrain_builder.js`. The `terrain.js` version is used by:
- `terrain.js` itself (line 52)
- `features.js` (line 1: `import { createRng } from './terrain.js'`)
- `people.js` (line 1: `import { createRng } from "../terrain/terrain.js"`)

**Action:** Keep `createRng` in `terrain.js`. Remove the duplicate in `terrain_builder.js` (already planned in 1.1).

### 1.9 `src/mesh/mesh_features.js` — Consolidate `mulberry32`

**Status:** `mulberry32` is defined locally in `mesh_features.js` (line 6) and used locally (lines 61, 184). It's a **duplicate** of the PRNG logic in `terrain.js`'s `createRng` (which is actually splitmix32, not mulberry32 — they're different algorithms).

**Action:** This is a **consolidation opportunity**, not dead code. `mulberry32` is actively used. Can optionally import `createRng` from `terrain.js` instead, but this is a refactor, not dead code removal. **Leave as-is** for now — it's used.

---

## Phase 2: Documentation Cleanup

### 2.1 `AGENTS.md` — Update directory layout

**Status:** AGENTS.md lists files that don't exist:
- `src/noise.js` — doesn't exist
- `src/grid.js` — doesn't exist
- `src/raisers.js` — doesn't exist
- `src/terrain/coast.js` — doesn't exist
- `src/core/state.js` — doesn't exist

**Action:** Remove references to these non-existent files from the directory layout section.

### 2.2 `AGENTS.md` — Update "retained, unused" annotations

**Status:** AGENTS.md describes several files as "retained, unused" but they don't exist.

**Action:** Remove the "retained, unused" annotations for files that don't exist.

### 2.3 `AGENTS.md` — Update old pipeline section

**Status:** The "Old Pipeline (superseded, code retained)" section (lines 146-151) describes code that has already been removed.

**Action:** Remove or update this section to reflect that the old pipeline code has been completely removed.

### 2.4 `README.md` — Update references

**Status:** README.md also references the old pipeline and non-existent files.

**Action:** Update README.md to remove references to non-existent files and old pipeline code.

---

## Phase 3: Verification

### 3.1 Verify no remaining references

After all removals, grep for:
- `generateSimplexBase` — should only appear in comments
- `processTerrainCommands` — should only appear in comments (if any)
- `IslandMask` — should have zero matches
- `TEMPLATE_SCRIPTS` (old, not VORONOI_TEMPLATE_SCRIPTS) — should have zero matches
- `TERRAIN_STATE_CMDS` — should have zero matches
- `totalCells` — should have zero matches
- `hullSet` — should have zero matches (if removed from voronoi.js)
- `islandGroups` — should have zero matches (if removed)

### 3.2 Verify imports still resolve

Ensure no file imports from a removed module or references a removed export.

---

## Execution Order

1. **Phase 1** (code removal) — safe, no behavioral changes
2. **Phase 2** (documentation) — update AGENTS.md and README.md
3. **Phase 3** (verification) — grep to confirm clean removal

## Risk Assessment

- **Low risk:** All removals are of code that is provably unused (dead variables, unused return values, unused parameters).
- **No behavioral changes:** None of the removed code affects runtime behavior.
- **No import breakage:** All removed symbols are either local functions or unused return properties.
