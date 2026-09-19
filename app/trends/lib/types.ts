// app/trends/lib/types.ts
export type TrendSourceKey = "google" | "world" | "social" | "videos";

export type TrendRelatedItem = {
  title: string;
  url?: string;
  source?: string;
  imageUrl?: string;
};

export type TrendItem = {
  title: string;
  url?: string;
  meta?: string; // e.g. traffic, score, channel, etc.
  source?: string; // e.g. subreddit, channel, publisher
  imageUrl?: string;
  publishedAt?: string;
  related?: TrendRelatedItem[];
};

export type TrendResponse =
  | { ok: true; items: TrendItem[] }
  | { ok: false; error: string; hint?: string; items?: TrendItem[] };

export type TrendBundle = {
  google: TrendResponse;
  world: TrendResponse;
  social: TrendResponse;
  videos: TrendResponse;
};
