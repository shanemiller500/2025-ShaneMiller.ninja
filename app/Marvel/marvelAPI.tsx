"use client";

import CryptoJS from "crypto-js";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const PUBLIC_KEY = process.env.NEXT_PUBLIC_MARVEL_PUBLIC_KEY || "";
const PRIVATE_KEY = process.env.NEXT_PUBLIC_MARVEL_PRIVATE_KEY || "";
const BASE_URL = "https://gateway.marvel.com/v1/public";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
const getTimestamp = (): string => Date.now().toString();

const getHash = (ts: string): string =>
  CryptoJS.MD5(ts + PRIVATE_KEY + PUBLIC_KEY).toString();

/* ------------------------------------------------------------------ */
/*  API Functions                                                      */
/* ------------------------------------------------------------------ */
export async function fetchFromMarvel(
  endpoint: string,
  queryParams: Record<string, string> = {}
): Promise<any> {
  if (!PUBLIC_KEY || !PRIVATE_KEY) {
    console.error("Marvel API keys are missing.");
    return null;
  }

  const ts = getTimestamp();
  const hash = getHash(ts);

  const params = new URLSearchParams({
    ts,
    apikey: PUBLIC_KEY,
    hash,
    ...queryParams, // No manual encoding
  });

  const url = `${BASE_URL}/${endpoint}?${params.toString()}`;
  

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const errorResponse = await response.text();
      console.error(`Marvel API error: ${response.status}`, errorResponse);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`Error fetching ${endpoint}:`, error);
    return null;
  }
}

export function searchMarvelCharacters(nameStartsWith = ""): Promise<any> {
  return fetchFromMarvel("characters", { nameStartsWith });
}

export function searchMarvelComics(titleStartsWith = ""): Promise<any> {
  return fetchFromMarvel("comics", { titleStartsWith });
}

export function searchMarvelEvents(nameStartsWith = ""): Promise<any> {
  return fetchFromMarvel("events", { nameStartsWith });
}

export function searchMarvelSeries(titleStartsWith = ""): Promise<any> {
  return fetchFromMarvel("series", { titleStartsWith });
}

export function searchMarvelCreators(firstNameStartsWith = ""): Promise<any> {
  return fetchFromMarvel("creators", { firstNameStartsWith });
}

export function searchMarvelStories(titleStartsWith = ""): Promise<any> {
  return fetchFromMarvel("stories", { titleStartsWith });
}
