<a name="section-2"></a>
# SECTION 2 — Python for Data Analysis

Python remains the absolute king of local data manipulation and ML orchestration. While SQL is best for querying the warehouse, Python (`pandas`, `polars`, `numpy`) is where the deep complex data transformations and analyses happen.

> [!NOTE]
> In 2026, `Polars` has gained massive ground on `Pandas` for speed, but `Pandas 2.0+` (backed by PyArrow) remains the most widely deployed API. The below snippets focus on modern, optimized Pandas usage.

## 2.1 Pandas Power Patterns

```python
import pandas as pd
import numpy as np

# Read large files efficiently
df = pd.read_csv(
    "large_file.csv",
    dtype={"user_id": "int32", "amount": "float32"},  # reduce memory
    usecols=["user_id", "amount", "date"],             # only needed cols
    parse_dates=["date"],
    chunksize=None  # set to 10000 to read in chunks
)

# Memory usage
print(df.memory_usage(deep=True).sum() / 1024**2, "MB")

# Downcast to save memory
df["amount"] = pd.to_numeric(df["amount"], downcast="float")
df["user_id"] = pd.to_numeric(df["user_id"], downcast="integer")
df["category"] = df["category"].astype("category")  # huge savings for low-cardinality

# Read in chunks (for files bigger than RAM)
chunks = []
for chunk in pd.read_csv("huge_file.csv", chunksize=100_000):
    filtered = chunk[chunk["amount"] > 0]
    chunks.append(filtered)
df = pd.concat(chunks, ignore_index=True)
```

## 2.2 Advanced Pandas Operations

```python
# Multi-level groupby + transform
df["user_spend_pct"] = (
    df["amount"] / df.groupby("user_id")["amount"].transform("sum") * 100
)

# Rolling calculations
df = df.sort_values("date")
df["7d_rolling_avg"] = df.groupby("user_id")["amount"].transform(
    lambda x: x.rolling(7, min_periods=1).mean()
)

# Explode — expand lists into rows
df["tags"] = df["tags"].str.split(",")
df_exploded = df.explode("tags")

# Stack / Unstack
pivoted = df.pivot_table(values="revenue", index="region", columns="month", aggfunc="sum")
# Flatten multi-index columns
pivoted.columns = [f"{col[0]}_{col[1]}" for col in pivoted.columns]

# Apply with multiple return values
def parse_address(addr):
    parts = addr.split(",")
    return pd.Series({"city": parts[0].strip(), "state": parts[1].strip() if len(parts) > 1 else None})

df[["city", "state"]] = df["address"].apply(parse_address)

# Vectorized string operations (much faster than .apply)
df["domain"] = df["email"].str.extract(r"@(.+)$")
df["initials"] = df["first_name"].str[0] + df["last_name"].str[0]

# merge_asof — join on nearest key (great for time series)
pd.merge_asof(
    df_orders.sort_values("order_date"),
    df_prices.sort_values("price_date"),
    left_on="order_date",
    right_on="price_date",
    by="product_id",
    direction="backward"  # use last known price
)
```

## 2.3 Profiling a Dataset

```python
# Quick custom profiler
def profile_dataframe(df):
    report = pd.DataFrame({
        "dtype": df.dtypes,
        "null_count": df.isnull().sum(),
        "null_pct": (df.isnull().mean() * 100).round(2),
        "unique_count": df.nunique(),
        "cardinality_pct": (df.nunique() / len(df) * 100).round(2)
    })
    report["sample_values"] = [df[c].dropna().head(3).tolist() for c in df.columns]
    return report

print(profile_dataframe(df).to_string())

# ydata-profiling (formerly pandas-profiling)
# pip install ydata-profiling
from ydata_profiling import ProfileReport
profile = ProfileReport(df, title="Dataset Profile", explorative=True)
profile.to_file("outputs/profile.html")
```

## 2.4 Working with APIs

```python
import requests
import pandas as pd
import time

# Basic GET
response = requests.get(
    "https://api.example.com/data",
    headers={"Authorization": "Bearer YOUR_TOKEN"},
    params={"start_date": "2024-01-01", "end_date": "2024-12-31"}
)
response.raise_for_status()  # raises HTTPError if 4xx/5xx
data = response.json()

# Paginated API (cursor-based)
def fetch_all_pages(base_url: str, headers: dict, params: dict) -> list:
    results = []
    url = base_url
    while url:
        r = requests.get(url, headers=headers, params=params)
        r.raise_for_status()
        payload = r.json()
        results.extend(payload.get("data", []))
        url = payload.get("next_cursor")  # or "next_url", "next_page_token" etc
        params = {}  # cursor includes all params
        time.sleep(0.2)  # rate limiting
    return results

# Paginated API (offset-based)
def fetch_paginated(base_url: str, headers: dict) -> list:
    results = []
    offset = 0
    limit = 100
    while True:
        r = requests.get(base_url, headers=headers, params={"limit": limit, "offset": offset})
        r.raise_for_status()
        page = r.json()
        if not page["data"]:
            break
        results.extend(page["data"])
        offset += limit
    return results

df = pd.DataFrame(fetch_paginated("https://api.example.com/records", {}))
```

---

