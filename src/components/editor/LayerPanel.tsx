import { type Layer } from "../../types";

type LayerPanelProps = {
    layers: Layer[];
    activeLayerIndex: number;
    setActiveLayerIndex: (index: number) => void;
    onToggleVisibility: (index: number) => void;
    onOpacityChange: (index: number, opacity: number) => void;
    onMoveLayer: (index: number, direction: 'up' | 'down') => void;
};

export function LayerPanel({
    layers,
    activeLayerIndex,
    setActiveLayerIndex,
    onToggleVisibility,
    onOpacityChange,
    onMoveLayer
}: LayerPanelProps) {
    return (
        <div className="h-40 border-t border-gray-300 bg-gray-50 p-2 flex flex-col">
            <h4 className="text-sm font-bold mb-2">Layers</h4>
            <div className="flex-1 overflow-auto space-y-1">
                {layers.map((layer, index) => (
                    <div
                        key={layer.id}
                        className={`flex flex-col p-2 rounded cursor-pointer ${activeLayerIndex === index ? "bg-blue-100 ring-1 ring-blue-500" : "hover:bg-gray-100"}`}
                        onClick={() => setActiveLayerIndex(index)}
                    >
                        <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center">
                                <button
                                    className="mr-2 text-gray-500 hover:text-black"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onToggleVisibility(index);
                                    }}
                                >
                                    {layer.visible ? "👁️" : "🚫"}
                                </button>
                                <span className={`text-sm font-medium select-none ${!layer.visible && "text-gray-400"}`}>{layer.name}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                                <button
                                    className="px-1 text-xs bg-gray-200 hover:bg-gray-300 rounded disabled:opacity-30"
                                    disabled={index === layers.length - 1}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onMoveLayer(index, 'up');
                                    }}
                                    title="Move Up"
                                >
                                    ↑
                                </button>
                                <button
                                    className="px-1 text-xs bg-gray-200 hover:bg-gray-300 rounded disabled:opacity-30"
                                    disabled={index === 0}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onMoveLayer(index, 'down');
                                    }}
                                    title="Move Down"
                                >
                                    ↓
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                            <span className="text-xs text-gray-500 w-12">Opacity:</span>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.1"
                                value={layer.opacity}
                                onChange={(e) => onOpacityChange(index, parseFloat(e.target.value))}
                                className="w-full h-1 bg-gray-300 rounded-lg appearance-none cursor-pointer"
                            />
                            <span className="text-xs text-gray-500 w-8 text-right">{Math.round(layer.opacity * 100)}%</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
