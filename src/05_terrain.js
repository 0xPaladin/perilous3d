// Full terrain generation pipeline for Perilous Shores.
// Steps: fractal noise → raiser → normalize → water threshold → islands → biomes → rivers
//
// Outputs a Region object with:
//   region.faces:   array of Cell data objects (center, poly, land, level, terrain...)
//   region.cols/rows: grid dimensions
//   region.islands: connected-component island objects
//   region.template / region.seed / region.waterLevel

import { FractalNoise } from './02_noise.js';
import { getRaiser } from './04_raisers.js';
import { Vec2, buildHexGrid, floodFill } from './03_grid.js';
import { TERRAIN } from './08_colors.js';

// ---- Water level thresholds per template (reconstructed from PS) ----
const WATER_LEVELS = {
  island: 0.60, archipelago: 0.55, bay: 0.50, coast: 0.50,
  fjord: 0.52, peninsula: 0.60, lake: 0.55, land: -0.15
};
const LOWLAND_AREA = 0.60;

export function buildRegion(template, cols, rows, seed) {
  const step = (name) => {
    console.log(`[terrain] ${name}`);
  };

  // 1. Build hexagonal grid (flat-top)
  step('build hex grid');
  const { faces: rawFaces, vertices, edges } = buildHexGrid(cols, rows, 0, 0);

  // 2. Create fractal noise (6 octaves, PS-matched params)
  step('create noise');
  const noise = new FractalNoise(6, 32, 0.45, seed % 99999);
  const raiser = getRaiser(template, cols, rows, seed);

  // 3. Compute raw height for each cell
  step('compute heights');
  for (const face of rawFaces) {
    const d = face.data.center;
    const base = noise.get(d.x, d.y);             // [-1, 1]
    const raised = raiser.raise(d);               // raiser-specific range
    face.data.rawHeight = base * 0.65 + raised * 0.75;
    face.data.rawHeight = Math.max(0, Math.min(1, (face.data.rawHeight + 0.5) / 1.5));
  }

  // 4. Normalize heights across all cells
  let minH = Infinity, maxH = -Infinity;
  for (const f of rawFaces) {
    if (f.data.rawHeight < minH) minH = f.data.rawHeight;
    if (f.data.rawHeight > maxH) maxH = f.data.rawHeight;
  }
  const rangeH = maxH - minH || 1;
  for (const f of rawFaces) {
    f.data.level = (f.data.rawHeight - minH) / rangeH;
  }

  // 5. Apply water threshold
  const waterLevel = WATER_LEVELS[template] || 0.5;
  for (const f of rawFaces) {
    f.data.land = f.data.level > waterLevel;
    f.data.aboveSea = 1 - Math.max(0, (f.data.level - waterLevel)) / Math.max(0.01, 1 - waterLevel);
  }

  // 6. Mark border cells
  for (const f of rawFaces) {
    if (f.data.col === 0 || f.data.col === cols - 1 || f.data.row === 0 || f.data.row === rows - 1) {
      f.data.border = true;
    }
  }

  // 7. Connected-component island detection
  const visited = new Set();
  const islands = [];
  for (const f of rawFaces) {
    if (f.data.land && !visited.has(f.index)) {
      const regionCells = floodFill(f, cell => cell.data.land, visited);
      const island = {
        index: islands.length,
        faces: regionCells,
        outline: null,
      };
      for (const c of regionCells) c.data.island = island;
      islands.push(island);
    }
  }

  // 8. Mark coastal cells
  for (const f of rawFaces) {
    if (f.data.land) {
      f.data.coastal = f.data._neighbors.some(n => !n.data.land);
    }
  }

  // 9. Mountain assignment (flood-fill high-elevation cells)
  const mountainCandidates = rawFaces.filter(f => f.data.land && f.data.aboveSea > LOWLAND_AREA);
  const visitedMtn = new Set();
  const mountains = [];
  for (const candidate of mountainCandidates) {
    if (visitedMtn.has(candidate.index)) continue;
    const cluster = floodFill(candidate, f => f.data.land && f.data.aboveSea > LOWLAND_AREA, visitedMtn);
    if (cluster.length > 3) {
      mountains.push(cluster);
      for (const c of cluster) c.data.mountain = true;
    }
  }

  // 10. Spawn biome terrain types
  step('spawn biomes');
  spawnBiomes(rawFaces, template);

  // 11. River generation
  step('generate rivers');
  generateRivers(rawFaces, seed);

  return { faces: rawFaces, vertices, edges, cols, rows, islands, template, seed, waterLevel };
}

