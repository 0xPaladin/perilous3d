import * as THREE from 'three';

let homePos, homeTarget;

export function initItemsPanel(app) {
  const old = document.getElementById('items-panel');
  if (old) old.remove();
  const panel = document.createElement('div');
  panel.id = 'items-panel';
  panel.innerHTML = `
    <div class="ip-header">Locations</div>
    <select id="ip-category">
      <option value="">Select category...</option>
      <option value="cities">Cities</option>
      <option value="towns">Towns</option>
      <option value="resources">Resources</option>
      <option value="dungeons">Dungeons</option>
      <option value="ruins">Ruins</option>
      <option value="landmarks">Landmarks</option>
    <option value="outposts">Outposts</option>
    <option value="factions">Factions</option>
    <option value="hazards">Hazards</option>
      <option value="obstacles">Obstacles</option>
      <option value="areas">Areas</option>
      <option value="trouble">Trouble</option>
    </select>
    <div id="ip-list"></div>
    <button id="ip-zoomout" style="display:none">Zoom Out</button>
  `;
  document.body.appendChild(panel);

  const select = document.getElementById('ip-category');
  const listEl = document.getElementById('ip-list');
  const zoomBtn = document.getElementById('ip-zoomout');

  const state = app.state;
  if (!state) return;

  // Site mode — show rooms, doors, stairs instead of terrain locations
  if (state.template && state.rooms) {
    panel.innerHTML = `
      <div class="ip-header">Site: ${state.template}</div>
      <select id="ip-category">
        <option value="">Select category...</option>
        <option value="rooms">Rooms</option>
        <option value="doors">Doors</option>
        <option value="stairs">Stairs</option>
      </select>
      <div id="ip-list"></div>
    `;
    const siteSelect = document.getElementById('ip-category');
    const siteListEl = document.getElementById('ip-list');

    const siteItems = {
      rooms: state.rooms || [],
      doors: state.doors || [],
      stairs: state.stairs || [],
    };

    siteSelect.addEventListener('change', () => {
      const cat = siteSelect.value;
      if (!cat || !siteItems[cat].length) {
        siteListEl.innerHTML = siteItems[cat] && siteItems[cat].length === 0 ? '<div class="ip-empty">None</div>' : '';
        return;
      }
      let html = '';
      for (let i = 0; i < siteItems[cat].length; i++) {
        const item = siteItems[cat][i];
        let label;
        if (cat === 'rooms') {
          label = `Room ${i + 1}: [${item[0]},${item[1]}] - [${item[2]},${item[3]}]`;
        } else {
          label = `${cat === 'doors' ? 'Door' : 'Stairs'} ${i + 1}: (${item[0]}, ${item[1]})`;
        }
        html += `<div class="ip-item">${label}</div>`;
      }
      siteListEl.innerHTML = html;
    });

    return;
  }

  const items = {
    cities: state.cities || [],
    towns: state.towns || [],
    resources: state.resources || [],
    dungeons: (state.ruins || []).map(r => ({ ...r, _subtype: 'dungeon' })),
    ruins: (state.minorRuins || []).map(r => ({ ...r, _subtype: 'ruin' })),
    landmarks: (state.landmarkSites || []).map(r => ({ ...r, _subtype: 'landmark' })),
    outposts: (state.outpostSites || []).map(o => ({ ...o, _subtype: 'outpost' })),
    factions: (state.factionSites || []).map(f => ({ ...f, _subtype: 'faction' })),
    hazards: (state.hazards || []).filter(h => !h.regionWide).map(h => ({ ...h, _subtype: 'hazard' })),
    obstacles: (state.obstacles || []).map(o => ({ ...o, _subtype: 'obstacle' })),
    areas: (state.areas || []).map(a => ({ ...a, _subtype: 'area' })),
    trouble: state.trouble || [],
  };

  select.addEventListener('change', () => {
    const cat = select.value;
    zoomBtn.style.display = 'none';
    if (!cat || !items[cat].length) {
      listEl.innerHTML = items[cat] && items[cat].length === 0 ? '<div class="ip-empty">None</div>' : '';
      return;
    }
    let html = '';
    for (let i = 0; i < items[cat].length; i++) {
      const item = items[cat][i];
      const x = Math.round(item.x);
      const y = Math.round(item.z);
      let label;
      if (cat === 'cities') label = `City @ ${x}, ${y}`;
      else if (cat === 'towns') label = `Town @ ${x}, ${y}`;
      else if (cat === 'resources') label = `${item.type} @ ${x}, ${y}`;
      else if (cat === 'dungeons') label = item.name ? `${item.name} @ ${x}, ${y}` : `Dungeon @ ${x}, ${y}`;
      else if (cat === 'ruins') label = item.name ? `${item.name} @ ${x}, ${y}` : `Ruins @ ${x}, ${y}`;
      else if (cat === 'landmarks') label = item.name ? `${item.name} @ ${x}, ${y}` : `Landmark @ ${x}, ${y}`;
      else if (cat === 'outposts') label = `Outpost @ ${x}, ${y}`;
      else if (cat === 'factions') {
        const ft = item.faction?.type || 'Faction';
        label = `${ft} @ ${x}, ${y}`;
      }
      else if (cat === 'hazards') label = `${item.type || 'Hazard'} @ ${x}, ${y}`;
      else if (cat === 'obstacles') label = `${item.type || 'Obstacle'} @ ${x}, ${y}`;
      else if (cat === 'areas') label = `${item.type || 'Area'} @ ${x}, ${y}`;
      else if (cat === 'trouble') label = `${item.type || 'Trouble'} @ ${x}, ${y}`;
      html += `<div class="ip-item" data-x="${item.x}" data-z="${item.z}">${label}</div>`;
    }
    listEl.innerHTML = html;
    zoomBtn.style.display = 'block';

    listEl.querySelectorAll('.ip-item').forEach(el => {
      el.addEventListener('click', () => {
        const x = parseFloat(el.dataset.x);
        const z = parseFloat(el.dataset.z);
        flyTo(app.sceneState, x, z);
      });
    });
  });

  zoomBtn.addEventListener('click', () => {
    zoomOut(app.sceneState);
  });

  // Store home view
  if (app.sceneState) {
    homePos = app.sceneState.camera.position.clone();
    homeTarget = app.sceneState.controls.target.clone();
  }
}

function flyTo(state, x, z) {
  const { camera, controls } = state;
  const startPos = camera.position.clone();
  const startTarget = controls.target.clone();
  const endTarget = new THREE.Vector3(x, 0, z);
  const dist = Math.max(60, startPos.distanceTo(endTarget) * 0.5);
  const endPos = new THREE.Vector3(x, dist * 0.4, z + dist * 0.6);
  const duration = 600;
  const startTime = performance.now();

  function step() {
    const t = Math.min((performance.now() - startTime) / duration, 1);
    const e = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    camera.position.lerpVectors(startPos, endPos, e);
    controls.target.lerpVectors(startTarget, endTarget, e);
    controls.update();
    if (t < 1) requestAnimationFrame(step);
  }
  step();
}

function zoomOut(state) {
  if (!homePos) return;
  const { camera, controls } = state;
  const startPos = camera.position.clone();
  const startTarget = controls.target.clone();
  const duration = 600;
  const startTime = performance.now();

  function step() {
    const t = Math.min((performance.now() - startTime) / duration, 1);
    const e = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    camera.position.lerpVectors(startPos, homePos, e);
    controls.target.lerpVectors(startTarget, homeTarget, e);
    controls.update();
    if (t < 1) requestAnimationFrame(step);
  }
  step();
}
