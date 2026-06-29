import Delaunator from 'delaunator';

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

function slope(pts, direction) {
  const h = zero(pts.length);
  for (let i = 0; i < pts.length; i++) h[i] = pts[i][0] * direction[0] + pts[i][1] * direction[1];
  return h;
}

function cone(pts, slopeVal) {
  const h = zero(pts.length);
  for (let i = 0; i < pts.length; i++) h[i] = Math.sqrt(pts[i][0] * pts[i][0] + pts[i][1] * pts[i][1]) * slopeVal;
  return h;
}

function mountains(pts, extent, n, rng, template) {
  const configs = {
    island: { ranges: [2, 4], len: [40, 130], width: [4, 18], outlier: 0.15, spread: 0.25 },
    archipelago: { ranges: [4, 6], len: [15, 60], width: [2, 8], outlier: 0.10, spread: 0.35 },
    bay: { ranges: [1, 3], len: [50, 140], width: [6, 20], outlier: 0.10, spread: 0.20 },
    fjord: { ranges: [3, 5], len: [40, 100], width: [2, 6], outlier: 0.08, spread: 0.20 },
    lake:        { ranges: [2, 4], len: [40, 120], width: [4, 14],  outlier: 0.10, spread: 0.25 },
    land: { ranges: [3, 6], len: [80, 200], width: [8, 28], outlier: 0.20, spread: 0.35 },
  };
  const c = configs[template] || configs.island;

  const numRanges = c.ranges[0] + Math.floor(rng() * (c.ranges[1] - c.ranges[0] + 1));
  const ranges = [];
  for (let r = 0; r < numRanges; r++) {
    const cx = runif(-extent.width * c.spread, extent.width * c.spread, rng);
    const cy = runif(-extent.height * c.spread, extent.height * c.spread, rng);
    const angle = runif(0, Math.PI * 2, rng);
    const len = runif(c.len[0], c.len[1], rng);
    const width = runif(c.width[0], c.width[1], rng);
    ranges.push({ x: cx, y: cy, angle, len, width });
  }

  // ---- Place mountains along ranges ----
  const outlierFrac = c.outlier;
  const mounts = [];
  for (let i = 0; i < n; i++) {
    let mx, my, sizeFactor;

    if (rng() < outlierFrac) {
      mx = runif(-extent.width * 0.44, extent.width * 0.44, rng);
      my = runif(-extent.height * 0.44, extent.height * 0.44, rng);
      sizeFactor = runif(0.2, 0.6, rng);
    } else {
      const range = ranges[Math.floor(rng() * ranges.length)];
      const t = (rng() + rng()) * 0.5;
      const along = (t - 0.5) * range.len;
      const perp = (rng() + rng() - 1) * range.width * 0.7;

      const cosA = Math.cos(range.angle);
      const sinA = Math.sin(range.angle);
      mx = range.x + along * cosA - perp * sinA;
      my = range.y + along * sinA + perp * cosA;

      const centerProx = 1 - Math.abs(t - 0.5) * 2;
      const spineProx = 1 - Math.abs(perp) / (range.width * 0.7 + 1);
      sizeFactor = 0.3 + (centerProx * 0.5 + spineProx * 0.5) * 0.7;
    }

    const margin = extent.width * 0.44;
    mx = Math.max(-margin, Math.min(margin, mx));
    my = Math.max(-margin, Math.min(margin, my));

    const r = runif(1.2, 2.0 + sizeFactor * 4, rng);
    const peakHeight = r * runif(0.6, 1.2, rng);
    mounts.push({ x: mx, y: my, r, peakHeight });
  }

  // ---- Accumulate heights (cone + skirt, unchanged) ----
  const h = zero(pts.length);
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    let sum = 0;
    for (let j = 0; j < n; j++) {
      const m = mounts[j];
      const d2 = (p[0] - m.x) * (p[0] - m.x) + (p[1] - m.y) * (p[1] - m.y);
      const peak = Math.max(0, 1 - d2 / (m.r * m.r));
      const skirt = Math.exp(-d2 / (2 * (m.r * 4) * (m.r * 4))) * 0.2;
      sum += peak + skirt;
    }
    h[i] = sum;
  }
  return { heights: h, mounts };
}

function extentForPoints(pts) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p[0] < minX) minX = p[0];
    if (p[0] > maxX) maxX = p[0];
    if (p[1] < minY) minY = p[1];
    if (p[1] > maxY) maxY = p[1];
  }
  return { width: maxX - minX, height: maxY - minY };
}

function isEdge(adj, i) {
  return adj[i].length < 3;
}

