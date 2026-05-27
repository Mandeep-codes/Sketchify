import AsyncStorage from "@react-native-async-storage/async-storage";

export const Storage = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const v = await AsyncStorage.getItem(key);
      return v ? (JSON.parse(v) as T) : null;
    } catch {
      return null;
    }
  },
  async set<T>(key: string, value: T): Promise<void> {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch {}
  },
  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch {}
  },
};

export const KEYS = {
  ONBOARDING_DONE: "onboarding_done",
  STREAK_DATE:     "streak_last_date",
  STREAK_COUNT:    "streak_count",
  GALLERY_ITEMS:   "gallery_items",
  BADGES:          "earned_badges",
  BRUSH_PRESETS:   "brush_presets",
  PROFILE:         "user_profile",
  STREAK_BEST:     "streak_best",
  DEFAULT_STYLE:   "default_style",
};
