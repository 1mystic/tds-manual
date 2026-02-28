<a name="section-0"></a>
# SECTION 0 — The Data Stack in 2026

## 0.1 Roles at a Glance

```
DATA ANALYST
  Core tools:  SQL, Excel/Sheets, Tableau/Power BI/Looker, Python (pandas)
  Main tasks:  Reporting, dashboards, ad-hoc queries, business metrics
  Output:      Insights, charts, decks, KPI reports

DATA SCIENTIST
  Core tools:  Python (sklearn, pandas, xgboost), SQL, Jupyter, MLflow
  Main tasks:  ML models, experimentation, statistical analysis, forecasting
  Output:      Models, predictions, recommendations, experiments

DATA ENGINEER
  Core tools:  Python, SQL, Spark, Airflow/Prefect, dbt, Kafka, cloud (AWS/GCP/Azure)
  Main tasks:  Build pipelines, maintain warehouse, data quality, infrastructure
  Output:      Reliable data pipelines, clean tables, scalable systems

ANALYTICS ENGINEER  (emerging hybrid role)
  Core tools:  dbt, SQL, Python, Looker/Lightdash
  Main tasks:  Transform raw data into clean models, own data layer
  Output:      dbt models, tested data, documentation
```

## 0.2 Modern Data Stack Overview

```
INGESTION           STORAGE              TRANSFORM           SERVE
──────────          ──────────           ──────────          ──────────
Fivetran            Snowflake            dbt                 Looker
Airbyte             BigQuery             Spark               Tableau
Stitch              Redshift             Pandas              Power BI
Custom Python       Delta Lake           PySpark             Grafana
Kafka               S3/GCS/ADLS          Flink               Streamlit
Debezium            PostgreSQL           Airflow             FastAPI
Singer              DuckDB               Prefect             Superset

QUALITY             GOVERNANCE           MLOPS               AI/LLM
──────────          ──────────           ──────────          ──────────
Great Expectations  Datahub              MLflow              OpenAI API
dbt tests           Alation              Weights & Biases    LangChain
Soda                Monte Carlo          BentoML             Hugging Face
Anomalo             Collibra             Ray Serve           Ollama
```

## 0.3 Project Structure (Data Engineer Style)

```
data_project/
├── ingestion/           # Raw data loading scripts
├── dbt/                 # Transformation models
│   ├── models/
│   │   ├── staging/     # Clean raw data
│   │   ├── intermediate/ # Business logic
│   │   └── marts/       # Final tables for BI
│   └── tests/
├── pipelines/           # Airflow DAGs or Prefect flows
├── notebooks/           # Analysis notebooks
├── src/
│   ├── extract.py
│   ├── transform.py
│   └── load.py
├── tests/               # Unit tests
├── docker/
├── .env                 # Secrets (never commit)
├── requirements.txt
└── README.md
```

## 0.4 Choosing the Right Tool
While the Modern Data Stack offers many options, choosing the right tool depends on your team's size, budget, and real-time needs.

### Ingestion (Extract & Load)
* **Fivetran/Airbyte**: Best for standard SaaS sources (Salesforce, Zendesk, Stripe). They require zero maintenance but can be expensive at high volumes.
* **Custom Python**: Necessary for proprietary internal APIs or legacy databases that standard connectors don't support.

### Storage (The Warehouse)
* **Snowflake**: Separation of storage and compute. Excellent for large teams needing concurrent querying without locking.
* **BigQuery**: Serverless. You pay per query. Great for teams with unpredictable workloads who want zero infrastructure management.

### Transformation
* **dbt (Data Build Tool)**: The absolute industry standard in 2026 for transforming data within the warehouse using templated SQL. Transforms anyone who knows SQL into a data pipeline engineer.

### Orchestration
* **Apache Airflow**: The veteran. Python-centric DAGs. Extremely customizable but requires dedicated infra support.
* **Prefect / Dagster**: Modern alternatives to Airflow, offering easier local testing and more dynamic DAG generation.

---

