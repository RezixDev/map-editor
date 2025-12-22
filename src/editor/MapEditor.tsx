import { useRef, useState, useEffect } from "react";
import spritesheet from "../assets/project.png";
import { useMapState } from "../hooks/useMapState";
import { type SelectionRect, type Tool, type TileData, TILE_WIDTH, TILE_HEIGHT } from "./types";
import { Toolbar } from "../components/Editor/Toolbar";
import { Palette } from "../components/Editor/Palette";
import { MapCanvas } from "../components/Editor/MapCanvas";
import { LayerPanel } from "../components/Editor/LayerPanel";
import { useImmer } from "use-immer";

export function MapEditor() {
	// --- Core State (Hook) ---
	const {
		layers, setLayers, activeLayerIndex, setActiveLayerIndex,
		saveCheckpoint, performUndo, performRedo, paintTile, floodFill
	} = useMapState();

	// --- UI State ---
	const [mapSize, setMapSize] = useState({ width: 64, height: 16 });
	const [currentTool, setCurrentTool] = useState<Tool>("brush");
	const [paletteSelection, setPaletteSelection] = useState<SelectionRect>({ x: 0, y: 0, w: 1, h: 1 });
	const [selection, setSelection] = useState<SelectionRect | null>(null);
	const [isFlipped, setIsFlipped] = useState(false);
	const [showMetadata, setShowMetadata] = useState(false);
	const [paletteWidth, setPaletteWidth] = useState(280);
	const [recentStamps, setRecentStamps] = useImmer<SelectionRect[]>([]);
	const [clipboard, setClipboard] = useState<Record<string, TileData> | null>(null);

	// --- Refs ---
	const imageRef = useRef<HTMLImageElement | null>(null);
	const isResizing = useRef(false);
	const selectionStart = useRef<{ x: number; y: number } | null>(null);
	const lastPaintedTiles = useRef<Set<string>>(new Set());

	// --- Load Asset ---
	useEffect(() => {
		if (!spritesheet) return;
		const img = new Image();
		img.src = spritesheet;
		img.onload = () => {
			imageRef.current = img;
			// Force re-render once loaded
			setMapSize(s => ({ ...s }));
		};
	}, []);

	// --- Global Event Handlers ---
	useEffect(() => {
		function handleKeyDown(e: KeyboardEvent) {
			if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

			// Shortcuts
			if (e.key.toLowerCase() === "b") setCurrentTool("brush");
			if (e.key.toLowerCase() === "e") setCurrentTool("eraser");
			if (e.key.toLowerCase() === "g" || e.key.toLowerCase() === "f") setCurrentTool("fill");
			if (e.key.toLowerCase() === "x") setIsFlipped(prev => !prev);

			// Undo/Redo
			if ((e.metaKey || e.ctrlKey) && e.key === "z") {
				e.preventDefault();
				if (e.shiftKey) performRedo();
				else performUndo();
			}

			// Copy/Paste/Delete
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
							let finalTileData: TileData = { ...tileData };
							if (tileData.properties) finalTileData.properties = { ...tileData.properties };

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

			// Palette Navigation
			if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
				e.preventDefault();
				setPaletteSelection(prev => {
					const img = imageRef.current;
					if (!img) return prev;
					let { x, y } = prev;
					const maxW = Math.floor(img.width / TILE_WIDTH) - 1;
					const maxH = Math.floor(img.height / TILE_HEIGHT) - 1;

					if (e.key === "ArrowLeft") x = Math.max(0, x - 1);
					if (e.key === "ArrowRight") x = Math.min(maxW, x + 1);
					if (e.key === "ArrowUp") y = Math.max(0, y - 1);
					if (e.key === "ArrowDown") y = Math.min(maxH, y + 1);
					return { ...prev, x, y };
				});
				setCurrentTool("brush");
			}
		}
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [layers, selection, clipboard, isFlipped, activeLayerIndex]);

	// --- Interactive Logic ---
	function handlePaint(x: number, y: number) {
		if (!imageRef.current) return;
		const pixelWidth = mapSize.width * TILE_WIDTH;
		const pixelHeight = mapSize.height * TILE_HEIGHT;

		if (x < 0 || y < 0 || x >= pixelWidth || y >= pixelHeight) return;

		const gridX = Math.floor(x / TILE_WIDTH) * TILE_WIDTH;
		const gridY = Math.floor(y / TILE_HEIGHT) * TILE_HEIGHT;
		const gx = Math.floor(x / TILE_WIDTH);
		const gy = Math.floor(y / TILE_HEIGHT);
		const tileKey = `${gx},${gy}`;

		if (lastPaintedTiles.current.has(tileKey)) return;

		if (currentTool === "brush") {
			const tilesPerRow = Math.floor(imageRef.current.width / TILE_WIDTH);
			for (let dy = 0; dy < paletteSelection.h; dy++) {
				for (let dx = 0; dx < paletteSelection.w; dx++) {
					const srcDx = isFlipped ? (paletteSelection.w - 1 - dx) : dx;
					const px = paletteSelection.x + srcDx;
					const py = paletteSelection.y + dy;
					const tileId = py * tilesPerRow + px;

					const targetX = gridX + (dx * TILE_WIDTH);
					const targetY = gridY + (dy * TILE_HEIGHT);

					if (targetX >= pixelWidth || targetY >= pixelHeight) continue;
					paintTile(targetX, targetY, tileId, isFlipped);
				}
			}
			lastPaintedTiles.current.add(tileKey);
		} else if (currentTool === "eraser") {
			paintTile(gridX, gridY, null, false);
			lastPaintedTiles.current.add(tileKey);
		} else if (currentTool === "fill") {
			const tilesPerRow = Math.floor(imageRef.current.width / TILE_WIDTH);
			const fillTileId = paletteSelection.y * tilesPerRow + paletteSelection.x;
			floodFill(gx, gy, fillTileId, isFlipped, mapSize);
			// Fill is one-shot, but for drag consistency we might just block repeats.
			lastPaintedTiles.current.add(tileKey);
		}
	}

	// --- Layout Logic ---
	return (
		<div className="h-screen flex flex-col p-4 box-border">
			<h1 className="text-2xl font-bold mb-4">Map Editor</h1>

			<Toolbar
				currentTool={currentTool}
				setTool={setCurrentTool}
				mapSize={mapSize}
				setMapSize={setMapSize}
				showMetadata={showMetadata}
				setShowMetadata={setShowMetadata}
				onSave={() => {
					const jsonString = JSON.stringify(layers, null, 2);
					const blob = new Blob([jsonString], { type: "application/json" });
					const url = URL.createObjectURL(blob);
					const a = document.createElement("a");
					a.href = url;
					a.download = "map_data.json";
					a.click();
					URL.revokeObjectURL(url);
				}}
				onLoad={(e) => {
					const file = e.target.files?.[0];
					if (!file) return;
					const reader = new FileReader();
					reader.onload = (ev) => {
						try {
							const json = JSON.parse(ev.target?.result as string);
							if (Array.isArray(json)) setLayers(json);
						} catch (err) { alert("Failed to parse"); }
					};
					reader.readAsText(file);
				}}
				onExport={() => alert("Export not fully migrated yet for modularity, but logic is same.")}
			/>

			<div className="flex gap-4 items-start flex-1 overflow-hidden">
				<Palette
					image={imageRef.current}
					selection={paletteSelection}
					onSelectionChange={setPaletteSelection}
					recentStamps={recentStamps}
					onAddToRecent={(rect) => {
						setRecentStamps(draft => {
							const existingIndex = draft.findIndex(r =>
								r.x === rect.x && r.y === rect.y &&
								r.w === rect.w && r.h === rect.h
							);
							if (existingIndex !== -1) {
								const item = draft[existingIndex];
								draft.splice(existingIndex, 1);
								draft.unshift(item);
							} else {
								draft.unshift(rect);
							}
							if (draft.length > 10) draft.pop();
						});
					}}
					width={paletteWidth}
					isFlipped={isFlipped}
				/>

				{/* Resizer */}
				<div
					className="w-1 cursor-col-resize h-full hover:bg-blue-400 bg-gray-200 flex-none transition-colors"
					onMouseDown={() => {
						isResizing.current = true;
						document.body.style.cursor = "col-resize";

						function handleMove(e: MouseEvent) {
							if (isResizing.current) {
								let newWidth = e.clientX;
								if (newWidth < 150) newWidth = 150;
								if (newWidth > 800) newWidth = 800;
								setPaletteWidth(newWidth);
							}
						}
						function handleUp() {
							isResizing.current = false;
							document.body.style.cursor = "default";
							window.removeEventListener("mousemove", handleMove as any);
							window.removeEventListener("mouseup", handleUp);
						}
						window.addEventListener("mousemove", handleMove as any);
						window.addEventListener("mouseup", handleUp);
					}}
				/>

				<div className="flex-1 h-full min-w-0 flex flex-col">
					<MapCanvas
						layers={layers}
						mapSize={mapSize}
						activeLayerIndex={activeLayerIndex}
						tool={currentTool}
						image={imageRef.current}
						paletteSelection={paletteSelection}
						isFlipped={isFlipped}
						showMetadata={showMetadata}
						selection={selection}
						onPaint={handlePaint}
						onHover={() => { }}
						onSelectionStart={(x, y) => {
							selectionStart.current = { x, y };
							setSelection({ x, y, w: 1, h: 1 });
						}}
						onSelectionMove={(x, y) => {
							if (selectionStart.current) {
								const start = selectionStart.current;
								const minX = Math.min(start.x, x);
								const minY = Math.min(start.y, y);
								const w = Math.abs(start.x - x) + 1;
								const h = Math.abs(start.y - y) + 1;
								setSelection({ x: minX, y: minY, w, h });
							}
						}}
					/>

					<LayerPanel
						layers={layers}
						activeLayerIndex={activeLayerIndex}
						setActiveLayerIndex={setActiveLayerIndex}
						setLayers={setLayers}
					/>

					{currentTool === "marquee" && selection && selection.w === 1 && selection.h === 1 && (
						/* Property Inspector (Ideally extra component, keeping inline for now as small) */
						<div className="h-40 border-t border-gray-300 bg-gray-50 p-2 flex flex-col font-sans text-sm">
							<h4 className="font-bold mb-1">Inspector ({selection.x}, {selection.y})</h4>
							{/* ... Content ... */}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
