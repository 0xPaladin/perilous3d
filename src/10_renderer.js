// Renderer: scene, lights, water, clouds, trees, buildings.
// Adapted from procedural_island styling + modern Three.js r185.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';


export function createScene(canvas, region) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x36dbd6); // sky top (matching PS subtle gradient would need shader)

  const camera = new THREE.PerspectiveCamera(60, canvas.clientWidth / canvas.clientHeight, 0.1, 2000);
  camera.position.set(0, 120, 260);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  canvas.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI / 2.05;
  controls.minDistance = 10;
  controls.maxDistance = 800;

  // ---- Lights ----
  const ambient = new THREE.HemisphereLight(0x87ceeb, 0x556b2f, 0.7);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xfff5e6, 1.8);
  sun.position.set(200, 300, 150);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -200;
  sun.shadow.camera.right = 200;
  sun.shadow.camera.top = 200;
  sun.shadow.camera.bottom = -200;
  scene.add(sun);

  // ---- Terrain mesh + biome view ----
  const state = { scene, camera, renderer, controls };
  let terrainMesh = null;
  let biomeViewGroup = null;

  import('./07_mesher.js').then(({ buildTerrainMesh, buildRiverMesh, buildBiomeViewMesh, buildTrees, buildSettlements, buildResources, buildTrouble }) => {
    terrainMesh = buildTerrainMesh(region);
    terrainMesh.receiveShadow = true;
    scene.add(terrainMesh);

    const riverMesh = buildRiverMesh(region);
    if (riverMesh) scene.add(riverMesh);

    scene.add(buildTrees(region, scene));
    scene.add(buildSettlements(region));
    scene.add(buildResources(region));
    scene.add(buildTrouble(region));

    biomeViewGroup = buildBiomeViewMesh(region);
    biomeViewGroup.visible = false;
    scene.add(biomeViewGroup);

    state.terrain = terrainMesh;
    state.biomeView = biomeViewGroup;
  });

  state.toggleBiomeView = function() {
    if (!state.terrain || !state.biomeView) return;
    const show = !state.biomeView.visible;
    state.biomeView.visible = show;
    state.terrain.visible = !show;
  };

  // ---- Mesh feature objects (mountains, forests from meshDev) ----
  import('./16_mesh_features.js').then(({ buildMeshMountains, buildMeshForests }) => {
const mountainGroup = buildMeshMountains(region);
mountainGroup.name = 'meshMountains';
scene.add(mountainGroup);

const forestGroup = buildMeshForests(region);
forestGroup.name = 'meshForests';
scene.add(forestGroup);
});

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
      (Math.random() - 0.5) * 500,
      80 + Math.random() * 40,
      (Math.random() - 0.5) * 500
    );
    cloud.scale.setScalar(10 + Math.random() * 20);
    cloudGroup.add(cloud);
  }
  scene.add(cloudGroup);

  window.addEventListener('resize', () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });

  return state;
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
          c.position.x += dt * 2;
          if (c.position.x > 350) c.position.x = -350;
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



