// main.js — bootstrap: PRNG seed → terrain generation → Three.js scene → render loop

import Chance from 'https://cdn.jsdelivr.net/npm/chance@1.1.11/+esm';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { seedFromString } from './01_prng.js';
import { buildRegion } from './05_terrain.js';
import { createScene, animate } from './10_renderer.js';
import { progressPanel, updateSeedDisplay } from './11_ui.js';
import { initGUI } from './17_gui.js';

const app = { sceneState: null, seed: null, seedStr: null };

function generate(template, seedStr, mountainCount, baseTemp, safety) {
  app.seedStr = seedStr;
  const seed = seedFromString(seedStr);
  const seedNum = seed.toString(36).toUpperCase();
  app.seed = seedNum;
  updateSeedDisplay(seedNum);

  progressPanel.show(1, 4, 'create random island ...', template);
  progressPanel.show(2, 4, 'generating terrain ...', template);
  progressPanel.show(3, 4, 'planting forests ...', template);
  progressPanel.show(4, 4, 'finishing ...', template);

  const canvas = document.getElementById('container');
  canvas.innerHTML = '';

  const cityCount = safety || 0;

  let region;
  try {
    region = buildRegion(template, 55, 55, seed, mountainCount, baseTemp, cityCount);
  } catch (e) {
    console.error('terrain generation failed:', e);
    progressPanel.hide();
    return;
  }

  progressPanel.hide();

  const oldCanvas = canvas.querySelector('canvas');
  if (oldCanvas) oldCanvas.remove();

  logRegionStats(region);

  app.sceneState = createScene(canvas, region);
  animate(app.sceneState);

  const url = new URL(window.location);
  url.searchParams.set('template', template);
  url.searchParams.set('seed', seedNum);
  url.searchParams.set('mountains', mountainCount);
  url.searchParams.set('temp', baseTemp);
  url.searchParams.set('safety', safety);
  history.replaceState({}, '', url);
}

const BIOME_NAMES = [
  'Marine', 'Hot desert', 'Cold desert', 'Savanna', 'Grassland',
  'Tropical seasonal forest', 'Temperate deciduous forest', 'Tropical rainforest',
  'Temperate rainforest', 'Taiga', 'Tundra', 'Glacier', 'Wetland'
];

function logRegionStats(region) {
  const biomeCounts = new Array(13).fill(0);
  if (region.biome) {
    for (let i = 0; i < region.biome.length; i++) {
      const b = region.biome[i];
      if (b >= 0 && b < 13) biomeCounts[b]++;
    }
  }
  console.log('=== Region Stats ===');
  console.log('Biomes:', biomeCounts.map((c, i) => `${BIOME_NAMES[i]}: ${c}`).join(' | '));
  console.log('Cities:', region.cities || []);
  console.log('Towns:', region.towns || []);
  console.log('Resources:', region.resources || []);
}

// Load URL seed or generate new
const urlParams = new URLSearchParams(window.location.search);
const initialTemplate = urlParams.get('template') || 'island';
const initialMountains = urlParams.get('mountains') ? parseInt(urlParams.get('mountains'), 10) : 200;
const initialTemp = urlParams.get('temp') ? parseInt(urlParams.get('temp'), 10) : Math.floor(Math.random() * 30 + 5);
const initialSafety = urlParams.get('safety') ? parseInt(urlParams.get('safety'), 10) : 0;
const initialSeed = urlParams.get('seed') || (Math.random().toString(36).substring(2, 10) + Date.now().toString(36));

// Init GUI
initGUI({
  app,
  generate,
  initialTemplate,
  initialMountains,
  initialTemp,
  initialSafety,
});

generate(initialTemplate, initialSeed, initialMountains, initialTemp, initialSafety);
