import { generatePlaceName, resolveFeatures } from './features.js';

//import constants from config
import {TROUBLE_TYPES} from "./config.js";
import { buildBiomes, computeHabitability } from './biomes.js';
import { generatePeoples } from '../people/people.js';
import { buildDisplayFromState } from '../core/terrain_builder.js';

function pick(arr, rng) { return arr[Math.floor(rng() * arr.length)]; }

export function createRng(seed) {
  let s = seed | 0;
  return function () {
    s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function findCities(pts, heights, waterLevel, habitability, nearWater, nearResource, count, rngSeed) {
  if (count <= 0) return [];
  const rng = createRng(rngSeed ^ 0xDEAD);
  const minDistSq = 32 * 32;

  const landCells = [];
  for (let i = 0; i < pts.length; i++) {
    if (heights[i] > waterLevel && habitability[i] > 0) {
      landCells.push({ idx: i, score: habitability[i] + (nearWater[i] ? 20 : 0) + (nearResource ? nearResource[i] ? 15 : 0 : 0) });
    }
  }
  landCells.sort((a, b) => b.score - a.score);

  const topN = Math.floor(Math.max(landCells.length * 0.2, count * 3));
  const candidates = landCells.slice(0, Math.min(topN, landCells.length));

  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  const cities = [];
  for (const c of candidates) {
    if (cities.length >= count) break;
    const cx = pts[c.idx][0], cz = pts[c.idx][1];
    let ok = true;
    for (const city of cities) {
      const dx = cx - city.x, dz = cz - city.z;
      if (dx * dx + dz * dz < minDistSq) { ok = false; break; }
    }
    if (ok) {
      cities.push({ x: cx, z: cz, idx: c.idx, habitability: c.score });
    }
  }

  return cities;
}

export function findTowns(cities, pts, heights, waterLevel, habitability, nearWater, nearResource, count, rngSeed) {
  const rng = createRng(rngSeed ^ 0xBEEF);
  const minDistSq = 25 * 25;
  const towns = [];

  const score = (idx) => habitability[idx] + (nearWater[idx] ? 20 : 0) + (nearResource ? nearResource[idx] ? 15 : 0 : 0);

  if (cities.length === 0) {
    const landCells = [];
    for (let i = 0; i < pts.length; i++) {
      if (heights[i] > waterLevel && habitability[i] > 0) landCells.push({ idx: i, score: score(i) });
    }
    landCells.sort((a, b) => b.score - a.score);
    for (const c of landCells) {
      if (towns.length >= 4) break;
      const cx = pts[c.idx][0], cz = pts[c.idx][1];
      let ok = true;
      for (const t of towns) {
        const dx = cx - t.x, dz = cz - t.z;
        if (dx * dx + dz * dz < minDistSq) { ok = false; break; }
      }
      if (ok) towns.push({ x: cx, z: cz, idx: c.idx, habitability: c.score });
    }
  } else {
    const RADIUS = 30;
    const RADIUS_SQ = RADIUS * RADIUS;
    const needed = count * 3;
    for (const city of cities) {
      if (towns.length >= needed) break;
      let candidates = [];
      for (let i = 0; i < pts.length; i++) {
        if (heights[i] <= waterLevel) continue;
        const dx = pts[i][0] - city.x, dz = pts[i][1] - city.z;
        if (dx * dx + dz * dz > RADIUS_SQ) continue;
        candidates.push({ idx: i, score: score(i) });
      }
      candidates.sort((a, b) => b.score - a.score);
      for (const c of candidates) {
        if (towns.length >= needed) break;
        const tx = pts[c.idx][0], tz = pts[c.idx][1];
        let ok = true;
        for (const t of towns) {
          const dx = tx - t.x, dz = tz - t.z;
          if (dx * dx + dz * dz < minDistSq) { ok = false; break; }
        }
        if (ok) towns.push({ x: tx, z: tz, idx: c.idx, habitability: c.score });
      }
    }
  }

  return towns;
}

export function findRuins(pts, heights, waterLevel, habitability, cities, towns, count, rngSeed) {
  const rng = createRng(rngSeed ^ 0xDADE);
  const minDistSq = 30 * 30;
  const farSq = 60 * 60;
  const ruins = [];
  const n = 1 + Math.floor(rng() * 2);
  const occupied = (x, z) => {
    for (const s of [...cities, ...towns]) {
      const dx = x - s.x, dz = z - s.z;
      if (dx * dx + dz * dz < minDistSq * 2) return true;
    }
    return false;
  };
  const nearSettlement = (x, z) => {
    for (const s of [...cities, ...towns]) {
      const dx = x - s.x, dz = z - s.z;
      if (dx * dx + dz * dz < farSq) return true;
    }
    return false;
  };

  const landCells = [];
  for (let i = 0; i < pts.length; i++) {
    if (heights[i] <= waterLevel) continue;
    const x = pts[i][0], z = pts[i][1];
    if (occupied(x, z)) continue;
    if (!nearSettlement(x, z)) continue;
    landCells.push({ idx: i, score: habitability[i] + rng() * 10 });
  }
  landCells.sort((a, b) => b.score - a.score);

  for (const c of landCells) {
    if (ruins.length >= n) break;
    const cx = pts[c.idx][0], cz = pts[c.idx][1];
    let ok = true;
    for (const r of ruins) {
      const dx = cx - r.x, dz = cz - r.z;
      if (dx * dx + dz * dz < minDistSq) { ok = false; break; }
    }
    if (ok) ruins.push({ x: cx, z: cz, idx: c.idx, habitability: c.score, name: generatePlaceName(rng) });
  }

  return ruins;
}

export function findMinorRuins(pts, heights, waterLevel, count, rngSeed) {
  const rng = createRng(rngSeed ^ 0xDEAD);
  const minDistSq = 20 * 20;
  const n = (count != null && count > 0) ? count : (4 + Math.floor(rng() * 6) + 1);
  const minorRuins = [];

  const landCells = [];
  for (let i = 0; i < pts.length; i++) {
    if (heights[i] > waterLevel) landCells.push(i);
  }

  for (let attempt = 0; attempt < n * 20 && minorRuins.length < n; attempt++) {
    const idx = landCells[Math.floor(rng() * landCells.length)];
    const x = pts[idx][0], z = pts[idx][1];
    let ok = true;
    for (const r of minorRuins) {
      const dx = x - r.x, dz = z - r.z;
      if (dx * dx + dz * dz < minDistSq) { ok = false; break; }
    }
    if (ok) minorRuins.push({ x, z, idx, name: generatePlaceName(rng) });
  }

  return minorRuins;
}

export function findTrouble(pts, heights, waterLevel, habitability, cities, towns, resources, ruins, safety, areaRatio, rngSeed) {
  const rng = createRng(rngSeed ^ 0xEED);
  const trouble = [];
  const minDistSq = 36 * 36;

  function addTrouble(x, z, idx, type) {
    for (const s of [...cities, ...towns]) {
      const dx = x - s.x, dz = z - s.z;
      if (dx * dx + dz * dz < 15 * 15) return false;
    }
    for (const t of trouble) {
      const dx = x - t.x, dz = z - t.z;
      if (dx * dx + dz * dz < minDistSq) return false;
    }
    trouble.push({ x, z, idx, type });
    return true;
  }

  for (const res of resources) {
    const candidates = [];
    for (let i = 0; i < pts.length; i++) {
      if (heights[i] <= waterLevel) continue;
      const dx = pts[i][0] - res.x, dz = pts[i][1] - res.z;
      if (dx * dx + dz * dz > 20 * 20) continue;
      candidates.push({ idx: i, score: -habitability[i] });
    }
    candidates.sort((a, b) => a.score - b.score);
    for (const c of candidates) {
      if (addTrouble(pts[c.idx][0], pts[c.idx][1], c.idx, pick(TROUBLE_TYPES, rng))) break;
    }
  }

  const additional = Math.max(0, Math.round((3 - safety) * 2 * areaRatio));
  const halfNear = Math.floor(additional / 2);

  for (let k = 0; k < halfNear; k++) {
    const candidates = [];
    for (const s of [...cities, ...towns]) {
      for (let i = 0; i < pts.length; i++) {
        if (heights[i] <= waterLevel) continue;
        const dx = pts[i][0] - s.x, dz = pts[i][1] - s.z;
        if (dx * dx + dz * dz > 30 * 30) continue;
        candidates.push({ idx: i, score: -habitability[i] });
      }
    }
    candidates.sort((a, b) => a.score - b.score);
    for (const c of candidates) {
      if (addTrouble(pts[c.idx][0], pts[c.idx][1], c.idx, pick(TROUBLE_TYPES, rng))) break;
    }
  }

  const halfRuins = additional - halfNear;
  for (let k = 0; k < halfRuins && k < ruins.length; k++) {
    const r = ruins[k];
    if (addTrouble(r.x, r.z, r.idx, pick(TROUBLE_TYPES, rng))) continue;
  }

  return trouble;
}

// ---- Feature placement helpers ----

export function placeSiteFeature(pts, heights, waterLevel, cities, towns, rng, excludeSites) {
  const minDistSq = 15 * 15;
  const landCells = [];
  for (let i = 0; i < pts.length; i++) {
    if (heights[i] <= waterLevel) continue;
    const x = pts[i][0], z = pts[i][1];
    let ok = true;
    for (const s of [...cities, ...towns]) {
      const dx = x - s.x, dz = z - s.z;
      if (dx * dx + dz * dz < minDistSq) { ok = false; break; }
    }
    if (!ok) continue;
    if (excludeSites) {
      for (const s of excludeSites) {
        const dx = x - s.x, dz = z - s.z;
        if (dx * dx + dz * dz < minDistSq) { ok = false; break; }
      }
    }
    if (ok) landCells.push({ idx: i, x, z });
  }
  if (landCells.length === 0) return null;
  return landCells[Math.floor(rng() * landCells.length)];
}

export function findCellsByTerrain(terrain, pts, heights, waterLevel, biome, rivers, maxLandH) {
  const cells = [];
  let maxFlux = 0;
  for (let i = 0; i < pts.length; i++) if (rivers.flux[i] > maxFlux) maxFlux = rivers.flux[i];
  if (maxFlux === 0) maxFlux = 1;
  const riverThreshold = maxFlux * 0.1;

  for (let i = 0; i < pts.length; i++) {
    const h = heights[i];
    if (h <= waterLevel) {
      if (terrain === 'water') cells.push(i);
      continue;
    }
    const normH = Math.min((h - waterLevel) / maxLandH, 1.0);
    if (terrain === 'mountains') {
      if (normH > 0.35) cells.push(i);
    } else if (terrain === 'hills') {
      if (normH >= 0.15 && normH <= 0.35) cells.push(i);
    } else if (terrain === 'forest') {
      if (biome && [5, 6, 7, 8, 9].includes(biome[i])) cells.push(i);
    } else if (terrain === 'river') {
      if (rivers.flux[i] > riverThreshold) cells.push(i);
    } else if (terrain === 'land') {
      const isMountains = normH > 0.35;
      const isHills = normH >= 0.15 && normH <= 0.35;
      const isForest = biome && [5, 6, 7, 8, 9].includes(biome[i]);
      const isRiver = rivers.flux[i] > riverThreshold;
      if (!isMountains && !isHills && !isForest && !isRiver) cells.push(i);
    }
  }
  return cells;
}

export function findNeighborCells(idx, adj, pts, maxDistKm) {
  const maxDistSq = maxDistKm * maxDistKm;
  const nbs = [];
  for (const j of adj[idx]) {
    const dx = pts[idx][0] - pts[j][0];
    const dz = pts[idx][1] - pts[j][1];
    if (dx * dx + dz * dz <= maxDistSq) nbs.push(j);
  }
  return nbs;
}


export function findMountainPeaks(pts, heights, waterLevel, heightMax, adj, extent, biome) {
  const HILL_THRESHOLD = 0.65;
  const maxLandH = Math.max(1.0 - waterLevel, 0.001);
  const halfW = extent.width / 2;
  const halfH = extent.height / 2;
  const candidates = [];
  for (let i = 0; i < pts.length; i++) {
    if (heights[i] <= waterLevel) continue;
    const localH = heights[i] - waterLevel;
    if (localH <= 0) continue;
    const normH = Math.min(localH / maxLandH, 1.0);
    if (normH <= HILL_THRESHOLD) continue;
    //must be glacial
    if (biome && biome[i] !== 11) continue;
    let isPeak = true;
    for (const j of adj[i]) {
      if (heights[j] > heights[i]) { isPeak = false; break; }
    }
    if (!isPeak) continue;
    const px = pts[i][0], py = pts[i][1];
    if (Math.abs(px) > halfW || Math.abs(py) > halfH) continue;
    candidates.push({ idx: i, normH, x: px, y: py });
  }
  candidates.sort((a, b) => b.normH - a.normH);
  const areaRatio = (extent.width / 320) ** 2;
  const maxMounts = Math.max(5, Math.round(25 * areaRatio));
  const mounts = [];
  for (let i = 0; i < Math.min(maxMounts, candidates.length); i++) {
    const c = candidates[i];
    const peakHeight = heights[c.idx] - waterLevel;
    const r = 3 + (c.normH - HILL_THRESHOLD) * 8;
    mounts.push({ x: c.x, y: c.y, r, peakHeight, _idx: c.idx });
  }
  return mounts;
}

export function buildRegion(template, cols, rows, seed, terrainType, baseTemp = 22, cityCount = 0, extentSize = 320, waterLevel = 0.5) {
  const rng = createRng(seed);
  const extent = { width: extentSize, height: extentSize };
  const areaRatio = (extentSize / 320) ** 2;

  // Build state object for voronoi pipeline
  const state_in = { seed, extent, waterLevel, template, terrain: terrainType, baseTemp, cityCount };

  // Run voronoi-based display builder
  const { display: voronoiDisplay, h, pts, adj, rivers, biome, maxLandH, habitability, nearWater, heightMax } = buildDisplayFromState(state_in);
  const mounts = findMountainPeaks(pts, h, voronoiDisplay.waterLevel, heightMax, adj, voronoiDisplay.extent, biome);
  voronoiDisplay.mounts = mounts;
  voronoiDisplay.mountainCount = mounts.length;

  const {
    resources,
    cities,
    towns,
    ruins,
    minorRuins,
    trouble,
    features,
    outpostSites,
    landmarkSites,
    factionSites,
    hazards,
    obstacles,
    areas,
  } = resolveFeatures({
    rng,
    pts,
    h,
    waterLevel: 0,
    biome,
    maxLandH,
    habitability,
    nearWater,
    adj,
    rivers,
    cityCount,
    extentSize,
    areaRatio,
    seed
  });

  const peoples = generatePeoples(seed, { template, terrain: terrainType, baseTemp });

  const regionState = {
    seed,
    extent,
    waterLevel,
    template,
    terrain: terrainType,
    baseTemp,
    cityCount,
    cities,
    towns,
    resources,
    ruins,
    minorRuins,
    trouble,
    features,
    outpostSites,
    landmarkSites,
    factionSites,
    hazards,
    obstacles,
    areas,
    peoples,
  };

  return { display: voronoiDisplay, state: regionState };
}
