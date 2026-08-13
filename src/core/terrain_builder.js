import { Delaunay } from "d3-delaunay";
import { createNoise2D } from "simplex-noise";
import {
  generateVoronoiCells,
  findCellForPoint,
  buildCellAdjacency,
} from "./voronoi.js";
import { processVoronoiCommands } from "./terrain_commands.js";
import { buildBiomes, computeHabitability } from "../terrain/biomes.js";
import {
  VORONOI_TERRAIN_SCRIPTS,
  VORONOI_TEMPLATE_SCRIPTS,
  VORONOI_TERRAIN_RAINFALL,
} from "../terrain/config.js";
import { mulberry32 } from "./prng.js";

function runif(lo, hi, rng) {
  return lo + rng() * (hi - lo);
}

function generatePoints(n, extent, rng) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    pts.push([
      runif(-extent.width / 2, extent.width / 2, rng),
      runif(-extent.height / 2, extent.height / 2, rng),
    ]);
  }
  return pts;
}

/**
 * Generate simplex noise values for each point (same algorithm as terrain.js).
 */
function generateSimplexForPts(pts, extent, seed) {
  const h = new Float64Array(pts.length);
  const extentSize = extent.width;
  const half = extentSize / 2;
  const octaves = 6;
  const persistence = 0.5;
  const lacunarity = 2.0;
  const baseFreq = 2.0;
  const exponent = 3;

  const noises = [];
  for (let o = 0; o < octaves; o++) {
    const octaveSeed = (seed ^ 0xabcd) + o * 7919;
    const prng = mulberry32(octaveSeed);
    noises.push(createNoise2D(prng));
  }

  for (let i = 0; i < pts.length; i++) {
    const nx = (pts[i][0] + half) / extentSize;
    const ny = (pts[i][1] + half) / extentSize;
    let e = 0,
      maxAmp = 0,
      amp = 1,
      f = baseFreq;
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

/**
 * Build display data using the voronoi cell pipeline.
 * Replaces the old generateSimplexBase + processTerrainCommands path.
 *
 * Returns { h, pts, del, adj } — everything needed for the rest of buildRegion
 * (biomes, habitability, peaks, features, etc.).
 */
export function buildHeightFieldFromVoronoi(
  pts,
  extent,
  seed,
  template,
  terrainType,
) {
  const rng = mulberry32(seed ^ 0xcafe);

  // Generate voronoi cells
  const { centroids, cells } = generateVoronoiCells(extent, rng);
  const {
    adj: cellAdj,
    edgeSet,
    delaunay: cellDelaunay,
  } = buildCellAdjacency(centroids, extent);

  // Parse and execute voronoi commands (pre + template + post)
  const terrainScript =
    VORONOI_TERRAIN_SCRIPTS[terrainType] || VORONOI_TERRAIN_SCRIPTS.highland;
  const templateScript =
    VORONOI_TEMPLATE_SCRIPTS[template] || VORONOI_TEMPLATE_SCRIPTS.island;
  const rawCommands = [
    ...terrainScript.pre,
    ...templateScript,
    ...terrainScript.post,
  ];
  const commands = rawCommands
    .map((str) => {
      const parts = str.trim().split(/\s+/);
      const type = parts[0].toLowerCase();
      if (type === "land") {
        const pct = parseInt(parts[1], 10) / 100;
        const constraint = parts[2] ? parts[2].toLowerCase() : null;
        return { type: "land", pct, constraint };
      }
      if (type === "hill") {
        const pct = parseInt(parts[1], 10) / 100;
        const placement = parts[2] ? parts[2].toLowerCase() : "random";
        return { type: "hill", pct, placement };
      }
      if (type === "lake") {
        const pct = parseInt(parts[1], 10) / 100;
        const placement = parts[2] ? parts[2].toLowerCase() : "neighbors";
        return { type: "lake", pct, placement };
      }
      if (type === "scale") {
        const val = parseFloat(parts[1]);
        return { type: "scale", val };
      }
      if (type === "range" || type === "trough") {
        const pct = parseInt(parts[1], 10) / 100;
        let startName = parts[2] ? parts[2].toLowerCase() : "random";
        let stopName = parts[3] ? parts[3].toLowerCase() : "random";
        const CORNER_NAMES = [
          "topleft",
          "top",
          "topright",
          "left",
          "center",
          "right",
          "bottomleft",
          "bottom",
          "bottomright",
        ];
        if (startName === "random" || !CORNER_NAMES.includes(startName)) {
          startName = CORNER_NAMES[Math.floor(rng() * CORNER_NAMES.length)];
        }
        if (stopName === "random" || !CORNER_NAMES.includes(stopName)) {
          stopName = CORNER_NAMES[Math.floor(rng() * CORNER_NAMES.length)];
        }
        return { type, pct, start: startName, stop: stopName };
      }
      return null;
    })
    .filter(Boolean);

  processVoronoiCommands(
    commands,
    cells,
    centroids,
    cellAdj,
    edgeSet,
    rng,
    extent,
    cellDelaunay,
  );

  // Generate simplex noise per-point
  const simplexH = generateSimplexForPts(pts, extent, seed);

  // Map simplex values to heights based on cell type.
  // 0 is the water boundary — water cells ≤ 0, land cells > 0.
  const heights = new Float64Array(pts.length);
  const cellIndexForPoint = new Uint16Array(pts.length);
  for (let i = 0; i < pts.length; i++) {
    const ci = findCellForPoint(pts[i][0], pts[i][1], centroids, cellDelaunay);
    cellIndexForPoint[i] = ci;
    const cell = cells[ci];
    const s = simplexH[i];
    if (
      cell.type === "water" ||
      cell.type === "lake" ||
      cell.type === "trough"
    ) {
      heights[i] = -1 + s;
    } else if (cell.type === "land") {
      heights[i] = 0.01 + s * 0.25;
    } else if (cell.type === "hill") {
      heights[i] = cell.heightBase + s * cell.heightRange;
    } else if (cell.type === "range") {
      heights[i] = cell.heightBase + s * cell.heightRange;
    } else {
      heights[i] = s * 0.25;
    }
  }

  return { heights, pts, centroids, cells, cellDelaunay, cellAdj, cellIndexForPoint };
}

/**
 * Build full display data from a region state using voronoi pipeline.
 */
export function buildDisplayFromState(state) {
  const {
    seed,
    extent,
    waterLevel,
    template,
    terrain: terrainType,
    baseTemp,
    cityCount,
    numPoints,
  } = state;
  const rng = mulberry32(seed);
  const areaRatio = (extent.width / 320) ** 2;
  const npts = numPoints > 0 ? numPoints : Math.max(3000, Math.floor((15000 + rng() * 5000) * areaRatio));

  // 1. Random points + triangulation
  const pts = generatePoints(npts, extent, rng);
  const del = Delaunay.from(pts);
  const adj = Array.from({ length: npts }, (_, i) =>
    Array.from(del.neighbors(i)),
  );

  // 2. Build height field from voronoi cells (0 = water boundary)
  const {
    heights: h,
    centroids,
    cells,
    cellAdj,
    cellIndexForPoint,
  } = buildHeightFieldFromVoronoi(
    pts,
    extent,
    seed,
    template,
    terrainType,
  );

  // 3. Biomes, rivers, etc. (0 is the water boundary for voronoi terrain)
  const state_ = { scale: 1.0, rainfall: VORONOI_TERRAIN_RAINFALL[terrainType] ?? 1.0, radiusScale: 1.0, ratio: 1.0 };
  const biomesResult = buildBiomes(h, {
    adj,
    pts,
    extent,
    waterLevel: 0,
    baseTemp,
    npts,
    state: state_,
  });
  const finalH = biomesResult.h;
  const {
    rawHeights,
    heightMin,
    heightMax,
    temperature,
    tempBand,
    rivers,
    moisture,
    biome,
    maxLandH,
  } = biomesResult;

  const { habitability, nearWater } = computeHabitability(
    pts,
    finalH,
    0,
    biome,
    adj,
    rivers.flux,
    maxLandH,
  );

  // 4. Build display object (mountains/peaks computed later in buildRegion)
  const display = {
    pts,
    triangles: del.triangles,
    halfedges: del.halfedges,
    adj,
    heights: Array.from(finalH),
    rawHeights,
    heightMin,
    heightMax,
    extent,
    waterLevel: 0,
    temperature,
    tempBand,
    moisture,
    biome,
    rivers,
    habitability,
    nearWater,
    mountainCount: 0,
    mounts: [],
  };

  return {
    display,
    h: finalH,
    pts,
    adj,
    rivers,
    biome,
    maxLandH,
    habitability,
    nearWater,
    heightMax,
    centroids,
    cells,
    cellAdj,
    cellIndexForPoint,
  };
}
