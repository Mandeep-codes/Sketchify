// Global theme — import from here everywhere
export const T = {
  bg:         "#F2EDE4",   // warm cream
  card:       "#FFFFFF",   // white cards
  accent:     "#8CB33A",   // olive green
  accentDark: "#5C7A1E",   // darker olive
  accentBg:   "#EEF5D9",   // light olive tint
  textPrimary:"#1A1A1A",
  textSec:    "#6B6B6B",
  textMuted:  "#A8A8A8",
  border:     "rgba(0,0,0,0.07)",
  pill:       "#2A2A2A",   // dark pill background
  danger:     "#E84040",
  shadow: {
    shadowColor: "#000" as const,
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  card_sm: {
    shadowColor: "#000" as const,
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
};
