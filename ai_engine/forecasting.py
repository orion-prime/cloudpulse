import numpy as np

def forecast_cost(df, days=30):
    df["Index"] = range(len(df))
    coef = np.polyfit(df["Index"], df["Cost"], 1)

    future_index = np.arange(len(df), len(df) + days)
    forecast = coef[0] * future_index + coef[1]

    return forecast
