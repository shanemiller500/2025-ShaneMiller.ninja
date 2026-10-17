import { NextResponse } from "next/server";
import { atlasImageSource, atlasImageSourcePage } from "@/utils/geo/atlasImage";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("src");
  let source = raw && atlasImageSource(raw);
  if (!source) return NextResponse.json({ error: "Unsupported image source" }, { status: 400 });

  try {
    let response: Response | null = null;
    for (let hop = 0; hop < 3; hop++) {
      response = await fetch(source, {
        headers: {
          Accept: "image/avif,image/webp,image/png,image/jpeg,image/gif",
          Referer: atlasImageSourcePage(source.href) ?? `${source.origin}/`,
        },
        redirect: "manual",
        signal: AbortSignal.timeout(15_000),
        next: { revalidate: 86_400 },
      });
      if (response.status < 300 || response.status >= 400) break;
      const location = response.headers.get("location");
      source = location && atlasImageSource(new URL(location, source).href);
      if (!source) throw new Error("Image source redirected elsewhere");
    }
    if (!response) throw new Error("Image source unavailable");
    if (!response.ok) throw new Error(`Image source returned ${response.status}`);

    const type = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
    const declaredSize = Number(response.headers.get("content-length"));
    if (!type || !IMAGE_TYPES.has(type) || (declaredSize > MAX_BYTES && Number.isFinite(declaredSize))) {
      throw new Error("Image source returned an unsupported file");
    }

    const bytes = await response.arrayBuffer();
    if (!bytes.byteLength || bytes.byteLength > MAX_BYTES) throw new Error("Image source returned an invalid file");
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Image unavailable" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
