import { useRef, useState, useEffect, type MouseEvent } from "react";
import { type SelectionRect, TILE_WIDTH, TILE_HEIGHT } from "../../editor/types";

// --- Recent Stamp UI ---
type RecentStampProps = {
    rect: SelectionRect;
    image: HTMLImageElement | null;
    onClick: () => void;
    isActive: boolean;
};

function RecentStamp({ rect, image, onClick, isActive }: RecentStampProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !image) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        canvas.width = 32;
        canvas.height = 32;
        ctx.imageSmoothingEnabled = false;

        const srcX = rect.x * TILE_WIDTH;
        const srcY = rect.y * TILE_HEIGHT;
        const srcW = rect.w * TILE_WIDTH;
        const srcH = rect.h * TILE_HEIGHT;

        ctx.clearRect(0, 0, 32, 32);

        const aspect = srcW / srcH;
        let drawW = 32;
        let drawH = 32;
        let offX = 0;
        let offY = 0;

        if (aspect > 1) { // Wide
            drawH = 32 / aspect;
            offY = (32 - drawH) / 2;
        } else { // Tall
            drawW = 32 * aspect;
            offX = (32 - drawW) / 2;
        }

        ctx.drawImage(image, srcX, srcY, srcW, srcH, offX, offY, drawW, drawH);

    }, [rect, image]);

    return (
        <div
            className={`w-10 h-10 border rounded flex items-center justify-center cursor-pointer hover:bg-gray-200 ${isActive ? "border-blue-600 bg-blue-50 ring-1 ring-blue-300" : "border-gray-300 bg-white"}`}
            onClick={onClick}
            title={`Stamp ${rect.w}x${rect.h}`}
        >
            <canvas ref={canvasRef} className="block" style={{ width: 32, height: 32 }} />
        </div>
    );
}

// --- Main Palette Component ---
type PaletteProps = {
    image: HTMLImageElement | null;
    selection: SelectionRect;
    onSelectionChange: (rect: SelectionRect) => void;
    recentStamps: SelectionRect[];
    onAddToRecent: (rect: SelectionRect) => void;
    width: number;
    isFlipped: boolean;
};

export function Palette({ image, selection, onSelectionChange, recentStamps, onAddToRecent, width, isFlipped }: PaletteProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const contextRef = useRef<CanvasRenderingContext2D | null>(null);
    const [zoom, setZoom] = useState(1);

    // Interaction Refs
    const isMouseDown = useRef(false);
    const selectionStart = useRef<{ x: number; y: number } | null>(null);

    // --- Render Logic ---
    function renderPalette() {
        const canvas = canvasRef.current;
        const context = contextRef.current;
        if (!canvas || !context || !image) return;

        const logicalWidth = image.width;
        const logicalHeight = image.height;

        if (canvas.width !== logicalWidth || canvas.height !== logicalHeight) {
            canvas.width = logicalWidth;
            canvas.height = logicalHeight;
        }

        context.imageSmoothingEnabled = false;
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0);

        // Grid
        context.beginPath();
        for (let i = 0; i <= image.width; i += TILE_WIDTH) {
            context.moveTo(i, 0);
            context.lineTo(i, image.height);
        }
        for (let i = 0; i <= image.height; i += TILE_HEIGHT) {
            context.moveTo(0, i);
            context.lineTo(image.width, i);
        }
        context.strokeStyle = "rgba(0,0,0, 0.2)";
        context.lineWidth = 1;
        context.stroke();

        // Selection
        const drawX = selection.x * TILE_WIDTH;
        const drawY = selection.y * TILE_HEIGHT;
        const drawW = selection.w * TILE_WIDTH;
        const drawH = selection.h * TILE_HEIGHT;

        context.beginPath();
        context.strokeStyle = "white";
        context.lineWidth = 2;
        context.setLineDash([4, 4]);
        context.strokeRect(drawX, drawY, drawW, drawH);

        context.strokeStyle = "black";
        context.lineDashOffset = 4;
        context.strokeRect(drawX, drawY, drawW, drawH);

        context.setLineDash([]);
        context.lineDashOffset = 0;
    }

    // --- Interaction Handlers ---
    function handleMouseDown(e: MouseEvent<HTMLCanvasElement>) {
        if (!image) return;
        isMouseDown.current = true;
        const x = e.nativeEvent.offsetX / zoom;
        const y = e.nativeEvent.offsetY / zoom;

        const tileX = Math.floor(x / TILE_WIDTH);
        const tileY = Math.floor(y / TILE_HEIGHT);

        selectionStart.current = { x: tileX, y: tileY };
        onSelectionChange({ x: tileX, y: tileY, w: 1, h: 1 });
    }

    function handleMouseMove(e: MouseEvent<HTMLCanvasElement>) {
        if (!isMouseDown.current || !selectionStart.current || !image) return;

        const x = e.nativeEvent.offsetX / zoom;
        const y = e.nativeEvent.offsetY / zoom;

        const tileX = Math.max(0, Math.min(Math.floor(x / TILE_WIDTH), Math.floor(image.width / TILE_WIDTH) - 1));
        const tileY = Math.max(0, Math.min(Math.floor(y / TILE_HEIGHT), Math.floor(image.height / TILE_HEIGHT) - 1));

        const start = selectionStart.current;
        const minX = Math.min(start.x, tileX);
        const minY = Math.min(start.y, tileY);
        const w = Math.abs(start.x - tileX) + 1;
        const h = Math.abs(start.y - tileY) + 1;

        onSelectionChange({ x: minX, y: minY, w, h });
    }

    function handleMouseUp() {
        if (isMouseDown.current) {
            isMouseDown.current = false;
            // Add to recents
            onAddToRecent(selection);
        }
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

    // --- Effects ---
    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas) contextRef.current = canvas.getContext("2d");
        if (image) renderPalette();
    }, [image]);

    useEffect(() => {
        renderPalette();
    }, [selection, zoom]); // Re-render on these changes

    return (
        <div
            className="flex-none flex flex-col h-full"
            style={{ width }}
        >
            <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold">Palette</h3>
                <button
                    className="text-xs text-blue-600 hover:text-blue-800 underline"
                    onClick={() => setZoom(1)}
                >
                    Reset Zoom
                </button>
            </div>

            <div className="border border-gray-400 bg-gray-50 flex-1 overflow-auto">
                <canvas
                    ref={canvasRef}
                    className="cursor-pointer block origin-top-left"
                    style={{
                        width: image ? image.width * zoom : undefined,
                        height: image ? image.height * zoom : undefined,
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

            <div className="mt-2 text-sm text-gray-500">
                Drag to select multiple tiles.<br />
                Shortcuts: B (Brush), E (Eraser), F (Fill), X (Flip)
            </div>
            <div className={`mt-2 p-1 text-xs text-center border rounded ${isFlipped ? "bg-blue-100 border-blue-500 font-bold" : "bg-gray-100 text-gray-400"}`}>
                Flip X: {isFlipped ? "ON" : "OFF"}
            </div>

            {/* Recent Tiles */}
            <div className="mt-2 flex gap-1 px-1 border-t border-gray-200 pt-2 overflow-x-auto">
                {recentStamps.map((rect, i) => (
                    <RecentStamp
                        key={i}
                        rect={rect}
                        image={image}
                        isActive={selection.x === rect.x && selection.y === rect.y && selection.w === rect.w && selection.h === rect.h}
                        onClick={() => {
                            onSelectionChange(rect);
                            // Parent will handle switching tool to brush
                        }}
                    />
                ))}
            </div>
        </div>
    );
}

