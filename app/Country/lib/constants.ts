export const CACHE_FEATURED_KEY = "travelExplorerFeatured_v2";
export const FEATURED_PICK_COUNT = 12;
export const WIKI_CLAMP_LENGTH = 500;
export const SWIPE_THRESHOLD_PX = 45;
export const TOP_SIGHTS_LIMIT = 7;
export const SUGGESTIONS_LIMIT = 8;

export const REGIONS = [
  { id: "all",      label: "All" },
  { id: "Europe",   label: "Europe" },
  { id: "Asia",     label: "Asia" },
  { id: "Americas", label: "Americas" },
  { id: "Africa",   label: "Africa" },
  { id: "Oceania",  label: "Oceania" },
] as const;
export type RegionId = (typeof REGIONS)[number]["id"];

export type DetailTab = "overview" | "photos" | "guide";

export const TRAVEL_TIPS: Record<string, string[]> = {
  Europe: [
    "Validate transit tickets before boarding to avoid fines",
    "Book popular museums and attractions online in advance",
    "Check Schengen visa requirements for multi-country trips",
  ],
  Asia: [
    "Carry local cash — cards aren't always accepted in markets",
    "Learn a few basic phrases — locals genuinely appreciate it",
    "Dress modestly when visiting temples and sacred sites",
  ],
  Americas: [
    "A mix of USD is handy for convenience across borders",
    "Book national park permits and eco-tours well in advance",
    "Always carry comprehensive travel insurance",
  ],
  Africa: [
    "Check visa and vaccination requirements several months early",
    "Hire a reputable local guide for wildlife and remote areas",
    "Carry sun protection and only drink bottled or treated water",
  ],
  Oceania: [
    "Book domestic flights and ferries early — they fill fast",
    "Respect and follow all indigenous cultural protocols",
    "Distances are far larger than maps suggest — plan ahead",
  ],
  default: [
    "Get comprehensive travel insurance before departure",
    "Register your trip with your country's embassy",
    "Download offline maps and a translation app",
  ],
};
