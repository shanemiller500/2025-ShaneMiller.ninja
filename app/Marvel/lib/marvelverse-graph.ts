import type { Bio } from "./bio";
import { clean, type Hero } from "./roster";
import { relationName } from "./relations";

export type RelationshipKind = "parent" | "child" | "sibling" | "partner" | "extended" | "alternate" | "origin" | "team";
export type EvidenceLevel = "explicit" | "inferred";

export interface CharacterNode {
  id: number;
  hero: Hero;
  clusterId: string;
}

export interface RelationshipEdge {
  id: string;
  from: number;
  to: number;
  kind: RelationshipKind;
  evidence: EvidenceLevel;
  /** Exact source wording, or the shared team name for inferred links. */
  detail: string;
  /** A display/layout score based on evidence, never a canon claim. */
  strength: number;
  sourceUrl?: string;
}

export interface EventNode {
  id: string;
  title: string;
  description: string;
  characterIds: number[];
  kind: "first-appearance" | "history-chapter";
  /** Publication year only. History chapters are undated and source ordered. */
  publicationYear?: number;
  order?: number;
  sourceUrl?: string;
  image?: string;
}

export interface UniverseCluster {
  id: string;
  name: string;
  characterIds: number[];
}

export interface UniverseGraph {
  characters: CharacterNode[];
  relationships: RelationshipEdge[];
  events: EventNode[];
  clusters: UniverseCluster[];
}

const key = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
const uncertain = /\b(?:alleged|possible|unconfirmed|rumored|rumoured|suspected|unknown)\b/i;

/** Ignore role notes; keep source names exact so an alias cannot create a false relative. */
export function splitSourceList(value: string): string[] {
  const result: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of clean(value)) {
    if (char === "(") depth++;
    if (char === ")") depth = Math.max(0, depth - 1);
    if ((char === ";" || char === "\n" || char === ",") && depth === 0) {
      if (current.trim()) result.push(current.trim());
      current = "";
    } else current += char;
  }
  if (current.trim()) result.push(current.trim());
  return result;
}

export function teamNames(value: string): string[] {
  return splitSourceList(value)
    .map((item) => item.replace(/^(?:formerly|former)\s*:?(?:\s+(?:a\s+)?member of)?\s*/i, "").replace(/^(?:member|leader|founder) of (?:the )?/i, "").replace(/^the\s+/i, "").replace(/\s*\([^)]*\)\s*/g, " ").trim())
    .filter((item) => item.length > 3 && item.length < 48 && !/^(none|unknown|various|formerly)$/i.test(item) && !/\b(?:partner|ally|enemy|lover|friend|relative) of\b/i.test(item));
}

function relationKind(group: string, raw: string): RelationshipKind | null {
  // An Earth identifier alone does not prove a cross-universe relationship.
  if (/alternate[ -](?:universe|reality)|multiverse/i.test(raw)) return "alternate";
  const role = `${group} ${raw.match(/\(([^)]*)\)/)?.[1] ?? ""}`;
  if (/genetic template|(?:fellow )?clone|bit by same spider|\bcreator\b/i.test(role)) return "origin";
  if (/parent|grandparent|father|mother/i.test(role)) return "parent";
  if (/children|child|son|daughter/i.test(role)) return "child";
  if (/sibling|brother|sister/i.test(role)) return "sibling";
  if (/spouse|wife|husband|married|fianc|romantic|lover/i.test(role)) return "partner";
  if (/\bpartner\b/i.test(role)) return null;
  return "extended";
}

function uniqueNames(heroes: Hero[]) {
  const found = new Map<string, Hero>();
  const ambiguous = new Set<string>();
  for (const hero of heroes) {
    for (const label of [hero.name, clean(hero.biography.fullName)]) {
      const id = key(label);
      if (!id || ambiguous.has(id)) continue;
      if (found.has(id) && found.get(id)?.id !== hero.id) { found.delete(id); ambiguous.add(id); }
      else found.set(id, hero);
    }
  }
  return found;
}

function appearanceYear(value: string): number | undefined {
  const matches = clean(value).match(/\b(?:19|20)\d{2}\b/g);
  if (!matches) return undefined;
  const year = Number(matches[0]);
  return year >= 1939 && year <= new Date().getFullYear() ? year : undefined;
}

