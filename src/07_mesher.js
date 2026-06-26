import * as THREE from 'three';
import * as COLORS from './08_colors.js';

const MESH_RES = 160; // high-res grid for smooth terrain

export function buildTerrainMesh(region) {
  const { faces, cols, rows, waterLevel } = region;

  // Compute world bounds
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const f of faces) {
    if (f.data.center.x < minX) minX = f.data.center.x;
    if (f.data.center.y < minY) minY = f.data.center.y;
    if (f.data.center.x > maxX) maxX = f.data.center.x;
    if (f.data.center.y > maxY) maxY = f.data.center.y;
  }

  const width = maxX - minX || 1;
  const depth = maxY - minY || 1;

  // Build high-res grid vertices
  const nX = MESH_RES;
  const nZ = MESH_RES;
  const vertsPerRow = nX + 1;
  const numVerts = vertsPerRow * (nZ + 1);
  const positions = new Float32Array(numVerts * 3);
  const colors = new Float32Array(numVerts * 3);

  // Find which cell each vertex maps to
  const wScale = width / nX;
  const dScale = depth / nZ;

  for (let iz = 0; iz <= nZ; iz++) {
    for (let ix = 0; ix <= nX; ix++) {
      const vi = (iz * vertsPerRow + ix);
      const worldX = minX + ix * wScale;
      const worldZ = minY + iz * dScale;

      // Find nearest cell and get terrain type + interpolation weight
      const { cell, fx, fz } = findCell(faces, worldX, worldZ, cols, rows);

      const terrainColor = COLORS.terrainColor(cell);
      const h = cell.data.level * 15; // scale height for 3D view

      positions[vi * 3 + 0] = worldX - (minX + maxX) / 2;
      positions[vi * 3 + 1] = h;
      positions[vi * 3 + 2] = worldZ - (minY + maxY) / 2;

      colors[vi * 3 + 0] = terrainColor[0];
      colors[vi * 3 + 1] = terrainColor[1];
      colors[vi * 3 + 2] = terrainColor[2];
    }
  }

  const geom = new THREE.BufferGeometry();

  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  // Build triangle indices
  const indices = [];
  for (let iz = 0; iz < nZ; iz++) {
    for (let ix = 0; ix < nX; ix++) {
      const a = iz * vertsPerRow + ix;
      const b = a + 1;
      const c = (iz + 1) * vertsPerRow + ix;
      const d = (iz + 1) * vertsPerRow + ix + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }
  geom.setIndex(indices);
  geom.computeVertexNormals();

  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: false });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.name = 'terrain';

  return mesh;
}

// Locate the hex cell containing a 2D point by searching nearest center
function findCell(faces, x, z, cols, rows) {
  let bestIdx = 0, bestDist = Infinity;
  for (let i = 0; i < faces.length; i++) {
    const dx = x - faces[i].data.center.x;
    const dz = z - faces[i].data.center.y;
    const d = dx * dx + dz * dz;
    if (d < bestDist) { bestDist = d; bestIdx = i; }
  }
  return { cell: faces[bestIdx], fx: 0, fz: 0 };
}

// Place individual trees on Wood-terrain cells (from proceduralisland style)
export function buildTrees(region, scene) {
  const woodCells = region.faces.filter(f => f.data.land && !f.data.mountain &&
    (f.data.terrain === COLORS.WOOD_DARK || f.data.terrain === COLORS.WOOD_LIGHT || f.data.terrain === COLORS.WOOD_DEAD));

  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
  const leafMats = {
    [COLORS.WOOD_DARK]: new THREE.MeshLambertMaterial({ color: 0x2e7d32 }),
    [COLORS.WOOD_LIGHT]: new THREE.MeshLambertMaterial({ color: 0x4caf50 }),
    [COLORS.WOOD_DEAD]: new THREE.MeshLambertMaterial({ color: 0x8d6e63 }),
  };

  const group = new THREE.Group();
  group.name = 'trees';

  const maxTrees = Math.min(woodCells.length, 600);
  const step = Math.max(1, Math.floor(woodCells.length / maxTrees));

  let idx = 0;
  for (let i = 0; i < woodCells.length && idx < maxTrees; i += step) {
    const cell = woodCells[i];
    const x = cell.data.center.x;
    const z = cell.data.center.y;
    const h = cell.data.level * 15;

    const treeGroup = new THREE.Group();
    const trunkH = 0.3 + Math.random() * 0.4;
    const trunkR = 0.06;
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(trunkR, trunkR * 1.3, trunkH, 5),
      trunkMat
    );
    trunk.position.y = h + trunkH / 2;
    treeGroup.add(trunk);

    const crownR = 0.25 + Math.random() * 0.35;
    const crownH = 0.2 + Math.random() * 0.3;
    const crown = new THREE.Mesh(
      new THREE.CylinderGeometry(crownR * 0.5, crownR, crownH, 6),
      leafMats[cell.data.terrain] || leafMats[COLORS.WOOD_LIGHT]
    );
    crown.position.y = h + trunkH + crownH / 2;
    treeGroup.add(crown);

    treeGroup.position.set(x, 0, z);
    group.add(treeGroup);
    idx++;
  }
  return group;
}

// Place simple settlement buildings (colored boxes)
export function buildSettlements(region, scene) {
  // PS spawns 3-8 towns depending on map size; we reuse PS `island` data for town candidates
  const group = new THREE.Group();
  group.name = 'settlements';
  const landCells = region.faces.filter(f => f.data.land && !f.data.border && !f.data.mountain);

  const numTowns = Math.max(1, Math.floor(Math.sqrt(region.cols * region.rows) * 0.12));
  const matPalette = [
    0xe74c3c, 0xf39c12, 0x2ecc71, 0x3498db, 0x9b59b6,
    0xe67e22, 0x1abc9c, 0xf1c40f
  ];

  for (let i = 0; i < numTowns; i++) {
    const cell = landCells[Math.floor(Math.random() * landCells.length)];
    if (!cell) continue;
    const x = cell.data.center.x;
    const z = cell.data.center.y;
    const h = cell.data.level * 15;
    const matColor = matPalette[i % matPalette.length];

    const building = new THREE.Mesh(
      new THREE.BoxGeometry(0.4 + Math.random() * 0.3, 0.4 + Math.random() * 0.6, 0.4 + Math.random() * 0.3),
      new THREE.MeshPhongMaterial({ color: matColor, flatShading: true })
    );
    building.position.set(x, h + 0.3, z);
    group.add(building);
  }
  return group;
}
