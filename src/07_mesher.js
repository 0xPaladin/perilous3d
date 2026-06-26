import * as THREE from 'three';

const HEIGHT_SCALE = 3.5;

const COLORS = {
  water: [0.29, 0.54, 0.71],
  beach: [0.99, 0.78, 0.52],
  grass: [0.55, 0.72, 0.35],
  forest: [0.36, 0.62, 0.28],
  mountain: [0.66, 0.60, 0.55],
  snow: [0.85, 0.82, 0.78],
};

function terrainColor(h, maxLandH) {
  const t = maxLandH > 0 ? h / maxLandH : 0;
  if (t < 0) return COLORS.water;
  if (t < 0.25) return COLORS.grass;
  if (t < 0.50) return COLORS.forest;
  if (t < 0.75) return COLORS.mountain;
  return COLORS.snow;
}

export function buildTerrainMesh(region) {
  const { pts, triangles, heights, heightMax, waterLevel } = region;
  const maxLandH = Math.max(heightMax - waterLevel, 0.001);
  const scale = HEIGHT_SCALE / maxLandH;

  const n = pts.length;
  const positions = new Float32Array(n * 3);
  const colors = new Float32Array(n * 3);

  for (let i = 0; i < n; i++) {
    const rawH = heights[i];
    const y = (rawH - waterLevel) * scale;
    const c = terrainColor(rawH - waterLevel, maxLandH);
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

export function buildTrees(region, scene) {
  return new THREE.Group();
}

export function buildSettlements(region, scene) {
  return new THREE.Group();
}
