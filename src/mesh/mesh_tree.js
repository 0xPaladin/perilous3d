import * as THREE from "three";

const TRUNK_COLORS = [
  0x5D4037, 0x4E342E, 0x3E2723, 0x6D4C41, 0x795548,
  0x8D6E63, 0xA1887F, 0x61443A, 0x4A3728, 0x734B36,
];

const LEAF_SAVANNA =      [0x8BC34A, 0x9CCC65, 0xAED581, 0x7CB342, 0x689F38];
const LEAF_GRASSLAND =    [0x689F38, 0x7CB342, 0x8BC34A, 0x9CCC65, 0x558B2F];
const LEAF_TROP_SEASONAL =[0x388E3C, 0x43A047, 0x4CAF50, 0x2E7D32, 0x66BB6A];
const LEAF_TEMP_DECIDUOUS=[0x4CAF50, 0x66BB6A, 0x8BC34A, 0xFFA726, 0xEF6C00];
const LEAF_RAINFOREST =   [0x1B5E20, 0x2E7D32, 0x004D40, 0x00695C, 0x194D33];
const LEAF_TAIGA =        [0x2E7D32, 0x33691E, 0x1B5E20, 0x004D40, 0x3E2723];
const LEAF_WETLAND =      [0x558B2F, 0x689F38, 0x7CB342, 0x4CAF50, 0x33691E];

const BIOME_TREE = [
  null,                                    // 0 Marine
  null,                                    // 1 Hot desert
  null,                                    // 2 Cold desert
  { leaf: LEAF_SAVANNA,       hMin:0.8, hMax:1.5, cR:1.4, cY:0.4, tFrac:0.25 }, // 3 Savanna
  { leaf: LEAF_GRASSLAND,     hMin:0.5, hMax:1.2, cR:1.0, cY:0.5, tFrac:0.30 }, // 4 Grassland
  { leaf: LEAF_TROP_SEASONAL, hMin:1.5, hMax:3.0, cR:1.0, cY:1.0, tFrac:0.35 }, // 5 Trop seasonal
  { leaf: LEAF_TEMP_DECIDUOUS, hMin:1.5, hMax:3.0, cR:1.1, cY:1.0, tFrac:0.30 }, // 6 Temp deciduous
  { leaf: LEAF_RAINFOREST,    hMin:2.0, hMax:4.0, cR:1.2, cY:1.0, tFrac:0.30 }, // 7 Trop rainforest
  { leaf: LEAF_RAINFOREST,    hMin:1.8, hMax:3.5, cR:1.1, cY:1.0, tFrac:0.30 }, // 8 Temp rainforest
  { leaf: LEAF_TAIGA,         hMin:1.2, hMax:2.5, cR:0.6, cY:1.8, tFrac:0.45 }, // 9 Taiga
  null,                                    // 10 Tundra
  null,                                    // 11 Glacier
  { leaf: LEAF_WETLAND,       hMin:1.0, hMax:2.0, cR:1.0, cY:0.7, tFrac:0.35 }, // 12 Wetland
];

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function brown(rng) {
  return new THREE.Color(pick(rng, TRUNK_COLORS));
}

function forestLeaf(rng, palette) {
  return new THREE.Color(pick(rng, palette));
}

