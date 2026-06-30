import * as THREE from "three";
import { TERRAIN, TERRAIN_COLORS } from './colors.js';

const tc = t => TERRAIN_COLORS[t];

export const HILL_PALETTE = [
  new THREE.Color(...tc(TERRAIN.GRASS)),
  new THREE.Color(...tc(TERRAIN.WOOD_LIGHT)),
  new THREE.Color(...tc(TERRAIN.WOOD_DARK)),
  new THREE.Color(...tc(TERRAIN.SWAMP)),
  new THREE.Color(...tc(TERRAIN.WOOD_DEAD)),
  new THREE.Color(...tc(TERRAIN.MOUNTAIN)),
];

export const DUNE_PALETTE = [
  new THREE.Color(...tc(TERRAIN.BEACH)),
  new THREE.Color(...tc(TERRAIN.DESERT)),
  new THREE.Color(...tc(TERRAIN.DESERT)),
  new THREE.Color(...tc(TERRAIN.WOOD_DEAD)),
  new THREE.Color(...tc(TERRAIN.WOOD_DEAD)),
  new THREE.Color(...tc(TERRAIN.MOUNTAIN)),
  new THREE.Color(...tc(TERRAIN.MOUNTAIN)),
];

function heightColor(h, palette) {
  return palette[Math.min(palette.length - 1, Math.floor(h * palette.length))];
}

function edgeFade(x, z, half) {
  const dist = Math.sqrt(x * x + z * z);
  const fadeStart = half * 0.75;
  const t = Math.max(0, Math.min(1, (dist - fadeStart) / (half - fadeStart)));
  return t >= 1 ? 0 : 1 - t * t * (3 - 2 * t);
}

export function generateHillTile(prng, cx, cz, height, gridSize = 10) {
  const half = gridSize / 2;
  const nPeaks = 3 + Math.floor(prng() * 5);
  const peaks = [];
  for (let i = 0; i < nPeaks; i++) {
    const px = cx + (prng() - 0.5) * gridSize * 0.85;
    const pz = cz + (prng() - 0.5) * gridSize * 0.85;
    const ph = height * (0.3 + prng() * 0.7);
    peaks.push({ x: px, z: pz, h: ph });
  }
  return { type: "hill", peaks, falloff: 0.75 + prng() * 0.15, cx, cz, half, mainH: height, gridSize };
}

export function generateDuneTile(prng, cx, cz, height, gridSize = 10) {
  const half = gridSize / 2;
  const windAngle = prng() * Math.PI * 2;
  const asymmetry = 0.3 + prng() * 0.5;

  const offset = 0.5 + prng() * 1.5;
  const mx = cx + Math.cos(windAngle) * offset;
  const mz = cz + Math.sin(windAngle) * offset;
  const mh = height * (0.8 + prng() * 0.2);
  const peaks = [{ x: mx, z: mz, h: mh }];

  if (prng() > 0.4) {
    const sOff = -0.5 - prng() * 1.0;
    const sx = cx + Math.cos(windAngle) * sOff;
    const sz = cz + Math.sin(windAngle) * sOff;
    peaks.push({ x: sx, z: sz, h: mh * (0.3 + prng() * 0.3) });
  }

  const nHorns = Math.floor(prng() * 3);
  for (let i = 0; i < nHorns; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const spread = 1.5 + prng() * 1.5;
    const ha = windAngle + Math.PI / 2 * side + (prng() - 0.5) * 0.3;
    const hx = cx + Math.cos(ha) * spread;
    const hz = cz + Math.sin(ha) * spread;
    peaks.push({ x: hx, z: hz, h: mh * (0.4 + prng() * 0.3) });
  }

  return { type: "dune", peaks, falloff: 0.55 + prng() * 0.15, cx, cz, half, mainH: height, gridSize, windAngle, asymmetry };
}

export function computeHeight(x, z, tile) {
  const ef = edgeFade(x - tile.cx, z - tile.cz, tile.half);
  if (ef <= 0) return 0;

  let h = 0;
  for (const p of tile.peaks) {
    const pdx = x - p.x;
    const pdz = z - p.z;
    let dist = Math.sqrt(pdx * pdx + pdz * pdz);

    if (tile.type === "dune") {
      const angle = Math.atan2(pdz, pdx);
      const diff = angle - tile.windAngle;
      dist *= 1 + tile.asymmetry * Math.cos(diff);
      dist = Math.max(dist, 0.01);
    }

    const ph = p.h * tile.falloff ** dist;
    if (ph > h) h = ph;
  }

  return h * ef;
}

export function createTerrainTileMesh(tile, height, palette) {
  const gridSize = tile.gridSize || 10;
  const geo = new THREE.PlaneGeometry(gridSize, gridSize, gridSize, gridSize);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.getAttribute("position");

  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, computeHeight(pos.getX(i), pos.getZ(i), tile));
  }

  geo.computeVertexNormals();

  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const gy = pos.getY(i);
    const h = Math.max(0, Math.min(1, gy / (height * 1.25)));
    const c = heightColor(h, palette);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: tile.type === "dune" ? 0.95 : 0.85,
    metalness: 0,
    flatShading: true,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
