<a name="section-5"></a>
# SECTION 5 — Cloud Data Platforms

The "Warehouse" is no longer just a database on a server in your office. It is a highly distributed, infinitely scalable cloud platform. 

> [!NOTE]
> **OLTP vs OLAP**:
> Standard databases like PostgreSQL and MySQL are **OLTP** (Online Transaction Processing), built for millions of fast row-level reads/writes (e.g., "update user password").
> Cloud Platforms like Snowflake and BigQuery are **OLAP** (Online Analytical Processing) powered by columnar storage, built for massive aggregations over billions of rows (e.g., "sum all revenue this year by state").

## 5.1 BigQuery (Google Cloud)

```python
from google.cloud import bigquery
import pandas as pd

client = bigquery.Client(project="my-project")

# Query → DataFrame
query = """
SELECT
    DATE(created_at) AS date,
    COUNT(DISTINCT user_id) AS dau,
    SUM(revenue) AS revenue
FROM `my-project.prod.events`
WHERE DATE(created_at) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY 1
ORDER BY 1
"""
df = client.query(query).to_dataframe()

# Parameterized query
query_params = [
    bigquery.ScalarQueryParameter("start_date", "STRING", "2024-01-01"),
    bigquery.ScalarQueryParameter("min_revenue", "FLOAT64", 100.0)
]
job_config = bigquery.QueryJobConfig(query_parameters=query_params)
df = client.query("SELECT * FROM table WHERE date >= @start_date AND revenue > @min_revenue",
                  job_config=job_config).to_dataframe()

# Write DataFrame to BigQuery
job_config = bigquery.LoadJobConfig(
    write_disposition="WRITE_TRUNCATE",   # WRITE_APPEND or WRITE_TRUNCATE
    create_disposition="CREATE_IF_NEEDED",
    schema=[
        bigquery.SchemaField("user_id", "INTEGER"),
        bigquery.SchemaField("revenue", "FLOAT"),
        bigquery.SchemaField("date", "DATE"),
    ]
)
job = client.load_table_from_dataframe(df, "my-project.dataset.table", job_config=job_config)
job.result()  # wait for job to complete
print(f"Loaded {job.output_rows} rows")

# Create table from query
job_config = bigquery.QueryJobConfig(
    destination="my-project.dataset.new_table",
    write_disposition="WRITE_TRUNCATE",
    create_disposition="CREATE_IF_NEEDED"
)
client.query(query, job_config=job_config).result()
```

## 5.2 Snowflake

```sql
-- Snowflake specific SQL

-- Time travel (query data as of 7 days ago)
SELECT * FROM orders AT (OFFSET => -60*60*24*7);
SELECT * FROM orders BEFORE (STATEMENT => 'query-id-here');

-- Clone table (zero-copy, instant)
CREATE TABLE orders_backup CLONE orders;
CREATE SCHEMA prod_backup CLONE prod;

-- Merge (upsert)
MERGE INTO target_table t
USING source_table s ON t.id = s.id
WHEN MATCHED THEN UPDATE SET t.value = s.value, t.updated_at = s.updated_at
WHEN NOT MATCHED THEN INSERT (id, value, updated_at) VALUES (s.id, s.value, s.updated_at);

-- Copy from S3
COPY INTO my_table
FROM 's3://my-bucket/data/'
CREDENTIALS = (AWS_KEY_ID='...' AWS_SECRET_KEY='...')
FILE_FORMAT = (TYPE = 'PARQUET');

-- Streams (CDC - change data capture)
CREATE STREAM orders_stream ON TABLE orders;
SELECT * FROM orders_stream WHERE METADATA$ACTION = 'INSERT';

-- Tasks (scheduled queries)
CREATE TASK refresh_daily
    WAREHOUSE = COMPUTE_WH
    SCHEDULE = 'USING CRON 0 6 * * * UTC'
AS
INSERT INTO daily_summary SELECT ...;

ALTER TASK refresh_daily RESUME;
```

## 5.3 Redshift

```sql
-- Redshift specific

-- Distribution styles (critical for performance)
CREATE TABLE orders (
    order_id BIGINT DISTKEY,       -- distribute by this column (join key)
    user_id  BIGINT,
    amount   DECIMAL(10,2)
) SORTKEY (created_at);            -- sort on disk by date

-- DISTKEY on join column: both tables distributed same way → local join
-- DISTSTYLE ALL: replicate small tables to all nodes

-- Analyze query performance
EXPLAIN SELECT * FROM orders WHERE user_id = 123;

-- Vacuum + Analyze (maintenance)
VACUUM orders;      -- reclaim space from deleted rows
ANALYZE orders;     -- update statistics for query planner

-- Unload to S3
UNLOAD ('SELECT * FROM orders WHERE date > ''2024-01-01''')
TO 's3://my-bucket/exports/orders_'
IAM_ROLE 'arn:aws:iam::123:role/RedshiftRole'
FORMAT AS PARQUET;

-- Copy from S3
COPY orders FROM 's3://my-bucket/data/'
IAM_ROLE 'arn:aws:iam::123:role/RedshiftRole'
FORMAT AS PARQUET;
```

---

