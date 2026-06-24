
async function generateLLMInsight(analysis) {
  const prompt = `
You are a Cloud FinOps expert.

Total Spend: ₹${analysis.total_spend}
Anomaly Spend: ₹${analysis.anomaly_spend}
Anomaly Count: ${analysis.anomalies.length}

Explain:
1. Why the spike happened
2. Risk level (Low/Medium/High)
3. How to prevent this
4. What happens if ignored

Return strictly JSON:
{
  "root_cause": "",
  "risk_level": "",
  "prevention": "",
  "impact": ""
}
`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3
    })
  });

  const data = await response.json();

  if (!data.choices || !data.choices[0]) {
    console.error("[LLM] Unexpected OpenAI response:", JSON.stringify(data));
    return null;
  }

  return JSON.parse(data.choices[0].message.content);
}

module.exports = { generateLLMInsight };