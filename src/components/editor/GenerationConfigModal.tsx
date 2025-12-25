import React, { useState, useEffect } from "react";
import { type TileGroup } from "../../types";

type Props = {
    isOpen: boolean;
    onClose: () => void;
    onGenerate: (selectedGroupIds: string[]) => void;
    tileGroups: Record<string, TileGroup>;
};

export function GenerationConfigModal({ isOpen, onClose, onGenerate, tileGroups }: Props) {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Initialize selection when opening
    useEffect(() => {
        if (isOpen) {
            // Default select all
            setSelectedIds(new Set(Object.keys(tileGroups)));
        }
    }, [isOpen, tileGroups]);

    if (!isOpen) return null;

    const terrainGroups = Object.values(tileGroups).filter(g => g.role === "terrain" && g.allowInGeneration !== false);
    const decoGroups = Object.values(tileGroups).filter(g => g.role === "decoration" && g.allowInGeneration !== false);

    const toggleId = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const handleGenerate = () => {
        onGenerate(Array.from(selectedIds));
    };

    const renderGroupItem = (group: TileGroup) => (
        <label key={group.id} className="flex items-center p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer">
            <input
                type="checkbox"
                checked={selectedIds.has(group.id)}
                onChange={() => toggleId(group.id)}
                className="mr-3 h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <div className="flex flex-col">
                <span className="font-medium text-gray-900 dark:text-gray-100">{group.name}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                    {group.canResize ? "Stretchable" : "Fixed"} {group.canFlip ? ", Flippable" : ""}
                </span>
            </div>
        </label>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-[500px] max-h-[80vh] flex flex-col">
                <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-100">Generation Settings</h2>
                <div className="flex-1 overflow-y-auto pr-2">

                    {/* Terrain Section */}
                    <div className="mb-6">
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Terrain (Platforms)</h3>
                        {terrainGroups.length === 0 && <p className="text-gray-400 italic text-sm">No terrain components found.</p>}
                        <div className="space-y-1">
                            {terrainGroups.map(renderGroupItem)}
                        </div>
                    </div>

                    {/* Decoration Section */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Decorations (Background)</h3>
                        {decoGroups.length === 0 && <p className="text-gray-400 italic text-sm">No decoration components found.</p>}
                        <div className="space-y-1">
                            {decoGroups.map(renderGroupItem)}
                        </div>
                    </div>

                </div>

                <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleGenerate}
                        className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-medium shadow-sm transition-colors"
                    >
                        Generate Level
                    </button>
                </div>
            </div>
        </div>
    );
}