export function generateTree(prng, x, y, z, height, options = {}) {
  const type = options.type ?? Math.floor(prng() * 5);
  const trunkH = height * (0.25 + prng() * 0.2);
  const trunkR = height * (0.035 + prng() * 0.015);
  const canopyR = height * (0.3 + prng() * 0.2);

  const group = new THREE.Group();
  group.position.set(x, y, z);

  const trunkMat = new THREE.MeshStandardMaterial({
    color: brown(prng), roughness: 0.9, flatShading: true,
  });
  const leafMat = new THREE.MeshStandardMaterial({
    color: green(prng), roughness: 0.8, flatShading: true,
  });

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(trunkR * 0.2, trunkR, trunkH, 5, 1),
    trunkMat,
  );
  trunk.position.y = trunkH / 2;
  trunk.castShadow = true;
  group.add(trunk);

  const canopyY = trunkH + canopyR * (0.2 + prng() * 0.2);

  switch (type) {
    case 0: {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(canopyR * 0.6, canopyR * 1.5, 6),
        leafMat,
      );
      cone.position.y = canopyY + canopyR * 0.5;
      cone.castShadow = true;
      group.add(cone);
      break;
    }
    case 1: {
      const sphere = new THREE.Mesh(
        new THREE.IcosahedronGeometry(canopyR, 2),
        leafMat,
      );
      sphere.position.y = canopyY;
      sphere.castShadow = true;
      group.add(sphere);
      break;
    }
    case 2: {
      const ball = new THREE.Mesh(
        new THREE.IcosahedronGeometry(canopyR * 1.3, 2),
        leafMat,
      );
      ball.scale.y = 0.55;
      ball.position.y = canopyY;
      ball.castShadow = true;
      group.add(ball);
      break;
    }
    case 3: {
      const col = new THREE.Mesh(
        new THREE.ConeGeometry(canopyR * 0.3, canopyR * 2.5, 5),
        leafMat,
      );
      col.position.y = canopyY + canopyR * 0.7;
      col.castShadow = true;
      group.add(col);
      break;
    }
    case 4: {
      const n = 3 + Math.floor(prng() * 3);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + prng() * 0.3;
        const r = canopyR * 0.45;
        const ox = Math.cos(a) * r;
        const oz = Math.sin(a) * r;
        const sr = canopyR * 0.3 + prng() * 0.15;
        const lump = new THREE.Mesh(
          new THREE.IcosahedronGeometry(sr, 1),
          leafMat,
        );
        lump.position.set(ox, canopyY - sr * 0.3 + prng() * 0.2, oz);
        lump.castShadow = true;
        group.add(lump);
      }
      break;
    }
  }

  return group;
}

export function generateForest(prng, cx, cz, count, radius, height, options = {}) {
  if (count === 0) return new THREE.Group();

  const biome = options.biome != null ? Math.min(options.biome, BIOME_TREE.length - 1) : 7;
  const cfg = BIOME_TREE[biome] || BIOME_TREE[7];
  const leafPalette = cfg.leaf || LEAF_RAINFOREST;

  const treeHeight = cfg.hMin + prng() * (cfg.hMax - cfg.hMin);
  const h = treeHeight || height;

  const trunkFrac = cfg.tFrac;
  const canopyRMult = cfg.cR;
  const canopyYMult = cfg.cY;

  const trunkGeo = new THREE.CylinderGeometry(1, 1, 1, 5, 1);
  const canopyGeo = new THREE.IcosahedronGeometry(1, 2);
  const dummy = new THREE.Object3D();
  const tc = new THREE.Color();
  const lc = new THREE.Color();

  const trunkMesh = new THREE.InstancedMesh(trunkGeo, null, count);
  const canopyMesh = new THREE.InstancedMesh(canopyGeo, null, count);

  for (let i = 0; i < count; i++) {
    const a = prng() * Math.PI * 2;
    const r = Math.sqrt(prng()) * radius;
    const x = cx + Math.cos(a) * r;
    const z = cz + Math.sin(a) * r;

    const trunkH = h * trunkFrac + prng() * (h * 0.15);
    const trunkR = h * 0.035 + prng() * (h * 0.015);
    const canopyR = h * 0.3 * canopyRMult + prng() * (h * 0.15);
    const canopyY = trunkH + canopyR * 0.25 * canopyYMult;

    dummy.position.set(x, trunkH / 2, z);
    dummy.scale.set(trunkR * 0.2, trunkH, trunkR);
    dummy.updateMatrix();
    trunkMesh.setMatrixAt(i, dummy.matrix);

    dummy.position.set(x, canopyY, z);
    dummy.scale.set(canopyR, canopyR * canopyYMult, canopyR);
    dummy.updateMatrix();
    canopyMesh.setMatrixAt(i, dummy.matrix);

    tc.copy(brown(prng));
    trunkMesh.setColorAt(i, tc);
    lc.copy(forestLeaf(prng, leafPalette));
    canopyMesh.setColorAt(i, lc);
  }

  trunkMesh.instanceMatrix.needsUpdate = true;
  trunkMesh.instanceColor.needsUpdate = true;
  canopyMesh.instanceMatrix.needsUpdate = true;
  canopyMesh.instanceColor.needsUpdate = true;

  trunkMesh.material = new THREE.MeshStandardMaterial({
    roughness: 0.9, flatShading: true,
  });
  canopyMesh.material = new THREE.MeshStandardMaterial({
    roughness: 0.8, flatShading: true,
  });

  trunkMesh.castShadow = true;
  canopyMesh.castShadow = true;

  const group = new THREE.Group();
  group.add(trunkMesh);
  group.add(canopyMesh);
  return group;
}
