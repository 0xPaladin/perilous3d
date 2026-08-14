/**
 * Generate a cyberpunk / sci-fi city district.
 * Scale: 1 tile ≈ 100 m.
 *
 * 40×40 → small district
 * 60×60 → solid district
 * 80×80+ → large district or multi-district slice
 * 
 * Ultra-packed (Shibuya / Midtown / Pudong style)
 * createDistrict(map, { density: 0.92, size: 0.9, elevated: true, seed: 42 });
 * 
 * Classic dense cyberpunk
 * createDistrict(map, { density: 0.75, size: 0.85, elevated: true });
 * 
 * Medium / mixed
 * createDistrict(map, { density: 0.55, size: 0.8 });
 * 
 * Sprawling (parts of Mexico City, Delhi, older Boston-style)
 * createDistrict(map, { density: 0.28, size: 0.88, elevated: false });
 * 
 * Char,Meaning
 * .,Plaza / open space / rooftop garden
 * =,Major avenue
 * -,Ordinary street
 * ≡,Elevated highway / monorail
 * #,Dense high-rise fabric
 * A,Arcology / mega-tower
 * C,Corporate tower / HQ
 * N,Neon commercial / entertainment
 * T,Transit hub / station
 * R,Residential high-rise
 * r,Mid / low-rise residential
 * S,Lower city / slum / underlevel
 * I,Industrial / utilities / logistics
 * ~,Water (preserved)
 * 
 * @param {string[] | string[][]} map
 * @param {object} [options]
 * @param {string}  [options.waterChar='~']
 * @param {number}  [options.size=0.85]          // 0.6–0.95 of the map
 * @param {number}  [options.density=0.75]       // 0.0 = sprawling → 1.0 = ultra-packed
 * @param {boolean} [options.elevated=true]      // elevated highways / monorail
 * @param {boolean} [options.preferWater=true]
 * @param {number}  [options.seed]
 * @returns {string[]}
 */