// ---- Biome spawning: flood-fill growth from seed positions ----
function spawnBiomes(faces, template) {
  const landFaces = faces.filter(f => f.data.land && !f.data.border);
  if (!landFaces.length) return;

  const nSeeds = Math.min(Math.floor(landFaces.length * 0.04), 20);

  // Wood seeds
  const woodSeeds = [];
  const desertSeeds = [];
  for (let i = 0; i < nSeeds; i++) {
    const cell = landFaces[Math.floor(Math.random() * landFaces.length)];
    if (Math.random() < 0.7) woodSeeds.push(cell);
    else desertSeeds.push(cell);
  }

  for (const seed of woodSeeds) {
    const type = Math.random() < 0.33 ? TERRAIN.WOOD_DARK : (Math.random() < 0.5 ? TERRAIN.WOOD_LIGHT : TERRAIN.WOOD_DEAD);
    growBiome(seed, 0.5, f => !f.data.terrain && f.data.land && !f.data.mountain && !f.data.riverside, type);
  }

  for (const seed of desertSeeds) {
    if (seed.data.aboveSea < 0.6) {
      growBiome(seed, 0.35, f => !f.data.terrain && f.data.land && !f.data.mountain && f.data.level < 0.6, TERRAIN.DESERT);
    }
  }

  // Swamp near riversides / coasts
  const swampSeeds = faces.filter(f => f.data.land && (f.data.riverside || f.data.coastal)).slice(0, 10);
  for (const seed of swampSeeds) {
    if (!seed.data.terrain) {
      growBiome(seed, 0.4, f => !f.data.terrain && f.data.land && !f.data.mountain, TERRAIN.SWAMP);
    }
  }

  // Plains fill
  for (const f of landFaces) {
    if (!f.data.terrain && !f.data.mountain) f.data.terrain = TERRAIN.PLAIN;
  }
}

function growBiome(seed, probability, canGrow, type) {
  const queue = [seed];
  const visited = new Set([seed.index]);
  seed.data.terrain = type;
  while (queue.length) {
    const cur = queue.shift();
    for (const n of cur.data._neighbors) {
      if (visited.has(n.index)) continue;
      if (!canGrow(n)) continue;
      if (Math.random() < probability) {
        n.data.terrain = type;
        visited.add(n.index);
        queue.push(n);
      }
    }
  }
}

// ---- River generation (weighted random walk toward coast) ----
function generateRivers(faces, seed) {
  const numRivers = 3 + ((seed >>> 0) % 5);
  const landFaces = faces.filter(f => f.data.land && !f.data.border && f.data.aboveSea > 0.2);

  for (let r = 0; r < numRivers; r++) {
    const start = landFaces[Math.floor(Math.random() * landFaces.length)];
    if (!start) continue;

    const path = [start];
    const riverSet = new Set([start.index]);
    start.data.riverside = true;
    let current = start;
    const maxLen = 18 + Math.floor(Math.random() * 35);

    // Pre-compute sorted neighbors helper
    const scoredNeighbors = (cell) => {
      const candidates = cell.data._neighbors.filter(n => !riverSet.has(n.index));
      return candidates.map(n => {
        const hScore = n.data.level;
        const waterScore = (!n.data.land || n.data.coastal) ? 3 : 0;
        return { n, score: hScore * 0.55 + waterScore * 0.35 + Math.random() * 0.2 };
      }).sort((a, b) => a.score - b.score);
    };

    for (let s = 0; s < maxLen; s++) {
      const sn = scoredNeighbors(current);
      if (!sn.length) break;
      current = sn[0].n;
      if (!current.data.land) {
        current.data.terrain = TERRAIN.RIVER;
      } else {
        current.data.riverside = true;
      }
      riverSet.add(current.index);
      path.push(current);
      if (!current.data.land) break;
    }
  }
}
