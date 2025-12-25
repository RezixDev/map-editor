import { type TileGroup, type TileData } from "../types";

// Re-export type if needed, or just use from types.ts
export { type TileGroup };

export const INITIAL_TILE_GROUPS: Record<string, TileGroup> = {
    grass: {
        id: "grass",
        name: "Grass Platform",
        left: [8],
        middle: [[9]],
        right: [10],
        single: [9],
        height: 1,
        preview: [8, 9, 10],
        role: "terrain",
        canResize: true,
        canFlip: false
    }
};

export function generatePlatformData(width: number, group: TileGroup): Record<string, TileData> {
    const data: Record<string, TileData> = {};

    if (width <= 0) return data;
    const h = group.height || 1;

    // Helper to generate a column
    const addColumn = (x: number, colTiles: number[]) => {
        for (let y = 0; y < h; y++) {
            // Safety check for bounds
            const tileId = colTiles[y % colTiles.length];
            if (tileId !== undefined) {
                data[`${x},${y}`] = { tileId, flipX: false };
            }
        }
    };

    if (width === 1) {
        addColumn(0, group.single);
        return data;
    }

    // Left Cap
    addColumn(0, group.left);

    // Middle Sections
    // Middle Sections
    for (let x = 1; x < width - 1; x++) {
        // Cycle through middle columns
        let middleCol: number[] = [];
        if (group.middle.length > 0) {
            const middleColIndex = (x - 1) % group.middle.length;
            middleCol = group.middle[middleColIndex];
        } else {
            // Fallback to single or left if no middle defined (e.g. 1-wide source)
            middleCol = group.single;
        }
        addColumn(x, middleCol);
    }

    // Right Cap
    addColumn(width - 1, group.right);

    return data;
}
