import { BIOME_GLYPHS_BY_INDEX, BIOME_NAMES } from "../terrain/config.js";

let rotDisplay = null;
let rotContainer = null;
let legendEl = null;
let displayCols = 0;
let displayRows = 0;

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
  rotContainer.style.position = "absolute";
  rotContainer.style.top = "0";
  rotContainer.style.left = "0";
  rotContainer.style.width = "100%";
  rotContainer.style.height = "100%";
  rotContainer.style.zIndex = "5";
  rotContainer.style.overflow = "auto";
  rotContainer.style.background = "#000";
  rotContainer.style.fontFamily = "monospace";
  rotContainer.style.display = "none";
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
    forceCellSize: true,
    cellWidth: fontSize + 2,
    cellHeight: fontSize + 4,
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
    legendEl.style.position = "absolute";
    legendEl.style.bottom = "10px";
    legendEl.style.left = "50%";
    legendEl.style.transform = "translateX(-50%)";
    legendEl.style.zIndex = "10";
    legendEl.style.background = "rgba(0,0,0,0.7)";
    legendEl.style.padding = "8px 16px";
    legendEl.style.borderRadius = "6px";
    legendEl.style.fontFamily = "monospace";
    legendEl.style.fontSize = "12px";
    rotContainer.appendChild(legendEl);
  }

  let html = "";
  for (let i = 0; i < BIOME_GLYPHS_BY_INDEX.length; i++) {
    const info = BIOME_GLYPHS_BY_INDEX[i];
    html += `<span style="color:${info.color};margin:0 4px">${info.glyph} ${BIOME_NAMES[i]}</span>`;
  }
  for (const [key, info] of Object.entries(FEATURE_GLYPHS)) {
    html += `<span style="color:${info.color};margin:0 4px">${info.ch} ${key}</span>`;
  }
  legendEl.innerHTML = html;
}

export function showAsciiMap(display, state, tileSize) {
  const container = ensureContainer();
  container.style.display = "block";

  const { pts, biome, extent } = display;
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
      const b = biome ? biome[bestIdx] : 0;
      const info = BIOME_GLYPHS_BY_INDEX[b] || BIOME_GLYPHS_BY_INDEX[0];
      const feat = featureMap[r][c];

      if (feat) {
        rotDisplay.draw(c, r, feat.ch, feat.color, info.color);
      } else {
        rotDisplay.draw(c, r, info.glyph, "#fff", info.color);
      }
    }
  }

  buildLegend();
}

export function hideAsciiMap() {
  if (rotContainer) {
    rotContainer.style.display = "none";
  }
  const fpsEl = document.getElementById("fps");
  if (fpsEl) fpsEl.style.display = "";
}
