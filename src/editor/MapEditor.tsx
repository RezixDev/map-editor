import { useRef, useState, useEffect, type MouseEvent } from "react";
import spritesheet from "../assets/project.png";
import { useMapState } from "../hooks/useMapState";
import { type TileData, type Tool, type SelectionRect, type CustomBrush } from "../types";
import { LayerPanel } from "../components/editor/LayerPanel";
import { Toolbar } from "../components/editor/Toolbar";
import { Palette } from "../components/editor/Palette";
import { RecentTiles } from "../components/editor/RecentTiles";
import { MapCanvas } from "../components/editor/MapCanvas";
import { SmartComponents } from "../components/editor/SmartComponents";
import { SmartComponentModal } from "../components/editor/SmartComponentModal";
import { GenerationConfigModal } from "../components/editor/GenerationConfigModal";
import { type TileGroup } from "../types";
import { generatePlatformData } from "../constants/tileGroups";
import { generateProceduralLevel } from "../utils/levelGen";

export function MapEditor() {
    const {
        layers,
        setLayers,
        mapSize,
        setMapSize,
        saveCheckpoint,
        performUndo,

        performRedo,
        recentStamps,
        addRecentStamp,
        addLayer,
        removeLayer,
        renameLayer,
        tileGroups,
        addTileGroup,
        removeTileGroup,
        updateTileGroup,
        clearTileGroups,
        clearMap,
        gridSize,
        setGridSize,
        setRecentStamps,
        setTileGroups
    } = useMapState();

    const [image, setImage] = useState<HTMLImageElement | null>(null);
    const [editingGroup, setEditingGroup] = useState<TileGroup | null>(null);
    const [showGenModal, setShowGenModal] = useState(false);

    // Add effect to prevent scrolling when modal is open if needed, implies logic here.
    const [paletteWidth, setPaletteWidth] = useState(280);

    // ... (skipping unchanged lines in state block if possible, but for safety I will include the state block and Toolbar replacement)

    const [zoomMap, setZoomMap] = useState(1);
    const [zoomPalette, setZoomPalette] = useState(1);
    const [cameraOffset, setCameraOffset] = useState({ x: 0, y: 0 });
    const [isFlipped, setIsFlipped] = useState(false);
    const [paletteSelection, setPaletteSelection] = useState<SelectionRect>({ x: 0, y: 0, w: 1, h: 1 });
    const [activeLayerIndex, setActiveLayerIndex] = useState(0);
    const [currentTool, setCurrentTool] = useState<Tool>("brush");
    const [selection, setSelection] = useState<SelectionRect | null>(null);
    const [activeTileGroup, setActiveTileGroup] = useState<TileGroup | null>(null);

    const [clipboard, setClipboard] = useState<Record<string, TileData> | null>(null);
    const [customBrush, setCustomBrush] = useState<CustomBrush | null>(null);


    const isMouseDown = useRef(false);
    const isPanning = useRef(false);
    const isSpacePressed = useRef(false);
    const isResizing = useRef(false);
    const lastPaintedTiles = useRef<Set<string>>(new Set());
    const selectionStart = useRef<{ x: number; y: number } | null>(null);

    // ... (functions omitted, jumping to return)

    function updatePaletteSelection(newSelection: SelectionRect) {
        setPaletteSelection(newSelection);

        if (!image) return;
        const tilesPerRow = Math.floor(image.width / gridSize);
        const brushData: Record<string, TileData> = {};

        for (let dy = 0; dy < newSelection.h; dy++) {
            for (let dx = 0; dx < newSelection.w; dx++) {
                const srcX = newSelection.x + dx;
                const srcY = newSelection.y + dy;
                const tileId = srcY * tilesPerRow + srcX;
                brushData[`${dx},${dy}`] = { tileId, flipX: false };
            }
        }

        setCustomBrush({
            width: newSelection.w,
            height: newSelection.h,
            data: brushData
        });
    }

    function sampleArea(area: { x: number, y: number, w: number, h: number }) {
        if (!image) return;

        const brushData: Record<string, TileData> = {};
        let foundTiles = false;
        let minX = Infinity;
        let minY = Infinity;

        // 1. Capture Data
        for (let dy = 0; dy < area.h; dy++) {
            for (let dx = 0; dx < area.w; dx++) {
                const mapX = area.x + dx;
                const mapY = area.y + dy;
                const key = `${mapX},${mapY}`;

                let tile = layers[activeLayerIndex].data[key];
                if (!tile) {
                    for (let i = layers.length - 1; i >= 0; i--) {
                        if (!layers[i].visible) continue;
                        if (layers[i].data[key]) {
                            tile = layers[i].data[key];
                            break;
                        }
                    }
                }

                if (tile) {
                    brushData[`${dx},${dy}`] = tile;
                    foundTiles = true;
                    if (dx < minX) minX = dx;
                    if (dy < minY) minY = dy;
                }
            }
        }

        if (foundTiles) {
            // Trim empty space from top-left (smart anchor)
            const trimmedData: Record<string, TileData> = {};
            let maxWidth = 0;
            let maxHeight = 0;

            Object.entries(brushData).forEach(([key, tile]) => {
                const [dx, dy] = key.split(",").map(Number);
                const newX = dx - minX;
                const newY = dy - minY;
                trimmedData[`${newX},${newY}`] = tile;
                if (newX >= maxWidth) maxWidth = newX;
                if (newY >= maxHeight) maxHeight = newY;
            });

            const newBrush: CustomBrush = {
                width: maxWidth + 1,
                height: maxHeight + 1,
                data: trimmedData
            };

            setCustomBrush(newBrush);
            setCurrentTool("brush");
            setSelection(null);

            // Retroactive History Support
            // Try to see if this matches a contiguous spritesheet rect for the palette/history
            // If complex/scattered, we skip adding to history for now.
            const firstTile = Object.values(trimmedData)[0];
            if (firstTile) {
                // Check if *all* tiles align contiguously on spritesheet relative to the first
                const tilesPerRow = Math.floor(image.width / gridSize);
                const firstId = firstTile.tileId;
                const startSrcX = firstId % tilesPerRow;
                const startSrcY = Math.floor(firstId / tilesPerRow);

                let isContiguous = true;
                for (let y = 0; y < newBrush.height; y++) {
                    for (let x = 0; x < newBrush.width; x++) {
                        const t = trimmedData[`${x},${y}`];
                        if (!t) continue; // Gaps are allowed in custom brush, but might break rect check if strictly rect

                        const expectedId = (startSrcY + y) * tilesPerRow + (startSrcX + x);
                        if (t.tileId !== expectedId) {
                            isContiguous = false;
                            break;
                        }
                    }
                    if (!isContiguous) break;
                }

                if (isContiguous) {
                    const newSel = { x: startSrcX, y: startSrcY, w: newBrush.width, h: newBrush.height };
                    setPaletteSelection(newSel);
                    addRecentStamp(newSel);
                } else {
                    // Clear palette selection to indicate custom brush
                    setPaletteSelection({ x: 0, y: 0, w: 0, h: 0 }); // Or some indicator
                }
            }

        }
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

            if (e.code === "Space") {
                e.preventDefault();
                isSpacePressed.current = true;
                document.body.style.cursor = "grab";
                return;
            }

            if (e.key.toLowerCase() === "i") {
                if (selection) {
                    sampleArea(selection);
                } else {
                    setCurrentTool("eyedropper");
                }
            }
            if (e.key.toLowerCase() === "b") setCurrentTool("brush");
            if (e.key.toLowerCase() === "e") setCurrentTool("eraser");
            if (e.key.toLowerCase() === "g" || e.key.toLowerCase() === "f") setCurrentTool("fill");
            if (e.key.toLowerCase() === "x") setIsFlipped(prev => !prev);

            if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
                e.preventDefault();
                setPaletteSelection(prev => {
                    if (!image) return prev;
                    let { x, y } = prev;
                    const maxW = Math.floor(image.width / gridSize) - 1;
                    const maxH = Math.floor(image.height / gridSize) - 1;
                    if (e.key === "ArrowLeft") x = Math.max(0, x - 1);
                    if (e.key === "ArrowRight") x = Math.min(maxW, x + 1);
                    if (e.key === "ArrowUp") y = Math.max(0, y - 1);
                    if (e.key === "ArrowDown") y = Math.min(maxH, y + 1);

                    const newSel = { ...prev, x, y };
                    addRecentStamp(newSel);

                    // Sync custom brush explicitly here since we need access to the calculated newSel
                    // and we can't easily use the helper inside the functional update.
                    const tilesPerRow = Math.floor(image.width / gridSize);
                    const brushData: Record<string, TileData> = {};
                    for (let dy = 0; dy < newSel.h; dy++) {
                        for (let dx = 0; dx < newSel.w; dx++) {
                            const srcX = newSel.x + dx;
                            const srcY = newSel.y + dy;
                            const tileId = srcY * tilesPerRow + srcX;
                            brushData[`${dx},${dy}`] = { tileId, flipX: false };
                        }
                    }
                    setCustomBrush({
                        width: newSel.w,
                        height: newSel.h,
                        data: brushData
                    });

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

        function handleKeyUp(e: KeyboardEvent) {
            if (e.code === "Space") {
                isSpacePressed.current = false;
                isPanning.current = false;
                document.body.style.cursor = "default";
            }
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
                e.preventDefault();
                if (e.shiftKey) {
                    console.log("Key Redo");
                    performRedo();
                } else {
                    console.log("Key Undo");
                    performUndo();
                }
            }

            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") {
                e.preventDefault();
                console.log("Key Redo (Y)");
                performRedo();
            }
        }

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("keyup", handleKeyUp);
        };
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

    function paintTile(gridX: number, gridY: number, tileId: number | null, flipX?: boolean) {
        const gx = Math.floor(gridX / gridSize);
        const gy = Math.floor(gridY / gridSize);
        const key = `${gx},${gy}`;

        setLayers((draft) => {
            const activeData = draft[activeLayerIndex].data;
            if (tileId === null) {
                delete activeData[key];
            } else {
                activeData[key] = { tileId, flipX: flipX !== undefined ? flipX : isFlipped };
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
        if (isPanning.current) return;

        // e.nativeEvent.offsetX is relative to the canvas
        // Account for Zoom AND Camera Offset
        const x = (e.nativeEvent.offsetX / zoomMap) - cameraOffset.x;
        const y = (e.nativeEvent.offsetY / zoomMap) - cameraOffset.y;

        const pixelWidth = mapSize.width * gridSize;
        const pixelHeight = mapSize.height * gridSize;

        if (x < 0 || y < 0 || x >= pixelWidth || y >= pixelHeight) return;

        const gridX = Math.floor(x / gridSize) * gridSize;
        const gridY = Math.floor(y / gridSize) * gridSize;
        const gx = Math.floor(x / gridSize);
        const gy = Math.floor(y / gridSize);
        const tileKey = `${gx},${gy}`;

        if (lastPaintedTiles.current.has(tileKey)) return;


        if (!image) return;
        const tilesPerRow = Math.floor(image.width / gridSize);

        if (currentTool === "brush") {
            if (customBrush) {
                // Unified Paint Logic
                Object.entries(customBrush.data).forEach(([key, tileData]) => {
                    const [dx, dy] = key.split(",").map(Number);

                    // Mirror the brush layout if flipped
                    const finalDx = isFlipped ? (customBrush.width - 1 - dx) : dx;

                    const targetX = gridX + (finalDx * gridSize);
                    const targetY = gridY + (dy * gridSize);

                    if (targetX >= pixelWidth || targetY >= pixelHeight) return;

                    // Combined Flip Logic: Source Flip XOR Global Flip
                    const combinedFlip = tileData.flipX !== isFlipped;

                    paintTile(targetX, targetY, tileData.tileId, combinedFlip);
                });
            }

            lastPaintedTiles.current.add(tileKey);
            // We assume customBrush is always set now if we are brushing.
            // If it's a "Standard" selection, it's already in history via updatePaletteSelection.
            // If it's a "Custom" sampled brush, we added it to history if applicable in sampleArea.
        } else if (currentTool === "eraser") {
            paintTile(gridX, gridY, null);
            lastPaintedTiles.current.add(tileKey);
        } else if (currentTool === "fill" && e.type === "mousedown") {
            const fillTileId = paletteSelection.y * tilesPerRow + paletteSelection.x;
            floodFill(gx, gy, fillTileId);
        } else if (currentTool === "marquee" || currentTool === "eyedropper") {
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
        } else if (currentTool === "smartBrush") {
            if (e.type === "mousedown") {
                selectionStart.current = { x: gx, y: gy };
                setSelection({ x: gx, y: gy, w: 1, h: 1 });
            } else if (isMouseDown.current && selectionStart.current) {
                const start = selectionStart.current;
                // Horizontal only for now
                const w = Math.abs(start.x - gx) + 1;
                const minX = Math.min(start.x, gx);
                setSelection({ x: minX, y: start.y, w: w, h: 1 });
            }
        }
    }

    function handleMapMouseDown(e: MouseEvent<HTMLCanvasElement>) {
        if (isSpacePressed.current) {
            isPanning.current = true;
            document.body.style.cursor = "grabbing";
            return;
        }

        // Eyedropper Logic
        // Alt-click to quick pick single tile (Legacy/Power User)
        if (e.altKey) {
            if (!image) return;
            const x = (e.nativeEvent.offsetX / zoomMap) - cameraOffset.x;
            const y = (e.nativeEvent.offsetY / zoomMap) - cameraOffset.y;
            const gx = Math.floor(x / gridSize);
            const gy = Math.floor(y / gridSize);

            sampleArea({ x: gx, y: gy, w: 1, h: 1 });
            return;
        }

        if (currentTool !== "marquee" && currentTool !== "eyedropper") {
            saveCheckpoint();
        }
        isMouseDown.current = true;
        lastPaintedTiles.current.clear();
        handleMapInteraction(e);
    }

    function handleMapMouseMove(e: MouseEvent<HTMLCanvasElement>) {
        if (isPanning.current) {
            setCameraOffset(prev => ({
                x: prev.x + e.movementX / zoomMap,
                y: prev.y + e.movementY / zoomMap
            }));
            return;
        }

        if (isMouseDown.current) {
            handleMapInteraction(e);
        }
    }

    function handleMapMouseUp() {
        if (isPanning.current) {
            isPanning.current = false;
            document.body.style.cursor = isSpacePressed.current ? "grab" : "default";
            return;
        }

        isMouseDown.current = false;
        lastPaintedTiles.current.clear();

        if (currentTool === "eyedropper" && selection) {
            sampleArea(selection);
        } else if (currentTool === "smartBrush" && selection && activeTileGroup) {
            saveCheckpoint();
            const width = selection.w;
            const platformData = generatePlatformData(width, activeTileGroup);
            const startX = selection.x;
            const startY = selection.y;

            setLayers((draft) => {
                const activeData = draft[activeLayerIndex].data;
                Object.entries(platformData).forEach(([key, tileData]) => {
                    const [dx, dy] = key.split(",").map(Number);
                    const finalX = startX + dx;
                    const finalY = startY + dy;
                    activeData[`${finalX},${finalY}`] = { ...tileData, flipX: false };
                });
            });
            setSelection(null);
        }
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
                const data = JSON.parse(ev.target?.result as string);
                if (data && Array.isArray(data.layers) && data.mapSize) {
                    setLayers(data.layers);
                    setMapSize(data.mapSize);
                    if (data.gridSize) setGridSize(data.gridSize);
                    if (data.recentStamps) setRecentStamps(data.recentStamps);
                    if (data.tileGroups) setTileGroups(data.tileGroups);
                } else if (Array.isArray(data)) {
                    // Legacy layers only
                    setLayers(data);
                }
            } catch (err) {
                console.error("Failed to parse map file", err);
                alert("Invalid JSON map file.");
            }
        };
        reader.readAsText(file);
    }

    function handleGridSizeChange(newSize: number) {
        // Check if map is not empty
        const hasTiles = layers.some(l => Object.keys(l.data).length > 0);
        const hasGroups = Object.keys(tileGroups).length > 0;

        if (hasTiles || hasGroups) {
            if (confirm("Changing grid size requires clearing the current map to prevent errors. Continue?")) {
                clearMap();
                clearTileGroups();
                setGridSize(newSize);
            }
        } else {
            setGridSize(newSize);
        }
    }

    function handleExportPng() {
        if (!image) return;

        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = mapSize.width * gridSize;
        tempCanvas.height = mapSize.height * gridSize;
        const ctx = tempCanvas.getContext("2d");
        if (!ctx) return;

        layers.forEach(layer => {
            if (!layer.visible) return;
            ctx.globalAlpha = layer.opacity;

            Object.entries(layer.data).forEach(([key, tileData]) => {
                const [gx, gy] = key.split(",").map(Number);
                const drawX = gx * gridSize;
                const drawY = gy * gridSize;

                const tilesPerRow = Math.floor(image.width / gridSize);
                const srcX = (tileData.tileId % tilesPerRow) * gridSize;
                const srcY = Math.floor(tileData.tileId / tilesPerRow) * gridSize;

                ctx.save();
                if (tileData.flipX) {
                    ctx.translate(drawX + gridSize, drawY);
                    ctx.scale(-1, 1);
                    ctx.drawImage(image, srcX, srcY, gridSize, gridSize, 0, 0, gridSize, gridSize);
                } else {
                    ctx.drawImage(image, srcX, srcY, gridSize, gridSize, drawX, drawY, gridSize, gridSize);
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

    function handleExportAsLevelFile() {
        if (!image) {
            return;
        }

        const tempOutput: Record<string, string[]> = {};
        for (const layer of layers) {
            Object.entries(layer.data).forEach(([k, v]) => {
                const split = k.split(",");
                const tilesPerRow = Math.floor(image.width / gridSize);
                const srcX = (v.tileId % tilesPerRow);
                const srcY = Math.floor(v.tileId / tilesPerRow);
                const worldX = parseInt(split[0]) * gridSize;
                const worldY = (Math.abs(parseInt(split[1]) + 1 - mapSize.height)) * gridSize;
                const posKey = `${worldX},${worldY}`;
                if (!tempOutput[posKey]) {
                    tempOutput[posKey] = [`${srcX},${srcY}`];
                    return;
                }
                tempOutput[posKey].push(`${srcX},${srcY}`);
            })
        }
        let output = "";
        Object.entries(tempOutput).forEach(([k, v]) => {
            const split = k.split(",");
            output += `${v.length}\n${split[0]}\n${split[1]}\n`;
            for (const tile of v) {
                output += `${tile}\n`;
            }
            output += "#";
        })
        output = output.substring(0, output.length - 1);

        const blob = new Blob([output], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "map_data.level";
        a.click();
        URL.revokeObjectURL(url);
    }

    function handleCreateTileGroup() {
        if (!image) return;
        const tilesPerRow = Math.floor(image.width / gridSize);
        const sel = paletteSelection;

        // Validation: Must select at least 3 tiles horizontally
        // Validation: Must select at least 1 tile
        if (sel.w < 1) {
            alert("Please select at least 1 tile.");
            return;
        }


        // Extract columns
        const getColumn = (colIndex: number) => {
            const col: number[] = [];
            for (let y = 0; y < sel.h; y++) {
                const tileId = (sel.y + y) * tilesPerRow + (sel.x + colIndex);
                col.push(tileId);
            }
            return col;
        };

        const left = getColumn(0);
        const right = getColumn(sel.w - 1);

        const middle: number[][] = [];
        for (let x = 1; x < sel.w - 1; x++) {
            middle.push(getColumn(x));
        }

        const single = middle.length > 0 ? middle[0] : left;

        // Preview: flattened top row for simple preview
        const preview: number[] = [];
        for (let x = 0; x < sel.w; x++) {
            preview.push(getColumn(x)[0]); // Top tile only for icon
        }

        const newGroup: TileGroup = {
            id: crypto.randomUUID(),
            name: "New Smart Component", // Default name, will be edited in modal
            role: "terrain", // Default role, will be edited in modal
            canResize: true, // Default, will be edited in modal
            canFlip: false,  // Explicitly set
            allowInGeneration: true, // Default, will be edited in modal
            left,
            middle,
            right,
            single,
            height: sel.h,
            preview,
        };

        setEditingGroup(newGroup);
    }

    function handleEditTileGroup(group: TileGroup) {
        setEditingGroup(group);
    }

    function handleSaveGroup(updates: { name: string; role: "terrain" | "decoration" | "terrain-decoration"; canResize: boolean; canFlip: boolean; allowInGeneration: boolean; verticalAlignments?: ("top" | "bottom")[]; density?: number }) {
        if (editingGroup) {
            if (tileGroups[editingGroup.id]) {
                // Update existing
                updateTileGroup(editingGroup.id, updates);
            } else {
                // Create new
                addTileGroup({
                    ...editingGroup,
                    ...updates
                });
            }
            setEditingGroup(null);
        }
    }



    // Fix generateProceduralLevel call to use first available group if "grass" missing
    function handleGenerateLevel() {
        setShowGenModal(true);
    }

    function handleFinalGenerate(selectedIds: string[]) {
        saveCheckpoint();

        // Filter groups based on selection
        const filteredGroups: Record<string, TileGroup> = {};
        selectedIds.forEach(id => {
            if (tileGroups[id]) {
                filteredGroups[id] = tileGroups[id];
            }
        });

        const tilesPerRow = Math.floor(image?.width ? image.width / gridSize : 8);
        const newLayers = generateProceduralLevel(mapSize.width, mapSize.height, filteredGroups, tilesPerRow);
        setLayers(newLayers);
        setActiveLayerIndex(0);
        setShowGenModal(false);
    }

    return (
        <div className="h-screen flex flex-col p-4 box-border bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors">
            <h1 className="text-2xl font-bold mb-4">Map Editor</h1>

            <Toolbar
                mapSize={mapSize}
                setMapSize={setMapSize}
                gridSize={gridSize}
                onGridSizeChange={handleGridSizeChange}
                currentTool={currentTool}
                setCurrentTool={setCurrentTool}
                onSave={handleSaveMap}
                onLoad={handleLoadMap}
                onExport={handleExportPng}
                onLevelFileExport={handleExportAsLevelFile}
                onUploadImage={handleUploadImage}
                onGenerate={handleGenerateLevel}
                onClearMap={clearMap}
            />

            <RecentTiles
                recentStamps={recentStamps}
                onSelect={setPaletteSelection}
                image={image}
                activeStamp={paletteSelection}
                gridSize={gridSize}
            />

            <div className="flex gap-4 items-start flex-1 overflow-hidden">
                <div
                    className="flex-none flex flex-col h-full"
                    style={{ width: paletteWidth }}
                >
                    <Palette
                        image={image}
                        selection={paletteSelection}
                        setSelection={(val) => {
                            if (typeof val === 'function') {
                                setPaletteSelection(prev => {
                                    const next = val(prev);
                                    updatePaletteSelection(next); // Recalculate brush
                                    return next;
                                });
                            } else {
                                updatePaletteSelection(val);
                            }
                        }}
                        zoom={zoomPalette}
                        setZoom={setZoomPalette}
                        isFlipped={isFlipped}
                        onToolChange={() => {
                            if (currentTool !== "brush" && currentTool !== "fill") {
                                setCurrentTool("brush");
                            }
                        }}
                        onSelectionEnd={addRecentStamp}
                        gridSize={gridSize}
                    />

                    <div className="h-4 bg-gray-50 dark:bg-gray-800 cursor-row-resize flex items-center justify-center border-y border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        onMouseDown={() => {
                            // Separator
                        }}
                    >
                        <div className="w-12 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
                    </div>

                    <SmartComponents
                        image={image}
                        tileGroups={tileGroups}
                        activeGroup={activeTileGroup}
                        onSelectGroup={(group) => {
                            setActiveTileGroup(group);
                            setCurrentTool("smartBrush");
                        }}
                        onCreateGroup={handleCreateTileGroup}
                        onDeleteGroup={removeTileGroup}
                        onEditGroup={handleEditTileGroup}
                        gridSize={gridSize}
                        onClearAll={clearTileGroups}
                    />
                </div>

                <div
                    className="w-1 cursor-col-resize bg-gray-200 dark:bg-gray-800 hover:bg-blue-400 transition-colors"
                    onMouseDown={() => {
                        isResizing.current = true;
                        document.body.style.cursor = "col-resize";
                    }}
                />

                <div className="flex-1 overflow-hidden relative bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                    <MapCanvas
                        layers={layers}
                        mapSize={mapSize}
                        zoom={zoomMap}
                        setZoom={setZoomMap}
                        cameraOffset={cameraOffset}
                        currentTool={currentTool}
                        selection={selection}
                        activeTileGroup={activeTileGroup}
                        image={image}
                        onMouseDown={handleMapMouseDown}
                        onMouseMove={handleMapMouseMove}
                        onMouseUp={handleMapMouseUp}
                        onMouseLeave={handleMapMouseUp}
                        gridSize={gridSize}
                        isFlipped={isFlipped}
                        paletteSelection={paletteSelection}
                        customBrush={customBrush}
                    />

                    <div className="absolute top-2 right-2 bg-white/90 dark:bg-gray-800/90 p-2 rounded shadow border border-gray-200 dark:border-gray-700 backdrop-blur-sm">
                        <LayerPanel
                            layers={layers}
                            activeLayerIndex={activeLayerIndex}
                            setActiveLayerIndex={setActiveLayerIndex}
                            onAddLayer={() => {
                                const name = prompt("Enter layer name:", "New Layer");
                                if (name !== null) {
                                    addLayer(name || "Layer");
                                    setActiveLayerIndex(layers.length); // optimistic
                                }
                            }}
                            onRemoveLayer={(index) => {
                                removeLayer(index);
                                if (activeLayerIndex >= index) {
                                    setActiveLayerIndex(Math.max(0, activeLayerIndex - 1));
                                }
                            }}
                            onMoveLayer={(index, direction) => {
                                setLayers(draft => {
                                    const targetIndex = direction === 'up' ? index + 1 : index - 1; // Up means higher index/z-index
                                    if (targetIndex >= 0 && targetIndex < draft.length) {
                                        const temp = draft[targetIndex];
                                        draft[targetIndex] = draft[index];
                                        draft[index] = temp;

                                        // Update active index selection if we moved the active layer or swallowed it
                                        if (activeLayerIndex === index) {
                                            // We can't update state inside setLayers (immer draft).
                                            // We need a separate effect or just accept it might desync?
                                            // Actually setActiveLayerIndex is a separate state.
                                            // We should set it AFTER.
                                            // But we are in a callback.
                                        }
                                    }
                                });
                                // Fix active index in a separate tick or just assume user will click?
                                // Better: calculate new index and set it.
                                const targetIndex = direction === 'up' ? index + 1 : index - 1;
                                if (targetIndex >= 0 && targetIndex < layers.length) {
                                    if (activeLayerIndex === index) setActiveLayerIndex(targetIndex);
                                    else if (activeLayerIndex === targetIndex) setActiveLayerIndex(index);
                                }
                            }}
                            onToggleVisibility={(idx) => {
                                setLayers(draft => {
                                    draft[idx].visible = !draft[idx].visible;
                                });
                            }}
                            onOpacityChange={(idx, val) => {
                                setLayers(draft => {
                                    draft[idx].opacity = val;
                                });
                            }}
                            onRenameLayer={renameLayer}
                        />
                    </div>
                </div>
            </div>

            {editingGroup && (
                <SmartComponentModal
                    isOpen={true}
                    initialData={editingGroup}
                    onClose={() => setEditingGroup(null)}
                    onSave={handleSaveGroup}
                />
            )}

            {showGenModal && (
                <GenerationConfigModal
                    isOpen={true}
                    onClose={() => setShowGenModal(false)}
                    onGenerate={handleFinalGenerate}
                    tileGroups={tileGroups}
                />
            )}
        </div>
    );
}

