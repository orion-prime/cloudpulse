def compute_kpis(df):
    total_spend = df["Cost"].sum()

    anomaly_df = df[df["Final_Anomaly"] == 1]
    anomaly_spend = anomaly_df["Cost"].sum()
    total_possible_savings = df["Estimated_Saving_INR"].sum()


    # Conservative savings estimate (30%)
    potential_savings = anomaly_spend * 0.30

    return total_spend, anomaly_spend, potential_savings
