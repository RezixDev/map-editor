import React, { useState, useEffect } from "react";
import { type TileGroup } from "../../types";

type Props = {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: { name: string; role: "terrain" | "decoration" | "terrain-decoration"; canResize: boolean; canFlip: boolean; allowInGeneration: boolean; verticalAlignments?: ("top" | "bottom")[]; density?: number }) => void;
    initialData: TileGroup | null;
};

export function SmartComponentModal({ isOpen, onClose, onSave, initialData }: Props) {
    const [name, setName] = useState("");
    const [role, setRole] = useState<"terrain" | "decoration" | "terrain-decoration">("terrain");
    const [canResize, setCanResize] = useState(true);
    const [canFlip, setCanFlip] = useState(false);
    const [allowInGeneration, setAllowInGeneration] = useState(true);
    const [verticalAlignments, setVerticalAlignments] = useState<("top" | "bottom")[]>(["top"]);
    const [density, setDensity] = useState(5);

    useEffect(() => {
        if (initialData) {
            setName(initialData.name);
            setRole(initialData.role || "terrain");
            setCanResize(initialData.canResize ?? (initialData.role === "terrain"));
            setCanFlip(initialData.canFlip ?? false);
            setAllowInGeneration(initialData.allowInGeneration ?? true);
            // Migration/Fallback: check verticalAlignment (old) if verticalAlignments missing
            if (initialData.verticalAlignments) {
                setVerticalAlignments(initialData.verticalAlignments);
            } else if ((initialData as any).verticalAlignment) {
                setVerticalAlignments([(initialData as any).verticalAlignment]);
            } else {
                setVerticalAlignments(["top", "bottom"]); // Default to both? Or just top. Let's do both for terrain usually.
            }
            setDensity(initialData.density || 5);
        }
    }, [initialData, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            name,
            role,
            canResize,
            canFlip,
            allowInGeneration,
            verticalAlignments: (role === "decoration" || role === "terrain" || role === "terrain-decoration") ? verticalAlignments : undefined,
            density: (role === "decoration" || role === "terrain-decoration" || role === "terrain") ? density : undefined
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-96">
                <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-100">Edit Component</h2>
                <form onSubmit={handleSubmit} className="space-y-4">

                    {/* Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="mt-1 w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            required
                        />
                    </div>

                    {/* Role */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
                        <div className="flex gap-4">
                            <label className="flex items-center">
                                <input
                                    type="radio"
                                    checked={role === "terrain"}
                                    onChange={() => setRole("terrain")}
                                    className="mr-2"
                                />
                                <span className="text-gray-900 dark:text-gray-200">Terrain</span>
                            </label>
                            <label className="flex items-center">
                                <input
                                    type="radio"
                                    checked={role === "decoration"}
                                    onChange={() => setRole("decoration")}
                                    className="mr-2"
                                />
                                <span className="text-gray-900 dark:text-gray-200">Decoration</span>
                            </label>
                            <label className="flex items-center">
                                <input
                                    type="radio"
                                    checked={role === "terrain-decoration"}
                                    onChange={() => setRole("terrain-decoration")}
                                    className="mr-2"
                                />
                                <span className="text-gray-900 dark:text-gray-200">Terrain Decoration (On Top)</span>
                            </label>
                        </div>
                    </div>

                    {/* Constraints */}
                    <div className="space-y-2">
                        <label className="flex items-center">
                            <input
                                type="checkbox"
                                checked={canResize}
                                onChange={(e) => {
                                    setCanResize(e.target.checked);
                                    if (e.target.checked) setCanFlip(false); // Often mutually exclusive defaults
                                }}
                                className="mr-2"
                            />
                            <span className="text-gray-900 dark:text-gray-200">Stretchable (Repeating Pattern)</span>
                        </label>

                        {!canResize && (
                            <label className="flex items-center pl-4">
                                <input
                                    type="checkbox"
                                    checked={canFlip}
                                    onChange={(e) => setCanFlip(e.target.checked)}
                                    className="mr-2"
                                />
                                <span className="text-gray-900 dark:text-gray-200">Flippable (Random Mirror)</span>
                            </label>
                        )}

                        {/* Generation Toggle */}
                        <label className="flex items-center pt-2 border-t border-gray-200 dark:border-gray-700 mt-2">
                            <input
                                type="checkbox"
                                checked={allowInGeneration}
                                onChange={(e) => setAllowInGeneration(e.target.checked)}
                                className="mr-2"
                            />
                            <div className="flex flex-col">
                                <span className="text-gray-900 dark:text-gray-200">Allow in Generation</span>
                                <span className="text-xs text-gray-500">Enable specifically for procedural level generation</span>
                            </div>
                        </label>
                    </div>

                    <div className="flex justify-end gap-2 mt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                            Save
                        </button>
                    </div>

                    {/* Vertical Alignment and Density (Decoration and Terrain) */}
                    {(role === "decoration" || role === "terrain-decoration" || role === "terrain") && (
                        <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4 space-y-4">

                            {/* Vertical Alignment (Decoration & Terrain) */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Vertical Alignment
                                </label>
                                <div className="flex gap-4">
                                    <label className="flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={verticalAlignments.includes("top")}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setVerticalAlignments([...verticalAlignments, "top"]);
                                                } else {
                                                    setVerticalAlignments(verticalAlignments.filter(a => a !== "top"));
                                                }
                                            }}
                                            className="mr-2"
                                        />
                                        <span className="text-gray-900 dark:text-gray-200">Top (Sky)</span>
                                    </label>
                                    <label className="flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={verticalAlignments.includes("bottom")}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setVerticalAlignments([...verticalAlignments, "bottom"]);
                                                } else {
                                                    setVerticalAlignments(verticalAlignments.filter(a => a !== "bottom"));
                                                }
                                            }}
                                            className="mr-2"
                                        />
                                        <span className="text-gray-900 dark:text-gray-200">Bottom (Ground)</span>
                                    </label>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    Select where this component can generate. Select both for full coverage.
                                </p>
                            </div>

                            {/* Density Slider */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Density: {density}
                                </label>
                                <input
                                    type="range"
                                    min="1"
                                    max="10"
                                    value={density}
                                    onChange={(e) => setDensity(Number(e.target.value))}
                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                                />
                                <div className="flex justify-between text-xs text-gray-500 mt-1">
                                    <span>Sparse (1)</span>
                                    <span>Medium (5)</span>
                                    <span>Dense (10)</span>
                                </div>
                            </div>
                        </div>
                    )}

                </form>
            </div>
        </div>
    );
}
