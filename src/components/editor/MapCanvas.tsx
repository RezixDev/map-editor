import { useRef, useEffect, useState, type MouseEvent } from "react";
import { type Layer, type SelectionRect, type Tool } from "../../types";
import { TILE_WIDTH, TILE_HEIGHT } from "../../constants";

type MapCanvasProps = {
    layers: Layer[];
    mapSize: { width: number; height: number };
    zoom: number;
    setZoom: React.Dispatch<React.SetStateAction<number>>;
    selection: SelectionRect | null;
    image: HTMLImageElement | null;
    currentTool: Tool;
    paletteSelection: SelectionRect;
    isFlipped: boolean;
    onMouseDown: (e: MouseEvent<HTMLCanvasElement>) => void;
    onMouseMove: (e: MouseEvent<HTMLCanvasElement>) => void;
    onMouseUp: () => void;
    onMouseLeave: () => void;
};

export function MapCanvas({
    layers,
    mapSize,
    zoom,
    setZoom,
    selection,
    image,
    currentTool,
    paletteSelection,
    isFlipped,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onMouseLeave,
}: MapCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);

    function renderMap() {
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context || !image) return;

        // Resize map canvas
        const logicalWidth = mapSize.width * TILE_WIDTH;
        const logicalHeight = mapSize.height * TILE_HEIGHT;

        if (canvas.width !== logicalWidth || canvas.height !== logicalHeight) {
            canvas.width = logicalWidth;
            canvas.height = logicalHeight;
        }

        context.imageSmoothingEnabled = false;
        context.clearRect(0, 0, canvas.width, canvas.height);

        // 1. Draw Map Tiles (Layered)
        layers.forEach((layer) => {
            if (!layer.visible) return;

            context.save();
            context.globalAlpha = layer.opacity;

            Object.entries(layer.data).forEach(([key, tileData]) => {
                const [gx, gy] = key.split(",").map(Number);
                const drawX = gx * TILE_WIDTH;
                const drawY = gy * TILE_HEIGHT;

                const tilesPerRow = Math.floor(image.width / TILE_WIDTH);
                const srcX = (tileData.tileId % tilesPerRow) * TILE_WIDTH;
                const srcY = Math.floor(tileData.tileId / tilesPerRow) * TILE_HEIGHT;

                context.save();
                if (tileData.flipX) {
                    context.translate(drawX + TILE_WIDTH, drawY);
                    context.scale(-1, 1);
                    context.drawImage(image, srcX, srcY, TILE_WIDTH, TILE_HEIGHT, 0, 0, TILE_WIDTH, TILE_HEIGHT);
                } else {
                    context.drawImage(image, srcX, srcY, TILE_WIDTH, TILE_HEIGHT, drawX, drawY, TILE_WIDTH, TILE_HEIGHT);
                }
                context.restore();
            });

            context.restore();
        });

        // 2. Draw Grid
        context.beginPath();
        for (let i = 0; i <= mapSize.width; i++) {
            context.moveTo(i * TILE_WIDTH, 0);
            context.lineTo(i * TILE_WIDTH, logicalHeight);
        }
        for (let i = 0; i <= mapSize.height; i++) {
            context.moveTo(0, i * TILE_HEIGHT);
            context.lineTo(logicalWidth, i * TILE_HEIGHT);
        }
        context.strokeStyle = "rgba(0,0,0, 0.4)";
        context.lineWidth = 1;
        context.stroke();

        // 3. Draw Selection Marquee
        if (selection) {
            const selX = selection.x * TILE_WIDTH;
            const selY = selection.y * TILE_HEIGHT;
            const selW = selection.w * TILE_WIDTH;
            const selH = selection.h * TILE_HEIGHT;

            // Fill
            context.fillStyle = "rgba(0, 140, 255, 0.2)";
            context.fillRect(selX, selY, selW, selH);

            // Border
            context.beginPath();
            context.strokeStyle = "white";
            context.lineWidth = 2;
            context.setLineDash([4, 4]);
            context.strokeRect(selX, selY, selW, selH);

            context.strokeStyle = "black";
            context.setLineDash([4, 4]);
            context.lineDashOffset = 4;
            context.strokeRect(selX, selY, selW, selH);

            context.setLineDash([]);
            context.lineDashOffset = 0;
        }

        // 4. Draw Ghost/Hover Cursor
        if (hoverPos) {
            const gridX = Math.floor(hoverPos.x / TILE_WIDTH) * TILE_WIDTH;
            const gridY = Math.floor(hoverPos.y / TILE_HEIGHT) * TILE_HEIGHT;

            // Draw Ghost Tile
            if (currentTool === "brush" || currentTool === "fill") {
                context.globalAlpha = 0.5;

                const previewW = currentTool === "brush" ? paletteSelection.w : 1;
                const previewH = currentTool === "brush" ? paletteSelection.h : 1;

                for (let dy = 0; dy < previewH; dy++) {
                    for (let dx = 0; dx < previewW; dx++) {
                        const srcDx = isFlipped ? (previewW - 1 - dx) : dx;
                        const srcX = (paletteSelection.x + srcDx) * TILE_WIDTH;
                        const srcY = (paletteSelection.y + dy) * TILE_HEIGHT;
                        const destX = gridX + (dx * TILE_WIDTH);
                        const destY = gridY + (dy * TILE_HEIGHT);

                        context.save();
                        if (isFlipped) {
                            context.translate(destX + TILE_WIDTH, destY);
                            context.scale(-1, 1);
                            context.drawImage(image, srcX, srcY, TILE_WIDTH, TILE_HEIGHT, 0, 0, TILE_WIDTH, TILE_HEIGHT);
                        } else {
                            context.drawImage(image, srcX, srcY, TILE_WIDTH, TILE_HEIGHT, destX, destY, TILE_WIDTH, TILE_HEIGHT);
                        }
                        context.restore();
                    }
                }
                context.globalAlpha = 1.0;
            }

            // Draw Cursor Border
            if (currentTool === "brush") {
                const drawW = paletteSelection.w * TILE_WIDTH;
                const drawH = paletteSelection.h * TILE_HEIGHT;

                context.beginPath();
                context.strokeStyle = "white";
                context.lineWidth = 1;
                context.setLineDash([4, 4]);
                context.strokeRect(gridX, gridY, drawW, drawH);

                context.strokeStyle = "black";
                context.lineDashOffset = 4;
                context.strokeRect(gridX, gridY, drawW, drawH);
                context.setLineDash([]);
                context.lineDashOffset = 0;
            } else {
                // Single tile hover (Eraser, Fill, etc)
                context.beginPath();
                context.strokeStyle = "white";
                context.lineWidth = 1;
                context.setLineDash([4, 4]);
                context.strokeRect(gridX, gridY, TILE_WIDTH, TILE_HEIGHT);

                context.strokeStyle = "black";
                context.lineDashOffset = 4;
                context.strokeRect(gridX, gridY, TILE_WIDTH, TILE_HEIGHT);
                context.setLineDash([]);
                context.lineDashOffset = 0;
            }
        }
    }

    useEffect(() => {
        renderMap();
    }, [layers, selection, mapSize, zoom, image, hoverPos, paletteSelection, currentTool, isFlipped]);

    function handleInternalMouseMove(e: MouseEvent<HTMLCanvasElement>) {
        // Calculate hover pos
        const x = e.nativeEvent.offsetX / zoom;
        const y = e.nativeEvent.offsetY / zoom;
        setHoverPos({ x, y });

        // Propagate
        onMouseMove(e);
    }

    function handleInternalMouseLeave() {
        setHoverPos(null);
        onMouseLeave();
    }

    function handleWheel(e: React.WheelEvent) {
        if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            setZoom((z) => {
                const newZoom = z - e.deltaY * 0.001;
                return Math.max(0.25, Math.min(4, newZoom));
            });
        }
    }

    return (
        <div className="border-2 border-gray-300 bg-gray-100 flex-1 overflow-auto relative rounded">
            <canvas
                ref={canvasRef}
                className="block bg-white shadow-sm origin-top-left"
                style={{
                    width: mapSize.width * TILE_WIDTH * zoom,
                    height: mapSize.height * TILE_HEIGHT * zoom,
                    imageRendering: "pixelated",
                }}
                onMouseDown={onMouseDown}
                onMouseMove={handleInternalMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={handleInternalMouseLeave}
                onWheel={handleWheel}
                aria-label="Map Grid"
                tabIndex={0}
            ></canvas>
        </div>
    );
}
