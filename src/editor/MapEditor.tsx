import { useRef, useState, useEffect, type MouseEvent } from "react";
import spritesheet from "../assets/project.png";

const TILE_WIDTH = 32;
const TILE_HEIGHT = 32;

type TileData = { tileId: number; flipX: boolean };
type Tool = "brush" | "eraser" | "fill" | "marquee";
type SelectionRect = { x: number; y: number; w: number; h: number };


export function MapEditor() {
	const mapCanvasRef = useRef<HTMLCanvasElement>(null);
	const mapContextRef = useRef<CanvasRenderingContext2D | null>(null);
	const paletteCanvasRef = useRef<HTMLCanvasElement>(null);
	const paletteContextRef = useRef<CanvasRenderingContext2D | null>(null);
	const imageRef = useRef<HTMLImageElement | null>(null);

	const [mapSize, setMapSize] = useState({ width: 64, height: 16 });
	const [paletteSelection, setPaletteSelection] = useState<SelectionRect>({ x: 0, y: 0, w: 1, h: 1 });
	const [mapGrid, setMapGrid] = useState<Record<string, TileData>>({});
	const [currentTool, setCurrentTool] = useState<Tool>("brush");
	const [selection, setSelection] = useState<SelectionRect | null>(null);
	const [clipboard, setClipboard] = useState<Record<string, TileData> | null>(null);

	const isMouseDown = useRef(false);
	const isPaletteMouseDown = useRef(false);
	const lastPaintedTiles = useRef<Set<string>>(new Set());
	const selectionStart = useRef<{ x: number; y: number } | null>(null);
	const paletteSelectionStart = useRef<{ x: number; y: number } | null>(null);

	// History Stacks
	const historyPast = useRef<Record<string, TileData>[]>([]);
	const historyFuture = useRef<Record<string, TileData>[]>([]);

	function saveCheckpoint() {
		historyPast.current.push({ ...mapGrid });
		if (historyPast.current.length > 50) historyPast.current.shift(); // Limit history
		historyFuture.current = []; // Clear redo stack on new action
	}

	function performUndo() {
		if (historyPast.current.length === 0) return;

		const previous = historyPast.current.pop();
		if (previous) {
			historyFuture.current.push({ ...mapGrid });
			setMapGrid(previous);
		}
	}

	function performRedo() {
		if (historyFuture.current.length === 0) return;

		const next = historyFuture.current.pop();
		if (next) {
			historyPast.current.push({ ...mapGrid });
			setMapGrid(next);
		}
	}

	function renderPalette() {
		const canvas = paletteCanvasRef.current;
		const context = paletteContextRef.current;
		const image = imageRef.current;
		if (!canvas || !context || !image) return;

		// Resize canvas to match image if needed (though init/change does this, safety check)
		if (canvas.width !== image.width || canvas.height !== image.height) {
			canvas.width = image.width;
			canvas.height = image.height;
		}

		context.clearRect(0, 0, canvas.width, canvas.height);

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
	}

	function renderMap() {
		const canvas = mapCanvasRef.current;
		const context = mapContextRef.current;
		const image = imageRef.current;
		if (!canvas || !context || !image) return;

		// Resize map canvas
		const pixelWidth = mapSize.width * TILE_WIDTH;
		const pixelHeight = mapSize.height * TILE_HEIGHT;
		if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
			canvas.width = pixelWidth;
			canvas.height = pixelHeight;
		}

		context.clearRect(0, 0, canvas.width, canvas.height);

		// 1. Draw Map Tiles
		Object.entries(mapGrid).forEach(([key, tileData]) => {
			const [gx, gy] = key.split(",").map(Number);
			// Keys are now stored as "x,y" indices
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

		// 2. Draw Grid
		context.beginPath();
		for (let i = 0; i <= mapSize.width; i++) {
			context.moveTo(i * TILE_WIDTH, 0);
			context.lineTo(i * TILE_WIDTH, pixelHeight);
		}
		for (let i = 0; i <= mapSize.height; i++) {
			context.moveTo(0, i * TILE_HEIGHT);
			context.lineTo(pixelWidth, i * TILE_HEIGHT);
		}
		context.strokeStyle = "rgba(0,0,0, 0.4)";
		context.lineWidth = 1;
		context.stroke();

		// 3. Draw Selection Marquee
		if (selection) {
			context.beginPath();
			context.strokeStyle = "white";
			context.lineWidth = 1;
			context.setLineDash([5, 5]);
			context.strokeRect(
				selection.x * TILE_WIDTH,
				selection.y * TILE_HEIGHT,
				selection.w * TILE_WIDTH,
				selection.h * TILE_HEIGHT
			);
			context.strokeStyle = "black";
			context.setLineDash([5, 5]);
			context.lineDashOffset = 5;
			context.strokeRect(
				selection.x * TILE_WIDTH,
				selection.y * TILE_HEIGHT,
				selection.w * TILE_WIDTH,
				selection.h * TILE_HEIGHT
			);
			context.setLineDash([]);
			context.lineDashOffset = 0;
		}
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
	}, [paletteSelection]);

	useEffect(() => {
		renderMap();
	}, [mapGrid, selection, mapSize]);

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
					setMapGrid((prev) => {
						const next = { ...prev };
						for (let x = selection.x; x < selection.x + selection.w; x++) {
							for (let y = selection.y; y < selection.y + selection.h; y++) {
								delete next[`${x},${y}`];
							}
						}
						return next;
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
					for (let x = selection.x; x < selection.x + selection.w; x++) {
						for (let y = selection.y; y < selection.y + selection.h; y++) {
							const key = `${x},${y}`;
							if (mapGrid[key]) {
								newClipboard[`${x - selection.x},${y - selection.y}`] = mapGrid[key];
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

					setMapGrid((prev) => {
						const next = { ...prev };
						Object.entries(clipboard).forEach(([key, tileData]) => {
							const [gx, gy] = key.split(",").map(Number);
							const finalX = targetX + gx;
							const finalY = targetY + gy;
							next[`${finalX},${finalY}`] = { ...tileData };
						});
						return next;
					});
				}
			}
		}

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [mapGrid, selection, clipboard]);

	function paintTile(gridX: number, gridY: number, tileId: number | null) {
		const gx = Math.floor(gridX / TILE_WIDTH);
		const gy = Math.floor(gridY / TILE_HEIGHT);
		const key = `${gx},${gy}`;

		setMapGrid((prev) => {
			const next = { ...prev };
			if (tileId === null) {
				delete next[key];
			} else {
				next[key] = { tileId, flipX: false };
			}
			return next;
		});
	}

	function floodFill(startGridX: number, startGridY: number, fillTileId: number) {
		// startGridX/Y are passed as INDICES (e.g. 1, 2)
		const startKey = `${startGridX},${startGridY}`;
		const startTileId = mapGrid[startKey]?.tileId;

		// Prevent infinite recursion if filling same color
		if (startTileId === fillTileId) return;

		const visited = new Set<string>();
		const queue = [[startGridX, startGridY]];
		const newGrid = { ...mapGrid };

		// Helper to get ID (undefined if empty)
		const getId = (x: number, y: number) => newGrid[`${x},${y}`]?.tileId;

		while (queue.length > 0) {
			const [cx, cy] = queue.pop()!;
			const key = `${cx},${cy}`;

			if (visited.has(key)) continue;
			if (cx < 0 || cx >= mapSize.width || cy < 0 || cy >= mapSize.height) continue;

			const currentId = getId(cx, cy);
			// Match if IDs are equal (including both undefined)
			if (currentId !== startTileId) continue;

			visited.add(key);
			newGrid[key] = { tileId: fillTileId, flipX: false };

			queue.push([cx + 1, cy]);
			queue.push([cx - 1, cy]);
			queue.push([cx, cy + 1]);
			queue.push([cx, cy - 1]);
		}

		setMapGrid(newGrid);
	}

	function handlePaletteMouseDown(e: MouseEvent<HTMLCanvasElement>) {
		const canvas = paletteCanvasRef.current;
		if (!canvas) return;

		isPaletteMouseDown.current = true;
		const rect = canvas.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;

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

		const rect = canvas.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;

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
			const rect = canvas.getBoundingClientRect();
			const x = e.clientX - rect.left;
			const y = e.clientY - rect.top;

			const context = mapContextRef.current;
			if (!context) return;

			// Re-render to clear old hover
			renderMap();

			// For hover, let's show the stamp size if using brush
			const gridX = Math.floor(x / TILE_WIDTH) * TILE_WIDTH;
			const gridY = Math.floor(y / TILE_HEIGHT) * TILE_HEIGHT;

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
		}
	}

	function handleMapInteraction(e: MouseEvent<HTMLCanvasElement>) {
		const canvas = mapCanvasRef.current;
		if (!canvas) return;

		const rect = canvas.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;

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
		const jsonString = JSON.stringify(mapGrid, null, 2);
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
				if (typeof json === "object" && json !== null) {
					setMapGrid(json);
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

		// Draw tiles
		Object.entries(mapGrid).forEach(([key, tileData]) => {
			const [gx, gy] = key.split(",").map(Number);
			// Index-based keys
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

		const url = tempCanvas.toDataURL("image/png");
		const a = document.createElement("a");
		a.href = url;
		a.download = "map_image.png";
		a.click();
	}

	const resultString = `const mapGrid = ${JSON.stringify(mapGrid, null, 2)};`;


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
				<div className="flex-none w-[280px] flex flex-col h-full">
					<h3 className="font-bold mb-2">Palette</h3>
					<div className="border border-gray-400 bg-gray-50 flex-1 overflow-auto">
						<canvas
							ref={paletteCanvasRef}
							className="cursor-pointer block"
							onMouseDown={handlePaletteMouseDown}
							onMouseMove={handlePaletteMouseMove}
							onMouseUp={handlePaletteMouseUp}
							onMouseLeave={handlePaletteMouseUp}
							aria-label="Palette Grid - Use arrow keys to navigate"
							tabIndex={0}
						/>
					</div>
					<div className="mt-2 text-sm text-gray-500">
						Drag to select multiple tiles.<br />
						Shortcuts: B (Brush), E (Eraser), F (Fill)
					</div>
				</div>

				<div className="flex-1 h-full min-w-0 flex flex-col">
					<h3 className="font-bold mb-2">Map</h3>
					<div className="border-2 border-gray-300 bg-gray-100 flex-1 overflow-auto relative rounded">
						<canvas
							id="myCanvas"
							ref={mapCanvasRef}
							className="block bg-white shadow-sm"
							onMouseDown={handleMapMouseDown}
							onMouseMove={handleMapMouseMove}
							onMouseUp={handleMapMouseUp}
							onMouseLeave={handleMapMouseUp}
							aria-label="Map Grid"
							tabIndex={0}
						></canvas>
					</div>
				</div>
			</div>

			<div id="result" className="mt-4 whitespace-pre font-mono text-sm hidden">
				{resultString}
			</div>
		</div>
	);

}
