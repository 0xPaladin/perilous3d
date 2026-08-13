import { mulberry32 } from '../core/prng.js';

export function generateOrganicFloorPlan(seed, mapWidth, mapHeight, options = {}) {
    const {
        unitSize = 1,
        minRoomUnits = 8,
        maxRoomUnits = 25,
        roomCount = 15,
        maxWalkAttempts = 100
    } = options;

    // ============================================================
    // Seeded random number generator
    // ============================================================

    const random = mulberry32(seed);

    function randInt(min, max) {
        if (max <= min) {
            return min;
        }

        return Math.floor(
            random() * (max - min + 1)
        ) + min;
    }

    function pick(array) {
        return array[
            Math.floor(random() * array.length)
        ];
    }

    function shuffle(array) {
        // Loop from the last element down to the second
        for (let i = array.length - 1; i > 0; i--) {
            // Pick a random index from 0 to i
            const j = Math.floor(random() * (i + 1));

            // Swap elements using destructuring assignment
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    // ============================================================
    // Grid
    // ============================================================
    const rB = {
        min: () => [randInt(5, 15), randInt(40, 60)],
        max: () => [randInt(40, 60), randInt(85, 95)],
        c: () => [randInt(20, 35), randInt(65, 80)]
    }
    const randRect = {
        TL: () => {
            const [x1, x2] = rB.min().map(val => Math.floor(mapWidth * val / 100));
            const [y1, y2] = rB.min().map(val => Math.floor(mapHeight * val / 100));
            return [x1, y1, x2, y2];
        },
        TR: () => {
            const [x1, x2] = rB.max().map(val => Math.floor(mapWidth * val / 100));
            const [y1, y2] = rB.min().map(val => Math.floor(mapHeight * val / 100));
            return [x1, y1, x2, y2];
        },
        BR: () => {
            const [x1, x2] = rB.max().map(val => Math.floor(mapWidth * val / 100));
            const [y1, y2] = rB.max().map(val => Math.floor(mapHeight * val / 100));
            return [x1, y1, x2, y2];
        },
        BL: () => {
            const [x1, x2] = rB.min().map(val => Math.floor(mapWidth * val / 100));
            const [y1, y2] = rB.max().map(val => Math.floor(mapHeight * val / 100));
            return [x1, y1, x2, y2];
        },
        C: () => {
            const [x1, x2] = rB.c().map(val => Math.floor(val * mapWidth / 100));
            const [y1, y2] = rB.c().map(val => Math.floor(val * mapHeight / 100));
            return [x1, y1, x2, y2];
        }
    }

    const list = shuffle(['TL', 'TR', 'BR', 'BL']).slice(0, randInt(1, 2));
    const footprint = [C(), ...list.map(rect => randRect[rect]())];

    // ============================================================
    // Grid
    // ============================================================

    const gridWidth = Math.floor(
        mapWidth / unitSize
    );

    const gridHeight = Math.floor(
        mapHeight / unitSize
    );

    function cellId(x, y) {
        return `${x},${y}`;
    }

    function parseCell(id) {
        const [x, y] = id.split(",").map(Number);

        return {
            x,
            y
        };
    }

    function inBounds(x, y) {
        return (
            x >= 0 &&
            x < gridWidth &&
            y >= 0 &&
            y < gridHeight
        );
    }

    // Cardinal directions only.
    function neighbors(x, y) {
        const result = [];

        if (inBounds(x + 1, y)) {
            result.push({
                x: x + 1,
                y
            });
        }

        if (inBounds(x - 1, y)) {
            result.push({
                x: x - 1,
                y
            });
        }

        if (inBounds(x, y + 1)) {
            result.push({
                x,
                y: y + 1
            });
        }

        if (inBounds(x, y - 1)) {
            result.push({
                x,
                y: y - 1
            });
        }

        return result;
    }

    // ============================================================
    // State
    // ============================================================

    const used = new Set();

    const rooms = [];
    const doors = [];

    // ============================================================
    // Grow one room using a cardinal-direction random walk.
    // ============================================================

    function growRoom(start) {
        const room = [];

        let current = {
            x: start.x,
            y: start.y
        };

        const startId = cellId(
            current.x,
            current.y
        );

        room.push(startId);
        used.add(startId);

        const targetSize = randInt(
            minRoomUnits,
            maxRoomUnits
        );

        let attempts = 0;

        while (
            room.length < targetSize &&
            attempts < maxWalkAttempts
        ) {
            attempts++;

            let candidates = neighbors(
                current.x,
                current.y
            );

            // Never enter an already-used cell.
            candidates = candidates.filter(cell => {
                return !used.has(
                    cellId(cell.x, cell.y)
                );
            });

            // Dead end.
            //
            // Pick another cell already in this room and
            // continue the random walk from there.
            if (candidates.length === 0) {
                current = parseCell(
                    pick(room)
                );

                continue;
            }

            current = pick(candidates);

            const id = cellId(
                current.x,
                current.y
            );

            room.push(id);
            used.add(id);
        }

        // Reject rooms that don't meet the minimum.
        if (room.length < minRoomUnits) {
            for (const id of room) {
                used.delete(id);
            }

            return null;
        }

        return room;
    }

    // ============================================================
    // Find perimeter cells of a room.
    // ============================================================

    function findEdges(room) {
        const roomSet = new Set(room);
        const edges = [];

        for (const id of room) {
            const cell = parseCell(id);

            const adjacent = neighbors(
                cell.x,
                cell.y
            );

            if (
                adjacent.some(n =>
                    !roomSet.has(
                        cellId(n.x, n.y)
                    )
                )
            ) {
                edges.push(cell);
            }
        }

        return edges;
    }

    // ============================================================
    // Find an edge from which another room can grow.
    // ============================================================

    function findDoorCandidate(room) {
        const roomSet = new Set(room);
        const edges = findEdges(room);

        // Shuffle edges using the seeded RNG.
        for (let i = edges.length - 1; i > 0; i--) {
            const j = randInt(0, i);

            [
                edges[i],
                edges[j]
            ] = [
                    edges[j],
                    edges[i]
                ];
        }

        for (const edge of edges) {
            const candidates = neighbors(
                edge.x,
                edge.y
            ).filter(cell => {
                const id = cellId(
                    cell.x,
                    cell.y
                );

                return (
                    !roomSet.has(id) &&
                    !used.has(id)
                );
            });

            if (candidates.length > 0) {
                return {
                    from: edge,
                    to: pick(candidates)
                };
            }
        }

        return null;
    }

    // ============================================================
    // Create a 1-map-unit-wide door.
    //
    // Door format:
    //
    // [x, y]
    //
    // For a vertical wall:
    //     x = wall X
    //     y = start of 1-unit opening
    //
    // For a horizontal wall:
    //     x = start of 1-unit opening
    //     y = wall Y
    //
    // ALL VALUES ARE IN ORIGINAL MAP COORDINATES.
    // ALL VALUES ARE INTEGERS.
    // ============================================================

    function createDoor(from, to) {
        // --------------------------------------------------------
        // Cells are side-by-side horizontally.
        //
        // Therefore the shared wall is vertical.
        // --------------------------------------------------------

        if (from.x !== to.x) {
            const wallX =
                Math.max(from.x, to.x) *
                unitSize;

            const wallStartY =
                from.y * unitSize;

            const wallEndY =
                wallStartY + unitSize;

            // We need a 1-unit opening.
            //
            // The valid starting positions are:
            //
            // wallStartY
            // through
            // wallEndY - 1
            //
            // This guarantees:
            //
            // doorY + 1 <= wallEndY
            //
            const doorY = randInt(
                wallStartY,
                wallEndY - 1
            );

            return [
                wallX,
                doorY
            ];
        }

        // --------------------------------------------------------
        // Cells are above/below each other.
        //
        // Therefore the shared wall is horizontal.
        // --------------------------------------------------------

        const wallY =
            Math.max(from.y, to.y) *
            unitSize;

        const wallStartX =
            from.x * unitSize;

        const wallEndX =
            wallStartX + unitSize;

        const doorX = randInt(
            wallStartX,
            wallEndX - 1
        );

        return [
            doorX,
            wallY
        ];
    }

    // ============================================================
    // Create first room at center.
    // ============================================================

    const center = {
        x: Math.floor(gridWidth / 2),
        y: Math.floor(gridHeight / 2)
    };

    let currentRoom = growRoom(center);

    if (!currentRoom) {
        return {
            rooms: [],
            doors: [],
            walls: []
        };
    }

    rooms.push(currentRoom);

    // ============================================================
    // Grow subsequent rooms.
    // ============================================================

    for (
        let i = 1;
        i < roomCount;
        i++
    ) {
        const candidate =
            findDoorCandidate(currentRoom);

        if (!candidate) {
            break;
        }

        const {
            from,
            to
        } = candidate;

        // --------------------------------------------------------
        // Generate integer-only 1-unit door.
        // --------------------------------------------------------

        const door = createDoor(
            from,
            to
        );

        // --------------------------------------------------------
        // Grow next room from the cell on the other side.
        // --------------------------------------------------------

        const newRoom =
            growRoom(to);

        if (!newRoom) {
            break;
        }

        doors.push(door);
        rooms.push(newRoom);

        currentRoom = newRoom;
    }

    // ============================================================
    // Build occupied-cell set.
    // ============================================================

    const occupied = new Set();

    for (const room of rooms) {
        for (const id of room) {
            occupied.add(id);
        }
    }

    // ============================================================
    // Generate raw walls.
    // ============================================================

    const rawWalls = [];

    function addWall(x1, y1, x2, y2) {
        rawWalls.push([
            x1,
            y1,
            x2,
            y2
        ]);
    }

    for (const id of occupied) {
        const {
            x,
            y
        } = parseCell(id);

        const left =
            x * unitSize;

        const right =
            (x + 1) * unitSize;

        const top =
            y * unitSize;

        const bottom =
            (y + 1) * unitSize;

        // North
        if (!occupied.has(
            cellId(x, y - 1)
        )) {
            addWall(
                left,
                top,
                right,
                top
            );
        }

        // South
        if (!occupied.has(
            cellId(x, y + 1)
        )) {
            addWall(
                left,
                bottom,
                right,
                bottom
            );
        }

        // West
        if (!occupied.has(
            cellId(x - 1, y)
        )) {
            addWall(
                left,
                top,
                left,
                bottom
            );
        }

        // East
        if (!occupied.has(
            cellId(x + 1, y)
        )) {
            addWall(
                right,
                top,
                right,
                bottom
            );
        }
    }

    // ============================================================
    // Merge adjacent collinear walls.
    // ============================================================

    function mergeTwoWalls(a, b) {
        const [
            ax1,
            ay1,
            ax2,
            ay2
        ] = a;

        const [
            bx1,
            by1,
            bx2,
            by2
        ] = b;

        // --------------------------------------------------------
        // Horizontal.
        // --------------------------------------------------------

        if (
            ay1 === ay2 &&
            by1 === by2 &&
            ay1 === by1
        ) {
            const aMin =
                Math.min(ax1, ax2);

            const aMax =
                Math.max(ax1, ax2);

            const bMin =
                Math.min(bx1, bx2);

            const bMax =
                Math.max(bx1, bx2);

            // Adjacent or overlapping.
            if (
                aMax >= bMin &&
                bMax >= aMin
            ) {
                return [
                    Math.min(aMin, bMin),
                    ay1,
                    Math.max(aMax, bMax),
                    ay1
                ];
            }
        }

        // --------------------------------------------------------
        // Vertical.
        // --------------------------------------------------------

        if (
            ax1 === ax2 &&
            bx1 === bx2 &&
            ax1 === bx1
        ) {
            const aMin =
                Math.min(ay1, ay2);

            const aMax =
                Math.max(ay1, ay2);

            const bMin =
                Math.min(by1, by2);

            const bMax =
                Math.max(by1, by2);

            if (
                aMax >= bMin &&
                bMax >= aMin
            ) {
                return [
                    ax1,
                    Math.min(aMin, bMin),
                    ax1,
                    Math.max(aMax, bMax)
                ];
            }
        }

        return null;
    }

    function mergeWalls(input) {
        let walls =
            input.map(wall => [...wall]);

        let changed = true;

        while (changed) {
            changed = false;

            const result = [];

            for (let i = 0; i < walls.length; i++) {
                let current = walls[i];

                let merged = true;

                while (merged) {
                    merged = false;

                    for (
                        let j = i + 1;
                        j < walls.length;
                        j++
                    ) {
                        const combined =
                            mergeTwoWalls(
                                current,
                                walls[j]
                            );

                        if (combined) {
                            current = combined;

                            walls.splice(j, 1);

                            changed = true;
                            merged = true;

                            break;
                        }
                    }
                }

                result.push(current);
            }

            walls = result;
        }

        return walls;
    }

    let walls =
        mergeWalls(rawWalls);

    // ============================================================
    // Cut a 1-unit door from a wall.
    //
    // Door:
    //
    // Horizontal:
    //     [x, y] -> [x + 1, y]
    //
    // Vertical:
    //     [x, y] -> [x, y + 1]
    //
    // No half-unit coordinates.
    // ============================================================

    function cutDoorFromWalls(
        inputWalls,
        door
    ) {
        const [
            doorX,
            doorY
        ] = door;

        const doorEndX =
            doorX + 1;

        const doorEndY =
            doorY + 1;

        const result = [];

        for (const wall of inputWalls) {
            const [
                x1,
                y1,
                x2,
                y2
            ] = wall;

            // ====================================================
            // Horizontal wall.
            // ====================================================

            if (y1 === y2) {
                const wallStart =
                    Math.min(x1, x2);

                const wallEnd =
                    Math.max(x1, x2);

                // Door lies on this wall.
                if (
                    doorY === y1 &&
                    doorX >= wallStart &&
                    doorEndX <= wallEnd
                ) {
                    // Left portion.
                    if (doorX > wallStart) {
                        result.push([
                            wallStart,
                            y1,
                            doorX,
                            y1
                        ]);
                    }

                    // Right portion.
                    if (doorEndX < wallEnd) {
                        result.push([
                            doorEndX,
                            y1,
                            wallEnd,
                            y1
                        ]);
                    }

                    continue;
                }
            }

            // ====================================================
            // Vertical wall.
            // ====================================================

            if (x1 === x2) {
                const wallStart =
                    Math.min(y1, y2);

                const wallEnd =
                    Math.max(y1, y2);

                // Door lies on this wall.
                if (
                    doorX === x1 &&
                    doorY >= wallStart &&
                    doorEndY <= wallEnd
                ) {
                    // Top portion.
                    if (doorY > wallStart) {
                        result.push([
                            x1,
                            wallStart,
                            x1,
                            doorY
                        ]);
                    }

                    // Bottom portion.
                    if (doorEndY < wallEnd) {
                        result.push([
                            x1,
                            doorEndY,
                            x1,
                            wallEnd
                        ]);
                    }

                    continue;
                }
            }

            // Wall is unaffected by this door.
            result.push(wall);
        }

        return result;
    }

    // ============================================================
    // Remove door openings.
    // ============================================================

    for (const door of doors) {
        walls =
            cutDoorFromWalls(
                walls,
                door
            );
    }

    // Cutting doors can create mergeable segments.
    walls =
        mergeWalls(walls);

    // ============================================================
    // Return.
    // ============================================================

    return {
        rooms,
        doors,
        walls
    };
}