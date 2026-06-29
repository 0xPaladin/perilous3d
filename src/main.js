// main.js — bootstrap: PRNG seed → terrain generation → Three.js scene → render loop

import Chance from 'https://cdn.jsdelivr.net/npm/chance@1.1.11/+esm';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { seedFromString } from './01_prng.js';
import { buildRegion } from './05_terrain.js';
import { createScene, animate } from './10_renderer.js';
import { progressPanel, updateSeedDisplay } from './11_ui.js';

let sceneState = null;

function generate(template, seedStr, mountainCount, baseTemp) {
  const seed = seedFromString(seedStr);
  const seedNum = seed.toString(36).toUpperCase();
  updateSeedDisplay(seedNum);

  progressPanel.show(1, 4, 'create random island ...', template);
  progressPanel.show(2, 4, 'generating terrain ...', template);
  progressPanel.show(3, 4, 'planting forests ...', template);
  progressPanel.show(4, 4, 'finishing ...', template);

  if (sceneState) {
    const canvas = sceneState.renderer.domElement.parentElement;
    canvas.innerHTML = '';
  }

  const canvas = document.getElementById('container');
  canvas.innerHTML = '';

  let region;
  try {
    region = buildRegion(template, 55, 55, seed, mountainCount, baseTemp);
  } catch (e) {
    console.error('terrain generation failed:', e);
    progressPanel.hide();
  }

  if (!region) return;
  progressPanel.hide();

  // Remove old renderer if any
  const oldCanvas = canvas.querySelector('canvas');
  if (oldCanvas) oldCanvas.remove();

  sceneState = createScene(canvas, region);
  animate(sceneState);
}

// ---- UI handlers ----
function newIsland() {
  const template = document.getElementById('template-select').value;
  const mountainCount = parseInt(document.getElementById('mountains-slider').value, 10);
  const baseTemp = parseInt(document.getElementById('temp-slider').value, 10);
  const randomSeed = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
  generate(template, randomSeed, mountainCount, baseTemp);
}

function resetCamera() {
  if (!sceneState) return;
  // re-read current region by re-generating isn't ideal — just reset view
  const cam = sceneState.camera;
  const ctrl = sceneState.controls;
  cam.position.set(0, 120, 260);
  ctrl.target.set(0, 0, 0);
  ctrl.update();
}

// ---- Init ----
document.getElementById('btn-new').addEventListener('click', newIsland);
document.getElementById('btn-lost').addEventListener('click', resetCamera);
document.getElementById('btn-biome').addEventListener('click', () => {
  if (sceneState && sceneState.toggleBiomeView) sceneState.toggleBiomeView();
});
document.getElementById('mountains-slider').addEventListener('input', function() {
  document.getElementById('mountains-value').textContent = this.value;
});
document.getElementById('temp-slider').addEventListener('input', function() {
  document.getElementById('temp-value').textContent = this.value;
});

// Load URL seed or generate new
const urlParams = new URLSearchParams(window.location.search);
const urlSeed = urlParams.get('seed');
const urlTemplate = urlParams.get('template');

const initialTemplate = urlTemplate || 'island';
document.getElementById('template-select').value = initialTemplate;

const urlMountains = urlParams.get('mountains');
const initialMountains = urlMountains ? parseInt(urlMountains, 10) : 200;
document.getElementById('mountains-slider').value = initialMountains;
document.getElementById('mountains-value').textContent = initialMountains;

const urlTemp = urlParams.get('temp');
const initialTemp = urlTemp ? parseInt(urlTemp, 10) : Math.floor(Math.random() * 30 + 5);
document.getElementById('temp-slider').value = initialTemp;
document.getElementById('temp-value').textContent = initialTemp;

const initialSeed = urlSeed || (Math.random().toString(36).substring(2, 10) + Date.now().toString(36));
generate(initialTemplate, initialSeed, initialMountains, initialTemp);

// Update URL without reloading
const updateURL = (template, seed, mountainCount, baseTemp) => {
  const url = new URL(window.location);
  url.searchParams.set('template', template);
  url.searchParams.set('seed', seed);
  url.searchParams.set('mountains', mountainCount);
  url.searchParams.set('temp', baseTemp);
  history.replaceState({}, '', url);
};

// Hook into newIsland to update URL
const origNewIsland = newIsland;
window.addEventListener('load', () => {
  const btn = document.getElementById('btn-new');
  btn.removeEventListener('click', newIsland);
  btn.addEventListener('click', () => {
    origNewIsland();
    const seed = seedFromString(document.getElementById('seed-display').textContent.replace('seed: ', ''));
    const mc = document.getElementById('mountains-slider').value;
    const bt = document.getElementById('temp-slider').value;
    updateURL(document.getElementById('template-select').value, seed.toString(36), mc, bt);
  });
});
