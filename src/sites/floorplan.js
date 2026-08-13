import { mulberry32 } from '../core/prng.js';

export function floorPlan(seed, mapWidth, mapHeight, options = {}) {
    // ============================================================
    // Seeded random number generator
    // ============================================================

    const random = mulberry32(seed);

    function randInt(min, max) {
        if (max <= min) {
            return min;
        }

        return Math.floor(
            random() * (max - min + 1)
        ) + min;
    }

    function pick(array) {
        return array[
            Math.floor(random() * array.length)
        ];
    }

    function shuffle(array) {
        // Loop from the last element down to the second
        for (let i = array.length - 1; i > 0; i--) {
            // Pick a random index from 0 to i
            const j = Math.floor(random() * (i + 1));

            // Swap elements using destructuring assignment
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    // ============================================================
    // Grid
    // ============================================================
    const rB = {
        min: () => [randInt(5, 15), randInt(40, 60)],
        max: () => [randInt(40, 60), randInt(85, 95)],
        c: () => [randInt(20, 35), randInt(65, 80)]
    }
    const randRect = {
        TL: () => {
            const [x1, x2] = rB.min().map(val => Math.floor(mapWidth * val / 100));
            const [y1, y2] = rB.min().map(val => Math.floor(mapHeight * val / 100));
            return [x1, y1, x2, y2];
        },
        TR: () => {
            const [x1, x2] = rB.max().map(val => Math.floor(mapWidth * val / 100));
            const [y1, y2] = rB.min().map(val => Math.floor(mapHeight * val / 100));
            return [x1, y1, x2, y2];
        },
        BR: () => {
            const [x1, x2] = rB.max().map(val => Math.floor(mapWidth * val / 100));
            const [y1, y2] = rB.max().map(val => Math.floor(mapHeight * val / 100));
            return [x1, y1, x2, y2];
        },
        BL: () => {
            const [x1, x2] = rB.min().map(val => Math.floor(mapWidth * val / 100));
            const [y1, y2] = rB.max().map(val => Math.floor(mapHeight * val / 100));
            return [x1, y1, x2, y2];
        },
        C: () => {
            const [x1, x2] = rB.c().map(val => Math.floor(val * mapWidth / 100));
            const [y1, y2] = rB.c().map(val => Math.floor(val * mapHeight / 100));
            return [x1, y1, x2, y2];
        }
    }

    const list = shuffle(['TL', 'TR', 'BR', 'BL']).slice(0, randInt(1, 3));
    const stairRooms = list.length > 1 ? list.slice(0, 2) : [list[0], 'C']
    const footprint = [...list.map((rect, i) => randRect[rect]()), randRect.C()];

    //random stairs
    const stairFunctions = {
        'TL': ['getLeft', 'getTop'],
        'TR': ['getRight', 'getTop'],
        'BR': ['getRight', 'getBottom'],
        'BL': ['getLeft', 'getBottom'],
        'C': [],
    };
    //randomly pick along a wall
    const stairs = stairRooms.map(id => {
        if (id === 'C') {
            const rl = pick(['getRight', 'getLeft']);
            const tb = stairRooms[0].includes('T') ? 'getBottom' : 'getTop';
            return [rl, tb]
        }
        const [fx, fy] = stairFunctions[id];
        const sx = pick([fx, 'getCenter']);
        //don't allow two getCenters
        return [sx, pick([fy, sx === 'getCenter' ? fy : 'getCenter'])];
    });

    return {
        rooms: footprint,
        doors: [],
        walls: [],
        stairs,
    };
}