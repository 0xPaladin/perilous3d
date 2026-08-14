/**
 * Generate one or more procedural roads across the map.
 * Scale: 1 tile ≈ 100 m  (a full highway fits in one tile)
 *
 * Roads behave like rivers: they run from one edge to the opposite edge.
 * When they cross water they act as bridges (they overwrite ~).
 *
 * @param {string[] | string[][]} map
 * @param {string | string[]} direction - "N","S","E","W","NE"... or an array of them
 * @param {object} [options]
 * @param {string}  [options.roadChar='=']     // major artery character
 * @param {number}  [options.meander=0.35]     // 0 = straight, 1 = very windy
 * @param {number}  [options.count=1]          // how many roads (ignored if direction is array)
 * @param {number}  [options.seed]
 * @returns {string[]}
 */
export function createRoad(map, direction, options = {}) {
    const {
        roadChar = '=',
        meander = 0.35,
        count = 1,
        seed = null
    } = options;

    // ---------- seeded RNG ----------
    let rngState = seed != null ? seed : (Math.random() * 0xffffffff) >>> 0;
    function rand() {
        rngState |= 0;
        rngState = (rngState + 0x6d2b79f5) | 0;
        let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    function randRange(a, b) { return a + rand() * (b - a); }
    function randInt(a, b) { return a + Math.floor(rand() * (b - a + 1)); }

    // ---------- normalize map ----------
    const H = map.length;
    if (H === 0) return map;
    const W = typeof map[0] === 'string' ? map[0].length : map[0].length;
    const grid = map.map(row =>
        typeof row === 'string' ? row.split('') : [...row]
    );

    const inBounds = (x, y) => x >= 0 && x < W && y >= 0 && y < H;

    // ---------- direction handling ----------
    const vectors = {
        N: { dx: 0, dy: -1 },
        S: { dx: 0, dy: 1 },
        E: { dx: 1, dy: 0 },
        W: { dx: -1, dy: 0 },
        NE: { dx: 1, dy: -1 },
        NW: { dx: -1, dy: -1 },
        SE: { dx: 1, dy: 1 },
        SW: { dx: -1, dy: 1 }
    };

    // Support single direction, array of directions, or count
    let dirs = [];
    if (Array.isArray(direction)) {
        dirs = direction.map(d => d.toUpperCase());
    } else if (typeof direction === 'string') {
        dirs = Array(count).fill(direction.toUpperCase());
    } else {
        // fallback – random cardinals
        const cardinals = ['N', 'S', 'E', 'W'];
        for (let i = 0; i < count; i++) dirs.push(cardinals[randInt(0, 3)]);
    }

    // ---------- core path generator (midpoint displacement) ----------
    function makePath(dir) {
        const vec = vectors[dir];
        if (!vec) throw new Error(`Unknown direction: ${dir}`);

        let startX, startY, endX, endY;

        // Choose start / end edges (same logic as the river)
        if (vec.dx === 0) {                     // pure N/S
            startX = Math.floor(rand() * W);
            endX = Math.floor(rand() * W);
            if (vec.dy < 0) { startY = H - 1; endY = 0; }
            else { startY = 0; endY = H - 1; }
        } else if (vec.dy === 0) {              // pure E/W
            startY = Math.floor(rand() * H);
            endY = Math.floor(rand() * H);
            if (vec.dx > 0) { startX = 0; endX = W - 1; }
            else { startX = W - 1; endX = 0; }
        } else {                                // diagonal
            // start near the "incoming" side(s), end near the opposite
            if (vec.dx > 0 && vec.dy < 0) {       // NE
                if (rand() < 0.5) { startX = 0; startY = randInt(Math.floor(H * 0.35), H - 1); }
                else { startY = H - 1; startX = randInt(0, Math.floor(W * 0.65)); }
                if (rand() < 0.5) { endX = W - 1; endY = randInt(0, Math.floor(H * 0.65)); }
                else { endY = 0; endX = randInt(Math.floor(W * 0.35), W - 1); }
            } else if (vec.dx < 0 && vec.dy < 0) { // NW
                if (rand() < 0.5) { startX = W - 1; startY = randInt(Math.floor(H * 0.35), H - 1); }
                else { startY = H - 1; startX = randInt(Math.floor(W * 0.35), W - 1); }
                if (rand() < 0.5) { endX = 0; endY = randInt(0, Math.floor(H * 0.65)); }
                else { endY = 0; endX = randInt(0, Math.floor(W * 0.65)); }
            } else if (vec.dx > 0 && vec.dy > 0) { // SE
                if (rand() < 0.5) { startX = 0; startY = randInt(0, Math.floor(H * 0.65)); }
                else { startY = 0; startX = randInt(0, Math.floor(W * 0.65)); }
                if (rand() < 0.5) { endX = W - 1; endY = randInt(Math.floor(H * 0.35), H - 1); }
                else { endY = H - 1; endX = randInt(Math.floor(W * 0.35), W - 1); }
            } else {                              // SW
                if (rand() < 0.5) { startX = W - 1; startY = randInt(0, Math.floor(H * 0.65)); }
                else { startY = 0; startX = randInt(Math.floor(W * 0.35), W - 1); }
                if (rand() < 0.5) { endX = 0; endY = randInt(Math.floor(H * 0.35), H - 1); }
                else { endY = H - 1; endX = randInt(0, Math.floor(W * 0.65)); }
            }
        }

        // Midpoint displacement
        function displace(points, depth) {
            if (depth <= 0) return points;
            const newPoints = [points[0]];
            for (let i = 0; i < points.length - 1; i++) {
                const a = points[i];
                const b = points[i + 1];
                const mx = (a.x + b.x) / 2;
                const my = (a.y + b.y) / 2;

                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const len = Math.hypot(dx, dy) || 1;
                const px = -dy / len;
                const py = dx / len;

                const strength = meander * (len * 0.32) * (1 / (depth + 1));
                const offset = (rand() * 2 - 1) * strength;

                newPoints.push({
                    x: mx + px * offset,
                    y: my + py * offset
                });
                newPoints.push(b);
            }
            return displace(newPoints, depth - 1);
        }

        const levels = Math.max(3, Math.floor(Math.log2(Math.max(W, H) / 5)));
        let path = displace([{ x: startX, y: startY }, { x: endX, y: endY }], levels);

        // Clamp
        path = path.map(p => ({
            x: Math.max(0, Math.min(W - 1, p.x)),
            y: Math.max(0, Math.min(H - 1, p.y))
        }));

        return path;
    }

    // ---------- rasterize a path (single-tile, overwrites everything including water) ----------
    function plotPath(path) {
        for (let i = 0; i < path.length - 1; i++) {
            const a = path[i];
            const b = path[i + 1];
            const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y)) + 1;
            for (let s = 0; s <= steps; s++) {
                const t = s / steps;
                const x = Math.round(a.x + (b.x - a.x) * t);
                const y = Math.round(a.y + (b.y - a.y) * t);
                if (inBounds(x, y)) {
                    grid[y][x] = roadChar;          // overwrites river → bridge
                }
            }
        }
    }

    // ---------- generate the requested roads ----------
    for (const dir of dirs) {
        const path = makePath(dir);
        plotPath(path);
    }

    return grid;
}

