import { BIOMES_MATRIX, HABITABILITY } from "./config.js";

function zero(n) {
  const z = new Float64Array(n);
  return z;
}

function isEdge(adj, i) {
  return adj[i].length < 3;
}

function isNearEdge(pt, extent) {
  const x = pt[0], y = pt[1];
  const hw = extent.width / 2, hh = extent.height / 2;
  return x < -0.45 * hw || x > 0.45 * hw || y < -0.45 * hh || y > 0.45 * hh;
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

function getSlope(h, adj, pts) {
  const dh = downhill(h, adj);
  const slopeArr = zero(h.length);
  for (let i = 0; i < h.length; i++) {
    if (dh[i] < 0) { slopeArr[i] = 0; continue; }
    slopeArr[i] = (h[i] - h[dh[i]]) / distance(pts, i, dh[i]);
  }
  return slopeArr;
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

export function buildBiomes(h, { adj, pts, extent, waterLevel, baseTemp, npts, state }) {
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

  return { h, rawHeights, heightMin, heightMax, temperature, tempBand, rivers, moisture, biome, maxLandH };
}

export function computeHabitability(pts, heights, waterLevel, biome, adj, flux, maxLandH) {
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

export { downhill, zero };
