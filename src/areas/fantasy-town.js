/**
 * Generate a procedural fantasy-style town on an ASCII map.
 * Scale assumption: 1 tile ≈ 100 m (districts & major buildings, not individual houses).
 * 
 * size: 0.30 → small village
 * size: 0.45 → classic market town (default)
 * size: 0.60 → large town
 * 
 *  * Char,Meaning
 * .,Plaza / open square
 * o,Central landmark / well
 * =,Major road / gate
 * -,Secondary street / alley
 * #,Dense urban fabric
 * n,Sparser / poorer housing
 * †,Temple
 * T,Palace / keep / noble house
 * H,Civic building / town hall
 * M,Workshop / mill / industry
 * &,Shop / tavern / commercial
 * █,City wall
 * ~,Water (preserved)
 *
 * @param {string[] | string[][]} map - Existing map (can already contain river/bay)
 * @param {object} [options]
 * @param {string} [options.waterChar='~']
 * @param {number} [options.size=0.45]        - Town footprint as fraction of map (0.25–0.7)
 * @param {boolean} [options.walled=true]     - Add a wall with gates
 * @param {boolean} [options.preferWater=true]- Prefer placing near existing water
 * @param {number} [options.seed]
 * @returns {string[]} New map with the town etched in
 */
export function createTown(map, options = {}) {
    const {
        waterChar = '~',
        size = 0.45,
        walled = true,
        preferWater = true,
        seed = null
    } = options;

    // ---------- seeded RNG (same as river / bay) ----------
    let rngState = seed != null ? seed : (Math.random() * 0xffffffff) >>> 0;
    function rand() {
        rngState |= 0;
        rngState = (rngState + 0x6d2b79f5) | 0;
        let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    function randInt(a, b) { return a + Math.floor(rand() * (b - a + 1)); }
    function chance(p) { return rand() < p; }
    function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }

    // ---------- normalize map ----------
    const H = map.length;
    if (H === 0) return map;
    const W = typeof map[0] === 'string' ? map[0].length : map[0].length;
    const grid = map.map(row =>
        typeof row === 'string' ? row.split('') : [...row]
    );

    const isWater = (x, y) =>
        x >= 0 && x < W && y >= 0 && y < H && grid[y][x] === waterChar;
    const inBounds = (x, y) => x >= 0 && x < W && y >= 0 && y < H;
    const isOpen = (x, y) =>
        inBounds(x, y) && grid[y][x] !== waterChar && grid[y][x] !== '#';

    // ---------- find a good town centre ----------
    let cx, cy;
    const candidates = [];

    // Prefer tiles near water
    if (preferWater) {
        for (let y = 2; y < H - 2; y++) {
            for (let x = 2; x < W - 2; x++) {
                if (isWater(x, y)) continue;
                let nearWater = 0;
                for (let dy = -3; dy <= 3; dy++)
                    for (let dx = -3; dx <= 3; dx++)
                        if (isWater(x + dx, y + dy)) nearWater++;
                if (nearWater > 0) {
                    candidates.push({ x, y, score: nearWater + rand() * 3 });
                }
            }
        }
    }

    // Fallback / additional central candidates
    const midX = Math.floor(W / 2);
    const midY = Math.floor(H / 2);
    for (let i = 0; i < 40; i++) {
        const x = midX + randInt(-Math.floor(W * 0.3), Math.floor(W * 0.3));
        const y = midY + randInt(-Math.floor(H * 0.3), Math.floor(H * 0.3));
        if (inBounds(x, y) && !isWater(x, y)) {
            candidates.push({ x, y, score: 5 + rand() * 5 });
        }
    }

    if (candidates.length === 0) {
        cx = midX; cy = midY;
    } else {
        candidates.sort((a, b) => b.score - a.score);
        const best = candidates[randInt(0, Math.min(8, candidates.length - 1))];
        cx = best.x; cy = best.y;
    }

    // ---------- town radius ----------
    const radius = Math.max(4, Math.floor(Math.min(W, H) * size * 0.5));

    // ---------- helper: place a tile if possible ----------
    function set(x, y, ch, force = false) {
        if (!inBounds(x, y)) return false;
        if (!force && (grid[y][x] === waterChar || grid[y][x] === '█')) return false;
        grid[y][x] = ch;
        return true;
    }

    // ---------- 1. Main roads (cross + diagonals toward edges / water) ----------
    const roadDirs = [
        { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
        { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
        { dx: 1, dy: 1 }, { dx: 1, dy: -1 },
        { dx: -1, dy: 1 }, { dx: -1, dy: -1 }
    ];

    function carveRoad(dx, dy, maxLen) {
        let x = cx, y = cy;
        for (let i = 0; i < maxLen; i++) {
            x += dx; y += dy;
            if (!inBounds(x, y) || isWater(x, y)) break;
            set(x, y, '=');
            // occasionally widen
            if (chance(0.25)) {
                if (dx === 0) { set(x - 1, y, '='); set(x + 1, y, '='); }
                else if (dy === 0) { set(x, y - 1, '='); set(x, y + 1, '='); }
            }
        }
    }

    // Primary cross
    carveRoad(1, 0, radius + 3);
    carveRoad(-1, 0, radius + 3);
    carveRoad(0, 1, radius + 3);
    carveRoad(0, -1, radius + 3);

    // A couple of secondary roads
    for (let i = 0; i < 3; i++) {
        const d = pick(roadDirs);
        carveRoad(d.dx, d.dy, randInt(radius - 2, radius + 2));
    }

    // ---------- 2. Central plaza ----------
    for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++)
            set(cx + dx, cy + dy, '.');
    set(cx, cy, 'o'); // well / fountain

    // ---------- 3. Key landmarks ----------
    function placeLandmark(ch, preferredDirs, minDist = 2, maxDist = 5) {
        for (let attempt = 0; attempt < 30; attempt++) {
            const dir = pick(preferredDirs);
            const dist = randInt(minDist, maxDist);
            const x = cx + dir.dx * dist + randInt(-1, 1);
            const y = cy + dir.dy * dist + randInt(-1, 1);
            if (set(x, y, ch)) return { x, y };
        }
        return null;
    }

    const cardinals = [
        { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
        { dx: 0, dy: 1 }, { dx: 0, dy: -1 }
    ];

    placeLandmark('†', cardinals, 3, 6);           // temple
    placeLandmark('T', cardinals, 4, 7);           // keep / manor (or tower)
    placeLandmark('M', [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }], 3, 6); // smith / mill
    placeLandmark('&', cardinals, 2, 4);           // tavern / inn
    placeLandmark('H', cardinals, 3, 5);           // guildhall / town hall

    // ---------- 4. Housing districts (blob growth) ----------
    function growDistrict(centerX, centerY, char, targetCount, density = 0.65) {
        const queue = [{ x: centerX, y: centerY }];
        const visited = new Set();
        let placed = 0;

        while (queue.length && placed < targetCount) {
            const idx = randInt(0, queue.length - 1);
            const { x, y } = queue.splice(idx, 1)[0];
            const key = `${x},${y}`;
            if (visited.has(key)) continue;
            visited.add(key);

            if (!inBounds(x, y) || isWater(x, y)) continue;
            if (grid[y][x] === '=' || grid[y][x] === '.' || grid[y][x] === 'o') continue;
            if (grid[y][x] === '†' || grid[y][x] === 'T' || grid[y][x] === 'M' ||
                grid[y][x] === '&' || grid[y][x] === 'H') continue;

            if (chance(density)) {
                set(x, y, char);
                placed++;
            }

            // neighbours
            for (const d of [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }]) {
                const nx = x + d.dx, ny = y + d.dy;
                if (inBounds(nx, ny) && !visited.has(`${nx},${ny}`)) {
                    queue.push({ x: nx, y: ny });
                }
            }
        }
    }

    // Dense housing around centre
    growDistrict(cx, cy, '#', Math.floor(radius * radius * 0.55), 0.75);

    // A bit of poorer / sparser housing further out
    growDistrict(cx + randInt(-2, 2), cy + randInt(-2, 2), 'n', Math.floor(radius * 1.8), 0.45);

    // ---------- 5. Optional wall ----------
    if (walled) {
        const wallR = radius + 1;
        const gates = [];

        for (let a = 0; a < 360; a += 3) {
            const rad = (a * Math.PI) / 180;
            const x = Math.round(cx + Math.cos(rad) * wallR);
            const y = Math.round(cy + Math.sin(rad) * wallR);
            if (inBounds(x, y) && !isWater(x, y)) {
                set(x, y, '█', true);
            }
        }

        // Punch gates on the main road axes
        const gateOffsets = [
            { dx: wallR, dy: 0 }, { dx: -wallR, dy: 0 },
            { dx: 0, dy: wallR }, { dx: 0, dy: -wallR }
        ];
        for (const g of gateOffsets) {
            const gx = cx + g.dx;
            const gy = cy + g.dy;
            if (inBounds(gx, gy)) {
                set(gx, gy, '=', true);
                // clear a little around the gate
                set(gx + (g.dx ? 0 : 1), gy + (g.dy ? 0 : 1), '=', true);
                set(gx + (g.dx ? 0 : -1), gy + (g.dy ? 0 : -1), '=', true);
                gates.push({ x: gx, y: gy });
            }
        }
    }

    // ---------- 6. Final polish ----------
    // Make sure the very centre plaza stays open
    for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++)
            if (inBounds(cx + dx, cy + dy) && grid[cy + dy][cx + dx] !== waterChar)
                grid[cy + dy][cx + dx] = (dx === 0 && dy === 0) ? 'o' : '.';

    // Scatter a few extra flavour tiles
    for (let i = 0; i < 8; i++) {
        const x = cx + randInt(-radius, radius);
        const y = cy + randInt(-radius, radius);
        if (isOpen(x, y) && grid[y][x] === '#') {
            if (chance(0.3)) set(x, y, '&'); // extra taverns / shops
        }
    }

    return grid;
}