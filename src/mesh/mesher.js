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
  if (normH <= 0) return 0;
  if (normH > 0.80) return 11;
  const moistureBand = Math.min(Math.floor(moisture / 5), 4);
  return BIOMES_MATRIX[moistureBand][tempBand];
}

export function buildTerrainMesh(region) {
  const { pts, triangles, heights, rawHeights, heightMax, waterLevel, tempBand, moisture, biome } = region;
  const maxLandH = Math.max(heightMax - waterLevel, 0.001);
  const TERRAIN_Y_SCALE = 3.0;
  const n = pts.length;
  const positions = new Float32Array(n * 3);
  const colors = new Float32Array(n * 3);

  for (let i = 0; i < n; i++) {
    const rawH = heights[i];
    const y = rawH > waterLevel ? (rawHeights[i] * TERRAIN_Y_SCALE) : 0.0;
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
  const { pts, heights, rawHeights, waterLevel, rivers } = region;
  if (!rivers || !rivers.segments || rivers.segments.length === 0) return null;

  const positions = [];

  for (const seg of rivers.segments) {
    const i = seg[0], j = seg[1];
    const y1 = heights[i] > waterLevel ? (rawHeights[i] * 3.0 + 0.2) : 0.05;
    const y2 = heights[j] > waterLevel ? (rawHeights[j] * 3.0 + 0.2) : 0.05;

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

export function buildSettlements(region) {
  const { cities, towns, ruins, minorRuins, heights, rawHeights, waterLevel } = region;
  const group = new THREE.Group();
  group.name = 'settlements';

  const cityMat = new THREE.MeshLambertMaterial({ color: 0xcc9966 });
  const cityRoof = new THREE.MeshLambertMaterial({ color: 0x884422 });
  const cityWall = new THREE.MeshLambertMaterial({ color: 0xddbb88 });
  const townMat = new THREE.MeshLambertMaterial({ color: 0xbbaa88 });
  const townRoof = new THREE.MeshLambertMaterial({ color: 0x664422 });

  function addCity(x, z, baseY) {
    const keep = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.0, 0.6, 8), cityWall);
    keep.position.set(x, baseY + 0.3, z);
    keep.castShadow = true;
    group.add(keep);

    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 1.2, 8), cityMat);
    tower.position.set(x, baseY + 0.9, z);
    tower.castShadow = true;
    group.add(tower);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.8, 0.5, 8), cityRoof);
    roof.position.set(x, baseY + 1.5, z);
    roof.castShadow = true;
    group.add(roof);
  }

  function addTown(x, z, baseY) {
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.0, 0.4, 6), townMat);
    wall.position.set(x, baseY + 0.25, z);
    wall.castShadow = true;
    group.add(wall);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.8, 0.35, 6), townRoof);
    roof.position.set(x, baseY + 0.6, z);
    roof.castShadow = true;
    group.add(roof);
  }

  if (cities && cities.length) for (const c of cities) addCity(c.x, c.z, heights[c.idx] > waterLevel ? (rawHeights[c.idx] * 3.0) : 0.0);
  if (towns && towns.length) for (const t of towns) addTown(t.x, t.z, heights[t.idx] > waterLevel ? (rawHeights[t.idx] * 3.0) : 0.0);

  const ruinMat = new THREE.MeshLambertMaterial({ color: 0x888899 });
  if (region.ruins && region.ruins.length) {
    for (const r of region.ruins) {
      const n = 3 + Math.floor(Math.random() * 3);
      const terrainY = heights[r.idx] > waterLevel ? (rawHeights[r.idx] * 3.0) : 0.0;
      for (let i = 0; i < n; i++) {
        const h = 0.4 + Math.random() * 0.8;
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.25 + Math.random() * 0.2, 0.3 + Math.random() * 0.2, h, 6), ruinMat);
        const angle = (i / n) * Math.PI * 2;
        const dist = 0.6 + Math.random() * 1.2;
        pillar.position.set(r.x + Math.cos(angle) * dist, terrainY + h / 2, r.z + Math.sin(angle) * dist);
        pillar.rotation.y = Math.random() * Math.PI;
        pillar.castShadow = true;
        group.add(pillar);
      }
    }
  }

  const obeliskMat = new THREE.MeshLambertMaterial({ color: 0x888899 });
  if (region.minorRuins && region.minorRuins.length) {
    for (const r of region.minorRuins) {
      const obelisk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 3.5, 6), obeliskMat);
      const terrainY = heights[r.idx] > waterLevel ? (rawHeights[r.idx] * 3.0) : 0.0;
      obelisk.position.set(r.x, terrainY + 1.75, r.z);
      obelisk.castShadow = true;
      group.add(obelisk);
    }
  }

  return group;
}

