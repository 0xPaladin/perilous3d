import * as THREE from 'three';
import { generateMountainTile, createMountainTileMesh } from './mesh_mountain.js';
import { generateHillTile, createTerrainTileMesh, HILL_PALETTE } from './mesh_terrain.js';
import { generateForest } from './mesh_tree.js';

function mulberry32(seed) {
  let s = seed | 0;
  return function() {
    s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function hashFloat(x, y, seed) {
  let h = (seed * 9301 + 49297) % 233280;
  h = ((h ^ (x * 0x45d9f3b)) + (y * 0x27d1e3d)) | 0;
  return ((h >>> 0) % 100000) / 100000;
}

function findNearestHeight(x, z, pts, heights) {
  let bestSq = Infinity, bestH = 0;
  for (let i = 0; i < pts.length; i++) {
    const dx = pts[i][0] - x, dz = pts[i][1] - z;
    const dSq = dx * dx + dz * dz;
    if (dSq < bestSq) { bestSq = dSq; bestH = heights[i]; }
  }
  return bestH;
}

const HILL_THRESHOLD = 0.65;
const HEIGHT_SCALE = 3.5;

export function buildMeshMountains(region) {
  const { pts, heights, waterLevel, heightMax, mounts, seed, adj, extent } = region;
  const group = new THREE.Group();
  group.name = 'meshMountains';
  if (!mounts || !pts || !heights || !adj) return group;

  const maxLandH = Math.max(heightMax - waterLevel, 0.001);
  const hw = (extent?.width || 320) / 2;
  const hh = (extent?.height || 320) / 2;
  const placed = [];

  for (const m of mounts) {
    if (m.peakHeight <= 0) continue;
    if (m.r <= 0) continue;

    const h = findNearestHeight(m.x, m.y, pts, heights);
    if (h <= waterLevel) continue;
    const normH = (h - waterLevel) / maxLandH;
    if (normH <= HILL_THRESHOLD) continue;

    const rng = mulberry32((seed + (m._idx || 0) * 173 + 991) | 0);
    const tile = generateMountainTile(rng, 0, 0, m.peakHeight);
    const mesh = createMountainTileMesh(tile, m.peakHeight);
    mesh.position.set(m.x, 0.0, m.y);
    mesh.scale.set(m.r / 3.5, m.r * 0.35, m.r / 3.5);
    const halfSize = m.r + tile.gridSize / 2;
    if (mesh.position.x + halfSize < -hw || mesh.position.x - halfSize > hw ||
        mesh.position.z + halfSize < -hh || mesh.position.z - halfSize > hh) continue;
    group.add(mesh);
    placed.push({ x: m.x, y: m.y, r: m.r });
  }

  const extentSize = extent?.width || 320;
  const areaRatio = (extentSize / 320) ** 2;
  const maxAuto = Math.max(5, Math.round(25 * areaRatio));

  const candidates = [];
  for (let i = 0; i < pts.length; i++) {
    if (heights[i] <= waterLevel) continue;
    const localH = heights[i] - waterLevel;
    if (localH <= 0) continue;
    const normH = localH / maxLandH;
    if (normH <= HILL_THRESHOLD) continue;

    let isPeak = true;
    for (const j of adj[i]) {
      if (heights[j] > heights[i]) { isPeak = false; break; }
    }
    if (!isPeak) continue;

    const px = pts[i][0], py = pts[i][1];
    if (Math.abs(px) > hw || Math.abs(py) > hh) continue;

    candidates.push({ idx: i, normH, x: px, y: py });
  }

  candidates.sort((a, b) => b.normH - a.normH);

  let autoCount = 0;
  for (const c of candidates) {
    if (autoCount >= maxAuto) break;

    let near = false;
    for (const p of placed) {
      const dx = c.x - p.x, dz = c.y - p.y;
      const minD = Math.max(p.r * 1.5, 3);
      if (dx * dx + dz * dz < minD * minD) { near = true; break; }
    }
    if (near) continue;

    const h = heights[c.idx];
    const peakHeight = h - waterLevel;
    const r = 3 + (c.normH - HILL_THRESHOLD) * 8;
    const rng = mulberry32((seed + c.idx * 173 + 991) | 0);
    const tile = generateMountainTile(rng, 0, 0, peakHeight);
    const mesh = createMountainTileMesh(tile, peakHeight);
    mesh.position.set(c.x, 0.0, c.y);
    mesh.scale.set(r / 3.5, r * 0.35, r / 3.5);
    group.add(mesh);
    placed.push({ x: c.x, y: c.y, r });
    autoCount++;
  }

  return group;
}

const FOREST_DENSITY = [0, 0, 0, 0.2, 0.2, 0.7, 0.7, 1.0, 1.0, 0.5, 0.05, 0, 0.4];

export function buildMeshForests(region) {
  const { pts, heights, rawHeights, waterLevel, heightMax, biome, seed, extent } = region;
  const group = new THREE.Group();
  if (!pts || !biome) return group;

  const extentSize = extent?.width || 320;
  const extentScale = extentSize / 320;
  const maxLandH = Math.max(heightMax - waterLevel, 0.001);

  const candidatePoints = [];
  const candidateBiomes = [];
  for (let i = 0; i < pts.length; i++) {
    const rawH = heights[i] - waterLevel;
    if (rawH <= 0.01) continue;
    const normH = rawH / maxLandH;
    if (normH > 0.80) continue;

    const b = biome[i];
    const density = FOREST_DENSITY[b] || 0;

    if (density > 0 && hashFloat(pts[i][0], pts[i][1], seed) < density * 0.5) {
      candidatePoints.push(pts[i]);
      candidateBiomes.push(b);
    }
  }

  const CLUSTER_RADIUS = 8 * extentScale;
  const MIN_CLUSTER_SIZE = Math.max(3, Math.round(5 * extentScale));
  const forestClusters = [];
  const used = new Uint8Array(candidatePoints.length);

  for (let i = 0; i < candidatePoints.length; i++) {
    if (used[i]) continue;
    const cluster = [i];
    used[i] = 1;
    let cx = candidatePoints[i][0], cy = candidatePoints[i][1];
    let changed = true;
    while (changed) {
      changed = false;
      for (let j = 0; j < candidatePoints.length; j++) {
        if (used[j]) continue;
        const dx = candidatePoints[j][0] - cx, dy = candidatePoints[j][1] - cy;
        if (dx * dx + dy * dy < CLUSTER_RADIUS * CLUSTER_RADIUS) {
          used[j] = 1;
          cluster.push(j);
          let sumX = 0, sumZ = 0;
          for (const idx of cluster) { sumX += candidatePoints[idx][0]; sumZ += candidatePoints[idx][1]; }
          cx = sumX / cluster.length;
          cy = sumZ / cluster.length;
          changed = true;
        }
      }
    }
    if (cluster.length >= MIN_CLUSTER_SIZE) {
      let sumX = 0, sumZ = 0;
      const biomeCounts = {};
      for (const idx of cluster) {
        sumX += candidatePoints[idx][0];
        sumZ += candidatePoints[idx][1];
        const b = candidateBiomes[idx];
        biomeCounts[b] = (biomeCounts[b] || 0) + 1;
      }
      let dominantBiome = 4;
      let maxCount = 0;
      for (const b in biomeCounts) {
        if (biomeCounts[b] > maxCount) { maxCount = biomeCounts[b]; dominantBiome = parseInt(b); }
      }
      forestClusters.push({
        cx: sumX / cluster.length,
        cz: sumZ / cluster.length,
        count: Math.min(cluster.length * 2, 120),
        radius: Math.sqrt(cluster.length) * 1.5,
        biome: dominantBiome,
      });
    }
  }

  const settlements = (region.cities || []).concat(region.towns || []);
  const RUIN_RADIUS_SQ = 5 * 5;
  const CLEAR_RADIUS_SQ = 5 * 5;
  const MINOR_RUIN_RADIUS_SQ = 3 * 3;

  for (let ci = 0; ci < forestClusters.length; ci++) {
    const fc = forestClusters[ci];

    const centroidH = findNearestHeight(fc.cx, fc.cz, pts, heights);
    if (centroidH <= waterLevel) continue;

    let obstructed = false;
    for (const s of settlements) {
      const dx = fc.cx - s.x, dz = fc.cz - s.z;
      if (dx * dx + dz * dz < CLEAR_RADIUS_SQ) { obstructed = true; break; }
    }
    if (!obstructed && region.ruins) {
      for (const r of region.ruins) {
        const dx = fc.cx - r.x, dz = fc.cz - r.z;
        if (dx * dx + dz * dz < RUIN_RADIUS_SQ) { obstructed = true; break; }
      }
    }
    if (!obstructed && region.minorRuins) {
      for (const r of region.minorRuins) {
        const dx = fc.cx - r.x, dz = fc.cz - r.z;
        if (dx * dx + dz * dz < MINOR_RUIN_RADIUS_SQ) { obstructed = true; break; }
      }
    }
    if (obstructed) continue;

    const fSeed = ((seed * 73 + ci * 131 + 12345) % 233280) | 0;
    const prng = mulberry32(fSeed);
    const forest = generateForest(prng, fc.cx, fc.cz, fc.count, fc.radius, 1.5 + prng() * 1.5, { biome: fc.biome });
    const forestBaseY = centroidH > waterLevel ? (findNearestHeight(fc.cx, fc.cz, pts, rawHeights) * 3.0) : 0.0;
    forest.position.y = forestBaseY;
    group.add(forest);
  }

  return group;
}
