import * as THREE from 'three';
import {BIOME_COLORS} from './colors.js'

const HEIGHT_SCALE = 3.5;

export function buildTerrainMesh(display) {
  const { pts, triangles, heights, rawHeights, waterLevel, biome } = display;
  const TERRAIN_Y_SCALE = 3.0;
  const n = pts.length;
  const positions = new Float32Array(n * 3);
  const colors = new Float32Array(n * 3);

  for (let i = 0; i < n; i++) {
    const rawH = heights[i];
    const y = rawH > waterLevel ? (rawHeights[i] * TERRAIN_Y_SCALE) : 0.0;
    const b = biome ? biome[i] : 0;
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

export function buildRiverMesh(display) {
  const { pts, heights, rawHeights, waterLevel, rivers } = display;
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

export function buildTrees(display, state) {
  return new THREE.Group();
}

export function buildSettlements(display, state) {
  const { heights, rawHeights, waterLevel } = display;
  const { cities, towns, ruins, minorRuins } = state;
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
  if (ruins && ruins.length) {
    for (const r of ruins) {
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
  if (minorRuins && minorRuins.length) {
    for (const r of minorRuins) {
      const obelisk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 3.5, 6), obeliskMat);
      const terrainY = heights[r.idx] > waterLevel ? (rawHeights[r.idx] * 3.0) : 0.0;
      obelisk.position.set(r.x, terrainY + 1.75, r.z);
      obelisk.castShadow = true;
      group.add(obelisk);
    }
  }

  return group;
}

export function buildTrouble(display, state) {
  const { heights, rawHeights, waterLevel } = display;
  const { trouble } = state;
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

export function buildResources(display, state) {
  const { heights, rawHeights, waterLevel } = display;
  const { resources } = state;
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

export function buildSiteFeatures(display, state) {
  const { heights, rawHeights, waterLevel } = display;
  const { outpostSites, landmarkSites, hazards, obstacles, areas } = state;
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
