import { BIOME_GLYPHS, BIOME_GLYPHS_BY_INDEX, BIOME_NAMES } from "../terrain/config.js";
import { SITE_GLYPHS, CELL } from "../sites/index.js";
import { AREA_GLYPHS } from "../areas/index.js";

let rotDisplay = null;
let rotContainer = null;
let legendEl = null;
let displayCols = 0;
let displayRows = 0;
let currentMode = 'terrain'; // 'terrain' or 'site'

const FEATURE_GLYPHS = {
  city: { ch: "@", color: "#ffff00" },
  town: { ch: "+", color: "#ffaa00" },
  ruins: { ch: "R", color: "#ffffff" },
  minorRuins: { ch: "r", color: "#cccccc" },
  resources: { ch: "*", color: "#ffd700" },
  trouble: { ch: "!", color: "#ff5555" },
  outpostSites: { ch: "O", color: "#00ffff" },
  landmarkSites: { ch: "L", color: "#ff00ff" },
  factionSites: { ch: "F", color: "#00ff00" },
  hazards: { ch: "H", color: "#ff6600" },
  obstacles: { ch: "X", color: "#cc8800" },
  areas: { ch: "A", color: "#9966ff" },
};

function ensureContainer() {
  if (rotContainer) return rotContainer;

  rotContainer = document.createElement("div");
  rotContainer.id = "ascii-map";
  document.body.appendChild(rotContainer);

  const fpsEl = document.getElementById("fps");
  if (fpsEl) fpsEl.style.display = "none";
  return rotContainer;
}

function buildSpatialGrid(pts, cellSize) {
  const grid = new Map();
  for (let i = 0; i < pts.length; i++) {
    const gx = Math.floor(pts[i][0] / cellSize);
    const gy = Math.floor(pts[i][1] / cellSize);
    const key = gx + "," + gy;
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
        const key = gx0 + dx + "," + (gy0 + dy);
        const cell = grid.get(key);
        if (!cell) continue;
        found = true;
        for (let k = 0; k < cell.length; k++) {
          const pi = cell[k];
          const ddx = pts[pi][0] - x;
          const ddy = pts[pi][1] - y;
          const d = ddx * ddx + ddy * ddy;
          if (d < bestDist) {
            bestDist = d;
            bestIdx = pi;
          }
        }
      }
    }
    if (ring > 0 && found) {
      const maxDist = ring * cellSize + cellSize;
      if (maxDist * maxDist <= bestDist) break;
    }
  }
  return bestIdx;
}

function createDisplay(cols, rows) {
  if (rotDisplay) {
    const oldEl = rotDisplay.getContainer();
    if (oldEl && oldEl.parentNode) oldEl.parentNode.removeChild(oldEl);
    rotDisplay = null;
  }

  const fontSize = Math.max(8, Math.min(16, Math.floor(700 / Math.max(cols, rows))));
  rotDisplay = new ROT.Display({
    width: cols,
    height: rows,
    fontSize: fontSize,
    fontFamily: "monospace",
    forceSquareRatio: true,
    bg: "#000",
  });

  rotContainer.innerHTML = "";
  rotContainer.appendChild(rotDisplay.getContainer());
  displayCols = cols;
  displayRows = rows;
}

function buildLegend() {
  if (!legendEl) {
    legendEl = document.createElement("div");
    legendEl.id = "ascii-legend";
    rotContainer.appendChild(legendEl);
  }

  let html = "";
  for (let i = 0; i < BIOME_GLYPHS_BY_INDEX.length; i++) {
    const info = BIOME_GLYPHS_BY_INDEX[i];
    html += `<span style="color:${info.color}">${info.glyph} ${BIOME_NAMES[i]}</span>`;
  }
  html += `<span style="color:${BIOME_GLYPHS.Hill.color}">${BIOME_GLYPHS.Hill.glyph} Hill</span>`;
  html += `<span style="color:${BIOME_GLYPHS.Mountain.color}">${BIOME_GLYPHS.Mountain.glyph} Mountain</span>`;
  for (const [key, info] of Object.entries(FEATURE_GLYPHS)) {
    html += `<span style="color:${info.color}">${info.ch} ${key}</span>`;
  }
  legendEl.innerHTML = html;
}

