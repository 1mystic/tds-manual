<a name="section-4"></a>
# SECTION 4 — ETL & ELT Pipelines

The debate between **ETL** (Extract, Transform, Load) and **ELT** (Extract, Load, Transform) effectively ended when modern cloud data warehouses became infinitely scalable.

In 2026, **ELT is the dominant paradigm**.

1. **Extract**: Pull raw data from an API, Postgres DB, or webhook.
2. **Load**: Dump that raw, messy data directly into a staging layer in Snowflake/BigQuery (using Fivetran or a simple Python script).
3. **Transform**: Use the immense compute power of the warehouse (orchestrated by dbt) to clean and model the data into its final reporting state.

## 4.1 Extract Pattern

```python
import pandas as pd
import requests
import logging
from datetime import datetime, date
from typing import Optional

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

class Extractor:
    """Generic extractor with retry logic and validation."""
    
    def __init__(self, source_name: str):
        self.source_name = source_name
    
    def extract_csv(self, path: str, **kwargs) -> pd.DataFrame:
        logger.info(f"Extracting CSV from {path}")
        df = pd.read_csv(path, **kwargs)
        logger.info(f"Extracted {len(df)} rows, {df.shape[1]} columns")
        return df
    
    def extract_api(self, url: str, headers: dict = None, params: dict = None) -> pd.DataFrame:
        logger.info(f"Extracting API: {url}")
        response = requests.get(url, headers=headers or {}, params=params or {}, timeout=30)
        response.raise_for_status()
        data = response.json()
        df = pd.DataFrame(data if isinstance(data, list) else data.get("data", []))
        logger.info(f"Extracted {len(df)} rows from API")
        return df
    
    def extract_sql(self, engine, query: str, params: dict = None) -> pd.DataFrame:
        logger.info(f"Extracting SQL query from {self.source_name}")
        df = pd.read_sql(query, engine, params=params)
        logger.info(f"Extracted {len(df)} rows")
        return df
```

## 4.2 Transform Pattern

```python
class Transformer:
    """Chainable transformation steps with validation."""
    
    def __init__(self, df: pd.DataFrame):
        self.df = df.copy()
        self.logs = []
    
    def log(self, msg: str):
        self.logs.append(f"{datetime.now().isoformat()} — {msg}")
        logger.info(msg)
        return self
    
    def rename_columns(self, mapping: dict):
        self.df = self.df.rename(columns=mapping)
        return self.log(f"Renamed columns: {mapping}")
    
    def cast_types(self, type_map: dict):
        for col, dtype in type_map.items():
            self.df[col] = self.df[col].astype(dtype)
        return self.log(f"Cast types: {type_map}")
    
    def drop_duplicates(self, subset: list = None):
        before = len(self.df)
        self.df = self.df.drop_duplicates(subset=subset)
        dropped = before - len(self.df)
        return self.log(f"Dropped {dropped} duplicates")
    
    def fill_nulls(self, fill_map: dict):
        self.df = self.df.fillna(fill_map)
        return self.log(f"Filled nulls: {list(fill_map.keys())}")
    
    def add_metadata(self):
        self.df["_ingested_at"] = datetime.utcnow()
        self.df["_source"] = "etl_pipeline"
        return self.log("Added metadata columns")
    
    def validate(self, required_cols: list, not_null_cols: list = None):
        missing = [c for c in required_cols if c not in self.df.columns]
        if missing:
            raise ValueError(f"Missing required columns: {missing}")
        if not_null_cols:
            for col in not_null_cols:
                nulls = self.df[col].isnull().sum()
                if nulls > 0:
                    logger.warning(f"Column {col} has {nulls} null values")
        return self
    
    def result(self) -> pd.DataFrame:
        return self.df

# Usage
raw = pd.read_csv("data/raw/orders.csv")
clean = (
    Transformer(raw)
    .rename_columns({"order_id_external": "order_id", "amt": "amount"})
    .cast_types({"amount": "float64", "user_id": "int64"})
    .drop_duplicates(subset=["order_id"])
    .fill_nulls({"discount": 0.0, "notes": ""})
    .add_metadata()
    .validate(required_cols=["order_id", "user_id", "amount"])
    .result()
)
```

