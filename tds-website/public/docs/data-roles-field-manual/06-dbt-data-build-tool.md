<a name="section-6"></a>
# SECTION 6 — dbt (Data Build Tool)

dbt translates SQL into a full-fledged software engineering environment. It allows analysts to write simple `SELECT` statements, while dbt handles the boilerplate `CREATE TABLE`, `INSERT`, dependencies, and execution order. 

> [!TIP]
> In 2026, **dbt Core** (open source CLI) is often orchestrated by tools like **Airflow** or **Dagster**, while **dbt Cloud** handles the orchestration for teams without dedicated data engineers.

## 6.1 Setup

```bash
pip install dbt-postgres   # or dbt-bigquery, dbt-snowflake, dbt-redshift

dbt init my_project        # creates project structure
cd my_project
dbt debug                  # test connection
dbt run                    # run all models
dbt test                   # run all tests
dbt docs generate          # generate documentation
dbt docs serve             # serve docs locally
```

## 6.2 profiles.yml (Connection Config)

```yaml
# ~/.dbt/profiles.yml
my_project:
  target: dev
  outputs:
    dev:
      type: postgres
      host: localhost
      port: 5432
      user: "{{ env_var('DBT_USER') }}"
      password: "{{ env_var('DBT_PASSWORD') }}"
      dbname: analytics
      schema: dev_yourname
      threads: 4
    prod:
      type: postgres
      host: prod-warehouse.company.com
      port: 5432
      user: dbt_prod
      password: "{{ env_var('DBT_PROD_PASSWORD') }}"
      dbname: analytics
      schema: dbt_prod
      threads: 8
```

## 6.3 dbt Model Structure

```sql
-- models/staging/stg_orders.sql
-- Staging: 1-to-1 with source, just rename + light cleaning

{{ config(materialized='view') }}

WITH source AS (
    SELECT * FROM {{ source('postgres', 'orders') }}
),
renamed AS (
    SELECT
        id                          AS order_id,
        user_id,
        CAST(amount AS NUMERIC)     AS amount,
        status,
        created_at::TIMESTAMP       AS created_at,
        updated_at::TIMESTAMP       AS updated_at
    FROM source
    WHERE id IS NOT NULL
)
SELECT * FROM renamed

---

-- models/intermediate/int_orders_with_users.sql
-- Intermediate: business logic, joins

{{ config(materialized='view') }}

WITH orders AS (
    SELECT * FROM {{ ref('stg_orders') }}
),
users AS (
    SELECT * FROM {{ ref('stg_users') }}
)
SELECT
    o.order_id,
    o.user_id,
    o.amount,
    o.status,
    o.created_at,
    u.email,
    u.country,
    u.signup_date,
    DATEDIFF('day', u.signup_date, o.created_at) AS days_since_signup
FROM orders o
LEFT JOIN users u ON o.user_id = u.user_id

---

-- models/marts/fct_orders.sql
-- Fact table: final, production-ready

{{ config(
    materialized='incremental',
    unique_key='order_id',
    on_schema_change='fail'
) }}

WITH orders AS (
    SELECT * FROM {{ ref('int_orders_with_users') }}
    {% if is_incremental() %}
    WHERE created_at > (SELECT MAX(created_at) FROM {{ this }})
    {% endif %}
)
SELECT
    order_id,
    user_id,
    amount,
    status,
    country,
    created_at,
    DATE_TRUNC('month', created_at) AS order_month,
    CURRENT_TIMESTAMP AS _dbt_inserted_at
FROM orders
```

## 6.4 dbt Tests

```yaml
# models/staging/schema.yml
version: 2

sources:
  - name: postgres
    database: prod
    schema: public
    tables:
      - name: orders
        freshness:
          warn_after: {count: 12, period: hour}
          error_after: {count: 24, period: hour}
        loaded_at_field: updated_at

models:
  - name: stg_orders
    description: "Cleaned orders from source system"
    columns:
      - name: order_id
        description: "Primary key"
        tests:
          - unique
          - not_null
      - name: amount
        tests:
          - not_null
          - dbt_utils.accepted_range:
              min_value: 0
              max_value: 1000000
      - name: status
        tests:
          - accepted_values:
              values: ['pending', 'completed', 'cancelled', 'refunded']
      - name: user_id
        tests:
          - not_null
          - relationships:
              to: ref('stg_users')
              field: user_id

  - name: fct_orders
    tests:
      - dbt_utils.recency:
          datepart: day
          field: created_at
          interval: 1
```

## 6.5 dbt Macros and Jinja

```sql
-- macros/generate_schema_name.sql
{% macro generate_schema_name(custom_schema_name, node) -%}
    {%- set default_schema = target.schema -%}
    {%- if custom_schema_name is none -%}
        {{ default_schema }}
    {%- else -%}
        {{ custom_schema_name | trim }}
    {%- endif -%}
{%- endmacro %}

-- macros/cents_to_dollars.sql
{% macro cents_to_dollars(column_name) %}
    ({{ column_name }} / 100.0)::NUMERIC(10,2)
{% endmacro %}

-- Usage in model:
SELECT {{ cents_to_dollars('amount_cents') }} AS amount_dollars

-- Dynamic date spine (generate a row per date)
{{ dbt_utils.date_spine(
    datepart="day",
    start_date="cast('2020-01-01' as date)",
    end_date="cast('2024-12-31' as date)"
) }}
```

## 6.6 dbt Commands Reference

```bash
# Run specific model and all its dependencies (+)
dbt run --select stg_orders+
dbt run --select +fct_orders    # and all upstream
dbt run --select +fct_orders+   # upstream AND downstream

# Run specific tag
dbt run --select tag:daily

# Test specific model
dbt test --select stg_orders

# Compile only (don't execute)
dbt compile --select fct_orders

# Freshness check
dbt source freshness

# Show model DAG
dbt ls --select +fct_orders --output tree

# Run in production
dbt run --target prod
dbt run --target prod --full-refresh   # rebuild incremental from scratch
```

---

