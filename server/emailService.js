const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function sendAnomalyAlert(userEmail, anomalyData) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: userEmail,
    subject: "🚨 Cloud Cost Anomaly Detected",
    html: `
      <h2>CloudPulse Alert</h2>
      <p><strong>Service:</strong> ${anomalyData.service}</p>
      <p><strong>Spike Amount:</strong> ₹${anomalyData.spike}</p>
      <p><strong>AI Reason:</strong> ${anomalyData.reason}</p>
      <p><strong>Recommendation:</strong> ${anomalyData.recommendation}</p>
    `
  };

  await transporter.sendMail(mailOptions);
}

module.exports = { sendAnomalyAlert };