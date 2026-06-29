// main.js — bootstrap: PRNG seed → terrain generation → Three.js scene → render loop

import Chance from 'https://cdn.jsdelivr.net/npm/chance@1.1.11/+esm';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { seedFromString } from './01_prng.js';
import { buildRegion } from './05_terrain.js';
import { createScene, animate } from './10_renderer.js';
import { progressPanel, updateSeedDisplay } from './11_ui.js';
import { initGUI } from './17_gui.js';

const app = { sceneState: null, seed: null };

function generate(template, seedStr, mountainCount, baseTemp) {
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

  let region;
  try {
    region = buildRegion(template, 55, 55, seed, mountainCount, baseTemp);
  } catch (e) {
    console.error('terrain generation failed:', e);
    progressPanel.hide();
    return;
  }

  progressPanel.hide();

  const oldCanvas = canvas.querySelector('canvas');
  if (oldCanvas) oldCanvas.remove();

  app.sceneState = createScene(canvas, region);
  animate(app.sceneState);

  const url = new URL(window.location);
  url.searchParams.set('template', template);
  url.searchParams.set('seed', seedNum);
  url.searchParams.set('mountains', mountainCount);
  url.searchParams.set('temp', baseTemp);
  history.replaceState({}, '', url);
}

// Load URL seed or generate new
const urlParams = new URLSearchParams(window.location.search);
const initialTemplate = urlParams.get('template') || 'island';
const initialMountains = urlParams.get('mountains') ? parseInt(urlParams.get('mountains'), 10) : 200;
const initialTemp = urlParams.get('temp') ? parseInt(urlParams.get('temp'), 10) : Math.floor(Math.random() * 30 + 5);
const initialSeed = urlParams.get('seed') || (Math.random().toString(36).substring(2, 10) + Date.now().toString(36));

// Init GUI
initGUI({
  app,
  generate,
  initialTemplate,
  initialMountains,
  initialTemp,
});

generate(initialTemplate, initialSeed, initialMountains, initialTemp);
