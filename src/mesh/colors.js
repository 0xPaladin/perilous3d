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

const BIOME_COLORS = [
  [0.29, 0.54, 0.71],  // 0  Marine
  [0.83, 0.72, 0.48],  // 1  Hot desert
  [0.66, 0.60, 0.55],  // 2  Cold desert
  [0.55, 0.72, 0.35],  // 3  Savanna
  [0.55, 0.72, 0.35],  // 4  Grassland
  [0.36, 0.62, 0.28],  // 5  Tropical seasonal forest
  [0.36, 0.62, 0.28],  // 6  Temperate deciduous forest
  [0.29, 0.48, 0.23],  // 7  Tropical rainforest
  [0.29, 0.48, 0.23],  // 8  Temperate rainforest
  [0.54, 0.72, 0.33],  // 9  Taiga
  [0.54, 0.72, 0.33],  // 10 Tundra
  [0.85, 0.82, 0.78],  // 11 Glacier
  [0.54, 0.72, 0.33],  // 12 Wetland
];

