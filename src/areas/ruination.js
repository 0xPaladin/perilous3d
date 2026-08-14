/**
 * Turn a town / city / district into ruins.
 * Works on both fantasy and cyberpunk maps.
 *
 * Char,Meaning (fantasy),Meaning (post-apoc)
 * %,Crumbling wall / ruin,Ruined shell / burnt-out
 * *,Rubble / debris,Debris / scrap
 * x,—,Wreckage / vehicle hulk
 * ",",Weeds / moss / grass,Light debris / ash
 * .,Clear ground,Clear ground
 * 
 * @param {string[] | string[][]} map
 * @param {object} [options]
 * @param {string}  [options.style='fantasy']  // 'fantasy' | 'postapoc' | 'mixed'
 * @param {number}  [options.damage=0.55]      // 0 = light damage, 1 = almost total destruction
 * @param {number}  [options.overgrowth=0.4]   // vegetation / debris amount
 * @param {number}  [options.seed]
 * @returns {string[]}
 */
export function createRuin(map, options = {}) {
    const {
        style = 'fantasy',       // 'fantasy' | 'postapoc' | 'mixed'
        damage = 0.55,
        overgrowth = 0.4,
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
    function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }

    // ---------- normalize ----------
    const H = map.length;
    if (H === 0) return map;
    const W = typeof map[0] === 'string' ? map[0].length : map[0].length;
    const grid = map.map(row =>
        typeof row === 'string' ? row.split('') : [...row]
    );

    const inBounds = (x, y) => x >= 0 && x < W && y >= 0 && y < H;

    // Character sets by style
    const isFantasy = style === 'fantasy' || style === 'mixed';
    const isPostapoc = style === 'postapoc' || style === 'mixed';

    // What counts as a "building"
    const buildingChars = new Set([
        '#', 'n', 'h', 'R', 'r', 'A', 'C', 'N', 'S', 'I', 'T', 'H', 'M', '&', 'D'
    ]);

    // What counts as a road
    const roadChars = new Set(['=', '-', '≡']);

    // ---------- pass 1: damage structures ----------
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const ch = grid[y][x];

            // --- Buildings ---
            if (buildingChars.has(ch)) {
                const roll = rand();

                if (roll < damage * 0.45) {
                    // Completely collapsed / cleared
                    if (isPostapoc && chance(0.5)) {
                        grid[y][x] = chance(0.4) ? '%' : '*';   // wreckage or debris
                    } else if (isFantasy) {
                        grid[y][x] = chance(0.55) ? ',' : '.'; // weeds or open
                    } else {
                        grid[y][x] = '.';
                    }
                } else if (roll < damage * 0.85) {
                    // Damaged but still standing
                    if (isPostapoc) {
                        grid[y][x] = chance(0.6) ? '%' : 'x';  // ruined shell / wreck
                    } else {
                        grid[y][x] = chance(0.7) ? '%' : '#';  // crumbling wall / partial
                    }
                }
                // else: left intact
            }

            // --- Roads ---
            else if (roadChars.has(ch)) {
                if (chance(damage * 0.55)) {
                    // Cracked or missing section
                    if (isPostapoc) {
                        grid[y][x] = chance(0.5) ? '*' : (chance(0.4) ? '%' : '.');
                    } else {
                        grid[y][x] = chance(0.6) ? ',' : '.';
                    }
                }
                // else keep the road (or elevated highway)
            }

            // --- Walls ---
            else if (ch === '█') {
                if (chance(damage * 0.7)) {
                    grid[y][x] = chance(0.5) ? '%' : (isFantasy ? ',' : '*');
                }
            }

            // --- Plazas / open ---
            else if (ch === '.' || ch === 'o') {
                if (chance(overgrowth * 0.5)) {
                    grid[y][x] = isFantasy ? ',' : '*';
                }
            }
        }
    }

    // ---------- pass 2: overgrowth / debris scatter ----------
    const debrisChars = isPostapoc
        ? ['*', '%', 'x', ',', '.']
        : [',', '.', '*', '%'];

    for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
            const ch = grid[y][x];

            // Don't overwrite water or remaining solid roads too aggressively
            if (ch === '~' || ch === '≡') continue;

            // Scatter extra debris / weeds
            if (chance(overgrowth * 0.22)) {
                // Prefer to place near already damaged tiles
                let nearDamage = false;
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        const n = grid[y + dy][x + dx];
                        if (n === '%' || n === '*' || n === 'x' || n === ',') {
                            nearDamage = true;
                            break;
                        }
                    }
                    if (nearDamage) break;
                }

                if (nearDamage || chance(0.35)) {
                    grid[y][x] = pick(debrisChars);
                }
            }
        }
    }

    // ---------- pass 3: occasional larger collapse clusters ----------
    const clusters = Math.floor((W * H) * 0.0007 * (0.6 + damage));
    for (let i = 0; i < clusters; i++) {
        const cx = 2 + Math.floor(rand() * (W - 4));
        const cy = 2 + Math.floor(rand() * (H - 4));
        const rad = 1 + Math.floor(rand() * 2.5);

        for (let dy = -rad; dy <= rad; dy++) {
            for (let dx = -rad; dx <= rad; dx++) {
                if (Math.hypot(dx, dy) > rad + 0.3) continue;
                const x = cx + dx;
                const y = cy + dy;
                if (!inBounds(x, y)) continue;
                if (grid[y][x] === '~' || grid[y][x] === '≡') continue;

                if (chance(0.7)) {
                    grid[y][x] = isPostapoc
                        ? pick(['%', '*', 'x', '.'])
                        : pick(['%', ',', '*', '.']);
                }
            }
        }
    }

    // ---------- pass 4: light final cleanup / flavour ----------
    // Fantasy: a bit more vegetation on the edges of rubble
    if (isFantasy) {
        for (let y = 1; y < H - 1; y++) {
            for (let x = 1; x < W - 1; x++) {
                if (grid[y][x] === '%' || grid[y][x] === '*') {
                    if (chance(0.18)) {
                        // adjacent weed
                        const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]];
                        const [dx, dy] = pick(dirs);
                        const nx = x + dx, ny = y + dy;
                        if (inBounds(nx, ny) && (grid[ny][nx] === '.' || grid[ny][nx] === ',')) {
                            grid[ny][nx] = ',';
                        }
                    }
                }
            }
        }
    }

    // Post-apoc: occasional intact "survivor" pockets
    if (isPostapoc && chance(0.6)) {
        const sx = 3 + Math.floor(rand() * (W - 6));
        const sy = 3 + Math.floor(rand() * (H - 6));
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const x = sx + dx, y = sy + dy;
                if (inBounds(x, y) && grid[y][x] !== '~') {
                    grid[y][x] = chance(0.5) ? '#' : 'R';
                }
            }
        }
    }

    return grid;
}