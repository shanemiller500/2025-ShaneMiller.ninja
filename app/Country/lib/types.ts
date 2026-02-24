export interface LiteCountry {
  cca3: string;
  name: { common: string };
  flags?: { png?: string; svg?: string; alt?: string };
  continents?: string[];
}

export interface FullCountry extends LiteCountry {
  cca2?: string;
  latlng?: [number, number];
  capital?: string[];
  tld?: string[];
  area?: number;
  population?: number;
  subregion?: string;
  languages?: Record<string, string>;
  currencies?: Record<string, { symbol: string; name?: string }>;
  borders?: string[];
  timezones?: string[];
  idd?: { root?: string; suffixes?: string[] };
}

export interface Extras {
  weather?: { temperature: number; windspeed?: number; weathercode?: number };
  fx?: number | null;
  wiki?: { extract?: string; thumbnail?: { source: string } };
  sights?: { title: string; dist: number }[];
  photos?: string[];
}

export interface AITravelInsights {
  country: string;
  quickSummary: string;
  bestTimeToVisit: { summary: string; months: string[] };
  topExperiences: { title: string; why: string; where: string }[];
  dos: string[];
  donts: string[];
  safety: { commonRisks: string[]; scamsToWatch: string[]; gettingHelp: string };
  money: { currency: string; paymentTips: string[]; tipping: string };
  gettingAround: { insideCities: string[]; betweenCities: string[]; roadNotes: string };
  foodAndDrink: { mustTry: string[]; waterAdvice: string };
}
