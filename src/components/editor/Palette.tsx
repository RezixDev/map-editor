import React, { useRef, useEffect, type MouseEvent } from "react";
import { type SelectionRect } from "../../types";

type PaletteProps = {
    image: HTMLImageElement | null;
    selection: SelectionRect;
    setSelection: React.Dispatch<React.SetStateAction<SelectionRect>>;
    zoom: number;
    gridSize: number;
    setZoom: React.Dispatch<React.SetStateAction<number>>;
    isFlipped: boolean;
    onToolChange: () => void;
    onSelectionEnd?: (selection: SelectionRect) => void;
};

export function Palette({ image, selection, setSelection, zoom, setZoom, gridSize, isFlipped, onToolChange, onSelectionEnd }: PaletteProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isMouseDown = useRef(false);
    const selectionStart = useRef<{ x: number; y: number } | null>(null);

    function renderPalette() {
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context || !image) return;

        // Resize canvas logic:
        const logicalWidth = image.width;
        const logicalHeight = image.height;

        if (canvas.width !== logicalWidth || canvas.height !== logicalHeight) {
            canvas.width = logicalWidth;
            canvas.height = logicalHeight;
        }

        context.imageSmoothingEnabled = false;
        context.clearRect(0, 0, canvas.width, canvas.height);

        // Draw Source Image
        context.drawImage(image, 0, 0);

        // Draw Grid Overlay on Palette
        context.beginPath();
        // Vertical lines
        for (let i = 0; i <= image.width; i += gridSize) {
            context.moveTo(i, 0);
            context.lineTo(i, image.height);
        }
        // Horizontal lines
        for (let i = 0; i <= image.height; i += gridSize) {
            context.moveTo(0, i);
            context.lineTo(image.width, i);
        }
        context.strokeStyle = "rgba(0,0,0, 0.2)";
        context.lineWidth = 1;
        context.stroke();

        // Draw Selection Box on Palette
        const drawX = selection.x * gridSize;
        const drawY = selection.y * gridSize;
        const drawW = selection.w * gridSize;
        const drawH = selection.h * gridSize;

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

    useEffect(() => {
        renderPalette();
    }, [image, selection, zoom, gridSize]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const onWheel = (e: WheelEvent) => {
            if (e.metaKey || e.ctrlKey) {
                e.preventDefault();
                setZoom((z) => {
                    const newZoom = z - e.deltaY * 0.001;
                    // Clamp between 0.25x and 4x
                    return Math.max(0.25, Math.min(4, newZoom));
                });
            }
        };

        canvas.addEventListener("wheel", onWheel, { passive: false });
        return () => canvas.removeEventListener("wheel", onWheel);
    }, [setZoom]);

    function handleMouseDown(e: MouseEvent<HTMLCanvasElement>) {
        const canvas = canvasRef.current;
        if (!canvas) return;

        isMouseDown.current = true;
        const x = e.nativeEvent.offsetX / zoom;
        const y = e.nativeEvent.offsetY / zoom;

        const tileX = Math.floor(x / gridSize);
        const tileY = Math.floor(y / gridSize);

        selectionStart.current = { x: tileX, y: tileY };
        setSelection({ x: tileX, y: tileY, w: 1, h: 1 });

        onToolChange();
    }

    function handleMouseMove(e: MouseEvent<HTMLCanvasElement>) {
        if (!isMouseDown.current || !selectionStart.current) return;

        const canvas = canvasRef.current;
        if (!canvas || !image) return;

        const x = e.nativeEvent.offsetX / zoom;
        const y = e.nativeEvent.offsetY / zoom;

        // Constrain to image bounds
        const tileX = Math.max(0, Math.min(Math.floor(x / gridSize), Math.floor(image.width / gridSize) - 1));
        const tileY = Math.max(0, Math.min(Math.floor(y / gridSize), Math.floor(image.height / gridSize) - 1));

        const start = selectionStart.current;
        const minX = Math.min(start.x, tileX);
        const minY = Math.min(start.y, tileY);
        const w = Math.abs(start.x - tileX) + 1;
        const h = Math.abs(start.y - tileY) + 1;

        setSelection({ x: minX, y: minY, w, h });
    }

    function handleMouseUp() {
        if (isMouseDown.current && onSelectionEnd) {
            onSelectionEnd(selection);
        }
        isMouseDown.current = false;
    }



    return (
        <div className="flex-1 flex flex-col min-h-0" style={{ width: "100%" }}>
            <h3 className="font-bold mb-2">Palette</h3>
            <div className="border border-gray-400 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 flex-1 overflow-auto transition-colors">
                <canvas
                    ref={canvasRef}
                    className="cursor-pointer block origin-top-left"
                    style={{
                        width: image ? image.width * zoom : undefined,
                        height: image ? image.height * zoom : undefined,
                        imageRendering: "pixelated",
                    }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    aria-label="Palette Grid - Use arrow keys to navigate"
                    tabIndex={0}
                />
            </div>
            <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Drag to select multiple tiles.
                <br />
                Shortcuts: B (Brush), E (Eraser), F (Fill), X (Flip)
            </div>
            <div
                className={`mt-2 p-1 text-xs text-center border rounded transition-colors ${isFlipped ? "bg-blue-100 dark:bg-blue-900 border-blue-500 font-bold" : "bg-gray-100 dark:bg-gray-800 text-gray-400"}`}
            >
                Flip X: {isFlipped ? "ON" : "OFF"}
            </div>
        </div>
    );
}
