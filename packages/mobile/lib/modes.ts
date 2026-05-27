export type AspectRatio = "1:1" | "9:16" | "16:9" | "4:5" | "4:3";

export interface Mode {
  id: string;
  label: string;
  emoji: string;
  description: string;
  aspectRatio: AspectRatio;
  badgeColor: string;
  badgeBg: string;
  promptSuffix: string;   // appended to the generation prompt
}

export const MODES: Mode[] = [
  {
    id: "cinematic",
    label: "Cinematic Reel",
    emoji: "🎬",
    description: "Widescreen film look",
    aspectRatio: "16:9",
    badgeColor: "#C45E00",
    badgeBg: "#FFF3E0",
    promptSuffix:
      "cinematic widescreen shot, film grain, dramatic lighting, anamorphic lens flare, movie still",
  },
  {
    id: "story",
    label: "Story",
    emoji: "📱",
    description: "Vertical 9:16 for reels",
    aspectRatio: "9:16",
    badgeColor: "#7C3AED",
    badgeBg: "#F3F0FF",
    promptSuffix:
      "vertical portrait composition, vibrant colors, social media story format, eye-catching",
  },
  {
    id: "ad",
    label: "Ad / Product",
    emoji: "🛍️",
    description: "Clean product shot",
    aspectRatio: "1:1",
    badgeColor: "#0369A1",
    badgeBg: "#E0F2FE",
    promptSuffix:
      "professional product advertisement, clean white background, commercial photography, high contrast",
  },
  {
    id: "portrait",
    label: "Portrait",
    emoji: "🧑",
    description: "Headshot & person",
    aspectRatio: "4:5",
    badgeColor: "#BE185D",
    badgeBg: "#FCE7F3",
    promptSuffix:
      "professional portrait photography, soft bokeh background, studio lighting, sharp facial detail",
  },
  {
    id: "concept",
    label: "Concept Art",
    emoji: "🖼️",
    description: "Fantasy & sci-fi art",
    aspectRatio: "16:9",
    badgeColor: "#5C7A1E",
    badgeBg: "#EEF5D9",
    promptSuffix:
      "concept art, digital painting, fantasy illustration, highly detailed, artstation trending",
  },
  {
    id: "logo",
    label: "Logo / Icon",
    emoji: "⬡",
    description: "Clean vector style",
    aspectRatio: "1:1",
    badgeColor: "#374151",
    badgeBg: "#F3F4F6",
    promptSuffix:
      "minimalist logo design, flat vector style, clean lines, white background, professional branding",
  },
  {
    id: "interior",
    label: "Interior Design",
    emoji: "🛋️",
    description: "Room & space design",
    aspectRatio: "4:3",
    badgeColor: "#92400E",
    badgeBg: "#FEF3C7",
    promptSuffix:
      "interior design render, architectural visualization, warm ambient lighting, photorealistic room",
  },
  {
    id: "architecture",
    label: "Architecture",
    emoji: "🏛️",
    description: "Buildings & structures",
    aspectRatio: "16:9",
    badgeColor: "#1E40AF",
    badgeBg: "#DBEAFE",
    promptSuffix:
      "architectural render, photorealistic building exterior, golden hour lighting, ultra detailed",
  },
  {
    id: "fashion",
    label: "Fashion",
    emoji: "👗",
    description: "Outfit & style shots",
    aspectRatio: "4:5",
    badgeColor: "#9D174D",
    badgeBg: "#FCE7F3",
    promptSuffix:
      "fashion photography, runway editorial, high fashion magazine spread, dramatic lighting",
  },
  {
    id: "anime",
    label: "Anime",
    emoji: "🌸",
    description: "Manga & anime style",
    aspectRatio: "1:1",
    badgeColor: "#7C3AED",
    badgeBg: "#F3F0FF",
    promptSuffix:
      "anime illustration, manga art style, vibrant colors, Studio Ghibli inspired, cel shading",
  },
];

export const DEFAULT_MODE = MODES[0]; // Cinematic Reel

// Map aspect ratio string to canvas dimensions
export function getCanvasDims(
  ratio: AspectRatio,
  availableWidth: number,
  maxHeight: number
): { w: number; h: number } {
  const ratioMap: Record<AspectRatio, number> = {
    "1:1":  1,
    "9:16": 9 / 16,
    "16:9": 16 / 9,
    "4:5":  4 / 5,
    "4:3":  4 / 3,
  };
  const r = ratioMap[ratio];
  const w = availableWidth;
  const h = Math.round(w / r);
  // If computed height exceeds available space, scale down from height
  if (h > maxHeight) {
    const wScaled = Math.round(maxHeight * r);
    return { w: wScaled, h: maxHeight };
  }
  return { w, h };
}
