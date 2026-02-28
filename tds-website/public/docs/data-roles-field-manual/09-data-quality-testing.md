<a name="section-9"></a>
# SECTION 9 — Data Quality & Testing

"Garbage in, garbage out." If you surface incorrect data to executives, you lose trust. In 2026, data testing is treated identically to software unit testing.

1. **Schema tests**: Ensure column names/types haven't changed.
2. **Freshness tests**: Ensure data has loaded today.
3. **Logic tests**: `revenue` cannot be negative; `user_id` must be unique.

## 9.1 Great Expectations

```python
# pip install great-expectations
import great_expectations as gx
import pandas as pd

context = gx.get_context()

# Create data source
data_source = context.sources.add_pandas("my_source")
data_asset = data_source.add_dataframe_asset("orders")

batch_request = data_asset.build_batch_request(dataframe=df)

# Create expectation suite
suite = context.add_or_update_expectation_suite("orders_suite")

validator = context.get_validator(batch_request=batch_request, expectation_suite=suite)

# Add expectations
validator.expect_column_to_exist("order_id")
validator.expect_column_values_to_not_be_null("order_id")
validator.expect_column_values_to_be_unique("order_id")
validator.expect_column_values_to_not_be_null("user_id")
validator.expect_column_values_to_be_in_set("status", ["active", "completed", "cancelled"])
validator.expect_column_values_to_be_between("amount", min_value=0, max_value=1_000_000)
validator.expect_column_values_to_match_regex("email", r"^[^@]+@[^@]+\.[^@]+$")
validator.expect_table_row_count_to_be_between(min_value=1000, max_value=10_000_000)
validator.expect_column_mean_to_be_between("amount", min_value=10, max_value=500)

# Save and validate
validator.save_expectation_suite()
results = validator.validate()
print(f"Success: {results.success}")
print(f"Failed expectations: {results.statistics['unsuccessful_expectations']}")
```

## 9.2 Custom Data Quality Checks

```python
import pandas as pd
import numpy as np
from dataclasses import dataclass
from typing import List, Callable, Any

@dataclass
class QualityCheck:
    name: str
    passed: bool
    message: str
    severity: str = "error"  # "error" or "warning"

def run_quality_checks(df: pd.DataFrame) -> List[QualityCheck]:
    checks = []
    
    # Completeness
    for col in ["order_id", "user_id", "amount"]:
        null_pct = df[col].isnull().mean()
        checks.append(QualityCheck(
            name=f"{col}_not_null",
            passed=null_pct == 0,
            message=f"{col}: {null_pct:.1%} null values"
        ))
    
    # Uniqueness
    dup_count = df["order_id"].duplicated().sum()
    checks.append(QualityCheck(
        name="order_id_unique",
        passed=dup_count == 0,
        message=f"order_id: {dup_count} duplicates found"
    ))
    
    # Range
    neg_amount = (df["amount"] < 0).sum()
    checks.append(QualityCheck(
        name="amount_positive",
        passed=neg_amount == 0,
        message=f"amount: {neg_amount} negative values"
    ))
    
    # Freshness
    latest = df["created_at"].max()
    hours_old = (pd.Timestamp.now() - pd.to_datetime(latest)).total_seconds() / 3600
    checks.append(QualityCheck(
        name="data_freshness",
        passed=hours_old < 25,
        message=f"Latest record is {hours_old:.1f} hours old",
        severity="warning" if hours_old < 48 else "error"
    ))
    
    # Volume
    checks.append(QualityCheck(
        name="minimum_rows",
        passed=len(df) >= 100,
        message=f"Table has {len(df)} rows (minimum: 100)"
    ))
    
    return checks

def print_quality_report(checks: List[QualityCheck]):
    errors = [c for c in checks if not c.passed and c.severity == "error"]
    warnings = [c for c in checks if not c.passed and c.severity == "warning"]
    passed = [c for c in checks if c.passed]
    
    print(f"\n{'='*50}")
    print(f"DATA QUALITY REPORT")
    print(f"{'='*50}")
    print(f"✅ Passed:   {len(passed)}")
    print(f"⚠️  Warnings: {len(warnings)}")
    print(f"❌ Errors:   {len(errors)}")
    
    for c in checks:
        icon = "✅" if c.passed else ("⚠️" if c.severity == "warning" else "❌")
        print(f"  {icon} {c.name}: {c.message}")
    
    if errors:
        raise ValueError(f"Data quality failed: {len(errors)} errors")

checks = run_quality_checks(df)
print_quality_report(checks)
```

## 9.3 Testing ETL with pytest

```python
# tests/test_transform.py
import pytest
import pandas as pd
import numpy as np
from src.transform import clean_orders, compute_metrics

@pytest.fixture
def sample_orders():
    return pd.DataFrame({
        "order_id": [1, 2, 3, None, 5],
        "user_id": [10, 20, 30, 40, 50],
        "amount": [100.0, -5.0, 200.0, 150.0, 300.0],
        "status": ["completed", "completed", "cancelled", "completed", "completed"],
        "created_at": pd.date_range("2024-01-01", periods=5)
    })

def test_removes_null_order_ids(sample_orders):
    result = clean_orders(sample_orders)
    assert result["order_id"].isnull().sum() == 0

def test_removes_negative_amounts(sample_orders):
    result = clean_orders(sample_orders)
    assert (result["amount"] < 0).sum() == 0

def test_output_columns(sample_orders):
    result = clean_orders(sample_orders)
    expected_cols = ["order_id", "user_id", "amount", "status", "created_at"]
    assert all(col in result.columns for col in expected_cols)

def test_metrics_calculation(sample_orders):
    clean = clean_orders(sample_orders)
    metrics = compute_metrics(clean)
    assert metrics["total_revenue"] == clean["amount"].sum()
    assert metrics["order_count"] == len(clean)

def test_empty_dataframe_handling():
    empty_df = pd.DataFrame(columns=["order_id", "user_id", "amount"])
    result = clean_orders(empty_df)
    assert len(result) == 0

# Run with: pytest tests/ -v --tb=short
```

---

