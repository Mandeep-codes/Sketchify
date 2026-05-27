"""
Playwright screen recorder for Sketchify demo.
Records each screen of the app as a video.
"""
import asyncio
import os
from playwright.async_api import async_playwright

BASE_URL = "http://localhost:4300"
OUT_DIR = "/home/user/sketch-to-real/demo/recordings"

# Mobile viewport — iPhone 14 Pro size
VIEWPORT = {"width": 393, "height": 852}

async def record_screen(page, path, duration_ms, actions=None):
    """Start recording, run actions, wait, stop."""
    await page.video  # ensure video context
    if actions:
        await actions(page)
    await page.wait_for_timeout(duration_ms)

async def main():
    async with async_playwright() as p:
        # Each screen recorded separately
        screens = [
            ("onboarding", "/onboarding", 6000),
            ("home", "/", 9000),
            ("challenge", "/challenge-mode", 8000),
            ("profile", "/profile", 7000),
        ]

        for name, path, duration in screens:
            print(f"Recording {name}...")
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                viewport=VIEWPORT,
                device_scale_factor=2,
                record_video_dir=OUT_DIR,
                record_video_size=VIEWPORT,
            )
            page = await context.new_page()
            
            try:
                await page.goto(f"{BASE_URL}{path}", wait_until="networkidle", timeout=15000)
            except Exception as e:
                print(f"  goto error (non-fatal): {e}")
            
            await page.wait_for_timeout(500)

            # Screen-specific interactions
            if name == "onboarding":
                await page.wait_for_timeout(3000)
                # Swipe through slides by clicking
                try:
                    # Click next/swipe area
                    await page.click("body", position={"x": 350, "y": 500})
                    await page.wait_for_timeout(1200)
                    await page.click("body", position={"x": 350, "y": 500})
                    await page.wait_for_timeout(1200)
                except:
                    pass
                await page.wait_for_timeout(1000)

            elif name == "home":
                await page.wait_for_timeout(2000)
                # Slow scroll down
                for i in range(5):
                    await page.evaluate("window.scrollBy(0, 120)")
                    await page.wait_for_timeout(400)
                await page.wait_for_timeout(2000)

            elif name == "challenge":
                await page.wait_for_timeout(2000)
                # Try clicking a timer option
                try:
                    btns = await page.query_selector_all("text=60")
                    if btns:
                        await btns[0].click()
                        await page.wait_for_timeout(800)
                    btns2 = await page.query_selector_all("text=90")
                    if btns2:
                        await btns2[0].click()
                        await page.wait_for_timeout(800)
                except:
                    pass
                await page.wait_for_timeout(3000)

            elif name == "profile":
                await page.wait_for_timeout(2000)
                for i in range(4):
                    await page.evaluate("window.scrollBy(0, 150)")
                    await page.wait_for_timeout(500)
                await page.wait_for_timeout(1500)

            await context.close()
            await browser.close()

            # Rename the recorded file
            import glob, shutil
            files = sorted(glob.glob(f"{OUT_DIR}/*.webm"), key=os.path.getmtime)
            if files:
                dest = f"{OUT_DIR}/{name}.webm"
                shutil.move(files[-1], dest)
                print(f"  Saved: {dest}")
            else:
                print(f"  WARNING: No video file found for {name}")

    print("All recordings done.")

asyncio.run(main())
