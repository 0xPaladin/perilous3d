import { generatePlaceName, resolveFeatures } from './features.js';

//import constants from config
import {TROUBLE_TYPES} from "./config.js";
import { buildBiomes, computeHabitability, downhill, zero } from './biomes.js';
import { generatePeoples } from '../people/people.js';
import { buildDisplayFromState } from '../core/terrain_builder.js';

export function createRng(seed) {
  let s = seed | 0;
  return function () {
    s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function runif(lo, hi, rng) { return lo + rng() * (hi - lo); }

function pick(arr, rng) { return arr[Math.floor(rng() * arr.length)]; }

const lerp = (start, end, t) => start + (end - start) * t;

function rnormFactory(rng) {
  let z2 = null;
  return function () {
    if (z2 !== null) { const t = z2; z2 = null; return t; }
    let x1, x2, w = 2;
    while (w >= 1) { x1 = runif(-1, 1, rng); x2 = runif(-1, 1, rng); w = x1 * x1 + x2 * x2; }
    w = Math.sqrt(-2 * Math.log(w) / w);
    z2 = x2 * w;
    return x1 * w;
  };
}

function randomVector(scale, rng) {
  const n = rnormFactory(rng);
  return [scale * n(), scale * n()];
}

function generatePoints(n, extent, rng) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    pts.push([runif(-extent.width / 2, extent.width / 2, rng), runif(-extent.height / 2, extent.height / 2, rng)]);
  }
  return pts;
}

function buildAdjacency(delaunay, n) {
  const { triangles, halfedges } = delaunay;
  const adj = Array.from({ length: n }, () => []);
  const seen = Array.from({ length: n }, () => new Set());
  for (let i = 0; i < triangles.length; i++) {
    const a = triangles[i];
    const b = triangles[(i % 3 === 2) ? i - 2 : i + 1];
    if (!seen[a].has(b)) { seen[a].add(b); adj[a].push(b); }
    if (!seen[b].has(a)) { seen[b].add(a); adj[b].push(a); }
  }
  return adj;
}


