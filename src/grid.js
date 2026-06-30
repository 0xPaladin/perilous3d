// Hex grid + DCEL (Doubly Connected Edge List) for Perilous Shores terrain.
//
// PS grid model:
//   - Square grid of columns x rows
//   - Each cell is a (possibly irregular) hexagon
//   - Grid is stored as DCEL: plenty of Faces (cells), HalfEdges, Vertices
//   - Each cell has 6 neighbors (or fewer on edges)
//   - Optional random rotation applied to entire grid

export class Vec2 {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
  clone() { return new Vec2(this.x, this.y); }
  add(v) { return new Vec2(this.x + v.x, this.y + v.y); }
  scale(s) { return new Vec2(this.x * s, this.y * s); }
  length() { return Math.sqrt(this.x * this.x + this.y * this.y); }
  normalize() { const l = this.length() || 1; return new Vec2(this.x / l, this.y / l); }
  lerp(v, t) { return new Vec2(this.x + (v.x - this.x) * t, this.y + (v.y - this.y) * t); }
  dist(v) { return new Vec2(this.x - v.x, this.y - v.y).length(); }
}

// Edge / DCEL elements
export class Vertex {
  constructor(x, y) { this.x = x; this.y = y; }
}

export class HalfEdge {
  constructor() {
    this.origin = null;
    this.twin = null;
    this.next = null;
    this.prev = null;
    this.face = null;
  }
}

export class Face {
  constructor() {
    this.edge = null;
    this.data = null; // Cell data (land, height, terrain, etc.)
    this.index = -1;
  }
}

export class DCEL {
  constructor() {
    this.faces = [];
    this.vertices = [];
    this.edges = [];
  }
}

export function buildHexGrid(cols, rows, hexMode, rotation) {
  // hexMode: 0=standard, 1=rotated, 2=pointy-top, 3=irregular
  const a = 1.0; // edge length
  const dx = 2 * a;        // horizontal spacing (standard flat-top)
  const dy = Math.sqrt(3) * a; // vertical spacing

  const vertices = [];
  const faces = [];
  const edges = [];

  const cellW = (cols - 1) * dx + a;
  const cellH = (rows - 1) * dy + a;
  const offX = -cellW / 2;
  const offY = -cellH / 2;

  // Build vertices for flat-top hexagons
  const hexVerts = [
    new Vec2(0, -1),
    new Vec2(Math.sqrt(3) / 2, -0.5),
    new Vec2(Math.sqrt(3) / 2, 0.5),
    new Vec2(0, 1),
    new Vec2(-Math.sqrt(3) / 2, 0.5),
    new Vec2(-Math.sqrt(3) / 2, -0.5),
  ];

  // Build face (cell) center positions
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cx = offX + col * dx;
      const cy = offY + row * dy;

      // slight irregularity (PS mode 3)
      let cxJitter = 0, cyJitter = 0;
      if (hexMode === 3) {
        cxJitter = (Math.random() - 0.5) * 0.15;
        cyJitter = (Math.random() - 0.5) * 0.15;
      }

      const face = new Face();
      face.index = faces.length;
      face.data = {
        col, row,
        land: false,
        level: 0,
        aboveSea: 0,
        coastal: false,
        riverside: false,
        mountain: false,
        border: false,
        shallow: false,
        march: false,
        terrain: null,
        site: null,
        island: null,
        region: null, // back-ptr to region
        islandIndex: -1,
        center: new Vec2(cx + cxJitter, cy + cyJitter),
        poly: buildHexPolygon(cx + cxJitter, cy + cyJitter, a, hexMode),
        landPoly: null,
        _neighbors: [],
      };
      faces.push(face);
    }
  }

  // Link faces to neighbors (6-connectivity)
  const neighbors = [
    [0, -1], [1, -1], [1, 0], [0, 1], [-1, 1], [-1, 0]
  ];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col;
      const face = faces[idx];
      for (const [dc, dr] of neighbors) {
        const nc = col + dc;
        const nr = row + dr;
        if (nc >= 0 && nc < cols && nr >= 0 && nr < rows) {
          face.data._neighbors.push(faces[nr * cols + nc]);
        }
      }
      // Edge detection for borders
      if (col === 0 || col === cols - 1 || row === 0 || row === rows - 1) {
        face.data.border = true;
      }
    }
  }

  // Build DCEL edges (for outline / flood-fill — simplified DCEL)
  for (const face of faces) {
    const N = face.data.poly.length;
    for (let i = 0; i < N; i++) {
      const vKey = face.data.poly[i].x.toFixed(4) + '_' + face.data.poly[i].y.toFixed(4);
      if (!(vKey in vertices)) {
        vertices[vKey] = new Vertex(face.data.poly[i].x, face.data.poly[i].y);
      }
      const he = new HalfEdge();
      he.origin = vertices[vKey];
      he.face = face;
      face.edge = he;
      face.data._halfedges = face.data._halfedges || [];
      face.data._halfedges.push(he);
      edges.push(he);
    }
    // Link next/prev within face
    const hes = face.data._halfedges;
    for (let i = 0; i < hes.length; i++) {
      hes[i].next = hes[(i + 1) % hes.length];
      hes[i].prev = hes[(i - 1 + hes.length) % hes.length];
    }
  }
  // Twin-linking (O(N^2) for correctness, fine for small maps)
  for (let i = 0; i < edges.length; i++) {
    const e1 = edges[i];
    const vStart = e1.origin;
    const vEnd = e1.next.origin;
    for (let j = i + 1; j < edges.length; j++) {
      const e2 = edges[j];
      if (e2.origin.x === vEnd.x && e2.origin.y === vEnd.y &&
          e2.next.origin.x === vStart.x && e2.next.origin.y === vStart.y) {
        e1.twin = e2;
        e2.twin = e1;
        break;
      }
    }
  }

  return { faces, vertices: Object.values(vertices), edges, cols, rows };
}

