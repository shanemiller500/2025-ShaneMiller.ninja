/** Only official image endpoints used by Earth Alive may be fetched by the proxy. */
export function atlasImageSource(raw: string): URL | null {
  try {
    const url = new URL(raw, "https://volcano.si.edu");
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.protocol = "https:";
    url.hash = "";

    const smithsonian = ["volcano.si.edu", "www.volcano.si.edu"].includes(url.hostname) && /^\/gallery\/photos\/[A-Za-z0-9_-]+\.(?:jpe?g|png|webp)$/i.test(url.pathname);
    const usgs = url.hostname === "earthquake.usgs.gov" && /^\/product\/shakemap\/[^?#]+\/download\/(?:intensity\.jpg|mmi_legend\.png)$/i.test(url.pathname);
    if (!smithsonian && !usgs) return null;
    return url;
  } catch {
    return null;
  }
}

export function atlasImagePath(raw: string): string | null {
  const source = atlasImageSource(raw);
  return source ? `/api/atlas/image?src=${encodeURIComponent(source.href)}` : null;
}

export function atlasImageSourcePage(raw: string): string | null {
  const source = atlasImageSource(raw);
  if (!source) return null;
  if (source.hostname.endsWith("volcano.si.edu")) {
    const photo = source.pathname.split("/").pop()?.replace(/\.[^.]+$/, "");
    return `${source.origin}/gallery/ShowImage.cfm?photo=${encodeURIComponent(photo ?? "")}`;
  }
  return `${source.origin}${source.pathname.replace(/\/download\/(?:intensity\.jpg|mmi_legend\.png)$/i, "/products.html")}`;
}
