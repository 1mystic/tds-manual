<a name="section-1"></a>
# SECTION 1 — SQL Mastery (Every Role Needs This)

## 1.1 Core Query Patterns

```sql
-- Basic anatomy
SELECT
    column1,
    column2,
    COUNT(*) AS row_count,
    SUM(revenue) AS total_revenue,
    AVG(revenue) AS avg_revenue
FROM schema.table_name
WHERE created_at >= '2024-01-01'
    AND status = 'active'
    AND revenue > 0
GROUP BY column1, column2
HAVING COUNT(*) > 10
ORDER BY total_revenue DESC
LIMIT 100;

-- COUNT variants
COUNT(*)            -- count all rows including NULLs
COUNT(column)       -- count non-NULL values
COUNT(DISTINCT id)  -- count unique non-NULL values

-- Conditionals
CASE
    WHEN revenue > 10000 THEN 'high'
    WHEN revenue > 1000  THEN 'medium'
    ELSE 'low'
END AS revenue_tier

-- COALESCE (return first non-null)
COALESCE(phone, email, 'no_contact') AS contact

-- NULLIF (return null if values match)
NULLIF(denominator, 0)   -- avoid divide by zero
```

## 1.2 Window Functions (Most Important Advanced SQL)

Window functions are arguably the most important advanced SQL concept for interviews and real-world analytics. They allow you to perform calculations across a set of table rows that are somehow related to the current row, **without** collapsing the rows like an aggregate `GROUP BY` would.

> [!TIP]
> Think of a Window Function as saying: "For this specific row, look at this specific 'window' of other related rows, do some math, and attach the result here."

```sql
-- Syntax: function() OVER (PARTITION BY ... ORDER BY ... ROWS/RANGE ...)

-- ROW_NUMBER — unique sequential number per partition
SELECT
    user_id,
    order_id,
    order_date,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY order_date) AS order_num
FROM orders;

-- RANK vs DENSE_RANK
-- RANK: 1,2,2,4 (skips after tie)
-- DENSE_RANK: 1,2,2,3 (no skip)
RANK()       OVER (PARTITION BY dept ORDER BY salary DESC) AS rank_in_dept,
DENSE_RANK() OVER (PARTITION BY dept ORDER BY salary DESC) AS dense_rank

-- LAG / LEAD — access previous/next row
LAG(revenue, 1) OVER (PARTITION BY user_id ORDER BY month)  AS prev_month_revenue,
LEAD(revenue, 1) OVER (PARTITION BY user_id ORDER BY month) AS next_month_revenue,

-- Running totals / moving averages
SUM(revenue) OVER (ORDER BY date ROWS UNBOUNDED PRECEDING)      AS cumulative_revenue,
AVG(revenue) OVER (ORDER BY date ROWS 6 PRECEDING)              AS rolling_7day_avg,
SUM(revenue) OVER (PARTITION BY user_id ORDER BY date)          AS user_cumulative_revenue,

-- Percent of total
revenue / SUM(revenue) OVER () * 100 AS pct_of_total,
revenue / SUM(revenue) OVER (PARTITION BY region) * 100 AS pct_of_region,

-- NTILE — bucket into N equal groups
NTILE(4) OVER (ORDER BY revenue DESC) AS revenue_quartile,

-- FIRST_VALUE / LAST_VALUE
FIRST_VALUE(product) OVER (PARTITION BY user_id ORDER BY order_date) AS first_product,
LAST_VALUE(product) OVER (PARTITION BY user_id ORDER BY order_date
                          ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS last_product
```

## 1.3 CTEs and Subqueries

```sql
-- CTE (Common Table Expression) — preferred over subqueries
WITH
active_users AS (
    SELECT user_id, created_at
    FROM users
    WHERE status = 'active'
),
user_orders AS (
    SELECT
        u.user_id,
        COUNT(o.order_id)   AS total_orders,
        SUM(o.revenue)      AS lifetime_value,
        MAX(o.order_date)   AS last_order_date
    FROM active_users u
    LEFT JOIN orders o ON u.user_id = o.user_id
    GROUP BY u.user_id
),
ltv_tiers AS (
    SELECT
        user_id,
        total_orders,
        lifetime_value,
        NTILE(4) OVER (ORDER BY lifetime_value) AS ltv_quartile
    FROM user_orders
)
SELECT
    ltv_quartile,
    COUNT(*) AS user_count,
    AVG(lifetime_value) AS avg_ltv,
    AVG(total_orders) AS avg_orders
FROM ltv_tiers
GROUP BY ltv_quartile
ORDER BY ltv_quartile;

-- Recursive CTE (for hierarchies / org charts)
WITH RECURSIVE org_hierarchy AS (
    -- Base: top-level employees (no manager)
    SELECT employee_id, name, manager_id, 0 AS level
    FROM employees
    WHERE manager_id IS NULL

    UNION ALL

    -- Recursive: employees reporting to someone in previous level
    SELECT e.employee_id, e.name, e.manager_id, h.level + 1
    FROM employees e
    JOIN org_hierarchy h ON e.manager_id = h.employee_id
)
SELECT * FROM org_hierarchy ORDER BY level, name;
```

## 1.4 JOINs — Full Reference

