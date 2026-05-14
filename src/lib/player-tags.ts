export interface PlayerTagDef {
  key: string;        // canonical stored value
  emoji: string;      // visual representation
  hint: string;       // tooltip text
  className: string;  // badge color classes
  aliases?: string[]; // legacy stored values mapped to this tag
}

const amber = "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30";
const emerald = "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30";
const orange = "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-500/15 dark:text-orange-400 dark:border-orange-500/30";
const red = "bg-red-100 text-red-700 border-red-300 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30";
const sky = "bg-sky-100 text-sky-700 border-sky-300 dark:bg-sky-500/15 dark:text-sky-400 dark:border-sky-500/30";
const purple = "bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-500/15 dark:text-purple-400 dark:border-purple-500/30";
const slate = "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/30";

export const PLAYER_TAGS: PlayerTagDef[] = [
  // Status / value
  { key: "VIP", emoji: "👑", hint: "VIP", className: amber },
  { key: "High Roller", emoji: "💎", hint: "High Roller", className: emerald },
  { key: "Whale", emoji: "🐋", hint: "Whale — extreme stakes", className: emerald },
  { key: "Loyal", emoji: "🤝", hint: "Loyal regular", className: emerald },
  { key: "New", emoji: "🆕", hint: "New player", className: sky },
  { key: "Birthday", emoji: "🎂", hint: "Birthday today/this week", className: purple },
  // Surveillance / risk
  { key: "Watchlist", emoji: "👁️", hint: "Watchlist", className: orange, aliases: ["Watch List"] },
  { key: "Suspicious", emoji: "🕵️", hint: "Suspicious behaviour", className: red },
  { key: "Aggressive", emoji: "⚠️", hint: "Aggressive", className: red },
  { key: "Cheater", emoji: "🃏", hint: "Suspected cheating", className: red },
  { key: "Card Counter", emoji: "🧮", hint: "Card counter", className: orange },
  { key: "Advantage Player", emoji: "🎯", hint: "Advantage play", className: orange },
  { key: "Self Excluded", emoji: "🚷", hint: "Self-excluded", className: red },
  { key: "Banned", emoji: "⛔", hint: "Banned", className: red },
  // F&B / hospitality
  { key: "Alcohol Allowed", emoji: "🍷", hint: "Alcohol allowed", className: emerald },
  { key: "Alcohol Banned", emoji: "🚫", hint: "Alcohol banned", className: red },
  { key: "Smoker", emoji: "🚬", hint: "Smoker", className: slate },
  { key: "Food Allowed", emoji: "🍽️", hint: "Food allowed", className: sky },
  { key: "Coffee", emoji: "☕", hint: "Coffee preferred", className: slate },
  // Behaviour
  { key: "Tipper", emoji: "💵", hint: "Generous tipper", className: emerald },
  { key: "Quiet", emoji: "🤫", hint: "Quiet / private", className: slate },
  { key: "Loud", emoji: "📢", hint: "Loud", className: orange },
  { key: "Lucky", emoji: "🍀", hint: "Lucky streak", className: emerald },
  { key: "Drunk", emoji: "🥴", hint: "Often drunk", className: orange },
  // Other
  { key: "Photo OK", emoji: "📸", hint: "Photo permitted", className: sky },
  { key: "No Photo", emoji: "🚫📸", hint: "No photos", className: red },
  { key: "Tourist", emoji: "🧳", hint: "Tourist", className: sky },
  { key: "Local", emoji: "🏠", hint: "Local resident", className: slate },
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

export type PlayerTagSource = "floor" | "cctv";

/** Group raw player_tags rows by source. Treats missing source as 'floor'. */
export const splitTagsBySource = (
  rows: Array<{ tag: string; source?: string | null }> | null | undefined,
): { floor: string[]; cctv: string[] } => {
  const floor: string[] = [];
  const cctv: string[] = [];
  for (const r of rows || []) {
    if ((r.source || "floor") === "cctv") cctv.push(r.tag);
    else floor.push(r.tag);
  }
  return { floor, cctv };
};
