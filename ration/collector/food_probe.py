import json, re, os, sys
from playwright.sync_api import sync_playwright
OUT = "probe-out"; os.makedirs(OUT, exist_ok=True)
URLS = {
 "deliveroo_area": "https://deliveroo.ae/en/restaurants/dubai/al-barsha?collection=all-restaurants",
 "deliveroo_menu": "https://deliveroo.ae/en/menu/Dubai/al-barsha-2/noor-al-mandi-al-barsha",
 "deliveroo_mcd": "https://deliveroo.ae/en/restaurants/dubai/al-barsha?query=mcdonalds",
 "talabat_area": "https://www.talabat.com/uae/restaurants/1308/al-barsha-1",
 "talabat_mcd": "https://www.talabat.com/uae/mcdonalds",
 "talabat_search": "https://www.talabat.com/uae/restaurants?search=mcdonalds",
}
rep = {}
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(locale="en-US", user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1", viewport={"width":390,"height":844})
    for k, u in URLS.items():
        pg = ctx.new_page(); r = {}
        try:
            resp = pg.goto(u, timeout=45000, wait_until="domcontentloaded"); pg.wait_for_timeout(5000)
            html = pg.content(); r["status"] = resp.status if resp else None; r["final"] = pg.url; r["len"] = len(html)
            m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.S)
            r["next_data"] = len(m.group(1)) if m else 0
            if m: open(f"{OUT}/{k}.next.json","w").write(m.group(1))
            r["aed_hits"] = len(re.findall(r"AED\s?\d", html))
            r["title"] = pg.title()
            open(f"{OUT}/{k}.txt","w").write(pg.inner_text("body")[:20000])
            pg.screenshot(path=f"{OUT}/{k}.jpg", type="jpeg", quality=60)
        except Exception as e:
            r["error"] = str(e)[:300]
        rep[k] = r; pg.close(); print(k, r, flush=True)
    b.close()
json.dump(rep, open(f"{OUT}/report.json","w"), indent=1)
