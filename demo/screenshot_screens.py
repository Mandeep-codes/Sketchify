import asyncio, os
from playwright.async_api import async_playwright

SCREENS_DIR = "/home/user/sketch-to-real/demo/screens"
OUT_DIR = "/home/user/sketch-to-real/demo/clips"

SCREENS = ["onboarding", "home", "styles", "challenge", "profile"]

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        for name in SCREENS:
            context = await browser.new_context(
                viewport={"width": 393, "height": 852},
                device_scale_factor=2,
            )
            page = await context.new_page()
            await page.goto(f"file://{SCREENS_DIR}/{name}.html", wait_until="domcontentloaded")
            await page.wait_for_timeout(800)
            await page.screenshot(path=f"{OUT_DIR}/{name}_screen.png", full_page=False)
            print(f"  {name} done")
            await context.close()
        await browser.close()

asyncio.run(main())
print("All screenshots done.")
