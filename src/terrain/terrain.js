import Delaunator from 'delaunator';
import SimplexNoise from 'simplex-noise';
import { generateFeatures, generatePlaceName } from './features.js';

function createRng(seed) {
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

function zero(n) {
  const z = new Float64Array(n);
  return z;
}

function quantile(arr, q) {
  const s = new Float64Array(arr);
  s.sort();
  const idx = q * (s.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return s[lo] + (idx - lo) * (s[hi] - s[lo]);
}

const TERRAIN_STATE_CMDS = {
  wetland:   ['Scale 0.5', 'Rainfall 1.8'],
  lowland:   ['Scale 0.8', 'Rainfall 1.0'],
  woodland:  ['Scale 1.0', 'Rainfall 1.3'],
  highland:  ['Scale 1.5', 'Rainfall 0.8'],
  wasteland: ['Scale 0.6', 'Rainfall 0.4'],
};

const TEMPLATE_SCRIPTS = {
  island: [
    'Hill 5, 0.5, 30-70, 30-70',
    'Hill 3, 0.3, 20-30, 10-30',
    'Hill 3, 0.3, 70-80, 70-80',
    'Apply',
  ],
  archipelago: [
    'Hill 10, 0.4, 10-90, 10-90',
    'Apply',
  ],
  bay: [
    'Hill 6, 0.5, 30-70, 30-70',
    'Apply',
  ],
  fjord: [
    'Trough 1, 0.6, 40-60, 10-90',
    'Apply',
    'Hill 8, 0.4, 10-90, 10-90',
    'Hill 4, 0.6, 10-90, 10-90',
    'Apply',
  ],
  lake: [
    'Hill 8, 0.4, 20-80, 20-80',
    'Apply',
  ],
  land: [
    'Hill 10, 0.6, 10-90, 10-90',
    'Apply',
  ],
};

function parseCommand(str) {
  const parts = str.trim().split(/\s+/);
  const type = parts[0].toLowerCase();
  switch (type) {
    case 'hill':
    case 'pit':
    case 'range':
    case 'trough': {
      const rest = str.slice(parts[0].length).trim();
      const vals = rest.split(',').map(s => s.trim());
      const count = parseInt(vals[0], 10);
      const heightOrDepth = parseFloat(vals[1]);
      const xRange = vals[2].split('-').map(s => parseInt(s, 10) / 100);
      const yRange = vals[3].split('-').map(s => parseInt(s, 10) / 100);
      return {
        type,
        count,
        [type === 'hill' || type === 'range' ? 'height' : 'depth']: heightOrDepth,
        xMin: xRange[0], xMax: xRange[1],
        yMin: yRange[0], yMax: yRange[1],
      };
    }
    case 'apply':
      return { type: 'apply' };
    case 'scale':
      return { type: 'scale', value: parseFloat(parts[1]) };
    case 'rainfall':
      return { type: 'rainfall', value: parseFloat(parts[1]) };
    default:
      console.warn('Unknown command:', type);
      return null;
  }
}

function generateHillFeatures(extent, rng, count, height, xMin, xMax, yMin, yMax, isPit) {
  const sizeScale = extent.width / 320;
  const halfW = extent.width / 2, halfH = extent.height / 2;
  const xLo = -halfW + xMin * extent.width, xHi = -halfW + xMax * extent.width;
  const yLo = -halfH + yMin * extent.height, yHi = -halfH + yMax * extent.height;
  const mounts = [];
  for (let i = 0; i < count; i++) {
    const mx = runif(xLo, xHi, rng), my = runif(yLo, yHi, rng);
    const diameter = runif(8, 22, rng) * sizeScale;
    mounts.push({ x: mx, y: my, r: diameter / 2, peakHeight: height });
  }
  return mounts;
}

function generateRidgeFeature(pts, extent, rng, count, height, xMin, xMax, yMin, yMax, isTrough) {
  const sizeScale = extent.width / 320;
  const halfW = extent.width / 2, halfH = extent.height / 2;
  const xLo = -halfW + xMin * extent.width, xHi = -halfW + xMax * extent.width;
  const yLo = -halfH + yMin * extent.height, yHi = -halfH + yMax * extent.height;
  const cx = runif(xLo, xHi, rng), cy = runif(yLo, yHi, rng);
  const angle = runif(0, Math.PI * 2, rng);
  const ridgeLen = runif(0.5, 0.85, rng) * extent.width;
  const cosA = Math.cos(angle), sinA = Math.sin(angle);
  const ridgeH = height;
  const ridgeWidth = Math.abs(height) * 4 * sizeScale;
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
    const peakR = runif(3, 6, rng) * sizeScale;
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
    const spR = runif(2, 5, rng) * sizeScale;
    const spH = spurH * 0.6;
    peakMounts.push({ x: spurCx + mdx * 0.6, y: spurCy + mdy * 0.6, r: spR, peakHeight: spH });
    peakMounts.push({ x: spurCx + mdx, y: spurCy + mdy, r: spR * 0.7, peakHeight: spH * 0.8 });
  }
  const ridgeData = { cx, cy, cosA, sinA, len: ridgeLen, height: ridgeH, width: ridgeWidth, wiggleAmp, wiggleFreq, wigglePhase };
  return { ridgeData, spurData, peakMounts };
}

function applyQueue(h, pts, queue, state, displayMounts) {
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
    displayMounts.push({ x: m.x, y: m.y, r: m.r, peakHeight: m.peakHeight * scale });
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
  const displayMounts = [];
  const queue = { mounts: [], ridgeData: null, spurData: [] };
  let mountGlobalIdx = 0;
  for (const cmd of commands) {
    switch (cmd.type) {
      case 'scale':
        state.scale = cmd.value;
        break;
      case 'rainfall':
        state.rainfall = cmd.value;
        break;
      case 'hill':
      case 'pit': {
        const isPit = cmd.type === 'pit';
        const mounts = generateHillFeatures(extent, rng, cmd.count, isPit ? -cmd.depth : cmd.height, cmd.xMin, cmd.xMax, cmd.yMin, cmd.yMax, isPit);
        for (const m of mounts) {
          m._idx = mountGlobalIdx++;
          queue.mounts.push(m);
        }
        break;
      }
      case 'range':
      case 'trough': {
        const isTrough = cmd.type === 'trough';
        const feature = generateRidgeFeature(pts, extent, rng, cmd.count, isTrough ? -cmd.depth : cmd.height, cmd.xMin, cmd.xMax, cmd.yMin, cmd.yMax, isTrough);
        queue.ridgeData = feature.ridgeData;
        queue.spurData = feature.spurData;
        for (const m of feature.peakMounts) {
          m._idx = mountGlobalIdx++;
          queue.mounts.push(m);
        }
        break;
      }
      case 'apply':
        applyQueue(h, pts, queue, state, displayMounts);
        queue.mounts = [];
        queue.ridgeData = null;
        queue.spurData = [];
        break;
    }
  }
  if (queue.mounts.length > 0 || queue.ridgeData) {
    applyQueue(h, pts, queue, state, displayMounts);
  }
  const areaRatio = (extent.width / 320) ** 2;
  const visibleCount = Math.max(5, Math.round(25 * areaRatio));
  const sorted = [...displayMounts].sort((a, b) => b.peakHeight - a.peakHeight);
  const filteredMounts = sorted.slice(0, Math.min(visibleCount, sorted.length));
  return { heights: h, mounts: filteredMounts };
}

function generateSimplexBase(pts, extent, seed) {
  const h = zero(pts.length);
  const extentSize = extent.width;
  const half = extentSize / 2;
  const octaves = 6;
  const persistence = 0.5;
  const lacunarity = 2.0;
  const baseFreq = 2.0;
  const exponent = 2.5;
  const fudge = 1.2;

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
    noises.push(new SimplexNoise(prng));
  }

  for (let i = 0; i < pts.length; i++) {
    const nx = (pts[i][0] + half) / extentSize;
    const ny = (pts[i][1] + half) / extentSize;
    let e = 0, maxAmp = 0, amp = 1, f = baseFreq;
    for (let o = 0; o < octaves; o++) {
      e += amp * ((noises[o].noise2D(nx * f, ny * f) + 1) / 2);
      maxAmp += amp;
      amp *= persistence;
      f *= lacunarity;
    }
    e /= maxAmp;
    h[i] = Math.min(Math.pow(e * fudge, exponent), 1);
  }
  return h;
}

