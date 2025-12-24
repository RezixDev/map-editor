import { useState, useRef, useEffect } from "react";
import { type Layer } from "../../types";

type LayerPanelProps = {
    layers: Layer[];
    activeLayerIndex: number;
    setActiveLayerIndex: (index: number) => void;
    onToggleVisibility: (index: number) => void;
    onOpacityChange: (index: number, opacity: number) => void;
    onMoveLayer: (index: number, direction: 'up' | 'down') => void;
    onAddLayer: () => void;
    onRemoveLayer: (index: number) => void;
    onRenameLayer: (index: number, newName: string) => void;
};

export function LayerPanel({
    layers,
    activeLayerIndex,
    setActiveLayerIndex,
    onToggleVisibility,
    onOpacityChange,
    onMoveLayer,
    onAddLayer,
    onRemoveLayer,
    onRenameLayer
}: LayerPanelProps) {
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editName, setEditName] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (editingIndex !== null && inputRef.current) {
            inputRef.current.focus();
        }
    }, [editingIndex]);

    function startEditing(index: number, currentName: string) {
        setEditingIndex(index);
        setEditName(currentName);
    }

    function saveEditing() {
        if (editingIndex !== null) {
            if (editName.trim()) {
                onRenameLayer(editingIndex, editName.trim());
            }
            setEditingIndex(null);
            setEditName("");
        }
    }

    function handleKeyDown(e: React.KeyboardEvent) {
        if (e.key === "Enter") {
            saveEditing();
        } else if (e.key === "Escape") {
            setEditingIndex(null);
        }
    }

    return (
        <div className="h-48 border-t border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-2 flex flex-col transition-colors">
            <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-bold">Layers</h4>
                <button
                    onClick={onAddLayer}
                    className="px-2 py-0.5 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                    title="Add New Layer"
                >
                    + Add
                </button>
            </div>
            <div className="flex-1 overflow-auto space-y-1">
                {layers.map((layer, index) => (
                    <div
                        key={layer.id}
                        className={`flex flex-col p-2 rounded cursor-pointer transition-colors ${activeLayerIndex === index ? "bg-blue-100 dark:bg-blue-900 ring-1 ring-blue-500" : "hover:bg-gray-100 dark:hover:bg-gray-800"}`}
                        onClick={() => setActiveLayerIndex(index)}
                    >
                        <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center flex-1 min-w-0">
                                <button
                                    className="mr-2 text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white flex-none"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onToggleVisibility(index);
                                    }}
                                >
                                    {layer.visible ? "👁️" : "🚫"}
                                </button>

                                {editingIndex === index ? (
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        onBlur={saveEditing}
                                        onKeyDown={handleKeyDown}
                                        onClick={(e) => e.stopPropagation()}
                                        className="text-sm font-medium border border-blue-500 rounded px-1 w-full dark:bg-gray-700 dark:text-white"
                                    />
                                ) : (
                                    <span
                                        className={`text-sm font-medium select-none truncate ${!layer.visible && "text-gray-400 dark:text-gray-500"} ${activeLayerIndex === index ? "text-blue-900 dark:text-blue-100" : "text-gray-700 dark:text-gray-200"}`}
                                        onDoubleClick={(e) => {
                                            e.stopPropagation();
                                            startEditing(index, layer.name);
                                        }}
                                        title="Double click to rename"
                                    >{layer.name}</span>
                                )}
                            </div>
                            <div className="flex items-center space-x-1 ml-2">
                                <button
                                    className="px-1 text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded disabled:opacity-30 transition-colors"
                                    disabled={layers.length <= 1}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (confirm(`Delete layer "${layer.name}"?`)) {
                                            onRemoveLayer(index);
                                        }
                                    }}
                                    title="Delete Layer"
                                >
                                    🗑️
                                </button>
                                <button
                                    className="px-1 text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded disabled:opacity-30 transition-colors"
                                    disabled={index === layers.length - 1}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onMoveLayer(index, 'up');
                                    }}
                                    title="Move Up"
                                >
                                    ↓
                                </button>
                                <button
                                    className="px-1 text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded disabled:opacity-30 transition-colors"
                                    disabled={index === 0}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onMoveLayer(index, 'down');
                                    }}
                                    title="Move Down"
                                >
                                    ↑
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                            <span className="text-xs text-gray-500 dark:text-gray-400 w-12">Opacity:</span>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.1"
                                value={layer.opacity}
                                onChange={(e) => onOpacityChange(index, parseFloat(e.target.value))}
                                className="w-full h-1 bg-gray-300 rounded-lg appearance-none cursor-pointer"
                            />
                            <span className="text-xs text-gray-500 dark:text-gray-400 w-8 text-right">{Math.round(layer.opacity * 100)}%</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
