<a name="section-14"></a>
# SECTION 14 — Data Modeling & Warehouse Design

## 14.1 Kimball Dimensional Modeling

```sql
-- FACT TABLE: Numeric measures + foreign keys to dimensions
CREATE TABLE fct_orders (
    order_sk        BIGINT PRIMARY KEY,        -- surrogate key
    order_id        VARCHAR(50) NOT NULL,       -- natural/business key
    user_sk         BIGINT REFERENCES dim_users(user_sk),
    product_sk      BIGINT REFERENCES dim_products(product_sk),
    date_sk         INT REFERENCES dim_date(date_sk),
    
    -- Metrics (additive measures)
    amount          DECIMAL(12, 2),
    quantity        INT,
    discount_amount DECIMAL(12, 2),
    net_revenue     DECIMAL(12, 2),
    
    -- Audit
    _loaded_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    _source         VARCHAR(50)
);

-- DIMENSION TABLE: Descriptive attributes
CREATE TABLE dim_users (
    user_sk         BIGINT PRIMARY KEY,         -- surrogate key
    user_id         VARCHAR(50) NOT NULL,        -- natural key
    email           VARCHAR(255),
    first_name      VARCHAR(100),
    country         VARCHAR(50),
    signup_date     DATE,
    
    -- SCD Type 2 fields
    valid_from      DATE NOT NULL,
    valid_to        DATE,
    is_current      BOOLEAN DEFAULT TRUE
);

-- DATE DIMENSION (pre-populate)
CREATE TABLE dim_date (
    date_sk         INT PRIMARY KEY,      -- YYYYMMDD
    date            DATE,
    year            INT,
    quarter         INT,
    month           INT,
    month_name      VARCHAR(20),
    week            INT,
    day_of_week     INT,
    day_name        VARCHAR(20),
    is_weekend      BOOLEAN,
    is_holiday      BOOLEAN
);

-- Populate date dimension
INSERT INTO dim_date
SELECT
    TO_CHAR(d, 'YYYYMMDD')::INT AS date_sk,
    d AS date,
    EXTRACT(YEAR FROM d) AS year,
    EXTRACT(QUARTER FROM d) AS quarter,
    EXTRACT(MONTH FROM d) AS month,
    TO_CHAR(d, 'Month') AS month_name,
    EXTRACT(WEEK FROM d) AS week,
    EXTRACT(DOW FROM d) AS day_of_week,
    TO_CHAR(d, 'Day') AS day_name,
    EXTRACT(DOW FROM d) IN (0, 6) AS is_weekend,
    FALSE AS is_holiday
FROM generate_series('2020-01-01'::DATE, '2030-12-31'::DATE, '1 day') AS d;
```

## 14.2 SCD Type 2 (Slowly Changing Dimensions)

```sql
-- SCD Type 2: Track historical changes with valid_from/valid_to

-- When user changes email, old record is closed and new one is opened
-- Step 1: Close old record
UPDATE dim_users
SET valid_to = CURRENT_DATE - 1, is_current = FALSE
WHERE user_id = '123' AND is_current = TRUE;

-- Step 2: Insert new record
INSERT INTO dim_users (user_sk, user_id, email, country, valid_from, valid_to, is_current)
VALUES (nextval('dim_users_seq'), '123', 'newemail@example.com', 'US', CURRENT_DATE, NULL, TRUE);

-- Query: get current state
SELECT * FROM dim_users WHERE is_current = TRUE;

-- Query: get historical state at specific date
SELECT * FROM dim_users
WHERE user_id = '123'
AND valid_from <= '2023-06-01'
AND (valid_to IS NULL OR valid_to >= '2023-06-01');
```

## 14.3 Data Vault Modeling

```sql
-- Data Vault 2.0: Hub, Link, Satellite

-- HUB: business key + metadata
CREATE TABLE hub_customer (
    customer_hk     CHAR(32) PRIMARY KEY,    -- MD5 of business key
    customer_id     VARCHAR(50) NOT NULL,
    load_date       TIMESTAMP NOT NULL,
    record_source   VARCHAR(100) NOT NULL
);

-- LINK: relationship between hubs
CREATE TABLE lnk_customer_order (
    link_hk         CHAR(32) PRIMARY KEY,
    customer_hk     CHAR(32) REFERENCES hub_customer,
    order_hk        CHAR(32) REFERENCES hub_order,
    load_date       TIMESTAMP NOT NULL,
    record_source   VARCHAR(100) NOT NULL
);

-- SATELLITE: descriptive attributes (versioned)
CREATE TABLE sat_customer_profile (
    customer_hk     CHAR(32) REFERENCES hub_customer,
    load_date       TIMESTAMP NOT NULL,
    load_end_date   TIMESTAMP,
    record_source   VARCHAR(100),
    hash_diff       CHAR(32),    -- MD5 of all attributes to detect changes
    
    email           VARCHAR(255),
    country         VARCHAR(50),
    plan            VARCHAR(50),
    
    PRIMARY KEY (customer_hk, load_date)
);
```

---