export function createDistrict(map, options = {}) {
    const {
        waterChar = '~',
        roadChars = ['=', '-'],
        size = 0.85,
        density = 0.75,          // 0 = sprawling → 1 = ultra-packed
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
    const isBlocked = (x, y) => isWater(x, y) || isRoad(x, y);

    function set(x, y, ch, force = false) {
        if (!inBounds(x, y)) return false;
        if (!force && isBlocked(x, y)) return false;
        grid[y][x] = ch;
        return true;
    }

    // ---------- collect existing infrastructure ----------
    const roadTiles = [];
    const waterTiles = [];
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            if (isRoad(x, y)) roadTiles.push({ x, y });
            if (isWater(x, y)) waterTiles.push({ x, y });
        }
    }

    // ---------- organic district shape ----------
    const cx = Math.floor(W / 2) + randInt(-Math.floor(W * 0.08), Math.floor(W * 0.08));
    const cy = Math.floor(H / 2) + randInt(-Math.floor(H * 0.08), Math.floor(H * 0.08));
    const baseRadius = Math.floor(Math.min(W, H) * size * 0.48);

    function edgeNoise(x, y) {
        const n1 = Math.sin(x * 0.13 + y * 0.17 + rngState) * 4.5;
        const n2 = Math.sin(x * 0.07 - y * 0.11 + 12.3) * 3.2;
        return n1 + n2;
    }

    function insideDistrict(x, y) {
        const dist = Math.hypot(x - cx, y - cy);
        const noisyRadius = baseRadius + edgeNoise(x, y);
        return dist < noisyRadius;
    }

    // ---------- scoring helper ----------
    function scoreLocation(x, y) {
        let score = rand() * 1.5;

        if (preferRoad && roadTiles.length) {
            let minD = Infinity;
            const step = Math.max(1, Math.floor(roadTiles.length / 70));
            for (let i = 0; i < roadTiles.length; i += step) {
                const d = Math.hypot(roadTiles[i].x - x, roadTiles[i].y - y);
                if (d < minD) minD = d;
            }
            if (minD < 13) score += (13 - minD) * 2.2;
        }

        if (preferWater && waterTiles.length) {
            let minD = Infinity;
            const step = Math.max(1, Math.floor(waterTiles.length / 50));
            for (let i = 0; i < waterTiles.length; i += step) {
                const d = Math.hypot(waterTiles[i].x - x, waterTiles[i].y - y);
                if (d < minD) minD = d;
            }
            if (minD < 10) score += (10 - minD) * 1.7;
        }

        // mild preference for being deeper inside the district
        const distC = Math.hypot(x - cx, y - cy);
        score += Math.max(0, 5 - distC * 0.09);

        return score;
    }

    // ---------- anchors (biased toward roads / water) ----------
    const anchors = [];

    function placeAnchor(role, minSep = 7) {
        const candidates = [];

        for (let attempt = 0; attempt < 65; attempt++) {
            let x = cx + randInt(-baseRadius + 5, baseRadius - 5);
            let y = cy + randInt(-baseRadius + 5, baseRadius - 5);

            // strong bias toward existing roads
            if (preferRoad && roadTiles.length && chance(0.6)) {
                const r = pick(roadTiles);
                x = r.x + randInt(-4, 4);
                y = r.y + randInt(-4, 4);
            } else if (preferWater && waterTiles.length && chance(0.35)) {
                const w = pick(waterTiles);
                x = w.x + randInt(-3, 3);
                y = w.y + randInt(-3, 3);
            }

            if (!inBounds(x, y) || isBlocked(x, y) || !insideDistrict(x, y)) continue;

            let tooClose = false;
            for (const a of anchors) {
                if (Math.hypot(a.x - x, a.y - y) < minSep) {
                    tooClose = true;
                    break;
                }
            }
            if (tooClose) continue;

            candidates.push({ x, y, score: scoreLocation(x, y) });
        }

        if (candidates.length === 0) {
            anchors.push({ x: cx, y: cy, role });
            return;
        }

        candidates.sort((a, b) => b.score - a.score);
        const best = candidates[randInt(0, Math.min(4, candidates.length - 1))];
        anchors.push({ x: best.x, y: best.y, role });
    }

    placeAnchor('core', 8);
    placeAnchor('corp', 7);
    placeAnchor('transit', 7);
    placeAnchor('commercial', 7);
    if (density > 0.4) placeAnchor('arcology', 7);
    if (density > 0.25) placeAnchor('entertainment', 6);
    placeAnchor('residential', 6);
    placeAnchor('residential', 6);
    if (density < 0.65) placeAnchor('residential', 6);
    placeAnchor('industrial', 7);   // will naturally prefer waterfront when present

    // ---------- density field ----------
    const dens = Array.from({ length: H }, () => new Float32Array(W));

    function addBlob(bx, by, strength, radius, power = 1.55) {
        const r = Math.ceil(radius);
        const y0 = Math.max(0, Math.floor(by - r - 1));
        const y1 = Math.min(H, Math.ceil(by + r + 2));
        const x0 = Math.max(0, Math.floor(bx - r - 1));
        const x1 = Math.min(W, Math.ceil(bx + r + 2));

        for (let y = y0; y < y1; y++) {
            for (let x = x0; x < x1; x++) {
                if (isBlocked(x, y) || !insideDistrict(x, y)) continue;
                const dist = Math.hypot(x - bx, y - by);
                if (dist > radius) continue;
                dens[y][x] += strength * Math.pow(1 - dist / radius, power);
            }
        }
    }

    // Base density inside the organic shape
    const base = 0.24 + density * 0.2;
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            if (insideDistrict(x, y) && !isBlocked(x, y)) {
                dens[y][x] += base;
            }
        }
    }

    // Density from anchors
    for (const a of anchors) {
        let strength, radius, power;
        switch (a.role) {
            case 'core':
            case 'arcology':
                strength = 1.5 + density * 0.4;
                radius = 8 + density * 4;
                power = 1.35;
                break;
            case 'corp':
                strength = 1.3 + density * 0.3;
                radius = 7 + density * 3.2;
                power = 1.4;
                break;
            case 'commercial':
            case 'entertainment':
                strength = 1.15 + density * 0.28;
                radius = 6.5 + density * 2.8;
                power = 1.45;
                break;
            case 'transit':
                strength = 1.0;
                radius = 5.5 + density * 1.8;
                power = 1.5;
                break;
            case 'residential':
                strength = 0.85 + density * 0.22;
                radius = 8 + (1 - density) * 4.5;
                power = 1.6;
                break;
            case 'industrial':
                strength = 0.9;
                radius = 6.5;
                power = 1.55;
                break;
            default:
                strength = 0.75;
                radius = 6;
                power = 1.6;
        }
        addBlob(a.x, a.y, strength, radius, power);
    }

    // Strong extra density along existing roads
    for (const r of roadTiles) {
        addBlob(r.x, r.y, 0.7, 4.0, 1.55);
    }

    // Waterfront density
    for (const w of waterTiles) {
        addBlob(w.x, w.y, 0.55, 3.5, 1.65);
    }

    // ---------- paint buildings ----------
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            if (!insideDistrict(x, y) || isBlocked(x, y)) continue;

            const d = dens[y][x];
            if (d < 0.18) continue;

            if (d > 1.3) {
                set(x, y, chance(0.18) ? 'A' : '#');
            } else if (d > 0.9) {
                const r = rand();
                if (r < 0.1) set(x, y, 'C');
                else if (r < 0.19) set(x, y, 'N');
                else set(x, y, '#');
            } else if (d > 0.5) {
                const r = rand();
                if (r < 0.12) set(x, y, 'N');
                else if (r < 0.48) set(x, y, 'R');
                else set(x, y, '#');
            } else if (d > 0.28) {
                const r = rand();
                if (r < 0.55) set(x, y, 'r');
                else if (r < 0.72) set(x, y, 'S');
                else set(x, y, chance(0.35) ? 'I' : 'r');
            } else {
                if (chance(0.4)) set(x, y, chance(0.4) ? 'S' : 'r');
            }
        }
    }

    // ---------- final fill (safety net for any remaining empty tiles) ----------
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            if (!insideDistrict(x, y) || isBlocked(x, y)) continue;
            const ch = grid[y][x];
            if (ch === '.' || ch === 'A' || ch === 'C' || ch === 'N' || ch === 'T' ||
                ch === 'R' || ch === 'r' || ch === 'S' || ch === 'I' || ch === '#') continue;

            const d = dens[y][x];
            if (d > 0.7) set(x, y, chance(0.15) ? 'N' : '#');
            else if (d > 0.4) set(x, y, chance(0.5) ? 'R' : 'r');
            else set(x, y, chance(0.45) ? 'r' : 'S');
        }
    }

    // ---------- landmarks ----------
    function stamp(role, ch, count = 1, rad = 2) {
        for (const a of anchors.filter(a => a.role === role)) {
            let placed = 0;
            for (let i = 0; i < 20 && placed < count; i++) {
                const x = a.x + randInt(-rad, rad);
                const y = a.y + randInt(-rad, rad);
                if (set(x, y, ch)) placed++;
            }
        }
    }

    stamp('core', 'A', 2, 2);
    stamp('corp', 'C', 2, 2);
    stamp('transit', 'T', 1, 1);
    stamp('commercial', 'N', 3, 2);
    stamp('entertainment', 'N', 2, 2);
    stamp('industrial', 'I', 3, 2);
    stamp('residential', 'R', 1, 2);

    // Small plazas at anchors
    for (const a of anchors) {
        for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++)
                if (chance(0.5) && insideDistrict(a.x + dx, a.y + dy))
                    set(a.x + dx, a.y + dy, '.');
    }

    return grid;
}