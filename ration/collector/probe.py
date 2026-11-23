"""Probe candidate offer sources from a GitHub runner: does each page load, how much text, and a screenshot."""
import asyncio, json, pathlib
from playwright.async_api import async_playwright

SOURCES = {
    "wowdeals_home": "https://wowdeals.me/",
    "wowdeals_carrefour": "https://wowdeals.me/blog/carrefour-weekend-deals-uae-april-10-12-2026-7384",
    "clicflyer_union_uae": "https://clicflyer.com/shoppers/en/uae/dubai/retailers/union-coop-1071",
    "clicflyer_union_oman_path": "https://clicflyer.com/shoppers/en/oman/dubai/retailers/union-coop-1071",
    "carrefour_home": "https://www.carrefouruae.com/mafuae/en/",
    "lulu_home": "https://gcc.luluhypermarket.com/en-ae/",
    "sharjah_coop": "https://www.shjcoop.ae/",
    "union_coop": "https://www.unioncoop.ae/",
    "lulu_calameo": "https://www.calameo.com/lulu",
}
OUT = pathlib.Path("probe-out"); OUT.mkdir(exist_ok=True)

async def main():
    report = {}
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 1280, "height": 900}, locale="en-AE",
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36")
        for name, url in SOURCES.items():
            pg = await ctx.new_page()
            r = {"url": url}
            try:
                resp = await pg.goto(url, wait_until="domcontentloaded", timeout=45000)
                r["status"] = resp.status if resp else None
                await pg.wait_for_timeout(6000)
                r["final_url"] = pg.url
                r["title"] = await pg.title()
                txt = await pg.inner_text("body")
                r["text_len"] = len(txt)
                r["text_sample"] = " ".join(txt.split())[:600]
                links = await pg.eval_on_selector_all("a[href]", "els => els.map(e => e.href)")
                r["offer_links"] = [l for l in dict.fromkeys(links) if any(k in l.lower() for k in ("offer", "deal", "promo", "flyer", "leaflet", "catalog", "عروض"))][:40]
                await pg.screenshot(path=str(OUT / f"{name}.png"), full_page=False)
            except Exception as e:
                r["error"] = str(e)[:300]
            report[name] = r
            await pg.close()
        await b.close()
    (OUT / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
    for k, v in report.items():
        print(k, v.get("status"), v.get("text_len"), v.get("error", "")[:80])

asyncio.run(main())
