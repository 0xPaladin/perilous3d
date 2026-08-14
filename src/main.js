// main.js — bootstrap: PRNG seed → terrain/site generation → Three.js scene or ASCII map → render loop

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { seedFromString } from './core/prng.js';
import { buildRegion } from './terrain/terrain.js';
import { generateSite } from './sites/index.js';
import { generateArea } from './areas/index.js';
import { createScene, animate } from './renderer.js';
import { progressPanel, updateSeedDisplay } from './gui/ui.js';
import { initGUI } from './gui/gui.js';
import { initItemsPanel } from './gui/items.js';
import { showAsciiMap, showAsciiSite, showAsciiArea, hideAsciiMap } from './gui/ascii.js';


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

function generateSiteWrapper(opts) {
  app.seedStr = opts.seed;
  const seed = seedFromString(opts.seed);
  const seedNum = seed.toString(36).toUpperCase();
  app.seed = seedNum;
  updateSeedDisplay(seedNum);

  progressPanel.show(1, 2, 'generating site ...', opts.template);
  progressPanel.show(2, 2, 'finishing ...', opts.template);

  const canvas = document.getElementById('container');
  canvas.innerHTML = '';

  let result;
  try {
    result = generateSite(opts);
  } catch (e) {
    console.error('site generation failed:', e);
    progressPanel.hide();
    return;
  }

  progressPanel.hide();

  const oldCanvas = canvas.querySelector('canvas');
  if (oldCanvas) oldCanvas.remove();

  const { display, state } = result;
  logSiteStats(display, state);

  app.display = display;
  app.state = state;

  // Site is ASCII-only — always show ASCII map
  hideAsciiMap();
  if (app.sceneState) {
    if (app.sceneState.stopAnimate) app.sceneState.stopAnimate();
    app.sceneState.renderer?.domElement?.remove();
    app.sceneState = null;
  }
  showAsciiSite(display, state, 1);
  initItemsPanel(app);

  // URL sync
  const url = new URL(window.location);
  url.searchParams.set('scope', 'site');
  url.searchParams.set('seed', seedNum);
  url.searchParams.set('site-template', opts.template);
  url.searchParams.set('site-w', opts.w);
  url.searchParams.set('site-h', opts.h);
  url.searchParams.set('site-floors', opts.floors);
  history.replaceState({}, '', url);
}

function generateAreaWrapper(opts) {
  app.seedStr = opts.seed;
  const seed = seedFromString(opts.seed);
  const seedNum = seed.toString(36).toUpperCase();
  app.seed = seedNum;
  updateSeedDisplay(seedNum);

  progressPanel.show(1, 2, 'generating area ...', opts.template);
  progressPanel.show(2, 2, 'finishing ...', opts.template);

  const canvas = document.getElementById('container');
  canvas.innerHTML = '';

  let result;
  try {
    result = generateArea(opts);
  } catch (e) {
    console.error('area generation failed:', e);
    progressPanel.hide();
    return;
  }

  progressPanel.hide();

  const oldCanvas = canvas.querySelector('canvas');
  if (oldCanvas) oldCanvas.remove();

  const { display, state } = result;
  logAreaStats(display, state);

  app.display = display;
  app.state = state;

  // Area is ASCII-only — always show ASCII map
  hideAsciiMap();
  if (app.sceneState) {
    if (app.sceneState.stopAnimate) app.sceneState.stopAnimate();
    app.sceneState.renderer?.domElement?.remove();
    app.sceneState = null;
  }
  showAsciiArea(display, state, 1);
  initItemsPanel(app);

  // URL sync
  const url = new URL(window.location);
  url.searchParams.set('scope', 'area');
  url.searchParams.set('seed', seedNum);
  url.searchParams.set('area-template', opts.template);
  url.searchParams.set('area-w', opts.w);
  url.searchParams.set('area-h', opts.h);
  if (opts.addRiver) url.searchParams.set('area-river', '1');
  else url.searchParams.delete('area-river');
  if (opts.addBay) url.searchParams.set('area-bay', '1');
  else url.searchParams.delete('area-bay');
  history.replaceState({}, '', url);
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

function logSiteStats(display, state, params) {
  console.log('=== Site Stats ===');
  console.log('Parameters: ', params);
  console.log('Template:', state.template);
  console.log('Size:', `${state.width} x ${state.height}`);
  console.log('Floors:', state.floors);
  console.log('Rooms:', state.rooms.length);
  console.log('Doors:', state.doors.length);
  console.log('Stairs:', state.stairs.length);
}

function logAreaStats(display, state, params) {
  console.log('=== Area Stats ===');
  console.log('Parameters: ', params);
  console.log('Template:', state.template);
  console.log('Size:', `${state.width} x ${state.height}`);
  console.log('Districts:', state.districts || []);
  console.log('Landmarks:', state.landmarks || []);
  console.log('Roads:', state.roads || []);
  console.log('Gates:', state.gates || []);
  console.log('Waterfront tiles:', state.waterfront || []);
}

// Load URL seed or generate new
const urlParams = new URLSearchParams(window.location.search);
const initialScope = urlParams.get('scope') || 'terrain';
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
const initialSiteTemplate = urlParams.get('site-template') || 'hideout';
const initialSiteW = urlParams.get('site-w') ? parseInt(urlParams.get('site-w'), 10) : 40;
const initialSiteH = urlParams.get('site-h') ? parseInt(urlParams.get('site-h'), 10) : 30;
const initialSiteFloors = urlParams.get('site-floors') ? parseInt(urlParams.get('site-floors'), 10) : 1;
const initialAreaTemplate = urlParams.get('area-template') || 'fantasy-town';
const initialAreaW = urlParams.get('area-w') ? parseInt(urlParams.get('area-w'), 10) : 60;
const initialAreaH = urlParams.get('area-h') ? parseInt(urlParams.get('area-h'), 10) : 60;
const initialAreaRiver = urlParams.get('area-river') !== '0';
const initialAreaBay = urlParams.get('area-bay') !== '0';

// Init GUI
const { gui, options } = initGUI({
  app,
  generate,
  generateSite: generateSiteWrapper,
  generateArea: generateAreaWrapper,
  initialScope,
  initialTemplate,
  initialTerrain,
  initialClimate,
  initialSafety,
  initialSize,
  initialNumPoints,
  initialFeaturesEnabled,
  initialDisplayMode,
  initialTileSize,
  initialSiteTemplate,
  initialSiteW,
  initialSiteH,
  initialSiteFloors,
  initialAreaTemplate,
  initialAreaW,
  initialAreaH,
  initialAreaRiver,
  initialAreaBay,
});

if (initialScope === 'site') {
  generateSiteWrapper({
    seed: initialSeed,
    template: initialSiteTemplate,
    w: initialSiteW,
    h: initialSiteH,
    floors: initialSiteFloors,
  });
} else if (initialScope === 'area') {
  generateAreaWrapper({
    seed: initialSeed,
    template: initialAreaTemplate,
    w: initialAreaW,
    h: initialAreaH,
    addRiver: initialAreaRiver,
    addBay: initialAreaBay,
  });
} else {
  generate(initialTemplate, initialSeed, initialTerrain, initialClimate, initialSafety, initialSize, initialNumPoints, initialFeaturesEnabled, initialDisplayMode, initialTileSize);
}
