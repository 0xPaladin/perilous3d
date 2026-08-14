/**
 * Area generation — produces a 2D ASCII grid for fantasy towns/cities,
 * sci-fi districts, or post-apoc/alien ruins.
 * Scale: 1 tile ≈ 100 m.
 *
 * generateArea(opts) -> { display, state }
 *
 * display = { cols, rows, grid, width, height }
 *   grid: 2D array [row][col] of glyph characters (strings)
 *
 * state = { template, seed, width, height, districts, landmarks, roads, gates, waterfront }
 *   districts: Array of { name, x, y, role }
 *   landmarks: Array of { name, x, y, glyph }
 *   roads: Array of { x1, y1, x2, y2 }
 *   gates: Array of { x, y, side }
 *   waterfront: Array of { x, y }
 */

import { mulberry32, seedFromString, pick, shuffle, randInt } from '../core/prng.js';
import { createRiver } from './river.js';
import { createRoad, elevateAndGrid } from './roads.js';
import { createBay } from './bay.js';
import { createTown } from './fantasy-town.js';
import { createCity } from './fantasy-city.js';
import { createDistrict } from './sci-fi-district.js';
import { createRuin } from './ruination.js';

// Glyph definitions for ASCII rendering
// Each entry: { ch, color, bg }
export const AREA_GLYPHS = {
    // Terrain / base
    ' ': { ch: ' ', color: '#cccccc', bg: '#333333' },
    '.': { ch: '.', color: '#cccccc', bg: '#333333' },
    '~': { ch: '~', color: '#4a90d9', bg: '#1a3a5c' },

    // Fantasy town/city
    '=': { ch: '=', color: '#aaaaaa', bg: '#444444' },
    '-': { ch: '-', color: '#888888', bg: '#3a3a3a' },
    '#': { ch: '#', color: '#999999', bg: '#2a2a2a' },
    'n': { ch: 'n', color: '#aaaaaa', bg: '#333333' },
    'h': { ch: 'h', color: '#888888', bg: '#2e2e2e' },
    'o': { ch: 'o', color: '#ffff00', bg: '#333333' },
    '†': { ch: '†', color: '#ff6666', bg: '#333333' },
    'K': { ch: 'K', color: '#ffaa00', bg: '#333333' },
    'P': { ch: 'P', color: '#b80da9', bg: '#333333' },
    'H': { ch: 'H', color: '#ffdd00', bg: '#333333' },
    'M': { ch: 'M', color: '#d4a76a', bg: '#333333' },
    '&': { ch: '&', color: '#ff88ff', bg: '#333333' },
    'D': { ch: 'D', color: '#88ccff', bg: '#333333' },
    '█': { ch: '█', color: '#aaaaaa', bg: '#222222' },

    // Sci-fi district
    '≡': { ch: '≡', color: '#ff6600', bg: '#2a1a0a' },
    'A': { ch: 'A', color: '#00ffff', bg: '#1a1a2e' },
    'C': { ch: 'C', color: '#00ccff', bg: '#1a1a2e' },
    'N': { ch: 'N', color: '#ff0066', bg: '#1a1a2e' },
    'R': { ch: 'R', color: '#88ccff', bg: '#1a1a2e' },
    'r': { ch: 'r', color: '#6699cc', bg: '#1a1a2e' },
    'S': { ch: 'S', color: '#888888', bg: '#111111' },
    'I': { ch: 'I', color: '#cc9900', bg: '#1a1a2e' },
    'T': { ch: 'T', color: '#00ff88', bg: '#1a1a2e' },

    // Post-apoc / alien (shared glyphs with distinct colors)
    '%': { ch: '%', color: '#aaaaaa', bg: '#333333' },
    '*': { ch: '*', color: '#aaaaaa', bg: '#333333' },
    'x': { ch: 'x', color: '#aaaaaa', bg: '#333333' },
    ',': { ch: ',', color: '#04804c', bg: '#333333' },
    '⊘': { ch: '⊘', color: '#ff6600', bg: '#2a1a0a' },
    '☢': { ch: '☢', color: '#ffcc00', bg: '#2a2a0a' },
    '⌬': { ch: '⌬', color: '#aa00ff', bg: '#0a0a1a' },
    '⍓': { ch: '⍓', color: '#00ffaa', bg: '#0a0a1a' },
    '⌖': { ch: '⌖', color: '#ff00aa', bg: '#0a0a1a' },
};