function quantile(arr, q) {
  const s = new Float64Array(arr);
  s.sort();
  const idx = q * (s.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return s[lo] + (idx - lo) * (s[hi] - s[lo]);
}

function parseCommand(str) {
  const parts = str.trim().split(/\s+/);
  const type = parts[0].toLowerCase();
  switch (type) {
    case 'hill':
    case 'pit': {
      const rest = str.slice(parts[0].length).trim();
      const vals = rest.split(',').map(s => s.trim());
      const count = parseInt(vals[0], 10);
      const heightOrDepth = parseFloat(vals[1]);
      const xRange = vals[2].split('-').map(s => parseInt(s, 10) / 100);
      const yRange = vals[3].split('-').map(s => parseInt(s, 10) / 100);
      return {
        type,
        count,
        [type === 'hill' ? 'height' : 'depth']: heightOrDepth,
        xMin: xRange[0], xMax: xRange[1],
        yMin: yRange[0], yMax: yRange[1],
      };
    }
    case 'range':
    case 'trough': {
      const rest = str.slice(parts[0].length).trim();
      const vals = rest.split(',').map(s => s.trim());
      const heightOrDepth = parseFloat(vals[0]);
      const x1 = parseInt(vals[1], 10) / 100;
      const y1 = parseInt(vals[2], 10) / 100;
      const x2 = parseInt(vals[3], 10) / 100;
      const y2 = parseInt(vals[4], 10) / 100;
      return {
        type,
        [type === 'range' ? 'height' : 'depth']: heightOrDepth,
        x1, y1, x2, y2,
      };
    }
    case 'apply':
      return { type: 'apply' };
    case 'scale':
      return { type: 'scale', value: parseFloat(parts[1]) };
    case 'rainfall':
      return { type: 'rainfall', value: parseFloat(parts[1]) };
    case 'radius':
      return { type: 'radius', value: parseFloat(parts[1]) };
    case 'ratio': {
      const val = parts.length > 1 ? parseFloat(parts[1]) : 1;
      return { type: 'ratio', value: val };
    }
    case 'islandmask': {
      const mix = parts.length > 1 ? parseFloat(parts[1]) : 0.5;
      return { type: 'islandmask', mix };
    }
    default:
      console.warn('Unknown command:', type);
      return null;
  }
}

function generateHillFeatures(extent, rng, count, height, xMin, xMax, yMin, yMax, isPit, state) {
  const sizeScale = extent.width / 320;
  const halfW = extent.width / 2, halfH = extent.height / 2;
  const xLo = -halfW + xMin * extent.width, xHi = -halfW + xMax * extent.width;
  const yLo = -halfH + yMin * extent.height, yHi = -halfH + yMax * extent.height;
  const mounts = [];
  for (let i = 0; i < count; i++) {
    const mx = runif(xLo, xHi, rng), my = runif(yLo, yHi, rng);
    const diameter = runif(8, 22, rng) * sizeScale * state.radiusScale;
    mounts.push({ x: mx, y: my, r: diameter / 2, peakHeight: height });
  }
  return mounts;
}

function generateRidgeFeature(pts, extent, rng, height, x1, y1, x2, y2, isTrough, state) {
  const sizeScale = extent.width / 320;
  const halfW = extent.width / 2, halfH = extent.height / 2;
  const sx = -halfW + x1 * extent.width, sy = -halfH + y1 * extent.height;
  const ex = -halfW + x2 * extent.width, ey = -halfH + y2 * extent.height;
  const dx = ex - sx, dy = ey - sy;
  const ridgeLen = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);
  const cosA = Math.cos(angle), sinA = Math.sin(angle);
  const cx = (sx + ex) / 2, cy = (sy + ey) / 2;
  const ridgeH = height;
  const ridgeWidth = Math.abs(height) * 4 * sizeScale * state.radiusScale;
  const wiggleAmp = ridgeWidth * runif(0.5, 1.0, rng);
  const wiggleFreq = runif(1.5, 3.5, rng);
  const wigglePhase = rng() * Math.PI * 2;
  const peakSpacing = 6;
  const peakCount = Math.max(3, Math.round(ridgeLen / peakSpacing));
  const peakMounts = [];
  for (let i = 0; i < peakCount; i++) {
    const t = (i + 0.5) / peakCount;
    const alongOffset = (t - 0.5) * ridgeLen;
    const wiggle = Math.sin(t * wiggleFreq * Math.PI * 2 + wigglePhase) * wiggleAmp;
    const perpJitter = runif(-0.3, 0.3, rng) * wiggleAmp;
    const mx = cx + alongOffset * cosA - (wiggle + perpJitter) * sinA;
    const my = cy + alongOffset * sinA + (wiggle + perpJitter) * cosA;
    const alongFactor = 1 - 0.6 * (2 * Math.abs(t - 0.5));
    const peakR = runif(3, 6, rng) * sizeScale * state.radiusScale;
    peakMounts.push({ x: mx, y: my, r: peakR, peakHeight: height * alongFactor });
  }
  const spurInterval = 20;
  const nSpurs = Math.max(1, Math.round(ridgeLen / spurInterval));
  const spurData = [];
  for (let i = 0; i < nSpurs; i++) {
    const t = (i + 1) / (nSpurs + 1);
    const perpDir = rng() < 0.5 ? -1 : 1;
    const spurLen = runif(12, 30, rng) * sizeScale;
    const spurH = height * runif(0.7, 1.0, rng);
    const spurW = ridgeWidth * runif(0.4, 0.7, rng);
    const wiggle = Math.sin(t * wiggleFreq * Math.PI * 2 + wigglePhase) * wiggleAmp;
    const spurCx = cx + (t - 0.5) * ridgeLen * cosA - wiggle * sinA;
    const spurCy = cy + (t - 0.5) * ridgeLen * sinA + wiggle * cosA;
    const spurAngle = angle + perpDir * Math.PI / 2;
    spurData.push({
      sx: spurCx, sy: spurCy,
      ex: spurCx + Math.cos(spurAngle) * spurLen,
      ey: spurCy + Math.sin(spurAngle) * spurLen,
      cosA: Math.cos(spurAngle), sinA: Math.sin(spurAngle),
      len: spurLen, height: spurH, width: spurW,
    });
    const midT = 0.5;
    const mdx = Math.cos(spurAngle) * spurLen * midT;
    const mdy = Math.sin(spurAngle) * spurLen * midT;
    const spR = runif(2, 5, rng) * sizeScale * state.radiusScale;
    const spH = spurH * 0.6;
    peakMounts.push({ x: spurCx + mdx * 0.6, y: spurCy + mdy * 0.6, r: spR, peakHeight: spH });
    peakMounts.push({ x: spurCx + mdx, y: spurCy + mdy, r: spR * 0.7, peakHeight: spH * 0.8 });
  }
  const ridgeData = { cx, cy, cosA, sinA, len: ridgeLen, height: ridgeH, width: ridgeWidth, wiggleAmp, wiggleFreq, wigglePhase };
  return { ridgeData, spurData, peakMounts };
}

