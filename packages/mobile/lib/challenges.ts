export interface Challenge {
  title: string;
  description: string;
  emoji: string;
}

export const CHALLENGES: Challenge[] = [
  { title: "Haunted Lighthouse", description: "Draw a haunted lighthouse at night", emoji: "🏚️" },
  { title: "Dream Treehouse", description: "Sketch your dream treehouse", emoji: "🌳" },
  { title: "Robot Tea Party", description: "A robot having tea in a garden", emoji: "🤖" },
  { title: "Floating City", description: "Draw a city floating in the clouds", emoji: "🏙️" },
  { title: "Space Cat", description: "A cat wearing a space suit", emoji: "🐱" },
  { title: "Food Character", description: "Your favourite food as a character", emoji: "🍕" },
  { title: "Reading Dragon", description: "Draw a dragon reading a book", emoji: "🐉" },
  { title: "House in a Bottle", description: "A tiny house inside a bottle", emoji: "🍾" },
  { title: "Futuristic Bike", description: "Sketch a futuristic bicycle", emoji: "🚲" },
  { title: "Autumn Fox", description: "A fox running through autumn leaves", emoji: "🦊" },
  { title: "Underwater Castle", description: "Draw an underwater castle", emoji: "🏰" },
  { title: "Wizard's Desk", description: "A wizard's messy desk", emoji: "🧙" },
  { title: "Phoenix Rising", description: "Sketch a phoenix rising from flames", emoji: "🔥" },
  { title: "Pilot Dog", description: "A dog piloting a hot-air balloon", emoji: "🐕" },
  { title: "Glowing Forest", description: "A forest full of glowing mushrooms", emoji: "🍄" },
  { title: "Cyberpunk Vintage", description: "A vintage car in a cyberpunk city", emoji: "🚗" },
  { title: "Dream Café", description: "Sketch your dream café", emoji: "☕" },
  { title: "Mountain Bear", description: "A bear playing guitar on a mountain", emoji: "🐻" },
  { title: "Magic Portal", description: "Draw a magic portal in the woods", emoji: "🌀" },
  { title: "Backyard Astronaut", description: "A tiny astronaut exploring a backyard", emoji: "👨‍🚀" },
  { title: "Flying Whale", description: "Sketch a whale flying through the sky", emoji: "🐋" },
  { title: "Knight vs Spider", description: "A knight fighting a giant spider", emoji: "🕷️" },
  { title: "Snowy Cabin", description: "Draw a cozy cabin in a snowstorm", emoji: "🏠" },
  { title: "Neon Mermaid", description: "A mermaid in a neon-lit lagoon", emoji: "🧜" },
  { title: "Jungle Clock Tower", description: "A clock tower in a jungle", emoji: "🕐" },
  { title: "Universe Artist", description: "A child drawing their own universe", emoji: "🌌" },
  { title: "Robot Garden", description: "A robot garden with metal flowers", emoji: "🌸" },
  { title: "Sky Pirates", description: "A pirate ship sailing through clouds", emoji: "🏴‍☠️" },
  { title: "Ancient Map", description: "An ancient map with sea monsters", emoji: "🗺️" },
  { title: "Midnight Market", description: "A midnight market in a fantasy city", emoji: "🌙" },
];

/** Returns today's challenge — consistent for the whole day */
export function getTodayChallenge(): Challenge {
  const day = Math.floor(Date.now() / 86_400_000); // days since epoch
  return CHALLENGES[day % CHALLENGES.length]!;
}
