<a name="section-19"></a>
# SECTION 19 — MLOps & Model Deployment

A Machine Learning model is useless if it only lives in a Jupyter Notebook on your laptop. **MLOps** (Machine Learning Operations) is the discipline of reliably taking models from experimentation into production.

> [!NOTE]
> MLOps heavily relies on software engineering principles: Version Control (Git), CI/CD (GitHub Actions), and Containerization (Docker).

## 19.1 MLflow Experiment Tracking

```python
# pip install mlflow
import mlflow
import mlflow.sklearn
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import f1_score, roc_auc_score
import pandas as pd

mlflow.set_tracking_uri("http://localhost:5000")  # or file:./mlruns
mlflow.set_experiment("titanic-survival")

with mlflow.start_run(run_name="rf_baseline") as run:
    # Log parameters
    params = {"n_estimators": 100, "max_depth": 5, "random_state": 42}
    mlflow.log_params(params)
    
    # Train
    clf = RandomForestClassifier(**params)
    clf.fit(X_train, y_train)
    y_pred = clf.predict(X_test)
    y_proba = clf.predict_proba(X_test)[:, 1]
    
    # Log metrics
    metrics = {
        "f1": f1_score(y_test, y_pred),
        "roc_auc": roc_auc_score(y_test, y_proba),
        "train_size": len(X_train),
        "test_size": len(X_test)
    }
    mlflow.log_metrics(metrics)
    
    # Log model
    mlflow.sklearn.log_model(clf, "model",
                              registered_model_name="titanic-rf",
                              input_example=X_train.head(1))
    
    # Log artifacts
    mlflow.log_artifact("outputs/confusion_matrix.png")
    
    print(f"Run ID: {run.info.run_id}")
    print(f"F1: {metrics['f1']:.4f}, AUC: {metrics['roc_auc']:.4f}")

# Load model from registry
model = mlflow.sklearn.load_model("models:/titanic-rf/Production")
predictions = model.predict(X_new)

# Compare runs
client = mlflow.MlflowClient()
runs = client.search_runs(experiment_ids=["1"], order_by=["metrics.roc_auc DESC"])
for run in runs[:5]:
    print(f"{run.data.tags.get('mlflow.runName')}: AUC={run.data.metrics.get('roc_auc', 'N/A'):.4f}")
```

## 19.2 FastAPI Model Serving

```python
# pip install fastapi uvicorn pydantic
# Run: uvicorn src.api:app --reload

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, validator
import joblib
import pandas as pd
import numpy as np
from typing import List, Optional

app = FastAPI(title="ML Model API", version="1.0.0")
model = joblib.load("models/titanic_rf_pipeline.joblib")

class PassengerInput(BaseModel):
    pclass: int
    sex: str
    age: float
    sibsp: int
    parch: int
    fare: float
    embarked: Optional[str] = "S"
    
    @validator("pclass")
    def pclass_valid(cls, v):
        if v not in [1, 2, 3]:
            raise ValueError("pclass must be 1, 2, or 3")
        return v

class PredictionResponse(BaseModel):
    prediction: int
    probability: float
    label: str

@app.get("/health")
def health():
    return {"status": "ok", "model": "titanic-rf"}

@app.post("/predict", response_model=PredictionResponse)
def predict(passenger: PassengerInput):
    try:
        df = pd.DataFrame([passenger.dict()])
        pred = int(model.predict(df)[0])
        prob = float(model.predict_proba(df)[0][1])
        return PredictionResponse(
            prediction=pred,
            probability=round(prob, 4),
            label="Survived" if pred == 1 else "Died"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/predict/batch")
def predict_batch(passengers: List[PassengerInput]):
    df = pd.DataFrame([p.dict() for p in passengers])
    preds = model.predict(df).tolist()
    probs = model.predict_proba(df)[:, 1].tolist()
    return [{"prediction": p, "probability": round(pr, 4)} for p, pr in zip(preds, probs)]
```

## 19.3 Model Monitoring

```python
import pandas as pd
import numpy as np
from scipy.stats import ks_2samp, chi2_contingency
from typing import Dict

class ModelMonitor:
    """Monitor model inputs and outputs for drift and degradation."""
    
    def __init__(self, reference_df: pd.DataFrame):
        self.reference = reference_df
        self.alerts = []
    
    def check_data_drift(self, current_df: pd.DataFrame, threshold: float = 0.05) -> Dict:
        results = {}
        
        for col in current_df.select_dtypes(include=[np.number]).columns:
            if col not in self.reference.columns:
                continue
            stat, p_value = ks_2samp(
                self.reference[col].dropna(),
                current_df[col].dropna()
            )
            drifted = p_value < threshold
            results[col] = {"ks_stat": round(stat, 4), "p_value": round(p_value, 4), "drifted": drifted}
            if drifted:
                self.alerts.append(f"DRIFT: {col} (p={p_value:.4f})")
        
        return results
    
    def check_prediction_drift(self, ref_preds: np.ndarray, current_preds: np.ndarray):
        stat, p_value = ks_2samp(ref_preds, current_preds)
        if p_value < 0.05:
            self.alerts.append(f"PREDICTION DRIFT: p={p_value:.4f}")
        return {"ks_stat": stat, "p_value": p_value, "drifted": p_value < 0.05}
    
    def check_missing_rates(self, current_df: pd.DataFrame, threshold: float = 0.1):
        current_missing = current_df.isnull().mean()
        ref_missing = self.reference.isnull().mean()
        
        for col in current_df.columns:
            if col in ref_missing.index:
                diff = abs(current_missing[col] - ref_missing[col])
                if diff > threshold:
                    self.alerts.append(f"MISSING RATE CHANGE: {col} ({diff:.2%})")
    
    def report(self) -> str:
        if not self.alerts:
            return "✅ No issues detected"
        return "\n".join([f"⚠️ {a}" for a in self.alerts])

# Usage
monitor = ModelMonitor(reference_df=X_train)
drift = monitor.check_data_drift(X_new)
monitor.check_missing_rates(X_new)
print(monitor.report())
```

---

