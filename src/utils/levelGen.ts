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
                // 30% chance to place a decoration per tile?
                if (Math.random() < 0.3) {
                    const decoGroup = terrainDecoGroups[Math.floor(Math.random() * terrainDecoGroups.length)];

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
    // Moved after Terrain so we can check for collisions with terrain
    if (decoGroups.length > 0) {
        const cloudCount = Math.floor((width * height) / 100); // Lower density for full objects
        for (let i = 0; i < cloudCount; i++) {
            const cx = Math.floor(Math.random() * (width - 2));
            // Restrict clouds to top 30% of map to avoid overlapping with ground
            const cy = Math.floor(Math.random() * (height - 2)); // Allow full range, but check collision

            // Pick a random decoration group
            const deco = decoGroups[Math.floor(Math.random() * decoGroups.length)];

            // Generate data for it
            // If !canResize, we must use its original width (preview length is a good proxy for original selection width)
            let decoW = 3;
            if (!deco.canResize) {
                decoW = deco.preview.length;
            } else {
                // Random width 2-4 for resizable decos
                decoW = Math.floor(Math.random() * 3) + 2;
            }

            const decoData = generatePlatformData(decoW, deco);

            // Flip Logic
            const shouldFlip = deco.canFlip && Math.random() < 0.5;

            // Check overlap with Background AND Main Terrain
            let overlaps = false;
            const tempPlacement: { x: number, y: number, tile: any, flip: boolean }[] = [];

            Object.entries(decoData).forEach(([key, tile]) => {
                const [dx, dy] = key.split(",").map(Number);

                // If flipped, invert X relative to width
                const finalDx = shouldFlip ? (decoW - 1 - dx) : dx;

                const bgX = cx + finalDx;
                const bgY = cy + dy;

                if (backgroundLayer.data[`${bgX},${bgY}`]) overlaps = true; // Overlaps other BG
                if (mainLayer.data[`${bgX},${bgY}`]) overlaps = true; // Overlaps Terrain

                tempPlacement.push({ x: bgX, y: bgY, tile, flip: shouldFlip });
            });

            if (!overlaps) {
                tempPlacement.forEach(p => {
                    backgroundLayer.data[`${p.x},${p.y}`] = { ...p.tile, flipX: p.flip };
                });
            }
        }
    }

    return [backgroundLayer, collisionLayer, mainLayer];
}
