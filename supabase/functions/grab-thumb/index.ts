// 레퍼런스 창고 · 링크에서 썸네일 가져오기
// Supabase 대시보드 → Edge Functions → Deploy a new function → Via Editor
// 이름: grab-thumb  →  이 코드 전체 붙여넣기  →  Deploy
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const CRAWLER = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";
const BROWSER = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/\\u0026/g, "&").replace(/&#x27;/g, "'").replace(/&quot;/g, '"');

function metaImage(html: string): string {
  const pats = [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image(?::secure_url)?["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i,
  ];
  for (const p of pats) { const m = html.match(p); if (m) return decode(m[1]); }
  return "";
}

async function getText(url: string, ua: string): Promise<string> {
  try {
    const r = await fetch(url, { headers: { "User-Agent": ua, "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8" }, redirect: "follow" });
    if (!r.ok) return "";
    return await r.text();
  } catch { return ""; }
}

async function findImage(raw: string): Promise<string> {
  const url = raw.trim();
  let u: URL;
  try { u = new URL(url); } catch { return ""; }
  const host = u.hostname.replace(/^www\.|^m\./, "");

  // 유튜브 (일반 영상 · 쇼츠)
  if (host === "youtu.be" || host.endsWith("youtube.com")) {
    let id = "";
    if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
    else if (u.pathname.startsWith("/shorts/")) id = u.pathname.split("/")[2];
    else id = u.searchParams.get("v") || "";
    if (id) {
      for (const size of ["maxresdefault", "hqdefault"]) {
        const img = `https://i.ytimg.com/vi/${id}/${size}.jpg`;
        try { const r = await fetch(img, { method: "HEAD" }); if (r.ok) return img; } catch { /* next */ }
      }
    }
  }

  // 틱톡
  if (host.endsWith("tiktok.com")) {
    try {
      const r = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`);
      if (r.ok) { const d = await r.json(); if (d.thumbnail_url) return d.thumbnail_url; }
    } catch { /* fall through */ }
  }

  // 인스타그램
  if (host.endsWith("instagram.com")) {
    const m = u.pathname.match(/\/(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
    if (m) {
      const code = m[2];
      const page = await getText(`https://www.instagram.com/p/${code}/`, CRAWLER);
      const og = page && metaImage(page);
      if (og) return og;
      const embed = await getText(`https://www.instagram.com/p/${code}/embed/captioned/`, BROWSER);
      const e1 = embed.match(/class="EmbeddedMediaImage"[^>]*src="([^"]+)"/) || embed.match(/<img[^>]+class="[^"]*EmbeddedMediaImage[^"]*"[^>]*src="([^"]+)"/);
      if (e1) return decode(e1[1]);
      const e2 = embed.match(/"display_url"\s*:\s*"([^"]+)"/) || embed.match(/"thumbnail_src"\s*:\s*"([^"]+)"/);
      if (e2) return decode(e2[1].replace(/\\\//g, "/"));
    }
  }

  // 그 밖의 사이트: 링크 미리보기 이미지
  for (const ua of [CRAWLER, BROWSER]) {
    const html = await getText(url, ua);
    const img = html && metaImage(html);
    if (img) return new URL(img, url).toString();
  }
  return "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { url } = await req.json();
    if (!url) return json({ error: "no_url" }, 400);

    const key = req.headers.get("apikey") || Deno.env.get("SUPABASE_ANON_KEY") || "";
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, key, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
      auth: { persistSession: false },
    });
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return json({ error: "login_required" }, 401);

    const imgUrl = await findImage(url);
    if (!imgUrl) return json({ error: "not_found" });

    const r = await fetch(imgUrl, { headers: { "User-Agent": BROWSER, "Referer": url } });
    if (!r.ok) return json({ error: "image_fetch_failed", status: r.status });
    const type = r.headers.get("content-type") || "image/jpeg";
    if (!type.startsWith("image/")) return json({ error: "not_image" });
    const bytes = new Uint8Array(await r.arrayBuffer());
    const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await sb.storage.from("ref-images").upload(path, bytes, { contentType: type });
    if (error) return json({ error: "upload_failed", detail: error.message });
    return json({ path });
  } catch (e) {
    return json({ error: "server_error", detail: String(e) }, 500);
  }
});
