/**
 * Generate a procedural river across an ASCII map from one edge to the opposite.
 *
 * @param {string[] | string[][]} map - Rows of the map (array of strings or 2D char array)
 * @param {string} direction - One of: N, S, E, W, NE, NW, SE, SW (case-insensitive)
 * @param {object} [options]
 * @param {string} [options.waterChar='~'] - Character used for the river
 * @param {number} [options.meander=0.45] - How much the river wanders (0 = almost straight, 1 = very twisty)
 * @param {number} [options.width=1] - River thickness in tiles (1 = single tile)
 * @param {number} [options.seed] - Optional RNG seed for reproducibility
 * @returns {string[]} New map with the river carved in
 */
export function createRiver(map, direction, options = {}) {
    const {
        waterChar = '~',
        meander = 0.45,
        width = 1,
        seed = null
    } = options;

    // --- simple seeded RNG (mulberry32) ---
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

    // Normalize map → 2D char array
    const height = map.length;
    if (height === 0) return map;
    const widthMap = typeof map[0] === 'string' ? map[0].length : map[0].length;
    const grid = map.map(row =>
        typeof row === 'string' ? row.split('') : [...row]
    );

    direction = direction.toUpperCase().trim();

    // Preferred direction vector
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
    const vec = vectors[direction];
    if (!vec) throw new Error(`Unknown direction: ${direction}`);

    // Choose start & end points on appropriate edges
    let startX, startY, endX, endY;

    if (vec.dx === 0) {                     // pure N/S
        startX = Math.floor(rand() * widthMap);
        endX = Math.floor(rand() * widthMap);
        if (vec.dy < 0) { startY = height - 1; endY = 0; }
        else { startY = 0; endY = height - 1; }
    } else if (vec.dy === 0) {              // pure E/W
        startY = Math.floor(rand() * height);
        endY = Math.floor(rand() * height);
        if (vec.dx > 0) { startX = 0; endX = widthMap - 1; }
        else { startX = widthMap - 1; endX = 0; }
    } else {                                // diagonal
        // Start near the "incoming" corner, end near the opposite corner
        // with some randomness along the two possible edges
        if (vec.dx > 0 && vec.dy < 0) {       // NE
            if (rand() < 0.5) { startX = 0; startY = Math.floor(randRange(height * 0.4, height)); }
            else { startY = height - 1; startX = Math.floor(randRange(0, widthMap * 0.6)); }
            if (rand() < 0.5) { endX = widthMap - 1; endY = Math.floor(randRange(0, height * 0.6)); }
            else { endY = 0; endX = Math.floor(randRange(widthMap * 0.4, widthMap)); }
        } else if (vec.dx < 0 && vec.dy < 0) { // NW
            if (rand() < 0.5) { startX = widthMap - 1; startY = Math.floor(randRange(height * 0.4, height)); }
            else { startY = height - 1; startX = Math.floor(randRange(widthMap * 0.4, widthMap)); }
            if (rand() < 0.5) { endX = 0; endY = Math.floor(randRange(0, height * 0.6)); }
            else { endY = 0; endX = Math.floor(randRange(0, widthMap * 0.6)); }
        } else if (vec.dx > 0 && vec.dy > 0) { // SE
            if (rand() < 0.5) { startX = 0; startY = Math.floor(randRange(0, height * 0.6)); }
            else { startY = 0; startX = Math.floor(randRange(0, widthMap * 0.6)); }
            if (rand() < 0.5) { endX = widthMap - 1; endY = Math.floor(randRange(height * 0.4, height)); }
            else { endY = height - 1; endX = Math.floor(randRange(widthMap * 0.4, widthMap)); }
        } else {                              // SW
            if (rand() < 0.5) { startX = widthMap - 1; startY = Math.floor(randRange(0, height * 0.6)); }
            else { startY = 0; startX = Math.floor(randRange(widthMap * 0.4, widthMap)); }
            if (rand() < 0.5) { endX = 0; endY = Math.floor(randRange(height * 0.4, height)); }
            else { endY = height - 1; endX = Math.floor(randRange(0, widthMap * 0.6)); }
        }
    }

    // --- Midpoint displacement path ---
    function displace(points, depth) {
        if (depth <= 0) return points;
        const newPoints = [points[0]];
        for (let i = 0; i < points.length - 1; i++) {
            const a = points[i];
            const b = points[i + 1];
            const mx = (a.x + b.x) / 2;
            const my = (a.y + b.y) / 2;

            // Perpendicular vector
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const len = Math.hypot(dx, dy) || 1;
            const px = -dy / len;
            const py = dx / len;

            // Displacement strength decreases with depth
            const strength = meander * (len * 0.35) * (1 / (depth + 1));
            const offset = (rand() * 2 - 1) * strength;

            newPoints.push({
                x: mx + px * offset,
                y: my + py * offset
            });
            newPoints.push(b);
        }
        return displace(newPoints, depth - 1);
    }

    // How many subdivision levels (more = smoother / more detailed)
    const levels = Math.max(3, Math.floor(Math.log2(Math.max(widthMap, height) / 4)));
    let path = displace([{ x: startX, y: startY }, { x: endX, y: endY }], levels);

    // Clamp path points to map bounds
    path = path.map(p => ({
        x: Math.max(0, Math.min(widthMap - 1, p.x)),
        y: Math.max(0, Math.min(height - 1, p.y))
    }));

    // --- Rasterize path (Bresenham-style) ---
    function plot(x, y) {
        const ix = Math.round(x);
        const iy = Math.round(y);
        if (ix < 0 || ix >= widthMap || iy < 0 || iy >= height) return;

        // Draw a disk of radius ≈ width/2 for thickness
        const r = Math.max(0, (width - 1) / 2);
        const r2 = r * r;
        for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) {
            for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
                if (dx * dx + dy * dy <= r2 + 0.5) {
                    const nx = ix + dx;
                    const ny = iy + dy;
                    if (nx >= 0 && nx < widthMap && ny >= 0 && ny < height) {
                        grid[ny][nx] = waterChar;
                    }
                }
            }
        }
    }

    for (let i = 0; i < path.length - 1; i++) {
        const a = path[i];
        const b = path[i + 1];
        const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y)) + 1;
        for (let s = 0; s <= steps; s++) {
            const t = s / steps;
            plot(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
        }
    }

    // Return as array of strings
    return grid;
}