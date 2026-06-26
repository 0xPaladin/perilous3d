// Renderer: scene, lights, water, clouds, trees, buildings.
// Adapted from procedural_island styling + modern Three.js r185.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as COLORS from './08_colors.js';
import { TERRAIN } from './08_colors.js';

export function createScene(canvas, region) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x36dbd6); // sky top (matching PS subtle gradient would need shader)
  scene.fog = new THREE.FogExp2(0x36dbd6, 0.004);

  const camera = new THREE.PerspectiveCamera(70, canvas.width / canvas.height, 0.1, 500);
  camera.position.set(0, 12, 20);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(canvas.width, canvas.height);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  canvas.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI / 2.05;
  controls.minDistance = 3;
  controls.maxDistance = 60;

  // ---- Lights ----
  const ambient = new THREE.HemisphereLight(0x87ceeb, 0x556b2f, 0.7);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xfff5e6, 1.8);
  sun.position.set(30, 40, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -30;
  sun.shadow.camera.right = 30;
  sun.shadow.camera.top = 30;
  sun.shadow.camera.bottom = -30;
  scene.add(sun);

  // ---- Terrain mesh ----
  import('./07_mesher.js').then(({ buildTerrainMesh, buildTrees, buildSettlements }) => {
    const terrain = buildTerrainMesh(region);
    terrain.receiveShadow = true;
    scene.add(terrain);

    scene.add(buildTrees(region, scene));
    scene.add(buildSettlements(region, scene));
  });

  // ---- Water plane ----
  const waterGeom = new THREE.PlaneGeometry(100, 100);
  const waterMat = new THREE.MeshPhongMaterial({
    color: 0x6092c1,
    transparent: true,
    opacity: 0.82,
    shininess: 80,
    side: THREE.DoubleSide,
  });
  const water = new THREE.Mesh(waterGeom, waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = region.waterLevel * 15;
  water.receiveShadow = true;
  scene.add(water);

  // ---- Clouds (IcosahedronGeometry merged blobs, from proceduralisland) ----
  const cloudGroup = new THREE.Group();
  cloudGroup.name = 'clouds';
  const cloudMat = new THREE.MeshPhongMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.75,
    flatShading: true,
  });
  const numClouds = 12 + Math.floor(Math.random() * 8);
  for (let i = 0; i < numClouds; i++) {
    const cloud = new THREE.Group();
    const numBlobs = 2 + Math.floor(Math.random() * 4);
    for (let b = 0; b < numBlobs; b++) {
      const r = 0.3 + Math.random() * 0.8;
      const blob = new THREE.Mesh(
        new THREE.IcosahedronGeometry(r, 1),
        cloudMat
      );
      blob.position.set(
        (Math.random() - 0.5) * 1.5,
        (Math.random() - 0.5) * 0.4,
        (Math.random() - 0.5) * 1.5
      );
      cloud.add(blob);
    }
    cloud.position.set(
      (Math.random() - 0.5) * 40,
      6 + Math.random() * 4,
      (Math.random() - 0.5) * 40
    );
    cloud.scale.setScalar(1.2 + Math.random() * 2.0);
    cloudGroup.add(cloud);
  }
  scene.add(cloudGroup);

  return { scene, camera, renderer, controls, water };
}

export function animate({ scene, camera, renderer, controls }) {
  const clock = new THREE.Clock();
  let frameCount = 0;
  let lastFpsUpdate = performance.now();

  function step() {
    requestAnimationFrame(step);
    const dt = clock.getDelta();
    controls.update();

    // Optional: drift clouds slowly
    scene.traverse(obj => {
      if (obj.name === 'clouds') {
        obj.children.forEach(c => {
          c.position.x += dt * 0.15;
          if (c.position.x > 35) c.position.x = -35;
        });
      }
    });

    renderer.render(scene, camera);
    frameCount++;
    const now = performance.now();
    if (now - lastFpsUpdate > 1000) {
      const fps = Math.round(frameCount * 1000 / (now - lastFpsUpdate));
      document.getElementById('fps').textContent = fps + ' fps';
      frameCount = 0;
      lastFpsUpdate = now;
    }
  }
  step();
}

export function resetView(camera, controls, region) {
  if (!region) return;
  let maxH = 0;
  for (const f of region.faces) {
    if (f.data.level > maxH) maxH = f.data.level;
  }
  const dist = Math.max(15, maxH * 25);
  camera.position.set(0, dist * 0.5, dist);
  controls.target.set(0, 0, 0);
  controls.update();
}
