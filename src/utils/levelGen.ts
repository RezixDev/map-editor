import { type Layer, type TileData } from "../types";
import { type TileGroup, generatePlatformData } from "../constants/tileGroups";

export function generateProceduralLevel(
    width: number,
    height: number,
    group: TileGroup
): Layer[] {
    const mainLayer: Layer = {
        id: "layer-1",
        name: "Terrain",
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

    while (currentX < width - 5) {
        // Platform width (random between 3 and 8)
        const platWidth = Math.floor(Math.random() * 6) + 3;

        // Generate platform data
        const platformData = generatePlatformData(platWidth, group);

        // Place platform
        Object.entries(platformData).forEach(([key, tile]) => {
            const [dx, dy] = key.split(",").map(Number);
            const gx = currentX + dx;
            const gy = currentY + dy;

            // Add to main layer
            mainLayer.data[`${gx},${gy}`] = { ...tile, flipX: false };

            // Add simple collision block (id 999 or similar, assuming red square for now or just generic)
            // For now, let's assume tile ID 0 is collision or just reuse a placeholder
            // Ideally we have a specific collision tile. Let's use ID 0 for now as a placeholder.
            collisionLayer.data[`${gx},${gy}`] = { tileId: 0, flipX: false };
        });

        // Move Walker
        currentX += platWidth + Math.floor(Math.random() * (maxDistant - minDistant + 1)) + minDistant;

        // Randomize Y slightly
        const yChange = Math.floor(Math.random() * 5) - 2; // -2 to +2
        currentY += yChange;

        // Clamp Y
        if (currentY < minHeight) currentY = minHeight;
        if (currentY > maxHeight) currentY = maxHeight;
    }

    return [mainLayer, collisionLayer];
}
