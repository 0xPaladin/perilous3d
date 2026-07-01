import { createRng, findCities, findTowns, findRuins, findMinorRuins, findTrouble, placeSiteFeature, findCellsByTerrain, findNeighborCells } from './terrain.js';
import { HABITABILITY, TROUBLE_TYPES, RESOURCE_TYPES, RESOURCE_BIOME_WEIGHT, FEATURE_TERRAIN_TYPES, MAGIC_TYPES, ELEMENTS, FACTION_TYPES, PRIMARY_GOALS, CONDITIONS, PLACE_NAMES, PLACE_ADJECTIVES, PLACE_NOUNS, SITE_LAIR_TYPES, SITE_RUIN_TYPES, SITE_OUTPOST_TYPES, SITE_LANDMARK_TYPES, SITE_RESOURCE_TYPES } from './config.js';

function d(rng, sides) {
  return Math.floor(rng() * sides) + 1;
}

function pick(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}

function rollIndex(rng, sides) {
  return d(rng, sides) - 1;
}

function rollFeatureTerrain(rng) {
  return pick(FEATURE_TERRAIN_TYPES, rng);
}

//Terrain Compatibility
export function hazardCompatibleWithTerrain(terrain, hazard) {
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

export function obstacleCompatibleWithTerrain(terrain, obstacle) {
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

export function areaCompatibleWithTerrain(terrain, area) {
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

export function computeNearResource(pts, resources, radiusKm) {
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

function generateResources(pts, heights, waterLevel, biome, maxLandH, count, rngSeed) {
  const rng = createRng(rngSeed ^ 0xFACE);
  const n = Math.max(2, count);
  const types = RESOURCE_TYPES.sort(() => rng() - 0.5).slice(0, n);
  const chosen = [];
  const MIN_DIST_SQ = 20 * 20;

  for (const resType of types) {
    const weights = RESOURCE_BIOME_WEIGHT[resType];
    const scored = [];
    for (let i = 0; i < pts.length; i++) {
      if (heights[i] <= waterLevel) continue;
      const b = biome[i];
      let w = weights[b] || 0;
      if (w <= 0) continue;
      const normH = Math.min((heights[i] - waterLevel) / maxLandH, 1.0);
      if (resType === 'copper/tin/iron' || resType === 'silver/gold/gems') w *= (0.5 + normH);
      scored.push({ idx: i, score: w + rng() * 0.5, x: pts[i][0], z: pts[i][1] });
    }
    scored.sort((a, b) => b.score - a.score);
    for (const c of scored) {
      let tooClose = false;
      for (const p of chosen) {
        const dx = c.x - p.x, dz = c.z - p.z;
        if (dx * dx + dz * dz < MIN_DIST_SQ) { tooClose = true; break; }
      }
      if (tooClose) continue;
      chosen.push({ idx: c.idx, x: c.x, z: c.z, type: resType });
      break;
    }
  }

  return chosen;
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
  seed
}) {
  const adjustedCityCount = cityCount === 0 ? 0 : Math.max(1, Math.round(cityCount * areaRatio));
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
