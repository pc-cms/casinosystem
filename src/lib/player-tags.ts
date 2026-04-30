export interface PlayerTagDef {
  key: string;        // canonical stored value
  emoji: string;      // visual representation
  hint: string;       // tooltip text
  className: string;  // badge color classes
  aliases?: string[]; // legacy stored values mapped to this tag
}

export const PLAYER_TAGS: PlayerTagDef[] = [
  {
    key: "VIP",
    emoji: "👑",
    hint: "VIP",
    className: "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30",
  },
  {
    key: "High Roller",
    emoji: "💎",
    hint: "High Roller",
    className: "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30",
  },
  {
    key: "Watchlist",
    emoji: "👁️",
    hint: "Watchlist",
    className: "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-500/15 dark:text-orange-400 dark:border-orange-500/30",
    aliases: ["Watch List"],
  },
  {
    key: "Aggressive",
    emoji: "⚠️",
    hint: "Aggressive",
    className: "bg-red-100 text-red-700 border-red-300 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30",
  },
  {
    key: "Suspicious",
    emoji: "🕵️",
    hint: "Suspicious",
    className: "bg-red-100 text-red-700 border-red-300 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30",
  },
  {
    key: "Alcohol Allowed",
    emoji: "🍷",
    hint: "Alcohol Allowed",
    className: "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30",
  },
  {
    key: "Alcohol Banned",
    emoji: "🚫🍷",
    hint: "Alcohol Banned",
    className: "bg-red-100 text-red-700 border-red-300 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30",
  },
  {
    key: "Food Allowed",
    emoji: "🍽️",
    hint: "Food Allowed",
    className: "bg-sky-100 text-sky-700 border-sky-300 dark:bg-sky-500/15 dark:text-sky-400 dark:border-sky-500/30",
  },
];

const TAG_INDEX: Record<string, PlayerTagDef> = (() => {
  const map: Record<string, PlayerTagDef> = {};
  for (const t of PLAYER_TAGS) {
    map[t.key] = t;
    for (const a of t.aliases ?? []) map[a] = t;
  }
  return map;
})();

export const getTagDef = (tag: string): PlayerTagDef | undefined => TAG_INDEX[tag];
