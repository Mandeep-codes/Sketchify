import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { Storage, KEYS } from "./storage";

export interface RemixEntry {
  style: string;
  generatedBase64: string;
  createdAt: number;
}

export interface SerializedStroke {
  d: string;
  color: string;
  strokeWidth: number;
}

export interface GalleryItem {
  id: string;
  sketchBase64: string;
  generatedBase64: string;
  style: string;
  modeId?: string;       // which mode was used to generate this
  modeLabel?: string;    // human-readable label
  createdAt: number;
  isFavorite?: boolean;
  sketchId?: string;     // groups all remixes of the same sketch
  remixes?: RemixEntry[]; // other styles generated for this sketch
  strokes?: SerializedStroke[]; // drawing replay data
}

interface GalleryContextType {
  items: GalleryItem[];
  addItem: (item: Omit<GalleryItem, "id" | "createdAt" | "isFavorite">) => string;
  removeItem: (id: string) => void;
  toggleFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;
  addRemix: (sketchId: string, style: string, generatedBase64: string) => void;
}

const GalleryContext = createContext<GalleryContextType>({
  items: [],
  addItem: () => "",
  removeItem: () => {},
  toggleFavorite: () => {},
  isFavorite: () => false,
  addRemix: () => {},
});

export function GalleryProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load from AsyncStorage on mount
  useEffect(() => {
    Storage.get<GalleryItem[]>(KEYS.GALLERY_ITEMS).then((saved) => {
      if (saved && Array.isArray(saved)) setItems(saved);
      setLoaded(true);
    });
  }, []);

  // Persist whenever items change (after initial load)
  useEffect(() => {
    if (!loaded) return;
    Storage.set(KEYS.GALLERY_ITEMS, items);
  }, [items, loaded]);

  const addItem = useCallback((item: Omit<GalleryItem, "id" | "createdAt" | "isFavorite">): string => {
    const id = Math.random().toString(36).slice(2);
    const newItem: GalleryItem = { ...item, id, createdAt: Date.now(), isFavorite: false };
    setItems((prev) => [newItem, ...prev]);
    return id;
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, isFavorite: !i.isFavorite } : i))
    );
  }, []);

  const isFavorite = useCallback((id: string): boolean => {
    return items.find((i) => i.id === id)?.isFavorite ?? false;
  }, [items]);

  // Add a remix to the primary gallery item that shares the same sketchId
  const addRemix = useCallback((sketchId: string, style: string, generatedBase64: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.sketchId !== sketchId) return item;
        // Only update the primary item (earliest createdAt for this sketchId)
        const siblings = prev.filter((x) => x.sketchId === sketchId);
        const primary  = siblings.reduce((a, b) => (a.createdAt < b.createdAt ? a : b));
        if (item.id !== primary.id) return item;
        const existing = item.remixes ?? [];
        // Don't duplicate same style
        if (existing.some((r) => r.style === style)) {
          return { ...item, remixes: existing.map((r) => r.style === style ? { ...r, generatedBase64, createdAt: Date.now() } : r) };
        }
        return { ...item, remixes: [...existing, { style, generatedBase64, createdAt: Date.now() }] };
      })
    );
  }, []);

  return (
    <GalleryContext.Provider value={{ items, addItem, removeItem, toggleFavorite, isFavorite, addRemix }}>
      {children}
    </GalleryContext.Provider>
  );
}

export function useGallery() {
  return useContext(GalleryContext);
}
