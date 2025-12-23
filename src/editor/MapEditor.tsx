import { useRef, useState, useEffect, type MouseEvent } from "react";
import { useImmer } from "use-immer";
import spritesheet from "../assets/project.png";
import { useMapState } from "../hooks/useMapState";
import { type TileData, type Tool, type SelectionRect } from "../types";
import { TILE_WIDTH, TILE_HEIGHT } from "../constants";
import { LayerPanel } from "../components/editor/LayerPanel";
import { Toolbar } from "../components/editor/Toolbar";
import { Palette } from "../components/editor/Palette";
import { RecentTiles } from "../components/editor/RecentTiles";
import { MapCanvas } from "../components/editor/MapCanvas";

export function MapEditor() {
    const {
        layers,
        setLayers,
        mapSize,
        setMapSize,
        saveCheckpoint,
        performUndo,
        performRedo
    } = useMapState();

    const [image, setImage] = useState<HTMLImageElement | null>(null);
    const [paletteWidth, setPaletteWidth] = useState(280);
    const [zoomMap, setZoomMap] = useState(1);
    const [zoomPalette, setZoomPalette] = useState(1);
    const [isFlipped, setIsFlipped] = useState(false);
    const [paletteSelection, setPaletteSelection] = useState<SelectionRect>({ x: 0, y: 0, w: 1, h: 1 });
    const [activeLayerIndex, setActiveLayerIndex] = useState(0);
    const [currentTool, setCurrentTool] = useState<Tool>("brush");
    const [selection, setSelection] = useState<SelectionRect | null>(null);
    const [clipboard, setClipboard] = useState<Record<string, TileData> | null>(null);
    const [recentStamps, setRecentStamps] = useImmer<SelectionRect[]>([]);

    const isMouseDown = useRef(false);
    const isResizing = useRef(false);
    const lastPaintedTiles = useRef<Set<string>>(new Set());
    const selectionStart = useRef<{ x: number; y: number } | null>(null);


    function addRecentStamp(stamp: SelectionRect) {
        setRecentStamps(draft => {
            // Remove exact duplicate
            const index = draft.findIndex(s =>
                s.x === stamp.x && s.y === stamp.y && s.w === stamp.w && s.h === stamp.h
            );
            if (index !== -1) {
                draft.splice(index, 1);
            }
            // Add to front
            draft.unshift(stamp);
            // Limit to 10
            if (draft.length > 10) {
                draft.pop();
            }
        });
    }

    // Load Image and Init
    useEffect(() => {
        if (!spritesheet) return;
        const img = new Image();
        img.src = spritesheet;
        img.onload = () => {

            setImage(img);
        };
    }, []);

    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            if (e.key.toLowerCase() === "b") setCurrentTool("brush");
            if (e.key.toLowerCase() === "e") setCurrentTool("eraser");
            if (e.key.toLowerCase() === "g" || e.key.toLowerCase() === "f") setCurrentTool("fill");
            if (e.key.toLowerCase() === "x") setIsFlipped(prev => !prev);

            if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
                e.preventDefault();
                setPaletteSelection(prev => {

                    if (!image) return prev;
                    let { x, y } = prev;
                    const maxW = Math.floor(image.width / TILE_WIDTH) - 1;
                    const maxH = Math.floor(image.height / TILE_HEIGHT) - 1;
                    if (e.key === "ArrowLeft") x = Math.max(0, x - 1);
                    if (e.key === "ArrowRight") x = Math.min(maxW, x + 1);
                    if (e.key === "ArrowUp") y = Math.max(0, y - 1);
                    if (e.key === "ArrowDown") y = Math.min(maxH, y + 1);

                    // Add to recent
                    const newSel = { ...prev, x, y };
                    addRecentStamp(newSel);

                    return newSel;
                });
                setCurrentTool("brush");
            }

            if (e.key === "Delete" || e.key === "Backspace") {
                if (selection) {
                    saveCheckpoint();
                    setLayers((draft) => {
                        const activeData = draft[activeLayerIndex].data;
                        for (let x = selection.x; x < selection.x + selection.w; x++) {
                            for (let y = selection.y; y < selection.y + selection.h; y++) {
                                delete activeData[`${x},${y}`];
                            }
                        }
                    });
                }
            }

            if ((e.metaKey || e.ctrlKey) && e.key === "z") {
                e.preventDefault();
                if (e.shiftKey) {
                    performRedo();
                } else {
                    performUndo();
                }
            }

            if ((e.metaKey || e.ctrlKey) && e.key === "c") {
                if (selection) {
                    const newClipboard: Record<string, TileData> = {};
                    const activeData = layers[activeLayerIndex].data;
                    for (let x = selection.x; x < selection.x + selection.w; x++) {
                        for (let y = selection.y; y < selection.y + selection.h; y++) {
                            const key = `${x},${y}`;
                            if (activeData[key]) {
                                newClipboard[`${x - selection.x},${y - selection.y}`] = activeData[key];
                            }
                        }
                    }
                    setClipboard(newClipboard);
                    console.log("Copied", Object.keys(newClipboard).length, "tiles");
                }
            }

            if ((e.metaKey || e.ctrlKey) && e.key === "v") {
                if (clipboard) {
                    saveCheckpoint();
                    const targetX = selection ? selection.x : 0;
                    const targetY = selection ? selection.y : 0;

                    setLayers((draft) => {
                        const activeData = draft[activeLayerIndex].data;
                        let maxClipboardX = 0;
                        if (isFlipped) {
                            Object.keys(clipboard).forEach(key => {
                                const [gx] = key.split(",").map(Number);
                                if (gx > maxClipboardX) maxClipboardX = gx;
                            });
                        }
                        Object.entries(clipboard).forEach(([key, tileData]) => {
                            const [gx, gy] = key.split(",").map(Number);
                            let finalGx = gx;
                            let finalTileData = { ...tileData };
                            if (isFlipped) {
                                finalGx = maxClipboardX - gx;
                                finalTileData.flipX = !finalTileData.flipX;
                            }
                            const finalX = targetX + finalGx;
                            const finalY = targetY + gy;
                            activeData[`${finalX},${finalY}`] = finalTileData;
                        });
                    });
                }
            }
        }

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [layers, selection, clipboard, activeLayerIndex, isFlipped, image]);

    // Resize Logic
    useEffect(() => {
        function handleMouseMove(e: globalThis.MouseEvent) {
            if (isResizing.current) {
                let newWidth = e.clientX;
                if (newWidth < 150) newWidth = 150;
                if (newWidth > 800) newWidth = 800;
                setPaletteWidth(newWidth);
            }
        }

        function handleMouseUp() {
            isResizing.current = false;
            document.body.style.cursor = "default";
        }

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, []);

    function paintTile(gridX: number, gridY: number, tileId: number | null) {
        const gx = Math.floor(gridX / TILE_WIDTH);
        const gy = Math.floor(gridY / TILE_HEIGHT);
        const key = `${gx},${gy}`;

        setLayers((draft) => {
            const activeData = draft[activeLayerIndex].data;
            if (tileId === null) {
                delete activeData[key];
            } else {
                activeData[key] = { tileId, flipX: isFlipped };
            }
        });
    }

    function floodFill(startGridX: number, startGridY: number, fillTileId: number) {
        const startKey = `${startGridX},${startGridY}`;
        setLayers((draft) => {
            const activeData = draft[activeLayerIndex].data;
            const startTileId = activeData[startKey]?.tileId;

            if (startTileId === fillTileId) return;

            const visited = new Set<string>();
            const queue = [[startGridX, startGridY]];

            const getId = (x: number, y: number) => activeData[`${x},${y}`]?.tileId;

            while (queue.length > 0) {
                const [cx, cy] = queue.pop()!;
                const key = `${cx},${cy}`;

                if (visited.has(key)) continue;
                if (cx < 0 || cx >= mapSize.width || cy < 0 || cy >= mapSize.height) continue;

                const currentId = getId(cx, cy);
                if (currentId !== startTileId) continue;

                visited.add(key);
                activeData[key] = { tileId: fillTileId, flipX: isFlipped };

                queue.push([cx + 1, cy]);
                queue.push([cx - 1, cy]);
                queue.push([cx, cy + 1]);
                queue.push([cx, cy - 1]);
            }
        });
    }

    function handleMapInteraction(e: MouseEvent<HTMLCanvasElement>) {
        // e.nativeEvent.offsetX is relative to the canvas
        const x = e.nativeEvent.offsetX / zoomMap;
        const y = e.nativeEvent.offsetY / zoomMap;

        const pixelWidth = mapSize.width * TILE_WIDTH;
        const pixelHeight = mapSize.height * TILE_HEIGHT;

        if (x < 0 || y < 0 || x >= pixelWidth || y >= pixelHeight) return;

        const gridX = Math.floor(x / TILE_WIDTH) * TILE_WIDTH;
        const gridY = Math.floor(y / TILE_HEIGHT) * TILE_HEIGHT;
        const gx = Math.floor(x / TILE_WIDTH);
        const gy = Math.floor(y / TILE_HEIGHT);
        const tileKey = `${gx},${gy}`;

        if (lastPaintedTiles.current.has(tileKey)) return;


        if (!image) return;
        const tilesPerRow = Math.floor(image.width / TILE_WIDTH);

        if (currentTool === "brush") {
            for (let dy = 0; dy < paletteSelection.h; dy++) {
                for (let dx = 0; dx < paletteSelection.w; dx++) {
                    const srcDx = isFlipped ? (paletteSelection.w - 1 - dx) : dx;
                    const px = paletteSelection.x + srcDx;
                    const py = paletteSelection.y + dy;
                    const tileId = py * tilesPerRow + px;

                    const targetX = gridX + (dx * TILE_WIDTH);
                    const targetY = gridY + (dy * TILE_HEIGHT);

                    if (targetX >= pixelWidth || targetY >= pixelHeight) continue;

                    paintTile(targetX, targetY, tileId);
                }
            }

            lastPaintedTiles.current.add(tileKey);
            // Add current palette selection to history on paint
            addRecentStamp(paletteSelection);
        } else if (currentTool === "eraser") {
            paintTile(gridX, gridY, null);
            lastPaintedTiles.current.add(tileKey);
        } else if (currentTool === "fill" && e.type === "mousedown") {
            const fillTileId = paletteSelection.y * tilesPerRow + paletteSelection.x;
            floodFill(gx, gy, fillTileId);
        } else if (currentTool === "marquee") {
            if (e.type === "mousedown") {
                selectionStart.current = { x: gx, y: gy };
                setSelection({ x: gx, y: gy, w: 1, h: 1 });
            } else if (isMouseDown.current && selectionStart.current) {
                const start = selectionStart.current;
                const minX = Math.min(start.x, gx);
                const minY = Math.min(start.y, gy);
                const w = Math.abs(start.x - gx) + 1;
                const h = Math.abs(start.y - gy) + 1;
                setSelection({ x: minX, y: minY, w, h });
            }
        }
    }

    function handleMapMouseDown(e: MouseEvent<HTMLCanvasElement>) {
        if (currentTool !== "marquee") {
            saveCheckpoint();
        }
        isMouseDown.current = true;
        lastPaintedTiles.current.clear();
        handleMapInteraction(e);
    }

    function handleMapMouseMove(e: MouseEvent<HTMLCanvasElement>) {
        if (isMouseDown.current) {
            handleMapInteraction(e);
        }
    }

    function handleMapMouseUp() {
        isMouseDown.current = false;
        lastPaintedTiles.current.clear();
    }

    function handleUploadImage(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        const img = new Image();
        img.onload = () => {
            setImage(img);
        };
        img.src = URL.createObjectURL(file);
    }

    function handleSaveMap() {
        const jsonString = JSON.stringify(layers, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "map_data.json";
        a.click();
        URL.revokeObjectURL(url);
    }

    function handleLoadMap(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const json = JSON.parse(ev.target?.result as string);
                if (Array.isArray(json)) {
                    setLayers(json);
                } else if (typeof json === "object" && json !== null) {
                    // Legacy
                    setLayers(draft => {
                        draft[0].data = json;
                    });
                } else {
                    alert("Invalid JSON format");
                }
            } catch (error) {
                alert("Failed to parse JSON");
            }
        };
        reader.readAsText(file);
    }

    function handleExportPng() {
        if (!image) return;

        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = mapSize.width * TILE_WIDTH;
        tempCanvas.height = mapSize.height * TILE_HEIGHT;
        const ctx = tempCanvas.getContext("2d");
        if (!ctx) return;

        layers.forEach(layer => {
            if (!layer.visible) return;
            ctx.globalAlpha = layer.opacity;

            Object.entries(layer.data).forEach(([key, tileData]) => {
                const [gx, gy] = key.split(",").map(Number);
                const drawX = gx * TILE_WIDTH;
                const drawY = gy * TILE_HEIGHT;

                const tilesPerRow = Math.floor(image.width / TILE_WIDTH);
                const srcX = (tileData.tileId % tilesPerRow) * TILE_WIDTH;
                const srcY = Math.floor(tileData.tileId / tilesPerRow) * TILE_HEIGHT;

                ctx.save();
                if (tileData.flipX) {
                    ctx.translate(drawX + TILE_WIDTH, drawY);
                    ctx.scale(-1, 1);
                    ctx.drawImage(image, srcX, srcY, TILE_WIDTH, TILE_HEIGHT, 0, 0, TILE_WIDTH, TILE_HEIGHT);
                } else {
                    ctx.drawImage(image, srcX, srcY, TILE_WIDTH, TILE_HEIGHT, drawX, drawY, TILE_WIDTH, TILE_HEIGHT);
                }
                ctx.restore();
            });
        });

        const url = tempCanvas.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = url;
        a.download = "map_image.png";
        a.click();
    }

    return (
        <div className="h-screen flex flex-col p-4 box-border">
            <h1 className="text-2xl font-bold mb-4">Map Editor</h1>

            <Toolbar
                mapSize={mapSize}
                setMapSize={setMapSize}
                currentTool={currentTool}
                setCurrentTool={setCurrentTool}
                onSave={handleSaveMap}
                onLoad={handleLoadMap}
                onExport={handleExportPng}
                onUploadImage={handleUploadImage}
            />

            <RecentTiles
                recentStamps={recentStamps}
                onSelect={(stamp) => {
                    setPaletteSelection(stamp);
                    setCurrentTool("brush");
                    addRecentStamp(stamp);
                }}
                image={image}
                activeStamp={paletteSelection}
            />

            <div className="flex gap-4 items-start flex-1 overflow-hidden">
                <div
                    className="flex-none flex flex-col h-full"
                    style={{ width: paletteWidth }}
                >
                    <Palette
                        image={image}
                        selection={paletteSelection}
                        setSelection={setPaletteSelection}
                        zoom={zoomPalette}
                        setZoom={setZoomPalette}
                        isFlipped={isFlipped}
                        onToolChange={() => setCurrentTool("brush")}
                    />
                </div>

                <div
                    className="w-1 cursor-col-resize h-full hover:bg-blue-400 bg-gray-200 flex-none transition-colors"
                    onMouseDown={() => {
                        isResizing.current = true;
                        document.body.style.cursor = "col-resize";
                    }}
                />

                <div className="flex-1 h-full min-w-0 flex flex-col">
                    <h3 className="font-bold mb-2">Map</h3>
                    <MapCanvas
                        layers={layers}
                        mapSize={mapSize}
                        zoom={zoomMap}
                        setZoom={setZoomMap}
                        selection={selection}
                        image={image}
                        currentTool={currentTool}
                        paletteSelection={paletteSelection}
                        isFlipped={isFlipped}
                        onMouseDown={handleMapMouseDown}
                        onMouseMove={handleMapMouseMove}
                        onMouseUp={handleMapMouseUp}
                        onMouseLeave={handleMapMouseUp}
                    />

                    <LayerPanel
                        layers={layers}
                        activeLayerIndex={activeLayerIndex}
                        setActiveLayerIndex={setActiveLayerIndex}
                        onToggleVisibility={(index) => {
                            setLayers(draft => {
                                draft[index].visible = !draft[index].visible;
                            });
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
