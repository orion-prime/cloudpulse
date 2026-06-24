import numpy as np
import pandas as pd

def generate_recommendations(df):
    recommendations = []
    saving_amounts = []
    severities = []

    avg_cost = df["Cost"].mean()
    avg_usage = df["Usage"].mean()

    for i, row in df.iterrows():
        if row["Final_Anomaly"] == 1:
            
            cost_chg = row["Cost_Change"]
            cost_pct = int(cost_chg * 100) if not np.isinf(row["Cost_Change"]) else ">500"
            usage_pct = int((row["Usage"] / avg_usage) * 100) if avg_usage > 0 else 0
            current_cost = int(row["Cost"])

            # Fetch the actual hardware utilization we ported over from preprocessing.py
            cpu_val = row.get("CPU", 0)
            mem_val = row.get("Memory", 0)
            cpu = 0 if pd.isna(cpu_val) else int(cpu_val)
            mem = 0 if pd.isna(mem_val) else int(mem_val)

            # Rule 1: High cost but underutilized hardware (Idle Ghost Resources) - highest priority for saving
            if cpu < 20 and mem < 20 and current_cost > avg_cost:
                saving = row["Cost"] * 0.50
                # High severity: Total ghost mode (<10% util) AND bleeding > ₹50,000 OR purely massive waste > ₹100,000
                if saving > 100000 or (cpu < 10 and mem < 10 and saving > 50000):
                    sev = "High"
                elif saving > 20000:
                    sev = "Medium"
                else:
                    sev = "Low"
                    
                rec = (
                    f"📉 Right-sizing opportunity: You're paying high costs (₹{current_cost}), but the hardware is practically idle "
                    f"(CPU: {cpu}% | Memory: {mem}%). Consider shutting down or downsizing these ghost VMs to reliably save ≈₹{int(saving)}."
                )

            # Rule 2: High CPU/Memory Stress (Optimization Required)
            elif cpu >= 85 or mem >= 85:
                # If they are maxing out, they might be overpaying for inefficient compute or scaling wildly
                saving = row["Cost"] * 0.20
                # High severity: Immediate crash risk (>=95%) AND costing way above average (>1.5x)
                if (cpu >= 95 or mem >= 95) and current_cost > (1.5 * avg_cost):
                    sev = "High"
                elif current_cost > avg_cost:
                    sev = "Medium"
                else:
                    sev = "Low"
                    
                rec = (
                    f"🚨 Performance warning: Resource exhaustion detected (CPU: {cpu}% | Memory: {mem}%). "
                    f"These instances are maxing out and likely triggering expensive auto-scaling events. "
                    f"Review architecture or upgrade memory configurations to stabilize costs and save ≈₹{int(saving)}."
                )

            # Rule 3: Sudden cost spike despite normal hardware usage (Pricing/Billing Issue)
            elif cost_chg > 0.3:
                saving = row["Cost"] * 0.30
                # High severity: More than doubled cost (>100% spike) AND it's physically a large bill (>₹50,000)
                if cost_chg > 1.0 and current_cost > 50000:
                    sev = "High"
                elif cost_chg > 0.6 or current_cost > avg_cost:
                    sev = "Medium"
                else:
                    sev = "Low"
                    
                rec = (
                    f"🔍 Immediate attention: Your cost spiked by {cost_pct}%, but hardware metrics don't justify it "
                    f"(CPU: {cpu}% | Memory: {mem}%). This points to expensive network egress, API limits, or licensing fees. Auditing this could recover up to ₹{int(saving)}."
                )

            # Rule 4: Consistent high spend (Commitment strategy)
            else:
                saving = row["Cost"] * 0.35
                # High severity: Missing out on massive > ₹200k savings by not using Commitments
                if saving > 200000:
                    sev = "High"
                elif saving > 50000:
                    sev = "Medium"
                else:
                    sev = "Low"
                    
                rec = (
                    f"💡 Smart savings: This ₹{current_cost} block of spend is recurring with stable load "
                    f"(CPU: {cpu}% | Memory: {mem}%). Consider applying Committed Use Discounts or long-term reservations "
                    f"to shave approximately ₹{int(saving)} (35%) off this fixed bill."
                )

        else:
            rec = "Normal optimal usage. No action required."
            saving = 0.0
            sev = "Low"

        recommendations.append(rec)
        saving_amounts.append(saving)
        severities.append(sev)

    df["Recommendation"] = recommendations
    df["Estimated_Saving_INR"] = saving_amounts
    df["Severity"] = severities

    return df
