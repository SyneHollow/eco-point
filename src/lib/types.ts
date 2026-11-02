export type School = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  today: string;
  points_start_date: string | null;
  baseline: boolean;
};

export type LeaderRow = {
  class_id: string;
  class_name: string;
  grade: number;
  points: number;
  days_submitted: number;
  rank: number;
};

export type ImpactItem = {
  code: string;
  label: string;
  input_type: "count" | "check";
  entered_by: "self" | "peer";
  sdgs: number[];
  total: number;
  pct: number | null;
  answers: number;
};

export type Impact = {
  from: string;
  to: string;
  entries: number;
  audits: number;
  student_days: number;
  points: number;
  eco_actions: number;
  items: ImpactItem[];
};

export type Champion = { month: string; class_name: string | null; points: number | null; was_tie: boolean };

export type SeriesRow = { day: string; code: string; label: string; pct: number | null };
