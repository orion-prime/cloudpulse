import pandas as pd

def load_and_preprocess(path):
    df = pd.read_csv(path)

    df.rename(columns={
        "Usage Start Date": "Date",
        "Service Name": "Service",
        "Usage Quantity": "Usage",
        "Total Cost (INR)": "Cost",
        "CPU Utilization (%)": "CPU",
        "Memory Utilization (%)": "Memory"
    }, inplace=True)

    df["Date"] = pd.to_datetime(
        df["Date"],
        format="mixed",
        dayfirst=True,
        errors="coerce"
    )

    df.dropna(subset=["Date"], inplace=True)

    daily = df.groupby("Date").agg({
        "Cost": "sum",
        "Usage": "sum",
        "CPU": "mean",
        "Memory": "mean"
    }).reset_index()

    daily["Cost_Change"] = daily["Cost"].pct_change().fillna(0)
    daily["Rolling_Avg"] = daily["Cost"].rolling(7).mean().fillna(method="bfill")

    return daily