export const LANDMARK_GLYPFS = {
    '†': 'Temple',
    'K': 'Keep/Noble',
    'P': 'Palace',
    'H': 'Town Hall',
    'M': 'Workshop/Mill',
    '&': 'Tavern/Shop',
    'D': 'Dock/Warehouse',
    'o': 'Central Plaza',
    'A': 'Arcology',
    'C': 'Corporate Tower',
    'T': 'Transit Hub',
    'N': 'Neon Commercial',
    'R': 'Residential High-rise',
    'S': 'Lower City/Slum',
    'I': 'Industrial Zone',
};

// Templates that use the fantasy-town generator
const FANTASY_TOWN_TEMPLATES = ['fantasy-town'];

// Templates that use the fantasy-city generator
const FANTASY_CITY_TEMPLATES = ['fantasy-city', 'fantasy-city-ruins'];

// Templates that use the sci-fi district generator
const SCI_FI_TEMPLATES = ['sci-fi-city-district'];

// Templates that use post-apoc / alien generators
const POST_APOC_TEMPLATES = ['post-epoc-ruins', 'alien-ruins'];

/**
 * Create a base map filled with a given character.
 * @param {number} w - width
 * @param {number} h - height
 * @param {string} fill - fill character
 * @returns {string[]}
 */
function createBaseMap(w, h, fill = ' ') {
    return Array.from({ length: h }, () => fill.repeat(w));
}

/**
 * Convert a string[] map to a 2D char grid.
 * @param {string[]} map
 * @returns {string[][]}
 */
function mapToGrid(map) {
    return map.map(row => row.split(''));
}

/**
 * Convert a 2D char grid back to string[].
 * @param {string[][]} grid
 * @returns {string[]}
 */
function gridToMap(grid) {
    return grid.map(row => row.join(''));
}

/**
 * Extract metadata from a generated map for the items panel.
 * Scans the grid for landmarks, roads, gates, and waterfront tiles.
 * @param {string[][]} grid
 * @param {number} w
 * @param {number} h
 * @param {string} waterChar
 * @returns {{ landmarks: Array, roads: Array, gates: Array, waterfront: Array }}
 */
function extractMetadata(grid, w, h, waterChar = '~') {
    const landmarks = [];
    const roads = [];
    const gates = [];
    const waterfront = [];

    // Scan for landmarks
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const ch = grid[y][x];
            if (LANDMARK_GLYPFS[ch]) {
                landmarks.push({ x, y, glyph: ch });
            }
            // Gates are '=' tiles on the map border
            if (ch === '=' && (x === 0 || x === w - 1 || y === 0 || y === h - 1)) {
                const side = x === 0 ? 'W' : x === w - 1 ? 'E' : y === 0 ? 'N' : 'S';
                gates.push({ x, y, side });
            }
            // Waterfront: land tile adjacent to water
            if (ch !== waterChar) {
                let nearWater = false;
                for (let dy = -1; dy <= 1 && !nearWater; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        const nx = x + dx, ny = y + dy;
                        if (nx >= 0 && nx < w && ny >= 0 && ny < h && grid[ny][nx] === waterChar) {
                            nearWater = true;
                        }
                    }
                }
                if (nearWater) waterfront.push({ x, y });
            }
        }
    }

    // Extract road segments (simplified: collect contiguous '=' runs)
    // For the items panel, we'll just count major roads
    const visited = new Set();
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            if (['=', '≡'].includes(grid[y][x]) && !visited.has(`${x},${y}`)) {
                // BFS to find the road segment
                const queue = [{ x, y }];
                const segment = [];
                while (queue.length) {
                    const { x: cx, y: cy } = queue.shift();
                    const key = `${cx},${cy}`;
                    if (visited.has(key)) continue;
                    visited.add(key);
                    segment.push({ x: cx, y: cy });
                    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                        const nx = cx + dx, ny = cy + dy;
                        if (nx >= 0 && nx < w && ny >= 0 && ny < h && ['=', '≡'].includes(grid[ny][nx]) && !visited.has(`${nx},${ny}`)) {
                            queue.push({ x: nx, y: ny });
                        }
                    }
                }
                if (segment.length >= 3) {
                    roads.push({
                        x1: segment[0].x, y1: segment[0].y,
                        x2: segment[segment.length - 1].x, y2: segment[segment.length - 1].y,
                        length: segment.length,
                    });
                }
            }
        }
    }

    return { landmarks, roads, gates, waterfront };
}

/**
 * Main area generation entry point.
 * @param {Object} opts
 * @param {string} opts.seed - Seed string
 * @param {string} opts.template - 'fantasy-town' | 'fantasy-city' | 'fantasy-city-ruins' | 'sci-fi-city-district' | 'post-epoc-ruins' | 'alien-ruins'
 * @param {number} opts.w - Width in cells
 * @param {number} opts.h - Height in cells
 * @param {boolean} [opts.addRiver=true] - Whether to add a river
 * @param {boolean} [opts.addBay=true] - Whether to add a bay
 * @returns {{ display, state }}
 */
