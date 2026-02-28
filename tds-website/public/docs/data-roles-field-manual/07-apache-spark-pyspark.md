<a name="section-7"></a>
# SECTION 7 — Apache Spark (PySpark)

While modern warehouses (Snowflake, BigQuery) handle most SQL transformations, **Apache Spark (PySpark)** remains the standard for *massive* unstructured data processing, complex ML feature engineering, and real-time streaming.

> [!NOTE]
> Spark runs "lazily". When you apply a filter or transformation, Spark just records the plan. It only executes the query when you call an "Action" like `.show()`, `.count()`, or `.write`.

## 7.1 PySpark Setup

```python
# pip install pyspark
from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.sql import types as T

spark = SparkSession.builder \
    .appName("DataPipeline") \
    .config("spark.sql.shuffle.partitions", "200") \
    .config("spark.driver.memory", "4g") \
    .config("spark.executor.memory", "8g") \
    .getOrCreate()

# Read data
df = spark.read.parquet("s3://bucket/data/")
df = spark.read.csv("data/file.csv", header=True, inferSchema=True)
df = spark.read.json("data/file.jsonl")

# Basic operations (lazy — nothing runs until action)
df.printSchema()        # column names + types
df.show(10)             # action: show first 10 rows
df.count()              # action: count rows
df.describe().show()    # statistics
```

## 7.2 PySpark Transformations

```python
from pyspark.sql import functions as F

# Select + rename
df = df.select(
    F.col("order_id"),
    F.col("user_id"),
    F.col("amount").alias("revenue"),
    F.to_date(F.col("created_at")).alias("order_date")
)

# Filter
df_active = df.filter(F.col("status") == "active")
df_high = df.filter(F.col("amount") > 1000)

# Add columns
df = df.withColumn("revenue_usd", F.col("amount") / 100)
df = df.withColumn("order_year", F.year(F.col("order_date")))
df = df.withColumn(
    "tier",
    F.when(F.col("amount") > 10000, "premium")
     .when(F.col("amount") > 1000, "standard")
     .otherwise("basic")
)

# GroupBy
summary = df.groupBy("region", "tier").agg(
    F.count("order_id").alias("order_count"),
    F.sum("amount").alias("total_revenue"),
    F.avg("amount").alias("avg_revenue"),
    F.countDistinct("user_id").alias("unique_users")
)

# Window functions
from pyspark.sql.window import Window

window = Window.partitionBy("user_id").orderBy("order_date")
df = df.withColumn("order_num", F.row_number().over(window))
df = df.withColumn("prev_order_amount", F.lag("amount", 1).over(window))
df = df.withColumn("cumulative_spend", F.sum("amount").over(
    window.rowsBetween(Window.unboundedPreceding, Window.currentRow)
))

# Join
df_users = spark.read.parquet("data/users/")
df_joined = df.join(df_users, on="user_id", how="left")

# Broadcast join (for small lookup tables)
from pyspark.sql.functions import broadcast
df_joined = df.join(broadcast(df_small_lookup), on="category_id")

# Repartition (for better parallelism before write)
df = df.repartition(100, "date")   # 100 partitions, sorted by date
df = df.coalesce(10)               # reduce partitions (no shuffle)
```

## 7.3 PySpark SQL

```python
# Register as temp view and use SQL
df.createOrReplaceTempView("orders")

result = spark.sql("""
    SELECT
        region,
        DATE_FORMAT(order_date, 'yyyy-MM') AS month,
        COUNT(DISTINCT user_id) AS dau,
        SUM(amount) AS revenue,
        SUM(amount) / COUNT(*) AS aov
    FROM orders
    WHERE status = 'completed'
    GROUP BY 1, 2
    ORDER BY 2, 1
""")
result.show()
```

## 7.4 Writing Data

```python
# Write to parquet (partitioned)
df.write \
    .mode("overwrite") \
    .partitionBy("year", "month") \
    .parquet("s3://bucket/output/orders/")

# Write to Delta Lake
df.write.format("delta").mode("overwrite").save("s3://bucket/delta/orders/")

# Write to single file (careful with large data)
df.coalesce(1).write.csv("output/result.csv", header=True, mode="overwrite")

# Write to database
df.write \
    .format("jdbc") \
    .option("url", "jdbc:postgresql://host:5432/db") \
    .option("dbtable", "schema.table") \
    .option("user", "user") \
    .option("password", "pass") \
    .mode("append") \
    .save()
```

## 7.5 Performance Tips

```python
# 1. Cache frequently reused DataFrames
df.cache()      # lazy: cached on first action
df.persist()    # more control over storage level
df.unpersist()  # free memory

# 2. Avoid UDFs (use built-in F. functions)
# BAD:
def my_func(x):
    return x * 2
udf_func = F.udf(my_func, T.DoubleType())
df = df.withColumn("doubled", udf_func("amount"))

# GOOD (built-in, runs in JVM):
df = df.withColumn("doubled", F.col("amount") * 2)

# 3. Enable AQE (Adaptive Query Execution) - Spark 3+
spark.conf.set("spark.sql.adaptive.enabled", "true")
spark.conf.set("spark.sql.adaptive.coalescePartitions.enabled", "true")

# 4. Check query plan
df.explain(True)   # physical + logical plan

# 5. Skew handling
# If one partition key has many more rows (data skew), add salt
import random
df = df.withColumn("salt", (F.rand() * 100).cast("int"))
df = df.withColumn("salted_key", F.concat(F.col("skewed_key"), F.col("salt")))
```

---

