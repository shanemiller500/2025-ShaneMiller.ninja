// Boulder County deed and permit date validation. Kept free of server modules so Map Inspection can show the same labels.

export type RecordDateIssue = "placeholder" | "before_county" | "after_source" | "unparseable";

export const RECORD_DATE_ISSUES: Record<RecordDateIssue, string> = {
  placeholder: "Date not recorded (county placeholder 12/30/1899)",
  before_county: "Date precedes Boulder County records; not shown",
  after_source: "Date is after the county data date; not shown",
  unparseable: "Date could not be read",
};
// Boulder County was created on 1861-11-01; the county's 1899-12-30 value is the spreadsheet "day zero" used for a missing date.
const COUNTY_CREATED = "1861-11-01";

/** County record dates arrive as "M/D/YYYY h:mm:ss AM" (or ISO). Older real records are kept; impossible ones are withheld. */
export function boulderRecordDate(raw: string, sourceDate: string): { date: string; dateIssue?: RecordDateIssue } {
  const text = String(raw ?? "").trim();
  if (!text) return { date: "" };
  const us = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\b/), iso = text.match(/^(\d{4})-(\d{2})-(\d{2})\b/);
  const [y, m, d] = us ? [+us[3], +us[1], +us[2]] : iso ? [+iso[1], +iso[2], +iso[3]] : [0, 0, 0];
  const parsed = new Date(Date.UTC(y, m - 1, d));
  if (!y || parsed.getUTCMonth() !== m - 1 || parsed.getUTCDate() !== d) return { date: "", dateIssue: "unparseable" };
  const date = parsed.toISOString().slice(0, 10);
  if (date === "1899-12-30") return { date: "", dateIssue: "placeholder" };
  if (date < COUNTY_CREATED) return { date: "", dateIssue: "before_county" };
  if (date > sourceDay(sourceDate)) return { date: "", dateIssue: "after_source" };
  return { date };
}

/** The county file's own date ("10/25/2026 4:00:39 AM"), or today when the manifest does not carry one. */
function sourceDay(sourceDate: string) {
  const match = sourceDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return match ? `${match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}` : new Date().toISOString().slice(0, 10);
}
