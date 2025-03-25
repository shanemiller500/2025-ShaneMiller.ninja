"use client";

import CryptoJS from "crypto-js";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_MARVEL_PUBLIC_KEY || "";
const PRIVATE_KEY = process.env.NEXT_PUBLIC_MARVEL_PRIVATE_KEY || "";
const BASE_URL = "https://gateway.marvel.com/v1/public";

const getTimestamp = (): number => new Date().getTime();

const getHash = (timestamp: number): string =>
  CryptoJS.MD5(timestamp + PRIVATE_KEY + PUBLIC_KEY).toString();

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
  let url = `${BASE_URL}/${endpoint}?ts=${ts}&apikey=${PUBLIC_KEY}&hash=${hash}`;

  Object.keys(queryParams).forEach((key) => {
    if (queryParams[key]) {
      url += `&${key}=${encodeURIComponent(queryParams[key])}`;
    }
  });

  try {
    const response = await fetch(url);
    const data = await response.json();
    return data;
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