function applyQueue(h, pts, queue, state) {
  const scale = state.scale;
  for (const m of queue.mounts) {
    if (m.r <= 0) continue;
    for (let i = 0; i < pts.length; i++) {
      const dx = pts[i][0] - m.x, dy = pts[i][1] - m.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < m.r) {
        h[i] += m.peakHeight * scale * (1 - d / m.r);
      }
    }
  }
  const rd = queue.ridgeData;
  if (rd) {
    for (let i = 0; i < pts.length; i++) {
      const dx = pts[i][0] - rd.cx, dy = pts[i][1] - rd.cy;
      const along = (dx * rd.cosA + dy * rd.sinA) / rd.len + 0.5;
      if (along >= -0.1 && along <= 1.1) {
        const basePerp = (-dx * rd.sinA + dy * rd.cosA);
        const wiggle = Math.sin(along * rd.wiggleFreq * Math.PI * 2 + rd.wigglePhase) * rd.wiggleAmp;
        const perp = basePerp - wiggle;
        const alongProfile = Math.exp(-6 * (along - 0.5) * (along - 0.5));
        const crossSection = Math.exp(-perp * perp / (2 * rd.width * rd.width));
        h[i] += rd.height * scale * alongProfile * crossSection;
      }
    }
  }
  for (const spur of queue.spurData) {
    for (let i = 0; i < pts.length; i++) {
      const sdx = pts[i][0] - spur.sx, sdy = pts[i][1] - spur.sy;
      const sAlong = (sdx * spur.cosA + sdy * spur.sinA) / spur.len;
      if (sAlong >= 0 && sAlong <= 1.2) {
        const sPerp = (-sdx * spur.sinA + sdy * spur.cosA);
        const sRamp = sAlong < 0.2 ? sAlong / 0.2 : 1.0;
        const sPlateau = sAlong <= 0.65 ? 1.0 : Math.max(0, 1 - (sAlong - 0.65) / 0.55);
        const sProfile = sRamp * sPlateau;
        const sCross = Math.exp(-sPerp * sPerp / (2 * spur.width * spur.width));
        h[i] += spur.height * scale * sProfile * sCross;
      }
    }
  }
}

function processTerrainCommands(commands, pts, extent, rng, state, baseHeights) {
  const h = new Float64Array(baseHeights);
  const queue = { mounts: [], ridgeData: null, spurData: [] };
  for (const cmd of commands) {
    switch (cmd.type) {
      case 'scale':
        state.scale = cmd.value;
        break;
      case 'rainfall':
        state.rainfall = cmd.value;
        break;
      case 'radius':
        state.radiusScale = cmd.value;
        break;
      case 'ratio':
        state.ratio = cmd.value;
        break;
      case 'hill':
      case 'pit': {
        const isPit = cmd.type === 'pit';
        const mounts = generateHillFeatures(extent, rng, Math.round(cmd.count * state.ratio), isPit ? -cmd.depth : cmd.height, cmd.xMin, cmd.xMax, cmd.yMin, cmd.yMax, isPit, state);
        for (const m of mounts) {
          queue.mounts.push(m);
        }
        break;
      }
      case 'range':
      case 'trough': {
        const isTrough = cmd.type === 'trough';
        const feature = generateRidgeFeature(pts, extent, rng, isTrough ? -cmd.depth : cmd.height, cmd.x1, cmd.y1, cmd.x2, cmd.y2, isTrough, state);
        queue.ridgeData = feature.ridgeData;
        queue.spurData = feature.spurData;
        for (const m of feature.peakMounts) {
          queue.mounts.push(m);
        }
        break;
      }
      case 'apply':
        applyQueue(h, pts, queue, state);
        queue.mounts = [];
        queue.ridgeData = null;
        queue.spurData = [];
        break;
      case 'islandmask': {
        const maskMix = cmd.mix;
        const hw = extent.width / 2;
        const hh = extent.height ? extent.height / 2 : hw;
        for (let i = 0; i < pts.length; i++) {
          const nx = pts[i][0] / hw;
          const ny = pts[i][1] / hh;
          const d = Math.min(1, Math.abs(nx) + Math.abs(ny));
          h[i] = lerp(h[i], 1 - d, maskMix);
        }
        break;
      }
    }
  }
  if (queue.mounts.length > 0 || queue.ridgeData) {
    applyQueue(h, pts, queue, state);
  }

  return { heights: h };
}

function generateSimplexBase(pts, extent, seed) {
  const h = zero(pts.length);
  const extentSize = extent.width;
  const half = extentSize / 2;
  const octaves = 6;
  const persistence = 0.5;
  const lacunarity = 2.0;
  const baseFreq = 2.0;
  const exponent = 3;

  const noises = [];
  for (let o = 0; o < octaves; o++) {
    const octaveSeed = (seed ^ 0xABCD) + o * 7919;
    let s = octaveSeed | 0;
    const prng = function () {
      s = s + 0x6D2B79F5 | 0;
      let t = Math.imul(s ^ s >>> 15, 1 | s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
    noises.push(createNoise2D(prng));
  }

  for (let i = 0; i < pts.length; i++) {
    const nx = (pts[i][0] + half) / extentSize;
    const ny = (pts[i][1] + half) / extentSize;
    let e = 0, maxAmp = 0, amp = 1, f = baseFreq;
    for (let o = 0; o < octaves; o++) {
      e += amp * ((noises[o](nx * f, ny * f) + 1) / 2);
      maxAmp += amp;
      amp *= persistence;
      f *= lacunarity;
    }
    e /= maxAmp;
    h[i] = Math.min(Math.pow(e, exponent), 1);
  }
  return h;
}

function neighbours(adj, i) {
  return adj[i];
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