export function buildBiomeViewMesh(region) {
  const { pts, triangles, heights, rawHeights, heightMax, waterLevel, biome } = region;
  const maxLandH = Math.max(heightMax - waterLevel, 0.001);
  const TERRAIN_Y_SCALE = 3.0;
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
      const y = rawH > waterLevel ? (rawHeights[vi] * TERRAIN_Y_SCALE) : 0.0;
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

export function buildTrouble(region) {
  const { trouble, heights, rawHeights, waterLevel } = region;
  const group = new THREE.Group();
  group.name = 'trouble';
  if (!trouble || trouble.length === 0) return group;

  const mat = new THREE.MeshLambertMaterial({ color: 0xcc2222 });
  for (const t of trouble) {
      const terrainY = heights[t.idx] > waterLevel ? (rawHeights[t.idx] * 3.0) : 0.0;
    const pyramid = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.5, 4), mat);
    pyramid.position.set(t.x, terrainY + 0.5, t.z);
    pyramid.rotation.x = Math.PI;
    pyramid.rotation.y = Math.PI / 4;
    pyramid.name = 'trouble';
    pyramid.castShadow = true;
    group.add(pyramid);
  }

  return group;
}

export function buildResources(region) {
  const { resources, heights, rawHeights, waterLevel } = region;
  const group = new THREE.Group();
  group.name = 'resources';
  if (!resources || resources.length === 0) return group;

  const mat = new THREE.MeshLambertMaterial({ color: 0xffd700 });
  for (const res of resources) {
      const terrainY = heights[res.idx] > waterLevel ? (rawHeights[res.idx] * 3.0) : 0.0;
    const y = terrainY + 2.0;
    const octa = new THREE.Mesh(new THREE.OctahedronGeometry(1.2, 0), mat);
    octa.position.set(res.x, y, res.z);
    octa.rotation.y = Math.PI / 4;
    octa.name = 'resource';
    group.add(octa);
  }

  return group;
}

export function buildSiteFeatures(region) {
  const { outpostSites, landmarkSites, hazards, obstacles, areas, heights, rawHeights, waterLevel } = region;
  const group = new THREE.Group();
  group.name = 'siteFeatures';

  const outpostMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
  const outpostRoof = new THREE.MeshLambertMaterial({ color: 0xcc4444 });
  const landmarkMat = new THREE.MeshLambertMaterial({ color: 0x44ddff, emissive: 0x44ddff });
  const hazardMat = new THREE.MeshLambertMaterial({ color: 0xdd6633 });
  const obstacleMat = new THREE.MeshLambertMaterial({ color: 0xbb8844 });

  if (outpostSites && outpostSites.length) {
    for (const s of outpostSites) {
      const wall = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 0.8, 6), outpostMat);
      const terrainY = heights[s.idx] > waterLevel ? (rawHeights[s.idx] * 3.0) : 0.0;
      wall.position.set(s.x, terrainY + 0.4, s.z);
      wall.castShadow = true;
      group.add(wall);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.3, 6), outpostRoof);
      roof.position.set(s.x, terrainY + 0.85, s.z);
      roof.castShadow = true;
      group.add(roof);
    }
  }

  if (landmarkSites && landmarkSites.length) {
    for (const s of landmarkSites) {
      const terrainY = heights[s.idx] > waterLevel ? (rawHeights[s.idx] * 3.0) : 0.0;
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 1.5, 6), landmarkMat);
      pillar.position.set(s.x, terrainY + 0.75, s.z);
      pillar.castShadow = true;
      group.add(pillar);
    }
  }

  if (hazards && hazards.length) {
    for (const h of hazards) {
      if (h.regionWide) continue;
      const terrainY = heights[h.idx] > waterLevel ? (rawHeights[h.idx] * 3.0) : 0.0;
      const pyramid = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.0, 4), hazardMat);
      pyramid.position.set(h.x, terrainY + 0.3, h.z);
      pyramid.rotation.x = Math.PI;
      pyramid.rotation.y = Math.PI / 4;
      pyramid.castShadow = true;
      group.add(pyramid);
    }
  }

  if (obstacles && obstacles.length) {
    for (const o of obstacles) {
      const terrainY = heights[o.idx] > waterLevel ? (rawHeights[o.idx] * 3.0) : 0.0;
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 1.2, 6), obstacleMat);
      pillar.position.set(o.x, terrainY + 0.6, o.z);
      pillar.castShadow = true;
      group.add(pillar);
    }
  }

  if (areas && areas.length) {
    for (const a of areas) {
      const terrainY = heights[a.idx] > waterLevel ? (rawHeights[a.idx] * 3.0) : 0.0;
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 1.2, 6), obstacleMat);
      pillar.position.set(a.x, terrainY + 0.6, a.z);
      pillar.castShadow = true;
      group.add(pillar);
      if (a.neighbors) {
        for (const n of a.neighbors) {
          const nY = heights[n.idx] > waterLevel ? (rawHeights[n.idx] * 3.0) : 0.0;
          const np = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 1.0, 6), obstacleMat);
          np.position.set(n.x, nY + 0.5, n.z);
          np.castShadow = true;
          group.add(np);
        }
      }
    }
  }

  return group;
}
