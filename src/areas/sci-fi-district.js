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
        size = 0.85,
        density = 0.75,          // 0 = sprawling, 1 = packed
        elevated = true,
        preferWater = true,
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

    function set(x, y, ch, force = false) {
        if (!inBounds(x, y)) return false;
        if (!force && grid[y][x] === waterChar) return false;
        grid[y][x] = ch;
        return true;
    }

    // ---------- district bounds ----------
    const margin = Math.max(2, Math.floor(Math.min(W, H) * 0.04));
    const dW = Math.floor(W * size);
    const dH = Math.floor(H * size);
    const ox = Math.floor((W - dW) / 2);
    const oy = Math.floor((H - dH) / 2);

    // ---------- density helpers ----------
    const dens = Array.from({ length: H }, () => new Float32Array(W));

    function addBlob(cx, cy, strength, radius, power = 1.55) {
        const r2 = radius * radius;
        for (let y = Math.max(0, cy - radius - 1); y < Math.min(H, cy + radius + 2); y++) {
            for (let x = Math.max(0, cx - radius - 1); x < Math.min(W, cx + radius + 2); x++) {
                if (isWater(x, y)) continue;
                const dist = Math.hypot(x - cx, y - cy);
                if (dist > radius) continue;
                const t = Math.pow(1 - dist / radius, power);
                dens[y][x] += strength * t;
            }
        }
    }

    // ---------- 1. Key anchors (multi-centre) ----------
    const anchors = [];

    function placeAnchor(role, preferWF = false) {
        for (let attempt = 0; attempt < 50; attempt++) {
            let x = ox + randInt(margin, dW - margin);
            let y = oy + randInt(margin, dH - margin);

            // bias toward waterfront for docks / industrial
            if (preferWF && preferWater) {
                // simple bias: push toward nearest map edge that might have water
                if (chance(0.5)) x = randInt(2, Math.floor(W * 0.25));
                else if (chance(0.5)) x = randInt(Math.floor(W * 0.75), W - 3);
            }

            if (isWater(x, y)) continue;

            let tooClose = false;
            for (const a of anchors) {
                if (Math.hypot(a.x - x, a.y - y) < 7) { tooClose = true; break; }
            }
            if (tooClose) continue;

            anchors.push({ x, y, role });
            return { x, y };
        }
        // fallback
        const x = ox + Math.floor(dW / 2) + randInt(-5, 5);
        const y = oy + Math.floor(dH / 2) + randInt(-5, 5);
        anchors.push({ x, y, role });
        return { x, y };
    }

    // Always present
    const core = placeAnchor('core');
    const corp = placeAnchor('corp');
    const transit = placeAnchor('transit');
    const commercial = placeAnchor('commercial');

    // Conditional / density-dependent
    if (density > 0.45) placeAnchor('arcology');
    if (density > 0.3) placeAnchor('entertainment');
    placeAnchor('residential');
    placeAnchor('residential');
    if (density < 0.7) placeAnchor('residential'); // extra in sprawling

    if (preferWater) placeAnchor('industrial', true);
    else placeAnchor('industrial');

    // ---------- 2. Road / highway network ----------
    // More grid-like when density is high, more organic when low
    const gridness = 0.25 + density * 0.6;

    function carveAvenue(x1, y1, x2, y2, major = true) {
        const dist = Math.hypot(x2 - x1, y2 - y1);
        const steps = Math.ceil(dist * 1.35);
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            let px = x1 + (x2 - x1) * t;
            let py = y1 + (y2 - y1) * t;

            // jitter (less when gridness is high)
            const jitter = (1 - gridness) * (rand() - 0.5) * 2.2;
            const dx = x2 - x1, dy = y2 - y1;
            const len = Math.hypot(dx, dy) || 1;
            px += -dy / len * jitter;
            py += dx / len * jitter;

            px = Math.round(px);
            py = Math.round(py);
            if (!inBounds(px, py) || isWater(px, py)) continue;

            const ch = major ? '=' : '-';
            set(px, py, ch);

            // widen major avenues
            if (major) {
                if (chance(0.55)) set(px + 1, py, ch);
                if (chance(0.55)) set(px - 1, py, ch);
                if (chance(0.35)) set(px, py + 1, ch);
                if (chance(0.35)) set(px, py - 1, ch);
            }
        }
    }

    // Connect major anchors
    const majorAnchors = anchors.filter(a =>
        ['core', 'corp', 'transit', 'commercial', 'arcology'].includes(a.role)
    );

    for (let i = 0; i < majorAnchors.length; i++) {
        for (let j = i + 1; j < majorAnchors.length; j++) {
            if (chance(0.8)) {
                carveAvenue(majorAnchors[i].x, majorAnchors[i].y,
                    majorAnchors[j].x, majorAnchors[j].y, true);
            }
        }
    }

    // Secondary connections
    for (const a of anchors) {
        if (['residential', 'industrial', 'entertainment'].includes(a.role)) {
            const target = pick(majorAnchors);
            carveAvenue(a.x, a.y, target.x, target.y, false);
        }
    }

    // Extra organic or grid streets
    const extraCount = Math.floor(8 + density * 14);
    for (let i = 0; i < extraCount; i++) {
        const a = pick(anchors);
        const b = pick(anchors);
        if (a !== b) carveAvenue(a.x, a.y, b.x, b.y, chance(0.3));
    }

    // Elevated highways (cyberpunk flavour)
    if (elevated && density > 0.35) {
        // a couple of long elevated runs
        for (let k = 0; k < 2 + Math.floor(density * 2); k++) {
            const horizontal = chance(0.5);
            if (horizontal) {
                const y = oy + randInt(Math.floor(dH * 0.2), Math.floor(dH * 0.8));
                for (let x = ox + 2; x < ox + dW - 2; x++) {
                    if (!isWater(x, y) && chance(0.92)) set(x, y, '≡');
                }
            } else {
                const x = ox + randInt(Math.floor(dW * 0.2), Math.floor(dW * 0.8));
                for (let y = oy + 2; y < oy + dH - 2; y++) {
                    if (!isWater(x, y) && chance(0.92)) set(x, y, '≡');
                }
            }
        }
    }

    // ---------- 3. Density field ----------
    for (const a of anchors) {
        let strength, radius, power;
        switch (a.role) {
            case 'core':
            case 'arcology':
                strength = 1.6 + density * 0.5;
                radius = 9 + density * 5;
                power = 1.35;
                break;
            case 'corp':
                strength = 1.4 + density * 0.4;
                radius = 8 + density * 4;
                power = 1.4;
                break;
            case 'commercial':
            case 'entertainment':
                strength = 1.25 + density * 0.35;
                radius = 7 + density * 3.5;
                power = 1.45;
                break;
            case 'transit':
                strength = 1.1;
                radius = 6 + density * 2;
                power = 1.5;
                break;
            case 'residential':
                strength = 0.9 + density * 0.3;
                radius = 9 + (1 - density) * 4; // larger spread when sprawling
                power = 1.6;
                break;
            case 'industrial':
                strength = 0.95;
                radius = 7;
                power = 1.55;
                break;
            default:
                strength = 0.8;
                radius = 7;
                power = 1.6;
        }
        addBlob(a.x, a.y, strength, radius, power);
    }

    // Strong boost along avenues
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            if (grid[y][x] === '=' || grid[y][x] === '≡') {
                for (let dy = -2; dy <= 2; dy++) {
                    for (let dx = -2; dx <= 2; dx++) {
                        const nx = x + dx, ny = y + dy;
                        if (inBounds(nx, ny) && !isWater(nx, ny)) {
                            dens[ny][nx] += 0.45 * (1 - Math.hypot(dx, dy) / 3.2);
                        }
                    }
                }
            }
        }
    }

    // ---------- 4. Paint the district ----------
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            if (isWater(x, y)) continue;
            if (grid[y][x] === '=' || grid[y][x] === '-' || grid[y][x] === '≡') continue;

            const d = dens[y][x];
            if (d < 0.15) continue; // empty / periphery

            // Ultra dense core
            if (d > 1.35) {
                set(x, y, chance(0.18) ? 'A' : '#');          // arcology fabric or dense towers
            }
            // High density
            else if (d > 0.95) {
                const r = rand();
                if (r < 0.12) set(x, y, 'C');                 // corporate
                else if (r < 0.22) set(x, y, 'N');            // neon commercial
                else set(x, y, '#');
            }
            // Medium
            else if (d > 0.55) {
                const r = rand();
                if (r < 0.15) set(x, y, 'N');
                else if (r < 0.55) set(x, y, 'R');            // residential high-rise
                else set(x, y, '#');
            }
            // Lower / sprawling
            else if (d > 0.28) {
                const r = rand();
                if (r < 0.6) set(x, y, 'r');                  // mid/low residential
                else if (r < 0.75) set(x, y, 'S');            // lower city / slum
                else set(x, y, chance(0.3) ? 'I' : 'r');
            }
            // Fringe
            else {
                if (chance(0.35)) set(x, y, chance(0.4) ? 'S' : 'r');
            }
        }
    }

    // ---------- 5. Special landmarks ----------
    function stamp(role, ch, count = 1, rad = 3) {
        const list = anchors.filter(a => a.role === role);
        for (const a of list) {
            let placed = 0;
            for (let i = 0; i < 25 && placed < count; i++) {
                const x = a.x + randInt(-rad, rad);
                const y = a.y + randInt(-rad, rad);
                if (set(x, y, ch)) placed++;
            }
        }
    }

    stamp('core', 'A', 2, 2);          // mega arcologies
    stamp('corp', 'C', 3, 3);
    stamp('transit', '⛏', 1, 2);
    stamp('commercial', 'N', 4, 3);
    stamp('entertainment', 'N', 3, 3);
    stamp('industrial', 'I', 4, 3);
    stamp('residential', 'R', 2, 2);

    // Small plazas / open spaces at anchors
    for (const a of anchors) {
        for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++)
                if (chance(0.55)) set(a.x + dx, a.y + dy, '.');
    }

    // ---------- 6. Final cyberpunk polish ----------
    // Sprinkle extra neon and lower-city pockets
    for (let i = 0; i < 30 + density * 40; i++) {
        const x = ox + randInt(0, dW);
        const y = oy + randInt(0, dH);
        if (!inBounds(x, y) || isWater(x, y)) continue;
        if (grid[y][x] === '#') {
            if (chance(0.08)) set(x, y, 'N');
            if (chance(0.04)) set(x, y, 'S');
        }
    }

    // Tiny parks / rooftop gardens (rarer in high density)
    const parkChance = 0.012 * (1.2 - density);
    for (let y = oy; y < oy + dH; y++) {
        for (let x = ox; x < ox + dW; x++) {
            if (grid[y][x] === '#' || grid[y][x] === 'R') {
                if (chance(parkChance)) set(x, y, '.');
            }
        }
    }

    return grid;
}