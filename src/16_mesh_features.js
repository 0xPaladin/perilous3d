import * as THREE from 'three';
import { generateMountainTile, createMountainTileMesh } from './13_mesh_mountain.js';
import { generateForest } from './15_mesh_tree.js';

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

function sampleTerrainHeight(pts, heights, waterLevel, heightMax) {
  const maxLandH = Math.max(heightMax - waterLevel, 0.001);
  const HEIGHT_SCALE = 3.5;
  const s = HEIGHT_SCALE / maxLandH;
  return (x, z) => {
    const rawH = findNearestHeight(x, z, pts, heights);
    return Math.max(0, (rawH - waterLevel) * s);
  };
}

export function buildMeshMountains(region) {
  const { pts, heights, mounts, waterLevel, heightMax, seed } = region;
  const group = new THREE.Group();
  if (!mounts || mounts.length === 0) return group;

  const getY = sampleTerrainHeight(pts, heights, waterLevel, heightMax);

  for (let i = 0; i < mounts.length; i++) {
    const m = mounts[i];
    const mSeed = ((seed * 9301 + i * 49297 + 77777) % 233280) | 0;
    const prng = mulberry32(mSeed);

    const tileH = Math.max(0.5, m.r * 0.8);
    const tile = generateMountainTile(prng, 0, 0, tileH, 10);
    const mesh = createMountainTileMesh(tile, tileH);

    const xyScale = m.r / 3.5;
    const yScale = m.r * 0.35;
    mesh.scale.set(xyScale, yScale, xyScale);

    const yy = getY(m.x, m.y);
    mesh.position.set(m.x, yy, m.y);

    group.add(mesh);
  }

  return group;
}

export function buildMeshForests(region) {
  const { pts, heights, waterLevel, heightMax, seed } = region;
  const group = new THREE.Group();
  if (!pts) return group;

  const getY = sampleTerrainHeight(pts, heights, waterLevel, heightMax);
  const maxLandH = Math.max(heightMax - waterLevel, 0.001);

  const candidatePoints = [];
  for (let i = 0; i < pts.length; i++) {
    const rawH = heights[i] - waterLevel;
    if (rawH <= 0.01) continue;
    const normH = rawH / maxLandH;
    if (normH < 0.06 || normH > 0.55) continue;

    const density = normH < 0.35 ? 1 : (normH < 0.5 ? 0.6 : 0.2);
    if (hashFloat(pts[i][0], pts[i][1], seed) < density * 0.15) {
      candidatePoints.push(pts[i]);
    }
  }

  const CLUSTER_RADIUS = 8;
  const MIN_CLUSTER_SIZE = 8;
  const forestClusters = [];
  const used = new Uint8Array(candidatePoints.length);

  for (let i = 0; i < candidatePoints.length; i++) {
    if (used[i]) continue;
    const cx = candidatePoints[i][0], cy = candidatePoints[i][1];
    const cluster = [i];
    used[i] = 1;
    for (let j = i + 1; j < candidatePoints.length; j++) {
      if (used[j]) continue;
      const dx = candidatePoints[j][0] - cx, dy = candidatePoints[j][1] - cy;
      if (dx * dx + dy * dy < CLUSTER_RADIUS * CLUSTER_RADIUS) {
        cluster.push(j);
        used[j] = 1;
      }
    }
    if (cluster.length >= MIN_CLUSTER_SIZE) {
      let sumX = 0, sumZ = 0;
      for (const idx of cluster) { sumX += candidatePoints[idx][0]; sumZ += candidatePoints[idx][1]; }
      forestClusters.push({
        cx: sumX / cluster.length,
        cz: sumZ / cluster.length,
        count: Math.min(cluster.length * 2, 120),
        radius: Math.sqrt(cluster.length) * 1.5,
      });
    }
  }

  for (let ci = 0; ci < forestClusters.length; ci++) {
    const fc = forestClusters[ci];
    const fSeed = ((seed * 73 + ci * 131 + 12345) % 233280) | 0;
    const prng = mulberry32(fSeed);
    const yy = getY(fc.cx, fc.cz);
    const forest = generateForest(prng, fc.cx, fc.cz, fc.count, fc.radius, 1.5 + prng() * 1.5);
    forest.position.y = yy;
    group.add(forest);
  }

  return group;
}
