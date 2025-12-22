import { useRef, useState, useEffect, type MouseEvent } from "react";
import { useImmer } from "use-immer";
import spritesheet from "../assets/project.png";

const TILE_WIDTH = 32;
const TILE_HEIGHT = 32;

type TileData = { tileId: number; flipX: boolean };
type Layer = { id: string; name: string; visible: boolean; opacity: number; data: Record<string, TileData> };
type Tool = "brush" | "eraser" | "fill" | "marquee";
type SelectionRect = { x: number; y: number; w: number; h: number };


export function MapEditor() {
	const mapCanvasRef = useRef<HTMLCanvasElement>(null);
	const mapContextRef = useRef<CanvasRenderingContext2D | null>(null);
	const paletteCanvasRef = useRef<HTMLCanvasElement>(null);
	const paletteContextRef = useRef<CanvasRenderingContext2D | null>(null);
	const imageRef = useRef<HTMLImageElement | null>(null);

	const [mapSize, setMapSize] = useState({ width: 64, height: 16 });
	const [paletteWidth, setPaletteWidth] = useState(280);
	const [zoomMap, setZoomMap] = useState(1);
	const [zoomPalette, setZoomPalette] = useState(1);
	const [paletteSelection, setPaletteSelection] = useState<SelectionRect>({ x: 0, y: 0, w: 1, h: 1 });
	const [layers, setLayers] = useImmer<Layer[]>([
		{ id: "ground", name: "Ground", visible: true, opacity: 1, data: {} },
		{ id: "decor", name: "Decoration", visible: true, opacity: 1, data: {} },
		{ id: "collision", name: "Collision", visible: true, opacity: 0.5, data: {} },
	]);
	const [activeLayerIndex, setActiveLayerIndex] = useState(0);
	const [currentTool, setCurrentTool] = useState<Tool>("brush");
	const [selection, setSelection] = useState<SelectionRect | null>(null);
	const [clipboard, setClipboard] = useState<Record<string, TileData> | null>(null);

	const isMouseDown = useRef(false);
	const isPaletteMouseDown = useRef(false);
	const isResizing = useRef(false);
	const lastPaintedTiles = useRef<Set<string>>(new Set());
	const selectionStart = useRef<{ x: number; y: number } | null>(null);
	const paletteSelectionStart = useRef<{ x: number; y: number } | null>(null);

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

	function renderPalette() {
		const canvas = paletteCanvasRef.current;
		const context = paletteContextRef.current;
		const image = imageRef.current;
		if (!canvas || !context || !image) return;

		// Resize canvas logic:
		const logicalWidth = image.width;
		const logicalHeight = image.height;

		if (canvas.width !== logicalWidth || canvas.height !== logicalHeight) {
			canvas.width = logicalWidth;
			canvas.height = logicalHeight;
		}

		context.imageSmoothingEnabled = false;
		context.clearRect(0, 0, canvas.width, canvas.height);
		// No context scale needed logic

		// Draw Source Image
		context.drawImage(image, 0, 0);

		// Draw Grid Overlay on Palette
		context.beginPath();
		// Vertical lines
		for (let i = 0; i <= image.width; i += TILE_WIDTH) {
			context.moveTo(i, 0);
			context.lineTo(i, image.height);
		}
		// Horizontal lines
		for (let i = 0; i <= image.height; i += TILE_HEIGHT) {
			context.moveTo(0, i);
			context.lineTo(image.width, i);
		}
		context.strokeStyle = "rgba(0,0,0, 0.2)";
		context.lineWidth = 1;
		context.stroke();

		// Draw Selection Box on Palette
		const drawX = paletteSelection.x * TILE_WIDTH;
		const drawY = paletteSelection.y * TILE_HEIGHT;
		const drawW = paletteSelection.w * TILE_WIDTH;
		const drawH = paletteSelection.h * TILE_HEIGHT;

		context.beginPath();
		context.strokeStyle = "white";
		context.lineWidth = 2;
		context.setLineDash([4, 4]);
		context.strokeRect(drawX, drawY, drawW, drawH);

		context.strokeStyle = "black";
		context.lineDashOffset = 4;
		context.strokeRect(drawX, drawY, drawW, drawH);

		context.setLineDash([]);
		context.lineDashOffset = 0;

		// REMOVED context.restore();
	}

	function renderMap() {
		const canvas = mapCanvasRef.current;
		const context = mapContextRef.current;
		const image = imageRef.current;
		if (!canvas || !context || !image) return;

		// Resize map canvas
		const logicalWidth = mapSize.width * TILE_WIDTH;
		const logicalHeight = mapSize.height * TILE_HEIGHT;

		if (canvas.width !== logicalWidth || canvas.height !== logicalHeight) {
			canvas.width = logicalWidth;
			canvas.height = logicalHeight;
		}

		context.imageSmoothingEnabled = false;
		context.clearRect(0, 0, canvas.width, canvas.height);

		// No context scale needed

		// 1. Draw Map Tiles (Layered)
		layers.forEach((layer) => {
			if (!layer.visible) return;

			context.save();
			context.globalAlpha = layer.opacity;

			Object.entries(layer.data).forEach(([key, tileData]) => {
				const [gx, gy] = key.split(",").map(Number);
				const drawX = gx * TILE_WIDTH;
				const drawY = gy * TILE_HEIGHT;

				const tilesPerRow = Math.floor(image.width / TILE_WIDTH);
				const srcX = (tileData.tileId % tilesPerRow) * TILE_WIDTH;
				const srcY = Math.floor(tileData.tileId / tilesPerRow) * TILE_HEIGHT;

				context.drawImage(
					image,
					srcX,
					srcY,
					TILE_WIDTH,
					TILE_HEIGHT,
					drawX,
					drawY,
					TILE_WIDTH,
					TILE_HEIGHT
				);
			});

			context.restore();
		});

		// 2. Draw Grid
		context.beginPath();
		for (let i = 0; i <= mapSize.width; i++) {
			context.moveTo(i * TILE_WIDTH, 0);
			context.lineTo(i * TILE_WIDTH, logicalHeight);
		}
		for (let i = 0; i <= mapSize.height; i++) {
			context.moveTo(0, i * TILE_HEIGHT);
			context.lineTo(logicalWidth, i * TILE_HEIGHT);
		}
		context.strokeStyle = "rgba(0,0,0, 0.4)";
		context.lineWidth = 1;
		context.stroke();

		// 3. Draw Selection Marquee
		if (selection) {
			const selX = selection.x * TILE_WIDTH;
			const selY = selection.y * TILE_HEIGHT;
			const selW = selection.w * TILE_WIDTH;
			const selH = selection.h * TILE_HEIGHT;

			// Fill
			context.fillStyle = "rgba(0, 140, 255, 0.2)";
			context.fillRect(selX, selY, selW, selH);

			// Border
			context.beginPath();
			context.strokeStyle = "white";
			context.lineWidth = 2;
			context.setLineDash([4, 4]);
			context.strokeRect(selX, selY, selW, selH);

			context.strokeStyle = "black";
			context.setLineDash([4, 4]);
			context.lineDashOffset = 4;
			context.strokeRect(selX, selY, selW, selH);

			context.setLineDash([]);
			context.lineDashOffset = 0;
		}

		// REMOVED context.restore();
	}

	// Load Image and Init
	useEffect(() => {
		if (!spritesheet) return;

		const img = new Image();
		img.src = spritesheet;

		img.onload = () => {
			imageRef.current = img;

			// Init Map Canvas
			if (mapCanvasRef.current) {
				mapCanvasRef.current.width = mapSize.width * TILE_WIDTH;
				mapCanvasRef.current.height = mapSize.height * TILE_HEIGHT;
				renderMap();
			}

			// Init Palette Canvas with dynamic size
			if (paletteCanvasRef.current) {
				paletteCanvasRef.current.width = img.width;
				paletteCanvasRef.current.height = img.height;
				renderPalette();
			}
		};
	}, []);

	// Redraw selection box when paletteSelection changes
	useEffect(() => {
		renderPalette();
	}, [paletteSelection, zoomPalette]);

	useEffect(() => {
		renderMap();
	}, [layers, selection, mapSize, zoomMap]);

	useEffect(() => {
		function handleKeyDown(e: KeyboardEvent) {
			// Ignore if input is focused
			if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

			// Tool Shortcuts
			if (e.key.toLowerCase() === "b") setCurrentTool("brush");
			if (e.key.toLowerCase() === "e") setCurrentTool("eraser");
			if (e.key.toLowerCase() === "g" || e.key.toLowerCase() === "f") setCurrentTool("fill");

			// Palette Navigation (Arrow Keys)
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

					// Reset selection size to 1x1 on move? Or keep it?
					// Standard behavior for simple nav is usually 1x1, but keeping stamp is powerful.
					// Let's keep the stamp size for now as it's useful.
					return { ...prev, x, y };
				});
				// Switch to brush if moving palette selection
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

			// Undo/Redo Shortcuts
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
						Object.entries(clipboard).forEach(([key, tileData]) => {
							const [gx, gy] = key.split(",").map(Number);
							const finalX = targetX + gx;
							const finalY = targetY + gy;
							activeData[`${finalX},${finalY}`] = { ...tileData };
						});
					});
				}
			}
		}

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [layers, selection, clipboard, activeLayerIndex]);

	// Resize Logic
	useEffect(() => {
		function handleMouseMove(e: globalThis.MouseEvent) {
			if (isResizing.current) {
				// Constrain
				let newWidth = e.clientX;
				if (newWidth < 150) newWidth = 150;
				if (newWidth > 800) newWidth = 800; // sensible max
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
				activeData[key] = { tileId, flipX: false };
			}
		});
	}

	function floodFill(startGridX: number, startGridY: number, fillTileId: number) {
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
				activeData[key] = { tileId: fillTileId, flipX: false };

				queue.push([cx + 1, cy]);
				queue.push([cx - 1, cy]);
				queue.push([cx, cy + 1]);
				queue.push([cx, cy - 1]);
			}
		});
	}

	function handleWheel(e: React.WheelEvent, setZoom: React.Dispatch<React.SetStateAction<number>>) {
		if (e.metaKey || e.ctrlKey) {
			e.preventDefault();
			setZoom((z) => {
				const newZoom = z - e.deltaY * 0.001;
				// Clamp between 0.25x and 4x
				return Math.max(0.25, Math.min(4, newZoom));
			});
		}
	}

	function handlePaletteMouseDown(e: MouseEvent<HTMLCanvasElement>) {
		const canvas = paletteCanvasRef.current;
		if (!canvas) return;

		isPaletteMouseDown.current = true;
		const x = e.nativeEvent.offsetX / zoomPalette;
		const y = e.nativeEvent.offsetY / zoomPalette;

		const tileX = Math.floor(x / TILE_WIDTH);
		const tileY = Math.floor(y / TILE_HEIGHT);

		paletteSelectionStart.current = { x: tileX, y: tileY };
		setPaletteSelection({ x: tileX, y: tileY, w: 1, h: 1 });

		if (currentTool !== "brush") setCurrentTool("brush");
	}

	function handlePaletteMouseMove(e: MouseEvent<HTMLCanvasElement>) {
		if (!isPaletteMouseDown.current || !paletteSelectionStart.current) return;

		const canvas = paletteCanvasRef.current;
		const image = imageRef.current;
		if (!canvas || !image) return;

		const x = e.nativeEvent.offsetX / zoomPalette;
		const y = e.nativeEvent.offsetY / zoomPalette;

		// Constrain to image bounds
		const tileX = Math.max(0, Math.min(Math.floor(x / TILE_WIDTH), Math.floor(image.width / TILE_WIDTH) - 1));
		const tileY = Math.max(0, Math.min(Math.floor(y / TILE_HEIGHT), Math.floor(image.height / TILE_HEIGHT) - 1));

		const start = paletteSelectionStart.current;
		const minX = Math.min(start.x, tileX);
		const minY = Math.min(start.y, tileY);
		const w = Math.abs(start.x - tileX) + 1;
		const h = Math.abs(start.y - tileY) + 1;

		setPaletteSelection({ x: minX, y: minY, w, h });
	}

	function handlePaletteMouseUp() {
		isPaletteMouseDown.current = false;
	}

	function handleMapMouseDown(e: MouseEvent<HTMLCanvasElement>) {
		if (currentTool !== "marquee") {
			// Save state before painting starts
			saveCheckpoint();
		}
		isMouseDown.current = true;
		lastPaintedTiles.current.clear();
		handleMapInteraction(e);
	}

	function handleMapMouseUp() {
		isMouseDown.current = false;
		lastPaintedTiles.current.clear();
	}

	function handleMapMouseMove(e: MouseEvent<HTMLCanvasElement>) {
		const canvas = mapCanvasRef.current;
		if (!canvas) return;

		if (isMouseDown.current) {
			handleMapInteraction(e);
		} else {
			// Hover Logic
			const x = e.nativeEvent.offsetX / zoomMap;
			const y = e.nativeEvent.offsetY / zoomMap;

			const context = mapContextRef.current;
			if (!context) return;

			// Re-render to clear old hover
			renderMap();

			// Draw cursor on top of map (No scale needed, we draw in logical coords)
			// Wait, renderMap uses context.save/restore. The context is clean here.
			// We should probably rely on renderMap loop, but simpler to just set scale here too.
			// For hover, let's show the stamp size if using brush
			const gridX = Math.floor(x / TILE_WIDTH) * TILE_WIDTH;
			const gridY = Math.floor(y / TILE_HEIGHT) * TILE_HEIGHT;

			// Draw Ghost Tile
			const image = imageRef.current;
			if (image && (currentTool === "brush" || currentTool === "fill")) {
				context.globalAlpha = 0.5;

				// For Brush, render entire stamp. For Fill, render just the top-left (source) tile.
				const previewW = currentTool === "brush" ? paletteSelection.w : 1;
				const previewH = currentTool === "brush" ? paletteSelection.h : 1;

				for (let dy = 0; dy < previewH; dy++) {
					for (let dx = 0; dx < previewW; dx++) {
						const srcX = (paletteSelection.x + dx) * TILE_WIDTH;
						const srcY = (paletteSelection.y + dy) * TILE_HEIGHT;
						const destX = gridX + (dx * TILE_WIDTH);
						const destY = gridY + (dy * TILE_HEIGHT);

						context.drawImage(
							image,
							srcX,
							srcY,
							TILE_WIDTH,
							TILE_HEIGHT,
							destX,
							destY,
							TILE_WIDTH,
							TILE_HEIGHT
						);
					}
				}
				context.globalAlpha = 1.0;
			}

			context.beginPath();
			context.strokeStyle = "blue";
			context.lineWidth = 1;

			if (currentTool === "brush") {
				const drawW = paletteSelection.w * TILE_WIDTH;
				const drawH = paletteSelection.h * TILE_HEIGHT;

				context.beginPath();
				context.strokeStyle = "white";
				context.lineWidth = 1;
				context.setLineDash([4, 4]);
				context.strokeRect(gridX, gridY, drawW, drawH);

				context.strokeStyle = "black";
				context.lineDashOffset = 4;
				context.strokeRect(gridX, gridY, drawW, drawH);
				context.setLineDash([]);
				context.lineDashOffset = 0;
			} else {
				// Single tile hover (Eraser, Fill, etc)
				context.beginPath();
				context.strokeStyle = "white";
				context.lineWidth = 1;
				context.setLineDash([4, 4]);
				context.strokeRect(gridX, gridY, TILE_WIDTH, TILE_HEIGHT);

				context.strokeStyle = "black";
				context.lineDashOffset = 4;
				context.strokeRect(gridX, gridY, TILE_WIDTH, TILE_HEIGHT);
				context.setLineDash([]);
				context.lineDashOffset = 0;
			}
			context.setLineDash([]);
			context.lineDashOffset = 0;
		}
		// context.restore(); // Removed
	}

	function handleMapInteraction(e: MouseEvent<HTMLCanvasElement>) {
		const canvas = mapCanvasRef.current;
		if (!canvas) return;

		const x = e.nativeEvent.offsetX / zoomMap;
		const y = e.nativeEvent.offsetY / zoomMap;

		const pixelWidth = mapSize.width * TILE_WIDTH;
		const pixelHeight = mapSize.height * TILE_HEIGHT;

		if (x < 0 || y < 0 || x >= pixelWidth || y >= pixelHeight) return;

		const gridX = Math.floor(x / TILE_WIDTH) * TILE_WIDTH;
		const gridY = Math.floor(y / TILE_HEIGHT) * TILE_HEIGHT;
		// Use index key for uniqueness check
		const gx = Math.floor(x / TILE_WIDTH);
		const gy = Math.floor(y / TILE_HEIGHT);
		const tileKey = `${gx},${gy}`;

		if (lastPaintedTiles.current.has(tileKey)) return;

		// Logic based on tool
		const image = imageRef.current;
		if (!image) return;
		const tilesPerRow = Math.floor(image.width / TILE_WIDTH);

		if (currentTool === "brush") {
			// Multi-tile painting (stamp)
			for (let dy = 0; dy < paletteSelection.h; dy++) {
				for (let dx = 0; dx < paletteSelection.w; dx++) {
					const px = paletteSelection.x + dx;
					const py = paletteSelection.y + dy;
					const tileId = py * tilesPerRow + px;

					// Target coordinates (Pixel)
					const targetX = gridX + (dx * TILE_WIDTH);
					const targetY = gridY + (dy * TILE_HEIGHT);

					// Boundary check
					if (targetX >= pixelWidth || targetY >= pixelHeight) continue;

					paintTile(targetX, targetY, tileId);
				}
			}
			lastPaintedTiles.current.add(tileKey);
		} else if (currentTool === "eraser") {
			paintTile(gridX, gridY, null);
			lastPaintedTiles.current.add(tileKey);
		} else if (currentTool === "fill" && e.type === "mousedown") {
			// Bucket fill using the top-left tile of the selection
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


	useEffect(() => {
		const mapCanvas = mapCanvasRef.current;
		const paletteCanvas = paletteCanvasRef.current;

		if (mapCanvas) mapContextRef.current = mapCanvas.getContext("2d");
		if (paletteCanvas) paletteContextRef.current = paletteCanvas.getContext("2d");

		// Initial Draw
		const img = imageRef.current;
		if (img) {
			renderMap();
			renderPalette();
		}
	}, []);

	function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file) return;

		const img = new Image();

		img.onload = () => {
			imageRef.current = img;

			if (paletteCanvasRef.current) {
				paletteCanvasRef.current.width = img.width;
				paletteCanvasRef.current.height = img.height;
				console.log("Updated palette size:", img.width, img.height);
				renderPalette();
			}
			if (mapCanvasRef.current) {
				renderMap();
			}
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
					// V2: Layers
					setLayers(json);
				} else if (typeof json === "object" && json !== null) {
					// V1: Legacy single grid -> Load into Ground
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
		const image = imageRef.current;
		if (!image) return;

		// Create a temporary canvas to render just the map
		const tempCanvas = document.createElement("canvas");
		tempCanvas.width = mapSize.width * TILE_WIDTH;
		tempCanvas.height = mapSize.height * TILE_HEIGHT;
		const ctx = tempCanvas.getContext("2d");
		if (!ctx) return;

		// Draw tiles (all layers)
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

				ctx.drawImage(
					image,
					srcX,
					srcY,
					TILE_WIDTH,
					TILE_HEIGHT,
					drawX,
					drawY,
					TILE_WIDTH,
					TILE_HEIGHT
				);
			});
		});

		const url = tempCanvas.toDataURL("image/png");
		const a = document.createElement("a");
		a.href = url;
		a.download = "map_image.png";
		a.click();
	}

	const resultString = `const layers = ${JSON.stringify(layers, null, 2)};`;


	return (
		<div className="h-screen flex flex-col p-4 box-border">
			<h1 className="text-2xl font-bold mb-4">Map Editor</h1>

			{/* Toolbar row */}
			<div className="flex flex-wrap gap-4 items-center mb-4 flex-none">
				<div className="flex gap-2 items-center bg-gray-100 p-2 rounded">
					<label className="text-sm">
						W:
						<input
							type="number"
							className="ml-1 w-16 p-1 rounded border"
							value={mapSize.width}
							onChange={(e) => setMapSize(prev => ({ ...prev, width: Number(e.target.value) }))}
						/>
					</label>
					<label className="text-sm">
						H:
						<input
							type="number"
							className="ml-1 w-16 p-1 rounded border"
							value={mapSize.height}
							onChange={(e) => setMapSize(prev => ({ ...prev, height: Number(e.target.value) }))}
						/>
					</label>
				</div>
				<input
					type="file"
					accept="image/png"
					className="block"
					onChange={handleChange}
				/>

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
						onClick={handleSaveMap}
					>
						Save JSON
					</button>
					<label className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 cursor-pointer">
						Load JSON
						<input
							type="file"
							accept=".json"
							className="hidden"
							onChange={handleLoadMap}
						/>
					</label>
					<button
						className="px-3 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700"
						onClick={handleExportPng}
					>
						Export PNG
					</button>
				</div>
			</div>

			<div className="flex gap-4 items-start flex-1 overflow-hidden">
				<div
					className="flex-none flex flex-col h-full"
					style={{ width: paletteWidth }}
				>
					<h3 className="font-bold mb-2">Palette</h3>
					<div className="border border-gray-400 bg-gray-50 flex-1 overflow-auto">
						<canvas
							ref={paletteCanvasRef}
							className="cursor-pointer block origin-top-left"
							style={{
								width: imageRef.current ? imageRef.current.width * zoomPalette : undefined,
								height: imageRef.current ? imageRef.current.height * zoomPalette : undefined,
								imageRendering: "pixelated"
							}}
							onMouseDown={handlePaletteMouseDown}
							onMouseMove={handlePaletteMouseMove}
							onMouseUp={handlePaletteMouseUp}
							onMouseLeave={handlePaletteMouseUp}
							onWheel={(e) => handleWheel(e, setZoomPalette)}
							aria-label="Palette Grid - Use arrow keys to navigate"
							tabIndex={0}
						/>
					</div>
					<div className="mt-2 text-sm text-gray-500">
						Drag to select multiple tiles.<br />
						Shortcuts: B (Brush), E (Eraser), F (Fill)
					</div>
				</div>

				{/* Resizer */}
				<div
					className="w-1 cursor-col-resize h-full hover:bg-blue-400 bg-gray-200 flex-none transition-colors"
					onMouseDown={() => {
						isResizing.current = true;
						document.body.style.cursor = "col-resize";
					}}
				/>

				<div className="flex-1 h-full min-w-0 flex flex-col">
					<h3 className="font-bold mb-2">Map</h3>
					<div className="border-2 border-gray-300 bg-gray-100 flex-1 overflow-auto relative rounded">
						<canvas
							id="myCanvas"
							ref={mapCanvasRef}
							className="block bg-white shadow-sm origin-top-left"
							style={{
								width: mapSize.width * TILE_WIDTH * zoomMap,
								height: mapSize.height * TILE_HEIGHT * zoomMap,
								imageRendering: "pixelated"
							}}
							onMouseDown={handleMapMouseDown}
							onMouseMove={handleMapMouseMove}
							onMouseUp={handleMapMouseUp}
							onMouseLeave={handleMapMouseUp}
							onWheel={(e) => handleWheel(e, setZoomMap)}
							aria-label="Map Grid"
							tabIndex={0}
						></canvas>
					</div>

					{/* Layers UI */}
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
											setLayers(draft => {
												draft[index].visible = !draft[index].visible;
											});
										}}
									>
										{layer.visible ? "👁️" : "🚫"}
									</button>
									<span className={`text-sm select-none ${!layer.visible && "text-gray-400"}`}>{layer.name}</span>
								</div>
							))}
						</div>
					</div>
				</div>
			</div>

			<div id="result" className="mt-4 whitespace-pre font-mono text-sm hidden">
				{resultString}
			</div>
		</div>
	);

}
