import { seedFromString } from '../core/prng.js';
import { floorPlan } from './floorplan.js';
import { generateFillFloorPlan } from './fill-floorplan.js';
import { Room } from './room.js';

/**
 * Site generation — produces a 2D grid of cell-type codes for ASCII rendering.
 *
 * generateSite(opts) -> { display, state }
 *
 * display = { cols, rows, grid, width, height, walls }
 *   grid: 2D array [row][col] of cell-type codes (0=wall, 1=floor, 2=door, 3=stairs)
 *   walls: Array<[x1,y1,x2,y2]> — wall line segments (used for organic floorplan rendering)
 *
 * state = { template, floors, currentFloor, rooms, doors, stairs, walls, width, height }
 *   rooms: Array of cell ID strings "x,y" for organic, or [x1,y1,x2,y2] for rectangular
 *   doors: Array<[x,y]>
 *   stairs: Array<[x,y]>
 *   walls: Array<[x1,y1,x2,y2]> — wall line segments
 */

// Cell type codes
export const CELL = {
    WALL: 0,
    FLOOR: 1,
    DOOR: 2,
    STAIRS: 3,
    EMPTY: 4,
};

// Glyphs for ROT.js rendering
export const SITE_GLYPHS = {
    [CELL.WALL]: { ch: '#', color: '#888888', bg: '#222222' },
    [CELL.FLOOR]: { ch: '.', color: '#aaaaaa', bg: '#333333' },
    [CELL.DOOR]: { ch: '+', color: '#d4a76a', bg: '#333333' },
    [CELL.STAIRS]: { ch: '>', color: '#ffff00', bg: '#333333' },
    [CELL.EMPTY]: { ch: ' ', color: '#888888', bg: '#222222' },
};

/**
 * Convert rectangular rooms to a 2D grid.
 * @param {Array} rooms - Array of [x1,y1,x2,y2]
 * @param {Array} doors - Array of [x,y]
 * @param {Array} stairs - Array of [x,y]
 * @param {number} width
 * @param {number} height
 * @returns {Array<Array<number>>} 2D grid of cell codes
 */
function rectRoomsToGrid(rooms, doors, stairs, width, height, isFloorplan = false) {
    // Initialize grid as all walls
    const grid = Array.from({ length: height }, () => new Array(width).fill(isFloorplan ? CELL.EMPTY : CELL.WALL));

    // Fill rooms with floor
    for (const coords of rooms) {
        const room = new Room(...coords);
        room.create((x, y, val) => {
            val === 0 ? grid[y][x] = CELL.FLOOR : null;
        })
    }

    // Place doors
    for (const [x, y] of doors) {
        if (x >= 0 && x < width && y >= 0 && y < height) {
            grid[y][x] = CELL.DOOR;
        }
    }

    // Place stairs (overrides doors if overlapping)
    for (const [x, y] of stairs) {
        if (x >= 0 && x < width && y >= 0 && y < height) {
            grid[y][x] = CELL.STAIRS;
        }
    }

    return grid;
}

/**
 * Generate a cellular automata map (for bandit-camp, lair).
 * @param {string} seed
 * @param {number} width
 * @param {number} height
 * @returns {Array<Array<number>>} 2D grid
 */
function generateCellularMap(seed, width, height) {
    ROT.RNG.setSeed(seedFromString(seed));
    const map = new ROT.Map.Cellular(width, height);

    // Start with ~50% wall probability
    map.randomize(0.5);

    // Run several generations to smooth
    for (let i = 0; i < 5; i++) map.create();

    // Connect all non-wall sections
    map.connect(null, 1);

    // Convert ROT's internal map to our grid
    const grid = Array.from({ length: height }, () => new Array(width).fill(CELL.EMPTY));
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            // ROT.Map.Cellular uses 1 for wall, 0 for floor - but going to flip it to feel more enclosed
            const val = map._map[x][y];
            grid[y][x] = val === 1 ? CELL.FLOOR : CELL.EMPTY;
        }
    }

    return grid;
}

