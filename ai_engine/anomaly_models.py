import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import IsolationForest
from tensorflow.keras.models import Model
from tensorflow.keras.layers import Input, Dense

def detect_anomalies(df):
    features = df[["Cost", "Usage", "Cost_Change", "Rolling_Avg"]]

    scaler = StandardScaler()
    X = scaler.fit_transform(features)

    # ==============================
    # Isolation Forest
    # ==============================
    iso = IsolationForest(contamination=0.05, random_state=42)
    df["IF_Anomaly"] = iso.fit_predict(X)
    df["IF_Anomaly"] = df["IF_Anomaly"].map({1: 0, -1: 1})

    # ==============================
    # Autoencoder
    # ==============================
    input_dim = X.shape[1]
    inp = Input(shape=(input_dim,))
    encoded = Dense(8, activation="relu")(inp)
    encoded = Dense(4, activation="relu")(encoded)
    decoded = Dense(8, activation="relu")(encoded)
    decoded = Dense(input_dim, activation="linear")(decoded)

    autoencoder = Model(inp, decoded)
    autoencoder.compile(optimizer="adam", loss="mse")
    autoencoder.fit(X, X, epochs=40, batch_size=16, verbose=0)

    recon = autoencoder.predict(X, verbose=0)
    error = np.mean(np.square(X - recon), axis=1)
    threshold = np.percentile(error, 95)

    df["AE_Anomaly"] = (error > threshold).astype(int)

    df["Final_Anomaly"] = ((df["IF_Anomaly"] == 1) |
                           (df["AE_Anomaly"] == 1)).astype(int)

    # ==============================
    # SHAP Explainability (Technical & Accessible)
    # ==============================
    import shap
    import math
    
    feature_names = ["Cost", "Usage", "Cost_Change", "Rolling_Avg"]
    avg_cost = df["Cost"].mean()
    avg_usage = df["Usage"].mean()
    
    explanations = []

    try:
        # Use a small background dataset for speed
        background = X[np.random.choice(X.shape[0], min(100, X.shape[0]), replace=False)]

        # Explain the Isolation Forest decisions
        explainer = shap.Explainer(iso.predict, background)
        shap_values = explainer(X)

        for i in range(len(df)):
            if df["Final_Anomaly"].iloc[i] == 1:
                row = df.iloc[i]
                impacts = shap_values.values[i]
                
                # Calculate real-time metrics for technical context
                c_change = row["Cost_Change"]
                r_dev = ((row["Cost"] - row["Rolling_Avg"]) / row["Rolling_Avg"] * 100) if row["Rolling_Avg"] > 0 else 0
                cost_ratio = round(row["Cost"] / avg_cost, 1) if avg_cost > 0 else 0
                usage_ratio = round(row["Usage"] / avg_usage, 1) if avg_usage > 0 else 0
                
                c_chg_str = "an extreme multi-fold cost spike" if math.isinf(c_change) or c_change > 5 else f"a +{int(c_change * 100)}% day-over-day cost spike"
                r_dev_str = "exceptional trend deviation" if math.isinf(r_dev) or r_dev > 500 else f"a +{int(r_dev)}% deviation from the 7-day rolling average"
                
                # Map raw ML features directly to the row's statistical realities
                feature_to_human_text = {
                    "Cost": f"an unusually high absolute cost ({cost_ratio}x the baseline average)",
                    "Usage": f"abnormal service usage capacity ({usage_ratio}x the baseline average)",
                    "Cost_Change": c_chg_str,
                    "Rolling_Avg": r_dev_str
                }
                
                # Features with the most absolute impact explain the variance from the norm.
                top_idx = np.argsort(np.abs(impacts))[-2:]
                
                primary_factor = feature_to_human_text[feature_names[top_idx[-1]]]
                secondary_factor = feature_to_human_text[feature_names[top_idx[-2]]]
                
                # Construct a highly technical but understandable XAI explanation
                reason = f"Feature-attribution identified {primary_factor} alongside {secondary_factor} as the statistical drivers of this anomaly."
                explanations.append(reason)
            else:
                explanations.append("Normal usage pattern")

    except Exception as e:
        explanations = ["Explanation unavailable"] * len(df)

    df["XAI_Reason"] = explanations
    return df