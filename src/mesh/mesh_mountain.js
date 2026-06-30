import * as THREE from "three";
import { TERRAIN, TERRAIN_COLORS } from './colors.js';

const tc = t => TERRAIN_COLORS[t];

const HEIGHT_COLORS = {
  deep:    new THREE.Color(...tc(TERRAIN.WOOD_DARK)),
  low:     new THREE.Color(...tc(TERRAIN.WOOD_LIGHT)),
  mid:     new THREE.Color(...tc(TERRAIN.WOOD_DEAD)),
  high:    new THREE.Color(...tc(TERRAIN.MOUNTAIN)),
  peak:    new THREE.Color(...tc(TERRAIN.DESERT)),
  snow:    new THREE.Color(0xf0f4ff),
};

function heightColor(h, seed) {
  if (h > 0.82 + seed * 0.02) return HEIGHT_COLORS.snow;
  if (h > 0.7)  return HEIGHT_COLORS.peak;
  if (h > 0.5)  return HEIGHT_COLORS.high;
  if (h > 0.3)  return HEIGHT_COLORS.mid;
  if (h > 0.15) return HEIGHT_COLORS.low;
  return HEIGHT_COLORS.deep;
}

export function generateMountainTile(prng, cx, cz, height, gridSize = 10) {
  const half = gridSize / 2;

  const offX = Math.floor(prng() * 3) - 1;
  const offZ = Math.floor(prng() * 3) - 1;
  const peakX = cx + offX;
  const peakZ = cz + offZ;

  const mainH = height * (0.75 + prng() * 0.5);
  const falloff = 0.55 + prng() * 0.25;

  const peaks = [{ x: peakX, z: peakZ, h: mainH }];

  const nSub = Math.floor(prng() * 3);
  for (let i = 0; i < nSub; i++) {
    const da = i === 0 ? (prng() * 2 + 0.5) * Math.PI : (prng() * 2 + 1.5) * Math.PI;
    const d = 2 + Math.round(prng() * 1.999);
    const sx = Math.round(Math.cos(da) * d);
    const sz = Math.round(Math.sin(da) * d);
    if (sx === 0 && sz === 0) continue;
    const sxAbs = peakX + sx;
    const szAbs = peakZ + sz;
    if (Math.abs(sxAbs - cx) > half || Math.abs(szAbs - cz) > half) continue;
    const subH = mainH * (0.5 + prng() * 0.3);
    peaks.push({ x: sxAbs, z: szAbs, h: subH });
  }

  return { peaks, falloff, cx, cz, half, mainH, gridSize };
}

export function computeHeight(x, z, tile) {
  const dx = x - tile.cx;
  const dz = z - tile.cz;
  const dist = Math.sqrt(dx * dx + dz * dz);
  const fadeStart = tile.half * 0.75;
  const t = Math.max(0, Math.min(1, (dist - fadeStart) / (tile.half - fadeStart)));
  const edgeFade = 1 - t * t * (3 - 2 * t);

  if (edgeFade <= 0) return 0;

  let h = 0;
  for (const p of tile.peaks) {
    const pdx = x - p.x;
    const pdz = z - p.z;
    const pdist = Math.sqrt(pdx * pdx + pdz * pdz);
    const ph = p.h * tile.falloff ** pdist;
    if (ph > h) h = ph;
  }

  return h * edgeFade;
}

export function createMountainTileMesh(tile, height) {
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
    const c = heightColor(h, 0.5);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.85,
    metalness: 0.05,
    flatShading: true,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
