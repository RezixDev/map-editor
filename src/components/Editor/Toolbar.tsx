import { type Tool } from "../../editor/types";

type ToolbarProps = {
    currentTool: Tool;
    setTool: (tool: Tool) => void;
    mapSize: { width: number; height: number };
    setMapSize: (size: { width: number; height: number }) => void;
    showMetadata: boolean;
    setShowMetadata: (show: boolean) => void;
    onSave: () => void;
    onLoad: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onExport: () => void;
};

export function Toolbar({
    currentTool, setTool,
    mapSize, setMapSize,
    showMetadata, setShowMetadata,
    onSave, onLoad, onExport
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
                        onChange={(e) => setMapSize({ ...mapSize, width: Number(e.target.value) })}
                    />
                </label>
                <label className="text-sm">
                    H:
                    <input
                        type="number"
                        className="ml-1 w-16 p-1 rounded border"
                        value={mapSize.height}
                        onChange={(e) => setMapSize({ ...mapSize, height: Number(e.target.value) })}
                    />
                </label>
            </div>

            <div className="flex gap-1 bg-gray-100 p-1 rounded">
                <button
                    className={`px-3 py-1 rounded text-sm ${currentTool === "brush" ? "bg-blue-600 text-white" : "bg-white text-gray-700"}`}
                    onClick={() => setTool("brush")}
                    title="Shortcut: B"
                >
                    Brush
                </button>
                <button
                    className={`px-3 py-1 rounded text-sm ${currentTool === "eraser" ? "bg-blue-600 text-white" : "bg-white text-gray-700"}`}
                    onClick={() => setTool("eraser")}
                    title="Shortcut: E"
                >
                    Eraser
                </button>
                <button
                    className={`px-3 py-1 rounded text-sm ${currentTool === "fill" ? "bg-blue-600 text-white" : "bg-white text-gray-700"}`}
                    onClick={() => setTool("fill")}
                    title="Shortcut: F or G"
                >
                    Fill
                </button>
                <button
                    className={`px-3 py-1 rounded text-sm ${currentTool === "marquee" ? "bg-blue-600 text-white" : "bg-white text-gray-700"}`}
                    onClick={() => setTool("marquee")}
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
                    <input
                        type="file"
                        accept=".json"
                        className="hidden"
                        onChange={onLoad}
                    />
                </label>
                <button
                    className={`px-3 py-1 rounded text-sm ${showMetadata ? "bg-blue-600 text-white" : "bg-white text-gray-700"}`}
                    onClick={() => setShowMetadata(!showMetadata)}
                >
                    Metadata {showMetadata ? "ON" : "OFF"}
                </button>
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
