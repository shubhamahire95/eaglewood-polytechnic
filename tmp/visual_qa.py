import asyncio
import os
from playwright.async_api import async_playwright

BASE = r"D:\shubh\coding\frelancing\work\eaglewood-polytechnic"
OUT = os.path.join(BASE, "tmp", "siteqa")
os.makedirs(OUT, exist_ok=True)
PAGES = ["index.html", "about.html", "courses.html", "departments.html", "infrastructure.html", "gallery.html", "admission.html", "contact.html"]


async def main():
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch()
        desktop = await browser.new_page(viewport={"width": 1440, "height": 1000}, device_scale_factor=1)
        errors = []
        desktop.on("console", lambda msg: errors.append(f"console: {msg.text}") if msg.type == "error" else None)
        desktop.on("pageerror", lambda error: errors.append(f"pageerror: {error}"))
        for page_name in PAGES:
            response = await desktop.goto(f"http://127.0.0.1:8001/{page_name}", wait_until="networkidle")
            if not response or not response.ok:
                errors.append(f"{page_name}: HTTP failure")
            await desktop.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            await desktop.wait_for_timeout(300)
            await desktop.evaluate("window.scrollTo(0, 0)")
            await desktop.screenshot(path=os.path.join(OUT, f"desktop-{page_name[:-5]}.jpg"), full_page=True, quality=72)
        mobile = await browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=1)
        await mobile.goto("http://127.0.0.1:8001/index.html", wait_until="networkidle")
        await mobile.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        await mobile.wait_for_timeout(300)
        await mobile.evaluate("window.scrollTo(0, 0)")
        await mobile.screenshot(path=os.path.join(OUT, "mobile-index.jpg"), full_page=True, quality=76)
        await mobile.goto("http://127.0.0.1:8001/admission.html", wait_until="networkidle")
        await mobile.screenshot(path=os.path.join(OUT, "mobile-admission.jpg"), full_page=True, quality=76)
        await browser.close()
        print(f"Rendered {len(PAGES)} desktop pages and 2 mobile pages.")
        print("Errors:", errors)


asyncio.run(main())
