<a name="section-13"></a>
# SECTION 13 — Time Series Analysis

## 13.1 Time Series Basics

```python
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from statsmodels.tsa.seasonal import seasonal_decompose
from statsmodels.tsa.stattools import adfuller

# Load and set time index
df = pd.read_csv("data/daily_revenue.csv", parse_dates=["date"], index_col="date")
ts = df["revenue"]

# Resample to different frequencies
weekly = ts.resample("W").sum()
monthly = ts.resample("ME").mean()

# Decompose: Trend + Seasonality + Residual
decomposition = seasonal_decompose(ts, model="additive", period=7)  # weekly seasonality
fig, (ax1, ax2, ax3, ax4) = plt.subplots(4, 1, figsize=(12, 8))
decomposition.observed.plot(ax=ax1, title="Observed")
decomposition.trend.plot(ax=ax2, title="Trend")
decomposition.seasonal.plot(ax=ax3, title="Seasonal")
decomposition.resid.plot(ax=ax4, title="Residual")
plt.tight_layout()
plt.show()

# Stationarity test (ADF)
result = adfuller(ts.dropna())
print(f"ADF Statistic: {result[0]:.4f}")
print(f"P-value: {result[1]:.4f}")
print(f"Stationary: {result[1] < 0.05}")

# Make stationary via differencing
ts_diff = ts.diff().dropna()
ts_log_diff = np.log(ts).diff().dropna()
```

## 13.2 Rolling Statistics

```python
# Rolling stats (moving window)
ts_df = ts.to_frame("revenue")
ts_df["rolling_mean_7d"] = ts.rolling(window=7).mean()
ts_df["rolling_std_7d"] = ts.rolling(window=7).std()
ts_df["rolling_mean_30d"] = ts.rolling(window=30).mean()
ts_df["ewm_7d"] = ts.ewm(span=7).mean()   # exponential weighted

# Lag features for ML
for lag in [1, 7, 14, 30]:
    ts_df[f"lag_{lag}"] = ts.shift(lag)

# Rolling on grouped data
df["rolling_user_avg"] = df.groupby("user_id")["amount"].transform(
    lambda x: x.rolling(7, min_periods=1).mean()
)
```

## 13.3 Prophet Forecasting

```python
# pip install prophet
from prophet import Prophet
import pandas as pd

# Prophet expects df with columns 'ds' (datetime) and 'y' (value)
prophet_df = df.reset_index().rename(columns={"date": "ds", "revenue": "y"})

model = Prophet(
    yearly_seasonality=True,
    weekly_seasonality=True,
    daily_seasonality=False,
    seasonality_mode="multiplicative",  # or "additive"
    changepoint_prior_scale=0.05,       # flexibility of trend
    interval_width=0.95                 # confidence interval
)

# Add holidays
from prophet.make_holidays import make_holidays_df
holidays = make_holidays_df(year_list=[2023, 2024], country="US")
model = Prophet(holidays=holidays)

# Add custom seasonality
model.add_seasonality(name="monthly", period=30.5, fourier_order=5)

# Add regressor (external variable)
model.add_regressor("promo_flag")
prophet_df["promo_flag"] = 0  # set your actual promo flags

model.fit(prophet_df)

# Forecast 90 days
future = model.make_future_dataframe(periods=90, freq="D")
future["promo_flag"] = 0   # set regressors for future
forecast = model.predict(future)

# Components
fig1 = model.plot(forecast)
fig2 = model.plot_components(forecast)
plt.show()

# Evaluate
from prophet.diagnostics import cross_validation, performance_metrics
df_cv = cross_validation(model, initial="365 days", period="30 days", horizon="90 days")
df_perf = performance_metrics(df_cv)
print(df_perf[["horizon", "mae", "rmse", "mape"]].tail(10))
```

## 13.4 ARIMA

```python
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.graphics.tsaplots import plot_acf, plot_pacf
import warnings
warnings.filterwarnings("ignore")

# Check ACF and PACF to determine p, d, q
fig, axes = plt.subplots(1, 2, figsize=(12, 4))
plot_acf(ts.dropna(), lags=30, ax=axes[0])
plot_pacf(ts.dropna(), lags=30, ax=axes[1])
plt.show()

# Fit ARIMA(p=1, d=1, q=1)
model = ARIMA(ts, order=(1, 1, 1))
result = model.fit()
print(result.summary())

# Forecast
forecast = result.forecast(steps=30)
conf_int = result.get_forecast(steps=30).conf_int()

plt.figure(figsize=(12, 5))
plt.plot(ts, label="Observed")
plt.plot(forecast.index, forecast, label="Forecast", color="red")
plt.fill_between(conf_int.index, conf_int.iloc[:, 0], conf_int.iloc[:, 1],
                 alpha=0.3, color="red")
plt.legend()
plt.show()
```

---