function isEdge(adj, i) {
  return adj[i].length < 3;
}

function isNearEdge(pt, extent) {
  const x = pt[0], y = pt[1];
  const hw = extent.width / 2, hh = extent.height / 2;
  return x < -0.45 * hw || x > 0.45 * hw || y < -0.45 * hh || y > 0.45 * hh;
}

function neighbours(adj, i) {
  return adj[i];
}

function distance(pts, i, j) {
  const dx = pts[i][0] - pts[j][0];
  const dy = pts[i][1] - pts[j][1];
  return Math.sqrt(dx * dx + dy * dy);
}

function downhill(h, adj) {
  const dh = new Int32Array(h.length);
  for (let i = 0; i < h.length; i++) {
    if (isEdge(adj, i)) { dh[i] = -2; continue; }
    let best = -1;
    let bestH = h[i];
    for (const j of adj[i]) {
      if (h[j] < bestH) { bestH = h[j]; best = j; }
    }
    dh[i] = best;
  }
  return dh;
}

function getFlux(h, adj) {
  const dh = downhill(h, adj);
  const n = h.length;
  const flux = new Float64Array(n);
  const idxs = new Uint32Array(n);
  for (let i = 0; i < n; i++) { idxs[i] = i; flux[i] = 1 / n; }
  idxs.sort((a, b) => h[b] - h[a]);
  for (let i = 0; i < n; i++) {
    const j = idxs[i];
    if (dh[j] >= 0) flux[dh[j]] += flux[j];
  }
  return flux;
}

