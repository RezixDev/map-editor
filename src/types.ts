export type TileData = { tileId: number; flipX: boolean };
export type Layer = { id: string; name: string; visible: boolean; opacity: number; data: Record<string, TileData> };
export type Tool = "brush" | "eraser" | "fill" | "marquee" | "eyedropper" | "smartBrush";
export type SelectionRect = { x: number; y: number; w: number; h: number };

export type CustomBrush = {
    width: number;
    height: number;
    data: Record<string, TileData>;
};

export type TileGroup = {
    id: string;
    name: string;
    left: number[];    // Column of tile IDs
    middle: number[][]; // Array of columns (repeating pattern)
    right: number[];   // Column of tile IDs
    single: number[];  // Column for single-width
    height: number;
    preview: number[]; // Flat list for preview rendering
    role: "terrain" | "decoration" | "terrain-decoration";
    canResize: boolean;
    canFlip: boolean;
    allowInGeneration?: boolean;
};
