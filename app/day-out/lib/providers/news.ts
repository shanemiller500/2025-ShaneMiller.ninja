import { DOMParser } from "linkedom";
import type { Notice, Provider } from "../types";
import { publicUrl, text } from "../normalize";
import { fetchSource } from "./http";

export const NEWS_SOURCE = { name: "Queensland Parks", url: "https://parks.qld.gov.au/park-alerts" };
export function normalizeParkFeed(xml: string, fetchedAt: string, region: string): Notice[] {
  const document = new DOMParser().parseFromString(xml, "text/xml");
  if (!document.querySelector("rss, feed")) throw new Error("Invalid park feed");
  return Array.from(document.querySelectorAll("item")).flatMap(item => {
    const title = text(item.querySelector("title")?.textContent, 180);
    const url = publicUrl(item.querySelector("link")?.textContent);
    const published = Date.parse(item.querySelector("pubDate")?.textContent || "");
    if (!title || !url || !new URL(url).hostname.endsWith("parks.qld.gov.au") || !Number.isFinite(published)) return [];
    const description = text(item.querySelector("description")?.textContent, 650);
    return [{ id: url, title, description, kind: "park" as const, severity: "warning" as const,
      areas: [region], source: { ...NEWS_SOURCE, url, fetchedAt, updatedAt: new Date(published).toISOString() } }];
  });
}
export async function getNews(): Promise<Provider<Notice[]>> {
  const regions = ["gold-coast", "brisbane", "sunshine-coast"];
  const results = await Promise.allSettled(regions.map(async region => {
    const result = await fetchSource(`https://parks.qld.gov.au/xml/rss/parkalerts-${region}.xml`, 900, "text");
    return { items: normalizeParkFeed(String(result.body), result.fetchedAt, region.replace(/-/g, " ")), fetchedAt: result.fetchedAt };
  }));
  const available = results.flatMap(result => result.status === "fulfilled" ? [result.value] : []);
  if (!available.length) throw new Error("Park notices unavailable");
  return { status: "available", data: Array.from(new Map(available.flatMap(result => result.items).map(item => [item.id, item])).values()),
    source: { ...NEWS_SOURCE, fetchedAt: available.map(result => result.fetchedAt).sort()[0] },
    note: `${available.length < regions.length ? "Some regional feeds are unavailable. " : ""}Park notices from the current feed. Open Source to check the affected tracks and applicable dates.` };
}
