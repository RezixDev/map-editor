import { useRef, useState, useEffect, type MouseEvent } from "react";
import { type Layer, type SelectionRect, type Tool, TILE_WIDTH, TILE_HEIGHT } from "../../editor/types";

type MapCanvasProps = {
    layers: Layer[];
    mapSize: { width: number; height: number };
    activeLayerIndex: number;
    tool: Tool;
    image: HTMLImageElement | null;
    paletteSelection: SelectionRect;
    isFlipped: boolean;
    showMetadata: boolean;
    onPaint: (x: number, y: number) => void;
    onHover: (x: number, y: number) => void;
    onSelectionStart: (x: number, y: number) => void;
    onSelectionMove: (x: number, y: number) => void;
    selection: SelectionRect | null;
};

export function MapCanvas({
    layers, mapSize, activeLayerIndex, tool, image,
    paletteSelection, isFlipped, showMetadata,
    onPaint, onHover, onSelectionStart, onSelectionMove, selection
}: MapCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const contextRef = useRef<CanvasRenderingContext2D | null>(null);
    const [zoom, setZoom] = useState(1);
    const isMouseDown = useRef(false);

    // --- Render Logic ---
    function renderMap() {
        const canvas = canvasRef.current;
        const context = contextRef.current;
        if (!canvas || !context || !image) return;

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

                // Draw Metadata Indicator
                if (showMetadata && tileData.properties && Object.keys(tileData.properties).length > 0) {
                    context.beginPath();
                    context.fillStyle = "red";
                    context.arc(drawX + TILE_WIDTH - 4, drawY + 4, 3, 0, Math.PI * 2);
                    context.fill();
                }
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

            context.fillStyle = "rgba(0, 140, 255, 0.2)";
            context.fillRect(selX, selY, selW, selH);

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
    }

    // --- Interaction Handlers ---
    function handleWheel(e: React.WheelEvent) {
        if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            setZoom((z) => {
                const newZoom = z - e.deltaY * 0.001;
                return Math.max(0.25, Math.min(4, newZoom));
            });
        }
    }

    function handleMouseDown(e: MouseEvent<HTMLCanvasElement>) {
        isMouseDown.current = true;
        const x = e.nativeEvent.offsetX / zoom;
        const y = e.nativeEvent.offsetY / zoom;

        if (tool === "marquee") {
            const gridX = Math.floor(x / TILE_WIDTH);
            const gridY = Math.floor(y / TILE_HEIGHT);
            onSelectionStart(gridX, gridY);
        } else {
            onPaint(x, y);
        }
    }

    function handleMouseUp() {
        isMouseDown.current = false;
    }

    function handleMouseMove(e: MouseEvent<HTMLCanvasElement>) {
        const x = e.nativeEvent.offsetX / zoom;
        const y = e.nativeEvent.offsetY / zoom;

        if (isMouseDown.current) {
            if (tool === "marquee") {
                const gridX = Math.floor(x / TILE_WIDTH);
                const gridY = Math.floor(y / TILE_HEIGHT);
                onSelectionMove(gridX, gridY);
            } else {
                onPaint(x, y);
            }
        } else {
            // Hover logic (Ghost tile)
            renderMap(); // Clear prev ghost
            const context = contextRef.current;
            if (!context || !image) return;

            const gridX = Math.floor(x / TILE_WIDTH) * TILE_WIDTH;
            const gridY = Math.floor(y / TILE_HEIGHT) * TILE_HEIGHT;

            // Draw Ghost
            if (tool === "brush" || tool === "fill") {
                context.globalAlpha = 0.5;

                const previewW = tool === "brush" ? paletteSelection.w : 1;
                const previewH = tool === "brush" ? paletteSelection.h : 1;

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

            // Cursor Box
            context.beginPath();
            context.strokeStyle = "blue";
            context.lineWidth = 1;

            if (tool === "brush") {
                const drawW = paletteSelection.w * TILE_WIDTH;
                const drawH = paletteSelection.h * TILE_HEIGHT;

                context.strokeStyle = "white";
                context.setLineDash([4, 4]);
                context.strokeRect(gridX, gridY, drawW, drawH);
                context.strokeStyle = "black";
                context.lineDashOffset = 4;
                context.strokeRect(gridX, gridY, drawW, drawH);
            } else {
                context.strokeStyle = "white";
                context.setLineDash([4, 4]);
                context.strokeRect(gridX, gridY, TILE_WIDTH, TILE_HEIGHT);
                context.strokeStyle = "black";
                context.lineDashOffset = 4;
                context.strokeRect(gridX, gridY, TILE_WIDTH, TILE_HEIGHT);
            }
            context.setLineDash([]);
            context.lineDashOffset = 0;

            onHover(x, y);
        }
    }

    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas) contextRef.current = canvas.getContext("2d");
        if (image) renderMap();
    }, [image]);

    useEffect(() => {
        renderMap();
    }, [layers, selection, mapSize, zoom, showMetadata]);

    return (
        <div className="flex-1 h-full min-w-0 flex flex-col">
            <h3 className="font-bold mb-2">Map</h3>
            <div className="border-2 border-gray-300 bg-gray-100 flex-1 overflow-auto relative rounded">
                <canvas
                    id="myCanvas"
                    ref={canvasRef}
                    className="block bg-white shadow-sm origin-top-left"
                    style={{
                        width: mapSize.width * TILE_WIDTH * zoom,
                        height: mapSize.height * TILE_HEIGHT * zoom,
                        imageRendering: "pixelated"
                    }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onWheel={handleWheel}
                    tabIndex={0}
                />
            </div>
        </div>
    );
}
