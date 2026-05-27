export interface Milestone {
  days: number;
  label: string;
  emoji: string;
  color: string;
  title: string;
  subtitle: string;
}

export const MILESTONES: Milestone[] = [
  { days: 3,  emoji: "🌱", label: "Seedling",  color: "#4CAF50", title: "3-Day Streak!",  subtitle: "You're building a habit. Keep going!" },
  { days: 7,  emoji: "🔥", label: "On Fire",   color: "#FF6B35", title: "One Week!",       subtitle: "A full week of drawing. You're on fire!" },
  { days: 14, emoji: "⚡", label: "Spark",     color: "#FFB800", title: "Two Weeks!",      subtitle: "Consistency is your superpower." },
  { days: 30, emoji: "🏆", label: "Champion",  color: "#C49A00", title: "30-Day Streak!",  subtitle: "A whole month. Legendary dedication." },
  { days: 50, emoji: "💎", label: "Diamond",   color: "#00BCD4", title: "50-Day Streak!",  subtitle: "You are unstoppable. Pure diamond." },
];

export function getMilestoneForStreak(streak: number): Milestone | null {
  return MILESTONES.find((m) => m.days === streak) ?? null;
}
