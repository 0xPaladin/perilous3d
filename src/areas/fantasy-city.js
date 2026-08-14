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
 * P,Palace / keep / noble house
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
        roadChars = ['=', '-'],
        size = 0.75,
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

    // ---------- city bounds (soft) ----------
    const margin = Math.max(3, Math.floor(Math.min(W, H) * 0.05));
    const cityW = Math.floor(W * size);
    const cityH = Math.floor(H * size);
    const originX = Math.floor((W - cityW) / 2);
    const originY = Math.floor((H - cityH) / 2);

    // ---------- helper: score a location ----------
    function scoreLocation(x, y) {
        let score = rand() * 1.5;

        if (preferRoad && roadTiles.length) {
            let minD = Infinity;
            // sample a subset for speed on large maps
            const step = Math.max(1, Math.floor(roadTiles.length / 80));
            for (let i = 0; i < roadTiles.length; i += step) {
                const d = Math.hypot(roadTiles[i].x - x, roadTiles[i].y - y);
                if (d < minD) minD = d;
            }
            if (minD < 14) score += (14 - minD) * 2.1;
        }

        if (preferWater && waterTiles.length) {
            let minD = Infinity;
            const step = Math.max(1, Math.floor(waterTiles.length / 60));
            for (let i = 0; i < waterTiles.length; i += step) {
                const d = Math.hypot(waterTiles[i].x - x, waterTiles[i].y - y);
                if (d < minD) minD = d;
            }
            if (minD < 11) score += (11 - minD) * 1.6;
        }

        // mild central bias
        const distC = Math.hypot(x - W / 2, y - H / 2);
        score += Math.max(0, 6 - distC * 0.08);

        return score;
    }

    // ---------- place multiple district centres ----------
    const centres = [];

    function addCentre(role, minSep = 9) {
        const candidates = [];

        // Prefer locations near roads / water
        for (let attempt = 0; attempt < 70; attempt++) {
            let x = originX + randInt(margin, cityW - margin);
            let y = originY + randInt(margin, cityH - margin);

            // occasional strong bias toward a road tile
            if (preferRoad && roadTiles.length && chance(0.55)) {
                const r = pick(roadTiles);
                x = r.x + randInt(-5, 5);
                y = r.y + randInt(-5, 5);
            } else if (preferWater && waterTiles.length && chance(0.35)) {
                const w = pick(waterTiles);
                x = w.x + randInt(-4, 4);
                y = w.y + randInt(-4, 4);
            }

            if (!inBounds(x, y) || isBlocked(x, y)) continue;

            let tooClose = false;
            for (const c of centres) {
                if (Math.hypot(c.x - x, c.y - y) < minSep) {
                    tooClose = true;
                    break;
                }
            }
            if (tooClose) continue;

            candidates.push({ x, y, score: scoreLocation(x, y) });
        }

        if (candidates.length === 0) {
            // fallback near geometric centre
            const x = Math.floor(W / 2) + randInt(-6, 6);
            const y = Math.floor(H / 2) + randInt(-6, 6);
            centres.push({ x, y, role });
            return;
        }

        candidates.sort((a, b) => b.score - a.score);
        const best = candidates[randInt(0, Math.min(5, candidates.length - 1))];
        centres.push({ x: best.x, y: best.y, role });
    }

    // Core set of centres
    addCentre('core', 11);
    addCentre('market', 9);
    addCentre('temple', 9);
    addCentre('noble', 10);
    addCentre('craft', 8);
    addCentre('docks', 8);          // will naturally prefer water if present
    addCentre('resA', 8);
    addCentre('resB', 8);
    if (cityW > 55 || cityH > 55) addCentre('resC', 8);

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
                if (isBlocked(x, y)) continue;
                const dist = Math.hypot(x - bx, y - by);
                if (dist > radius) continue;
                dens[y][x] += strength * Math.pow(1 - dist / radius, power);
            }
        }
    }

    // Density from each centre
    for (const c of centres) {
        let strength, radius, power;
        switch (c.role) {
            case 'core':
                strength = 1.45; radius = 11; power = 1.4; break;
            case 'market':
                strength = 1.25; radius = 9; power = 1.5; break;
            case 'temple':
                strength = 0.95; radius = 8; power = 1.55; break;
            case 'noble':
                strength = 0.75; radius = 9; power = 1.65; break; // lower density
            case 'craft':
                strength = 1.15; radius = 8; power = 1.5; break;
            case 'docks':
                strength = 1.05; radius = 7; power = 1.5; break;
            default: // residential
                strength = 0.95; radius = 10; power = 1.55;
        }
        addBlob(c.x, c.y, strength, radius, power);
    }

    // Strong extra density along existing roads
    for (const r of roadTiles) {
        chance(.1) ? addBlob(r.x, r.y, 0.65, 4.2, 1.6) : null;
    }

    // Waterfront density
    for (const w of waterTiles) {
        chance(.25) ? addBlob(w.x, w.y, 0.5, 3.6, 1.7) : null;
    }

    // ---------- paint buildings ----------
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            if (isBlocked(x, y)) continue;

            const d = dens[y][x];
            if (d < 0.2) continue;

            if (d > 1.25) {
                set(x, y, '#');
            } else if (d > 0.8) {
                set(x, y, chance(0.82) ? '#' : 'n');
            } else if (d > 0.45) {
                set(x, y, chance(0.7) ? 'n' : 'h');
            } else {
                if (chance(0.4)) set(x, y, 'h');
            }
        }
    }

    // ---------- landmarks ----------
    function placeNear(role, ch, count = 1, rad = 3) {
        const list = centres.filter(c => c.role === role);
        for (const c of list) {
            let placed = 0;
            for (let i = 0; i < 30 && placed < count; i++) {
                const x = c.x + randInt(-rad, rad);
                const y = c.y + randInt(-rad, rad);
                if (set(x, y, ch)) placed++;
            }
        }
    }

    placeNear('core', 'o', 1);     // central marker
    placeNear('core', 'H', 1);     // civic
    placeNear('market', '&', 3);
    placeNear('temple', '†', 2);
    placeNear('noble', 'P', 1);
    placeNear('craft', 'M', 3);
    placeNear('docks', 'D', 3);    // warehouses / docks

    // Small plazas at centres
    for (const c of centres) {
        for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++)
                if (chance(0.65)) set(c.x + dx, c.y + dy, '.');
    }

    return grid;
}