import { areaSquareMeters, distanceMeters, lengthMeters, type Coord } from "./geometry";
import { pointInParcel, type ParcelGeometry, type ParcelInspectionReport } from "./parcel-inspection";

export const PARCEL_DISCIPLINES = [
  { id: "buildings", label: "Buildings & residential", icon: "house", groups: [], note: "Building facts are in the property record above when the parcel source supplies them. Footprints, foundations, and materials are not connected nationwide.", property: true },
  { id: "land", label: "Land & cadastral", icon: "map", groups: [], note: "The selected parcel polygon, acreage, ID, valuation, and available land-use facts are in the property record above. GIS lines are not a legal survey.", property: true },
  { id: "utilities", label: "Underground utilities", icon: "cable", groups: ["denver-storm", "wet-utilities", "dry-utilities"], note: "Most utility owner networks are not connected. A mapped storm main does not establish exact alignment, depth, or an easement.", property: false },
  { id: "survey", label: "Surveys & topography", icon: "ruler", groups: ["survey-control"], note: "Nearby survey marks are reference points, not parcel corners. The separate terrain tool samples elevation; survey plats and verified parcel slope are not connected here.", property: false },
  { id: "legal", label: "Legal & ownership", icon: "scale", groups: [], note: "Available owner and legal-description fields are in the property record above. Deeds, easements, restrictions, and liens require the official recorder; they are not comprehensively searched here.", property: true },
  { id: "permits", label: "Permits & development", icon: "file", groups: [], note: "Boulder assessor permit rows and zoning references appear in the property record above when supplied. Inspection outcomes, approved plans, and setbacks are not comprehensively connected.", property: true },
  { id: "ecology", label: "Environmental & ecology", icon: "leaf", groups: ["wetlands"], note: "Wetlands mapping is an inventory, not a jurisdictional determination. Habitat and protected-species parcel queries are not connected.", property: false },
  { id: "water", label: "Water & flood", icon: "waves", groups: ["flood", "waterways", "groundwater-sites"], note: "Flood, stream, and nearby groundwater-site records are screening data. A nearby well is not a parcel water-level measurement.", property: false },
  { id: "transport", label: "Transportation & civil", icon: "route", groups: ["roads", "colorado-local-roads", "colorado-bridges"], note: "Colorado highway and local-road centerlines plus nearby bridge/culvert points are screening records. Physical proximity does not establish legal access, an easement, pavement condition, or bridge ownership.", property: false },
  { id: "geology", label: "Geology & geotechnical", icon: "mountain", groups: ["soils", "faults", "karst", "florida-subsidence"], note: "Mapped soil and geology are regional screening layers, not a site boring or engineering assessment.", property: false },
  { id: "hazards", label: "Hazards & restrictions", icon: "shield", groups: ["mines", "colorado-tanks", "superfund"], note: "These are mapped records, not a complete risk or restriction search. Wildfire, radon, pipeline and protected-land parcel screening is not connected.", property: false },
  { id: "commercial", label: "Commercial & industrial", icon: "factory", groups: ["facilities"], note: "EPA-regulated facilities are mapped near the parcel. Building usage and full industrial land-use history are not connected.", property: false },
] as const;

export function parcelMetrics(geometry: ParcelGeometry) {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  let areaMeters2 = 0, perimeterMeters = 0;
  for (const polygon of polygons) {
    areaMeters2 += areaSquareMeters(polygon[0] as Coord[]) - polygon.slice(1).reduce((sum, ring) => sum + areaSquareMeters(ring as Coord[]), 0);
    for (const ring of polygon) perimeterMeters += lengthMeters(ring as Coord[]);
  }
  return { areaMeters2: Math.max(0, areaMeters2), perimeterMeters };
}

const interpolate = (a: Coord, b: Coord, t: number): Coord => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

