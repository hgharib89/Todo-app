"""Discovery run: save HTML, links and screenshots of candidate offer pages so the collector can be designed."""
import asyncio, json, pathlib, re
from playwright.async_api import async_playwright

OUT = pathlib.Path("probe-out"); OUT.mkdir(exist_ok=True)
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36"
PAGES = {
    "cf_union": "https://clicflyer.com/shoppers/en/oman/dubai/retailers/union-coop-1071",
    "cf_retailers": "https://clicflyer.com/shoppers/en/oman/dubai/retailers",
    "cf_home": "https://clicflyer.com/shoppers/en/oman/dubai/home",
    "wd_dubai": "https://www.wowdeals.me/ae/dubai/go",
    "wd_ae": "https://www.wowdeals.me/ae",
    "shj_promos": "https://www.shjcoop.ae/promotions-current",
}

async def dump(pg, name):
    html = await pg.content()
    (OUT / f"{name}.html").write_text(html)
    links = await pg.eval_on_selector_all("a[href]", "els => els.map(e => [e.href, (e.innerText||'').trim().slice(0,80)])")
    imgs = await pg.eval_on_selector_all("img", "els => els.map(e => [e.currentSrc||e.src, e.alt||'', e.naturalWidth, e.naturalHeight])")
    (OUT / f"{name}.links.json").write_text(json.dumps({"url": pg.url, "links": links, "imgs": imgs}, ensure_ascii=False, indent=1))
    await pg.screenshot(path=str(OUT / f"{name}.png"), full_page=True)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 1280, "height": 900}, locale="en-AE", user_agent=UA)
        for name, url in PAGES.items():
            pg = await ctx.new_page()
            try:
                await pg.goto(url, wait_until="domcontentloaded", timeout=45000)
                await pg.wait_for_timeout(5000)
                for _ in range(6):
                    await pg.mouse.wheel(0, 2500); await pg.wait_for_timeout(700)
                await dump(pg, name)
                print("ok", name, pg.url)
            except Exception as e:
                print("fail", name, str(e)[:200])
            await pg.close()
        # open the first Union Coop flyer
        pg = await ctx.new_page()
        try:
            await pg.goto(PAGES["cf_union"], wait_until="domcontentloaded", timeout=45000)
            await pg.wait_for_timeout(5000)
            hrefs = await pg.eval_on_selector_all("a[href]", "els => els.map(e => e.href)")
            flyer = next((h for h in hrefs if re.search(r"/(flyer|offers?|catalog|leaflet)s?/[^#]*\d", h) and "retailers" not in h), None)
            print("flyer link guess:", flyer)
            if flyer:
                await pg.goto(flyer, wait_until="domcontentloaded", timeout=45000)
                await pg.wait_for_timeout(6000)
                await dump(pg, "cf_flyer")
        except Exception as e:
            print("flyer fail", str(e)[:200])
        await b.close()

asyncio.run(main())
