import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { loadBoulderProperty, publicationApproved, type BoulderAccount } from "./boulder-property";
import { BOULDER_CALIBRATION, selectComparables, type CompResult, type CompRow } from "./comps";

type CompsIndex = { asOf: string; windowStart: string; rows: CompRow[]; centroids: { fetchedAt: string; attribution: string; folios: number } | null };
export type BoulderComparables =
  | { status: "ready"; result: CompResult; source: { asOf: string; windowStart: string; sales: number; centroids: CompsIndex["centroids"]; sourceUrl: string; account: string } }
  | { status: "not_loaded" | "rights_pending" | "not_supported"; reason: string };

const directory = () => join(process.cwd(), "data", "land-intelligence", "boulder");
// One parsed index per snapshot per server instance (about 22,000 rows).
let cached: { snapshot: string; index: CompsIndex; points: Record<string, [number, number]> } | null = null;

async function loadIndex() {
  const manifest = JSON.parse(await readFile(join(directory(), "manifest.json"), "utf8")) as { snapshot: string; schema?: number; sourceUrl: string };
  if (!/^snapshot-[0-9T-Z-]+$/.test(manifest.snapshot) || (manifest.schema ?? 0) < 3) throw new Error("Snapshot has no comparables index");
  if (cached?.snapshot === manifest.snapshot) return { ...cached, sourceUrl: manifest.sourceUrl };
  const index = JSON.parse(gunzipSync(await readFile(join(directory(), manifest.snapshot, "comps.json.gz"))).toString("utf8")) as CompsIndex;
  let points: Record<string, [number, number]> = {};
  try { points = JSON.parse(gunzipSync(await readFile(join(directory(), "centroids.json.gz"))).toString("utf8")).points ?? {}; } catch { /* distance unavailable: neighborhood matching */ }
  cached = { snapshot: manifest.snapshot, index, points };
  return { ...cached, sourceUrl: manifest.sourceUrl };
}

/** Comparable sales for one Boulder folio. A parcel with several assessor accounts is not valued: its sales and buildings cannot be assigned to one account reliably. */
export async function boulderComparables(folio: string, fallbackPoint?: () => Promise<[number, number] | null>): Promise<BoulderComparables> {
  const lookup = await loadBoulderProperty(folio);
  if (lookup.status === "rights_pending") return { status: "rights_pending", reason: "Boulder County records are withheld until the county confirms republication rights." };
  if (lookup.status !== "ready" || !lookup.property) return { status: "not_loaded", reason: "The Boulder County assessor snapshot is not loaded on this server." };
  if (!publicationApproved()) return { status: "rights_pending", reason: "Boulder County records are withheld until the county confirms republication rights." };
  const accounts = lookup.property.accounts;
  if (accounts.length !== 1) return { status: "not_supported", reason: `This parcel has ${accounts.length} assessor accounts; comparable sales are calculated only for single-account parcels.` };
  const account: BoulderAccount = accounts[0];
  if (!account.profile?.units) return { status: "not_supported", reason: "The county record has no finished building area or GIS land area to compare." };
  let loaded;
  try { loaded = await loadIndex(); } catch { return { status: "not_loaded", reason: "This snapshot was built without the comparables index; re-run the Boulder import." }; }
  const result = selectComparables({ folio, type: account.profile.type, basis: account.profile.basis, units: account.profile.units, yearBuilt: account.profile.yearBuilt, neighborhood: account.neighborhood ?? "", point: loaded.points[folio] ?? (fallbackPoint ? await fallbackPoint() : null) }, loaded.index.rows, loaded.index.asOf, BOULDER_CALIBRATION);
  return { status: "ready", result, source: { asOf: loaded.index.asOf, windowStart: loaded.index.windowStart, sales: loaded.index.rows.length, centroids: loaded.index.centroids, sourceUrl: loaded.sourceUrl, account: account.accountNo } };
}
