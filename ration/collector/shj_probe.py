import json, os, re
from playwright.sync_api import sync_playwright
OUT="probe-out"; os.makedirs(OUT, exist_ok=True)
reqs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1280,"height":900})
    def on_resp(r):
        ct=r.headers.get("content-type","")
        if "json" in ct:
            try: body=r.text()
            except Exception: body=""
            reqs.append({"url":r.url,"status":r.status,"len":len(body),"sample":body[:1500]})
    pg.on("response",on_resp)
    pg.goto("https://www.sharjahcoop.ae/",timeout=60000,wait_until="domcontentloaded"); pg.wait_for_timeout(6000)
    html=pg.content()
    i=html.find("44% DISCOUNT")
    open(f"{OUT}/card.html","w").write(html[max(0,i-4000):i+4000])
    links=sorted(set(re.findall(r'href="(/[^"#?]{3,80})"',html)))
    open(f"{OUT}/links.txt","w").write("\n".join(links))
    for u in ["https://www.sharjahcoop.ae/offers","https://www.sharjahcoop.ae/search?q=milk","https://www.sharjahcoop.ae/en/search?q=milk"]:
        try:
            r=pg.goto(u,timeout=45000,wait_until="domcontentloaded"); pg.wait_for_timeout(4000)
            open(f"{OUT}/{re.sub(r'[^a-z]','_',u[28:])}.txt","w").write(f"{r.status} {pg.url}\n"+pg.inner_text("body")[:6000])
        except Exception as e: open(f"{OUT}/err.txt","a").write(u+" "+str(e)[:200]+"\n")
    b.close()
json.dump(reqs,open(f"{OUT}/json_reqs.json","w"),indent=1)
