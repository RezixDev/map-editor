import { type Layer } from "../../types";

type LayerPanelProps = {
    layers: Layer[];
    activeLayerIndex: number;
    setActiveLayerIndex: (index: number) => void;
    onToggleVisibility: (index: number) => void;
};

export function LayerPanel({ layers, activeLayerIndex, setActiveLayerIndex, onToggleVisibility }: LayerPanelProps) {
    return (
        <div className="h-40 border-t border-gray-300 bg-gray-50 p-2 flex flex-col">
            <h4 className="text-sm font-bold mb-2">Layers</h4>
            <div className="flex-1 overflow-auto space-y-1">
                {layers.map((layer, index) => (
                    <div
                        key={layer.id}
                        className={`flex items-center p-1 rounded cursor-pointer ${activeLayerIndex === index ? "bg-blue-100 ring-1 ring-blue-500" : "hover:bg-gray-100"}`}
                        onClick={() => setActiveLayerIndex(index)}
                    >
                        <button
                            className="mr-2 text-gray-500 hover:text-black"
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleVisibility(index);
                            }}
                        >
                            {layer.visible ? "👁️" : "🚫"}
                        </button>
                        <span className={`text-sm select-none ${!layer.visible && "text-gray-400"}`}>{layer.name}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
