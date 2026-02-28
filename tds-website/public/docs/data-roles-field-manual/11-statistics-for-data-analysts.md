<a name="section-11"></a>
# SECTION 11 — Statistics for Data Analysts

## 11.1 Descriptive Statistics

```python
import pandas as pd
import numpy as np
from scipy import stats

df = pd.read_csv("data/sales.csv")

# Central tendency
print("Mean:", df["revenue"].mean())
print("Median:", df["revenue"].median())
print("Mode:", df["revenue"].mode()[0])

# Spread
print("Std Dev:", df["revenue"].std())
print("Variance:", df["revenue"].var())
print("IQR:", df["revenue"].quantile(0.75) - df["revenue"].quantile(0.25))
print("Range:", df["revenue"].max() - df["revenue"].min())

# Distribution shape
print("Skewness:", df["revenue"].skew())   # >0 = right-skewed, <0 = left-skewed
print("Kurtosis:", df["revenue"].kurtosis())  # >0 = heavy tails, <0 = light tails

# Percentiles
print(df["revenue"].describe(percentiles=[0.05, 0.25, 0.5, 0.75, 0.95]))
```

## 11.2 Hypothesis Testing

```python
from scipy import stats
import numpy as np

# t-test: compare means of two groups
group_a = df[df["group"] == "A"]["revenue"]
group_b = df[df["group"] == "B"]["revenue"]

# Independent t-test (two different groups)
t_stat, p_value = stats.ttest_ind(group_a, group_b, equal_var=False)  # Welch's t-test
print(f"t-statistic: {t_stat:.4f}, p-value: {p_value:.4f}")
print("Significant (p < 0.05):", p_value < 0.05)

# Paired t-test (same users, before/after)
t_stat, p_value = stats.ttest_rel(before_values, after_values)

# Mann-Whitney U (non-parametric alternative to t-test)
stat, p = stats.mannwhitneyu(group_a, group_b, alternative="two-sided")

# Chi-square test (categorical vs categorical)
contingency = pd.crosstab(df["gender"], df["converted"])
chi2, p, dof, expected = stats.chi2_contingency(contingency)
print(f"Chi2: {chi2:.4f}, p-value: {p:.4f}, dof: {dof}")

# Normality test
stat, p = stats.shapiro(group_a[:50])  # Shapiro-Wilk (best for n < 50)
stat, p = stats.normaltest(group_a)   # D'Agostino-Pearson (n > 50)
print(f"Normal distribution (p > 0.05): {p > 0.05}")

# ANOVA: compare means across 3+ groups
groups = [df[df["segment"] == s]["revenue"] for s in df["segment"].unique()]
f_stat, p_value = stats.f_oneway(*groups)
print(f"ANOVA F: {f_stat:.4f}, p: {p_value:.4f}")
```

## 11.3 Confidence Intervals

```python
import numpy as np
from scipy import stats

def confidence_interval(data, confidence=0.95):
    n = len(data)
    mean = np.mean(data)
    se = stats.sem(data)   # standard error
    ci = stats.t.interval(confidence, df=n-1, loc=mean, scale=se)
    return mean, ci[0], ci[1]

mean, lower, upper = confidence_interval(df["revenue"])
print(f"Mean: {mean:.2f}, 95% CI: [{lower:.2f}, {upper:.2f}]")

# Bootstrap CI (distribution-free)
def bootstrap_ci(data, statistic=np.mean, n_boot=10000, ci=0.95):
    boot_stats = [statistic(np.random.choice(data, size=len(data), replace=True))
                  for _ in range(n_boot)]
    alpha = (1 - ci) / 2
    return np.percentile(boot_stats, [alpha*100, (1-alpha)*100])

lower, upper = bootstrap_ci(df["revenue"].values)
print(f"Bootstrap 95% CI: [{lower:.2f}, {upper:.2f}]")
```

## 11.4 Correlation Analysis

```python
# Pearson (linear, numeric-numeric)
r, p = stats.pearsonr(df["ad_spend"], df["revenue"])
print(f"Pearson r={r:.4f}, p={p:.4f}")

# Spearman (monotonic, handles outliers better)
r, p = stats.spearmanr(df["ad_spend"], df["revenue"])
print(f"Spearman r={r:.4f}, p={p:.4f}")

# Point-biserial (binary vs continuous)
r, p = stats.pointbiserialr(df["converted"], df["revenue"])

# Cramér's V (categorical vs categorical)
def cramers_v(x, y):
    ct = pd.crosstab(x, y)
    chi2 = stats.chi2_contingency(ct)[0]
    n = ct.sum().sum()
    return np.sqrt(chi2 / (n * (min(ct.shape) - 1)))

v = cramers_v(df["gender"], df["segment"])
print(f"Cramér's V: {v:.4f}")
```

---

