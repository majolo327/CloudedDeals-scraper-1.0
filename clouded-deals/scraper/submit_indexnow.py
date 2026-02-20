"""
Submit updated page URLs to search engines via the IndexNow protocol.

IndexNow instantly notifies Bing, Yandex, Naver, Seznam, and other
participating search engines that pages have been updated — so they
re-crawl deal pages within minutes instead of days.

Usage:
    python submit_indexnow.py                  # submit all indexable URLs
    python submit_indexnow.py --region nv      # submit only NV dispensary pages

Requires no secrets — the IndexNow key is embedded (it's public by design;
the matching key file lives at https://cloudeddeals.com/<key>.txt).
"""

import argparse
import json
import sys
import time
import urllib.request
import urllib.error

SITE_URL = "https://cloudeddeals.com"
INDEXNOW_KEY = "e6a1c4ba0e09a91c4626bb03d09237b9"
INDEXNOW_ENDPOINT = "https://api.indexnow.org/IndexNow"

# Categories that have dedicated pages
CATEGORIES = ["flower", "vapes", "edibles", "concentrates", "prerolls"]

# Scraped dispensary slugs (Southern NV) — these have live deal pages
DISPENSARY_SLUGS = [
    # Dutchie
    "td-gibson", "td-decatur", "planet13", "medizin",
    "greenlight-downtown", "greenlight-paradise", "the-grove",
    "mint-paradise", "mint-rainbow",
    # Curaleaf
    "curaleaf-western", "curaleaf-cheyenne", "curaleaf-strip", "curaleaf-the-reef",
    # Jane
    "oasis", "deep-roots-cheyenne", "deep-roots-craig",
    "deep-roots-blue-diamond", "deep-roots-parkson",
    "cultivate-spring", "cultivate-durango",
    "thrive-sahara", "thrive-cheyenne", "thrive-strip", "thrive-main",
    "beyond-hello-sahara", "beyond-hello-twain",
    # Rise (Jane platform)
    "rise-sunset", "rise-tropicana", "rise-rainbow",
    "rise-nellis", "rise-boulder", "rise-durango", "rise-craig",
]


def build_url_list(region: str | None = None) -> list[str]:
    """Build the list of URLs to submit based on region filter."""
    urls = []

    # Always submit high-priority pages
    urls.append(SITE_URL)
    urls.append(f"{SITE_URL}/las-vegas-dispensary-deals")
    urls.append(f"{SITE_URL}/strip-dispensary-deals")

    # Category pages
    for cat in CATEGORIES:
        urls.append(f"{SITE_URL}/deals/{cat}")

    # Dispensary pages — all scraped dispensaries (NV only for now)
    if region is None or region in ("all", "southern-nv", "nv"):
        for slug in DISPENSARY_SLUGS:
            urls.append(f"{SITE_URL}/dispensary/{slug}")

    return urls


def submit_urls(urls: list[str], dry_run: bool = False) -> bool:
    """Submit URLs to IndexNow API. Returns True on success."""
    # IndexNow accepts up to 10,000 URLs per batch
    payload = {
        "host": "cloudeddeals.com",
        "key": INDEXNOW_KEY,
        "keyLocation": f"{SITE_URL}/{INDEXNOW_KEY}.txt",
        "urlList": urls,
    }

    print(f"[IndexNow] Submitting {len(urls)} URLs to search engines...")
    for url in urls:
        print(f"  • {url}")

    if dry_run:
        print("[IndexNow] Dry run — skipping API call")
        return True

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        INDEXNOW_ENDPOINT,
        data=data,
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )

    # Retry with exponential backoff on network errors
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                status = resp.status
                if status in (200, 202):
                    print(f"[IndexNow] Success (HTTP {status}) — URLs queued for crawling")
                    return True
                else:
                    body = resp.read().decode("utf-8", errors="replace")
                    print(f"[IndexNow] Unexpected response HTTP {status}: {body}")
                    return False
        except urllib.error.HTTPError as e:
            # 422 = key validation failed, 429 = rate limited
            body = e.read().decode("utf-8", errors="replace") if e.fp else ""
            print(f"[IndexNow] HTTP {e.code}: {body}")
            if e.code == 429 and attempt < 3:
                wait = 2 ** (attempt + 1)
                print(f"[IndexNow] Rate limited, retrying in {wait}s...")
                time.sleep(wait)
                continue
            return False
        except (urllib.error.URLError, OSError) as e:
            if attempt < 3:
                wait = 2 ** (attempt + 1)
                print(f"[IndexNow] Network error: {e} — retrying in {wait}s...")
                time.sleep(wait)
            else:
                print(f"[IndexNow] Failed after 4 attempts: {e}")
                return False

    return False


def main():
    parser = argparse.ArgumentParser(description="Submit URLs to IndexNow for faster search engine crawling")
    parser.add_argument("--region", default=None, help="Region filter (e.g. southern-nv, nv, all)")
    parser.add_argument("--dry-run", action="store_true", help="Print URLs without submitting")
    args = parser.parse_args()

    urls = build_url_list(region=args.region)

    if not urls:
        print("[IndexNow] No URLs to submit")
        return

    success = submit_urls(urls, dry_run=args.dry_run)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
