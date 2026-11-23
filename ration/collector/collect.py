"""Wafrly offers agent: collects current supermarket flyers and turns them into offers in Supabase.

Runs on GitHub Actions (see .github/workflows/wafrly-collect.yml). For each store:
  1. open the store's ClicFlyer page and find its current flyers and their end dates
  2. skip flyers already read (offers tagged source = "auto:cf<flyer id>")
  3. download each flyer page image and ask Claude to read the products and prices
  4. save the offers to Supabase; delete auto offers that expired or whose flyer is gone

Env: ANTHROPIC_API_KEY, SUPABASE_SERVICE_KEY (secrets); optional DRY_RUN=1, STORES=slug,slug,
MAX_PAGES (per flyer), MAX_FLYERS (per store), CONCURRENCY.
"""
from __future__ import annotations

import base64
import concurrent.futures as cf
import datetime as dt
import io
import json
import os
import pathlib
import re
import sys
import time

import requests
from PIL import Image

SUPABASE_URL = "https://xhitpiewnqjiljnhyvit.supabase.co"
CLICFLYER = "https://clicflyer.com/shoppers/en/oman/dubai"
MODEL = os.environ.get("CLAUDE_MODEL", "claude-sonnet-5-5")
DRY_RUN = os.environ.get("DRY_RUN") == "1"
MAX_PAGES = int(os.environ.get("MAX_PAGES", "40"))
MAX_FLYERS = int(os.environ.get("MAX_FLYERS", "1"))
CONCURRENCY = int(os.environ.get("CONCURRENCY", "4"))
OUT = pathlib.Path(os.environ.get("OUT_DIR", "collect-out"))
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36"

# ClicFlyer retailer slug -> store name shown in the app (keep in sync with STORE_EN in index.html)
STORES = {
    "union-coop-1071": "تعاونية الاتحاد",
    "carrefour-hyper-1049": "كارفور",
    "lulu-1047": "لولو هايبرماركت",
    "nesto-1100": "نستو",
    "choithrams-1046": "تشويترامز",
    "emirates-co-op-1056": "جمعية الإمارات التعاونية",
    "grandiose-supermarket-1354": "جرانديوز",
    "adcoop-1059": "تعاونية أبوظبي",
}

PROMPT = """This is one page of a UAE supermarket promotional flyer. Extract every product that has a clear price.
Return JSON only:
{"offers":[{"name":"product name as printed (Arabic and/or English)","brand":"brand or null","size":"e.g. 2L, 1kg, 1L x 4, 30 pcs, or null","price":12.95,"original_price":15.5}]}
Rules:
- price = the promotional price the customer pays, in AED, as a number. A price printed as 12^95 or 12.95 is 12.95.
- original_price = the crossed-out price before discount, or null.
- Skip banners, logos, and anything without a clear price. Never invent products or prices.
- If the page has no priced products, return {"offers":[]}."""

http = requests.Session()
http.headers.update({"User-Agent": UA, "Accept-Language": "en-AE,en;q=0.9"})


def log(*a):
    print(*a, flush=True)


# ---------- ClicFlyer ----------
_browser = None


def get_html(url: str) -> str:
    """Load a page in a real browser (ClicFlyer fills its flyer lists with JavaScript)."""
    global _browser
    if _browser is None:
        from playwright.sync_api import sync_playwright
        pw = sync_playwright().start()
        _browser = pw.chromium.launch().new_context(viewport={"width": 1280, "height": 900}, locale="en-AE", user_agent=UA)
    pg = _browser.new_page()
    try:
        pg.goto(url, wait_until="domcontentloaded", timeout=60000)
        pg.wait_for_timeout(5000)
        for _ in range(5):
            pg.mouse.wheel(0, 2500)
            pg.wait_for_timeout(600)
        return pg.content()
    finally:
        pg.close()


def parse_date(text: str) -> str | None:
    m = re.search(r"Valid Till\s+([A-Z][a-z]{2})\s+(\d{1,2}),\s+(\d{4})", text)
    if not m:
        return None
    try:
        return dt.datetime.strptime(" ".join(m.groups()), "%b %d %Y").date().isoformat()
    except ValueError:
        return None