export function showAsciiMap(display, state, tileSize) {
  const container = ensureContainer();
  container.style.display = "block";

  const { pts, biome, heights, extent } = display;
  const hw = extent.width / 2;
  const hh = extent.height / 2;

  const cols = Math.ceil(extent.width / tileSize);
  const rows = Math.ceil(extent.height / tileSize);
  const tileHalfW = tileSize / 2;
  const tileHalfH = tileSize / 2;
  const cellSize = Math.max(tileSize, 10);
  const grid = buildSpatialGrid(pts, cellSize);

  if (!rotDisplay || displayCols !== cols || displayRows !== rows) {
    createDisplay(cols, rows);
  }
  rotDisplay.clear();

  const featureMap = Array.from({ length: rows }, () => new Array(cols).fill(null));

  const featureSets = [
    [state.cities || [], FEATURE_GLYPHS.city],
    [state.towns || [], FEATURE_GLYPHS.town],
    [state.ruins || [], FEATURE_GLYPHS.ruins],
    [state.minorRuins || [], FEATURE_GLYPHS.minorRuins],
    [state.resources || [], FEATURE_GLYPHS.resources],
    [state.trouble || [], FEATURE_GLYPHS.trouble],
    [state.outpostSites || [], FEATURE_GLYPHS.outpostSites],
    [state.landmarkSites || [], FEATURE_GLYPHS.landmarkSites],
    [state.factionSites || [], FEATURE_GLYPHS.factionSites],
    [state.hazards || [], FEATURE_GLYPHS.hazards],
    [state.obstacles || [], FEATURE_GLYPHS.obstacles],
    [state.areas || [], FEATURE_GLYPHS.areas],
  ];

  for (const [items, glyphInfo] of featureSets) {
    for (const item of items) {
      const fc = Math.floor((item.x + hw) / tileSize);
      const fr = Math.floor((item.z + hh) / tileSize);
      if (fc >= 0 && fc < cols && fr >= 0 && fr < rows) {
        featureMap[fr][fc] = glyphInfo;
      }
    }
  }

  for (let r = 0; r < rows; r++) {
    const tileCenterY = -hh + tileHalfH + r * tileSize;
    for (let c = 0; c < cols; c++) {
      const tileCenterX = -hw + tileHalfW + c * tileSize;
      const bestIdx = nearestInGrid(pts, grid, cellSize, tileCenterX, tileCenterY);
      const h = heights ? heights[bestIdx] : 0;
      const b = biome ? biome[bestIdx] : 0;
      const biomeInfo = BIOME_GLYPHS_BY_INDEX[b] || BIOME_GLYPHS_BY_INDEX[0];

      let terrainGlyph, terrainColor;
      if (h > 0.55) {
        terrainGlyph = BIOME_GLYPHS.Mountain.glyph;
        terrainColor = BIOME_GLYPHS.Mountain.color;
      } else if (h > 0.3) {
        terrainGlyph = BIOME_GLYPHS.Hill.glyph;
        terrainColor = BIOME_GLYPHS.Hill.color;
      } else {
        terrainGlyph = biomeInfo.glyph;
        terrainColor = biomeInfo.color;
      }

      const feat = featureMap[r][c];

      if (feat) {
        rotDisplay.draw(c, r, feat.ch, feat.color, terrainColor);
      } else {
        rotDisplay.draw(c, r, terrainGlyph, "#fff", terrainColor);
      }
    }
  }

  buildLegend();
}

function buildSiteLegend() {
  if (!legendEl) {
    legendEl = document.createElement("div");
    legendEl.id = "ascii-legend";
    rotContainer.appendChild(legendEl);
  }

  let html = "";
  html += `<span style="color:${SITE_GLYPHS[CELL.WALL].color}">${SITE_GLYPHS[CELL.WALL].ch} Wall</span>`;
  html += `<span style="color:${SITE_GLYPHS[CELL.FLOOR].color}">${SITE_GLYPHS[CELL.FLOOR].ch} Floor</span>`;
  html += `<span style="color:${SITE_GLYPHS[CELL.DOOR].color}">${SITE_GLYPHS[CELL.DOOR].ch} Door</span>`;
  html += `<span style="color:${SITE_GLYPHS[CELL.STAIRS].color}">${SITE_GLYPHS[CELL.STAIRS].ch} Stairs</span>`;
  legendEl.innerHTML = html;
}

