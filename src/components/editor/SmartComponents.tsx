import React, { useRef, useEffect } from "react";
import type { TileGroup } from "../../types";
import { TILE_WIDTH, TILE_HEIGHT } from "../../constants";

type SmartComponentsProps = {
    image: HTMLImageElement | null;
    tileGroups: Record<string, TileGroup>;
    activeGroup: TileGroup | null;
    onSelectGroup: (group: TileGroup) => void;
    onCreateGroup: () => void;
    onDeleteGroup: (id: string) => void;
    onEditGroup: (group: TileGroup) => void;
};

export function SmartComponents({ image, tileGroups, activeGroup, onSelectGroup, onCreateGroup, onDeleteGroup, onEditGroup }: SmartComponentsProps) {
    // Helper to draw a preview for a group
    function GroupPreview({ group }: { group: TileGroup }) {
        const canvasRef = useRef<HTMLCanvasElement>(null);

        useEffect(() => {
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext("2d");
            if (!canvas || !ctx || !image) return;

            const tilesPerRow = Math.floor(image.width / TILE_WIDTH);

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            group.preview.forEach((tileId, index) => {
                const srcX = (tileId % tilesPerRow) * TILE_WIDTH;
                const srcY = Math.floor(tileId / tilesPerRow) * TILE_HEIGHT;

                ctx.drawImage(
                    image,
                    srcX, srcY, TILE_WIDTH, TILE_HEIGHT,
                    index * TILE_WIDTH, 0, TILE_WIDTH, TILE_HEIGHT
                );
            });
        }, [group, image]);

        return (
            <div
                className={`p-2 border rounded cursor-pointer mb-2 transition-colors relative group-item ${activeGroup?.id === group.id ? "bg-blue-100 dark:bg-blue-900 border-blue-500" : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
                onClick={() => onSelectGroup(group)}
            >
                <div className="flex justify-between items-start mb-1">
                    <div className="flex items-center gap-1">
                        <div className="text-xs font-bold text-gray-700 dark:text-gray-200">{group.name}</div>
                        <span className={`text-[8px] px-1 rounded ${group.role === 'decoration' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}`}>
                            {group.role === 'decoration' ? 'DEC' : 'TER'}
                        </span>
                    </div>
                    <div className="flex gap-1">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onEditGroup(group);
                            }}
                            className="text-gray-500 hover:text-blue-500 p-0.5"
                            title="Edit"
                        >
                            ✏️
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`Delete component "${group.name}"?`)) {
                                    onDeleteGroup(group.id);
                                }
                            }}
                            className="text-red-500 hover:text-red-700 p-0.5"
                            title="Delete"
                        >
                            ✕
                        </button>
                    </div>
                </div>
                <div className="flex gap-1">
                    <canvas
                        ref={canvasRef}
                        width={group.preview.length * TILE_WIDTH}
                        height={TILE_HEIGHT}
                        className="block"
                    />
                    {group.height > 1 && (
                        <span className="text-[10px] text-gray-500 self-end">x{group.height}</span>
                    )}
                </div>
            </div>
        );
    }

    if (!image) return null;

    return (
        <div className="flex-none flex flex-col h-full overflow-hidden">
            <div className="flex justify-between items-center mb-2 px-1">
                <h3 className="font-bold">Components</h3>
                <button
                    onClick={onCreateGroup}
                    className="px-2 py-0.5 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                    title="Create from Palette Selection (Select 3 tiles)"
                >
                    + Add
                </button>
            </div>
            <div className="flex-1 overflow-y-auto">
                {Object.values(tileGroups).map(group => (
                    <GroupPreview key={group.id} group={group} />
                ))}
            </div>
        </div>
    );
}