def find_flyers(slug: str) -> list[dict]:
    html = get_html(f"{CLICFLYER}/retailers/{slug}")
    if DRY_RUN:
        OUT.mkdir(exist_ok=True)
        (OUT / f"{slug}.html").write_text(html)
    flyers, seen = [], set()
    for m in re.finditer(r'href="(?:https://clicflyer\.com/shoppers/en/[a-z]+/[a-z-]+)?(/flyers/[a-z0-9-]+--(\d+))"', html):
        path, fid = m.group(1), m.group(2)
        if fid in seen:
            continue
        seen.add(fid)
        until = parse_date(html[m.end(): m.end() + 4000])
        flyers.append({"id": fid, "url": f"{CLICFLYER}{path}", "until": until})
    return flyers[:MAX_FLYERS]


def flyer_pages(flyer: dict) -> list[str]:
    html = get_html(flyer["url"])
    if not flyer.get("until"):
        flyer["until"] = parse_date(html)
    urls = re.findall(r"https://cdn\.clicflyer\.net/appimages/flyerpages/\d{4}/[0-9a-f]{32}_compressed\.webp", html)
    return list(dict.fromkeys(urls))[:MAX_PAGES]


# ---------- Claude ----------
def to_jpeg_b64(url: str) -> str:
    r = http.get(url, timeout=60)
    r.raise_for_status()
    im = Image.open(io.BytesIO(r.content)).convert("RGB")
    k = min(1.0, 1600 / max(im.size))
    if k < 1:
        im = im.resize((round(im.width * k), round(im.height * k)))
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=85)
    return base64.b64encode(buf.getvalue()).decode()


def parse_json(text: str) -> dict:
    t = text.strip()
    if t.startswith("```"):
        t = re.sub(r"^```[a-z]*\n?", "", t)
        t = re.sub(r"```\s*$", "", t)
    a, b = t.find("{"), t.rfind("}")
    return json.loads(t[a: b + 1] if a >= 0 and b > a else t)


