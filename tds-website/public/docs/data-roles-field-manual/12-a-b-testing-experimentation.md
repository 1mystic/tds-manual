<a name="section-12"></a>
# SECTION 12 — A/B Testing & Experimentation

## 12.1 Sample Size Calculation

```python
from scipy import stats
import numpy as np

def calculate_sample_size(
    baseline_rate: float,
    min_detectable_effect: float,
    alpha: float = 0.05,
    power: float = 0.80
) -> int:
    """
    Calculate required sample size per group for a proportion A/B test.
    
    baseline_rate: current conversion rate (e.g., 0.05 for 5%)
    min_detectable_effect: smallest change worth detecting (e.g., 0.01 = 1pp)
    alpha: significance level (Type I error rate)
    power: 1 - beta (Type II error rate)
    """
    p1 = baseline_rate
    p2 = baseline_rate + min_detectable_effect
    
    z_alpha = stats.norm.ppf(1 - alpha / 2)   # two-tailed
    z_beta = stats.norm.ppf(power)
    
    p_bar = (p1 + p2) / 2
    
    n = (z_alpha * np.sqrt(2 * p_bar * (1 - p_bar)) +
         z_beta * np.sqrt(p1 * (1-p1) + p2 * (1-p2)))**2 / (p2 - p1)**2
    
    return int(np.ceil(n))

n = calculate_sample_size(baseline_rate=0.05, min_detectable_effect=0.01)
print(f"Required sample size per group: {n:,}")
print(f"Total users needed: {n*2:,}")
```

## 12.2 Running the Test

```python
import pandas as pd
import numpy as np
from scipy import stats

# Load experiment data
# Expected columns: user_id, group (control/treatment), converted (0/1), revenue
exp_df = pd.read_csv("data/experiment_results.csv")

# Sanity checks
print("Group distribution:")
print(exp_df["group"].value_counts())
print("\nConversion rates:")
print(exp_df.groupby("group")["converted"].mean())

# Check for SRM (Sample Ratio Mismatch)
control_n = (exp_df["group"] == "control").sum()
treatment_n = (exp_df["group"] == "treatment").sum()
total_n = len(exp_df)
expected_n = total_n / 2
chi2_srm = ((control_n - expected_n)**2 / expected_n +
             (treatment_n - expected_n)**2 / expected_n)
p_srm = 1 - stats.chi2.cdf(chi2_srm, df=1)
if p_srm < 0.01:
    print(f"⚠️ SRM DETECTED! p={p_srm:.4f} — randomization may be broken")

# Two-proportion z-test (conversion rate)
control = exp_df[exp_df["group"] == "control"]["converted"]
treatment = exp_df[exp_df["group"] == "treatment"]["converted"]

n_c, n_t = len(control), len(treatment)
conv_c, conv_t = control.mean(), treatment.mean()

# Pooled z-test
p_pool = (control.sum() + treatment.sum()) / (n_c + n_t)
se = np.sqrt(p_pool * (1-p_pool) * (1/n_c + 1/n_t))
z_stat = (conv_t - conv_c) / se
p_value = 2 * (1 - stats.norm.cdf(abs(z_stat)))

print(f"\n{'='*40}")
print(f"A/B TEST RESULTS")
print(f"{'='*40}")
print(f"Control conversion:   {conv_c:.4f} (n={n_c:,})")
print(f"Treatment conversion: {conv_t:.4f} (n={n_t:,})")
print(f"Relative lift: {(conv_t - conv_c) / conv_c:.2%}")
print(f"Absolute lift: {conv_t - conv_c:.4f} ({(conv_t - conv_c)*100:.2f} pp)")
print(f"Z-statistic: {z_stat:.4f}")
print(f"P-value: {p_value:.6f}")
print(f"Significant: {'YES ✅' if p_value < 0.05 else 'NO ❌'}")
```

## 12.3 Confidence Intervals for A/B Test

```python
# CI for the lift
def ab_test_ci(conv_c, n_c, conv_t, n_t, alpha=0.05):
    diff = conv_t - conv_c
    se = np.sqrt(conv_c*(1-conv_c)/n_c + conv_t*(1-conv_t)/n_t)
    z = stats.norm.ppf(1 - alpha/2)
    ci_low = diff - z * se
    ci_high = diff + z * se
    return diff, ci_low, ci_high

diff, ci_low, ci_high = ab_test_ci(conv_c, n_c, conv_t, n_t)
print(f"Absolute lift: {diff:.4f} [{ci_low:.4f}, {ci_high:.4f}]")

# Revenue t-test (continuous metric)
rev_c = exp_df[exp_df["group"] == "control"]["revenue"]
rev_t = exp_df[exp_df["group"] == "treatment"]["revenue"]
t_stat, p_val = stats.ttest_ind(rev_t, rev_c, equal_var=False)
print(f"\nRevenue per user — Control: ${rev_c.mean():.2f}, Treatment: ${rev_t.mean():.2f}")
print(f"t={t_stat:.4f}, p={p_val:.4f}")
```

## 12.4 Multiple Testing Correction

```python
from statsmodels.stats.multitest import multipletests

# If testing multiple metrics or segments
p_values = [0.03, 0.04, 0.01, 0.06, 0.02, 0.08]  # p-values from multiple tests

# Bonferroni (very conservative)
reject_bonf, pvals_corrected, _, _ = multipletests(p_values, method="bonferroni")

# Benjamini-Hochberg (FDR control — recommended)
reject_bh, pvals_corrected_bh, _, _ = multipletests(p_values, method="fdr_bh")

for i, (p, r_b, r_bh) in enumerate(zip(p_values, reject_bonf, reject_bh)):
    print(f"Test {i+1}: p={p:.3f} | Bonferroni: {'✅' if r_b else '❌'} | BH-FDR: {'✅' if r_bh else '❌'}")
```

---