function isNearEdge(pt, extent) {
  const x = pt[0], y = pt[1];
  const hw = extent.width / 2, hh = extent.height / 2;
  return x < -0.45 * hw || x > 0.45 * hw || y < -0.45 * hh || y > 0.45 * hh;
}

function relax(h, adj) {
  const nh = zero(h.length);
  for (let i = 0; i < h.length; i++) {
    const nbs = adj[i];
    if (nbs.length < 3) { nh[i] = 0; continue; }
    let s = 0;
    for (const j of nbs) s += h[j];
    nh[i] = s / nbs.length;
  }
  return nh;
}

function add(base) {
  const n = base.length;
  const result = zero(n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < arguments.length; j++) result[i] += arguments[j][i];
  }
  return result;
}

function normalize(h) {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < h.length; i++) {
    if (h[i] < lo) lo = h[i];
    if (h[i] > hi) hi = h[i];
  }
  const r = hi - lo || 1;
  const nh = zero(h.length);
  for (let i = 0; i < h.length; i++) nh[i] = (h[i] - lo) / r;
  return nh;
}

function peaky(h) {
  const n = normalize(h);
  for (let i = 0; i < n.length; i++) n[i] = Math.sqrt(n[i]);
  return n;
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

function erosionRate(h, adj, pts) {
  const flux = getFlux(h, adj);
  const slopeArr = getSlope(h, adj, pts);
  const rate = zero(h.length);
  for (let i = 0; i < h.length; i++) {
    const river = Math.sqrt(flux[i]) * slopeArr[i];
    const creep = slopeArr[i] * slopeArr[i];
    let total = 1000 * river + creep;
    if (total > 200) total = 200;
    rate[i] = total;
  }
  return rate;
}

function erode(h, amount, adj, pts) {
  const rate = erosionRate(h, adj, pts);
  let maxR = 0;
  for (let i = 0; i < rate.length; i++) if (rate[i] > maxR) maxR = rate[i];
  if (maxR === 0) maxR = 1;
  const nh = zero(h.length);
  for (let i = 0; i < h.length; i++) nh[i] = h[i] - amount * (rate[i] / maxR);
  return nh;
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

function setSeaLevel(h, q) {
  const delta = quantile(h, q);
  const nh = zero(h.length);
  for (let i = 0; i < h.length; i++) nh[i] = h[i] - delta;
  return nh;
}

function cleanCoast(h, adj, pts, iters) {
  let result = new Float64Array(h);
  for (let iter = 0; iter < iters; iter++) {
    let changed = 0;
    const nh1 = new Float64Array(result);
    for (let i = 0; i < result.length; i++) {
      const nbs = adj[i];
      if (result[i] <= 0 || nbs.length !== 3) continue;
      let count = 0;
      let best = -999999;
      for (const j of nbs) {
        if (result[j] > 0) count++;
        else if (result[j] > best) best = result[j];
      }
      if (count > 1) continue;
      nh1[i] = best / 2;
    }
    result = nh1;
    const nh2 = new Float64Array(result);
    for (let i = 0; i < result.length; i++) {
      const nbs = adj[i];
      if (result[i] > 0 || nbs.length !== 3) continue;
      let count = 0;
      let best = 999999;
      for (const j of nbs) {
        if (result[j] <= 0) count++;
        else if (result[j] < best) best = result[j];
      }
      if (count > 1) continue;
      nh2[i] = best / 2;
    }
    result = nh2;
  }
  return result;
}

function doErosion(h, amount, n, adj, pts, extent) {
  let result = fillSinks(h, adj, pts, extent);
  for (let i = 0; i < n; i++) {
    result = erode(result, amount, adj, pts);
    result = fillSinks(result, adj, pts, extent);
  }
  return result;
}

function computeTemperature(pts, heights, waterLevel, baseTemp) {
  const n = pts.length;
  const temperature = new Float64Array(n);
  let maxLandH = -Infinity;
  for (let i = 0; i < n; i++) {
    if (heights[i] > waterLevel && heights[i] > maxLandH) maxLandH = heights[i];
  }
  if (maxLandH === -Infinity) maxLandH = 1;
  for (let i = 0; i < n; i++) {
    const latFactor = pts[i][1] / 160;
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
  if (normH < 0) return 0;
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

function findCities(pts, heights, waterLevel, habitability, nearWater, count, rngSeed) {
  if (count <= 0) return [];
  const rng = createRng(rngSeed ^ 0xDEAD);
  const minDistSq = 32 * 32;

  const landCells = [];
  for (let i = 0; i < pts.length; i++) {
    if (heights[i] > waterLevel && habitability[i] > 0) {
      landCells.push({ idx: i, score: habitability[i] + (nearWater[i] ? 20 : 0) });
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

function findTowns(cities, pts, heights, waterLevel, habitability, nearWater, count, rngSeed) {
  const rng = createRng(rngSeed ^ 0xBEEF);
  const minDistSq = 25 * 25;
  const towns = [];

  const score = (idx) => habitability[idx] + (nearWater[idx] ? 20 : 0);

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

function computeRivers(h, adj) {
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
    if (flux[i] > threshold && h[i] > 0) isRiver[i] = 1;
  }
  const segments = [];
  for (let i = 0; i < n; i++) {
    if (isRiver[i] && dh[i] >= 0 && isRiver[dh[i]]) {
      segments.push([i, dh[i]]);
    }
  }
  return { segments, flux, dh };
}

export function buildRegion(template, cols, rows, seed, mountainCount, baseTemp = 22, cityCount = 0) {
  const rng = createRng(seed);
  const extent = { width: 320, height: 320 };
  const npts = 12000 + Math.floor(rng() * 8000);

  const pts = generatePoints(npts, extent, rng);

  const flat = new Float64Array(npts * 2);
  for (let i = 0; i < npts; i++) { flat[i * 2] = pts[i][0]; flat[i * 2 + 1] = pts[i][1]; }
  const del = new Delaunator(flat);
  const adj = buildAdjacency(del, npts);

  const nm = mountainCount != null ? mountainCount : 80;
  const mountainResult = mountains(pts, extent, nm, rng, template);
  let h = mountainResult.heights;

  // Subtract baseline so valleys start at 0
  let hMin = Infinity;
  for (let i = 0; i < h.length; i++) if (h[i] < hMin) hMin = h[i];
  for (let i = 0; i < pts.length; i++) h[i] -= hMin;

  // Island mask: mountains keep their shape, just fade at edges.
  // Angular perturbation breaks the circular outline into jagged bays and headlands.
  const maskConfigs = {
    island: { radius: 0.48, offX: 0, offY: 0, amp: [0.22, 0.14, 0.08, 0.04] },
    archipelago: { radius: 0.32, offX: 0, offY: 0, amp: [0.30, 0.18, 0.10, 0.05] },
    bay: { radius: 5.00, offX: 0, offY: 0, amp: [0, 0, 0, 0] },
    fjord: { radius: 5.00, offX: 0, offY: 0, amp: [0, 0, 0, 0] },

    lake: { radius: 5.00, offX: 0, offY: 0, amp: [0, 0, 0, 0] },
    land: { radius: 5.00, offX: 0, offY: 0, amp: [0, 0, 0, 0] },
  };
  const mc = maskConfigs[template] || maskConfigs.island;
  const baseR = extent.width * mc.radius;
  for (let i = 0; i < pts.length; i++) {
    const x = pts[i][0] - mc.offX * extent.width;
    const y = pts[i][1] - mc.offY * extent.height;
    const d = Math.sqrt(x * x + y * y);
    const angle = Math.atan2(y, x);
    const a = mc.amp;
    const perturb = a[0] * Math.sin(angle * 2 + 0.5)
      + a[1] * Math.sin(angle * 5 + 1.3)
      + a[2] * Math.sin(angle * 11 + 2.7)
      + a[3] * Math.sin(angle * 23 + 4.1);
    const effectiveR = baseR * (1 + perturb);
    const t = d / effectiveR;
    const mask = 1 - t * t * (3 - 2 * t);
    h[i] *= Math.max(0, mask);
  }

  // No relaxation � sharp peaks
  h = normalize(h);
  h = peaky(h);
  h = doErosion(h, runif(0.02, 0.12, rng), 8, adj, pts, extent);

  // Island/archipelago: force map-edge cells to 0 so edges are always water
  if (template === 'island' || template === 'archipelago') {
    const margin = extent.width * 0.01;
    const half = extent.width / 2;
    for (let i = 0; i < pts.length; i++) {
      if (Math.abs(pts[i][0]) > half - margin || Math.abs(pts[i][1]) > half - margin) {
        h[i] = 0;
      }
    }
  }

  // Fjord carved before sea-level so the trench is reliably below water cutoff
  if (template === 'fjord') {
    const edge = Math.floor(rng() * 4);
    const edgeOff = runif(-50, 50, rng), angVar = runif(-0.3, 0.3, rng);
    let sx, sy, angle;
    if (edge === 0) { sx = edgeOff; sy = 160; angle = -Math.PI / 2 + angVar; }
    else if (edge === 1) { sx = 160; sy = edgeOff; angle = Math.PI + angVar; }
    else if (edge === 2) { sx = edgeOff; sy = -160; angle = Math.PI / 2 + angVar; }
    else { sx = -160; sy = edgeOff; angle = angVar; }
    const len = runif(120, 300, rng);
    const width = runif(6, 16, rng);
    const depth = runif(0.3, 0.6, rng);
    for (let i = 0; i < pts.length; i++) {
      const dx = pts[i][0] - sx, dy = pts[i][1] - sy;
      const along = dx * Math.cos(angle) + dy * Math.sin(angle);
      if (along < -5 || along > len) continue;
      const perp = -dx * Math.sin(angle) + dy * Math.cos(angle);
      const d2 = perp * perp;
      h[i] -= Math.exp(-d2 / (2 * width * width)) * depth;
    }
  }

  const waterQuantile = { island: 0.40, archipelago: 0.55, fjord: 0.01, lake: 0.005, bay: 0.005, land: 0.00 };
  const wq = waterQuantile[template] || 0.35;
  h = setSeaLevel(h, wq);
  h = fillSinks(h, adj, pts, extent);
  h = cleanCoast(h, adj, pts, 3);

  // Land: ensure no cells at exactly 0 (mesher treats h <= 0 as water)
  if (template === 'land') {
    for (let i = 0; i < h.length; i++) if (h[i] <= 0) h[i] = 1e-8;
  }

  // ---- Template-specific terrain features (inverted depressions) ----
  if (template === 'lake') {
    const cx = runif(-15, 15, rng), cy = runif(-15, 15, rng);
    const r = runif(25, 50, rng);
    const depth = runif(0.25, 0.5, rng);
    for (let i = 0; i < pts.length; i++) {
      const d2 = (pts[i][0] - cx) ** 2 + (pts[i][1] - cy) ** 2;
      h[i] -= Math.exp(-d2 / (2 * r * r)) * depth;
    }
  } else if (template === 'bay') {
    const edge = Math.floor(rng() * 4);
    let cx, cy;
    if (edge === 0) { cx = runif(-30, 30, rng); cy = 120; }
    else if (edge === 1) { cx = 120; cy = runif(-30, 30, rng); }
    else if (edge === 2) { cx = runif(-30, 30, rng); cy = -120; }
    else { cx = -120; cy = runif(-30, 30, rng); }
    const r = runif(35, 65, rng);
    const depth = runif(0.2, 0.4, rng);
    for (let i = 0; i < pts.length; i++) {
      const d2 = (pts[i][0] - cx) ** 2 + (pts[i][1] - cy) ** 2;
      h[i] -= Math.exp(-d2 / (2 * r * r)) * depth;
    }
  }

  const waterLevel = 0;
  const heightMin = Math.min(...h);
  const heightMax = Math.max(...h);
  const heightRange = heightMax - heightMin || 1;

  const temperature = computeTemperature(pts, h, waterLevel, baseTemp);
  const tempBand = new Uint8Array(npts);
  for (let i = 0; i < npts; i++) {
    tempBand[i] = Math.min(Math.max(20 - temperature[i], 0), 25) | 0;
  }

  const rivers = computeRivers(h, adj);
  const moisture = computeMoisture(pts, h, waterLevel, adj, rivers.flux);

  const maxLandH = Math.max(heightMax - waterLevel, 0.001);
  const biome = new Uint8Array(npts);
  for (let i = 0; i < npts; i++) {
    const normH = (h[i] - waterLevel) / maxLandH;
    biome[i] = biomeFromMatrix(normH, tempBand[i], moisture[i]);
  }

  const { habitability, nearWater } = computeHabitability(pts, h, waterLevel, biome, adj, rivers.flux, maxLandH);
  const cities = findCities(pts, h, waterLevel, habitability, nearWater, cityCount, seed ^ 0xCAFE);
  const towns = findTowns(cities, pts, h, waterLevel, habitability, nearWater, cityCount, seed ^ 0xFEED);

  return {
    pts,
    triangles: del.triangles,
    halfedges: del.halfedges,
    adj,
    heights: Array.from(h),
    heightMin,
    heightMax,
    heightRange,
    extent,
    waterLevel,
    template,
    seed,
    mountainCount: nm,
    mounts: mountainResult.mounts,
    temperature,
    tempBand,
    moisture,
    biome,
    rivers,
    habitability,
    nearWater,
    cities,
    towns,
  };
}
