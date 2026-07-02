// Renderer: scene, lights, water, clouds, trees, buildings.
// Adapted from procedural_island styling + modern Three.js r185.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';


export function createScene(canvas, display, state) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x36dbd6); // sky top (matching PS subtle gradient would need shader)

  const extentSize = display.extent?.width || 320;
  const s = extentSize / 320;

  const camera = new THREE.PerspectiveCamera(60, canvas.clientWidth / canvas.clientHeight, 0.1, 2000 * s);
  camera.position.set(0, 120 * s, 260 * s);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.localClippingEnabled = true;
  canvas.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI / 2.05;
  controls.minDistance = 10;
  controls.maxDistance = 800 * s;

  // ---- Lights ----
  const ambient = new THREE.HemisphereLight(0x87ceeb, 0x556b2f, 0.7);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xfff5e6, 1.8);
  sun.position.set(200 * s, 300 * s, 150 * s);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -200 * s;
  sun.shadow.camera.right = 200 * s;
  sun.shadow.camera.top = 200 * s;
  sun.shadow.camera.bottom = -200 * s;
  scene.add(sun);

  // ---- Terrain mesh ----
  const sceneState = { scene, camera, renderer, controls, extentScale: s, display, state };

    import('./mesh/mesher.js').then(({ buildTerrainMesh, buildRiverMesh, buildTrees, buildSettlements, buildResources, buildTrouble, buildSiteFeatures }) => {
    const terrainMesh = buildTerrainMesh(display);
    terrainMesh.receiveShadow = true;
    scene.add(terrainMesh);

    const riverMesh = buildRiverMesh(display);
    if (riverMesh) scene.add(riverMesh);

    scene.add(buildTrees(display, state));
    scene.add(buildSettlements(display, state));
    scene.add(buildResources(display, state));
    scene.add(buildTrouble(display, state));
    scene.add(buildSiteFeatures(display, state));

    sceneState.terrain = terrainMesh;
  });

  // ---- Mesh feature objects (mountains, forests from meshDev) ----


   import('./mesh/mesh_features.js').then(({ buildMeshMountains, buildMeshForests }) => {
/*
    const mountainGroup = buildMeshMountains(display, state);
mountainGroup.name = 'meshMountains';
scene.add(mountainGroup);
*/

const forestGroup = buildMeshForests(display, state);
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
      (Math.random() - 0.5) * 500 * s,
      80 + Math.random() * 40,
      (Math.random() - 0.5) * 500 * s
    );
    cloud.scale.setScalar((10 + Math.random() * 20) * s);
    cloudGroup.add(cloud);
  }
  scene.add(cloudGroup);

  const BIOME_NAMES = [
    'Marine', 'Hot desert', 'Cold desert', 'Savanna', 'Grassland',
    'Tropical seasonal forest', 'Temperate deciduous forest', 'Tropical rainforest',
    'Temperate rainforest', 'Taiga', 'Tundra', 'Glacier', 'Wetland'
  ];
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let pointerDownPos = new THREE.Vector2();

  renderer.domElement.addEventListener('pointerdown', (e) => {
    pointerDownPos.set(e.clientX, e.clientY);
  });

  renderer.domElement.addEventListener('pointerup', (e) => {
    if (pointerDownPos.distanceTo(new THREE.Vector2(e.clientX, e.clientY)) > 3) return;
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const terrain = sceneState.terrain;
    if (!terrain) return;
    const intersects = raycaster.intersectObject(terrain, false);
    const tooltip = document.getElementById('cell-info-tooltip');
    if (intersects.length === 0) {
      if (tooltip) tooltip.style.display = 'none';
      return;
    }
    const hit = intersects[0];
    const idx = hit.face.a;
    const height = display.heights[idx];
    const moisture = display.moisture[idx];
    const biome = display.biome[idx];
    const biomeName = BIOME_NAMES[biome] || 'Unknown';
    if (tooltip) {
      tooltip.textContent = `idx: ${idx} | height: ${height.toFixed(4)} | moisture: ${moisture.toFixed(1)} | biome: ${biome} (${biomeName})`;
      tooltip.style.display = 'block';
      tooltip.style.left = (e.clientX + 14) + 'px';
      tooltip.style.top = (e.clientY - 24) + 'px';
    }
  });

  window.addEventListener('resize', () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });

  return sceneState;
}

export function animate({ scene, camera, renderer, controls, extentScale }) {
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
          const scale = extentScale || 1;
          if (c.position.x > 350 * scale) c.position.x = -350 * scale;
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