function getSlope(h, adj, pts) {
  const dh = downhill(h, adj);
  const slopeArr = zero(h.length);
  for (let i = 0; i < h.length; i++) {
    if (dh[i] < 0) { slopeArr[i] = 0; continue; }
    slopeArr[i] = (h[i] - h[dh[i]]) / distance(pts, i, dh[i]);
  }
  return slopeArr;
}

function fillSinks(h, adj, pts, extent, epsilon) {
  epsilon = epsilon || 1e-5;
  const infinity = 999999;
  const nh = zero(h.length);
  for (let i = 0; i < h.length; i++) {
    if (isNearEdge(pts[i], extent)) {
      nh[i] = h[i];
    } else {
      nh[i] = infinity;
    }
  }
  while (true) {
    let changed = false;
    for (let i = 0; i < h.length; i++) {
      if (nh[i] === h[i]) continue;
      const nbs = adj[i];
      for (let j = 0; j < nbs.length; j++) {
        const k = nbs[j];
        if (h[i] >= nh[k] + epsilon) {
          nh[i] = h[i];
          changed = true;
          break;
        }
        const oh = nh[k] + epsilon;
        if (nh[i] > oh && oh > h[i]) {
          nh[i] = oh;
          changed = true;
        }
      }
    }
    if (!changed) return nh;
  }
}

function computeTemperature(pts, heights, waterLevel, baseTemp, extent) {
  const n = pts.length;
  const temperature = new Float64Array(n);
  let maxLandH = -Infinity;
  for (let i = 0; i < n; i++) {
    if (heights[i] > waterLevel && heights[i] > maxLandH) maxLandH = heights[i];
  }
  if (maxLandH === -Infinity) maxLandH = 1;
  for (let i = 0; i < n; i++) {
    const latFactor = pts[i][1] / (extent.height / 2);
    let t = baseTemp + latFactor * 0.5;
    if (heights[i] > waterLevel) {
      t -= ((heights[i] - waterLevel) / maxLandH) * 10;
    }
    temperature[i] = t;
  }
  return temperature;
}

const BIOMES_MATRIX = [
  new Uint8Array([1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 10]),
  new Uint8Array([3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 9, 9, 9, 9, 10, 10, 10]),
  new Uint8Array([5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 9, 9, 9, 9, 9, 10, 10, 10]),
  new Uint8Array([5, 6, 6, 6, 6, 6, 6, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 9, 9, 9, 9, 9, 9, 10, 10, 10]),
  new Uint8Array([7, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 9, 9, 9, 9, 9, 9, 9, 10, 10]),
];

const HABITABILITY = [0, 4, 10, 22, 30, 50, 100, 90, 80, 12, 4, 0, 12];

function biomeFromMatrix(normH, tempBand, moisture) {
  if (normH <= 0) return 0;
  if (normH > 0.80) return 11;
  const moistureBand = Math.min(Math.floor(moisture / 5), 4);
  return BIOMES_MATRIX[moistureBand][tempBand];
}

function computeMoisture(pts, heights, waterLevel, adj, flux) {
  const n = pts.length;
  const rawMoisture = new Float64Array(n);
  const moisture = new Float64Array(n);
  const isRiver = new Uint8Array(n);
  const visited = new Uint8Array(n);

  let maxFlux = 0;
  for (let i = 0; i < n; i++) {
    if (flux[i] > maxFlux) maxFlux = flux[i];
  }
  if (maxFlux === 0) maxFlux = 1;
  const riverThreshold = maxFlux * 0.1;

  for (let i = 0; i < n; i++) {
    if (flux[i] > riverThreshold && heights[i] > waterLevel) {
      isRiver[i] = 1;
    }
  }

  const queue = [];
  for (let i = 0; i < n; i++) {
    if (heights[i] <= waterLevel) {
      rawMoisture[i] = 8;
      queue.push(i);
      visited[i] = 1;
      continue;
    }
    if (isRiver[i]) {
      rawMoisture[i] = 10;
      queue.push(i);
      visited[i] = 1;
      continue;
    }
    const nbs = adj[i];
    let nearCoast = false;
    for (const j of nbs) {
      if (heights[j] <= waterLevel) {
        nearCoast = true;
        break;
      }
    }
    if (nearCoast) {
      rawMoisture[i] = 7;
      queue.push(i);
      visited[i] = 1;
    }
  }

  let head = 0;
  while (head < queue.length) {
    const current = queue[head++];
    const nbs = adj[current];
    for (let k = 0; k < nbs.length; k++) {
      const j = nbs[k];
      if (visited[j]) continue;
      if (heights[j] > waterLevel) {
        rawMoisture[j] = Math.max(0, rawMoisture[current] * 0.94);
        visited[j] = 1;
        queue.push(j);
      }
    }
  }

  for (let i = 0; i < n; i++) {
    if (heights[i] > waterLevel) {
      const nbs = adj[i];
      let raw = rawMoisture[i];
      if (isRiver[i]) raw += Math.max(flux[i] / 10, 2);
      const landNeighbors = [];
      for (const j of nbs) {
        if (heights[j] > waterLevel) {
          landNeighbors.push(rawMoisture[j]);
        }
      }
      landNeighbors.push(raw);
      let sum = 0;
      for (const v of landNeighbors) sum += v;
      moisture[i] = 4 + sum / landNeighbors.length;
    } else {
      moisture[i] = 0;
    }
  }

  return moisture;
}