export function showAsciiSite(display, state, tileSize) {
  const container = ensureContainer();
  container.style.display = "block";
  currentMode = 'site';

  const { cols, rows, grid, walls } = display;

  if (!rotDisplay || displayCols !== cols || displayRows !== rows) {
    createDisplay(cols, rows);
  }
  rotDisplay.clear();

  // Draw floor/wall/door/stairs cells
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cellType = grid[r][c];
      const glyphInfo = SITE_GLYPHS[cellType] || SITE_GLYPHS[CELL.WALL];
      rotDisplay.draw(c, r, glyphInfo.ch, glyphInfo.color, glyphInfo.bg);
    }
  }

  // Draw wall lines for organic floorplans (walls are line segments)
  if (walls && walls.length > 0) {
    const canvas = rotDisplay.getContainer();
    if (canvas) {
      const ctx = canvas.getContext('2d');
      const fontSize = parseInt(getComputedStyle(canvas).fontSize) || 12;
      const charWidth = fontSize;
      const charHeight = fontSize;

      ctx.strokeStyle = SITE_GLYPHS[CELL.WALL].color;
      ctx.lineWidth = Math.max(1, charWidth * 0.15);
      ctx.lineCap = 'square';

      for (const [x1, y1, x2, y2] of walls) {
        const px1 = x1 * charWidth;
        const py1 = y1 * charHeight;
        const px2 = x2 * charWidth;
        const py2 = y2 * charHeight;
        ctx.beginPath();
        ctx.moveTo(px1, py1);
        ctx.lineTo(px2, py2);
        ctx.stroke();
      }
    }
  }

  buildSiteLegend();
}

function buildAreaLegend() {
  if (!legendEl) {
    legendEl = document.createElement("div");
    legendEl.id = "ascii-legend";
    rotContainer.appendChild(legendEl);
  }

  let html = "";
  // Build a readable legend from AREA_GLYPHS
  const seen = new Set();
  for (const [key, info] of Object.entries(AREA_GLYPHS)) {
    if (seen.has(info.ch)) continue;
    seen.add(info.ch);
    const label = key === '.' ? 'Open Space' :
      key === '~' ? 'Water' :
        key === '=' ? 'Major Road' :
          key === '-' ? 'Street' :
            key === '#' ? 'Dense Buildings' :
              key === 'n' ? 'Medium Housing' :
                key === 'h' ? 'Sparse Housing' :
                  key === 'o' ? 'Central Plaza' :
                    key === '†' ? 'Temple' :
                      key === 'T' ? 'Keep/Palace' :
                        key === 'H' ? 'Town Hall' :
                          key === 'M' ? 'Workshop/Mill' :
                            key === '&' ? 'Tavern/Shop' :
                              key === 'D' ? 'Dock/Warehouse' :
                                key === '█' ? 'City Wall' :
                                  key === '≡' ? 'Elevated Highway' :
                                    key === 'A' ? 'Arcology' :
                                      key === 'C' ? 'Corporate Tower' :
                                        key === 'N' ? 'Neon Commercial' :
                                          key === 'R' ? 'Residential High-rise' :
                                            key === 'r' ? 'Mid/Low Residential' :
                                              key === 'S' ? 'Lower City/Slum' :
                                                key === 'I' ? 'Industrial Zone' :
                                                  key === '⛏' ? 'Transit Hub' :
                                                    key === '⊘' ? 'Rubble/Ruins' :
                                                      key === '☢' ? 'Radiation Zone' :
                                                        key === '⌬' ? 'Alien Structure' :
                                                          key === '⍓' ? 'Alien Tech' :
                                                            key === '⌖' ? 'Alien Monument' :
                                                              key;
    html += `<span style="color:${info.color}">${info.ch} ${label}</span>`;
  }
  legendEl.innerHTML = html;
}

export function showAsciiArea(display, state, tileSize) {
  const container = ensureContainer();
  container.style.display = "block";
  currentMode = 'area';

  const { cols, rows, grid } = display;

  if (!rotDisplay || displayCols !== cols || displayRows !== rows) {
    createDisplay(cols, rows);
  }
  rotDisplay.clear();

  // Draw each cell using AREA_GLYPHS
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ch = grid[r][c];
      const glyphInfo = AREA_GLYPHS[ch] || AREA_GLYPHS['.'];
      rotDisplay.draw(c, r, glyphInfo.ch, glyphInfo.color, glyphInfo.bg);
    }
  }

  buildAreaLegend();
}

export function hideAsciiMap() {
  if (rotContainer) {
    rotContainer.style.display = "none";
  }
  const fpsEl = document.getElementById("fps");
  if (fpsEl) fpsEl.style.display = "";
}
