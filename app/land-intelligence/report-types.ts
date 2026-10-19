export type Finding<T> = {
  status: "found" | "none" | "unavailable" | "outside";
  value: T | null;
  note: string;
  source: string;
  url: string;
  coverage: string;
  freshness: string;
};

export type FloodZone = { zone: string; subtype: string; special: boolean };
export type Parcel = import("./parcel-sources").ParcelRecord;
export type FatalCrash = import("./crash").FatalCrash;
export type Road = { route: string; county: string; className: string; aadt: number | null; aadtYear: number | null; speed: number | null; lanes: number | null };
export type NamedFeature = { name: string; detail: string };
export type FeatureSet<T> = { count: number; items: T[] };
export type SoilUnit = { key: string; symbol: string; name: string };
export type CensusContext = { tract: string; population: number | null; medianHouseholdIncome: number | null; povertyPercent: number | null; year: number };
export type Facility = { id: string; name: string; city: string; state: string; programs: string[]; compliance: string; accuracyMeters: number | null };
export type TerrainSample = { point: [number, number]; distanceMeters: number | null; elevationMeters: number };
export type TerrainResult = {
  status: "found" | "none" | "unavailable" | "outside";
  shapeKind: "pin" | "line" | "area";
  samples: TerrainSample[];
  requested: number;
  minMeters: number | null;
  maxMeters: number | null;
  ascentMeters: number | null;
  descentMeters: number | null;
  note: string;
  source: string;
  url: string;
};

export type Report = {
  checkedAt: string;
  elevation: Finding<number>;
  flood: Finding<FloodZone[]>;
  waterways: Finding<number>;
  wetlands: Finding<FeatureSet<NamedFeature>>;
  faults: Finding<FeatureSet<NamedFeature>>;
  parcels: Finding<FeatureSet<Parcel>>;
  roads: Finding<FeatureSet<Road>>;
  crashes: Finding<FeatureSet<FatalCrash>>;
  soils: Finding<SoilUnit[]>;
  census: Finding<CensusContext>;
  facilities: Finding<FeatureSet<Facility>>;
};
