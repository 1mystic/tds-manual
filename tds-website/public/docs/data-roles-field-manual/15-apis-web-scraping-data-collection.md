<a name="section-15"></a>
# SECTION 15 — APIs, Web Scraping & Data Collection

## 15.1 REST API Integration

```python
import requests
import pandas as pd
import time
from functools import wraps
from typing import Optional

def retry_on_error(max_retries=3, delay=1):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except requests.exceptions.RequestException as e:
                    if attempt == max_retries - 1:
                        raise
                    wait = delay * (2 ** attempt)  # exponential backoff
                    print(f"Attempt {attempt+1} failed: {e}. Retrying in {wait}s...")
                    time.sleep(wait)
        return wrapper
    return decorator

class APIClient:
    def __init__(self, base_url: str, api_key: str, rate_limit_rpm: int = 60):
        self.base_url = base_url
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        self.min_interval = 60 / rate_limit_rpm
        self._last_request = 0
    
    def _rate_limit(self):
        elapsed = time.time() - self._last_request
        if elapsed < self.min_interval:
            time.sleep(self.min_interval - elapsed)
        self._last_request = time.time()
    
    @retry_on_error(max_retries=3, delay=2)
    def get(self, endpoint: str, params: dict = None) -> dict:
        self._rate_limit()
        r = requests.get(f"{self.base_url}/{endpoint}",
                         headers=self.headers, params=params, timeout=30)
        r.raise_for_status()
        return r.json()
    
    def get_paginated(self, endpoint: str, page_key: str = "page") -> list:
        results = []
        page = 1
        while True:
            data = self.get(endpoint, params={page_key: page, "limit": 100})
            items = data.get("data", data if isinstance(data, list) else [])
            if not items:
                break
            results.extend(items)
            page += 1
        return results

# Example: Fetch from Stripe API
client = APIClient("https://api.stripe.com/v1", api_key="sk_live_...")
charges = client.get_paginated("charges")
df = pd.DataFrame(charges)
```

## 15.2 Web Scraping with BeautifulSoup

```python
# pip install requests beautifulsoup4 lxml
import requests
from bs4 import BeautifulSoup
import pandas as pd
import time

def scrape_table(url: str, table_index: int = 0) -> pd.DataFrame:
    headers = {"User-Agent": "Mozilla/5.0"}
    r = requests.get(url, headers=headers, timeout=15)
    r.raise_for_status()
    soup = BeautifulSoup(r.content, "lxml")
    tables = soup.find_all("table")
    if not tables:
        raise ValueError("No tables found")
    return pd.read_html(str(tables[table_index]))[0]

def scrape_page(url: str) -> dict:
    headers = {"User-Agent": "Mozilla/5.0 (compatible; DataScraper/1.0)"}
    r = requests.get(url, headers=headers, timeout=15)
    r.raise_for_status()
    soup = BeautifulSoup(r.content, "lxml")
    
    return {
        "title": soup.find("h1").text.strip() if soup.find("h1") else None,
        "price": soup.find(class_="price").text.strip() if soup.find(class_="price") else None,
        "description": soup.find("p", class_="description").text if soup.find("p", class_="description") else None,
        "links": [a["href"] for a in soup.find_all("a", href=True)]
    }

# Scrape multiple pages with politeness
urls = ["https://example.com/products/1", "https://example.com/products/2"]
results = []
for url in urls:
    try:
        data = scrape_page(url)
        data["url"] = url
        results.append(data)
        time.sleep(1)  # be polite — don't hammer the server
    except Exception as e:
        print(f"Failed {url}: {e}")

df = pd.DataFrame(results)
```

## 15.3 Selenium for Dynamic Pages

```python
# pip install selenium webdriver-manager
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options

options = Options()
options.add_argument("--headless")   # run without browser window
options.add_argument("--no-sandbox")
options.add_argument("--disable-dev-shm-usage")

driver = webdriver.Chrome(options=options)

try:
    driver.get("https://example.com/login")
    
    # Fill form
    WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.ID, "email"))
    )
    driver.find_element(By.ID, "email").send_keys("user@example.com")
    driver.find_element(By.ID, "password").send_keys("password")
    driver.find_element(By.XPATH, "//button[@type='submit']").click()
    
    # Wait for page load
    WebDriverWait(driver, 10).until(EC.url_contains("dashboard"))
    
    # Extract data
    elements = driver.find_elements(By.CLASS_NAME, "data-row")
    data = [{"text": el.text, "attr": el.get_attribute("data-id")} for el in elements]
    
    df = pd.DataFrame(data)
finally:
    driver.quit()
```

## 15.4 Playwright (Better than Selenium in 2026)

