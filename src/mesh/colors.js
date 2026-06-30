// Color mapping: PS terrain type → Three.js color (linear RGB, 0-1 range)
// Palette matches Perilous Shores' default theme.

export const TERRAIN = {
  SEA_ROCKS: 'SeaRocks',
  WOOD_DARK: 'WoodDark',
  WOOD_LIGHT: 'WoodLight',
  WOOD_DEAD: 'WoodDead',
  DESERT: 'Desert',
  SWAMP: 'Swamp',
  PLAIN: 'Plain',
  MOUNTAIN: 'Mountain',
  WATER: 'Water',
  BEACH: 'Beach',
  RIVER: 'River',
  GRASS: 'Grass',
};

export const TERRAIN_COLORS = {
  [TERRAIN.WATER]:    [0.29, 0.54, 0.71],   // sea blue
  [TERRAIN.SEA_ROCKS]:[0.33, 0.50, 0.66],   // rocks under water
  [TERRAIN.BEACH]:    [0.99, 0.78, 0.52],   // sand
  [TERRAIN.GRASS]:    [0.55, 0.72, 0.35],   // meadow base
  [TERRAIN.PLAIN]:    [0.54, 0.72, 0.33],   // plains
  [TERRAIN.WOOD_DARK]:[0.29, 0.48, 0.23],   // dense forest
  [TERRAIN.WOOD_LIGHT]:[0.36, 0.62, 0.28],  // light forest
  [TERRAIN.WOOD_DEAD]:[0.45, 0.40, 0.35],   // dead trees
  [TERRAIN.DESERT]:   [0.83, 0.72, 0.48],   // sand/dirt
  [TERRAIN.SWAMP]:    [0.42, 0.56, 0.35],   // murky green
  [TERRAIN.MOUNTAIN]: [0.66, 0.60, 0.55],   // rocky gray-brown
  [TERRAIN.RIVER]:    [0.35, 0.57, 0.74],   // river blue
};

export function terrainColor(cell) {
  const t = cell.data.terrain || TERRAIN.WATER;
  return TERRAIN_COLORS[t] || TERRAIN_COLORS[TERRAIN.WATER];
}

export function beachHeightOffset() {
  return 0.02; // fractional offset from water for beach color blending
}
