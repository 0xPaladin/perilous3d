import { mulberry32 } from '../core/prng.js';

/**
 * Seeded floor plan generator that COMPLETELY FILLS a given shape with
 * rooms — no gaps between rooms, every point inside the shape belongs to
 * exactly one room (edges touch exactly).
 *
 * generateFillFloorPlan(seed, shape, options?) -> { rooms, doors }
 *   shape: { w, h }  -> fills an axis-aligned rectangle w x h
 *          { r }     -> fills a circle of radius r (bounding box is 2r x 2r,
 *                       center at (r, r)). Since rooms must be axis-aligned
 *                       rectangles, the circle is filled with horizontal
 *                       strips whose width is sized so every strip stays
 *                       fully inside the circle (a "staircase" approximation
 *                       of the round boundary — this is the closest a
 *                       rectangle-only room format can get to a true circle).
 *   rooms: Array<[x1, y1, x2, y2]>
 *   doors: Array<[x, y]>   one door per connection; enough doors are added
 *          to guarantee every room is reachable from every other room,
 *          plus a few extra for loops.
 */

export function generateFillFloorPlan(seed, shape, options = {}) {
    const {
        minRoomSize = 4,       // smallest allowed room width/height
        maxDepth = 3,          // recursion cap for subdividing space into rooms
        stopProb = 0.15,       // chance to stop subdividing a region early (variety)
        extraConnectionChance = 0.12, // fraction of extra (non-tree) doors, for loops
    } = options;

    const rand = mulberry32(seed);

    // ---- 1. Build rooms that fully tile the requested shape ----------------
    let rooms;
    if (shape && typeof shape.r === "number") {
        rooms = fillCircle(rand, shape.r, minRoomSize, maxDepth, stopProb);
    } else if (shape && typeof shape.w === "number" && typeof shape.h === "number") {
        rooms = fillRect(rand, 0, 0, shape.w, shape.h, minRoomSize, maxDepth, stopProb);
    } else {
        throw new Error("shape must be { w, h } or { r }");
    }

    // ---- 2. Find every pair of rooms that share a wall segment -------------
    const edges = findAdjacencies(rooms);

    // ---- 3. Randomized spanning tree (guarantees full connectivity) --------
    const doors = connectRooms(rand, rooms.length, edges, extraConnectionChance);

    // ---- 4. Stairs
    const stairs = shuffle(rand, rooms).slice(0, 2).map(([x1, y1, x2, y2]) => {
        return [randInt(rand, x1 + 1, x2 - 1), randInt(rand, y1 + 1, y2 - 1)]
    });

    return { rooms, doors, stairs };
}

// ---- rectangle fill: exact BSP tiling, no padding --------------------------

function fillRect(rand, x1, y1, x2, y2, minRoomSize, maxDepth, stopProb, depth = 0) {
    const w = x2 - x1;
    const h = y2 - y1;

    const canSplitW = w >= minRoomSize * 2;
    const canSplitH = h >= minRoomSize * 2;

    if ((!canSplitW && !canSplitH) || depth >= maxDepth || rand() < stopProb) {
        if (!canSplitW && !canSplitH) return [[x1, y1, x2, y2]];
        // still forced to stop even though a split is technically possible
        if (rand() < stopProb || depth >= maxDepth) return [[x1, y1, x2, y2]];
    }

    // Decide split axis: prefer splitting the longer dimension, fall back to
    // whichever axis is actually splittable.
    let doHorizontal;
    if (canSplitW && canSplitH) doHorizontal = w < h ? true : w > h ? false : rand() < 0.5;
    else if (canSplitH) doHorizontal = true;
    else if (canSplitW) doHorizontal = false;
    else return [[x1, y1, x2, y2]];

    if (doHorizontal) {
        const cut = randInt(rand, y1 + minRoomSize, y2 - minRoomSize);
        return [
            ...fillRect(rand, x1, y1, x2, cut, minRoomSize, maxDepth, stopProb, depth + 1),
            ...fillRect(rand, x1, cut, x2, y2, minRoomSize, maxDepth, stopProb, depth + 1),
        ];
    } else {
        const cut = randInt(rand, x1 + minRoomSize, x2 - minRoomSize);
        return [
            ...fillRect(rand, x1, y1, cut, y2, minRoomSize, maxDepth, stopProb, depth + 1),
            ...fillRect(rand, cut, y1, x2, y2, minRoomSize, maxDepth, stopProb, depth + 1),
        ];
    }
}

// ---- circle fill: horizontal strips, each strip tiled with fillRect's 1D sibling --