```python
# pip install playwright
# playwright install chromium   ← run once to download browser

from playwright.sync_api import sync_playwright
import pandas as pd

def scrape_with_playwright(url: str) -> list[dict]:
    results = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            viewport={"width": 1280, "height": 800}
        )
        page = context.new_page()

        # Block images/fonts to speed up scraping
        page.route("**/*.{png,jpg,jpeg,gif,svg,woff,woff2}", lambda r: r.abort())

        page.goto(url, wait_until="networkidle", timeout=30000)

        # Wait for specific element
        page.wait_for_selector(".product-card", timeout=10000)

        # Extract data
        cards = page.query_selector_all(".product-card")
        for card in cards:
            results.append({
                "title": card.query_selector("h2").inner_text() if card.query_selector("h2") else None,
                "price": card.query_selector(".price").inner_text() if card.query_selector(".price") else None,
                "rating": card.get_attribute("data-rating"),
                "url": card.query_selector("a").get_attribute("href") if card.query_selector("a") else None
            })

        browser.close()
    return results

# Async Playwright (faster for multiple pages)
import asyncio
from playwright.async_api import async_playwright

async def scrape_many(urls: list[str]) -> list[dict]:
    results = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        # Scrape pages concurrently
        async def scrape_one(url):
            page = await browser.new_page()
            await page.goto(url, wait_until="domcontentloaded")
            title = await page.title()
            await page.close()
            return {"url": url, "title": title}

        tasks = [scrape_one(url) for url in urls]
        results = await asyncio.gather(*tasks)
        await browser.close()
    return results

# Run async
urls = ["https://example.com/page/1", "https://example.com/page/2"]
results = asyncio.run(scrape_many(urls))
df = pd.DataFrame(results)
```

## 15.5 Scrapy (Production-Grade Crawler)

```python
# pip install scrapy
# scrapy startproject myproject
# scrapy genspider products example.com

# myproject/spiders/products_spider.py
import scrapy
import pandas as pd

class ProductSpider(scrapy.Spider):
    name = "products"
    start_urls = ["https://example.com/products"]
    custom_settings = {
        "DOWNLOAD_DELAY": 1,          # 1 second between requests
        "CONCURRENT_REQUESTS": 4,
        "ROBOTSTXT_OBEY": True,        # respect robots.txt
        "FEEDS": {"data/products.jsonl": {"format": "jsonlines"}},  # auto-save
        "USER_AGENT": "MyBot/1.0 (research purposes)"
    }

    def parse(self, response):
        # Extract all product links
        for href in response.css("a.product-link::attr(href)").getall():
            yield response.follow(href, callback=self.parse_product)

        # Follow pagination
        next_page = response.css("a.next-page::attr(href)").get()
        if next_page:
            yield response.follow(next_page, callback=self.parse)

    def parse_product(self, response):
        yield {
            "url": response.url,
            "title": response.css("h1::text").get("").strip(),
            "price": response.css(".price::text").get("").strip(),
            "description": " ".join(response.css(".description p::text").getall()),
            "images": response.css("img.product-image::attr(src)").getall(),
            "breadcrumb": response.css(".breadcrumb a::text").getall()
        }

# Run from CLI:
# scrapy crawl products
# scrapy crawl products -o output.csv
```

## 15.6 httpx — Async Requests (Faster than requests)

```python
# pip install httpx
import httpx
import asyncio
import pandas as pd

# Sync (drop-in requests replacement)
with httpx.Client(timeout=30, follow_redirects=True) as client:
    r = client.get("https://api.example.com/data", headers={"Authorization": "Bearer TOKEN"})
    r.raise_for_status()
    data = r.json()

# Async — fetch many URLs concurrently
async def fetch_all(urls: list[str], headers: dict = None) -> list[dict]:
    async with httpx.AsyncClient(timeout=30, headers=headers or {}) as client:
        tasks = [client.get(url) for url in urls]
        responses = await asyncio.gather(*tasks, return_exceptions=True)
    
    results = []
    for url, resp in zip(urls, responses):
        if isinstance(resp, Exception):
            results.append({"url": url, "error": str(resp), "data": None})
        else:
            results.append({"url": url, "error": None, "data": resp.json()})
    return results

urls = [f"https://api.example.com/users/{i}" for i in range(1, 101)]
results = asyncio.run(fetch_all(urls, headers={"Authorization": "Bearer TOKEN"}))
df = pd.DataFrame([{**r["data"], "url": r["url"]} for r in results if not r["error"]])
```

## 15.7 Handling Anti-Scraping Measures

```python
import requests
import time
import random
from itertools import cycle

# Rotate User-Agents
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/119.0.0.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/118.0.0.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0"
]

def get_headers():
    return {
        "User-Agent": random.choice(USER_AGENTS),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        "DNT": "1",
        "Connection": "keep-alive"
    }

# Use a session (reuses TCP connection, handles cookies)
session = requests.Session()
session.headers.update(get_headers())

# Rotate proxies
PROXIES = [
    "http://user:pass@proxy1.example.com:8080",
    "http://user:pass@proxy2.example.com:8080",
]
proxy_pool = cycle(PROXIES)

def scrape_with_proxy(url: str) -> requests.Response:
    proxy = next(proxy_pool)
    return session.get(url, proxies={"http": proxy, "https": proxy}, timeout=15)

# Random delay between requests (human-like)
def polite_delay(min_sec=1.0, max_sec=3.0):
    time.sleep(random.uniform(min_sec, max_sec))

# Handle cookies and sessions (e.g., login-protected pages)
session = requests.Session()
login_payload = {"username": "user@example.com", "password": "pass"}
session.post("https://example.com/login", data=login_payload)
# Session now has cookies — all subsequent requests are authenticated
r = session.get("https://example.com/dashboard")

# Check robots.txt before scraping
from urllib.robotparser import RobotFileParser
from urllib.parse import urljoin

def is_allowed(url: str, user_agent: str = "*") -> bool:
    from urllib.parse import urlparse
    parsed = urlparse(url)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
    rp = RobotFileParser()
    rp.set_url(robots_url)
    rp.read()
    return rp.can_fetch(user_agent, url)

print(is_allowed("https://example.com/products"))  # True/False
```