```sql
-- INNER: only matching rows
SELECT * FROM a INNER JOIN b ON a.id = b.id;

-- LEFT: all from left, NULLs for unmatched right
SELECT * FROM a LEFT JOIN b ON a.id = b.id;

-- RIGHT: all from right
SELECT * FROM a RIGHT JOIN b ON a.id = b.id;

-- FULL OUTER: all from both
SELECT * FROM a FULL OUTER JOIN b ON a.id = b.id;

-- CROSS: cartesian product (every combo)
SELECT * FROM a CROSS JOIN b;

-- SELF JOIN (e.g., employee → manager)
SELECT e.name, m.name AS manager
FROM employees e
LEFT JOIN employees m ON e.manager_id = m.employee_id;

-- Find rows in A not in B (anti-join)
SELECT a.* FROM a LEFT JOIN b ON a.id = b.id WHERE b.id IS NULL;
-- Or with NOT EXISTS:
SELECT * FROM a WHERE NOT EXISTS (SELECT 1 FROM b WHERE b.id = a.id);

-- Multiple join conditions
SELECT * FROM orders o
JOIN promotions p ON o.user_id = p.user_id AND o.order_date BETWEEN p.start_date AND p.end_date;
```

## 1.5 Advanced Patterns

```sql
-- Pivot / Unpivot
-- Pivot (rows → columns)
SELECT
    month,
    SUM(CASE WHEN product = 'A' THEN revenue ELSE 0 END) AS product_a,
    SUM(CASE WHEN product = 'B' THEN revenue ELSE 0 END) AS product_b,
    SUM(CASE WHEN product = 'C' THEN revenue ELSE 0 END) AS product_c
FROM sales
GROUP BY month;

-- Unpivot (columns → rows) — BigQuery syntax
SELECT month, product, revenue
FROM sales
UNPIVOT (revenue FOR product IN (product_a, product_b, product_c));

-- Deduplication — keep latest record per user
WITH ranked AS (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY updated_at DESC) AS rn
    FROM users_raw
)
SELECT * FROM ranked WHERE rn = 1;

-- Gaps and islands (consecutive sequences)
WITH numbered AS (
    SELECT date, ROW_NUMBER() OVER (ORDER BY date) AS rn
    FROM active_days
),
grouped AS (
    SELECT date, DATE_SUB(date, INTERVAL rn DAY) AS grp
    FROM numbered
)
SELECT MIN(date) AS start, MAX(date) AS end, COUNT(*) AS days
FROM grouped
GROUP BY grp
ORDER BY start;

-- Running median (BigQuery)
PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY revenue) OVER ()

-- Date arithmetic
DATE_DIFF(end_date, start_date, DAY)   -- BigQuery
DATEDIFF(end_date, start_date)         -- MySQL/Redshift
end_date - start_date                  -- PostgreSQL

-- String manipulation
CONCAT(first_name, ' ', last_name)
SUBSTRING(email, 1, CHARINDEX('@', email) - 1)  -- SQL Server
SPLIT_PART(email, '@', 1)                        -- PostgreSQL
REGEXP_EXTRACT(url, r'https?://([^/]+)')         -- BigQuery

-- JSON parsing (BigQuery)
JSON_EXTRACT_SCALAR(json_col, '$.user.name')
JSON_EXTRACT_ARRAY(json_col, '$.items')

-- Array handling (BigQuery)
ARRAY_LENGTH(arr_col)
arr_col[OFFSET(0)]
UNNEST(arr_col) AS item
```

## 1.6 Performance Optimization

```sql
-- 1. Use WHERE before JOIN to reduce rows early
-- BAD:
SELECT * FROM large_table l JOIN small_table s ON l.id = s.id WHERE l.date > '2024-01-01';
-- BETTER: filter in CTE
WITH filtered AS (SELECT * FROM large_table WHERE date > '2024-01-01')
SELECT * FROM filtered f JOIN small_table s ON f.id = s.id;

-- 2. Avoid SELECT * — name columns explicitly
-- 3. Use approximate functions on huge datasets
SELECT APPROX_COUNT_DISTINCT(user_id) FROM events;   -- BigQuery
SELECT HLL_COUNT.MERGE(HLL_COUNT.INIT(user_id))...   -- BigQuery exact HLL

-- 4. Partition pruning — always filter on partition column
WHERE event_date BETWEEN '2024-01-01' AND '2024-03-31'   -- uses partition

-- 5. Explain query plan
EXPLAIN SELECT * FROM orders WHERE user_id = 123;
EXPLAIN ANALYZE SELECT * FROM orders WHERE user_id = 123;  -- PostgreSQL (actually runs)

-- 6. Indexes (PostgreSQL)
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_date ON orders(order_date DESC);
CREATE INDEX idx_orders_user_date ON orders(user_id, order_date);  -- composite

-- 7. Materialized views (cache expensive queries)
CREATE MATERIALIZED VIEW daily_revenue AS
SELECT DATE(created_at) AS day, SUM(revenue) AS revenue
FROM orders GROUP BY 1;

REFRESH MATERIALIZED VIEW daily_revenue;
```

## 1.7 Modern SQL Dialect Differences (2026 Reference)
As you move between tools in the Modern Data Stack, the SQL syntax shifts slightly.

### BigQuery (Google)
* Extremely fast on massive datasets.
* Uses backticks `` `project.dataset.table` `` for identifiers.
* `UNNEST()` is heavily used flat arrays and JSON structures.
* Supports `QUALIFY` clause to filter window functions directly (avoids CTEs). Example: `QUALIFY ROW_NUMBER() OVER (...) = 1`.

### Snowflake
* Case insensitive by default (but standardizes to UPPERCASE internally).
* Time travel built-in: `SELECT * FROM table AT (TIMESTAMP => ...)`
* Excellent array manipulation and dynamic data types (VARIANT).

### PostgreSQL (The Standard)
* The traditional benchmark all new DBs compare against.
* Strict typing. Extremely robust indexing options.
* Commonly used for application backends before data gets replicated to a warehouse.

---

