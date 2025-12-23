import React from "react";
import { type Tool } from "../../types";

type ToolbarProps = {
    mapSize: { width: number; height: number };
    setMapSize: React.Dispatch<React.SetStateAction<{ width: number; height: number }>>;
    currentTool: Tool;
    setCurrentTool: React.Dispatch<React.SetStateAction<Tool>>;
    onSave: () => void;
    onLoad: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onExport: () => void;
    onUploadImage: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

export function Toolbar({
    mapSize,
    setMapSize,
    currentTool,
    setCurrentTool,
    onSave,
    onLoad,
    onExport,
    onUploadImage,
}: ToolbarProps) {
    return (
        <div className="flex flex-wrap gap-4 items-center mb-4 flex-none">
            <div className="flex gap-2 items-center bg-gray-100 p-2 rounded">
                <label className="text-sm">
                    W:
                    <input
                        type="number"
                        className="ml-1 w-16 p-1 rounded border"
                        value={mapSize.width}
                        onChange={(e) => setMapSize((prev) => ({ ...prev, width: Number(e.target.value) }))}
                    />
                </label>
                <label className="text-sm">
                    H:
                    <input
                        type="number"
                        className="ml-1 w-16 p-1 rounded border"
                        value={mapSize.height}
                        onChange={(e) => setMapSize((prev) => ({ ...prev, height: Number(e.target.value) }))}
                    />
                </label>
            </div>
            <input type="file" accept="image/png" className="block" onChange={onUploadImage} />

            <div className="flex gap-1 bg-gray-100 p-1 rounded">
                <button
                    className={`px-3 py-1 rounded text-sm ${currentTool === "brush" ? "bg-blue-600 text-white" : "bg-white text-gray-700"}`}
                    onClick={() => setCurrentTool("brush")}
                    title="Shortcut: B"
                >
                    Brush
                </button>
                <button
                    className={`px-3 py-1 rounded text-sm ${currentTool === "eraser" ? "bg-blue-600 text-white" : "bg-white text-gray-700"}`}
                    onClick={() => setCurrentTool("eraser")}
                    title="Shortcut: E"
                >
                    Eraser
                </button>
                <button
                    className={`px-3 py-1 rounded text-sm ${currentTool === "fill" ? "bg-blue-600 text-white" : "bg-white text-gray-700"}`}
                    onClick={() => setCurrentTool("fill")}
                    title="Shortcut: F or G"
                >
                    Fill
                </button>
                <button
                    className={`px-3 py-1 rounded text-sm ${currentTool === "marquee" ? "bg-blue-600 text-white" : "bg-white text-gray-700"}`}
                    onClick={() => setCurrentTool("marquee")}
                >
                    Marquee
                </button>
            </div>

            <div className="flex gap-2 p-2 bg-gray-100 rounded border border-gray-300">
                <button
                    className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                    onClick={onSave}
                >
                    Save JSON
                </button>
                <label className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 cursor-pointer">
                    Load JSON
                    <input type="file" accept=".json" className="hidden" onChange={onLoad} />
                </label>
                <button
                    className="px-3 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700"
                    onClick={onExport}
                >
                    Export PNG
                </button>
            </div>
        </div>
    );
}
