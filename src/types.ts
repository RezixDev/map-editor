export type TileData = { tileId: number; flipX: boolean };
export type Layer = { id: string; name: string; visible: boolean; opacity: number; data: Record<string, TileData> };
export type Tool = "brush" | "eraser" | "fill" | "marquee" | "eyedropper";
export type SelectionRect = { x: number; y: number; w: number; h: number };

export type CustomBrush = {
    width: number;
    height: number;
    data: Record<string, TileData>;
};