function fillCircle(rand, r, minRoomSize, maxDepth, stopProb) {
    const cy = r; // center in bounding-box coordinates
    const rowRanges = splitRange(rand, 0, 2 * r, minRoomSize, maxDepth, stopProb);

    const rooms = [];
    for (const [y1, y2] of rowRanges) {
        // Conservative half-width: use the row edge farthest from the center,
        // since sqrt(r^2 - dy^2) is smallest there. Guarantees the whole strip
        // stays inside the circle.
        const farthest = Math.max(Math.abs(y1 - cy), Math.abs(y2 - cy));
        const halfWidth = Math.sqrt(Math.max(0, r * r - farthest * farthest));

        if (halfWidth * 2 < minRoomSize) continue; // strip too thin near the pole, skip

        const rowX1 = r - halfWidth;
        const rowX2 = r + halfWidth;
        const colRanges = splitRange(rand, rowX1, rowX2, minRoomSize, maxDepth, stopProb);
        for (const [x1, x2] of colRanges) {
            rooms.push([Math.round(x1), Math.round(y1), Math.round(x2), Math.round(y2)]);
        }
    }
    return rooms;
}

// 1D version of the recursive random split, used for circle rows/columns.
function splitRange(rand, lo, hi, minSize, maxDepth, stopProb, depth = 0) {
    const size = hi - lo;
    if (size < minSize * 2 || depth >= maxDepth || rand() < stopProb) {
        return [[lo, hi]];
    }
    const cut = randInt(rand, lo + minSize, hi - minSize);
    return [
        ...splitRange(rand, lo, cut, minSize, maxDepth, stopProb, depth + 1),
        ...splitRange(rand, cut, hi, minSize, maxDepth, stopProb, depth + 1),
    ];
}

// ---- adjacency + connectivity ---------------------------------------------

// Returns edges [{ a, b, axis, at, from, to }] for every pair of rooms that
// share a positive-length wall segment (axis: 'v' = vertical shared wall,
// 'h' = horizontal shared wall; `at` is the shared coordinate; [from,to] is
// the overlapping range along the wall).
function findAdjacencies(rooms) {
    const edges = [];
    for (let i = 0; i < rooms.length; i++) {
        const [ax1, ay1, ax2, ay2] = rooms[i];
        for (let j = i + 1; j < rooms.length; j++) {
            const [bx1, by1, bx2, by2] = rooms[j];

            // Share a vertical wall (side by side horizontally)?
            if (ax2 === bx1 || bx2 === ax1) {
                const from = Math.max(ay1, by1);
                const to = Math.min(ay2, by2);
                if (to - from > 0) {
                    edges.push({ a: i, b: j, axis: "v", at: ax2 === bx1 ? ax2 : bx2, from, to });
                    continue;
                }
            }
            // Share a horizontal wall (stacked vertically)?
            if (ay2 === by1 || by2 === ay1) {
                const from = Math.max(ax1, bx1);
                const to = Math.min(ax2, bx2);
                if (to - from > 0) {
                    edges.push({ a: i, b: j, axis: "h", at: ay2 === by1 ? ay2 : by2, from, to });
                }
            }
        }
    }
    return edges;
}

function connectRooms(rand, roomCount, edges, extraConnectionChance) {
    // shuffle edges (Fisher-Yates) for a randomized spanning tree
    for (let i = edges.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [edges[i], edges[j]] = [edges[j], edges[i]];
    }

    const parent = Array.from({ length: roomCount }, (_, i) => i);
    function find(x) {
        while (parent[x] !== x) {
            parent[x] = parent[parent[x]];
            x = parent[x];
        }
        return x;
    }
    function union(x, y) {
        const rx = find(x), ry = find(y);
        if (rx === ry) return false;
        parent[rx] = ry;
        return true;
    }

    const doors = [];
    for (const edge of edges) {
        const merged = union(edge.a, edge.b);
        if (merged) {
            doors.push(doorFromEdge(rand, edge));
        } else if (rand() < extraConnectionChance) {
            // extra door for loops/shortcuts even though rooms are already connected
            doors.push(doorFromEdge(rand, edge));
        }
    }
    return doors;
}

function doorFromEdge(rand, edge) {
    const pos = randInt(rand, edge.from + 1, edge.to - 1 >= edge.from + 1 ? edge.to - 1 : edge.from);
    return edge.axis === "v" ? [edge.at, pos] : [pos, edge.at];
}

// ---- helpers ----------------------------------------------------------------

function randInt(rand, min, max) {
    return Math.floor(rand() * (max - min + 1)) + min;
}

function shuffle(rand, array) {
    // Loop from the last element down to the second
    for (let i = array.length - 1; i > 0; i--) {
        // Pick a random index from 0 to i
        const j = Math.floor(rand() * (i + 1));

        // Swap elements using destructuring assignment
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Examples:
// const { rooms, doors } = generateFillFloorPlan("castle-1", { w: 80, h: 50 });
// const { rooms, doors } = generateFillFloorPlan("arena-1", { r: 40 });