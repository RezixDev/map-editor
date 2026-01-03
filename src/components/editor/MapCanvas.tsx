import { useRef, useEffect, type MouseEvent } from "react";
import { type Layer, type SelectionRect, type Tool, type CustomBrush, type TileGroup } from "../../types";
import { generatePlatformData } from "../../constants/tileGroups";

type MapCanvasProps = {
    layers: Layer[];
    mapSize: { width: number; height: number };
    gridSize: number;
    zoom: number;
    setZoom: React.Dispatch<React.SetStateAction<number>>;
    selection: SelectionRect | null;
    image: HTMLImageElement | null;
    currentTool: Tool;
    paletteSelection: SelectionRect;
    isFlipped: boolean;
    customBrush: CustomBrush | null;
    activeTileGroup: TileGroup | null;
    cameraOffset: { x: number; y: number };
    onMouseDown: (e: MouseEvent<HTMLCanvasElement>) => void;
    onMouseMove: (e: MouseEvent<HTMLCanvasElement>) => void;
    onMouseUp: () => void;
    onMouseLeave: () => void;
};

export function MapCanvas({
    layers,
    mapSize,
    gridSize,
    zoom,
    setZoom,
    selection,
    image,

    currentTool,
    paletteSelection,
    isFlipped,
    customBrush,
    activeTileGroup,
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
        const logicalWidth = mapSize.width * gridSize;
        const logicalHeight = mapSize.height * gridSize;

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
                const drawX = gx * gridSize;
                const drawY = gy * gridSize;

                const tilesPerRow = Math.floor(image.width / gridSize);
                const srcX = (tileData.tileId % tilesPerRow) * gridSize;
                const srcY = Math.floor(tileData.tileId / tilesPerRow) * gridSize;

                context.save();
                if (tileData.flipX) {
                    context.translate(drawX + gridSize, drawY);
                    context.scale(-1, 1);
                    context.drawImage(image, srcX, srcY, gridSize, gridSize, 0, 0, gridSize, gridSize);
                } else {
                    context.drawImage(image, srcX, srcY, gridSize, gridSize, drawX, drawY, gridSize, gridSize);
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
            context.moveTo(i * gridSize, 0);
            context.lineTo(i * gridSize, logicalHeight);
        }
        for (let i = 0; i <= mapSize.height; i++) {
            context.moveTo(0, i * gridSize);
            context.lineTo(logicalWidth, i * gridSize);
        }
        context.strokeStyle = "rgba(0,0,0, 0.4)";
        context.lineWidth = 1;
        context.stroke();
        context.restore();

        // 3. Draw Selection Marquee (with offset)
        if (selection) {
            context.save();
            context.translate(cameraOffset.x, cameraOffset.y);
            const selX = selection.x * gridSize;
            const selY = selection.y * gridSize;
            const selW = selection.w * gridSize;
            const selH = selection.h * gridSize;

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

            const gridX = Math.floor((mousePosRef.current.x - cameraOffset.x) / gridSize) * gridSize;
            const gridY = Math.floor((mousePosRef.current.y - cameraOffset.y) / gridSize) * gridSize;

            // Draw Ghost Tile
            if (currentTool === "brush" || currentTool === "fill") {
                context.globalAlpha = 0.5;

                if (customBrush && currentTool === "brush") {
                    // Render Custom Brush
                    Object.entries(customBrush.data).forEach(([key, tileData]) => {
                        const [dx, dy] = key.split(",").map(Number);

                        // Mirror ghost layout
                        const finalDx = isFlipped ? (customBrush.width - 1 - dx) : dx;

                        const drawX = gridX + (finalDx * gridSize);
                        const drawY = gridY + (dy * gridSize);

                        const tilesPerRow = Math.floor(image.width / gridSize);
                        const srcX = (tileData.tileId % tilesPerRow) * gridSize;
                        const srcY = Math.floor(tileData.tileId / tilesPerRow) * gridSize;

                        context.save();
                        // Combined Flip Logic: Source Flip XOR Global Flip
                        const combinedFlip = tileData.flipX !== isFlipped;

                        if (combinedFlip) {
                            context.translate(drawX + gridSize, drawY);
                            context.scale(-1, 1);
                            context.drawImage(image, srcX, srcY, gridSize, gridSize, 0, 0, gridSize, gridSize);
                        } else {
                            context.drawImage(image, srcX, srcY, gridSize, gridSize, drawX, drawY, gridSize, gridSize);
                        }
                        context.restore();
                    });
                } else if (currentTool === "fill") {
                    // Simple 1x1 ghost for Fill tool
                    const srcX = paletteSelection.x * gridSize;
                    const srcY = paletteSelection.y * gridSize;

                    context.save();
                    if (isFlipped) {
                        context.translate(gridX + gridSize, gridY);
                        context.scale(-1, 1);
                        context.drawImage(image, srcX, srcY, gridSize, gridSize, 0, 0, gridSize, gridSize);
                    } else {
                        context.drawImage(image, srcX, srcY, gridSize, gridSize, gridX, gridY, gridSize, gridSize);
                    }
                    context.restore();
                }

                context.globalAlpha = 1.0;
            } else if (currentTool === "smartBrush" && activeTileGroup) {
                context.globalAlpha = 0.5;

                // Determine width for preview
                let width = 1;
                const startX = selection ? selection.x * gridSize : gridX;
                const startY = selection ? selection.y * gridSize : gridY;

                if (selection) {
                    width = selection.w;
                }

                const platformData = generatePlatformData(width, activeTileGroup);
                const tilesPerRow = Math.floor(image.width / gridSize);

                Object.entries(platformData).forEach(([key, tileData]) => {
                    const [dx, dy] = key.split(",").map(Number);
                    const drawX = startX + (dx * gridSize);
                    const drawY = startY + (dy * gridSize);

                    const srcX = (tileData.tileId % tilesPerRow) * gridSize;
                    const srcY = Math.floor(tileData.tileId / tilesPerRow) * gridSize;

                    context.drawImage(image, srcX, srcY, gridSize, gridSize, drawX, drawY, gridSize, gridSize);
                });
                context.globalAlpha = 1.0;
            }

            // Draw Cursor Border
            if (currentTool === "brush") {
                const drawW = paletteSelection.w * gridSize;
                const drawH = paletteSelection.h * gridSize;

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
                // Add fill for eraser to make it more visible
                if (currentTool === "eraser") {
                    context.fillStyle = "rgba(255, 0, 0, 0.2)";
                    context.fillRect(gridX, gridY, gridSize, gridSize);
                }

                context.beginPath();
                context.strokeStyle = "white";
                context.lineWidth = 1;
                context.setLineDash([4, 4]);
                context.strokeRect(gridX, gridY, gridSize, gridSize);

                context.strokeStyle = "black";
                context.lineDashOffset = 4;
                context.strokeRect(gridX, gridY, gridSize, gridSize);
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

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const onWheel = (e: WheelEvent) => {
            if (e.metaKey || e.ctrlKey) {
                e.preventDefault();
                setZoom((z) => {
                    const newZoom = z - e.deltaY * 0.001;
                    return Math.max(0.25, Math.min(4, newZoom));
                });
            }
        };

        canvas.addEventListener("wheel", onWheel, { passive: false });
        return () => canvas.removeEventListener("wheel", onWheel);
    }, [setZoom]);

    return (
        <div className="border-2 border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 flex-1 overflow-auto relative rounded transition-colors">
            <canvas
                ref={canvasRef}
                className="block bg-white dark:bg-gray-900 shadow-sm origin-top-left transition-colors"
                style={{
                    width: mapSize.width * gridSize * zoom,
                    height: mapSize.height * gridSize * zoom,
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
                aria-label="Map Grid"
                tabIndex={0}
            ></canvas>
        </div>
    );
}
