import { useRef, useState } from "react";
import { useImmer } from "use-immer";
import { type Layer, TILE_WIDTH, TILE_HEIGHT } from "../editor/types";

export function useMapState() {
    const [layers, setLayers] = useImmer<Layer[]>([
        { id: "ground", name: "Ground", visible: true, opacity: 1, data: {} },
        { id: "decor", name: "Decoration", visible: true, opacity: 1, data: {} },
        { id: "collision", name: "Collision", visible: true, opacity: 0.5, data: {} },
    ]);
    const [activeLayerIndex, setActiveLayerIndex] = useState(0);

    // History Stacks
    const historyPast = useRef<Layer[][]>([]);
    const historyFuture = useRef<Layer[][]>([]);

    function saveCheckpoint() {
        historyPast.current.push(layers); // Immer state is already an immutable snapshot
        if (historyPast.current.length > 50) historyPast.current.shift(); // Limit history
        historyFuture.current = []; // Clear redo stack on new action
    }

    function performUndo() {
        if (historyPast.current.length === 0) return;

        const previous = historyPast.current.pop();
        if (previous) {
            historyFuture.current.push(layers);
            setLayers(previous);
        }
    }

    function performRedo() {
        if (historyFuture.current.length === 0) return;

        const next = historyFuture.current.pop();
        if (next) {
            historyPast.current.push(layers);
            setLayers(next);
        }
    }

    function paintTile(gridX: number, gridY: number, tileId: number | null, isFlipped: boolean) {
        const gx = Math.floor(gridX / TILE_WIDTH);
        const gy = Math.floor(gridY / TILE_HEIGHT);
        const key = `${gx},${gy}`;

        setLayers((draft) => {
            const activeLayer = draft[activeLayerIndex];
            const activeData = activeLayer.data;
            if (tileId === null) {
                delete activeData[key];
            } else {
                const properties = activeLayer.id === "collision" ? { isSolid: true } : undefined;
                activeData[key] = { tileId, flipX: isFlipped, properties };
            }
        });
    }

    function floodFill(startGridX: number, startGridY: number, fillTileId: number, isFlipped: boolean, mapSize: { width: number; height: number }) {
        const startKey = `${startGridX},${startGridY}`;
        setLayers((draft) => {
            const activeData = draft[activeLayerIndex].data;
            const startTileId = activeData[startKey]?.tileId;

            // Prevent infinite recursion if filling same color
            if (startTileId === fillTileId) return;

            const visited = new Set<string>();
            const queue = [[startGridX, startGridY]];

            // Helper to get ID (undefined if empty)
            const getId = (x: number, y: number) => activeData[`${x},${y}`]?.tileId;

            while (queue.length > 0) {
                const [cx, cy] = queue.pop()!;
                const key = `${cx},${cy}`;

                if (visited.has(key)) continue;
                if (cx < 0 || cx >= mapSize.width || cy < 0 || cy >= mapSize.height) continue;

                const currentId = getId(cx, cy);
                // Match if IDs are equal (including both undefined)
                if (currentId !== startTileId) continue;

                visited.add(key);
                // Mutation!
                activeData[key] = { tileId: fillTileId, flipX: isFlipped };

                queue.push([cx + 1, cy]);
                queue.push([cx - 1, cy]);
                queue.push([cx, cy + 1]);
                queue.push([cx, cy - 1]);
            }
        });
    }

    return {
        layers,
        setLayers,
        activeLayerIndex,
        setActiveLayerIndex,
        saveCheckpoint,
        performUndo,
        performRedo,
        paintTile,
        floodFill,
    };
}