export function generateArea(opts = {}) {
    const {
        seed = crypto.randomUUID(),
        template = 'fantasy-town',
        w = 60,
        h = 60,
        addRiver = true,
        addBay = true,
    } = opts;

    const width = Math.max(20, Math.min(256, w));
    const height = Math.max(20, Math.min(256, h));

    // Use the project's PRNG for consistency
    const prng = mulberry32(seed)

    // Start with a base land map
    let map = createBaseMap(width, height, ' ');

    const dirs = ['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW'];
    if (addRiver) {
        const dir = pick(prng, dirs);
        map = createRiver(map, dir, { seed: seedFromString(seed + '-rivers'), meander: 0.5, width: 1 });
    }
    //add roads 
    const nRoads = randInt(prng, 1, 2)
    const _dirs = pick(prng, [['N', 'S', 'E', 'W'], ['NE', 'NW', 'SE', 'SW']])
    map = createRoad(map, shuffle(prng, _dirs).slice(0, nRoads), { seed: seedFromString(seed + '-roads') })

    // Add water features (configurable)
    if (addBay) {
        const sides = ['N', 'S', 'E', 'W'];
        const side = pick(prng, sides);
        map = createBay(map, side, { seed: seedFromString(seed + '-bay'), depth: 0.3, width: 0.4 });
    }

    // Apply the template-specific generator
    let result;
    let districtName = '';

    const seedNum = seedFromString(seed + '-map');
    switch (template) {
        case 'fantasy-town': {
            result = createTown(map, { seed: seedNum, size: 0.45, walled: true, preferWater: true });
            districtName = 'Town';
            break;
        }

        case 'fantasy-city': {
            result = createCity(map, { seed: seedNum, size: 0.75, walled: true, preferWater: true });
            districtName = 'City';
            break;
        }

        case 'fantasy-city-ruins': {
            // Generate a city, then decay it
            result = createCity(map, { seed: seedNum, size: 0.75, walled: true, preferWater: true });
            result = createRuin(result, { seed: seedFromString(seed + '-ruination'), style: 'fantasy', damage: 0.55, overgrowth: 0.5 });
            districtName = 'Ruined City';
            break;
        }

        case 'sci-fi-city-district': {
            result = createDistrict(map, { seed: seedNum, size: 0.85, density: 0.75, elevated: true, preferWater: true });
            result = elevateAndGrid(result, { seed: seedFromString(seed + '-cyberroads') });
            districtName = 'District';
            break;
        }

        case 'post-epoc-ruins': {
            // Generate a town, then decay it into ruins
            result = createDistrict(map, { seed: seedNum, size: 0.85, density: 0.75, elevated: true, preferWater: true });
            result = createRuin(result, { seed: seedFromString(seed + '-ruination'), style: 'postapoc', damage: 0.85, overgrowth: 0.5 });
            districtName = 'Post-Apoc Ruins';
            break;
        }

        case 'alien-ruins': {
            // Generate a town-like structure, then alien-ify it
            result = createDistrict(map, { seed: seedNum, size: 0.85, density: 0.45, elevated: true, preferWater: true });
            result = createRuin(result, { seed: seedFromString(seed + '-ruination'), style: 'postapoc', damage: 0.85, overgrowth: 0.95 });
            // Replace buildings with alien glyphs
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    if (result[y][x] === '#') {
                        const r = randInt(prng, 1, 100);
                        if (r < 40) result[y][x] = '⌬';
                        else if (r < 70) result[y][x] = '⍓';
                        else result[y][x] = '⌖';
                    }
                    if (result[y][x] === '†' || result[y][x] === 'T' || result[y][x] === 'H') {
                        result[y][x] = '⌬';
                    }
                    if (result[y][x] === '&') {
                        result[y][x] = '⍓';
                    }
                }
            }
            districtName = 'Alien Ruins';
            break;
        }

        default:
            throw new Error(`Unknown area template: ${template}`);
    }

    // Convert result to 2D grid
    const grid = result;

    // Extract metadata for items panel
    const { landmarks, roads, gates, waterfront } = extractMetadata(grid, width, height);

    // Build district list (simplified — just the main district for now)
    const districts = [{ name: districtName, x: Math.floor(width / 2), y: Math.floor(height / 2), role: template }];

    const display = {
        cols: width,
        rows: height,
        grid,
        width,
        height,
    };

    const state = {
        template,
        seed,
        width,
        height,
        districts,
        landmarks,
        roads,
        gates,
        waterfront,
    };

    return { display, state };
}
