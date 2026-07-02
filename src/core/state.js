/**
 * RegionState — the configuration and narrative feature data for a region.
 * This is the "what" of the map: settings, feature placements, and story content.
 * It contains no geometric display data — that lives in DisplayData.
 *
 * @typedef {Object} RegionState
 * @property {number} seed - PRNG seed
 * @property {{ width: number, height: number }} extent - map extent in km
 * @property {number} waterLevel - normalized water level (0-1)
 * @property {string} template - template name (island, archipelago, bay, lake, land)
 * @property {string} terrain - terrain type (wetland, lowland, woodland, highland, wasteland)
 * @property {number} baseTemp - base temperature in °C
 * @property {number} cityCount - number of cities (derived from safety)
 * @property {Array<{x: number, z: number, idx: number, habitability: number}>} cities
 * @property {Array<{x: number, z: number, idx: number, habitability: number}>} towns
 * @property {Array<{x: number, z: number, idx: number, type: string}>} resources
 * @property {Array<{x: number, z: number, idx: number, name: string}>} ruins
 * @property {Array<{x: number, z: number, idx: number, name: string}>} minorRuins
 * @property {Array<{x: number, z: number, idx: number, type: string}>} trouble
 * @property {Array<Object>} features - narrative feature descriptions
 * @property {Array<{x: number, z: number, idx: number}>} outpostSites
 * @property {Array<{x: number, z: number, idx: number, name?: string}>} landmarkSites
 * @property {Array<{x: number, z: number, idx: number, faction: Object}>} factionSites
 * @property {Array<{x: number, z: number, idx: number, type: string, terrain: string}>} hazards
 * @property {Array<{x: number, z: number, idx: number, type: string, terrain: string}>} obstacles
 * @property {Array<{x: number, z: number, idx: number, neighbors: Array, type: string, terrain: string}>} areas
 * @property {Object} peoples - generated peoples/factions data
 */

/**
 * DisplayData — the geometric and physical representation of the region.
 * This is derived from RegionState (deterministic from seed) and consumed by renderers.
 *
 * @typedef {Object} DisplayData
 * @property {Array<[number, number]>} pts - random point positions (x, z)
 * @property {Uint32Array} triangles - Delaunator triangle indices
 * @property {Uint32Array} halfedges - Delaunator halfedges
 * @property {Array<Array<number>>} adj - per-vertex adjacency list
 * @property {Array<number>} heights - normalized heights (0-1+)
 * @property {Float64Array} rawHeights - raw (unclamped) heights
 * @property {number} heightMin
 * @property {number} heightMax
 * @property {{ width: number, height: number }} extent - (same ref as state.extent)
 * @property {number} waterLevel - (same ref as state.waterLevel)
 * @property {Array<number>} temperature - per-vertex temperature values
 * @property {Array<number>} tempBand - per-vertex Azgaar temperature band
 * @property {Array<number>} moisture - per-vertex moisture values
 * @property {Array<number>} biome - per-vertex Azgaar biome index (0-12)
 * @property {Object} rivers - { segments: Array<[number,number]>, flux: Float64Array }
 * @property {Array<number>} habitability - per-vertex habitability score
 * @property {Uint8Array} nearWater - per-vertex near-water flag
 * @property {number} mountainCount
 * @property {Array<{x: number, y: number, r: number, peakHeight: number, _idx: number}>} mounts
 */

export {};