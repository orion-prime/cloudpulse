function analyzeCosts(rows) {
  const avgCost =
    rows.reduce((s, r) => s + r.cost, 0) / rows.length;

  return rows.map((r, i) => {
    const prev = i > 0 ? rows[i - 1].cost : r.cost;
    const change = (r.cost - prev) / (prev || 1);

    const anomaly = r.cost > avgCost * 1.4 || change > 0.3;

    let recommendation = "Normal usage behavior";
    let saving = 0;
    let priority = "None";

    if (anomaly) {
      if (r.cost > avgCost * 2) {
        recommendation =
          "Right-size VM instances or reduce provisioned capacity";
        saving = r.cost * 0.45;
      } else {
        recommendation =
          "Investigate autoscaling or recent deployments";
        saving = r.cost * 0.30;
      }

      if (saving > avgCost * 0.4) priority = "High";
      else if (saving > avgCost * 0.2) priority = "Medium";
      else priority = "Low";
    }

    return {
      ...r,
      anomaly,
      change,
      saving,
      priority,
      recommendation
    };
  });
}

module.exports = { analyzeCosts };
