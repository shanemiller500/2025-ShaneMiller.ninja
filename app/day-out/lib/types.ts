export type Category = "Home" | "Ride" | "War" | "Music" | "Hinterland" | "Camping" | "Motorsport" | "Transit" | "Beach" | "Event";
export type Point = { latitude: number; longitude: number };
export type Source = { name: string; url: string; fetchedAt: string; updatedAt?: string; attribution?: string };
export type Provider<T> = { status: "available" | "unavailable" | "unconfigured"; data: T; source: Source; note?: string };
export type Stop = Point & { name: string };
export type Activity = {
  id: string; kind: "place" | "event" | "ride" | "home"; title: string; description: string;
  category: Category; region: string; suburb: string; address?: string; venue?: string;
  latitude?: number; longitude?: number; environment: "indoor" | "outdoor" | "mixed";
  imageUrl?: string; imageAttribution?: string; imageSourceUrl?: string;
  price?: string; isFree?: boolean; bookingRequired?: boolean;
  startDate?: string; endDate?: string; openingHours?: string;
  source: Source; curated?: boolean; stops?: Stop[];
  // "transit" ideas are planned by tram / train, so Directions opens in transit mode.
  travel?: "transit";
  // Label for the main button on a stay-home idea, which has nowhere to navigate to.
  cta?: string;
  // A sourced hours schedule, when supplied by a provider. Never inferred by AI.
  hours?: { days: number[]; open: string; close: string };
};
export type Weather = {
  temperature: number; rain: number; wind: number; code: number;
  rainNextHours: number; maxTemperature: number; time: string;
};
export type Surf = { waveHeight: number; wavePeriod: number; time: string };
export type Notice = {
  id: string; title: string; description: string; source: Source;
  kind: "traffic" | "park"; severity: "warning" | "info"; areas: string[];
  points?: Point[]; startDate?: string; endDate?: string;
};
export type DayData = {
  generatedAt: string; activities: Activity[];
  weather: Provider<Weather | null>; surf: Provider<Surf | null>;
  events: Provider<Activity[]>; traffic: Provider<Notice[]>; news: Provider<Notice[]>;
};
export type Preferences = { freeOnly: boolean; interests: Category[] };
export type Recommendation = { activity: Activity; score: number; reason: string; distanceKm?: number; notices: Notice[] };
