import Delaunator from 'delaunator';

/**
 * Voronoi cell generation and point-to-cell lookup.
 * Cells are a coarse grid overlay used by terrain commands to determine
 * land/water/hill assignment. Each point in the display pts array
 * maps to the nearest cell centroid.
 */

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

/**
 * Generate voronoi cell centroids for an extent.
 * Cell count scales with area: 25 cells at 50 km, proportional to areaRatio.
 */
export function generateVoronoiCells(extent, seed) {
  const rng = createRng(seed ^ 0xABCD);
  const areaRatio = (extent.width / 320) ** 2;
  const nCells = Math.max(25, Math.floor(25 * areaRatio));
  const centroids = [];
  for (let i = 0; i < nCells; i++) {
    centroids.push([
      runif(-extent.width / 2, extent.width / 2, rng),
      runif(-extent.height / 2, extent.height / 2, rng),
    ]);
  }
  const cells = centroids.map((_, i) => ({
    idx: i,
    type: 'water',
    heightBase: 0,
    heightRange: 0,
  }));
  return { centroids, cells, nCells };
}

/**
 * Find the nearest voronoi cell index for a point (brute force — nCells is small).
 */
export function findCellForPoint(x, z, centroids) {
  let bestIdx = 0;
  let bestSq = Infinity;
  for (let i = 0; i < centroids.length; i++) {
    const dx = x - centroids[i][0];
    const dz = z - centroids[i][1];
    const dsq = dx * dx + dz * dz;
    if (dsq < bestSq) {
      bestSq = dsq;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/**
 * Build cell adjacency from centroids via Delaunator.
 * Returns { adj, hullSet } where hullSet contains indices of hull (edge) cells.
 */
export function buildCellAdjacency(centroids) {
  const n = centroids.length;
  const flat = new Float64Array(n * 2);
  for (let i = 0; i < n; i++) {
    flat[i * 2] = centroids[i][0];
    flat[i * 2 + 1] = centroids[i][1];
  }
  const del = new Delaunator(flat);
  const adj = Array.from({ length: n }, () => []);
  const seen = Array.from({ length: n }, () => new Set());
  const hullSet = new Set(del.hull);
  for (let i = 0; i < del.triangles.length; i++) {
    const a = del.triangles[i];
    const b = del.triangles[(i % 3 === 2) ? i - 2 : i + 1];
    if (!seen[a].has(b)) { seen[a].add(b); adj[a].push(b); }
    if (!seen[b].has(a)) { seen[b].add(a); adj[b].push(a); }
  }
  return { adj, hullSet };
}