## 4.3 Load Pattern

```python
from sqlalchemy import create_engine, text
import pandas as pd

class Loader:
    """Load data to targets with upsert support."""
    
    def __init__(self, engine):
        self.engine = engine
    
    def load_replace(self, df: pd.DataFrame, table: str, schema: str = "public"):
        df.to_sql(table, self.engine, schema=schema, if_exists="replace",
                  index=False, chunksize=5000, method="multi")
        logger.info(f"Replaced {len(df)} rows into {schema}.{table}")
    
    def load_append(self, df: pd.DataFrame, table: str, schema: str = "public"):
        df.to_sql(table, self.engine, schema=schema, if_exists="append",
                  index=False, chunksize=5000, method="multi")
        logger.info(f"Appended {len(df)} rows to {schema}.{table}")
    
    def load_upsert_postgres(self, df: pd.DataFrame, table: str,
                              schema: str, unique_cols: list):
        """Upsert: insert new, update existing based on unique_cols."""
        staging_table = f"staging_{table}"
        
        # Step 1: Load to staging
        df.to_sql(staging_table, self.engine, schema=schema,
                  if_exists="replace", index=False)
        
        # Step 2: Upsert from staging to target
        cols = df.columns.tolist()
        update_cols = [c for c in cols if c not in unique_cols]
        
        conflict_clause = ", ".join(unique_cols)
        update_clause = ", ".join([f"{c} = EXCLUDED.{c}" for c in update_cols])
        insert_clause = ", ".join(cols)
        values_clause = ", ".join([f"s.{c}" for c in cols])
        
        sql = f"""
        INSERT INTO {schema}.{table} ({insert_clause})
        SELECT {values_clause} FROM {schema}.{staging_table} s
        ON CONFLICT ({conflict_clause}) DO UPDATE SET {update_clause}
        """
        
        with self.engine.connect() as conn:
            conn.execute(text(sql))
            conn.execute(text(f"DROP TABLE IF EXISTS {schema}.{staging_table}"))
            conn.commit()
        
        logger.info(f"Upserted {len(df)} rows into {schema}.{table}")
```

## 4.4 Full ETL Pipeline

```python
import schedule
import time
from datetime import datetime

def run_orders_pipeline():
    """Full ETL: source DB → transform → target warehouse."""
    logger.info("=" * 50)
    logger.info(f"Starting orders pipeline at {datetime.utcnow()}")
    
    try:
        src_engine = create_engine("postgresql://user:pass@source-db:5432/prod")
        tgt_engine = create_engine("postgresql://user:pass@warehouse:5432/dw")
        
        # E — Extract
        extractor = Extractor("orders_db")
        df_raw = extractor.extract_sql(
            src_engine,
            "SELECT * FROM orders WHERE updated_at > NOW() - INTERVAL '1 day'"
        )
        
        # T — Transform
        df_clean = (
            Transformer(df_raw)
            .rename_columns({"id": "order_id", "ts": "created_at"})
            .cast_types({"amount": "float64"})
            .drop_duplicates(subset=["order_id"])
            .add_metadata()
            .validate(["order_id", "user_id", "amount"])
            .result()
        )
        
        # L — Load
        loader = Loader(tgt_engine)
        loader.load_upsert_postgres(df_clean, "orders", "staging", ["order_id"])
        
        logger.info(f"Pipeline completed. {len(df_clean)} rows processed.")
    
    except Exception as e:
        logger.error(f"Pipeline failed: {e}", exc_info=True)
        raise

# Run once
run_orders_pipeline()

# Or schedule
schedule.every().hour.do(run_orders_pipeline)
while True:
    schedule.run_pending()
    time.sleep(60)
```

---

