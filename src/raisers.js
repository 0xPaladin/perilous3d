// Template height raisers for Perilous Shores.
// Each raiser takes a point and returns a height contribution in [-1, 1] range.
// Best-effort reconstruction from minified Haxe/OpenFL output analysis.
//
// Templates: island, archipelago, bay, coast, peninsula, lake, land

import { Vec2 } from './grid.js';

// ---- Helper: smoothstep ----
function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// ---- Skeleton (midpoint-displacement tree from center to edge) ----
// Used by Island and Fjord templates
export class Skeleton {
  constructor() {
    this.bones = [];
  }

  addBone(p0, r0, p1, r1) {
    const bone = { p0, r0, p1, r1, segments: [p0, p1] };
    this.bones.push(bone);
    return bone;
  }

  shatter(bone, iterations = 4, chance = 0.5, asymmetry = 0.6) {
    let segs = bone.segments;
    for (let it = 0; it < iterations; it++) {
      const newSegs = [];
      for (let i = 0; i < segs.length - 1; i++) {
        const a = segs[i];
        const b = segs[i + 1];
        const mid = new Vec2(
          (a.x + b.x) / 2 + (Math.random() - 0.5) * asymmetry * a.dist(b) * 0.5,
          (a.y + b.y) / 2 + (Math.random() - 0.5) * asymmetry * a.dist(b) * 0.5
        );
        newSegs.push(a, mid);
      }
      newSegs.push(segs[segs.length - 1]);
      segs = newSegs;
    }
    bone.segments = segs;
  }

  // Distance from point to nearest bone segment, normalized by rollout length
  distRidge(point, power = 2) {
    let minDistSq = Infinity;
    for (const bone of this.bones) {
      const segs = bone.segments;
      for (let i = 0; i < segs.length - 1; i++) {
        const d = distToSegmentSq(point, segs[i], segs[i + 1]);
        if (d < minDistSq) minDistSq = d;
      }
    }
    return Math.pow(Math.sqrt(minDistSq), power);
  }

  distSoftRidge(point, ridgeSharpness = 3, rounding = 1.5) {
    const d = this.distRidge(point);
    return Math.pow(ridgeSharpness / (d + rounding), 2);
  }
}

function distToSegmentSq(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return distSq(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = a.x + t * dx, cy = a.y + t * dy;
  const ex = p.x - cx, ey = p.y - cy;
  return ex * ex + ey * ey;
}

function distSq(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return dx * dx + dy * dy;
}
function dist(a, b) { return Math.sqrt(distSq(a, b)); }

// ---- Poisson-disc sampling (used by Archipelago) ----
export function poissonDiscSamples(bounds, minDist, maxAttempts = 30) {
  // bounds: { w, h } — generate points with minimum spacing
  const points = [];
  const cellSize = minDist / Math.SQRT2;
  const gridW = Math.ceil(bounds.w / cellSize);
  const gridH = Math.ceil(bounds.h / cellSize);
  const grid = new Array(gridW * gridH).fill(-1);

  function addPoint(x, y) {
    const col = Math.floor(x / cellSize);
    const row = Math.floor(y / cellSize);
    if (col < 0 || col >= gridW || row < 0 || row >= gridH) return false;
    const idx = row * gridW + col;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nc = col + dc, nr = row + dr;
        const ni = nr * gridW + nc;
        if (nc >= 0 && nc < gridW && nr >= 0 && nr < gridH && ni >= 0 && ni < grid.length && grid[ni] !== -1) {
          const other = points[grid[ni]];
          if (distSq({ x, y }, other) < minDist * minDist) return false;
        }
      }
    }
    grid[idx] = points.length;
    points.push(new Vec2(x, y));
    return true;
  }

  // Seed with first point
  addPoint(bounds.w / 2, bounds.h / 2);

  let attempts = 0;
  while (points.length > 0 && attempts < maxAttempts * points.length) {
    const center = points[Math.floor(Math.random() * points.length)];
    const angle = Math.random() * Math.PI * 2;
    const rad = minDist + Math.random() * minDist;
    const nx = center.x + Math.cos(angle) * rad;
    const ny = center.y + Math.sin(angle) * rad;
    if (nx >= 0 && nx < bounds.w && ny >= 0 && ny < bounds.h) {
      addPoint(nx, ny);
    } else {
      attempts++;
    }
    if (attempts > maxAttempts * points.length + 500) break;
  }
  return points;
}

// ===========================================================================
// 8 Template Raisers
// ===========================================================================

// Helper: directional ramp — height decreases linearly with distance from a given direction
function directionalRamp(point, dir, power = 2.5) {
  const d = point.x * dir.x + point.y * dir.y; // dot product = distance along direction
  // d ranges from negative to positive along the world
  return Math.pow(smoothstep(-0.8, 0.8, d), power);
}

// ---- 0. Land (no raiser) ----
export class LandRaiser {
  raise(point) { return 0; }
}

// ---- 1. Island (Skeleton from center to edges) ----
export class IslandRaiser {
  constructor(center, radius) {
    this.skeleton = new Skeleton();
    this.radius = radius;
    this.build(center);
  }

