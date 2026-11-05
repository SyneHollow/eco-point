// Shared types and constants for badges, gardens and eco challenges (server and client).

export type GardenItemKind = "plant" | "flower" | "tree" | "decor" | "rare";

export type GardenItem = {
  code: string;
  name: string;
  kind: GardenItemKind;
  cost: number | null; // null = only won with a badge
  grows: boolean;
  info: string;
  badge: string | null; // badge that wins it, if any
};

export type Plant = {
  id: string;
  item: string;
  plot: number | null; // null = waiting in the shed
  stage: 0 | 1 | 2 | 3;
  waterings: number;
  watered_today: boolean;
  source: "bought" | "reward";
  cost: number;
  badge: string | null;
  planted_on: string;
};

export type BadgeTier = {
  code: string;
  name: string;
  tagline: string;
  threshold: number;
  reward_item: string | null;
  reward_name: string | null;
  reached: boolean;
};

export type ClassBadges = {
  month: string;
  points: number;
  tiers: BadgeTier[];
  history: Array<{ month: string; code: string; name: string; points: number }>;
};

export type Garden = {
  today: string;
  class: { id: string; name: string };
  plots: number;
  earned: number;
  spent: number;
  available: number;
  new_rewards: Array<{ badge: string; item: string; name: string }>;
  items: GardenItem[];
  plants: Plant[];
  events: Array<{ kind: "bought" | "reward" | "grew"; detail: string; date: string }>;
  badges: ClassBadges;
};

export const STAGE_NAMES = ["Seed", "Sprout", "Young plant", "Fully grown"] as const;
export const PLOTS = 18;

export type Challenge = {
  id: string;
  token: string;
  title: string;
  summary: string;
  steps: string;
  place: string | null;
  points: number;
  kind: "instant" | "review";
  repeat_every: "day" | "week" | "month" | "once";
  status: "approved" | "pending" | null;
  answer: string | null;
  review_note: string | null;
  last_rejected: string | null;
  done_count: number;
};

export type MyChallenges = {
  today: string;
  open: boolean;
  points_start_date: string | null;
  challenges: Challenge[];
};

export const REPEAT_LABEL: Record<Challenge["repeat_every"], string> = {
  day: "Once a day",
  week: "Once a week",
  month: "Once a month",
  once: "Once only",
};

export const REPEAT_AGAIN: Record<Challenge["repeat_every"], string> = {
  day: "Done today. You can do it again tomorrow.",
  week: "Done this week. You can do it again next week.",
  month: "Done this month. You can do it again next month.",
  once: "Done. This one can only be done once.",
};

export type BadgeRow = {
  class_id: string;
  class_name: string;
  grade: number;
  points: number;
  tier_code: string | null;
  tier_name: string | null;
  next_code: string | null;
  next_name: string | null;
  next_threshold: number | null;
};

export type BadgeTierPublic = { code: string; name: string; tagline: string; threshold: number; sort: number; reward_name: string | null };

export type GardenPlot = { class_id: string; class_name: string; item_code: string; plot: number; stage: number };
