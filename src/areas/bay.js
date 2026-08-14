.0/**
 * Etch a procedural bay of water into one edge of an ASCII map.
 *
 * @param {string[] | string[][]} map - Rows of the map
 * @param {string} side - N, S, E or W (case-insensitive)
 * @param {object} [options]
 * @param {string} [options.waterChar='~'] - Character for water
 * @param {number} [options.depth=0.35] - How far inland the bay reaches (0–1 of map size)
 * @param {number} [options.width=0.55] - How wide the bay is along the edge (0–1 of map size)
 * @param {number} [options.irregularity=0.25] - Extra noise / jaggedness (0 = smooth, 1 = very rough)
 * @param {number} [options.seed] - Optional RNG seed
 * @returns {string[]} New map with the bay carved in
 */
export function createBay(map, side, options = {}) {
    const {
        waterChar = '~',
        depth = 0.35,
        width = 0.55,
        irregularity = 0.25,
        seed = null
    } = options;

    // --- seeded RNG (same as the river function) ---
    let rngState = seed != null ? seed : (Math.random() * 0xffffffff) >>> 0;
    function rand() {
        rngState |= 0;
        rngState = (rngState + 0x6d2b79f5) | 0;
        let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    function randRange(a, b) {
        return a + rand() * (b - a);
    }

    // Normalize map
    const height = map.length;
    if (height === 0) return map;
    const mapW = typeof map[0] === 'string' ? map[0].length : map[0].length;
    const grid = map.map(row =>
        typeof row === 'string' ? row.split('') : [...row]
    );

    side = side.toUpperCase().trim();
    if (!['N', 'S', 'E', 'W'].includes(side)) {
        throw new Error(`Side must be N, S, E or W (got "${side}")`);
    }

    // Clamp parameters
    const maxDepth = Math.max(2, Math.floor(
        (side === 'N' || side === 'S' ? height : mapW) * Math.min(0.9, Math.max(0.05, depth))
    ));
    const bayWidth = Math.max(3, Math.floor(
        (side === 'N' || side === 'S' ? mapW : height) * Math.min(0.95, Math.max(0.1, width))
    ));

    // Center of the bay along the edge (with a little randomness)
    let center;
    if (side === 'N' || side === 'S') {
        center = Math.floor(mapW / 2 + randRange(-mapW * 0.15, mapW * 0.15));
        center = Math.max(bayWidth / 2, Math.min(mapW - 1 - bayWidth / 2, center));
    } else {
        center = Math.floor(height / 2 + randRange(-height * 0.15, height * 0.15));
        center = Math.max(bayWidth / 2, Math.min(height - 1 - bayWidth / 2, center));
    }

    // Pre-compute a smooth + noisy depth profile across the bay width
    const half = bayWidth / 2;
    const profile = [];
    for (let i = 0; i < bayWidth; i++) {
        const t = (i - half) / half;                 // -1 … +1
        // Cosine falloff → classic rounded bay shape
        let d = Math.cos(t * Math.PI * 0.5);
        d = Math.max(0, d);

        // Add irregularity (Perlin-ish noise would be nicer, but this is pure JS)
        const noise = (rand() * 2 - 1) * irregularity;
        d = Math.max(0, Math.min(1, d + noise * (1 - Math.abs(t))));

        profile.push(Math.floor(d * maxDepth));
    }

    // Carve the bay
    if (side === 'N') {
        for (let i = 0; i < bayWidth; i++) {
            const x = Math.floor(center - half + i);
            if (x < 0 || x >= mapW) continue;
            const d = profile[i];
            for (let y = 0; y <= d; y++) {
                if (y < height) grid[y][x] = waterChar;
            }
            // Soften the sides a little more
            if (i > 0 && i < bayWidth - 1 && rand() < 0.4) {
                const extra = Math.floor(rand() * 2);
                for (let y = 0; y <= Math.min(d + extra, height - 1); y++) {
                    grid[y][x] = waterChar;
                }
            }
        }
    } else if (side === 'S') {
        for (let i = 0; i < bayWidth; i++) {
            const x = Math.floor(center - half + i);
            if (x < 0 || x >= mapW) continue;
            const d = profile[i];
            for (let y = 0; y <= d; y++) {
                const yy = height - 1 - y;
                if (yy >= 0) grid[yy][x] = waterChar;
            }
            if (i > 0 && i < bayWidth - 1 && rand() < 0.4) {
                const extra = Math.floor(rand() * 2);
                for (let y = 0; y <= Math.min(d + extra, height - 1); y++) {
                    const yy = height - 1 - y;
                    if (yy >= 0) grid[yy][x] = waterChar;
                }
            }
        }
    } else if (side === 'W') {
        for (let i = 0; i < bayWidth; i++) {
            const y = Math.floor(center - half + i);
            if (y < 0 || y >= height) continue;
            const d = profile[i];
            for (let x = 0; x <= d; x++) {
                if (x < mapW) grid[y][x] = waterChar;
            }
            if (i > 0 && i < bayWidth - 1 && rand() < 0.4) {
                const extra = Math.floor(rand() * 2);
                for (let x = 0; x <= Math.min(d + extra, mapW - 1); x++) {
                    grid[y][x] = waterChar;
                }
            }
        }
    } else { // E
        for (let i = 0; i < bayWidth; i++) {
            const y = Math.floor(center - half + i);
            if (y < 0 || y >= height) continue;
            const d = profile[i];
            for (let x = 0; x <= d; x++) {
                const xx = mapW - 1 - x;
                if (xx >= 0) grid[y][xx] = waterChar;
            }
            if (i > 0 && i < bayWidth - 1 && rand() < 0.4) {
                const extra = Math.floor(rand() * 2);
                for (let x = 0; x <= Math.min(d + extra, mapW - 1); x++) {
                    const xx = mapW - 1 - x;
                    if (xx >= 0) grid[y][xx] = waterChar;
                }
            }
        }
    }

    return grid;
}