/**
 * Generate a large multi-centre fantasy city.
 * Scale: 1 tile ≈ 100 m.
 *
 * Designed for maps roughly 50×50 and larger.
 * 60×60 → small city
 * 80×80 → proper fantasy city
 * 100×100+ → large capital
 * 
 * Char,Meaning
 * .,Plaza / open square
 * o,Central landmark / well
 * =,Major road / gate
 * -,Secondary street / alley
 * #,Dense urban fabric
 * n,Medium-density housing
 * h,Sparse / outer residential
 * †,Temple
 * T,Palace / keep / noble house
 * H,Civic building / town hall
 * M,Workshop / mill / industry
 * &,Shop / tavern / commercial
 * D,Dock / warehouse
 * █,City wall
 * ~,Water (preserved)
 * 
 * 
 * Uses multiple district centres, a real road network,
 * and density falloff from centres + roads.
 *
 * @param {string[] | string[][]} map
 * @param {object} [options]
 * @param {string}  [options.waterChar='~']
 * @param {number}  [options.size=0.75]       - Overall city footprint (0.5–0.95)
 * @param {boolean} [options.walled=true]     - Outer city wall
 * @param {boolean} [options.preferWater=true]
 * @param {number}  [options.seed]
 * @returns {string[]}
 */
export function createCity(map, options = {}) {
    const {
        waterChar = '~',
        size = 0.75,
        walled = true,
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
    function shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(rand() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    // ---------- normalize ----------
    const H = map.length;
    if (H === 0) return map;
    const W = typeof map[0] === 'string' ? map[0].length : map[0].length;
    const grid = map.map(row =>
        typeof row === 'string' ? row.split('') : [...row]
    );

    const inBounds = (x, y) => x >= 0 && x < W && y >= 0 && y < H;
    const isWater = (x, y) => inBounds(x, y) && grid[y][x] === waterChar;
    const isBlocked = (x, y) => !inBounds(x, y) || isWater(x, y);

    function set(x, y, ch, force = false) {
        if (!inBounds(x, y)) return false;
        if (!force && (grid[y][x] === waterChar || grid[y][x] === '█')) return false;
        grid[y][x] = ch;
        return true;
    }

    // ---------- 1. Find city bounding area & water ----------
    const margin = Math.max(3, Math.floor(Math.min(W, H) * 0.06));
    const cityW = Math.floor(W * size);
    const cityH = Math.floor(H * size);
    const originX = Math.floor((W - cityW) / 2);
    const originY = Math.floor((H - cityH) / 2);

    // Collect water-adjacent land tiles (for docks)
    const waterfront = [];
    if (preferWater) {
        for (let y = 1; y < H - 1; y++) {
            for (let x = 1; x < W - 1; x++) {
                if (isWater(x, y)) continue;
                let touches = false;
                for (let dy = -1; dy <= 1 && !touches; dy++)
                    for (let dx = -1; dx <= 1; dx++)
                        if (isWater(x + dx, y + dy)) touches = true;
                if (touches) waterfront.push({ x, y });
            }
        }
    }

    // ---------- 2. Place multiple district centres ----------
    const centres = [];

    // Helper to place a centre with minimum separation
    function addCentre(role, preferred, minSep = 8) {
        for (let attempt = 0; attempt < 60; attempt++) {
            let x, y;
            if (preferred && preferred.length && chance(0.7)) {
                const p = pick(preferred);
                x = p.x + randInt(-3, 3);
                y = p.y + randInt(-3, 3);
            } else {
                x = originX + randInt(margin, cityW - margin);
                y = originY + randInt(margin, cityH - margin);
            }
            if (isBlocked(x, y)) continue;

            let ok = true;
            for (const c of centres) {
                const d = Math.hypot(c.x - x, c.y - y);
                if (d < minSep) { ok = false; break; }
            }
            if (!ok) continue;

            centres.push({ x, y, role });
            return true;
        }
        return false;
    }

    // Core / Old Town (near geometric centre)
    addCentre('core', [{ x: originX + cityW / 2, y: originY + cityH / 2 }], 10);

    // Market
    addCentre('market', null, 9);

    // Temple quarter
    addCentre('temple', null, 9);

    // Noble / Castle
    addCentre('noble', null, 10);

    // Craft / Industrial
    addCentre('craft', null, 8);

    // Docks (prefer waterfront)
    if (waterfront.length > 10) {
        addCentre('docks', waterfront, 8);
    } else {
        addCentre('docks', null, 8);
    }

    // Extra residential centres
    addCentre('resA', null, 7);
    addCentre('resB', null, 7);
    if (cityW > 55 || cityH > 55) {
        addCentre('resC', null, 7);
    }

    // ---------- 3. Road network ----------
    // Major roads between every pair of important centres
    const important = centres.filter(c =>
        ['core', 'market', 'temple', 'noble', 'docks'].includes(c.role)
    );

    function carveRoad(x1, y1, x2, y2, major = true) {
        let x = x1, y = y1;
        const steps = Math.ceil(Math.hypot(x2 - x1, y2 - y1)) * 1.4;
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            // slight noise so roads are not perfectly straight
            const jitter = (rand() - 0.5) * 1.8;
            const px = Math.round(x1 + (x2 - x1) * t + jitter * (y2 - y1) / (Math.hypot(x2 - x1, y2 - y1) || 1));
            const py = Math.round(y1 + (y2 - y1) * t - jitter * (x2 - x1) / (Math.hypot(x2 - x1, y2 - y1) || 1));

            if (!inBounds(px, py) || isWater(px, py)) continue;

            const ch = major ? '=' : '-';
            set(px, py, ch);

            // widen major roads a little
            if (major && chance(0.4)) {
                set(px + 1, py, ch);
                set(px - 1, py, ch);
                set(px, py + 1, ch);
                set(px, py - 1, ch);
            }
        }
    }

    // Connect important centres
    for (let i = 0; i < important.length; i++) {
        for (let j = i + 1; j < important.length; j++) {
            if (chance(0.75)) {
                carveRoad(important[i].x, important[i].y,
                    important[j].x, important[j].y, true);
            }
        }
    }

    // Connect residential centres to nearest important centre
    for (const c of centres) {
        if (c.role.startsWith('res') || c.role === 'craft') {
            let best = null, bestD = Infinity;
            for (const i of important) {
                const d = Math.hypot(i.x - c.x, i.y - c.y);
                if (d < bestD) { bestD = d; best = i; }
            }
            if (best) carveRoad(c.x, c.y, best.x, best.y, false);
        }
    }

    // A few extra organic secondary roads
    for (let k = 0; k < 6; k++) {
        const a = pick(centres);
        const b = pick(centres);
        if (a !== b) carveRoad(a.x, a.y, b.x, b.y, false);
    }

    // ---------- 4. District growth + density falloff ----------
    // We paint a density field first, then decide building type from it
    const density = Array.from({ length: H }, () => new Float32Array(W));

    function addDensityBlob(cx, cy, strength, radius, falloff = 1.6) {
        const r2 = radius * radius;
        for (let y = Math.max(0, cy - radius - 2); y < Math.min(H, cy + radius + 3); y++) {
            for (let x = Math.max(0, cx - radius - 2); x < Math.min(W, cx + radius + 3); x++) {
                if (isWater(x, y)) continue;
                const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
                if (d2 > r2) continue;
                const t = 1 - Math.pow(Math.sqrt(d2) / radius, falloff);
                density[y][x] += strength * Math.max(0, t);
            }
        }
    }

    // Different strengths / sizes per role
    for (const c of centres) {
        switch (c.role) {
            case 'core':
                addDensityBlob(c.x, c.y, 1.4, 11, 1.4);
                break;
            case 'market':
                addDensityBlob(c.x, c.y, 1.2, 9, 1.5);
                break;
            case 'temple':
                addDensityBlob(c.x, c.y, 0.9, 8, 1.6);
                break;
            case 'noble':
                addDensityBlob(c.x, c.y, 0.7, 9, 1.7); // lower density, larger plots
                break;
            case 'craft':
                addDensityBlob(c.x, c.y, 1.1, 8, 1.5);
                break;
            case 'docks':
                addDensityBlob(c.x, c.y, 1.0, 7, 1.5);
                break;
            default: // residential
                addDensityBlob(c.x, c.y, 0.95, 10, 1.55);
        }
    }

    // Boost density along major roads
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            if (grid[y][x] === '=') {
                for (let dy = -2; dy <= 2; dy++)
                    for (let dx = -2; dx <= 2; dx++)
                        if (inBounds(x + dx, y + dy) && !isWater(x + dx, y + dy))
                            density[y + dy][x + dx] += 0.35 * (1 - Math.hypot(dx, dy) / 3);
            }
        }
    }

    // ---------- 5. Paint buildings from density ----------
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            if (isWater(x, y)) continue;
            if (grid[y][x] === '=' || grid[y][x] === '-') continue;

            const d = density[y][x];
            if (d < 0.18) continue; // countryside / empty

            // Decide tile type
            if (d > 1.15) {
                set(x, y, '#');               // dense urban core
            } else if (d > 0.75) {
                set(x, y, chance(0.85) ? '#' : 'n');
            } else if (d > 0.4) {
                set(x, y, chance(0.7) ? 'n' : 'h');
            } else {
                set(x, y, chance(0.45) ? 'h' : grid[y][x]); // sparse
            }
        }
    }

    // ---------- 6. Landmarks & special tiles ----------
    function placeNear(role, ch, count = 1) {
        const c = centres.find(c => c.role === role);
        if (!c) return;
        let placed = 0;
        for (let i = 0; i < 40 && placed < count; i++) {
            const x = c.x + randInt(-4, 4);
            const y = c.y + randInt(-4, 4);
            if (set(x, y, ch)) placed++;
        }
    }

    placeNear('core', 'o', 1);        // central plaza marker
    placeNear('core', 'H', 1);        // town hall / citadel
    placeNear('market', '&', 3);      // shops / inns
    placeNear('temple', '†', 2);
    placeNear('noble', 'T', 1);       // palace / keep
    placeNear('craft', 'M', 3);
    placeNear('docks', 'D', 4);       // warehouses / docks

    // Open up small plazas at centres
    for (const c of centres) {
        for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++)
                if (chance(0.7)) set(c.x + dx, c.y + dy, '.');
    }

    // ---------- 7. Outer wall (optional) ----------
    if (walled) {
        // Simple rectangular-ish wall with rounded corners + gates
        const wallMargin = Math.max(2, Math.floor(Math.min(cityW, cityH) * 0.04));
        const left = originX + wallMargin;
        const right = originX + cityW - wallMargin;
        const top = originY + wallMargin;
        const bottom = originY + cityH - wallMargin;

        // Horizontal walls
        for (let x = left; x <= right; x++) {
            set(x, top, '█', true);
            set(x, bottom, '█', true);
        }
        // Vertical walls
        for (let y = top; y <= bottom; y++) {
            set(left, y, '█', true);
            set(right, y, '█', true);
        }

        // Gates on the four sides (aligned roughly with roads)
        const gatePositions = [
            { x: Math.floor((left + right) / 2), y: top },
            { x: Math.floor((left + right) / 2), y: bottom },
            { x: left, y: Math.floor((top + bottom) / 2) },
            { x: right, y: Math.floor((top + bottom) / 2) }
        ];
        for (const g of gatePositions) {
            set(g.x, g.y, '=', true);
            set(g.x + 1, g.y, '=', true);
            set(g.x - 1, g.y, '=', true);
            set(g.x, g.y + 1, '=', true);
            set(g.x, g.y - 1, '=', true);
        }
    }

    // ---------- 8. Final cleanup ----------
    // Make sure major roads stay visible
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            if (grid[y][x] === '=' || grid[y][x] === '-') continue;
            // small chance to open alleys in dense areas
            if (grid[y][x] === '#' && chance(0.03)) set(x, y, '-');
        }
    }

    return grid;
}