/**
 * Generate a digger-based dungeon (for dungeon template).
 * @param {string} seed
 * @param {number} width
 * @param {number} height
 * @returns {{ grid: Array<Array<number>>, rooms: Array, doors: Array }}
 */
function generateDiggerMap(seed, width, height) {
    ROT.RNG.setSeed(seedFromString(seed));
    const map = new ROT.Map.Digger(width, height).create();

    // Build grid from digger
    const grid = Array.from({ length: height }, () => new Array(width).fill(CELL.EMPTY));
    const rooms = [];
    const doors = [];

    // Get rooms from the digger
    const diggerRooms = map.getRooms();
    for (const room of diggerRooms) {
        const left = room.getLeft();
        const top = room.getTop();
        const right = room.getRight();
        const bottom = room.getBottom();
        rooms.push([left, top, right, bottom]);

        // Fill room area with floor
        room.create((x, y, val) => {
            val === 0 ? grid[y][x] = CELL.FLOOR : null;
        });

        // Get doors
        room.getDoors((x, y) => {
            doors.push([x, y]);
            grid[y][x] = CELL.DOOR;
        });
    }

    // Get corridors from the digger
    const corridors = map.getCorridors();
    for (const corridor of corridors) {
        corridor.create((x, y) => {
            if (x >= 0 && x < width && y >= 0 && y < height) {
                grid[y][x] = CELL.FLOOR;
            }
        });
    }

    return { grid, rooms, doors };
}

/**
 * Main site generation entry point.
 * @param {Object} opts
 * @param {string} opts.seed - Seed string
 * @param {string} opts.template - 'hideout' | 'bandit-camp' | 'lair' | 'warehouse' | 'dungeon'
 * @param {number} opts.w - Width in cells
 * @param {number} opts.h - Height in cells
 * @param {number} opts.floors - Number of floors
 * @returns {{ display, state }}
 */
export function generateSite(opts = {}) {
    const {
        seed = crypto.randomUUID(),
        template = 'hideout',
        w = 40,
        h = 30,
        floors = 1,
    } = opts;

    const width = Math.max(10, Math.min(256, w));
    const height = Math.max(10, Math.min(256, h));
    const numFloors = Math.max(1, Math.min(10, floors));

    let grid, rooms, doors, stairs, walls;

    switch (template) {
        case 'hideout': {
            // Use organic floorplan (random walk on unit grid)
            // Output: { rooms: string[], doors: [x,y][], walls: [x1,y1,x2,y2][] }
            const floor = floorPlan(seed, width, height, { roomCount: 15 });
            rooms = floor.rooms;
            doors = floor.doors;
            stairs = floor.stairs || [];
            walls = floor.walls || [];
            grid = rectRoomsToGrid(rooms, doors, stairs, width, height, true);
            break;
        }

        case 'bandit-camp':
        case 'lair': {
            // Cellular automata
            grid = generateCellularMap(seed, width, height);
            rooms = [];
            doors = [];
            stairs = [];
            walls = [];
            break;
        }

        case 'warehouse': {
            // Fill floor plan — completely fills the shape with rooms
            const layout = generateFillFloorPlan(seed, { w: w - 1, h: h - 1 });
            rooms = layout.rooms;
            doors = layout.doors;
            stairs = [];
            walls = [];
            grid = rectRoomsToGrid(rooms, doors, stairs, width, height);
            break;
        }

        case 'dungeon': {
            // Digger-based dungeon
            const result = generateDiggerMap(seed, width, height);
            grid = result.grid;
            rooms = result.rooms;
            doors = result.doors;
            stairs = [];
            walls = [];
            break;
        }

        default:
            throw new Error(`Unknown site template: ${template}`);
    }

    const display = {
        cols: width,
        rows: height,
        grid,
        width,
        height,
        walls,
    };

    const state = {
        template,
        seed,
        floors: numFloors,
        currentFloor: 0,
        rooms: rooms || [],
        doors: doors || [],
        stairs: stairs || [],
        walls: walls || [],
        width,
        height,
    };

    return { display, state };
}