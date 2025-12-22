# Map Editor

A React-based 2D Tile Map Editor for creating and editing game maps.

## Features

### Tools
- **Brush**: Paint tiles onto the grid.
- **Eraser**: Remove tiles from the grid.
- **Bucket Fill**: Flood fill contiguous areas with a selected tile.
- **Marquee Selection**: Select rectangular areas of the map.
    - **Copy (Cmd+C)**: Copy selection to clipboard.
    - **Paste (Cmd+V)**: Paste clipboard content.
    - **Delete**: Clear selected area.

### Palette & layout
- **Dynamic Palette**: Automatically resizes to fit your uploaded spritesheet.
- **Grid Overlay**: Visual helper on the palette to see tile boundaries (32x32).
- **Split View**: Fixed palette on the left, scrollable map on the right.

### Start & Export
- **Save JSON**: Download your map data (`map_data.json`) to save your progress.
- **Load JSON**: Upload a saved JSON file to restore your map.
- **Export PNG**: Download a clean PNG image of your map (`map_image.png`).

## Setup

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Run the development server:
   ```bash
   pnpm run dev
   ```

3. Open your browser to the local server address (usually `http://localhost:5173`).

## Usage

1. **Select a Tile**: Click any tile in the Palette on the left.
2. **Draw**: Click and drag on the Map to paint.
3. **Change Tools**: Use the toolbar buttons to switch between Brush, Eraser, Bucket, and Marquee.
4. **Change Spritesheet**: Use the file input in the toolbar to upload a custom spritesheet (`.png`).
