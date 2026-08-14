/**
 * Generate a procedural fantasy-style town on an ASCII map.
 * Scale assumption: 1 tile ≈ 100 m (districts & major buildings, not individual houses).
 * 
 * Pipeline: river? → road(s) → bay? → town
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
 * K, keep / noble house
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
        roadChars = ['=', '-'],   // characters that count as roads
        size = 0.45,
        walled = true,
        preferWater = true,
        preferRoad = true,
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
    function randInt(a, b) { return a + Math.floor(rand() * (b - a + 1)); }
    function chance(p) { return rand() < p; }
    function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }

    // ---------- normalize ----------
    const H = map.length;
    if (H === 0) return map;
    const W = typeof map[0] === 'string' ? map[0].length : map[0].length;
    const grid = map.map(row =>
        typeof row === 'string' ? row.split('') : [...row]
    );

    const inBounds = (x, y) => x >= 0 && x < W && y >= 0 && y < H;
    const isWater = (x, y) => inBounds(x, y) && grid[y][x] === waterChar;
    const isRoad = (x, y) => inBounds(x, y) && roadChars.includes(grid[y][x]);
    const isBlocked = (x, y) => isWater(x, y) || isRoad(x, y); // never overwrite these

    function set(x, y, ch, force = false) {
        if (!inBounds(x, y)) return false;
        if (!force && isBlocked(x, y)) return false;
        grid[y][x] = ch;
        return true;
    }

    // ---------- collect existing roads & water for scoring ----------
    const roadTiles = [];
    const waterTiles = [];
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            if (isRoad(x, y)) roadTiles.push({ x, y });
            if (isWater(x, y)) waterTiles.push({ x, y });
        }
    }

    // ---------- find a good town centre ----------
    // Score candidates by proximity to roads and water
    const candidates = [];
    const margin = 3;

    for (let y = margin; y < H - margin; y++) {
        for (let x = margin; x < W - margin; x++) {
            if (isBlocked(x, y)) continue;

            let score = rand() * 2; // small random jitter

            // Prefer near roads
            if (preferRoad && roadTiles.length) {
                let minRoad = Infinity;
                for (const r of roadTiles) {
                    const d = Math.hypot(r.x - x, r.y - y);
                    if (d < minRoad) minRoad = d;
                }
                if (minRoad < 12) score += (12 - minRoad) * 1.8;
            }

            // Prefer near water
            if (preferWater && waterTiles.length) {
                let minWater = Infinity;
                for (const w of waterTiles) {
                    const d = Math.hypot(w.x - x, w.y - y);
                    if (d < minWater) minWater = d;
                }
                if (minWater < 10) score += (10 - minWater) * 1.4;
            }

            // Mild preference for more central locations
            const distCentre = Math.hypot(x - W / 2, y - H / 2);
            score += Math.max(0, 8 - distCentre * 0.15);

            candidates.push({ x, y, score });
        }
    }

    // Pick one of the better candidates
    candidates.sort((a, b) => b.score - a.score);
    const top = candidates.slice(0, Math.max(8, Math.floor(candidates.length * 0.08)));
    const chosen = top.length ? pick(top) : { x: Math.floor(W / 2), y: Math.floor(H / 2) };
    const cx = chosen.x;
    const cy = chosen.y;

    // ---------- town radius ----------
    const radius = Math.max(5, Math.floor(Math.min(W, H) * size * 0.5));

    // ---------- density field that favours roads & rivers ----------
    const dens = Array.from({ length: H }, () => new Float32Array(W));

    function addBlob(bx, by, strength, rad, power = 1.5) {
        const r = Math.ceil(rad);
        const y0 = Math.max(0, Math.floor(by - r - 1));
        const y1 = Math.min(H, Math.ceil(by + r + 2));
        const x0 = Math.max(0, Math.floor(bx - r - 1));
        const x1 = Math.min(W, Math.ceil(bx + r + 2));

        for (let y = y0; y < y1; y++) {
            for (let x = x0; x < x1; x++) {
                if (isBlocked(x, y)) continue;
                const dist = Math.hypot(x - bx, y - by);
                if (dist > rad) continue;
                dens[y][x] += strength * Math.pow(1 - dist / rad, power);
            }
        }
    }

    // Base density around the centre
    addBlob(cx, cy, 1.1, radius * 0.9, 1.45);

    // Strong extra density along existing roads
    for (const r of roadTiles) {
        chance(.05) ? addBlob(r.x, r.y, 0.7, 4.5, 1.6) : null;
    }

    // Extra density along water (waterfront development)
    for (const w of waterTiles) {
        chance(.15) ? addBlob(w.x, w.y, 0.55, 3.8, 1.7) : null;
    }

    // ---------- 1. Central plaza ----------
    for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++)
            set(cx + dx, cy + dy, '.');
    set(cx, cy, 'o'); // well / fountain

    // ---------- 2. Key landmarks (biased toward roads when possible) ----------
    function placeLandmark(ch, maxAttempts = 35) {
        for (let i = 0; i < maxAttempts; i++) {
            // Prefer spots near roads
            let x, y;
            if (preferRoad && roadTiles.length && chance(0.6)) {
                const r = pick(roadTiles);
                x = r.x + randInt(-3, 3);
                y = r.y + randInt(-3, 3);
            } else {
                const angle = rand() * Math.PI * 2;
                const dist = randInt(2, Math.floor(radius * 0.75));
                x = Math.round(cx + Math.cos(angle) * dist);
                y = Math.round(cy + Math.sin(angle) * dist);
            }
            if (set(x, y, ch)) return { x, y };
        }
        return null;
    }

    placeLandmark('†');   // temple
    placeLandmark('K');   // keep / manor
    placeLandmark('M');   // smith / mill
    placeLandmark('&');   // tavern
    placeLandmark('H');   // guildhall / town hall

    // ---------- 3. Housing from density field ----------
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            if (isBlocked(x, y)) continue;
            if (grid[y][x] === '.' || grid[y][x] === 'o') continue;
            if (['†', 'P', 'M', '&', 'H'].includes(grid[y][x])) continue;

            const d = dens[y][x];
            if (d < 0.22) continue;

            if (d > 1.1) {
                set(x, y, '#');                     // dense core
            } else if (d > 0.65) {
                set(x, y, chance(0.8) ? '#' : 'n');
            } else if (d > 0.35) {
                set(x, y, chance(0.65) ? 'n' : 'h');
            } else {
                if (chance(0.4)) set(x, y, 'h');
            }
        }
    }

    // ---------- 5. Final polish ----------
    // Make sure plaza stays clear
    for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++)
            if (inBounds(cx + dx, cy + dy) && !isWater(cx + dx, cy + dy) && !isRoad(cx + dx, cy + dy))
                grid[cy + dy][cx + dx] = (dx === 0 && dy === 0) ? 'o' : '.';

    // Scatter a few extra flavour buildings near roads
    for (let i = 0; i < 7; i++) {
        if (!roadTiles.length) break;
        const r = pick(roadTiles);
        const x = r.x + randInt(-2, 2);
        const y = r.y + randInt(-2, 2);
        if (chance(0.4)) set(x, y, '&');
    }

    return grid;
}