def read_page(url: str) -> list[dict]:
    img = to_jpeg_b64(url)
    body = {
        "model": MODEL,
        "max_tokens": 6000,
        "messages": [{"role": "user", "content": [
            {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": img}},
            {"type": "text", "text": PROMPT},
        ]}],
    }
    for attempt in range(4):
        r = requests.post("https://api.anthropic.com/v1/messages", timeout=180, json=body, headers={
            "x-api-key": os.environ["ANTHROPIC_API_KEY"], "anthropic-version": "2023-06-01", "content-type": "application/json"})
        if r.status_code in (429, 500, 502, 503, 529):
            time.sleep(10 * (attempt + 1))
            continue
        r.raise_for_status()
        text = "".join(b.get("text", "") for b in r.json().get("content", []) if b.get("type") == "text")
        try:
            return parse_json(text).get("offers", [])
        except Exception:
            log("  could not parse page", url)
            return []
    raise RuntimeError("Claude API kept failing")


def clean(o: dict, store: str, until: str | None, tag: str) -> dict | None:
    try:
        price = round(float(o.get("price")), 2)
    except (TypeError, ValueError):
        return None
    name = str(o.get("name") or "").strip()[:160]
    if not name or not (0 < price < 100000):
        return None
    try:
        old = round(float(o.get("original_price")), 2) if o.get("original_price") is not None else None
    except (TypeError, ValueError):
        old = None
    if old is not None and old <= price:
        old = None
    s = lambda v: (str(v).strip()[:60] or None) if v not in (None, "", "null") else None
    return {"store": store, "name": name, "brand": s(o.get("brand")), "size": s(o.get("size")),
            "price": price, "old_price": old, "until": until, "source": tag}


# ---------- Supabase ----------
def sb(method: str, path: str, **kw):
    key = os.environ["SUPABASE_SERVICE_KEY"]
    headers = {"apikey": key, "Content-Type": "application/json", "Prefer": "return=minimal"}
    if not key.startswith("sb_"):
        headers["Authorization"] = f"Bearer {key}"  # legacy service_role JWT
    r = requests.request(method, f"{SUPABASE_URL}/rest/v1/{path}", headers=headers, timeout=60, **kw)
    if r.status_code >= 300:
        raise RuntimeError(f"Supabase {method} {path}: {r.status_code} {r.text[:300]}")
    return r.json() if r.text and method == "GET" else None


def existing_tags() -> set[str]:
    rows = sb("GET", "offers?select=source&source=like.auto:*")
    return {r["source"] for r in rows or []}


# ---------- main ----------
def main() -> int:
    OUT.mkdir(exist_ok=True)
    today = dt.date.today().isoformat()
    only = [s.strip() for s in os.environ.get("STORES", "").split(",") if s.strip()]
    stores = {k: v for k, v in STORES.items() if not only or k in only}
    summary = {"started": dt.datetime.utcnow().isoformat() + "Z", "dry_run": DRY_RUN, "stores": {}}
    have = set() if DRY_RUN else existing_tags()
    live_tags: set[str] = set()
    failed = 0

    for slug, store in stores.items():
        info = summary["stores"][slug] = {"store": store, "flyers": []}
        try:
            flyers = find_flyers(slug)
        except Exception as e:
            info["error"] = str(e)[:300]; failed += 1; log("!", slug, e); continue
        log(f"{store}: {len(flyers)} flyer(s)")
        for fl in flyers:
            tag = f"auto:cf{fl['id']}"
            rec = {"id": fl["id"], "url": fl["url"], "until": fl["until"]}
            info["flyers"].append(rec)
            if fl["until"] and fl["until"] < today:
                rec["skipped"] = "expired"; continue
            live_tags.add(tag)
            if tag in have:
                rec["skipped"] = "already read"; continue
            try:
                pages = flyer_pages(fl)
                rec["until"] = fl["until"]
            except Exception as e:
                rec["error"] = str(e)[:300]; failed += 1; continue
            rec["pages"] = len(pages)
            offers, page_errors = [], 0
            with cf.ThreadPoolExecutor(CONCURRENCY) as ex:
                for res in ex.map(lambda u: _safe(read_page, u), pages):
                    if res is None:
                        page_errors += 1
                        continue
                    offers += [c for o in res if (c := clean(o, store, fl["until"], tag))]
            # one row per product+size+price
            uniq = {}
            for o in offers:
                uniq.setdefault((o["name"].lower(), (o["size"] or "").lower(), o["price"]), o)
            offers = list(uniq.values())
            rec["offers"], rec["page_errors"] = len(offers), page_errors
            log(f"  flyer {fl['id']} (until {fl['until']}): {len(pages)} pages -> {len(offers)} offers")
            (OUT / f"{tag.replace(':', '_')}.json").write_text(json.dumps(offers, ensure_ascii=False, indent=1))
            if not DRY_RUN and offers:
                for i in range(0, len(offers), 200):
                    sb("POST", "offers", data=json.dumps(offers[i:i + 200]))

    if not DRY_RUN:
        # remove auto offers that expired or whose flyer is no longer listed for a store we checked
        sb("DELETE", f"offers?source=like.auto:*&until=lt.{today}")
        checked_ok = all("error" not in v for v in summary["stores"].values())
        if checked_ok and not only:
            for tag in have - live_tags:
                sb("DELETE", f"offers?source=eq.{tag}")
        summary["removed_flyers"] = sorted(have - live_tags) if checked_ok and not only else []

    summary["finished"] = dt.datetime.utcnow().isoformat() + "Z"
    (OUT / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=1))
    log(json.dumps(summary, ensure_ascii=False, indent=1))
    return 1 if failed and failed == len(stores) else 0


def _safe(fn, *a):
    try:
        return fn(*a)
    except Exception as e:
        log("  page failed:", str(e)[:200])
        return None


if __name__ == "__main__":
    sys.exit(main())
