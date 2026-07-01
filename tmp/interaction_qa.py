import asyncio
from playwright.async_api import async_playwright


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 390, "height": 844})
        await page.goto("http://127.0.0.1:8001/index.html", wait_until="networkidle")
        assert await page.locator(".nav-links a.active").get_attribute("href") == "index.html"
        await page.locator(".nav-toggle").click()
        assert await page.locator(".nav-links").evaluate("el => el.classList.contains('open')")
        assert await page.locator(".hero-slide").count() == 4
        await page.goto("http://127.0.0.1:8001/gallery.html", wait_until="networkidle")
        await page.locator('[data-gallery-filter="hostel"]').click()
        assert await page.locator('.gallery-item:not([hidden])').count() >= 2
        await page.locator('.gallery-item:not([hidden])').first.click()
        assert await page.locator(".lightbox.open").count() == 1
        await page.keyboard.press("Escape")
        assert await page.locator(".lightbox.open").count() == 0
        await page.goto("http://127.0.0.1:8001/contact.html", wait_until="domcontentloaded")
        assert await page.locator(".map-embed iframe").count() == 1
        assert await page.locator('a[href^="tel:"]').count() >= 5
        assert await page.locator('a[href^="mailto:"]').count() >= 2
        await browser.close()
        print("Interaction QA passed: navigation, slider, filters, lightbox, map and contact links.")


asyncio.run(main())
