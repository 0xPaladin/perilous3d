import { Delaunay } from "d3-delaunay";

/**
 * Generate voronoi cell centroids for an extent.
 * Cell count scales with area: 25 cells at 50 km, proportional to areaRatio.
 * Accepts an external rng function (from the caller) to avoid duplicating PRNG code.
 */
export function generateVoronoiCells(extent, rng) {
  const areaRatio = (extent.width * extent.width) / (50 * 50);
  const nCells = Math.max(25, Math.floor(25 * areaRatio));
  const centroids = [];
  for (let i = 0; i < nCells; i++) {
    centroids.push([
      -extent.width / 2 + rng() * extent.width,
      -extent.height / 2 + rng() * extent.height,
    ]);
  }
  const cells = centroids.map((_, i) => ({
    idx: i,
    type: "water",
    heightBase: 0,
    heightRange: 0,
  }));
  return { centroids, cells, nCells };
}

/**
 * Build cell adjacency from centroids via d3-delaunay Voronoi.
 * Returns { adj, edgeSet, delaunay } where edgeSet contains indices of cells whose
 * Voronoi polygon touches the extent boundary (clipped cells).
 */
export function buildCellAdjacency(centroids, extent) {
  const n = centroids.length;
  const del = Delaunay.from(centroids);
  const hw = extent.width / 2, hh = extent.height / 2;
  const voronoi = del.voronoi([-hw, -hh, hw, hh]);
  const adj = Array.from({ length: n }, (_, i) => Array.from(voronoi.neighbors(i)));

  // Scan each cell's clipped polygon — if any vertex is on the extent boundary,
  // the cell is an edge cell.
  const edgeSet = new Set();
  for (const poly of voronoi.cellPolygons()) {
    const idx = poly.index;
    for (const [px, pz] of poly) {
      if (px === -hw || px === hw || pz === -hh || pz === hh) {
        edgeSet.add(idx);
        break;
      }
    }
  }

  return { adj, edgeSet, delaunay: del };
}

/**
 * Find the nearest voronoi cell index for a point using d3-delaunay's walk search.
 */
export function findCellForPoint(x, z, _centroids, delaunay) {
  return delaunay.find(x, z);
}
