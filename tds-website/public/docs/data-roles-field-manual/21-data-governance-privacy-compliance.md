<a name="section-21"></a>
# SECTION 21 — Data Governance, Privacy & Compliance

## 21.1 PII Detection and Masking

```python
import re
import hashlib
import pandas as pd

# PII patterns
PII_PATTERNS = {
    "email": r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b",
    "phone_us": r"\b(?:\+1)?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b",
    "ssn": r"\b\d{3}-\d{2}-\d{4}\b",
    "credit_card": r"\b(?:\d{4}[-\s]?){3}\d{4}\b",
    "ip_address": r"\b(?:\d{1,3}\.){3}\d{1,3}\b"
}

def detect_pii(text: str) -> dict:
    findings = {}
    for pii_type, pattern in PII_PATTERNS.items():
        matches = re.findall(pattern, str(text), re.IGNORECASE)
        if matches:
            findings[pii_type] = matches
    return findings

def mask_pii(text: str, replacement: str = "[REDACTED]") -> str:
    masked = str(text)
    for pii_type, pattern in PII_PATTERNS.items():
        masked = re.sub(pattern, replacement, masked, flags=re.IGNORECASE)
    return masked

def pseudonymize(value: str, salt: str = "your-secret-salt") -> str:
    """One-way hash for pseudonymization (reversible with salt, but not obvious)."""
    return hashlib.sha256(f"{salt}{value}".encode()).hexdigest()[:16]

def tokenize_pii_dataframe(df: pd.DataFrame, pii_columns: list) -> pd.DataFrame:
    df = df.copy()
    for col in pii_columns:
        df[f"{col}_original"] = df[col]
        df[col] = df[col].apply(lambda x: pseudonymize(str(x)) if pd.notna(x) else x)
    return df

# Scan entire DataFrame for PII
def scan_dataframe_for_pii(df: pd.DataFrame) -> pd.DataFrame:
    results = []
    for col in df.columns:
        sample = df[col].dropna().head(100).astype(str)
        pii_found = {}
        for val in sample:
            pii = detect_pii(val)
            for k, v in pii.items():
                pii_found.setdefault(k, []).extend(v)
        if pii_found:
            results.append({"column": col, "pii_types": list(pii_found.keys()),
                            "sample_count": len(pii_found)})
    return pd.DataFrame(results)
```

## 21.2 GDPR / CCPA Compliance Patterns

```python
# Right to deletion (RTBF — Right to be Forgotten)
def delete_user_data(user_id: str, engine) -> dict:
    """Delete or anonymize all user data across tables."""
    from sqlalchemy import text
    deleted_records = {}
    
    with engine.connect() as conn:
        # Hard delete from non-essential tables
        for table in ["events", "sessions", "user_logs"]:
            result = conn.execute(text(f"DELETE FROM {table} WHERE user_id = :uid"), {"uid": user_id})
            deleted_records[table] = result.rowcount
        
        # Anonymize instead of delete where you need to keep aggregate integrity
        conn.execute(text("""
            UPDATE orders
            SET user_id = 'DELETED', email = 'deleted@deleted.com',
                name = 'Deleted User', ip_address = NULL
            WHERE user_id = :uid
        """), {"uid": user_id})
        
        conn.commit()
    
    return deleted_records

# Data retention policy
def apply_retention_policy(df: pd.DataFrame, date_col: str, retention_days: int) -> pd.DataFrame:
    cutoff = pd.Timestamp.now() - pd.Timedelta(days=retention_days)
    before = len(df)
    df = df[df[date_col] >= cutoff]
    print(f"Retention policy: removed {before - len(df)} rows older than {retention_days} days")
    return df

# Consent tracking
def check_user_consent(user_id: str, purpose: str, engine) -> bool:
    """Check if user has given consent for a specific data processing purpose."""
    from sqlalchemy import text
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT consented FROM user_consents
            WHERE user_id = :uid AND purpose = :purpose
            AND consent_date >= NOW() - INTERVAL '1 year'
        """), {"uid": user_id, "purpose": purpose})
        row = result.fetchone()
        return bool(row and row[0])
```

---