/** Normalize only data the app actually has. No enemy/mentor/event coappearance guesses. */
export function buildUniverseGraph(heroes: Hero[], bios: ReadonlyMap<number, Bio> = new Map()): UniverseGraph {
  const names = uniqueNames(heroes);
  const groupMembers = new Map<string, { label: string; ids: Set<number> }>();
  for (const hero of heroes) {
    for (const label of teamNames(hero.connections.groupAffiliation)) {
      const id = key(label);
      if (names.has(id)) continue;
      if (!groupMembers.has(id)) groupMembers.set(id, { label, ids: new Set() });
      groupMembers.get(id)!.ids.add(hero.id);
    }
  }
  const clusters = Array.from(groupMembers.entries())
    .filter(([, group]) => group.ids.size >= 3)
    .sort((a, b) => b[1].ids.size - a[1].ids.size)
    .slice(0, 9)
    .map(([id, group]) => ({ id, name: group.label, characterIds: Array.from(group.ids) }));
  const clustersById = new Map<number, string>();
  for (const cluster of clusters) for (const id of cluster.characterIds) if (!clustersById.has(id)) clustersById.set(id, cluster.id);
  const characters = heroes.map((hero) => ({ id: hero.id, hero, clusterId: clustersById.get(hero.id) ?? "other" }));
  const relationships: RelationshipEdge[] = [];
  const seen = new Set<string>();
  const add = (edge: RelationshipEdge) => {
    if (edge.from === edge.to || seen.has(edge.id)) return;
    seen.add(edge.id);
    relationships.push(edge);
  };

  // Named relatives are direct source assertions. Preserve uncertainty in the source label.
  for (const hero of heroes) {
    const bio = bios.get(hero.id);
    const fields = [
      ...splitSourceList(hero.connections.relatives).map((raw) => ({ group: "Relatives", raw, url: undefined as string | undefined })),
      ...(bio?.family ?? []).filter((field) => field.label !== "Affiliation" && field.label !== "Pets").flatMap((field) => field.items.map((raw) => ({ group: field.label, raw, url: bio?.pageUrl }))),
    ];
    for (const { group, raw, url } of fields) {
      if (uncertain.test(raw)) continue;
      const target = names.get(key(relationName(raw)));
      if (!target || target.id === hero.id) continue;
      const kind = relationKind(group, raw);
      if (!kind) continue;
      const pair = [hero.id, target.id].sort((a, b) => a - b);
      add({ id: `relation:${pair.join(":")}:${kind}`, from: hero.id, to: target.id, kind, evidence: "explicit", detail: raw, strength: kind === "origin" ? 72 : kind === "extended" ? 86 : 96, sourceUrl: url });
    }
  }

  // A shared affiliation is an inferred connection; it does not assert that two people met.
  for (const [groupId, group] of Array.from(groupMembers.entries())) {
    const ids = Array.from(group.ids).sort((a, b) => a - b);
    if (ids.length < 2 || ids.length > 60) continue;
    for (let i = 1; i < ids.length; i++) {
      const from = ids[Math.max(0, i - 1)];
      const to = ids[i];
      add({ id: `team:${groupId}:${from}:${to}`, from, to, kind: "team", evidence: "inferred", detail: group.label, strength: 46 });
    }
  }

  const events: EventNode[] = [];
  for (const hero of heroes) {
    const bio = bios.get(hero.id);
    const first = bio?.facts.find((fact) => fact.label === "First appearance")?.value || clean(hero.biography.firstAppearance);
    if (first) events.push({ id: `appearance:${hero.id}`, title: `${hero.name} first appearance`, description: first, characterIds: [hero.id], kind: "first-appearance", publicationYear: appearanceYear(first), sourceUrl: bio?.pageUrl, image: hero.images.sm });
    bio?.history.forEach((chapter, order) => events.push({ id: `chapter:${hero.id}:${order}`, title: chapter.title, description: chapter.text, characterIds: [hero.id], kind: "history-chapter", order, sourceUrl: bio.pageUrl, image: hero.images.md }));
  }
  return { characters, relationships, events, clusters };
}
