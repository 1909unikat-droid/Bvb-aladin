import { NextRequest, NextResponse } from "next/server";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// In-memory cache: tmId → actual photo URL
const photoUrlCache = new Map<string, string>();

async function resolvePhotoUrl(tmId: string): Promise<string | null> {
  if (photoUrlCache.has(tmId)) return photoUrlCache.get(tmId)!;
  try {
    const profileRes = await fetch(
      `https://www.transfermarkt.de/x/profil/spieler/${tmId}`,
      { headers: { "User-Agent": UA, "Accept-Language": "de-DE" } }
    );
    if (!profileRes.ok) return null;
    const html = await profileRes.text();
    const match = html.match(/content="(https:\/\/img\.a\.transfermarkt\.technology\/portrait\/big\/[^"]+)"/);
    if (!match) return null;
    const url = match[1]!;
    photoUrlCache.set(tmId, url);
    return url;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const tmId = request.nextUrl.searchParams.get("id");
  if (!tmId || !/^\d+$/.test(tmId))
    return new NextResponse("Bad Request", { status: 400 });

  try {
    const photoUrl = await resolvePhotoUrl(tmId);
    if (!photoUrl) return new NextResponse("Not Found", { status: 404 });

    // ?url=1 → return JSON with the resolved URL (for client-side use)
    if (request.nextUrl.searchParams.get("url") === "1") {
      return NextResponse.json({ url: photoUrl }, {
        headers: { "Cache-Control": "public, max-age=86400" },
      });
    }
    return NextResponse.redirect(photoUrl, {
      status: 302,
      headers: { "Cache-Control": "public, max-age=86400" },
    });
  } catch {
    return new NextResponse("Error", { status: 502 });
  }
}
