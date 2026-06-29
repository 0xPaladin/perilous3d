import * as THREE from "three";

const TRUNK_COLORS = [
  0x5D4037, 0x4E342E, 0x3E2723, 0x6D4C41, 0x795548,
  0x8D6E63, 0xA1887F, 0x61443A, 0x4A3728, 0x734B36,
];

const LEAF_COLORS = [
  0x2E7D32, 0x388E3C, 0x43A047, 0x558B2F, 0x33691E,
  0x8BC34A, 0x689F38, 0x1B5E20, 0x4CAF50, 0x7CB342,
];

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function brown(rng) {
  return new THREE.Color(pick(rng, TRUNK_COLORS));
}

function green(rng) {
  return new THREE.Color(pick(rng, LEAF_COLORS));
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

  const minR = height * 0.035;
  const maxR = height * 0.05;
  const baseH = height * 0.25;
  const baseCR = height * 0.3;

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

    const trunkH = baseH + prng() * (height * 0.2);
    const trunkR = minR + prng() * (maxR - minR);
    const canopyR = baseCR + prng() * (height * 0.2);
    const canopyY = trunkH + canopyR * 0.3;

    dummy.position.set(x, trunkH / 2, z);
    dummy.scale.set(trunkR * 0.2, trunkH, trunkR);
    dummy.updateMatrix();
    trunkMesh.setMatrixAt(i, dummy.matrix);

    dummy.position.set(x, canopyY, z);
    dummy.scale.set(canopyR, canopyR, canopyR);
    dummy.updateMatrix();
    canopyMesh.setMatrixAt(i, dummy.matrix);

    tc.copy(brown(prng));
    trunkMesh.setColorAt(i, tc);
    lc.copy(green(prng));
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
