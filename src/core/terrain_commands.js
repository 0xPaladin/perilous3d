import { findCellForPoint } from './voronoi.js';

/**
 * Parse and execute voronoi-based terrain commands.
 * Commands tag cells with types: land, water, hill, lake, range, trough.
 */

const CARDINAL_DIRS = {
  north: { axis: 'z', sign: 1, label: 'north' },
  south: { axis: 'z', sign: -1, label: 'south' },
  east: { axis: 'x', sign: 1, label: 'east' },
  west: { axis: 'x', sign: -1, label: 'west' },
  northeast: { axis: 'xz', signX: 1, signZ: 1, label: 'northeast' },
  northwest: { axis: 'xz', signX: -1, signZ: 1, label: 'northwest' },
  southeast: { axis: 'xz', signX: 1, signZ: -1, label: 'southeast' },
  southwest: { axis: 'xz', signX: -1, signZ: -1, label: 'southwest' },
};

const CORNER_LOCATIONS = {
  topleft: { nx: -1, nz: 1 },
  top: { nx: 0, nz: 1 },
  topright: { nx: 1, nz: 1 },
  left: { nx: -1, nz: 0 },
  center: { nx: 0, nz: 0 },
  right: { nx: 1, nz: 0 },
  bottomleft: { nx: -1, nz: -1 },
  bottom: { nx: 0, nz: -1 },
  bottomright: { nx: 1, nz: -1 },
};

function parseNamedLocation(str) {
  return CORNER_LOCATIONS[str.toLowerCase()] || null;
}

function isEdgeCell(idx, hullSet) {
  return hullSet.has(idx);
}

function cardinalFilter(cellX, cellZ, dir, extent) {
  const hw = extent.width / 2;
  const hh = extent.height / 2;
  if (dir.axis === 'xz') {
    return (cellX * dir.signX >= hw * 0.65 && cellZ * dir.signZ >= hh * 0.65);
  }
  if (dir.axis === 'x') return cellX * dir.sign >= hw * 0.65;
  if (dir.axis === 'z') return cellZ * dir.sign >= hh * 0.65;
  return false;
}

function bfsFill(startIdx, targetCount, cells, adj, validFn) {
  const n = cells.length;
  const visited = new Uint8Array(n);
  const queue = [startIdx];
  visited[startIdx] = 1;
  let head = 0;
  const tagged = [];

  while (head < queue.length && tagged.length < targetCount) {
    const cur = queue[head++];
    if (validFn(cur)) {
      tagged.push(cur);
    }
    for (const nb of adj[cur]) {
      if (!visited[nb]) {
        visited[nb] = 1;
        queue.push(nb);
      }
    }
  }
  return tagged;
}

function isLand(cell) { return cell.type === 'land' || cell.type === 'hill' || cell.type === 'range'; }

function lineCellsBetween(startLoc, stopLoc, cells, centroids, extent) {
  const sw = extent.width / 2;
  const sh = extent.height / 2;
  const sx = startLoc.nx * sw;
  const sz = startLoc.nz * sh;
  const ex = stopLoc.nx * sw;
  const ez = stopLoc.nz * sh;
  const dx = ex - sx;
  const dz = ez - sz;
  const len = Math.sqrt(dx * dx + dz * dz);
  if (len < 1) return [];
  const step = 1;
  const nSteps = Math.ceil(len / step);
  const visited = new Set();
  const result = [];
  for (let i = 0; i <= nSteps; i++) {
    const t = i / nSteps;
    const px = sx + dx * t;
    const pz = sz + dz * t;
    const ci = findCellForPoint(px, pz, centroids);
    if (!visited.has(ci)) {
      visited.add(ci);
      result.push(ci);
    }
  }
  return result;
}

/**
 * Process a list of voronoi command strings against voronoi cells.
 * Mutates cells in place, setting type, heightBase, and heightRange.
 */
