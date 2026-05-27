import React, { createContext, useContext, useState, useCallback } from "react";

export interface Album {
  id: string;
  name: string;
  createdAt: number;
  itemIds: string[];
}

interface AlbumsContextType {
  albums: Album[];
  createAlbum: (name: string) => Album;
  deleteAlbum: (id: string) => void;
  renameAlbum: (id: string, name: string) => void;
  addToAlbum: (albumId: string, itemId: string) => void;
  removeFromAlbum: (albumId: string, itemId: string) => void;
}

const AlbumsContext = createContext<AlbumsContextType>({
  albums: [],
  createAlbum: () => ({ id: "", name: "", createdAt: 0, itemIds: [] }),
  deleteAlbum: () => {},
  renameAlbum: () => {},
  addToAlbum: () => {},
  removeFromAlbum: () => {},
});

export function AlbumsProvider({ children }: { children: React.ReactNode }) {
  const [albums, setAlbums] = useState<Album[]>([]);

  const createAlbum = useCallback((name: string): Album => {
    const album: Album = {
      id: Math.random().toString(36).slice(2),
      name: name.trim() || "Untitled Album",
      createdAt: Date.now(),
      itemIds: [],
    };
    setAlbums((prev) => [album, ...prev]);
    return album;
  }, []);

  const deleteAlbum = useCallback((id: string) => {
    setAlbums((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const renameAlbum = useCallback((id: string, name: string) => {
    setAlbums((prev) =>
      prev.map((a) => (a.id === id ? { ...a, name: name.trim() || a.name } : a))
    );
  }, []);

  const addToAlbum = useCallback((albumId: string, itemId: string) => {
    setAlbums((prev) =>
      prev.map((a) =>
        a.id === albumId && !a.itemIds.includes(itemId)
          ? { ...a, itemIds: [...a.itemIds, itemId] }
          : a
      )
    );
  }, []);

  const removeFromAlbum = useCallback((albumId: string, itemId: string) => {
    setAlbums((prev) =>
      prev.map((a) =>
        a.id === albumId
          ? { ...a, itemIds: a.itemIds.filter((id) => id !== itemId) }
          : a
      )
    );
  }, []);

  return (
    <AlbumsContext.Provider
      value={{ albums, createAlbum, deleteAlbum, renameAlbum, addToAlbum, removeFromAlbum }}
    >
      {children}
    </AlbumsContext.Provider>
  );
}

export function useAlbums() {
  return useContext(AlbumsContext);
}
