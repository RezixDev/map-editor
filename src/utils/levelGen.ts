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

    // Separating Roles
    const terrainGroups = Object.values(allGroups).filter(g => g.role === "terrain");
    const decoGroups = Object.values(allGroups).filter(g => g.role === "decoration");
    const terrainDecoGroups = Object.values(allGroups).filter(g => g.role === "terrain-decoration");

    // Default to first if none


    // --- Pass 1: Terrain Walker (Multi-Pass) ---
    // We run a walker for EACH selected terrain group to allow layering (e.g. Sky Islands + Ground)
    terrainGroups.forEach(terrainGroup => {
        let currentX = 2;
        // Determine Bounds based on Alignment
        let yMin = 4;
        let yMax = height - 4;

        const alignments = terrainGroup.verticalAlignments ||
            (terrainGroup.verticalAlignment ? [terrainGroup.verticalAlignment] : ["top", "bottom"]); // default to full

        const isTop = alignments.includes("top");
        const isBottom = alignments.includes("bottom");

        if (isTop && !isBottom) {
            yMax = Math.floor(height * 0.5);
        } else if (!isTop && isBottom) {
            yMin = Math.floor(height * 0.5);
        }
        // If both or neither, use full height (4 to H-4)

        // Determine Start Y
        let currentY = Math.floor((yMin + yMax) / 2);

        // Density Logic
        const density = terrainGroup.density || 5;
        // Low Density (1) = Big Gaps. High Density (10) = Small Gaps.
        // Base Gap: 2-4.
        // Density 1: MinGap 6, MaxGap 10.
        // Density 10: MinGap 1, MaxGap 3.
        const minDistant = Math.max(1, 7 - Math.ceil(density / 1.5));
        const maxDistant = Math.max(minDistant + 1, 12 - density);

        while (currentX < width - 5) {
            // Platform width (random between 3 and 8)
            const platWidth = Math.floor(Math.random() * 6) + 3;
            // Generate platform data
            const platformData = generatePlatformData(platWidth, terrainGroup);

            // Place platform
            Object.entries(platformData).forEach(([key, tile]) => {
                const [dx, dy] = key.split(",").map(Number);
                const gx = currentX + dx;
                const gy = currentY + dy;

                // Bounds Check for individual tiles (safety)
                if (gy >= 0 && gy < height) {
                    // Overlap Check: Don't overwrite existing terrain from previous passes
                    if (!mainLayer.data[`${gx},${gy}`]) {
                        mainLayer.data[`${gx},${gy}`] = { ...tile, flipX: false };
                        collisionLayer.data[`${gx},${gy}`] = { tileId: 0, flipX: false };
                    }
                }
            });

            // --- Terrain Decoration Placement ---
            if (terrainDecoGroups.length > 0) {
                for (let dx = 0; dx < platWidth; dx++) {
                    const randomGroup = terrainDecoGroups[Math.floor(Math.random() * terrainDecoGroups.length)];
                    const decoDensity = randomGroup.density || 5;
                    const chance = (decoDensity / 5) * 0.3;

                    if (Math.random() < chance) {
                        const decoGroup = randomGroup;
                        const decoW = decoGroup.preview.length;

                        // Ensure decoration doesn't hang off right side
                        if (dx + decoW <= platWidth) {
                            const startDecoY = -1; // Just above platform
                            const decoData = generatePlatformData(decoW, decoGroup);

                            // Fix: Flip logic must be applied to the OBJECT, not per tile
                            const shouldFlip = decoGroup.canFlip && Math.random() < 0.5;

                            Object.entries(decoData).forEach(([dKey, dTile]) => {
                                const [ddx, ddy] = dKey.split(",").map(Number);
                                // Mirror X if flipped
                                const finalDdx = shouldFlip ? (decoW - 1 - ddx) : ddx;

                                const dgx = currentX + dx + finalDdx;
                                const dgy = currentY + startDecoY + ddy;

                                if (dgy >= 0 && dgy < height) {
                                    // Place on Main Layer (foreground decoration) or Background?
                                    // Usually "Flowers" are non-colliding (Background layer) or Main layer but non-colliding?
                                    // If they are "Smart Components", they are tiles.
                                    // Let's put them on Main Layer but NO Collision.
                                    mainLayer.data[`${dgx},${dgy}`] = { ...dTile, flipX: shouldFlip };
                                }
                            });

                            // Skip ahead by width of decoration to avoid stacking overlapping decorations
                            // dx += decoW - 1; // Optional
                        }
                    }
                }
            }

            // Move Walker
            currentX += platWidth + Math.floor(Math.random() * (maxDistant - minDistant + 1)) + minDistant;

            // Y Variation
            const yChange = Math.floor(Math.random() * 5) - 2; // -2 to +2
            currentY += yChange;

            // Clamp Y
            if (currentY < yMin) currentY = yMin;
            if (currentY > yMax) currentY = yMax;
        }
    });

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