function splitAtRing(a: Coord, b: Coord, ring: number[][], splits: number[]) {
  for (let i = 1; i < ring.length; i++) {
    const c = ring[i - 1] as Coord, d = ring[i] as Coord;
    const rX = b[0] - a[0], rY = b[1] - a[1], sX = d[0] - c[0], sY = d[1] - c[1];
    const denominator = rX * sY - rY * sX;
    if (Math.abs(denominator) < 1e-15) continue;
    const qX = c[0] - a[0], qY = c[1] - a[1];
    const t = (qX * sY - qY * sX) / denominator;
    const u = (qX * rY - qY * rX) / denominator;
    if (t > 0 && t < 1 && u >= 0 && u <= 1) splits.push(t);
  }
}

/** Approximate length of a mapped line within a parcel, including holes and separate islands. */
export function lineInsideParcelMeters(line: GeoJSON.LineString | GeoJSON.MultiLineString, parcel: ParcelGeometry) {
  const lines = line.type === "LineString" ? [line.coordinates] : line.coordinates;
  const polygons = parcel.type === "Polygon" ? [parcel.coordinates] : parcel.coordinates;
  let total = 0;
  for (const coordinates of lines) for (let i = 1; i < coordinates.length; i++) {
    const a = coordinates[i - 1] as Coord, b = coordinates[i] as Coord;
    const splits = [0, 1];
    for (const polygon of polygons) for (const ring of polygon) splitAtRing(a, b, ring, splits);
    splits.sort((x, y) => x - y);
    for (let j = 1; j < splits.length; j++) {
      const from = splits[j - 1], to = splits[j];
      if (to - from < 1e-10 || !pointInParcel(interpolate(a, b, (from + to) / 2), parcel)) continue;
      total += distanceMeters(interpolate(a, b, from), interpolate(a, b, to));
    }
  }
  return total;
}

export function parcelDisciplineSummary(report: ParcelInspectionReport) {
  return PARCEL_DISCIPLINES.map((discipline) => {
    const groups = report.groups.filter((group) => (discipline.groups as readonly string[]).includes(group.id));
    return {
      id: discipline.id, label: discipline.label, icon: discipline.icon, note: discipline.note, property: discipline.property,
      findings: groups.reduce((sum, group) => sum + group.findings.length, 0),
      unavailable: groups.filter((group) => group.status === "unavailable" || group.status === "source_error" || group.status === "partial").length,
      unqueried: groups.filter((group) => group.status === "not_queried").length,
      unknown: groups.filter((group) => group.status === "coverage_unknown").length,
      empty: groups.filter((group) => group.status === "no_features").length,
      outside: groups.filter((group) => group.status === "outside_coverage").length,
      groups,
    };
  });
}

export type CrossSourceObservation = { id: string; text: string; rule: string; sources: { label: string; url: string }[] };

/** Describe only relations established by two returned parcel-intersection records. */
export function crossSourceObservations(report: ParcelInspectionReport): CrossSourceObservation[] {
  const sourceLink = (recordUrl: string, groupUrl: string) => /^https:\/\//i.test(recordUrl) ? recordUrl : groupUrl;
  const firstIntersecting = (id: string) => {
    const group = report.groups.find((item) => item.id === id && item.status === "found");
    const finding = group?.findings.find((item) => item.relationship !== "nearby");
    return group && finding ? { group, finding } : null;
  };
  const flood = firstIntersecting("flood"), wetland = firstIntersecting("wetlands");
  if (!flood || !wetland) return [];
  return [{
    id: "flood-wetland",
    text: "A mapped flood polygon and a mapped wetland polygon each intersect this parcel. Their overlap with each other has not been established.",
    rule: "Both source groups returned an intersecting feature for the selected parcel; nearby points and incomplete source results do not qualify.",
    sources: [
      { label: `${flood.group.source}: ${flood.finding.sourceRecordId || flood.finding.name}`, url: sourceLink(flood.finding.recordUrl, flood.group.sourceUrl) },
      { label: `${wetland.group.source}: ${wetland.finding.sourceRecordId || wetland.finding.name}`, url: sourceLink(wetland.finding.recordUrl, wetland.group.sourceUrl) },
    ],
  }];
}
