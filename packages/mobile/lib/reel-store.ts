/**
 * Tiny in-memory store for reel image data.
 * Avoids passing large base64 strings through URL params (causes freeze/crash).
 */

let _images: string[] = [];

export const reelStore = {
  set(images: string[]) {
    _images = images;
  },
  get(): string[] {
    return _images;
  },
  clear() {
    _images = [];
  },
};
