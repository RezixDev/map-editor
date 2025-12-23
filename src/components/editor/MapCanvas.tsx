import { useRef, useEffect, type MouseEvent } from "react";
import { type Layer, type SelectionRect, type Tool, type CustomBrush } from "../../types";
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
    customBrush: CustomBrush | null;
    cameraOffset: { x: number; y: number };
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
    customBrush,
    cameraOffset,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onMouseLeave,
}: MapCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const mousePosRef = useRef<{ x: number; y: number } | null>(null);
    const reqIdRef = useRef<number | null>(null);

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
        context.save();
        context.translate(cameraOffset.x, cameraOffset.y);

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
        context.restore();

        // 2. Draw Grid (with offset)
        context.save();
        context.translate(cameraOffset.x, cameraOffset.y);
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
        context.restore();

        // 3. Draw Selection Marquee (with offset)
        if (selection) {
            context.save();
            context.translate(cameraOffset.x, cameraOffset.y);
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
            context.restore();
        }

        // 4. Draw Ghost/Hover Cursor
        if (mousePosRef.current) {
            // Apply offset to ghost rendering
            context.save();
            context.translate(cameraOffset.x, cameraOffset.y);

            const gridX = Math.floor((mousePosRef.current.x - cameraOffset.x) / TILE_WIDTH) * TILE_WIDTH;
            const gridY = Math.floor((mousePosRef.current.y - cameraOffset.y) / TILE_HEIGHT) * TILE_HEIGHT;

            // Draw Ghost Tile
            if (currentTool === "brush" || currentTool === "fill") {
                context.globalAlpha = 0.5;

                if (customBrush && currentTool === "brush") {
                    // Render Custom Brush
                    Object.entries(customBrush.data).forEach(([key, tileData]) => {
                        const [dx, dy] = key.split(",").map(Number);

                        // Mirror ghost layout
                        const finalDx = isFlipped ? (customBrush.width - 1 - dx) : dx;

                        const drawX = gridX + (finalDx * TILE_WIDTH);
                        const drawY = gridY + (dy * TILE_HEIGHT);

                        const tilesPerRow = Math.floor(image.width / TILE_WIDTH);
                        const srcX = (tileData.tileId % tilesPerRow) * TILE_WIDTH;
                        const srcY = Math.floor(tileData.tileId / tilesPerRow) * TILE_HEIGHT;

                        context.save();
                        // Combined Flip Logic: Source Flip XOR Global Flip
                        const combinedFlip = tileData.flipX !== isFlipped;

                        if (combinedFlip) {
                            context.translate(drawX + TILE_WIDTH, drawY);
                            context.scale(-1, 1);
                            context.drawImage(image, srcX, srcY, TILE_WIDTH, TILE_HEIGHT, 0, 0, TILE_WIDTH, TILE_HEIGHT);
                        } else {
                            context.drawImage(image, srcX, srcY, TILE_WIDTH, TILE_HEIGHT, drawX, drawY, TILE_WIDTH, TILE_HEIGHT);
                        }
                        context.restore();
                    });
                } else if (currentTool === "fill") {
                    // Simple 1x1 ghost for Fill tool
                    const srcX = paletteSelection.x * TILE_WIDTH;
                    const srcY = paletteSelection.y * TILE_HEIGHT;

                    context.save();
                    if (isFlipped) {
                        context.translate(gridX + TILE_WIDTH, gridY);
                        context.scale(-1, 1);
                        context.drawImage(image, srcX, srcY, TILE_WIDTH, TILE_HEIGHT, 0, 0, TILE_WIDTH, TILE_HEIGHT);
                    } else {
                        context.drawImage(image, srcX, srcY, TILE_WIDTH, TILE_HEIGHT, gridX, gridY, TILE_WIDTH, TILE_HEIGHT);
                    }
                    context.restore();
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
            } else if (currentTool === "eraser" || currentTool === "fill") {
                // Single tile hover (Eraser, Fill)
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
            context.restore();
        }
    }

    useEffect(() => {
        function loop() {
            renderMap();
            reqIdRef.current = requestAnimationFrame(loop);
        }
        loop();
        return () => {
            if (reqIdRef.current) cancelAnimationFrame(reqIdRef.current);
        };
    }, [layers, selection, mapSize, zoom, image, paletteSelection, currentTool, isFlipped, cameraOffset, customBrush]);

    function handleInternalMouseMove(e: MouseEvent<HTMLCanvasElement>) {
        // Calculate hover pos
        const x = e.nativeEvent.offsetX / zoom;
        const y = e.nativeEvent.offsetY / zoom;
        mousePosRef.current = { x, y };

        // Propagate
        onMouseMove(e);
    }

    function handleInternalMouseLeave() {
        mousePosRef.current = null;
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
                    cursor: ((): string => {
                        switch (currentTool) {
                            case "brush":
                            case "eraser":
                            case "fill":
                                return "none"; // We render our own cursor
                            case "eyedropper":
                                return "crosshair";
                            case "marquee":
                                return "crosshair"; // Standard selection cursor
                            default:
                                return "default";
                        }
                    })()
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
