import * as THREE from 'three';

const HEIGHT_SCALE = 3.5;

const BIOME_COLORS = [
  [0.29, 0.54, 0.71],  // 0  Marine
  [0.83, 0.72, 0.48],  // 1  Hot desert
  [0.66, 0.60, 0.55],  // 2  Cold desert
  [0.55, 0.72, 0.35],  // 3  Savanna
  [0.55, 0.72, 0.35],  // 4  Grassland
  [0.36, 0.62, 0.28],  // 5  Tropical seasonal forest
  [0.36, 0.62, 0.28],  // 6  Temperate deciduous forest
  [0.29, 0.48, 0.23],  // 7  Tropical rainforest
  [0.29, 0.48, 0.23],  // 8  Temperate rainforest
  [0.54, 0.72, 0.33],  // 9  Taiga
  [0.54, 0.72, 0.33],  // 10 Tundra
  [0.85, 0.82, 0.78],  // 11 Glacier
  [0.54, 0.72, 0.33],  // 12 Wetland
];

const BIOMES_MATRIX = [
  new Uint8Array([1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 10]),
  new Uint8Array([3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 9, 9, 9, 9, 10, 10, 10]),
  new Uint8Array([5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 9, 9, 9, 9, 9, 10, 10, 10]),
  new Uint8Array([5, 6, 6, 6, 6, 6, 6, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 9, 9, 9, 9, 9, 9, 10, 10, 10]),
  new Uint8Array([7, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 9, 9, 9, 9, 9, 9, 9, 10, 10]),
];

function biomeFromMatrix(normH, tempBand, moisture) {
  if (normH < 0) return 0;
  if (normH > 0.80) return 11;
  const moistureBand = Math.min(Math.floor(moisture / 5), 4);
  return BIOMES_MATRIX[moistureBand][tempBand];
}

export function buildTerrainMesh(region) {
  const { pts, triangles, heights, heightMax, waterLevel, tempBand, moisture, biome } = region;
  const maxLandH = Math.max(heightMax - waterLevel, 0.001);
  const scale = HEIGHT_SCALE / maxLandH;
  const n = pts.length;
  const positions = new Float32Array(n * 3);
  const colors = new Float32Array(n * 3);

  for (let i = 0; i < n; i++) {
    const rawH = heights[i];
    const y = (rawH - waterLevel) * scale;
    const normH = (rawH - waterLevel) / maxLandH;
    const b = (tempBand && moisture) ? biomeFromMatrix(normH, tempBand[i], moisture[i]) : (biome ? biome[i] : 0);
    const c = BIOME_COLORS[b] || BIOME_COLORS[0];
    positions[i * 3 + 0] = pts[i][0];
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = pts[i][1];
    colors[i * 3 + 0] = c[0];
    colors[i * 3 + 1] = c[1];
    colors[i * 3 + 2] = c[2];
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geom.setIndex(new THREE.BufferAttribute(triangles, 1));
  geom.computeVertexNormals();

  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.name = 'terrain';
  return mesh;
}

export function buildRiverMesh(region) {
  const { pts, heights, waterLevel, heightMax, rivers } = region;
  if (!rivers || !rivers.segments || rivers.segments.length === 0) return null;

  const maxLandH = Math.max(heightMax - waterLevel, 0.001);
  const scale = HEIGHT_SCALE / maxLandH;

  const positions = [];

  for (const seg of rivers.segments) {
    const i = seg[0], j = seg[1];
    const y1 = Math.max(0, (heights[i] - waterLevel) * scale) + 0.03;
    const y2 = Math.max(0, (heights[j] - waterLevel) * scale) + 0.03;

    positions.push(pts[i][0], y1, pts[i][1]);
    positions.push(pts[j][0], y2, pts[j][1]);
  }

  if (positions.length === 0) return null;

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

  const mat = new THREE.LineBasicMaterial({ color: 0x3b9eff, transparent: true, opacity: 0.8 });

  return new THREE.LineSegments(geo, mat);
}

export function buildTrees(region, scene) {
  return new THREE.Group();
}

export function buildSettlements(region, scene) {
  return new THREE.Group();
}

export function buildBiomeViewMesh(region) {
  const { pts, triangles, heights, heightMax, waterLevel, biome } = region;
  const maxLandH = Math.max(heightMax - waterLevel, 0.001);
  const scale = HEIGHT_SCALE / maxLandH;
  const triCount = triangles.length / 3;

  const positions = new Float32Array(triCount * 3 * 3);
  const colors = new Float32Array(triCount * 3 * 3);

  const biomes = Array.isArray(biome) ? biome : [];

  for (let t = 0; t < triCount; t++) {
    const i0 = triangles[t * 3];
    const i1 = triangles[t * 3 + 1];
    const i2 = triangles[t * 3 + 2];

    const b0 = biomes[i0] || 0;
    const b1 = biomes[i1] || 0;
    const b2 = biomes[i2] || 0;
    const tb = (b0 === b1 || b0 === b2) ? b0 : b1;
    const c = BIOME_COLORS[tb] || BIOME_COLORS[0];

    const idx = t * 9;
    for (let k = 0; k < 3; k++) {
      const vi = [i0, i1, i2][k];
      const rawH = heights[vi];
      const y = (rawH - waterLevel) * scale;
      const pi = idx + k * 3;
      positions[pi] = pts[vi][0];
      positions[pi + 1] = y;
      positions[pi + 2] = pts[vi][1];
      colors[pi] = c[0];
      colors[pi + 1] = c[1];
      colors[pi + 2] = c[2];
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geom.computeVertexNormals();

  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.name = 'biomeView';

  const edges = new THREE.EdgesGeometry(geom);
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.15 });
  const wireframe = new THREE.LineSegments(edges, edgeMat);
  wireframe.name = 'biomeViewEdges';

  const group = new THREE.Group();
  group.name = 'biomeViewGroup';
  group.add(mesh);
  group.add(wireframe);

  return group;
}