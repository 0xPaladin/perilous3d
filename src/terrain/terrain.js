import { resolveFeatures } from './features.js';
import { generatePeoples } from '../people/people.js';
import { buildDisplayFromState } from '../core/terrain_builder.js';
import { mulberry32 } from '../core/prng.js';

const createRng = mulberry32;
export { createRng };


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

export function buildRegion(template, seed, terrainType, baseTemp = 22, cityCount = 0, extentSize = 320, numPoints = 0, featuresEnabled = true) {
  const rng = createRng(seed);
  const extent = { width: extentSize, height: extentSize };
  const areaRatio = (extentSize / 320) ** 2;

  // Build state object for voronoi pipeline
  const state_in = { seed, waterLevel: 0, extent, template, terrain: terrainType, baseTemp, cityCount, numPoints };

  // Run voronoi-based display builder
  const {
    display: voronoiDisplay,
    h, pts, adj, rivers, biome, maxLandH, habitability, nearWater, heightMax,
    centroids, cells, cellAdj, cellIndexForPoint,
  } = buildDisplayFromState(state_in);
  const mounts = findMountainPeaks(pts, h, voronoiDisplay.waterLevel, heightMax, adj, voronoiDisplay.extent, biome);
  voronoiDisplay.mounts = mounts;
  voronoiDisplay.mountainCount = mounts.length;

  const emptyFeatures = {
    resources: [], cities: [], towns: [], ruins: [], minorRuins: [],
    trouble: [], features: [], outpostSites: [], landmarkSites: [],
    factionSites: [], hazards: [], obstacles: [], areas: [],
  };
  const {
    resources = [],
    cities = [],
    towns = [],
    ruins = [],
    minorRuins = [],
    trouble = [],
    features = [],
    outpostSites = [],
    landmarkSites = [],
    factionSites = [],
    hazards = [],
    obstacles = [],
    areas = [],
  } = featuresEnabled ? resolveFeatures({
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
    seed,
    cells,
    cellAdj,
    cellIndexForPoint,
  }) : emptyFeatures;

  const peoples = generatePeoples(seed, { template, terrain: terrainType, baseTemp });

  const regionState = {
    seed,
    extent,
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
