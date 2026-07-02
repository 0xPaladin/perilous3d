// main.js — bootstrap: PRNG seed → terrain generation → Three.js scene → render loop

import Chance from 'https://cdn.jsdelivr.net/npm/chance@1.1.11/+esm';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { seedFromString } from './prng.js';
import { buildRegion } from './terrain/terrain.js';
import { createScene, animate } from './renderer.js';
import { progressPanel, updateSeedDisplay } from './gui/ui.js';
import { initGUI } from './gui/gui.js';
import { initItemsPanel } from './gui/items.js';
import { TEMPLATE_WATER_LEVELS } from './terrain/config.js';

const app = { sceneState: null, seed: null, seedStr: null };

const CLIMATE_TEMP = {
  'Arctic': -10,
  'Sub-arctic': 5,
  'Temperate': 22,
  'Sub-tropical': 28,
  'Tropical': 32,
};

function climateToTemp(climate) {
  return CLIMATE_TEMP[climate] ?? 22;
}

function tempToClimate(temp) {
  if (temp <= -5) return 'Arctic';
  if (temp <= 15) return 'Sub-arctic';
  if (temp <= 25) return 'Temperate';
  if (temp <= 30) return 'Sub-tropical';
  return 'Tropical';
}

let waterLevelController = null;

function generate(template, seedStr, terrain, climate, safety, size, waterLevel = 0.5) {
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
  const baseTemp = climateToTemp(climate);

  let result;
  try {
    result = buildRegion(template, 55, 55, seed, terrain, baseTemp, cityCount, size, waterLevel);
  } catch (e) {
    console.error('terrain generation failed:', e);
    progressPanel.hide();
    return;
  }

  progressPanel.hide();

  const oldCanvas = canvas.querySelector('canvas');
  if (oldCanvas) oldCanvas.remove();

  const { display, state } = result;
  logRegionStats(display, state);

  app.display = display;
  app.state = state;
  app.sceneState = createScene(canvas, display, state);
  animate(app.sceneState);
  initItemsPanel(app);

  const url = new URL(window.location);
  url.searchParams.set('template', template);
  url.searchParams.set('seed', seedNum);
  url.searchParams.set('terrain', terrain);
  url.searchParams.set('temp', baseTemp);
  url.searchParams.set('climate', climate);
  url.searchParams.set('safety', safety);
  url.searchParams.set('size', size);
  url.searchParams.set('waterLevel', waterLevel);
  history.replaceState({}, '', url);

  logRegionStats(display, state, url.searchParams.toString());
}

const BIOME_NAMES = [
  'Marine', 'Hot desert', 'Cold desert', 'Savanna', 'Grassland',
  'Tropical seasonal forest', 'Temperate deciduous forest', 'Tropical rainforest',
  'Temperate rainforest', 'Taiga', 'Tundra', 'Glacier', 'Wetland'
];

function logRegionStats(display, state, params) {
  const biomeCounts = new Array(13).fill(0);
  if (display.biome) {
    for (let i = 0; i < display.biome.length; i++) {
      const b = display.biome[i];
      if (b >= 0 && b < 13) biomeCounts[b]++;
    }
  }
  console.log('=== Region Stats ===');
  console.log('Parameters: ', params);
  console.log('Biomes:', biomeCounts.map((c, i) => `${BIOME_NAMES[i]}: ${c}`).join(' | '));
  console.log('Mountains:', (display.mounts || []).map((m, i) => ({ idx: i, x: m.x, y: m.y, h: m.peakHeight })));
  console.log('Cities:', state.cities || []);
  console.log('Towns:', state.towns || []);
  console.log('Resources:', state.resources || []);
  console.log('Ruins:', state.ruins || []);
  console.log('Minor Ruins:', state.minorRuins || []);
  console.log('Trouble:', state.trouble || []);
  console.log('Outposts:', state.outpostSites || []);
  console.log('Landmarks:', state.landmarkSites || []);
  console.log('Factions:', state.factionSites || []);
  console.log('Hazards:', state.hazards || []);
  console.log('Obstacles:', state.obstacles || []);
  console.log('Areas:', state.areas || []);
  if (state.features && state.features.length) {
    console.log(`Features (${state.features.length}):`);
    state.features.forEach((f, i) => {
      const parts = [`${i + 1}. ${f.type}`];
      if (f.subtype) parts.push(`subtype=${JSON.stringify(f.subtype)}`);
      if (f.hazard) parts.push(`hazard=${JSON.stringify(f.hazard)}`);
      if (f.obstacle) parts.push(`obstacle=${JSON.stringify(f.obstacle)}`);
      if (f.area) parts.push(`area=${JSON.stringify(f.area)}`);
      if (f.name) parts.push(`name="${f.name}"`);
      if (f.site) parts.push(`site=${JSON.stringify(f.site)}`);
      if (f.faction) parts.push(`faction=${JSON.stringify(f.faction)}`);
      console.log('  ' + parts.join(' | '));
    });
  }
}

// Load URL seed or generate new
const urlParams = new URLSearchParams(window.location.search);
const initialTemplate = urlParams.get('template') || 'island';
const initialTerrain = urlParams.get('terrain') || 'highland';
let initialClimate = urlParams.get('climate');
if (!initialClimate) {
  const t = urlParams.get('temp') ? parseInt(urlParams.get('temp'), 10) : climateToTemp('Temperate');
  initialClimate = tempToClimate(t);
}
const initialSafety = urlParams.get('safety') ? parseInt(urlParams.get('safety'), 10) : 0;
const initialSize = urlParams.get('size') ? parseInt(urlParams.get('size'), 10) : 320;
const urlWaterLevel = urlParams.get('waterLevel') != null ? parseFloat(urlParams.get('waterLevel')) : null;
const templateDefaultWl = TEMPLATE_WATER_LEVELS[initialTemplate] || null;
const effectiveInitialWaterLevel = urlWaterLevel != null ? urlWaterLevel : (templateDefaultWl != null ? templateDefaultWl : 0.5);
const initialSeed = urlParams.get('seed') || (Math.random().toString(36).substring(2, 10) + Date.now().toString(36));

// Init GUI
const { gui, options, waterLevelController: wlc } = initGUI({
  app,
  generate,
  initialTemplate,
  initialTerrain,
  initialClimate,
  initialSafety,
  initialSize,
  initialWaterLevel: effectiveInitialWaterLevel,
});
waterLevelController = wlc;

generate(initialTemplate, initialSeed, initialTerrain, initialClimate, initialSafety, initialSize, effectiveInitialWaterLevel);
