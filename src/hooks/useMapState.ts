import { useState, useEffect, useRef, useCallback } from "react";
import { useImmer } from "use-immer";
import { type Layer, type SelectionRect, type TileGroup } from "../types";
import { INITIAL_TILE_GROUPS } from "../constants/tileGroups";

const STORAGE_KEY = "tile_craft_editor_v1";

// 4.5 MB Limit (Safe margin for 5MB localStorage)
const STORAGE_SIZE_LIMIT = 4.5 * 1024 * 1024;

const INITIAL_LAYERS: Layer[] = [
    { id: "ground", name: "Ground", visible: true, opacity: 1, data: {} },
    { id: "decor", name: "Decoration", visible: true, opacity: 1, data: {} },
    { id: "collision", name: "Collision", visible: true, opacity: 0.5, data: {} },
];

const INITIAL_MAP_SIZE = { width: 64, height: 16 };

export function useMapState() {
    const [layers, setLayers] = useImmer<Layer[]>(INITIAL_LAYERS);
    const [mapSize, setMapSize] = useState(INITIAL_MAP_SIZE);
    const [recentStamps, setRecentStamps] = useImmer<SelectionRect[]>([]);
    const [tileGroups, setTileGroups] = useImmer<Record<string, TileGroup>>(INITIAL_TILE_GROUPS);

    // History Stacks
    const historyPast = useRef<Layer[][]>([]);
    const historyFuture = useRef<Layer[][]>([]);

    const isHydrated = useRef(false);
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Hydration
    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const data = JSON.parse(raw);
                if (data && Array.isArray(data.layers) && data.mapSize) {
                    setLayers(data.layers);
                    setMapSize(data.mapSize);
                    if (data.recentStamps) {
                        setRecentStamps(data.recentStamps);
                    }
                    if (data.tileGroups) {
                        setTileGroups(data.tileGroups);
                    }
                } else if (Array.isArray(data)) {
                    // Legacy fallback if just layers were saved
                    setLayers(data);
                }
            }
        } catch (e) {
            console.error("Failed to hydrate map state", e);
        } finally {
            isHydrated.current = true;
        }
    }, [setLayers, setRecentStamps]);

    // Persistence
    useEffect(() => {
        if (!isHydrated.current) return;

        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = setTimeout(() => {
            try {
                const state = {
                    layers,
                    mapSize,
                    recentStamps,
                    tileGroups
                };
                const json = JSON.stringify(state);

                if (json.length > STORAGE_SIZE_LIMIT) {
                    console.warn(`Map data exceeds storage limit (${(json.length / 1024 / 1024).toFixed(2)}MB)`);
                    return;
                }

                localStorage.setItem(STORAGE_KEY, json);
            } catch (e) {
                console.error("Failed to save map state", e);
            }
        }, 500); // 500ms debounce

        return () => {
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        };
    }, [layers, mapSize, recentStamps, tileGroups]);

    const addRecentStamp = useCallback((stamp: SelectionRect) => {
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
    }, [setRecentStamps]);

    // Checkpoint
    const saveCheckpoint = useCallback(() => {
        historyPast.current.push(layers);
        if (historyPast.current.length > 50) historyPast.current.shift();
        historyFuture.current = [];
    }, [layers]);

    // Undo
    const performUndo = useCallback(() => {
        if (historyPast.current.length === 0) return;
        const previous = historyPast.current.pop();
        if (previous) {
            historyFuture.current.push(layers);
            setLayers(previous);
        }
    }, [layers, setLayers]);

    // Redo
    const performRedo = useCallback(() => {
        if (historyFuture.current.length === 0) return;
        const next = historyFuture.current.pop();
        if (next) {
            historyPast.current.push(layers);
            setLayers(next);
        }
    }, [layers, setLayers]);

    // Clear history on map size change to avoid incongruity? 
    // Or just let it be. Usually resizing doesn't break tile data directly but 
    // for simplicity we won't clear history.

    const addLayer = useCallback((baseName: string) => {
        saveCheckpoint();
        setLayers(draft => {
            // Uniqueness check
            let name = baseName;
            let counter = 1;
            while (draft.some(l => l.name === name)) {
                name = `${baseName} (${counter})`;
                counter++;
            }

            const newId = crypto.randomUUID();
            draft.push({
                id: newId,
                name: name,
                visible: true,
                opacity: 1,
                data: {}
            });
        });
    }, [setLayers, saveCheckpoint]);

    const removeLayer = useCallback((index: number) => {
        // Prevent deleting last layer
        if (layers.length <= 1) return;
        saveCheckpoint();
        setLayers(draft => {
            draft.splice(index, 1);
        });
    }, [layers.length, setLayers, saveCheckpoint]);

    const renameLayer = useCallback((index: number, newName: string) => {
        setLayers(draft => {
            // Basic uniqueness check: if exists, don't rename (or could suffix).
            // For UI simplicity, we'll strict reject or auto-suffix.
            // Let's auto-suffix to be safe and easy.
            let name = newName;
            let counter = 1;
            // Check against OTHER layers
            while (draft.some((l, i) => i !== index && l.name === name)) {
                name = `${newName} (${counter})`;
                counter++;
            }
            draft[index].name = name;
        });
    }, [setLayers]);

    const addTileGroup = useCallback((group: TileGroup) => {
        setTileGroups(draft => {
            draft[group.id] = group;
        });
    }, [setTileGroups]);

    const removeTileGroup = useCallback((id: string) => {
        setTileGroups(draft => {
            delete draft[id];
        });
    }, [setTileGroups]);

    const updateTileGroup = useCallback((id: string, updates: Partial<TileGroup>) => {
        setTileGroups(draft => {
            const group = draft[id];
            if (group) {
                Object.assign(group, updates);
            }
        });
    }, [setTileGroups]);



    return {
        layers,
        setLayers,
        mapSize,
        setMapSize,

        recentStamps,
        addRecentStamp,
        saveCheckpoint,
        performUndo,
        performRedo,

        addLayer,
        removeLayer,
        renameLayer,

        tileGroups,
        addTileGroup,
        removeTileGroup,
        updateTileGroup
    };
}