function computeHabitability(pts, heights, waterLevel, biome, adj, flux, maxLandH) {
  const n = heights.length;
  const habitability = new Float64Array(n);
  const nearWater = new Uint8Array(n);
  const raw = new Float64Array(n);
  const visited = new Uint8Array(n);
  const queue = [];

  let maxFlux = 0;
  for (let i = 0; i < n; i++) if (flux[i] > maxFlux) maxFlux = flux[i];
  if (maxFlux === 0) maxFlux = 1;
  const riverThreshold = maxFlux * 0.1;

  for (let i = 0; i < n; i++) {
    if (heights[i] <= waterLevel) { raw[i] = 8; queue.push(i); visited[i] = 1; continue; }
    if (flux[i] > riverThreshold) { raw[i] = 10; queue.push(i); visited[i] = 1; continue; }
    const nbs = adj[i];
    for (const j of nbs) {
      if (heights[j] <= waterLevel) { raw[i] = 7; queue.push(i); visited[i] = 1; break; }
    }
  }

  let head = 0;
  while (head < queue.length) {
    const current = queue[head++];
    if (raw[current] >= 5) nearWater[current] = 1;
    if (raw[current] <= 3) continue;
    const nbs = adj[current];
    for (const j of nbs) {
      if (visited[j] || heights[j] <= waterLevel) continue;
      raw[j] = raw[current] * 0.94;
      visited[j] = 1;
      queue.push(j);
    }
  }

  const slopeArr = getSlope(heights, adj, pts);

  for (let i = 0; i < n; i++) {
    if (heights[i] <= waterLevel) { habitability[i] = 0; continue; }
    const normH = (heights[i] - waterLevel) / maxLandH;
    let score = HABITABILITY[biome[i]];
    score *= Math.exp(-((normH - 0.35) ** 2) / 0.15);
    score *= Math.max(0.4, 1 - slopeArr[i] * 2);
    if (nearWater[i]) score += 10;
    habitability[i] = Math.max(0, Math.min(score, 125));
  }

  return { habitability, nearWater };
}

function computeNearResource(pts, resources, radiusKm) {
  const near = new Uint8Array(pts.length);
  const rSq = radiusKm * radiusKm;
  for (const res of resources) {
    for (let i = 0; i < pts.length; i++) {
      const dx = pts[i][0] - res.x, dz = pts[i][1] - res.z;
      if (dx * dx + dz * dz < rSq) near[i] = 1;
    }
  }
  return near;
}

