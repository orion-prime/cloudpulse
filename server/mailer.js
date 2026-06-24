const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Check if credentials are still set to placeholders
const isEmailMocked = !process.env.EMAIL_USER || 
                      process.env.EMAIL_USER.includes("yourgmail") || 
                      !process.env.EMAIL_PASS || 
                      process.env.EMAIL_PASS.includes("your_app_password");

if (isEmailMocked) {
  console.log("⚠️ [Mailer] Email credentials not configured. System is running in MOCK MODE (Emails will log to console).");
}

async function sendAnomalyEmail(email, analysis, insight) {
  if (isEmailMocked) {
    console.log("\n🚨 [MOCK EMAIL] ANOMALY DETECTED!");
    console.log(`📧 To: ${email}`);
    console.log(`💰 Total Spend: ₹${analysis.total_spend}`);
    console.log(`🤖 AI Insight: ${insight.root_cause}\n`);
    return Promise.resolve();
  }

  const mailOptions = {
    from: "CloudPulse AI",
    to: email,
    subject: "🚨 Cloud Cost Anomaly Detected",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
        <h2 style="color: #4f46e5;">CloudPulse Alert</h2>
        <p><b>Total Spend:</b> ₹${analysis.total_spend}</p>
        <p><b>Anomaly Spend:</b> ₹${analysis.anomaly_spend}</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;">
        <h3 style="color: #0f172a;">AI Root Cause</h3>
        <p>${insight.root_cause}</p>
        <h3 style="color: #0f172a;">Risk Level</h3>
        <p>${insight.risk_level}</p>
        <h3 style="color: #0f172a;">Prevention</h3>
        <p>${insight.prevention}</p>
        <h3 style="color: #0f172a;">Impact if Ignored</h3>
        <p>${insight.impact}</p>
      </div>
    `
  };
  return transporter.sendMail(mailOptions);
}

async function sendOTPEmail(email, otp) {
  if (isEmailMocked) {
    console.log("\n-----------------------------------------");
    console.log(`📧 [MOCK EMAIL] To: ${email}`);
    console.log(`🔑 Your CloudPulse OTP is: ${otp}`);
    console.log("-----------------------------------------\n");
    return Promise.resolve();
  }

  const mailOptions = {
    from: "CloudPulse Security",
    to: email,
    subject: "Verify Your CloudPulse Account",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 40px; text-align: center; border: 1px solid #e2e8f0; border-radius: 12px;">
        <h2 style="color: #4f46e5;">Welcome to CloudPulse</h2>
        <p>Use the following code to verify your email address:</p>
        <h1 style="letter-spacing: 12px; font-size: 36px; padding: 10px; background: #f8fafc; display: inline-block; border-radius: 8px;">${otp}</h1>
        <p style="color: #64748b; margin-top: 20px;">This code will expire in 10 minutes.</p>
      </div>
    `
  };
  return transporter.sendMail(mailOptions);
}

async function sendResetEmail(email, token) {
  const resetLink = `http://localhost:3000/reset.html?token=${token}`;
  
  if (isEmailMocked) {
    console.log("\n-----------------------------------------");
    console.log(`📧 [MOCK EMAIL] To: ${email}`);
    console.log(`🔗 Reset Link: ${resetLink}`);
    console.log("-----------------------------------------\n");
    return Promise.resolve();
  }

  const mailOptions = {
    from: "CloudPulse Security",
    to: email,
    subject: "Reset Your CloudPulse Password",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 40px; text-align: center; border: 1px solid #e2e8f0; border-radius: 12px;">
        <h2 style="color: #4f46e5;">Password Reset Request</h2>
        <p>Click the button below to reset your password. If you didn't request this, you can ignore this email.</p>
        <a href="${resetLink}" style="display: inline-block; padding: 14px 28px; background: #4f46e5; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px;">Reset Password</a>
        <p style="color: #64748b; margin-top: 20px;">This link will expire in 1 hour.</p>
      </div>
    `
  };
  return transporter.sendMail(mailOptions);
}

module.exports = { sendAnomalyEmail, sendOTPEmail, sendResetEmail };
