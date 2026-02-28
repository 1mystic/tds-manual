<a name="section-3"></a>
# SECTION 3 — Data Engineering Fundamentals

Data Engineering in 2026 focuses on building the highways that transport data reliably, quickly, and cleanly from source applications into the analytical warehouse where it can be analyzed.

> [!TIP]
> **The Golden Rule of Data Engineering**: Always build idempotent pipelines. If a pipeline runs twice on the same data for the same day, the result in the database should be exactly the same as if it ran once (e.g., use `MERGE` or `DELETE -> INSERT` instead of plain `INSERT`).

## 3.1 Database Connections

```python
# PostgreSQL
import psycopg2
import pandas as pd
from sqlalchemy import create_engine, text

# SQLAlchemy engine (recommended — works with pandas)
engine = create_engine(
    "postgresql+psycopg2://user:password@host:5432/dbname",
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True  # handle dropped connections
)

# Read
df = pd.read_sql("SELECT * FROM orders WHERE date > '2024-01-01'", engine)

# Write
df.to_sql("processed_orders", engine, schema="staging", if_exists="replace",
          index=False, chunksize=10000, method="multi")

# Execute raw SQL
with engine.connect() as conn:
    conn.execute(text("TRUNCATE TABLE staging.temp_table"))
    conn.commit()

# BigQuery
from google.cloud import bigquery
client = bigquery.Client(project="my-project")
df = client.query("SELECT * FROM `my-project.dataset.table`").to_dataframe()

# Write to BigQuery
pandas_gbq.to_gbq(df, "dataset.table", project_id="my-project", if_exists="replace")

# Snowflake
from snowflake.connector import connect
import snowflake.connector.pandas_tools as sf_tools

conn = connect(
    user="user", password="pass", account="account.region",
    warehouse="COMPUTE_WH", database="DB", schema="SCHEMA"
)
df = pd.read_sql("SELECT * FROM table", conn)
```

## 3.2 Reading Different File Formats

```python
import pandas as pd
import pyarrow.parquet as pq

# Parquet — fast, columnar, compressed
df = pd.read_parquet("data/file.parquet")
df = pd.read_parquet("data/file.parquet", columns=["id", "date", "amount"])  # column pruning

# Read partitioned parquet (Hive-style: /date=2024-01-01/part-0.parquet)
import pyarrow.dataset as ds
dataset = ds.dataset("s3://bucket/data/", partitioning="hive")
df = dataset.to_table(filter=ds.field("date") > "2024-01-01").to_pandas()

# JSON Lines (.jsonl) — one JSON object per line
df = pd.read_json("data/events.jsonl", lines=True)

# Nested JSON to flat DataFrame
import json
with open("data/nested.json") as f:
    data = json.load(f)
df = pd.json_normalize(data["records"], max_level=2)

# Avro (requires fastavro)
import fastavro
with open("data/file.avro", "rb") as f:
    reader = fastavro.reader(f)
    records = list(reader)
df = pd.DataFrame(records)

# Delta Lake (requires deltalake)
from deltalake import DeltaTable
dt = DeltaTable("s3://bucket/delta_table/")
df = dt.to_pandas()
df_filtered = dt.to_pandas(filters=[("date", ">=", "2024-01-01")])
```

## 3.3 S3 / Cloud Storage

```python
import boto3
import pandas as pd
from io import BytesIO

# AWS S3
s3 = boto3.client(
    "s3",
    aws_access_key_id="KEY",
    aws_secret_access_key="SECRET",
    region_name="us-east-1"
)

# Read from S3
obj = s3.get_object(Bucket="my-bucket", Key="data/file.csv")
df = pd.read_csv(BytesIO(obj["Body"].read()))

# Write to S3
buffer = BytesIO()
df.to_parquet(buffer, index=False)
s3.put_object(Bucket="my-bucket", Key="processed/file.parquet", Body=buffer.getvalue())

# List files
response = s3.list_objects_v2(Bucket="my-bucket", Prefix="data/2024/")
files = [obj["Key"] for obj in response.get("Contents", [])]

# Using s3fs (pandas-native S3 access)
import s3fs
fs = s3fs.S3FileSystem(anon=False)
df = pd.read_parquet("s3://my-bucket/data/file.parquet", filesystem=fs)

# GCS
from google.cloud import storage
client = storage.Client()
bucket = client.bucket("my-bucket")
blob = bucket.blob("data/file.csv")
df = pd.read_csv(BytesIO(blob.download_as_bytes()))
```

---