function findCities(pts, heights, waterLevel, habitability, nearWater, nearResource, count, rngSeed) {
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

function findTowns(cities, pts, heights, waterLevel, habitability, nearWater, nearResource, count, rngSeed) {
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

const TROUBLE_TYPES = [
  'Ancient Evil',
  'Ancient Fort',
  'Aspiring Warlord',
  'Cult',
  'Cursed Earth',
  'Supernatural Master',
  'Outcasts',
  'Mad Wizard',
  'Magical Gate',
  'Renegades',
  'School of Dark Sorcery',
  "Thieve's Stronghold",
  'Bandit Camp',
  'Bandit Camp',
  'Bandit Camp',
  'Marauders',
  'Marauders',
  'Marauders',
  'Monster Nest',
  'Monster Nest',
  'Monster Nest',
];

function findTrouble(pts, heights, waterLevel, habitability, cities, towns, resources, ruins, safety, areaRatio, rngSeed) {
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

const RESOURCE_TYPES = [
  'game/hide/fur',
  'timber/clay',
  'herb/spice/dye',
  'copper/tin/iron',
  'silver/gold/gems',
  'exotic',
];

const RESOURCE_BIOME_WEIGHT = {
  'game/hide/fur':    [0, 0, 0, 3, 3, 1, 2, 1, 1, 2, 2, 0, 1],
  'timber/clay':      [0, 0, 0, 1, 1, 2, 3, 2, 3, 2, 0, 0, 1],
  'herb/spice/dye':   [0, 0, 0, 1, 1, 3, 2, 3, 3, 0, 0, 0, 1],
  'copper/tin/iron':  [0, 0, 2, 0, 0, 0, 1, 0, 0, 2, 1, 0, 0],
  'silver/gold/gems': [0, 1, 3, 0, 0, 0, 1, 0, 0, 2, 1, 0, 0],
  'exotic':           [0, 0, 0, 1, 1, 3, 2, 3, 3, 0, 0, 0, 2],
};

export function generateResources(pts, heights, waterLevel, biome, maxLandH, count, rngSeed) {
  const rng = createRng(rngSeed ^ 0xFACE);
  const n = Math.max(2, count);
  const types = RESOURCE_TYPES.sort(() => rng() - 0.5).slice(0, n);
  const chosen = [];

  for (const resType of types) {
    const weights = RESOURCE_BIOME_WEIGHT[resType];
    const scored = [];
    for (let i = 0; i < pts.length; i++) {
      if (heights[i] <= waterLevel) continue;
      const b = biome[i];
      let w = weights[b] || 0;
      if (w <= 0) continue;
      const normH = (heights[i] - waterLevel) / maxLandH;
      if (resType === 'copper/tin/iron' || resType === 'silver/gold/gems') w *= (0.5 + normH);
      scored.push({ idx: i, score: w + rng() * 0.5, x: pts[i][0], z: pts[i][1] });
    }
    scored.sort((a, b) => b.score - a.score);
    if (scored.length > 0) {
      const best = scored[0];
      chosen.push({ idx: best.idx, x: best.x, z: best.z, type: resType });
    }
  }

  return chosen;
}

// ---- Feature placement helpers ----

function placeSiteFeature(pts, heights, waterLevel, cities, towns, rng, excludeSites) {
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

function findCellsByTerrain(terrain, pts, heights, waterLevel, biome, rivers, maxLandH) {
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
    const normH = (h - waterLevel) / maxLandH;
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

function hazardCompatibleWithTerrain(terrain, hazard) {
  if (terrain === 'land') return true;
  if (hazard.category === 'unnatural') return true;
  const type = hazard.type;
  const compat = {
    mountains: ['tectonic/volcanic', 'precipitous', 'seasonal'],
    hills: ['oddity-based', 'defensive'],
    forest: ['ensnaring', 'defensive', 'seasonal'],
    river: ['ensnaring', 'seasonal'],
    water: ['ensnaring'],
  };
  const list = compat[terrain] || [];
  return list.some(k => type.startsWith(k));
}

function obstacleCompatibleWithTerrain(terrain, obstacle) {
  if (terrain === 'land') return true;
  if (obstacle.category === 'unnatural') return true;
  const type = obstacle.type;
  const compat = {
    mountains: ['impenetrable', 'traversable'],
    hills: ['oddity-based', 'traversable'],
    forest: ['penetrable', 'defensive'],
    river: ['traversable'],
    water: ['traversable'],
  };
  const list = compat[terrain] || [];
  return list.some(k => type.startsWith(k));
}

function areaCompatibleWithTerrain(terrain, area) {
  if (terrain === 'land') return true;
  if (area.category === 'unnatural') return true;
  const type = area.type;
  const compat = {
    mountains: ['obstacle-based', 'difficult terrain'],
    hills: ['oddity-based', 'hunting/gathering'],
    forest: ['difficult terrain', 'hunting/gathering', 'claimed as territory'],
    river: ['obstacle-based'],
    water: ['claimed as territory'],
  };
  const list = compat[terrain] || [];
  return list.some(k => type.startsWith(k));
}

const FEATURE_TERRAIN_TYPES = ['land', 'mountains', 'hills', 'forest', 'river', 'water'];

function rollFeatureTerrain(rng) {
  return pick(FEATURE_TERRAIN_TYPES, rng);
}

function findNeighborCells(idx, adj, pts, maxDistKm) {
  const maxDistSq = maxDistKm * maxDistKm;
  const nbs = [];
  for (const j of adj[idx]) {
    const dx = pts[idx][0] - pts[j][0];
    const dz = pts[idx][1] - pts[j][1];
    if (dx * dx + dz * dz <= maxDistSq) nbs.push(j);
  }
  return nbs;
}

function computeRivers(h, adj, waterLevel) {
  const dh = downhill(h, adj);
  const flux = getFlux(h, adj);
  const n = h.length;
  let maxFlux = 0;
  for (let i = 0; i < n; i++) {
    if (flux[i] > maxFlux) maxFlux = flux[i];
  }
  if (maxFlux === 0) maxFlux = 1;
  const threshold = maxFlux * 0.02;
  const isRiver = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (flux[i] > threshold && h[i] > waterLevel) isRiver[i] = 1;
  }
  const segments = [];
  for (let i = 0; i < n; i++) {
    if (isRiver[i] && dh[i] >= 0 && isRiver[dh[i]]) {
      segments.push([i, dh[i]]);
    }
  }
  return { segments, flux, dh };
}

export function buildRegion(template, cols, rows, seed, terrain, baseTemp = 22, cityCount = 0, extentSize = 320) {
  const rng = createRng(seed);
  const extent = { width: extentSize, height: extentSize };
  const areaRatio = (extentSize / 320) ** 2;
  const npts = Math.max(3000, Math.floor((15000 + rng() * 5000) * areaRatio));

  const pts = generatePoints(npts, extent, rng);

  const flat = new Float64Array(npts * 2);
  for (let i = 0; i < npts; i++) { flat[i * 2] = pts[i][0]; flat[i * 2 + 1] = pts[i][1]; }
  const del = new Delaunator(flat);
  const adj = buildAdjacency(del, npts);

  // Build command list from terrain + template
  const terrainPrepend = (TERRAIN_STATE_CMDS[terrain] || TERRAIN_STATE_CMDS.highland);
  const templateScript = (TEMPLATE_SCRIPTS[template] || TEMPLATE_SCRIPTS.island);
  const rawCommands = [...terrainPrepend, ...templateScript];
  const commands = rawCommands.map(parseCommand).filter(Boolean);

  // State passed to processTerrainCommands (scale/rainfall set by commands)
  const state = { scale: 1.0, rainfall: 1.0 };

  // Step 1: Generate base terrain from simplex noise FBM + redistribution
  let h = generateSimplexBase(pts, extent, seed);

  // Step 2: Apply feature commands (hills, ridges, pits) as uplift on base
  const terrainResult = processTerrainCommands(commands, pts, extent, rng, state, h);
  h = terrainResult.heights;

  // Step 3: Manhattan distance island mask
  const MASK_RADII = { island: 0.44, archipelago: 0.40, land: 5.0 };
  const maskRadius = MASK_RADII[template] ?? 0.44;
  if (maskRadius < 5.0) {
    const halfW = extent.width / 2;
    for (let i = 0; i < pts.length; i++) {
      const nx = pts[i][0] / halfW, ny = pts[i][1] / halfW;
      const manhattan = (Math.abs(nx) + Math.abs(ny)) / 2;
      const t = Math.min(1, manhattan / maskRadius);
      h[i] *= (1 - t * t * (3 - 2 * t));
    }
  }

  // Step 4: Water level
  const waterLevel = 0.5;

  // Step 5: Fill sinks so rivers flow correctly
  h = fillSinks(h, adj, pts, extent);
  const rawHeights = Array.from(h);
  const heightMin = Math.min(...h);
  const heightMax = Math.max(...h);

  const temperature = computeTemperature(pts, h, waterLevel, baseTemp, extent);
  const tempBand = new Uint8Array(npts);
  for (let i = 0; i < npts; i++) {
    tempBand[i] = Math.min(Math.max(20 - temperature[i], 0), 25) | 0;
  }

  const rivers = computeRivers(h, adj, waterLevel);
  const moisture = computeMoisture(pts, h, waterLevel, adj, rivers.flux);
  if (state.rainfall != null) {
    for (let i = 0; i < moisture.length; i++) moisture[i] *= state.rainfall;
  }

  const maxLandH = Math.max(heightMax - waterLevel, 0.001);
  const biome = new Uint8Array(npts);
  for (let i = 0; i < npts; i++) {
    const normH = (h[i] - waterLevel) / maxLandH;
    biome[i] = biomeFromMatrix(normH, tempBand[i], moisture[i]);
  }

  const adjustedCityCount = cityCount === 0 ? 0 : Math.max(1, Math.round(cityCount * areaRatio));
  const { habitability, nearWater } = computeHabitability(pts, h, waterLevel, biome, adj, rivers.flux, maxLandH);
  const resources = generateResources(pts, h, waterLevel, biome, maxLandH, adjustedCityCount, seed ^ 0xBABE);
  const nearResource = computeNearResource(pts, resources, 15);
  const cities = findCities(pts, h, waterLevel, habitability, nearWater, nearResource, adjustedCityCount, seed ^ 0xCAFE);
  const towns = findTowns(cities, pts, h, waterLevel, habitability, nearWater, nearResource, adjustedCityCount, seed ^ 0xFEED);
  const ruins = findRuins(pts, h, waterLevel, habitability, cities, towns, adjustedCityCount, seed ^ 0xDADE);
  const minorRuinsCount = Math.max(2, Math.round((4 + Math.floor(rng() * 6) + 1) * areaRatio));
  const minorRuins = findMinorRuins(pts, h, waterLevel, minorRuinsCount, seed ^ 0xABCD);
  const trouble = findTrouble(pts, h, waterLevel, habitability, cities, towns, resources, ruins, cityCount, areaRatio, seed ^ 0xDEAD);
  const features = generateFeatures(cityCount, extentSize, rng);

  const outpostSites = [];
  const landmarkSites = [];
  const factionSites = [];
  const hazards = [];
  const obstacles = [];
  const areas = [];
  let resIdx = 0, placedFeatures = [];

  for (const f of features) {
    if (f.type === 'site' && f.site && f.site.category === 'resource') {
      const extra = generateResources(pts, h, waterLevel, biome, maxLandH, 1, seed ^ 0xCAFE ^ resIdx);
      for (const r of extra) {
        resources.push(r);
      }
      if (extra.length > 0) {
        f.site = { category: 'resource', type: extra[0].type, x: extra[0].x, z: extra[0].z, idx: extra[0].idx };
      }
      resIdx++;
    } else if (f.type === 'site' && f.site && f.site.category === 'ruin') {
      const name = generatePlaceName(rng);
      const extra = findMinorRuins(pts, h, waterLevel, 1, seed ^ 0xBEEF ^ (resIdx + 100));
      if (extra.length > 0) {
        extra[0].name = name;
        minorRuins.push(extra[0]);
        f.site = { category: 'ruin', x: extra[0].x, z: extra[0].z, idx: extra[0].idx, name };
        placedFeatures.push(extra[0]);
      }
      resIdx++;
    } else if (f.type === 'site' && f.site && f.site.category === 'dungeon') {
      const name = generatePlaceName(rng);
      const extra = findRuins(pts, h, waterLevel, habitability, cities, towns, 1, seed ^ 0xDEAF ^ (resIdx + 200));
      if (extra.length > 0) {
        extra[0].name = name;
        ruins.push(extra[0]);
        f.site = { category: 'dungeon', x: extra[0].x, z: extra[0].z, idx: extra[0].idx, name, habitability: extra[0].habitability };
        placedFeatures.push(extra[0]);
      }
      resIdx++;
    } else if (f.type === 'named place') {
      const site = placeSiteFeature(pts, h, waterLevel, cities, towns, rng, placedFeatures);
      if (site) {
        placedFeatures.push(site);
        if (rng() < 0.5) {
          minorRuins.push({ x: site.x, z: site.z, idx: site.idx, name: f.name });
          f.site = { category: 'ruin', x: site.x, z: site.z, idx: site.idx, name: f.name };
        } else {
          landmarkSites.push({ x: site.x, z: site.z, idx: site.idx, name: f.name });
          f.site = { category: 'landmark', x: site.x, z: site.z, idx: site.idx, name: f.name };
        }
      }
    } else if (f.type === 'site' && f.site && f.site.category === 'lair/dwelling') {
      const lairCell = placeSiteFeature(pts, h, waterLevel, cities, towns, rng, placedFeatures);
      if (lairCell) {
        placedFeatures.push(lairCell);
        const candidates = [];
        for (let i = 0; i < pts.length; i++) {
          if (h[i] <= waterLevel) continue;
          const dx = pts[i][0] - lairCell.x, dz = pts[i][1] - lairCell.z;
          if (dx * dx + dz * dz > 20 * 20) continue;
          let ok = true;
          for (const s of [...cities, ...towns]) {
            const cdx = pts[i][0] - s.x, cdz = pts[i][1] - s.z;
            if (cdx * cdx + cdz * cdz < 15 * 15) { ok = false; break; }
          }
          if (!ok) continue;
          candidates.push({ idx: i, score: -habitability[i] });
        }
        candidates.sort((a, b) => a.score - b.score);
        for (const c of candidates) {
           trouble.push({ x: pts[c.idx][0], z: pts[c.idx][1], idx: c.idx, type: pick(TROUBLE_TYPES, rng) });
          f.site = { category: 'lair', x: lairCell.x, z: lairCell.z, idx: lairCell.idx };
          break;
        }
      }
    } else if (f.type === 'site' && f.site && f.site.category === 'outpost') {
      const site = placeSiteFeature(pts, h, waterLevel, cities, towns, rng, placedFeatures);
      if (site) {
        placedFeatures.push(site);
        outpostSites.push(site);
        f.site = { category: 'outpost', x: site.x, z: site.z, idx: site.idx };
      }
    } else if (f.type === 'site' && f.site && f.site.category === 'landmark') {
      const name = generatePlaceName(rng);
      const site = placeSiteFeature(pts, h, waterLevel, cities, towns, rng, placedFeatures);
      if (site) {
        placedFeatures.push(site);
        site.name = name;
        landmarkSites.push(site);
        f.site = { category: 'landmark', x: site.x, z: site.z, idx: site.idx, name };
      }
    } else if (f.type === 'faction presence') {
      const all = [...cities, ...towns];
      if (all.length > 0) {
        const s = pick(all, rng);
        f.site = { category: 'faction', x: s.x, z: s.z, idx: s.idx };
        factionSites.push({ x: s.x, z: s.z, idx: s.idx, faction: f.faction });
      }
    } else if (f.type === 'hazard') {
      let terrain, foundCell = null;
      for (let attempt = 0; attempt < 10; attempt++) {
        terrain = rollFeatureTerrain(rng);
        const cells = findCellsByTerrain(terrain, pts, h, waterLevel, biome, rivers, maxLandH);
        if (cells.length === 0) continue;
        const shuffled = cells.slice().sort(() => rng() - 0.5);
        for (const idx of shuffled) {
          const x = pts[idx][0], z = pts[idx][1];
          let ok = true;
          for (const s of [...cities, ...towns]) {
            const dx = x - s.x, dz = z - s.z;
            if (dx * dx + dz * dz < 15 * 15) { ok = false; break; }
          }
          for (const hz of hazards) {
            const dx = x - hz.x, dz = z - hz.z;
            if (dx * dx + dz * dz < 10 * 10) { ok = false; break; }
          }
          if (ok && hazardCompatibleWithTerrain(terrain, f.hazard)) {
            foundCell = { idx, x, z };
            break;
          }
        }
        if (foundCell) break;
      }
      if (foundCell) {
        f.regionWide = false;
        hazards.push({ x: foundCell.x, z: foundCell.z, idx: foundCell.idx, type: f.hazard.type, terrain });
        f.site = { x: foundCell.x, z: foundCell.z, idx: foundCell.idx, terrain };
      } else {
        f.regionWide = true;
      }
    } else if (f.type === 'obstacle') {
      let terrain, foundCell = null;
      for (let attempt = 0; attempt < 10; attempt++) {
        terrain = rollFeatureTerrain(rng);
        const cells = findCellsByTerrain(terrain, pts, h, waterLevel, biome, rivers, maxLandH);
        if (cells.length === 0) continue;
        const shuffled = cells.slice().sort(() => rng() - 0.5);
        for (const idx of shuffled) {
          const x = pts[idx][0], z = pts[idx][1];
          let ok = true;
          for (const s of [...cities, ...towns]) {
            const dx = x - s.x, dz = z - s.z;
            if (dx * dx + dz * dz < 15 * 15) { ok = false; break; }
          }
          for (const ob of obstacles) {
            const dx = x - ob.x, dz = z - ob.z;
            if (dx * dx + dz * dz < 10 * 10) { ok = false; break; }
          }
          if (ok && obstacleCompatibleWithTerrain(terrain, f.obstacle)) {
            foundCell = { idx, x, z };
            break;
          }
        }
        if (foundCell) break;
      }
      if (foundCell) {
        obstacles.push({ x: foundCell.x, z: foundCell.z, idx: foundCell.idx, type: f.obstacle.type, terrain });
        f.site = { x: foundCell.x, z: foundCell.z, idx: foundCell.idx, terrain };
      }
    } else if (f.type === 'area') {
      let terrain, foundCell = null, neighborCells = [];
      for (let attempt = 0; attempt < 10; attempt++) {
        terrain = rollFeatureTerrain(rng);
        const cells = findCellsByTerrain(terrain, pts, h, waterLevel, biome, rivers, maxLandH);
        if (cells.length === 0) continue;
        const shuffled = cells.slice().sort(() => rng() - 0.5);
        for (const idx of shuffled) {
          const x = pts[idx][0], z = pts[idx][1];
          let ok = true;
          for (const s of [...cities, ...towns]) {
            const dx = x - s.x, dz = z - s.z;
            if (dx * dx + dz * dz < 15 * 15) { ok = false; break; }
          }
          for (const a of areas) {
            const dx = x - a.x, dz = z - a.z;
            if (dx * dx + dz * dz < 10 * 10) { ok = false; break; }
          }
          if (ok && areaCompatibleWithTerrain(terrain, f.area)) {
            const neighbors = findNeighborCells(idx, adj, pts, 3);
            const matchingNeighbors = neighbors.filter(n => {
              for (const s of [...cities, ...towns]) {
                const cdx = pts[n][0] - s.x, cdz = pts[n][1] - s.z;
                if (cdx * cdx + cdz * cdz < 15 * 15) return false;
              }
              return true;
            });
            foundCell = { idx, x, z };
            neighborCells = matchingNeighbors.map(n => ({ idx: n, x: pts[n][0], z: pts[n][1] }));
            break;
          }
        }
        if (foundCell) break;
      }
      if (foundCell) {
        areas.push({ x: foundCell.x, z: foundCell.z, idx: foundCell.idx, neighbors: neighborCells, type: f.area.type, terrain });
        f.site = { x: foundCell.x, z: foundCell.z, idx: foundCell.idx, neighbors: neighborCells, terrain };
      }
    }
  }

  return {
    pts,
    triangles: del.triangles,
    halfedges: del.halfedges,
    adj,
    heights: Array.from(h),
    rawHeights,
    heightMin,
    heightMax,
    extent,
    waterLevel,
    template,
    seed,
    mountainCount: terrainResult.mounts.length,
    mounts: terrainResult.mounts,
    temperature,
    tempBand,
    moisture,
    biome,
    rivers,
    habitability,
    nearWater,
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
  };
}
