<a name="section-10"></a>
# SECTION 10 — Business Intelligence & Dashboards

## 10.1 Streamlit (Python Dashboards)

```python
# pip install streamlit plotly
# Run with: streamlit run dashboard.py

import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from datetime import datetime, timedelta

st.set_page_config(page_title="Sales Dashboard", layout="wide", page_icon="📊")

# Sidebar filters
st.sidebar.header("Filters")
date_range = st.sidebar.date_input(
    "Date Range",
    value=[datetime.now() - timedelta(days=30), datetime.now()]
)
regions = st.sidebar.multiselect("Regions", ["North", "South", "East", "West"], default=["North", "South"])

@st.cache_data(ttl=3600)  # cache for 1 hour
def load_data():
    # Replace with actual DB query
    dates = pd.date_range("2024-01-01", periods=180, freq="D")
    df = pd.DataFrame({
        "date": dates,
        "revenue": (10000 + pd.Series(range(180)) * 50 + pd.Series([abs(i) for i in range(-90, 90)]) * 20).values,
        "orders": pd.Series(range(180)) + 100,
        "region": ["North", "South", "East", "West"] * 45
    })
    return df

df = load_data()
df_filtered = df[df["region"].isin(regions)]

# KPI metrics
col1, col2, col3, col4 = st.columns(4)
col1.metric("Total Revenue", f"${df_filtered['revenue'].sum():,.0f}", delta="+12%")
col2.metric("Total Orders", f"{df_filtered['orders'].sum():,}", delta="+8%")
col3.metric("Avg Order Value", f"${df_filtered['revenue'].sum()/df_filtered['orders'].sum():.0f}")
col4.metric("Active Regions", len(regions))

st.divider()

# Charts
col_left, col_right = st.columns(2)

with col_left:
    st.subheader("Revenue Over Time")
    fig = px.line(df_filtered, x="date", y="revenue", color="region",
                  template="plotly_white")
    st.plotly_chart(fig, use_container_width=True)

with col_right:
    st.subheader("Revenue by Region")
    region_total = df_filtered.groupby("region")["revenue"].sum().reset_index()
    fig2 = px.bar(region_total, x="region", y="revenue",
                  color="region", template="plotly_white")
    st.plotly_chart(fig2, use_container_width=True)

# Data table
with st.expander("📋 Raw Data"):
    st.dataframe(df_filtered, use_container_width=True)
    csv = df_filtered.to_csv(index=False).encode("utf-8")
    st.download_button("Download CSV", csv, "data.csv", "text/csv")
```

## 10.2 Plotly Charts Cheatsheet

```python
import plotly.express as px
import plotly.graph_objects as go

# Line chart
fig = px.line(df, x="date", y="revenue", color="region",
              title="Revenue by Region", template="plotly_white")
fig.update_xaxes(rangeslider_visible=True)
fig.show()

# Bar chart (grouped and stacked)
px.bar(df, x="month", y="revenue", color="product",
       barmode="group",   # or "stack"
       template="plotly_white")

# Scatter with size and color
px.scatter(df, x="spend", y="revenue", color="region",
           size="orders", hover_data=["customer_id"],
           trendline="ols")  # OLS regression line

# Heatmap
px.imshow(corr_matrix, color_continuous_scale="RdBu_r", zmin=-1, zmax=1)

# Histogram
px.histogram(df, x="amount", nbins=50, color="status",
             marginal="box")  # box plot on top

# Pie
px.pie(df, values="revenue", names="region", hole=0.3)  # hole=0.3 for donut

# Treemap
px.treemap(df, path=["region", "product"], values="revenue", color="margin")

# Funnel
px.funnel(df, x="count", y="stage")

# Multiple y-axes
fig = go.Figure()
fig.add_trace(go.Bar(x=df["month"], y=df["orders"], name="Orders", yaxis="y"))
fig.add_trace(go.Scatter(x=df["month"], y=df["revenue"], name="Revenue", yaxis="y2"))
fig.update_layout(yaxis2=dict(overlaying="y", side="right"))
```

## 10.3 Key Metrics Every Analyst Builds

```python
import pandas as pd

# DAU / MAU / WAU
def compute_engagement_metrics(events_df):
    """
    events_df must have: user_id, event_date
    """
    events_df["event_date"] = pd.to_datetime(events_df["event_date"])
    events_df["week"] = events_df["event_date"].dt.to_period("W")
    events_df["month"] = events_df["event_date"].dt.to_period("M")
    
    dau = events_df.groupby("event_date")["user_id"].nunique().rename("DAU")
    wau = events_df.groupby("week")["user_id"].nunique().rename("WAU")
    mau = events_df.groupby("month")["user_id"].nunique().rename("MAU")
    
    return dau, wau, mau

# Cohort Retention
def compute_cohort_retention(df):
    df["signup_month"] = pd.to_datetime(df["signup_date"]).dt.to_period("M")
    df["activity_month"] = pd.to_datetime(df["activity_date"]).dt.to_period("M")
    df["months_since_signup"] = (df["activity_month"] - df["signup_month"]).apply(lambda x: x.n)
    
    cohort_size = df.groupby("signup_month")["user_id"].nunique().rename("cohort_size")
    retention = df.groupby(["signup_month", "months_since_signup"])["user_id"].nunique()
    retention = retention.reset_index()
    retention = retention.merge(cohort_size.reset_index(), on="signup_month")
    retention["retention_rate"] = retention["user_id"] / retention["cohort_size"]
    
    pivot = retention.pivot(index="signup_month", columns="months_since_signup", values="retention_rate")
    return pivot

# Customer LTV
def compute_ltv(orders_df, periods=12):
    orders_df["date"] = pd.to_datetime(orders_df["date"])
    monthly = orders_df.groupby([
        "user_id",
        orders_df["date"].dt.to_period("M")
    ])["amount"].sum().reset_index()
    
    ltv = monthly.groupby("user_id")["amount"].agg(
        total_ltv="sum",
        avg_monthly="mean",
        months_active="count"
    ).reset_index()
    
    return ltv

# Churn Rate
def compute_churn(df, lookback_days=30):
    cutoff = pd.Timestamp.now() - pd.Timedelta(days=lookback_days)
    active_last_period = df[df["last_active"] >= cutoff - pd.Timedelta(days=lookback_days)]["user_id"]
    active_this_period = df[df["last_active"] >= cutoff]["user_id"]
    churned = set(active_last_period) - set(active_this_period)
    return len(churned) / len(active_last_period) if len(active_last_period) > 0 else 0
```

---

