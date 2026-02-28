<a name="section-8"></a>
# SECTION 8 — Orchestration with Airflow

Data pipelines must run reliably on a schedule, retry on failures, and log their state. **Apache Airflow** uses Python to define **DAGs** (Directed Acyclic Graphs) which express the dependency order of your tasks.

> [!CAUTION]
> Never do heavy data processing *inside* an Airflow task (`PythonOperator`). Airflow is the conductor, not the orchestra. Airflow should tell Snowflake, dbt, or Spark to do the heavy lifting, and then wait for them to finish.

## 8.1 Airflow Setup

```bash
pip install apache-airflow apache-airflow-providers-postgres \
            apache-airflow-providers-google apache-airflow-providers-amazon

# Init DB and create admin user
airflow db migrate
airflow users create --username admin --firstname Admin --lastname User \
    --role Admin --email admin@example.com --password admin

# Start webserver and scheduler
airflow webserver --port 8080 &
airflow scheduler &
```

## 8.2 Basic DAG

```python
# dags/orders_etl.py
from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.operators.bash import BashOperator
from airflow.providers.postgres.operators.postgres import PostgresOperator
from airflow.utils.dates import days_ago
from datetime import datetime, timedelta
import pandas as pd

default_args = {
    "owner": "data-team",
    "depends_on_past": False,
    "email": ["alerts@company.com"],
    "email_on_failure": True,
    "email_on_retry": False,
    "retries": 2,
    "retry_delay": timedelta(minutes=5),
}

with DAG(
    dag_id="orders_daily_etl",
    default_args=default_args,
    description="Daily orders ETL pipeline",
    schedule_interval="0 6 * * *",   # cron: 6am daily
    start_date=datetime(2024, 1, 1),
    catchup=False,                    # don't backfill
    tags=["etl", "orders", "daily"],
    max_active_runs=1,                # one run at a time
) as dag:

    def extract(**context):
        """Extract orders from source DB."""
        execution_date = context["ds"]   # "2024-01-15"
        # Extract logic here
        print(f"Extracting for date: {execution_date}")
        # Push result to XCom
        context["ti"].xcom_push(key="row_count", value=1000)
    
    def transform(**context):
        row_count = context["ti"].xcom_pull(key="row_count", task_ids="extract")
        print(f"Transforming {row_count} rows")
    
    def load(**context):
        print("Loading data")
    
    def validate(**context):
        print("Validating loaded data")
    
    t_extract = PythonOperator(task_id="extract", python_callable=extract)
    
    t_transform = PythonOperator(task_id="transform", python_callable=transform)
    
    t_load = PythonOperator(task_id="load", python_callable=load)
    
    t_validate = PythonOperator(task_id="validate", python_callable=validate)
    
    t_dbt_run = BashOperator(
        task_id="dbt_run",
        bash_command="cd /opt/dbt && dbt run --select tag:orders --target prod"
    )

    # Define task dependencies
    t_extract >> t_transform >> t_load >> t_validate >> t_dbt_run
```

## 8.3 Sensors and Branching

```python
from airflow.sensors.filesystem import FileSensor
from airflow.sensors.sql import SqlSensor
from airflow.operators.python import BranchPythonOperator

# File sensor — wait for file to appear
wait_for_file = FileSensor(
    task_id="wait_for_file",
    filepath="/data/raw/orders_{{ ds }}.csv",
    poke_interval=300,   # check every 5 min
    timeout=3600,        # fail after 1 hour
    mode="reschedule"    # release worker slot while waiting
)

# SQL sensor — wait for data to appear
wait_for_data = SqlSensor(
    task_id="wait_for_data",
    conn_id="postgres_prod",
    sql="SELECT COUNT(*) FROM orders WHERE date = '{{ ds }}'",
    mode="reschedule",
    poke_interval=600
)

# Branching — conditional paths
def decide_path(**context):
    row_count = context["ti"].xcom_pull(key="row_count", task_ids="extract")
    if row_count > 0:
        return "transform"      # task_id to run
    else:
        return "send_empty_alert"

branch = BranchPythonOperator(
    task_id="check_data",
    python_callable=decide_path
)
```

## 8.4 Prefect (Modern Alternative to Airflow)

```python
# pip install prefect
from prefect import flow, task, get_run_logger
from prefect.tasks import task_input_hash
from datetime import timedelta

@task(retries=2, cache_key_fn=task_input_hash, cache_expiration=timedelta(hours=1))
def extract_data(start_date: str) -> pd.DataFrame:
    logger = get_run_logger()
    logger.info(f"Extracting from {start_date}")
    df = pd.read_csv(f"data/raw/orders_{start_date}.csv")
    return df

@task
def transform_data(df: pd.DataFrame) -> pd.DataFrame:
    logger = get_run_logger()
    logger.info(f"Transforming {len(df)} rows")
    df = df.dropna(subset=["order_id"])
    df["amount"] = df["amount"].astype(float)
    return df

@task
def load_data(df: pd.DataFrame, target: str):
    logger = get_run_logger()
    df.to_parquet(f"data/processed/{target}.parquet", index=False)
    logger.info(f"Loaded {len(df)} rows to {target}")

@flow(name="orders-etl", log_prints=True)
def orders_pipeline(start_date: str = "2024-01-01"):
    raw = extract_data(start_date)
    clean = transform_data(raw)
    load_data(clean, target=f"orders_{start_date}")

# Run
orders_pipeline(start_date="2024-06-01")

# Deploy and schedule via Prefect Cloud or self-hosted
```

---

