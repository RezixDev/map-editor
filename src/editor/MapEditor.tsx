import { useRef, useState, useEffect, type MouseEvent } from "react";
import spritesheet from "../assets/project.png";

const TILE_WIDTH = 32;
const TILE_HEIGHT = 32;
const MAP_ROWS = 3;
const MAP_COLUMNS = 4;
const MAP_WIDTH = MAP_COLUMNS * TILE_WIDTH;
const MAP_HEIGHT = MAP_ROWS * TILE_HEIGHT;

type TileData = { tileId: number; flipX: boolean };
type Tool = "brush" | "eraser" | "bucket" | "marquee";
type SelectionRect = { x: number; y: number; w: number; h: number };


export function MapEditor() {
	const mapCanvasRef = useRef<HTMLCanvasElement>(null);
	const mapContextRef = useRef<CanvasRenderingContext2D | null>(null);
	const paletteCanvasRef = useRef<HTMLCanvasElement>(null);
	const paletteContextRef = useRef<CanvasRenderingContext2D | null>(null);
	const imageRef = useRef<HTMLImageElement | null>(null);

	const [selectedTile, setSelectedTile] = useState(0);
	const [mapGrid, setMapGrid] = useState<Record<string, TileData>>({});
	const [currentTool, setCurrentTool] = useState<Tool>("brush");
	const [selection, setSelection] = useState<SelectionRect | null>(null);
	const [clipboard, setClipboard] = useState<Record<string, TileData> | null>(null);

	const isMouseDown = useRef(false);
	const lastPaintedTiles = useRef<Set<string>>(new Set());
	const selectionStart = useRef<{ x: number; y: number } | null>(null);

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
		const tilesPerRow = Math.floor(image.width / TILE_WIDTH);
		const tileX = selectedTile % tilesPerRow;
		const tileY = Math.floor(selectedTile / tilesPerRow);
		const drawX = tileX * TILE_WIDTH;
		const drawY = tileY * TILE_HEIGHT;

		context.beginPath();
		context.strokeStyle = "red";
		context.lineWidth = 2;
		context.strokeRect(drawX, drawY, TILE_WIDTH, TILE_HEIGHT);
	}

	function renderMap() {
		const canvas = mapCanvasRef.current;
		const context = mapContextRef.current;
		const image = imageRef.current;
		if (!canvas || !context || !image) return;

		context.clearRect(0, 0, canvas.width, canvas.height);

		// 1. Draw Map Tiles
		Object.entries(mapGrid).forEach(([key, tileData]) => {
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

		// 2. Draw Grid
		context.beginPath();
		for (let i = 0; i <= MAP_COLUMNS; i++) {
			context.moveTo(i * TILE_WIDTH, 0);
			context.lineTo(i * TILE_WIDTH, MAP_HEIGHT);
		}
		for (let i = 0; i <= MAP_ROWS; i++) {
			context.moveTo(0, i * TILE_HEIGHT);
			context.lineTo(MAP_WIDTH, i * TILE_HEIGHT);
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
				mapCanvasRef.current.width = MAP_WIDTH;
				mapCanvasRef.current.height = MAP_HEIGHT;
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

	// Redraw selection box when selectedTile changes
	useEffect(() => {
		renderPalette();
	}, [selectedTile]);

	useEffect(() => {
		renderMap();
	}, [mapGrid, selection]);

	useEffect(() => {
		function handleKeyDown(e: KeyboardEvent) {
			if (e.key === "Delete" || e.key === "Backspace") {
				if (selection) {
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
		const x = gridX / TILE_WIDTH;
		const y = gridY / TILE_HEIGHT;
		const key = `${x},${y}`;

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
			if (cx < 0 || cx >= MAP_COLUMNS || cy < 0 || cy >= MAP_ROWS) continue;

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

	function handlePaletteClick(e: MouseEvent<HTMLCanvasElement>) {
		const canvas = paletteCanvasRef.current;
		const image = imageRef.current;
		if (!canvas || !image) return;

		const rect = canvas.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;

		const tilesPerRow = Math.floor(image.width / TILE_WIDTH);
		const tileX = Math.floor(x / TILE_WIDTH);
		const tileY = Math.floor(y / TILE_HEIGHT);
		const newSelectedTile = tileY * tilesPerRow + tileX;

		setSelectedTile(newSelectedTile);
		if (currentTool !== "brush") setCurrentTool("brush");
	}

	function handleMapMouseDown(e: MouseEvent<HTMLCanvasElement>) {
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

			// Draw Hover Box
			const gridX = Math.floor(x / TILE_WIDTH) * TILE_WIDTH;
			const gridY = Math.floor(y / TILE_HEIGHT) * TILE_HEIGHT;

			context.beginPath();
			context.strokeStyle = "blue";
			context.lineWidth = 1;
			context.strokeRect(gridX, gridY, TILE_WIDTH, TILE_HEIGHT);
		}
	}

	function handleMapInteraction(e: MouseEvent<HTMLCanvasElement>) {
		const canvas = mapCanvasRef.current;
		if (!canvas) return;

		const rect = canvas.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;

		if (x < 0 || y < 0 || x >= MAP_WIDTH || y >= MAP_HEIGHT) return;

		const gridX = Math.floor(x / TILE_WIDTH) * TILE_WIDTH;
		const gridY = Math.floor(y / TILE_HEIGHT) * TILE_HEIGHT;
		const tileKey = `${gridX},${gridY}`;

		if (lastPaintedTiles.current.has(tileKey)) return;

		if (currentTool === "brush") {
			paintTile(gridX, gridY, selectedTile);
			lastPaintedTiles.current.add(tileKey);
		} else if (currentTool === "eraser") {
			paintTile(gridX, gridY, null);
			lastPaintedTiles.current.add(tileKey);
		} else if (currentTool === "bucket" && e.type === "mousedown") {
			floodFill(gridX / TILE_WIDTH, gridY / TILE_HEIGHT, selectedTile);
		} else if (currentTool === "marquee") {
			const gx = gridX / TILE_WIDTH;
			const gy = gridY / TILE_HEIGHT;
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
		tempCanvas.width = MAP_WIDTH;
		tempCanvas.height = MAP_HEIGHT;
		const ctx = tempCanvas.getContext("2d");
		if (!ctx) return;

		// Draw tiles
		Object.entries(mapGrid).forEach(([key, tileData]) => {
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

		const url = tempCanvas.toDataURL("image/png");
		const a = document.createElement("a");
		a.href = url;
		a.download = "map_image.png";
		a.click();
	}

	const resultString = `const mapGrid = ${JSON.stringify(mapGrid, null, 2)};`;


	return (
		<div>
			<h1>Map Editor</h1>

			{/* Toolbar row */}
			<div className="flex flex-wrap gap-4 items-center mb-4">
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
					>
						Brush
					</button>
					<button
						className={`px-3 py-1 rounded text-sm ${currentTool === "eraser" ? "bg-blue-600 text-white" : "bg-white text-gray-700"}`}
						onClick={() => setCurrentTool("eraser")}
					>
						Eraser
					</button>
					<button
						className={`px-3 py-1 rounded text-sm ${currentTool === "bucket" ? "bg-blue-600 text-white" : "bg-white text-gray-700"}`}
						onClick={() => setCurrentTool("bucket")}
					>
						Bucket
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

			<div className="flex gap-4 items-start">
				<div className="flex-none w-[280px]">
					<h3 className="font-bold mb-2">Palette</h3>
					<div className="border border-gray-400 inline-block bg-gray-50 max-h-[80vh] overflow-auto">
						<canvas
							ref={paletteCanvasRef}
							className="cursor-pointer block"
							onClick={handlePaletteClick}
						/>
					</div>
					<div className="mt-2 text-sm text-gray-500">
						Select a tile to paint.
					</div>
				</div>

				<div className="flex-1 overflow-auto max-h-[80vh] border border-gray-300 bg-white relative">
					<canvas
						id="myCanvas"
						ref={mapCanvasRef}
						className="block"
						onMouseDown={handleMapMouseDown}
						onMouseMove={handleMapMouseMove}
						onMouseUp={handleMapMouseUp}
						onMouseLeave={handleMapMouseUp}
					></canvas>
				</div>
			</div>

			<div id="result" className="mt-4 whitespace-pre font-mono text-sm">
				{resultString}
			</div>
		</div>
	);
}
