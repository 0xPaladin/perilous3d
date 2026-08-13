// main.js — bootstrap: PRNG seed → terrain generation → Three.js scene → render loop

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { seedFromString } from './core/prng.js';
import { buildRegion } from './terrain/terrain.js';
import { createScene, animate } from './renderer.js';
import { progressPanel, updateSeedDisplay } from './gui/ui.js';
import { initGUI } from './gui/gui.js';
import { initItemsPanel } from './gui/items.js';
import { showAsciiMap, hideAsciiMap } from './gui/ascii.js';


progressPanel.init();

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


function generate(template, seedStr, terrain, climate, safety, size, numPoints = 0, featuresEnabled = true, displayMode = '3d', tileSize = 10) {
  app.seedStr = seedStr;
  const seed = seedFromString(seedStr);
  const seedNum = seed.toString(36).toUpperCase();
  app.seed = seedNum;
  updateSeedDisplay(seedNum);

  progressPanel.show(1, 4, 'create random terrain ...', template);
  progressPanel.show(2, 4, 'generating terrain ...', template);
  progressPanel.show(3, 4, 'planting forests ...', template);
  progressPanel.show(4, 4, 'finishing ...', template);

  const canvas = document.getElementById('container');
  canvas.innerHTML = '';

  const cityCount = safety || 0;
  const baseTemp = climateToTemp(climate);

  let result;
  try {
    result = buildRegion(template, seed, terrain, baseTemp, cityCount, size, numPoints, featuresEnabled);
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

  if (displayMode === 'ascii') {
    hideAsciiMap();
    if (app.sceneState) {
      if (app.sceneState.stopAnimate) app.sceneState.stopAnimate();
      app.sceneState.renderer?.domElement?.remove();
      app.sceneState = null;
    }
    showAsciiMap(display, state, tileSize);
    initItemsPanel(app);
  } else {
    hideAsciiMap();
    if (app.sceneState) {
      if (app.sceneState.stopAnimate) app.sceneState.stopAnimate();
      app.sceneState.renderer?.domElement?.remove();
    }
    app.sceneState = createScene(canvas, display, state);
    const stopAnimate = animate(app.sceneState);
    app.sceneState.stopAnimate = stopAnimate;
    initItemsPanel(app);
  }

  const url = new URL(window.location);
  url.searchParams.set('template', template);
  url.searchParams.set('seed', seedNum);
  url.searchParams.set('terrain', terrain);
  url.searchParams.set('climate', climate);
  url.searchParams.set('safety', safety);
  url.searchParams.set('size', size);
  url.searchParams.set('display', displayMode);
  url.searchParams.set('tileSize', tileSize);
  if (numPoints > 0) url.searchParams.set('points', numPoints);
  else url.searchParams.delete('points');
  if (featuresEnabled) url.searchParams.set('features', '1');
  else url.searchParams.delete('features');
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
let initialClimate = urlParams.get('climate') || 'Temperate';
const initialSafety = urlParams.get('safety') ? parseInt(urlParams.get('safety'), 10) : 0;
const initialSize = urlParams.get('size') ? parseInt(urlParams.get('size'), 10) : 320;
const initialNumPoints = urlParams.get('points') ? parseInt(urlParams.get('points'), 10) : 0;
const initialFeaturesEnabled = urlParams.get('features') !== '0';
const initialDisplayMode = urlParams.get('display') || '3d';
const initialTileSize = urlParams.get('tileSize') ? parseInt(urlParams.get('tileSize'), 10) : 10;
const initialSeed = urlParams.get('seed') || (Math.random().toString(36).substring(2, 10) + Date.now().toString(36));

// Init GUI
const { gui, options } = initGUI({
  app,
  generate,
  initialTemplate,
  initialTerrain,
  initialClimate,
  initialSafety,
  initialSize,
  initialNumPoints,
  initialFeaturesEnabled,
  initialDisplayMode,
  initialTileSize,
});

generate(initialTemplate, initialSeed, initialTerrain, initialClimate, initialSafety, initialSize, initialNumPoints, initialFeaturesEnabled, initialDisplayMode, initialTileSize);
