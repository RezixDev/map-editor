import { useRef, useEffect } from "react";
import { type SelectionRect } from "../../types";

type RecentTilesProps = {
    recentStamps: SelectionRect[];
    onSelect: (stamp: SelectionRect) => void;
    image: HTMLImageElement | null;
    activeStamp: SelectionRect;
    gridSize: number;
};

export function RecentTiles({ recentStamps, onSelect, image, activeStamp, gridSize }: RecentTilesProps) {
    return (
        <div className="flex gap-2 p-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 overflow-x-auto h-12 items-center transition-colors">
            <span className="text-xs font-bold text-gray-500 mr-2 flex-none">History:</span>
            {recentStamps.map((stamp, i) => (
                <TilePreview
                    key={i}
                    stamp={stamp}
                    image={image}
                    gridSize={gridSize}
                    onClick={() => onSelect(stamp)}
                    isActive={
                        activeStamp.x === stamp.x &&
                        activeStamp.y === stamp.y &&
                        activeStamp.w === stamp.w &&
                        activeStamp.h === stamp.h
                    }
                />
            ))}
            {recentStamps.length === 0 && (
                <span className="text-xs text-gray-400 italic">Select stamps to see history...</span>
            )}
        </div>
    );
}

function TilePreview({
    stamp,
    image,
    gridSize,
    onClick,
    isActive,
}: {
    stamp: SelectionRect;
    image: HTMLImageElement | null;
    gridSize: number;
    onClick: () => void;
    isActive: boolean;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx || !image) return;

        // Scale down if large
        const stampW = stamp.w * gridSize;
        const stampH = stamp.h * gridSize;

        // Fit to 32x32 max
        const scale = Math.min(32 / stampW, 32 / stampH);

        ctx.clearRect(0, 0, 32, 32);
        ctx.imageSmoothingEnabled = false;

        const drawW = stampW * scale;
        const drawH = stampH * scale;

        // Center
        const offsetX = (32 - drawW) / 2;
        const offsetY = (32 - drawH) / 2;

        ctx.drawImage(
            image,
            stamp.x * gridSize,
            stamp.y * gridSize,
            stampW,
            stampH,
            offsetX,
            offsetY,
            drawW,
            drawH
        );

    }, [stamp, image, gridSize]);

    return (
        <div
            onClick={onClick}
            className={`w-8 h-8 border rounded flex-none cursor-pointer hover:border-blue-400 bg-white dark:bg-gray-800 transition-colors ${isActive ? "border-blue-600 ring-1 ring-blue-600" : "border-gray-300 dark:border-gray-600"
                }`}
            title={`Stamp ${stamp.x},${stamp.y} (${stamp.w}x${stamp.h})`}
        >
            <canvas ref={canvasRef} width={32} height={32} className="w-full h-full" />
        </div>
    );
}