  build(center) {
    // Main bone from center to top-right edge
    const edge = new Vec2(center.x + this.radius, center.y + this.radius);
    this.skeleton.addBone(center, 1.0, edge, 0.3);
    this.skeleton.shatter(this.skeleton.bones[0], 5, 0.5, 0.6);

    // Add 2–4 side bones branching from center
    const n = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2 + Math.random() * 0.5;
      const len = this.radius * (0.7 + Math.random() * 0.3);
      const p1 = new Vec2(center.x + Math.cos(angle) * len, center.y + Math.sin(angle) * len);
      this.skeleton.addBone(center, 0.7, p1, 0.3);
      this.skeleton.shatter(this.skeleton.bones[this.skeleton.bones.length - 1], 5, 0.5, 0.55);
    }
  }

  raise(point) {
    return this.skeleton.distSoftRidge(point, 2.5, 1.5);
  }
}

// ---- 2. Archipelago (Poisson-disc seeded islands) ----
export class ArchipelagoRaiser {
  constructor(bounds, count) {
    this.samples = poissonDiscSamples(bounds, count * 0.35);
  }

  raise(point) {
    let val = 0;
    for (const s of this.samples) {
      const d = dist(point, s);
      val = Math.max(val, smoothstep(0.4, 0.0, d) - 0.2);
    }
    return val;
  }
}

// ---- 3. Bay (directional ramp inward) ----
export class BayRaiser {
  constructor() {
    // Random direction vector pointing "into" the land
    const angle = Math.random() * Math.PI * 2;
    this.dir = new Vec2(Math.cos(angle), Math.sin(angle));
  }

  raise(point) {
    return directionalRamp(point, this.dir, 2.5);
  }
}

// ---- 4. Coast (directional ramp, simpler) ----
export class CoastRaiser {
  constructor() {
    const angle = Math.random() * Math.PI * 2;
    this.dir = new Vec2(Math.cos(angle), Math.sin(angle));
  }

  raise(point) {
    return directionalRamp(point, this.dir, 2.5) * 0.7;
  }
}

// ---- 5. Fjord (skeleton with deep incisions) ----
export class FjordRaiser {
  constructor(center, radius) {
    this.skeleton = new Skeleton();
    this.radius = radius;
    this.build(center);
  }

  build(center) {
    // Main spine
    const endA = new Vec2(center.x - this.radius * 0.8, center.y);
    const endB = new Vec2(center.x + this.radius * 0.8, center.y);
    this.skeleton.addBone(endA, 1.0, endB, 1.0);
    this.skeleton.shatter(this.skeleton.bones[0], 5, 0.5, 0.6);

    // Incisions — perpendicular cuts that lower the height
    this.incisions = [];
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const t = 0.2 + Math.random() * 0.6; // along the spine
      const px = endA.x + t * (endB.x - endA.x);
      const py = endA.y + t * (endB.y - endA.y);
      const perpAngle = Math.atan2(endB.y - endA.y, endB.x - endA.x) + Math.PI / 2;
      const len = this.radius * (0.3 + Math.random() * 0.4);
      const incEnd = new Vec2(px + Math.cos(perpAngle) * len, py + Math.sin(perpAngle) * len);
      this.incisions.push({ from: new Vec2(px, py), to: incEnd });
    }
  }

  raise(point) {
    let val = this.skeleton.distSoftRidge(point, 2.5, 1.5);
    // Reduce height near incision lines
    for (const inc of this.incisions) {
      const d = distToSegmentSq(point, inc.from, inc.to);
      const val2 = smoothstep(0, 0.3, Math.sqrt(d)) - 0.5;
      val = Math.min(val, val2);
    }
    return val;
  }
}

// ---- 6. Peninsula (single bone from interior to edge) ----
export class PeninsulaRaiser {
  constructor(center, radius) {
    this.skeleton = new Skeleton();
    this.radius = radius;
    const angle = Math.random() * Math.PI * 2;
    const girth = radius * 0.7;
    const tip = new Vec2(
      center.x + Math.cos(angle) * radius * 1.2,
      center.y + Math.sin(angle) * radius * 1.2
    );
    const base = new Vec2(
      center.x - Math.cos(angle) * girth,
      center.y - Math.sin(angle) * girth
    );
    this.skeleton.addBone(base, 0.7, tip, 1.0);
    this.skeleton.shatter(this.skeleton.bones[0], 5, 0.5, 0.55);
  }

  raise(point) {
    return this.skeleton.distSoftRidge(point, 2.5, 1.5);
  }
}

// ---- 7. Lake (radial — inverted island) ----
export class LakeRaiser {
  constructor(center, radius) {
    this.center = center;
    this.radius = radius;
  }

  raise(point) {
    const d = dist(point, this.center) / this.radius;
    // High in center, low at edge (inverted)
    return 1.0 - smoothstep(0.0, 1.1, d);
  }
}

// ---- Template factory ----
export function getRaiser(type, gridW, gridH, seed) {
  const center = new Vec2(0, 0);
  const radius = Math.min(gridW, gridH) * 0.45;
  const bounds = { w: gridW, h: gridH };

  switch (type) {
    case 'island':
      return new IslandRaiser(center, radius);
    case 'archipelago':
      return new ArchipelagoRaiser(bounds, radius);
    case 'bay':
      return new BayRaiser();
    case 'coast':
      return new CoastRaiser();
    case 'peninsula':
      return new PeninsulaRaiser(center, radius);
    case 'lake':
      return new LakeRaiser(center, radius);
    case 'land':
    default:
      return new LandRaiser();
  }
}
