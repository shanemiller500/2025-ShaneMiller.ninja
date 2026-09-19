import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 86_400;

const REST_COUNTRIES_URL = "https://restcountries.com/v3.1";
const FALLBACK_COUNTRIES_URL = "https://raw.githubusercontent.com/mledoze/countries/master/countries.json";
const COUNTRY_CODE = /^[A-Z]{3}$/;

type Country = {
  cca2?: string;
  cca3?: string;
  region?: string;
  continents?: string[];
  flags?: { png?: string; svg?: string; alt?: string };
  [key: string]: unknown;
};

function normalizeCountry(country: Country): Country {
  const cca2 = country.cca2?.toLowerCase();
  return {
    ...country,
    continents: country.continents?.length ? country.continents : country.region ? [country.region] : [],
    flags: country.flags?.png
      ? country.flags
      : cca2
        ? { png: `https://flagcdn.com/w160/${cca2}.png`, svg: `https://flagcdn.com/${cca2}.svg` }
        : undefined,
  };
}

async function fetchCountries(url: string): Promise<Country[]> {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Upstream returned ${response.status}.`);
  const data: unknown = await response.json();
  if (!Array.isArray(data)) throw new Error("Unexpected country response.");
  return data.map((country) => normalizeCountry(country as Country));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code")?.trim().toUpperCase();

  if (searchParams.size > (code ? 1 : 0) || (code !== undefined && !COUNTRY_CODE.test(code))) {
    return NextResponse.json({ error: "Invalid country request." }, { status: 400 });
  }

  const upstream = code
    ? `${REST_COUNTRIES_URL}/alpha/${encodeURIComponent(code)}`
    : `${REST_COUNTRIES_URL}/all?fields=name,flags,cca3,continents`;

  try {
    let data: Country[];
    try {
      data = await fetchCountries(upstream);
    } catch {
      // Rest Countries occasionally blocks or rate-limits clients. Its open-source data
      // repository is a compatible server-side fallback for both list and detail requests.
      const fallback = await fetchCountries(FALLBACK_COUNTRIES_URL);
      data = code ? fallback.filter((country) => country.cca3 === code) : fallback;
      if (code && data.length === 0) {
        return NextResponse.json({ error: "Country not found." }, { status: 404, headers: { "Cache-Control": "no-store" } });
      }
    }
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400" },
    });
  } catch {
    return NextResponse.json(
      { error: "Country data is temporarily unavailable." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