## 15.8 Parsing Common Data Formats from Scraping

```python
import pandas as pd
from bs4 import BeautifulSoup
import json
import re

# Extract ALL tables from a page at once
def extract_all_tables(url: str) -> list[pd.DataFrame]:
    r = requests.get(url, headers=get_headers(), timeout=15)
    return pd.read_html(r.content)   # returns list of DataFrames

# Extract JSON embedded in page (common in SPAs)
def extract_embedded_json(html: str, var_name: str = "window.__DATA__") -> dict:
    """Find JSON assigned to a JS variable inside <script> tags."""
    soup = BeautifulSoup(html, "lxml")
    for script in soup.find_all("script"):
        text = script.string or ""
        if var_name in text:
            match = re.search(rf"{re.escape(var_name)}\s*=\s*(\{{.*?\}})", text, re.DOTALL)
            if match:
                return json.loads(match.group(1))
    return {}

# Extract JSON-LD structured data (many e-commerce sites use this)
def extract_json_ld(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "lxml")
    results = []
    for tag in soup.find_all("script", type="application/ld+json"):
        try:
            results.append(json.loads(tag.string))
        except Exception:
            pass
    return results

# Example: scrape product with JSON-LD
r = requests.get("https://example.com/product/123", headers=get_headers())
structured = extract_json_ld(r.text)
# structured may contain: {"@type": "Product", "name": "...", "price": "...", "rating": {...}}

# Extract CSV/Excel from download links
def download_file(url: str, dest: str):
    r = requests.get(url, headers=get_headers(), stream=True, timeout=60)
    r.raise_for_status()
    with open(dest, "wb") as f:
        for chunk in r.iter_content(chunk_size=8192):
            f.write(chunk)
    print(f"Downloaded: {dest}")

download_file("https://example.com/export?format=csv", "data/export.csv")
df = pd.read_csv("data/export.csv")
```

## 15.9 Scraping Cheatsheet — Selector Reference

```python
# BeautifulSoup selectors
soup.find("div")                          # first <div>
soup.find("div", class_="card")           # first <div class="card">
soup.find("div", id="main")               # by id
soup.find_all("a", href=True)             # all <a> with href
soup.select("div.card > h2")             # CSS selector
soup.select_one(".price span")           # first match
el.get_attribute_list("class")           # all classes as list
el.text.strip()                          # text content cleaned
el["href"]                               # attribute value
el.get("src", "")                        # safe attribute get

# Scrapy CSS selectors
response.css("h1::text").get()           # text content of h1
response.css("a::attr(href)").getall()   # all href values
response.css(".price::text").get("0")    # with default
response.xpath("//h1/text()").get()      # XPath equivalent
response.xpath("//a/@href").getall()

# Playwright selectors
page.query_selector("h1").inner_text()
page.query_selector_all(".card")
page.locator("text=Add to Cart").click()       # by text
page.locator("[data-testid=price]").inner_text()  # by data attr
page.wait_for_selector(".results", state="visible")
page.evaluate("document.title")          # run JS
page.screenshot(path="debug.png")        # debug screenshot
```

## 15.10 Quick Tools Reference — When to Use What

```
TOOL              INSTALL                    USE WHEN
────────────────  ─────────────────────────  ──────────────────────────────────────
requests          pip install requests       Simple HTTP, static pages, APIs
httpx             pip install httpx          Async fetching, many URLs at once
BeautifulSoup4    pip install bs4 lxml       Parse static HTML, quick jobs
Scrapy            pip install scrapy         Large crawls, 1000s of pages, spiders
Selenium          pip install selenium       Old-school JS sites, Chrome automation
Playwright        pip install playwright     Modern JS sites, faster than Selenium
mechanize         pip install mechanize      Form submission on old sites
cloudscraper      pip install cloudscraper   Bypass Cloudflare (basic)
curl_cffi         pip install curl_cffi      Impersonate browsers at HTTP level
selectolax        pip install selectolax     Fastest HTML parsing (C-based)
pandas.read_html  (built-in pandas)          Scrape HTML tables instantly
camelot           pip install camelot-py     Extract tables from PDFs
pdfplumber        pip install pdfplumber     Read text + tables from PDFs
```

---

