<a name="section-22"></a>
# SECTION 22 — Interview Prep & Career Cheatsheet

## 22.1 SQL Interview Patterns

```sql
-- PATTERN 1: Find Nth highest value
SELECT DISTINCT salary FROM employees
ORDER BY salary DESC
LIMIT 1 OFFSET N-1;  -- N=2 gives 2nd highest

-- PATTERN 2: Running total that resets
SELECT date, amount,
    SUM(amount) OVER (PARTITION BY user_id ORDER BY date) AS running_total
FROM orders;

-- PATTERN 3: Consecutive days active
WITH daily AS (SELECT DISTINCT user_id, DATE(event_date) AS day FROM events),
gaps AS (
    SELECT user_id, day,
        day - ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY day) * INTERVAL '1 day' AS grp
    FROM daily
)
SELECT user_id, MIN(day), MAX(day), COUNT(*) AS streak_length
FROM gaps GROUP BY user_id, grp HAVING COUNT(*) >= 3;

-- PATTERN 4: Self-join for relationship
SELECT a.user_id AS user, b.user_id AS referred_friend
FROM users a
JOIN users b ON a.referral_code = b.referred_by;

-- PATTERN 5: Find users who did A then B (funnel)
SELECT DISTINCT s.user_id
FROM events s
JOIN events p ON s.user_id = p.user_id
    AND s.event = 'signup'
    AND p.event = 'purchase'
    AND p.created_at > s.created_at;

-- PATTERN 6: Month-over-month growth
WITH monthly AS (
    SELECT DATE_TRUNC('month', date) AS month, SUM(revenue) AS revenue
    FROM orders GROUP BY 1
)
SELECT month, revenue,
    LAG(revenue) OVER (ORDER BY month) AS prev_month,
    (revenue - LAG(revenue) OVER (ORDER BY month)) / LAG(revenue) OVER (ORDER BY month) AS mom_growth
FROM monthly;

-- PATTERN 7: Median (no native function in many DBs)
SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY salary) AS median_salary FROM employees;

-- PATTERN 8: Duplicate records
SELECT order_id, COUNT(*) FROM orders GROUP BY order_id HAVING COUNT(*) > 1;
```

## 22.2 Python Interview Patterns

```python
import pandas as pd
import numpy as np

# PATTERN 1: Find top N per group
df.groupby("region").apply(lambda x: x.nlargest(3, "revenue")).reset_index(drop=True)

# PATTERN 2: Fill missing with group median
df["amount"] = df.groupby("category")["amount"].transform(lambda x: x.fillna(x.median()))

# PATTERN 3: Pivot-style aggregate
df.pivot_table(values="revenue", index="region", columns="quarter", aggfunc="sum").fillna(0)

# PATTERN 4: Merge and check
df_merged = df_left.merge(df_right, on="id", how="left", indicator=True)
unmatched = df_merged[df_merged["_merge"] == "left_only"]

# PATTERN 5: Rolling retention
def cohort_retention(df):
    df["cohort"] = df.groupby("user_id")["date"].transform("min").dt.to_period("M")
    df["period"] = df["date"].dt.to_period("M")
    df["age"] = (df["period"] - df["cohort"]).apply(lambda x: x.n)
    cohort_size = df.groupby("cohort")["user_id"].nunique()
    retention = df.groupby(["cohort", "age"])["user_id"].nunique().div(cohort_size, level="cohort")
    return retention.unstack()
```

## 22.3 Key Metrics Definitions

```python
metrics = {
    # Growth
    "DAU": "Daily Active Users — unique users with activity on a given day",
    "MAU": "Monthly Active Users",
    "DAU/MAU": "Stickiness ratio — what % of monthly users are daily active",
    "MoM Growth": "(current_month - prev_month) / prev_month * 100",
    
    # Revenue
    "MRR": "Monthly Recurring Revenue — sum of all subscription revenue in a month",
    "ARR": "Annual Recurring Revenue = MRR × 12",
    "ARPU": "Average Revenue Per User = Revenue / Users",
    "ACV": "Annual Contract Value — annual value of a contract",
    "LTV": "Lifetime Value = ARPU × (1/churn_rate) or ARPU × average_months_active",
    "LTV:CAC": "LTV / Customer Acquisition Cost — should be > 3",
    
    # Engagement / Retention
    "Churn Rate": "(Users lost in period) / (Users at start of period)",
    "Retention D30": "% of day-0 users still active on day 30",
    "NPS": "Net Promoter Score = %Promoters - %Detractors",
    
    # Conversion
    "CVR": "Conversion Rate = Conversions / Visitors",
    "CTR": "Click-Through Rate = Clicks / Impressions",
    "CAC": "Customer Acquisition Cost = Marketing Spend / New Customers",
    
    # Product
    "Activation Rate": "% new users reaching key activation milestone",
    "Feature Adoption": "% of users using a specific feature",
    "Time to Value": "Time from signup to first value moment"
}

for k, v in metrics.items():
    print(f"{k:20s}: {v}")
```

## 22.4 Data Engineer Interview Checklist

