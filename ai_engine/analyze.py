import os
import sys
import json
import pandas as pd
from contextlib import contextmanager

# ------------------------------------
# Silence TensorFlow & ML logs
# ------------------------------------
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"

@contextmanager
def suppress_stdout():
    """Temporarily suppress stdout (for ML frameworks)."""
    with open(os.devnull, "w") as devnull:
        old_stdout = sys.stdout
        sys.stdout = devnull
        try:
            yield
        finally:
            sys.stdout = old_stdout

# ------------------------------------
# Safe imports (after silencing logs)
# ------------------------------------
from preprocessing import load_and_preprocess
from anomaly_models import detect_anomalies
from recommendations import generate_recommendations
from forecasting import forecast_cost

# ------------------------------------
# Argument validation
# ------------------------------------
if len(sys.argv) < 2:
    print(json.dumps({
        "error": "CSV file path not provided"
    }))
    sys.exit(1)

csv_path = sys.argv[1]

# ------------------------------------
# Run AI pipeline (silenced)
# ------------------------------------
with suppress_stdout():
    df = load_and_preprocess(csv_path)
    df = detect_anomalies(df)
    df = generate_recommendations(df)
    forecast = forecast_cost(df)

# ------------------------------------
# JSON-safe conversion
# ------------------------------------
df["Date"] = df["Date"].astype(str)

anomaly_df = df[df["Final_Anomaly"] == 1].copy()

anomaly_df["Cost"] = anomaly_df["Cost"].round(0).astype(int)
anomaly_df["Estimated_Saving_INR"] = anomaly_df["Estimated_Saving_INR"].round(0).astype(int)

anomalies = anomaly_df[[
    "Date",
    "Cost",
    "Estimated_Saving_INR",
    "Severity",
    "Recommendation",
    "XAI_Reason"
]].to_dict(orient="records")


result = {
    "total_spend": int(round(df["Cost"].sum(), 0)),
    "anomaly_spend": int(round(df[df["Final_Anomaly"] == 1]["Cost"].sum(), 0)),
    "estimated_savings": int(round(df["Estimated_Saving_INR"].sum(), 0)),
    "anomalies": anomalies,
    "forecast": [int(round(x, 0)) for x in forecast]
}

# ------------------------------------
# OUTPUT: JSON ONLY (Node-safe)
# ------------------------------------
print(json.dumps(result))