function buildHexPolygon(cx, cy, size, mode) {
  // flat-top regular hexagon
  const V = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i;
    V.push(new Vec2(cx + size * Math.cos(angle), cy + size * Math.sin(angle)));
  }
  // If rotated mode, rotate 30 degrees
  if (mode === 1) {
    const cos = Math.cos(Math.PI / 6);
    const sin = Math.sin(Math.PI / 6);
    return V.map(v => new Vec2(cx + (v.x - cx) * cos - (v.y - cy) * sin,
                                cy + (v.x - cx) * sin + (v.y - cy) * cos));
  }
  // pointy-top
  if (mode === 2) {
    const cos = Math.cos(Math.PI / 6);
    const sin = Math.sin(Math.PI / 6);
    return V.map(v => new Vec2(cx + (v.x - cx) * cos - (v.y - cy) * sin,
                                cy + (v.x - cx) * sin + (v.y - cy) * cos));
  }
  return V;
}

export function rotationTransform(points, angle) {
  const cx = points[0].x;
  const cy = points[0].y;
  // compute centroid
  let sumX = 0, sumY = 0;
  for (const p of points) { sumX += p.x; sumY += p.y; }
  const cenX = sumX / points.length;
  const cenY = sumY / points.length;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return points.map(p => new Vec2(
    cenX + (p.x - cenX) * cos - (p.y - cenY) * sin,
    cenY + (p.x - cenX) * sin + (p.y - cenY) * cos
  ));
}

export function floodFill(startFace, predicate, visited) {
  const stack = [startFace];
  const result = [];
  visited = visited || new Set();
  while (stack.length) {
    const f = stack.pop();
    if (visited.has(f.index)) continue;
    if (!predicate(f)) continue;
    visited.add(f.index);
    result.push(f);
    for (const n of f.data._neighbors) {
      if (!visited.has(n.index) && predicate(n)) stack.push(n);
    }
  }
  return result;
}
