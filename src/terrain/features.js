import { createRng } from './terrain.js';
import { TROUBLE_TYPES, RESOURCE_TYPES, RESOURCE_BIOME_WEIGHT, MAGIC_TYPES, ELEMENTS, FACTION_TYPES, PRIMARY_GOALS, CONDITIONS, PLACE_NAMES, PLACE_ADJECTIVES, PLACE_NOUNS, SITE_LAIR_TYPES, SITE_RUIN_TYPES, SITE_OUTPOST_TYPES, SITE_LANDMARK_TYPES, SITE_RESOURCE_TYPES } from './config.js';

function d(rng, sides) {
  return Math.floor(rng() * sides) + 1;
}

function pick(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}

function rollIndex(rng, sides) {
  return d(rng, sides) - 1;
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

//
function naturalHazard(rng) {
  const roll = d(rng, 8);
  switch (roll) {
    case 1: return 'oddity-based';
    case 2: return 'tectonic/volcanic';
    case 3: return 'precipitous (chasm, crevasse, abyss, rift)';
    case 4: return 'ensnaring (bog, mire, tarpit, quicksand, etc.)';
    case 5: return 'defensive (trap created by local creature/faction)';
    case 6: return 'meteorological (blizzard, thunderstorm, sandstorm, etc.)';
    case 7: return 'seasonal (fire, flood, avalanche, etc.)';
    case 8: return 'impairing (mist, fog, murk, gloom, miasma, etc.)';
  }
}

function generateHazard(rng) {
  const cat = d(rng, 10);
  if (cat === 1) {
    const sub = d(rng, 8);
    switch (sub) {
      case 1: case 2: case 3: case 4:
        return { category: 'unnatural', type: 'taint/blight/curse' };
      case 5: case 6: {
        const base = naturalHazard(rng);
        return { category: 'unnatural', type: 'magical', base, magic: pick(MAGIC_TYPES, rng) };
      }
      case 7: {
        const base = naturalHazard(rng);
        return { category: 'unnatural', type: 'planar', base, element: pick(ELEMENTS, rng) };
      }
      case 8: {
        const base = naturalHazard(rng);
        return { category: 'unnatural', type: 'divine', base };
      }
    }
  } else {
    return { category: 'natural', type: naturalHazard(rng) };
  }
}

function generateObstacle(rng) {
  const cat = d(rng, 10);
  if (cat === 1) {
    const sub = d(rng, 8);
    switch (sub) {
      case 1: case 2: case 3: case 4: case 5: case 6: {
        return { category: 'unnatural', type: 'magical', magic: pick(MAGIC_TYPES, rng) };
      }
      case 7: {
        return { category: 'unnatural', type: 'planar', element: pick(ELEMENTS, rng) };
      }
      case 8: {
        return { category: 'unnatural', type: 'divine' };
      }
    }
  } else {
    const sub = d(rng, 8);
    switch (sub) {
      case 1: return { category: 'natural', type: 'oddity-based' };
      case 2: return { category: 'natural', type: 'defensive (barrier created by local creature/faction)' };
      case 3: case 4: return { category: 'natural', type: 'impenetrable (cliff, escarpment, crag, bluff, etc.)' };
      case 5: case 6: return { category: 'natural', type: 'penetrable (dense forest/jungle, etc.)' };
      case 7: case 8: return { category: 'natural', type: 'traversable (river, ravine, crevasse, chasm, abyss, etc.)' };
    }
  }
}

function generateArea(rng) {
  const cat = d(rng, 10);
  if (cat === 1) {
    const sub = d(rng, 8);
    switch (sub) {
      case 1: case 2: case 3: case 4: case 5: case 6: {
        return { category: 'unnatural', type: 'magical', magic: pick(MAGIC_TYPES, rng) };
      }
      case 7: {
        return { category: 'unnatural', type: 'planar', element: pick(ELEMENTS, rng) };
      }
      case 8: {
        return { category: 'unnatural', type: 'divine' };
      }
    }
  } else {
    const sub = d(rng, 8);
    switch (sub) {
      case 1: return { category: 'natural', type: 'oddity-based' };
      case 2: return { category: 'natural', type: 'hazard-based (roll hazard, expand its reach)' };
      case 3: case 4: return { category: 'natural', type: 'obstacle-based (roll obstacle, expand its footprint)' };
      case 5: return { category: 'natural', type: 'hunting/gathering ground of local creature' };
      case 6: return { category: 'natural', type: 'claimed as territory by local faction' };
      case 7: case 8: return { category: 'natural', type: 'difficult terrain (icefield, rocky land, dense forest, etc.)' };
    }
  }
}

function generatePlaceName(rng) {
  const template = d(rng, 12);
  const place = pick(PLACE_NAMES, rng);
  const adj = pick(PLACE_ADJECTIVES, rng);
  const noun = pick(PLACE_NOUNS, rng);
  switch (template) {
    case 1: case 2: return `The ${place}`;
    case 3: case 4: return `The ${adj}${place}`;
    case 5: case 6: return `The ${place} of the ${noun}`;
    case 7: case 8: return `The ${noun}'s ${place}`;
    case 9: case 10: return `${place} of the ${adj}${noun}`;
    case 11: case 12: return `The${adj} ${noun}`;
  }
}

function generateSite(rng) {
  const sub = d(rng, 10);
  if (sub <= 2) {
    return { category: 'dungeon' };
  } else if (sub <= 4) {
    return { category: 'lair/dwelling', type: pick(SITE_LAIR_TYPES, rng) };
  } else if (sub <= 6) {
    return { category: 'ruin', type: pick(SITE_RUIN_TYPES, rng) };
  } else if (sub === 7) {
    return { category: 'outpost', type: pick(SITE_OUTPOST_TYPES, rng) };
  } else if (sub <= 9) {
    return { category: 'landmark', type: pick(SITE_LANDMARK_TYPES, rng) };
  } else {
    return { category: 'resource', type: pick(SITE_RESOURCE_TYPES, rng) };
  }
}

// ---- FACTION PRESENCE ----
function generateFactionPresence(rng) {
  const ft = FACTION_TYPES[rollIndex(rng, 10)];
  let type;
  if (typeof ft === 'object' && ft._special === 'combined') {
    type = `${pick(FACTION_TYPES.slice(0, -1), rng)} + ${pick(FACTION_TYPES.slice(0, -1), rng)}`;
  } else {
    type = ft;
  }
  const goal = pick(PRIMARY_GOALS, rng);
  const condition = pick(CONDITIONS, rng);
  return { type, goal, condition };
}

// ---- CREATURE sub-type (existing) ----
function creatureSubtype(rng) {
  const sub = d(rng, 12);
  if (sub <= 5) {
    const subsub = d(rng, 12);
    let kind;
    if (subsub === 1) kind = 'legendary';
    else if (subsub <= 3) kind = 'extraplanar';
    else if (subsub <= 6) kind = 'undead';
    else kind = 'fearsome';
    return { category: 'monster', kind };
  } else if (sub <= 10) {
    const subsub = d(rng, 12);
    let kind;
    if (subsub <= 2) kind = 'water-going';
    else if (subsub <= 5) kind = 'airborne';
    else kind = 'earthbound';
    return { category: 'beast', kind };
  } else {
    const subsub = d(rng, 12);
    let kind;
    if (subsub <= 2) kind = 'rare';
    else if (subsub <= 5) kind = 'uncommon';
    else kind = 'common';
    return { category: 'humanoid', kind };
  }
}

export { generatePlaceName };

export function generateFeatures(safety, extentSize, rng) {
  const areaRatio = (extentSize / 320) ** 2;
  const numFeatures = Math.max(4, Math.round((8 + 2 * (1 + Math.floor(rng() * 8))) * areaRatio));
  const features = [];
  for (let i = 0; i < numFeatures; i++) {
    const roll = d(rng, 12) + safety;
    let type;
    if (roll <= 4) type = 'creature';
    else if (roll === 5) type = 'hazard';
    else if (roll === 6) type = 'obstacle';
    else if (roll === 7) type = 'area';
    else if (roll === 8) type = 'named place';
    else if (roll <= 11) type = 'site';
    else if (roll === 12) type = 'faction presence';
    else type = 'settlement';

    const feature = { type, roll };
    switch (type) {
      case 'creature':
        feature.subtype = creatureSubtype(rng);
        break;
      case 'hazard':
        feature.hazard = generateHazard(rng);
        break;
      case 'obstacle':
        feature.obstacle = generateObstacle(rng);
        break;
      case 'area':
        feature.area = generateArea(rng);
        break;
      case 'named place':
        feature.name = generatePlaceName(rng);
        break;
      case 'site':
        feature.site = generateSite(rng);
        break;
      case 'faction presence':
        feature.faction = generateFactionPresence(rng);
        break;
    }
    features.push(feature);
  }
  return features;
}

// ---- Cell-based placement helpers ----

/**
 * Build a map from cell index to array of point indices belonging to that cell.
 */
function groupPointsByCell(cellIndexForPoint, nCells) {
  const cellPoints = Array.from({ length: nCells }, () => []);
  for (let i = 0; i < cellIndexForPoint.length; i++) {
    cellPoints[cellIndexForPoint[i]].push(i);
  }
  return cellPoints;
}

/**
 * Find the best-scoring point within a given cell. Returns { idx, x, z, score } or null.
 * scorer: (idx) => number (higher is better)
 * filter: (idx) => boolean (optional)
 */
function bestPointInCell(cellIdx, cellPoints, pts, scorer, filter) {
  const indices = cellPoints[cellIdx];
  let best = null;
  for (const idx of indices) {
    if (filter && !filter(idx)) continue;
    const s = scorer(idx);
    if (best === null || s > best.score) {
      best = { idx, x: pts[idx][0], z: pts[idx][1], score: s };
    }
  }
  return best;
}

/**
 * Find the best point in a cell, falling back to neighboring cells via BFS.
 * Returns { idx, x, z, score } or null.
 */
function bestPointInCellOrNeighbors(startCell, cellPoints, pts, cellAdj, scorer, filter) {
  let best = bestPointInCell(startCell, cellPoints, pts, scorer, filter);
  if (best) return best;
  const visited = new Set([startCell]);
  const queue = [...(cellAdj[startCell] || [])];
  while (queue.length > 0) {
    const ci = queue.shift();
    if (visited.has(ci)) continue;
    visited.add(ci);
    best = bestPointInCell(ci, cellPoints, pts, scorer, filter);
    if (best) return best;
    for (const nb of (cellAdj[ci] || [])) {
      if (!visited.has(nb)) queue.push(nb);
    }
  }
  return null;
}

/**
 * Pick a random point within a cell (optionally filtered), with fallback to neighbors.
 */
function randomPointInCellOrNeighbors(startCell, cellPoints, pts, cellAdj, filter, rng) {
  const visited = new Set([startCell]);
  const queue = [startCell];
  while (queue.length > 0) {
    const ci = queue.shift();
    if (visited.size > 1 && ci !== startCell && visited.has(ci)) continue;
    visited.add(ci);
    const indices = cellPoints[ci];
    const valid = filter ? indices.filter(filter) : indices;
    if (valid.length > 0) {
      const idx = valid[Math.floor(rng() * valid.length)];
      return { idx, x: pts[idx][0], z: pts[idx][1] };
    }
    for (const nb of (cellAdj[ci] || [])) {
      if (!visited.has(nb)) queue.push(nb);
    }
  }
  return null;
}

/**
 * Assign city/town/ruin/outpost features to land/hill cells only.
 * Everything else goes to any cell.
 */
function generateCellAssignments(rng, cells, cellAdj, cityCount, areaRatio) {
  const nCells = cells.length;

  // Separate cells by type
  const landCells = [];
  const allCells = [];
  for (let i = 0; i < nCells; i++) {
    allCells.push(i);
    if (cells[i].type === 'land' || cells[i].type === 'hill') {
      landCells.push(i);
    }
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function pickN(from, n) {
    if (n <= 0) return [];
    const shuffled = shuffle([...from]);
    return shuffled.slice(0, Math.min(n, shuffled.length));
  }

  const assignments = {
    cities: [],
    towns: [],
    resources: [],
    ruins: [],
    minorRuins: [],
    trouble: [],
    outposts: [],
    features: [], // { cellIdx, feature }
  };

  // Cities: land/hill cells only
  if (cityCount > 0) {
    const n = Math.max(1, Math.round(cityCount * areaRatio));
    assignments.cities = pickN(landCells, n);
  }

  // Towns: 4 standalone when no cities, else 3 per city
  const usedForCities = new Set(assignments.cities);
  const remainingLand = landCells.filter(c => !usedForCities.has(c));
  const townCount = assignments.cities.length > 0 ? assignments.cities.length * 3 : 4;
  assignments.towns = pickN(remainingLand, townCount);

  // Resources: any cells
  assignments.resources = pickN(allCells, Math.max(2, Math.round(cityCount * areaRatio)));

  // Ruins: land/hill cells
  const usedForSettlements = new Set([...assignments.cities, ...assignments.towns]);
  const ruinLand = landCells.filter(c => !usedForSettlements.has(c));
  assignments.ruins = pickN(ruinLand, 1 + Math.floor(rng() * 2));

  // Minor ruins: any cells
  const minorCount = Math.max(2, Math.round((4 + Math.floor(rng() * 6) + 1) * areaRatio));
  assignments.minorRuins = pickN(allCells, minorCount);

  // Trouble: near each resource cell (neighbor), plus extras near city/town cells
  const troubleCells = new Set();
  for (const rc of assignments.resources) {
    const neighbors = cellAdj[rc] || [];
    if (neighbors.length > 0) {
      troubleCells.add(neighbors[Math.floor(rng() * neighbors.length)]);
    } else {
      troubleCells.add(rc);
    }
  }
  const extras = Math.max(0, Math.round((3 - cityCount) * 2 * areaRatio));
  const settlementCells = [...usedForCities];
  for (let k = 0; k < extras; k++) {
    if (settlementCells.length > 0) {
      const sc = settlementCells[k % settlementCells.length];
      const neighbors = cellAdj[sc] || [];
      if (neighbors.length > 0) {
        troubleCells.add(neighbors[Math.floor(rng() * neighbors.length)]);
      }
    }
  }
  assignments.trouble = [...troubleCells];

  // Outposts (land/hill only — assigned later per feature)
  // Features will be assigned individually in resolveFeatures

  return assignments;
}

// ---- Cell-based resource placement ----

function placeResourcesInCells(assignedCells, pts, h, waterLevel, biome, maxLandH, cellPoints, cellAdj, rngSeed) {
  const rng = createRng(rngSeed ^ 0xFACE);
  const types = RESOURCE_TYPES.sort(() => rng() - 0.5).slice(0, assignedCells.length);
  const chosen = [];
  const MIN_DIST_SQ = 20 * 20;

  for (let ri = 0; ri < assignedCells.length && ri < types.length; ri++) {
    const cellIdx = assignedCells[ri];
    const resType = types[ri];
    const weights = RESOURCE_BIOME_WEIGHT[resType];

    const scorer = (idx) => {
      if (h[idx] <= waterLevel) return -1;
      const b = biome[idx];
      let w = weights[b] || 0;
      if (w <= 0) return -1;
      const normH = Math.min((h[idx] - waterLevel) / maxLandH, 1.0);
      if (resType === 'copper/tin/iron' || resType === 'silver/gold/gems') w *= (0.5 + normH);
      return w + rng() * 0.5;
    };

    const filter = (idx) => h[idx] > waterLevel && (weights[biome[idx]] || 0) > 0;

    const best = bestPointInCellOrNeighbors(cellIdx, cellPoints, pts, cellAdj, scorer, filter);
    if (!best) continue;

    let tooClose = false;
    for (const p of chosen) {
      const dx = best.x - p.x, dz = best.z - p.z;
      if (dx * dx + dz * dz < MIN_DIST_SQ) { tooClose = true; break; }
    }
    if (tooClose) continue;
    chosen.push({ idx: best.idx, x: best.x, z: best.z, type: resType });
  }

  return chosen;
}

// ---- Cell-based city/town/ruin placement ----

function placeCitiesInCells(assignedCells, pts, h, waterLevel, habitability, nearWater, nearResource, maxLandH, cellPoints, cellAdj) {
  if (assignedCells.length === 0) return [];
  const cities = [];

  for (const cellIdx of assignedCells) {
    const scorer = (idx) => {
      if (h[idx] <= waterLevel) return -1;
      if (habitability[idx] <= 0) return -1;
      return habitability[idx] + (nearWater[idx] ? 20 : 0) + (nearResource ? nearResource[idx] ? 15 : 0 : 0);
    };
    const filter = (idx) => h[idx] > waterLevel && habitability[idx] > 0 && (h[idx] - waterLevel) / maxLandH <= 0.6;

    const best = bestPointInCellOrNeighbors(cellIdx, cellPoints, pts, cellAdj, scorer, filter);
    if (best) {
      cities.push({ x: best.x, z: best.z, idx: best.idx, habitability: best.score });
    }
  }

  return cities;
}

function placeTownsInCells(assignedCells, pts, h, waterLevel, habitability, nearWater, nearResource, maxLandH, cellPoints, cellAdj) {
  const towns = [];

  for (const cellIdx of assignedCells) {
    const scorer = (idx) => {
      if (h[idx] <= waterLevel) return -1;
      if (habitability[idx] <= 0) return -1;
      return habitability[idx] + (nearWater[idx] ? 20 : 0) + (nearResource ? nearResource[idx] ? 15 : 0 : 0);
    };
    const filter = (idx) => h[idx] > waterLevel && habitability[idx] > 0 && (h[idx] - waterLevel) / maxLandH <= 0.6;

    const best = bestPointInCellOrNeighbors(cellIdx, cellPoints, pts, cellAdj, scorer, filter);
    if (best) {
      towns.push({ x: best.x, z: best.z, idx: best.idx, habitability: best.score });
    }
  }

  return towns;
}

function placeRuinsInCells(assignedCells, pts, h, waterLevel, habitability, maxLandH, cellPoints, cellAdj, rng) {
  const ruins = [];

  for (const cellIdx of assignedCells) {
    const scorer = (idx) => {
      if (h[idx] <= waterLevel) return -1;
      return habitability[idx] + rng() * 10;
    };
    const filter = (idx) => h[idx] > waterLevel && habitability[idx] > 0 && (h[idx] - waterLevel) / maxLandH <= 0.6;

    const best = bestPointInCellOrNeighbors(cellIdx, cellPoints, pts, cellAdj, scorer, filter);
    if (best) {
      ruins.push({ x: best.x, z: best.z, idx: best.idx, habitability: best.score, name: generatePlaceName(rng) });
    }
  }

  return ruins;
}

function placeMinorRuinsInCells(assignedCells, pts, h, waterLevel, cellPoints, cellAdj, rng) {
  const minorRuins = [];

  for (const cellIdx of assignedCells) {
    const filter = (idx) => h[idx] > waterLevel;
    const best = randomPointInCellOrNeighbors(cellIdx, cellPoints, pts, cellAdj, filter, rng);
    if (best) {
      minorRuins.push({ x: best.x, z: best.z, idx: best.idx, name: generatePlaceName(rng) });
    }
  }

  return minorRuins;
}

function placeTroubleInCells(assignedCells, pts, h, waterLevel, habitability, cellPoints, cellAdj, rng) {
  const trouble = [];

  for (const cellIdx of assignedCells) {
    const scorer = (idx) => {
      if (h[idx] <= waterLevel) return -1;
      return -habitability[idx];
    };
    const filter = (idx) => h[idx] > waterLevel;

    const best = bestPointInCellOrNeighbors(cellIdx, cellPoints, pts, cellAdj, scorer, filter);
    if (best) {
      trouble.push({ x: best.x, z: best.z, idx: best.idx, type: pick(TROUBLE_TYPES, rng) });
    }
  }

  return trouble;
}

// ---- Feature-style placement helpers (hazard/obstacle/area compatible with terrain) ----

export function resolveFeatures({
  rng,
  pts,
  h,
  waterLevel,
  biome,
  maxLandH,
  habitability,
  nearWater,
  adj,
  rivers,
  cityCount,
  extentSize,
  areaRatio,
  seed,
  cells,
  cellAdj,
  cellIndexForPoint,
}) {
  const nCells = cells.length;
  const cellPoints = groupPointsByCell(cellIndexForPoint, nCells);

  // Phase 1: Generate cell assignments
  const assignments = generateCellAssignments(rng, cells, cellAdj, cityCount, areaRatio);

  // Phase 2: Place resources, cities, towns, ruins, trouble
  const resources = placeResourcesInCells(assignments.resources, pts, h, waterLevel, biome, maxLandH, cellPoints, cellAdj, seed ^ 0xBABE);
  const nearResource = computeNearResource(pts, resources, 15);
  const cities = placeCitiesInCells(assignments.cities, pts, h, waterLevel, habitability, nearWater, nearResource, maxLandH, cellPoints, cellAdj);
  const towns = placeTownsInCells(assignments.towns, pts, h, waterLevel, habitability, nearWater, nearResource, maxLandH, cellPoints, cellAdj);
  const ruins = placeRuinsInCells(assignments.ruins, pts, h, waterLevel, habitability, maxLandH, cellPoints, cellAdj, rng);
  const minorRuins = placeMinorRuinsInCells(assignments.minorRuins, pts, h, waterLevel, cellPoints, cellAdj, rng);
  const trouble = placeTroubleInCells(assignments.trouble, pts, h, waterLevel, habitability, cellPoints, cellAdj, rng);

  // Phase 3: Generate narrative features
  const features = generateFeatures(cityCount, extentSize, rng);

  const outpostSites = [];
  const landmarkSites = [];
  const factionSites = [];
  const hazards = [];
  const obstacles = [];
  const areas = [];
  let placedFeatures = [];

  // Assign each narrative feature a random cell (respecting land requirement for cities/towns/outposts)
  for (const f of features) {
    if (f.type === 'site' && f.site && f.site.category === 'outpost') {
      // Outposts need land/hill cells
      const landOnly = [];
      for (let i = 0; i < nCells; i++) {
        if (cells[i].type === 'land' || cells[i].type === 'hill') landOnly.push(i);
      }
      const cellIdx = landOnly.length > 0 ? landOnly[Math.floor(rng() * landOnly.length)] : Math.floor(rng() * nCells);
      const site = randomPointInCellOrNeighbors(cellIdx, cellPoints, pts, cellAdj, (idx) => h[idx] > waterLevel, rng);
      if (site) {
        placedFeatures.push(site);
        outpostSites.push(site);
        f.site = { category: 'outpost', x: site.x, z: site.z, idx: site.idx };
      }
    } else if (f.type === 'site' && f.site && f.site.category === 'resource') {
      const cellIdx = Math.floor(rng() * nCells);
      const extra = placeResourcesInCells([cellIdx], pts, h, waterLevel, biome, maxLandH, cellPoints, cellAdj, seed ^ 0xCAFE ^ (placedFeatures.length));
      for (const r of extra) {
        resources.push(r);
      }
      if (extra.length > 0) {
        f.site = { category: 'resource', type: extra[0].type, x: extra[0].x, z: extra[0].z, idx: extra[0].idx };
      }
    } else if (f.type === 'site' && f.site && f.site.category === 'ruin') {
      const name = generatePlaceName(rng);
      const cellIdx = Math.floor(rng() * nCells);
      const filter = (idx) => { if (h[idx] <= waterLevel) return false; for (const s of [...cities, ...towns]) { const dx = pts[idx][0] - s.x, dz = pts[idx][1] - s.z; if (dx * dx + dz * dz < 20 * 20) return false; } return true; };
      const site = randomPointInCellOrNeighbors(cellIdx, cellPoints, pts, cellAdj, filter, rng);
      if (site) {
        site.name = name;
        minorRuins.push(site);
        f.site = { category: 'ruin', x: site.x, z: site.z, idx: site.idx, name };
        placedFeatures.push(site);
      }
    } else if (f.type === 'site' && f.site && f.site.category === 'dungeon') {
      const name = generatePlaceName(rng);
      const cellIdx = Math.floor(rng() * nCells);
      const scorer = (idx) => { if (h[idx] <= waterLevel) return -1; return habitability[idx] + rng() * 10; };
      const filter = (idx) => {
        if (h[idx] <= waterLevel) return false;
        for (const s of [...cities, ...towns]) {
          const dx = pts[idx][0] - s.x, dz = pts[idx][1] - s.z;
          if (dx * dx + dz * dz < 30 * 30) return false;
        }
        return true;
      };
      const best = bestPointInCellOrNeighbors(cellIdx, cellPoints, pts, cellAdj, scorer, filter);
      if (best) {
        best.name = name;
        ruins.push(best);
        f.site = { category: 'dungeon', x: best.x, z: best.z, idx: best.idx, name, habitability: best.score };
        placedFeatures.push(best);
      }
    } else if (f.type === 'named place') {
      const cellIdx = Math.floor(rng() * nCells);
      const site = randomPointInCellOrNeighbors(cellIdx, cellPoints, pts, cellAdj, (idx) => h[idx] > waterLevel, rng);
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
      const cellIdx = Math.floor(rng() * nCells);
      const lairCell = randomPointInCellOrNeighbors(cellIdx, cellPoints, pts, cellAdj, (idx) => h[idx] > waterLevel, rng);
      if (lairCell) {
        placedFeatures.push(lairCell);
        const nbCells = cellAdj[lairCell.idx] || [];
        const troubleCandidates = [];
        for (const nbIdx of nbCells) {
          for (const pi of (cellPoints[nbIdx] || [])) {
            if (h[pi] <= waterLevel) continue;
            const dx = pts[pi][0] - lairCell.x, dz = pts[pi][1] - lairCell.z;
            if (dx * dx + dz * dz > 20 * 20) continue;
            let ok = true;
            for (const s of [...cities, ...towns]) {
              const cdx = pts[pi][0] - s.x, cdz = pts[pi][1] - s.z;
              if (cdx * cdx + cdz * cdz < 15 * 15) { ok = false; break; }
            }
            if (ok) troubleCandidates.push({ idx: pi, score: -habitability[pi] });
          }
        }
        troubleCandidates.sort((a, b) => a.score - b.score);
        for (const c of troubleCandidates) {
          trouble.push({ x: pts[c.idx][0], z: pts[c.idx][1], idx: c.idx, type: pick(TROUBLE_TYPES, rng) });
          f.site = { category: 'lair', x: lairCell.x, z: lairCell.z, idx: lairCell.idx };
          break;
        }
      }
    } else if (f.type === 'site' && f.site && f.site.category === 'landmark') {
      const name = generatePlaceName(rng);
      const cellIdx = Math.floor(rng() * nCells);
      const site = randomPointInCellOrNeighbors(cellIdx, cellPoints, pts, cellAdj, (idx) => h[idx] > waterLevel, rng);
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
      const cellIdx = Math.floor(rng() * nCells);
      const visited = new Set([cellIdx]);
      const queue = [cellIdx];
      let foundCell = null;
      while (queue.length > 0) {
        const ci = queue.shift();
        if (visited.has(ci)) continue;
        visited.add(ci);
        const indices = cellPoints[ci];
        const shuffled = indices.slice().sort(() => rng() - 0.5);
        for (const idx of shuffled) {
          if (h[idx] <= waterLevel) continue;
          const x = pts[idx][0], z = pts[idx][1];
          foundCell = { idx, x, z };
          break;
        }
        if (foundCell) break;
        for (const nb of (cellAdj[ci] || [])) {
          if (!visited.has(nb)) queue.push(nb);
        }
      }
      if (foundCell) {
        hazards.push({ x: foundCell.x, z: foundCell.z, idx: foundCell.idx, type: f.hazard.type });
        f.site = { x: foundCell.x, z: foundCell.z, idx: foundCell.idx };
      } else {
        f.regionWide = true;
      }
    } else if (f.type === 'obstacle') {
      const cellIdx = Math.floor(rng() * nCells);
      const visited = new Set([cellIdx]);
      const queue = [cellIdx];
      let foundCell = null;
      while (queue.length > 0) {
        const ci = queue.shift();
        if (visited.has(ci)) continue;
        visited.add(ci);
        const indices = cellPoints[ci];
        const shuffled = indices.slice().sort(() => rng() - 0.5);
        for (const idx of shuffled) {
          if (h[idx] <= waterLevel) continue;
          const x = pts[idx][0], z = pts[idx][1];
          foundCell = { idx, x, z };
          break;
        }
        if (foundCell) break;
        for (const nb of (cellAdj[ci] || [])) {
          if (!visited.has(nb)) queue.push(nb);
        }
      }
      if (foundCell) {
        obstacles.push({ x: foundCell.x, z: foundCell.z, idx: foundCell.idx, type: f.obstacle.type });
        f.site = { x: foundCell.x, z: foundCell.z, idx: foundCell.idx };
      }
    } else if (f.type === 'area') {
      const cellIdx = Math.floor(rng() * nCells);
      const visited = new Set([cellIdx]);
      const queue = [cellIdx];
      let foundCell = null;
      while (queue.length > 0) {
        const ci = queue.shift();
        if (visited.has(ci)) continue;
        visited.add(ci);
        const indices = cellPoints[ci];
        const shuffled = indices.slice().sort(() => rng() - 0.5);
        for (const idx of shuffled) {
          if (h[idx] <= waterLevel) continue;
          const x = pts[idx][0], z = pts[idx][1];
          foundCell = { idx, x, z };
          break;
        }
        if (foundCell) break;
        for (const nb of (cellAdj[ci] || [])) {
          if (!visited.has(nb)) queue.push(nb);
        }
      }
      if (foundCell) {
        areas.push({ x: foundCell.x, z: foundCell.z, idx: foundCell.idx, type: f.area.type });
        f.site = { x: foundCell.x, z: foundCell.z, idx: foundCell.idx };
      }
    }
  }

  return {
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
  };
}