/**
 * Cyberpunk road post-process
 * - Turns all existing '=' into elevated '≡'
 * - Adds a sparse / patchy grid of new ground-level '='
 *
 * Call this after createRoad + createDistrict (or createCity)
 */
export function elevateAndGrid(map, options = {}) {
    const {
        block = 5,           // target grid spacing
        gapChance = 0.5,    // higher = more gaps / patchier
        seed = null
    } = options;

    // ---------- seeded RNG ----------
    let rngState = seed != null ? seed : (Math.random() * 0xffffffff) >>> 0;
    function rand() {
        rngState |= 0;
        rngState = (rngState + 0x6d2b79f5) | 0;
        let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    function chance(p) { return rand() < p; }

    // ---------- normalize ----------
    const H = map.length;
    if (H === 0) return map;
    const W = typeof map[0] === 'string' ? map[0].length : map[0].length;
    const grid = map.map(row =>
        typeof row === 'string' ? row.split('') : [...row]
    );

    const inBounds = (x, y) => x >= 0 && x < W && y >= 0 && y < H;

    // ---------- 1. Elevate existing major roads ----------
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            if (grid[y][x] === '=') {
                grid[y][x] = '≡';
            }
        }
    }

    // ---------- 2. Sparse / patchy ground-level grid of '=' ----------
    // Horizontal runs
    for (let y = 2; y < H - 2; y += block) {
        for (let x = 1; x < W - 1; x++) {
            // don't overwrite elevated highways, water, or solid walls
            if (grid[y][x] === '≡' || grid[y][x] === '~' || grid[y][x] === '█') {
                continue;
            }
            if (chance(gapChance) || grid[y][x] === ' ') {
                continue;
            }
            grid[y][x] = '=';
        }
    }

    // Vertical runs
    for (let x = 2; x < W - 2; x += block) {
        for (let y = 1; y < H - 1; y++) {
            if (grid[y][x] === '≡' || grid[y][x] === '~' || grid[y][x] === '█') {
                continue;
            }
            if (chance(gapChance) || grid[y][x] === ' ') {
                continue;
            }
            grid[y][x] = '=';
        }
    }

    return grid;
}