export function processVoronoiCommands(commands, cells, centroids, adj, hullSet, rng, extent) {
  const n = cells.length;

  // Track which cells are land-candidates for hill/lake tagging
  const totalCells = n;

  // Sort edge cells by cardinal direction score for Land with cardinal constraint
  function cellDirScore(idx, dir) {
    const [cx, cz] = centroids[idx];
    if (dir.axis === 'xz') {
      return cx * dir.signX + cz * dir.signZ;
    }
    if (dir.axis === 'x') return cx * dir.sign;
    if (dir.axis === 'z') return cz * dir.sign;
    return 0;
  }

  for (const cmd of commands) {
    switch (cmd.type) {
      case 'land': {
        const targetCount = Math.round(cmd.pct * n);
        let seeds = [];

        if (cmd.constraint && CARDINAL_DIRS[cmd.constraint]) {
          const dir = CARDINAL_DIRS[cmd.constraint];
          const edgeCells = [];
          for (let i = 0; i < n; i++) {
            if (cardinalFilter(centroids[i][0], centroids[i][1], dir, extent)) {
              edgeCells.push({ idx: i, score: cellDirScore(i, dir) });
            }
          }
          edgeCells.sort((a, b) => b.score - a.score);
          const topEdge = edgeCells.slice(0, Math.max(1, Math.floor(n * 0.1)));
          for (const ec of topEdge) {
            cells[ec.idx].type = 'land';
            seeds.push(ec.idx);
            if (seeds.length >= targetCount) break;
          }
          if (seeds.length < targetCount) {
            const filled = bfsFill(seeds[0], targetCount - seeds.length, cells, adj,
              (i) => cells[i].type !== 'land');
            for (const fi of filled) {
              cells[fi].type = 'land';
              seeds.push(fi);
            }
          }
        } else if (cmd.constraint === 'noedge') {
          const candidates = [];
          for (let i = 0; i < n; i++) {
            if (!isEdgeCell(i, hullSet)) {
              candidates.push(i);
            }
          }
          if (candidates.length > 0) {
            const startIdx = candidates[Math.floor(rng() * candidates.length)];
            cells[startIdx].type = 'land';
            const candidateSet = new Set(candidates);
            const target = Math.max(1, Math.min(targetCount, candidates.length));
            const visited = new Uint8Array(n);
            const queue = [startIdx];
            visited[startIdx] = 1;
            let head = 0;
            const tagged = [];
            while (head < queue.length && tagged.length < target) {
              const cur = queue[head++];
              tagged.push(cur);
              for (const nb of adj[cur]) {
                if (!visited[nb] && candidateSet.has(nb)) {
                  visited[nb] = 1;
                  queue.push(nb);
                }
              }
            }
            for (const fi of tagged) {
              cells[fi].type = 'land';
            }
           }
        } else {
          const startIdx = Math.floor(rng() * n);
          cells[startIdx].type = 'land';
          const filled = bfsFill(startIdx, Math.max(1, Math.min(targetCount, n)), cells, adj,
            (i) => cells[i].type !== 'land');
          for (const fi of filled) {
            cells[fi].type = 'land';
          }
        }
        break;
      }

      case 'hill': {
        const landCells = [];
        for (let i = 0; i < n; i++) {
          if (isLand(cells[i])) landCells.push(i);
        }
        const targetCount = Math.max(1, Math.round(cmd.pct * landCells.length));
        let tagged = [];

        if (cmd.placement === 'neighbors') {
          const start = landCells[Math.floor(rng() * landCells.length)];
          cells[start].type = 'hill';
          cells[start].heightBase = 0.5;
          cells[start].heightRange = cmd.size * (0.5 + rng());
          tagged.push(start);
          const filled = bfsFill(start, targetCount - 1, cells, adj,
            (i) => isLand(cells[i]) && cells[i].type !== 'hill');
          for (const fi of filled) {
            cells[fi].type = 'hill';
            cells[fi].heightBase = 0.5;
            cells[fi].heightRange = cmd.size * (0.5 + rng());
            tagged.push(fi);
          }
        } else {
          const shuffled = landCells.slice().sort(() => rng() - 0.5);
          for (let k = 0; k < Math.min(targetCount, shuffled.length); k++) {
            const ci = shuffled[k];
            cells[ci].type = 'hill';
            cells[ci].heightBase = 0.5;
            cells[ci].heightRange = cmd.size * (0.5 + rng());
            tagged.push(ci);
          }
        }
        break;
      }

      case 'lake': {
        const landIdxs = [];
        for (let i = 0; i < n; i++) {
          if (isLand(cells[i])) landIdxs.push(i);
        }
        const targetCount = Math.max(1, Math.round(cmd.pct * landIdxs.length));

        if (cmd.placement === 'neighbors') {
          const start = landIdxs[Math.floor(rng() * landIdxs.length)];
          cells[start].type = 'water';
          cells[start].heightBase = -1;
          cells[start].heightRange = 1;
          const filled = bfsFill(start, Math.min(targetCount, landIdxs.length) - 1, cells, adj,
            (i) => isLand(cells[i]));
          for (const fi of filled) {
            cells[fi].type = 'water';
            cells[fi].heightBase = -1;
            cells[fi].heightRange = 1;
          }
        } else {
          const shuffled = landIdxs.slice().sort(() => rng() - 0.5);
          for (let k = 0; k < Math.min(targetCount, shuffled.length); k++) {
            const ci = shuffled[k];
            cells[ci].type = 'water';
            cells[ci].heightBase = -1;
            cells[ci].heightRange = 1;
          }
        }
        break;
      }

      case 'range':
      case 'trough': {
        const landIdxs = [];
        for (let i = 0; i < n; i++) {
          if (isLand(cells[i])) landIdxs.push(i);
        }
        if (landIdxs.length === 0) break;

        const startLoc = parseNamedLocation(cmd.start);
        const stopLoc = parseNamedLocation(cmd.stop);
        if (!startLoc || !stopLoc) break;

        const pathCells = lineCellsBetween(startLoc, stopLoc, cells, centroids, extent);
        const traverseCount = Math.max(1, Math.round(cmd.pct * pathCells.length));
        let traversed = 0;

        const isTrough = cmd.type === 'trough';
        for (const ci of pathCells) {
          if (traversed >= traverseCount) break;
          if (isLand(cells[ci])) {
            if (isTrough) {
              cells[ci].type = 'water';
              cells[ci].heightBase = -1;
              cells[ci].heightRange = 1;
            } else {
              cells[ci].type = 'range';
              cells[ci].heightBase = 0.5;
              cells[ci].heightRange = cmd.size * (0.5 + rng());
            }
            traversed++;
          }
        }
        break;
      }
    }
  }
}