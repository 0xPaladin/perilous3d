import { BIOME_GLYPHS_BY_INDEX } from '../terrain/config.js';

let asciiContainer = null;
let asciiPre = null;

function ensureContainer() {
  if (asciiContainer) return;
  asciiContainer = document.createElement('div');
  asciiContainer.id = 'ascii-map';
  asciiContainer.style.display = 'none';
  asciiContainer.style.position = 'absolute';
  asciiContainer.style.top = '0';
  asciiContainer.style.left = '0';
  asciiContainer.style.width = '100%';
  asciiContainer.style.height = '100%';
  asciiContainer.style.overflow = 'auto';
  asciiContainer.style.background = '#000';
  asciiContainer.style.zIndex = '5';
  asciiContainer.style.fontFamily = 'monospace';
  asciiContainer.style.fontSize = '14px';
  asciiContainer.style.lineHeight = '1';
  asciiContainer.style.letterSpacing = '0';
  asciiContainer.style.textAlign = 'center';
  asciiContainer.style.padding = '20px';
  asciiContainer.style.overflow = 'auto';
  asciiContainer.style.maxHeight = '100vh';
  document.body.appendChild(asciiContainer);
  asciiPre = document.createElement('pre');
  asciiPre.style.margin = '0 auto';
  asciiPre.style.whiteSpace = 'pre';
  asciiContainer.appendChild(asciiPre);

  const fpsEl = document.getElementById('fps');
  if (fpsEl) fpsEl.style.display = 'none';
}

function buildSpatialGrid(pts, cellSize) {
  const grid = new Map();
  for (let i = 0; i < pts.length; i++) {
    const x = pts[i][0];
    const y = pts[i][1];
    const gx = Math.floor(x / cellSize);
    const gy = Math.floor(y / cellSize);
    const key = gx + ',' + gy;
    let cell = grid.get(key);
    if (!cell) {
      cell = [];
      grid.set(key, cell);
    }
    cell.push(i);
  }
  return grid;
}

function nearestInGrid(pts, grid, cellSize, x, y) {
  let bestIdx = 0;
  let bestDist = Infinity;
  const gx0 = Math.floor(x / cellSize);
  const gy0 = Math.floor(y / cellSize);

  for (let ring = 0; ring < 10; ring++) {
    let found = false;
    for (let dy = -ring; dy <= ring; dy++) {
      for (let dx = -ring; dx <= ring; dx++) {
        if (ring > 0 && Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue;
        const gx = gx0 + dx;
        const gy = gy0 + dy;
        const key = gx + ',' + gy;
        const cell = grid.get(key);
        if (!cell) continue;
        found = true;
        for (let i = 0; i < cell.length; i++) {
          const pi = cell[i];
          const ppx = pts[pi][0];
          const ppy = pts[pi][1];
          const ddx = ppx - x;
          const ddy = ppy - y;
          const d = ddx * ddx + ddy * ddy;
          if (d < bestDist) {
            bestDist = d;
            bestIdx = pi;
          }
        }
      }
    }
    if (ring > 0 && found) {
      const maxDistInRing = ring * cellSize + cellSize;
      if (maxDistInRing * maxDistInRing <= bestDist) break;
    }
  }
  return bestIdx;
}

const FEATURE_GLYPHS = {
  city: '@',
  town: '+',
  ruins: 'R',
  minorRuins: 'r',
  resources: '*',
  trouble: '!',
  outpostSites: 'O',
  landmarkSites: 'L',
  hazards: 'H',
  obstacles: 'X',
  areas: 'A',
};

export function showAsciiMap(display, state, tileSize) {
  ensureContainer();
  const { pts, biome, extent } = display;
  const hw = extent.width / 2;
  const hh = extent.height / 2;

  const cols = Math.ceil(extent.width / tileSize);
  const rows = Math.ceil(extent.height / tileSize);

  const tileHalfW = tileSize / 2;
  const tileHalfH = tileSize / 2;

  const cellSize = Math.max(tileSize, 10);
  const grid = buildSpatialGrid(pts, cellSize);

  const glyphGrid = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      row.push(' ');
    }
    glyphGrid.push(row);
  }

  for (let r = 0; r < rows; r++) {
    const tileCenterY = -hh + tileHalfH + r * tileSize;
    for (let c = 0; c < cols; c++) {
      const tileCenterX = -hw + tileHalfW + c * tileSize;
      const bestIdx = nearestInGrid(pts, grid, cellSize, tileCenterX, tileCenterY);
      const b = biome ? biome[bestIdx] : 0;
      const info = BIOME_GLYPHS_BY_INDEX[b] || BIOME_GLYPHS_BY_INDEX[0];
      glyphGrid[r][c] = info.glyph;
    }
  }

  const featureSets = [
    { items: state.cities || [], glyph: FEATURE_GLYPHS.city },
    { items: state.towns || [], glyph: FEATURE_GLYPHS.town },
    { items: state.ruins || [], glyph: FEATURE_GLYPHS.ruins },
    { items: state.minorRuins || [], glyph: FEATURE_GLYPHS.minorRuins },
    { items: state.resources || [], glyph: FEATURE_GLYPHS.resources },
    { items: state.trouble || [], glyph: FEATURE_GLYPHS.trouble },
  ];

  for (const fs of featureSets) {
    for (const item of fs.items) {
      const fx = item.x;
      const fy = item.z;
      const fc = Math.floor((fx + hw) / tileSize);
      const fr = Math.floor((fy + hh) / tileSize);
      if (fc >= 0 && fc < cols && fr >= 0 && fr < rows) {
        glyphGrid[fr][fc] = fs.glyph;
      }
    }
  }

  let html = '';
  for (let r = 0; r < rows; r++) {
    html += glyphGrid[r].join('') + '\n';
  }

  asciiPre.textContent = html;
  asciiContainer.style.display = 'block';
}

export function hideAsciiMap() {
  if (asciiContainer) {
    asciiContainer.style.display = 'none';
  }
  const fpsEl = document.getElementById('fps');
  if (fpsEl) fpsEl.style.display = '';
}
