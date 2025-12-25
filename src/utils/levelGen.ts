import { type Layer } from "../types";
import { type TileGroup, generatePlatformData } from "../constants/tileGroups";

export function generateProceduralLevel(
    width: number,
    height: number,
    allGroups: Record<string, TileGroup>, // Changed from single group
    _tilesPerRow: number
): Layer[] {
    const mainLayer: Layer = {
        id: "layer-1",
        name: "Terrain",
        visible: true,
        opacity: 1,
        data: {}
    };

    const backgroundLayer: Layer = {
        id: "layer-bg",
        name: "Background",
        visible: true,
        opacity: 1,
        data: {}
    };

    const collisionLayer: Layer = {
        id: "layer-collision",
        name: "Collision",
        visible: true,
        opacity: 0.5,
        data: {}
    };

    // Walker parameters
    let currentX = 2;
    let currentY = Math.floor(height / 2);
    const minDistant = 2;
    const maxDistant = 4;
    const minHeight = 4;
    const maxHeight = height - 4;

    // Separating Roles
    const terrainGroups = Object.values(allGroups).filter(g => g.role === "terrain");
    const decoGroups = Object.values(allGroups).filter(g => g.role === "decoration");
    const terrainDecoGroups = Object.values(allGroups).filter(g => g.role === "terrain-decoration");

    // Default to first if none
    const mainTerrain = terrainGroups.length > 0 ? terrainGroups[0] : Object.values(allGroups)[0];

    // --- Pass 1: Terrain Walker ---
    while (currentX < width - 5) {
        // Platform width (random between 3 and 8)
        const platWidth = Math.floor(Math.random() * 6) + 3;

        // Generate platform data
        // Cycle through terrain groups? Or stick to one per level?
        // Let's stick to mainTerrain for consistency, or random?
        // For "Style", usually one main terrain type per level is better.
        // Pick a random terrain group from the available selection
        // This supports mixing different styles if multiple were selected
        const currentTerrain = terrainGroups[Math.floor(Math.random() * terrainGroups.length)] || mainTerrain;
        if (!currentTerrain) break;

        const platformData = generatePlatformData(platWidth, currentTerrain);

        // Place platform
        Object.entries(platformData).forEach(([key, tile]) => {
            const [dx, dy] = key.split(",").map(Number);
            const gx = currentX + dx;
            const gy = currentY + dy;

            // Add to main layer
            mainLayer.data[`${gx},${gy}`] = { ...tile, flipX: false };

            // User requested to remove automatic grass decoration on top.
            // So we only place the Smart Component tiles themselves.

            // Add simple collision block (id 999 or similar, assuming red square for now or just generic)
            // For now, let's assume tile ID 0 is collision or just reuse a placeholder
            // Ideally we have a specific collision tile. Let's use ID 0 for now as a placeholder.
            // Add simple collision block (id 999 or similar, assuming red square for now or just generic)
            // For now, let's assume tile ID 0 is collision or just reuse a placeholder
            // Ideally we have a specific collision tile. Let's use ID 0 for now as a placeholder.
            collisionLayer.data[`${gx},${gy}`] = { tileId: 0, flipX: false };
        });

        // --- Terrain Decoration Placement ---
        if (terrainDecoGroups.length > 0) {
            // Iterate over the top surface valid positions
            // Platform width is platWidth. key uses relative coordinates.
            // We need to find the "top" tiles. Our generatePlatformData usually generates a flat top at dy=0 or similar.
            // Let's assume for now the platform is a simple block and the top is at relative y=0.

            // We iterate from dx=0 to platWidth-1
            for (let dx = 0; dx < platWidth; dx++) {
                // Determine probability based on density
                // If we pick a random group first, we can use its density.
                // Or we iterate likelihood of ANY decoration?
                // Let's pick a random group first, then check its density check.
                const randomGroup = terrainDecoGroups[Math.floor(Math.random() * terrainDecoGroups.length)];
                const density = randomGroup.density || 5;
                // Chance: Density 5 = 30%. Density 1 = 6%. Density 10 = 60%.
                const chance = (density / 5) * 0.3;

                if (Math.random() < chance) {
                    const decoGroup = randomGroup;

                    // Check if it fits (width)
                    // If deco width > remaining width, skip?
                    // Or just let it overhang? Let's check width.
                    // For single tile decos (flowers), width is 1.
                    const decoWidth = decoGroup.preview.length; // Use preview length as proxy for width

                    if (dx + decoWidth <= platWidth) {
                        // Generate data
                        const decoData = generatePlatformData(decoWidth, decoGroup);
                        const topY = currentY; // Top of platform

                        // Place decoration ABOVE platform. Platform top is at currentY.
                        // So decoration bottom should be at currentY - 1.
                        // generatePlatformData returns data starting at 0,0 going down to height-1.
                        // So we want the bottom of decoration at topY - 1.
                        // decoration height is decoGroup.height.
                        // So decoration starts at (topY - 1) - (decoGroup.height - 1) = topY - decoGroup.height.

                        const startDecoY = topY - decoGroup.height;

                        const shouldFlip = decoGroup.canFlip && Math.random() < 0.5;
                        let placed = false;

                        Object.entries(decoData).forEach(([dKey, dTile]) => {
                            const [ddx, ddy] = dKey.split(",").map(Number);

                            // Flip Logic: Mirror X position if flipped
                            const finalDdx = shouldFlip ? (decoWidth - 1 - ddx) : ddx;

                            const finalX = currentX + dx + finalDdx;
                            const finalY = startDecoY + ddy;

                            // Check collision with main layer (don't overwrite terrain or other decos)
                            if (!mainLayer.data[`${finalX},${finalY}`]) {
                                mainLayer.data[`${finalX},${finalY}`] = { ...dTile, flipX: shouldFlip };
                                placed = true;
                            }
                        });

                        if (placed) {
                            // If we placed an object, skip its width to avoid self-overlap
                            dx += decoWidth - 1;
                        }
                    }
                }
            }
        }

        // Move Walker
        currentX += platWidth + Math.floor(Math.random() * (maxDistant - minDistant + 1)) + minDistant;

        // Randomize Y slightly
        const yChange = Math.floor(Math.random() * 5) - 2; // -2 to +2
        currentY += yChange;

        // Clamp Y
        if (currentY < minHeight) currentY = minHeight;
        if (currentY > maxHeight) currentY = maxHeight;
    }

    // --- Pass 2: Decorations (Background) ---
    // Split into Top (Clouds) and Bottom (Backgrounds) using verticalAlignments
    if (decoGroups.length > 0) {
        // Filter based on inclusion in verticalAlignments array.
        // If undefined, default to both? Or just top? Let's assume undefined = 'top' for back-compat or just both.
        // Actually, previous default was 'top' implicitly if missing.
        // Let's check:
        const topDecos = decoGroups.filter(g =>
            g.verticalAlignments?.includes("top") ||
            (!g.verticalAlignments && (!g.verticalAlignment || g.verticalAlignment === "top")) // fallback
        );
        const bottomDecos = decoGroups.filter(g =>
            g.verticalAlignments?.includes("bottom") ||
            (g.verticalAlignment === "bottom") // fallback
        );

        // Top Loop (0 to 50% height)
        if (topDecos.length > 0) {
            topDecos.forEach(deco => {
                const density = deco.density || 5;
                const count = Math.floor((width * height * (density / 5)) / 100);

                // Track placed items for this group/pass to avoid clumping
                // We should probably track ALL placed items in this pass, but per-group is minimal scattering.
                // Better: Track all decorations in a shared list if we want them to avoid each other?
                // For now, let's track per group to avoid self-clumping, 
                // but usually user implies "clouds" shouldn't clump with "clouds".
                // If we have multiple cloud types, they should probably avoid each other too.
                // Let's keep it simple: Per-group scattering for now, or use a local list for this loop.
                const placedItems: { cx: number, cy: number }[] = [];

                for (let i = 0; i < count; i++) {
                    let cx = 0;
                    let cy = 0;
                    let attempts = 0;
                    const maxAttempts = 10;
                    const minDist = Math.max(3, 15 - density); // Density 1 -> Dist 14. Density 10 -> Dist 5.

                    while (attempts < maxAttempts) {
                        cx = Math.floor(Math.random() * (width - 2));
                        cy = Math.floor(Math.random() * (height * 0.5)); // Upper 50%

                        // Check distance
                        let tooClose = false;
                        for (const item of placedItems) {
                            const dist = Math.sqrt(Math.pow(cx - item.cx, 2) + Math.pow(cy - item.cy, 2));
                            if (dist < minDist) {
                                tooClose = true;
                                break;
                            }
                        }

                        if (!tooClose) break;
                        attempts++;
                    }

                    if (attempts >= maxAttempts) continue; // Skip if we couldn't find a spot

                    let decoW = 3;
                    if (!deco.canResize) {
                        decoW = deco.preview.length;
                    } else {
                        decoW = Math.floor(Math.random() * 3) + 2;
                    }

                    const decoData = generatePlatformData(decoW, deco);
                    const shouldFlip = deco.canFlip && Math.random() < 0.5;
                    let overlaps = false;
                    const tempPlacement: { x: number, y: number, tile: any, flip: boolean }[] = [];

                    Object.entries(decoData).forEach(([key, tile]) => {
                        const [dx, dy] = key.split(",").map(Number);
                        const finalDx = shouldFlip ? (decoW - 1 - dx) : dx;
                        const bgX = cx + finalDx;
                        const bgY = cy + dy;

                        if (backgroundLayer.data[`${bgX},${bgY}`]) overlaps = true;
                        if (mainLayer.data[`${bgX},${bgY}`]) overlaps = true;

                        tempPlacement.push({ x: bgX, y: bgY, tile, flip: shouldFlip });
                    });

                    if (!overlaps) {
                        tempPlacement.forEach(p => {
                            backgroundLayer.data[`${p.x},${p.y}`] = { ...p.tile, flipX: p.flip };
                        });
                        placedItems.push({ cx, cy });
                    }
                }
            });
        }

        // Bottom Loop (50% to 100% height)
        if (bottomDecos.length > 0) {
            bottomDecos.forEach(deco => {
                const density = deco.density || 5;
                // Lower density for bottom by default usually, but let's stick to the same formula
                // Density 5 = (W*H)/150 (from previous code).
                // Let's use (W*H * (density/5)) / 150
                const count = Math.floor((width * height * (density / 5)) / 150);
                const placedItems: { cx: number, cy: number }[] = [];

                for (let i = 0; i < count; i++) {
                    let cx = 0;
                    let cy = 0;
                    let attempts = 0;
                    const maxAttempts = 10;
                    const minDist = Math.max(3, 15 - density);

                    while (attempts < maxAttempts) {
                        cx = Math.floor(Math.random() * (width - 2));
                        const startY = Math.floor(height * 0.5);
                        cy = startY + Math.floor(Math.random() * (height * 0.5 - 2)); // Lower 50%

                        // Check distance
                        let tooClose = false;
                        for (const item of placedItems) {
                            const dist = Math.sqrt(Math.pow(cx - item.cx, 2) + Math.pow(cy - item.cy, 2));
                            if (dist < minDist) {
                                tooClose = true;
                                break;
                            }
                        }

                        if (!tooClose) break;
                        attempts++;
                    }

                    if (attempts >= maxAttempts) continue;

                    let decoW = 3;
                    if (!deco.canResize) {
                        decoW = deco.preview.length;
                    } else {
                        decoW = Math.floor(Math.random() * 3) + 2;
                    }

                    const decoData = generatePlatformData(decoW, deco);
                    const shouldFlip = deco.canFlip && Math.random() < 0.5;
                    let overlaps = false;
                    const tempPlacement: { x: number, y: number, tile: any, flip: boolean }[] = [];

                    Object.entries(decoData).forEach(([key, tile]) => {
                        const [dx, dy] = key.split(",").map(Number);
                        const finalDx = shouldFlip ? (decoW - 1 - dx) : dx;
                        const bgX = cx + finalDx;
                        const bgY = cy + dy;

                        if (backgroundLayer.data[`${bgX},${bgY}`]) overlaps = true;
                        if (mainLayer.data[`${bgX},${bgY}`]) overlaps = true;

                        tempPlacement.push({ x: bgX, y: bgY, tile, flip: shouldFlip });
                    });

                    if (!overlaps) {
                        tempPlacement.forEach(p => {
                            backgroundLayer.data[`${p.x},${p.y}`] = { ...p.tile, flipX: p.flip };
                        });
                        placedItems.push({ cx, cy });
                    }
                }
            });
        }
    }

    return [backgroundLayer, collisionLayer, mainLayer];
}