```
SYSTEM DESIGN QUESTIONS — Know How to Answer:
═══════════════════════════════════════════════
□ Design a pipeline to ingest 10TB of data daily
□ How would you handle late-arriving data in a streaming pipeline?
□ Design a data warehouse for an e-commerce company
□ How do you ensure exactly-once processing in Kafka?
□ What is data lake vs data warehouse vs data lakehouse?
□ How do you handle schema evolution in Avro/Parquet?
□ Explain partitioning strategies in Spark and when to use each
□ How do you detect and handle data quality issues at scale?
□ What is CDC (Change Data Capture) and how does it work?
□ Design a real-time recommendation system data pipeline

CONCEPTS TO KNOW:
═══════════════════
□ CAP theorem (Consistency, Availability, Partition tolerance)
□ Lambda vs Kappa architecture
□ Star schema vs Snowflake schema vs Data Vault
□ ACID vs BASE
□ Normalization vs Denormalization
□ Partitioning vs Bucketing (Hive/Spark)
□ Shuffle in Spark and how to minimize it
□ Data skew and handling strategies
□ Idempotency in pipelines
□ SCD Types 1, 2, 3
□ Batch vs micro-batch vs streaming
```

## 22.5 Tools Quick Reference Card

```
TOOL           CATEGORY         USE WHEN
──────────     ──────────────   ──────────────────────────────────────
pandas         Data Analysis    < 10M rows, single machine
polars         Data Analysis    Fast alternative to pandas (Rust-based)
PySpark        Big Data         > 10M rows, distributed processing
DuckDB         Analytics SQL    SQL on local files, fast analytics
Snowflake      Cloud DW         Production DW, SaaS analytics
BigQuery       Cloud DW         Google ecosystem, massive scale
dbt            Transformation   SQL transformations, analytics engineering
Airflow        Orchestration    Complex DAG-based workflows
Prefect        Orchestration    Modern alternative, Python-native
Kafka          Streaming        Real-time events, high throughput
Flink          Streaming        Stateful stream processing
MLflow         MLOps            Experiment tracking, model registry
FastAPI        Serving          REST API for models, lightweight
Streamlit      BI/Dashboards    Quick Python dashboards, prototypes
Tableau        BI               Business dashboards, non-technical users
Power BI       BI               Microsoft ecosystem, self-service
Looker         BI               LookML, semantic layer, enterprise
Great Exp.     Data Quality     Expectations-based testing
Docker         Infrastructure   Containerize any data workload
Terraform      Infrastructure   Infrastructure as code for cloud
GitHub Actions CI/CD            Automate tests, deployments, dbt runs
```

## 22.6 Environment Variables Best Practices

```python
# .env file (never commit to git)
# DATABASE_URL=postgresql://user:pass@host:5432/db
# API_KEY=sk-...
# S3_BUCKET=my-bucket
# ENVIRONMENT=production

import os
from dotenv import load_dotenv   # pip install python-dotenv

load_dotenv()  # loads .env file into environment

DATABASE_URL = os.environ["DATABASE_URL"]          # raises if missing (explicit)
API_KEY = os.environ.get("API_KEY", "default")     # returns default if missing
DEBUG = os.environ.get("DEBUG", "false").lower() == "true"

# Validate config at startup
required_vars = ["DATABASE_URL", "API_KEY", "S3_BUCKET"]
missing = [v for v in required_vars if not os.environ.get(v)]
if missing:
    raise EnvironmentError(f"Missing required environment variables: {missing}")

# Config class
from dataclasses import dataclass

@dataclass
class Config:
    database_url: str = os.environ.get("DATABASE_URL", "")
    api_key: str = os.environ.get("API_KEY", "")
    s3_bucket: str = os.environ.get("S3_BUCKET", "")
    environment: str = os.environ.get("ENVIRONMENT", "development")
    debug: bool = os.environ.get("DEBUG", "false").lower() == "true"
    batch_size: int = int(os.environ.get("BATCH_SIZE", "1000"))

config = Config()
print(f"Running in {config.environment} mode")
```

---

## Final Reference: The Data Lifecycle

```
1. COLLECT          Web scraping, APIs, DB replication, Kafka events, IoT sensors
        ↓
2. STORE            S3/GCS/ADLS (raw), PostgreSQL, Snowflake, BigQuery, Delta Lake
        ↓
3. PROCESS          Pandas (small), PySpark (large), dbt (SQL transforms), Airflow (orchestration)
        ↓
4. QUALITY          Great Expectations, dbt tests, custom checks, monitoring alerts
        ↓
5. MODEL/ANALYZE    scikit-learn, XGBoost, Prophet, SQL analytics, A/B tests
        ↓
6. SERVE            FastAPI, Streamlit, Tableau, Looker, scheduled reports
        ↓
7. MONITOR          MLflow, Grafana, Monte Carlo, Anomalo, custom dashboards
        ↓
8. GOVERN           Datahub, Collibra, PII masking, GDPR compliance, access control
```

---

*Data Roles Field Manual — 2026 Edition*
*Analyst · Scientist · Engineer · Analytics Engineer*
