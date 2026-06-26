// Coastline refinement for Perilous Shores islands.
// Reconstructs two key techniques:
//   1. Fractal midpoint displacement — subdivides each edge, displaces midpoint perpendicularly
//   2. Chaikin curve smoothing — 2 passes of corner-cutting subdivision

import { Vec2 } from './03_grid.js';
import { smoothstep } from './04_raisers.js';

// ---- Fractal midpoint displacement on a polygon ----
export function fractalMidpointDisplace(points, iterations = 4, roughness = 0.7) {
  let out = points;
  for (let it = 0; it < iterations; it++) {
    const next = [];
    for (let i = 0; i < out.length; i++) {
      const a = out[i];
      const b = out[(i + 1) % out.length];
      next.push(a);
      const mid = new Vec2((a.x + b.x) / 2, (a.y + b.y) / 2);
      // Perpendicular direction
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const px = -dy / len, py = dx / len;
      const amplitude = roughness * Math.pow(0.5, it) * (Math.random() - 0.5) * 2;
      mid.x += px * amplitude * 0.15;
      mid.y += py * amplitude * 0.15;
      next.push(mid);
    }
    out = next;
  }
  return out;
}

// ---- Chaikin corner-cutting smoothing ----
// Subdivides each edge at 1/4 and 3/4, discards old vertices.
// For closed polygons with sharp corners preserved across iterations.
export function chaikinSmooth(points, iterations = 2, preserveEndpoints = false) {
  let pts = points;
  for (let it = 0; it < iterations; it++) {
    const next = [];
    const n = pts.length;
    // If closed, we smooth the wrap-around edge too
    for (let i = 0; i < n; i++) {
      const p0 = pts[i];
      const p1 = pts[(i + 1) % n];
      // Cut at 1/4 (toward p0) and 3/4 (toward p1)
      next.push(new Vec2(0.75 * p0.x + 0.25 * p1.x, 0.75 * p0.y + 0.25 * p1.y));
      next.push(new Vec2(0.25 * p0.x + 0.75 * p1.x, 0.25 * p0.y + 0.75 * p1.y));
    }
    pts = next;
  }
  return pts;
}

// ---- Combined coastline pipeline ----
export function buildCoastline(points, rugged = false) {
  // 1. Fractal midpoint displacement for waviness
  let refined = rugged
    ? fractalMidpointDisplace(points, 5, 0.8)
    : fractalMidpointDisplace(points, 4, 0.7);

  // 2. Chaikin smoothing for organic feel
  refined = chaikinSmooth(refined, 2);

  // 3. Close polygon if not already
  if (Vec2.dist(refined[0], refined[refined.length - 1]) > 0.001) {
    refined.push(refined[0].clone());
  }
  return refined;
}

// ---- Construct an island outline polygon from face centers ----
// Returns a simplified convex hull–like outline using angular sweep around centroid.
// Used when we don't have a full DCEL outline — we work from cell perimeters.
export function constructIslandOutline(islandFaces) {
  // Walk the perimeter: cells on the border of the island that have a missing neighbor
  const perimeter = [];
  const cellSet = new Set(islandFaces.map(f => f.index));

  for (const f of islandFaces) {
    if (!f.data.coastal && !f.data.border) continue;
    for (let v = 0; v < f.data.poly.length; v++) {
      const va = f.data.poly[v];
      const vb = f.data.poly[(v + 1) % f.data.poly.length];
      // Check if this edge is shared with a non-island face
      const midX = (va.x + vb.x) / 2;
      const midY = (va.y + vb.y) / 2;
      const neighbor = findNearestFace(midX, midY, islandFaces);
      if (!neighbor || !cellSet.has(neighbor.index)) {
        perimeter.push(va.clone());
      }
    }
  }

  // Sort perimeter vertices angularly around centroid
  if (perimeter.length < 3) {
    // Fallback: just use bounding octagon
    return buildBoundingOctagon(islandFaces);
  }

  let cx = 0, cy = 0;
  for (const v of perimeter) { cx += v.x; cy += v.y; }
  cx /= perimeter.length; cy /= perimeter.length;
  perimeter.sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));

  return perimeter;
}

function findNearestFace(x, y, islandFaces) {
  let closest = null, minD = Infinity;
  for (const f of islandFaces) {
    const d = Vec2.dist(new Vec2(x, y), f.data.center);
    if (d < minD) { minD = d; closest = f; }
  }
  return minD < 2 ? closest : null;
}

function buildBoundingOctagon(islandFaces) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const f of islandFaces) {
    if (f.data.center.x < minX) minX = f.data.center.x;
    if (f.data.center.y < minY) minY = f.data.center.y;
    if (f.data.center.x > maxX) maxX = f.data.center.x;
    if (f.data.center.y > maxY) maxY = f.data.center.y;
  }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const w = maxX - minX, h = maxY - minY;
  // Octagonal approximation
  const pts = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const rx = w / 2 * 1.05, ry = h / 2 * 1.05;
    pts.push(new Vec2(cx + rx * Math.cos(a), cy + ry * Math.sin(a)));
  }
  return pts;
}
