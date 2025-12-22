export type TileData = {
    tileId: number;
    flipX: boolean;
    properties?: Record<string, string | number | boolean>;
};

export type Layer = {
    id: string;
    name: string;
    visible: boolean;
    opacity: number;
    data: Record<string, TileData>;
};

export type Tool = "brush" | "eraser" | "fill" | "marquee";

export type SelectionRect = { x: number; y: number; w: number; h: number };

export const TILE_WIDTH = 32;
export const TILE_HEIGHT = 32;
