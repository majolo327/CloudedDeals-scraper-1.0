import asyncio
import os

from dotenv import load_dotenv
from playwright.async_api import async_playwright
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


async def scrape():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        # TODO: implement scraping logic
        await page.goto("https://example.com")
        title = await page.title()
        print(f"Page title: {title}")

        await browser.close()


if __name__ == "__main__":
    asyncio.run(scrape())
