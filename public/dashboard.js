let chart = null;
let forecastChart = null;

/* =========================
   UTILS
========================= */
function formatINR(num) {
  return "₹ " + Number(num).toLocaleString("en-IN");
}

function showToast(title, message, type = "error") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  
  const icon = type === "error" ? "❌" : "✅";
  
  toast.innerHTML = `
    <div class="toast-icon">${icon}</div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => toast.classList.add("show"), 10);
  
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}

/* =========================
   ANALYZE CSV
========================= */
function analyze() {
  const fileInput = document.getElementById("file");
  if (!fileInput.files.length) {
    showToast("No File", "Please upload a CSV file to analyze.");
    return;
  }

  const formData = new FormData();
  formData.append("file", fileInput.files[0]);

  fetch("/analyze", {
    method: "POST",
    body: formData
  })
    .then(res => {
      if (res.redirected && res.url.includes("login.html")) {
        window.location.href = res.url;
        throw new Error("Session expired");
      }
      if (!res.ok) throw new Error("Server error");
      return res.json();
    })
    .then(data => {
      // KPIs
      document.getElementById("total").innerText =
        formatINR(data.total_spend);

      document.getElementById("anomaly").innerText =
        formatINR(data.anomaly_spend);

      document.getElementById("savings").innerText =
        formatINR(data.estimated_savings);

      document.getElementById("summary").innerText =
        `Detected ${data.anomalies.length} abnormal cost events. Focus on High severity anomalies for maximum savings.`;
      if (data.ai_insight) {
          showAIInsight(data.ai_insight);
        }
      renderChart(data.anomalies);
      renderTable(data.anomalies);
      renderForecast(data.anomalies, data.forecast);
    })
    .catch(err => {
      console.error(err);
      showToast("Analysis Error", "The AI engine failed to process the request.");
    });

  
}

/* =========================
   COST TREND CHART
========================= */
function renderChart(anomalies) {
  const ctx = document.getElementById("costChart");
  if (!ctx) return;

  const labels = anomalies.map(a => a.Date);
  const costs = anomalies.map(a => a.Cost);

  if (chart) chart.destroy();

  const gradient = ctx.getContext("2d").createLinearGradient(0, 0, 0, 400);
  gradient.addColorStop(0, "rgba(79, 70, 229, 0.4)");
  gradient.addColorStop(1, "rgba(79, 70, 229, 0)");

  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Daily Cost History",
        data: costs,
        borderColor: "#4f46e5",
        backgroundColor: gradient,
        fill: true,
        borderWidth: 3,
        tension: 0.4,
        pointBackgroundColor: "#ffffff",
        pointBorderColor: "#4f46e5",
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(15, 23, 42, 0.9)",
          padding: 12,
          titleMarginBottom: 8,
          callbacks: {
            label: ctx => ` Spend: ${formatINR(ctx.parsed.y)}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: false,
          grid: { color: "rgba(0,0,0,0.05)" },
          ticks: {
            callback: v => "₹" + v.toLocaleString()
          }
        },
        x: {
          grid: { display: false }
        }
      }
    }
  });
}

/* =========================
   FORECAST (FIXED)
========================= */
function renderForecast(anomalies, serverForecast) {
  const canvas = document.getElementById("forecastChart");
  const tableBody = document.querySelector("#forecastTable tbody");
  if (!canvas || !tableBody) return;

  // Use last 14 records for baseline
  const history = anomalies.slice(-14);
  if (history.length < 5) return;

  const actualLabels = history.map(x => x.Date);
  const actualCosts = history.map(x => x.Cost);

  // Use server-side ML forecast if available, else fall back to moving average
  let forecastCosts;
  if (serverForecast && serverForecast.length > 0) {
    forecastCosts = serverForecast;
  } else {
    const avg = actualCosts.reduce((a, b) => a + b, 0) / actualCosts.length;
    forecastCosts = Array.from({ length: 30 }, (_, i) =>
      Math.round(avg * (1 + (i + 1) * 0.003))
    );
  }

  const forecastDays = forecastCosts.length;
  const forecastLabels = [];
  tableBody.innerHTML = "";

  forecastCosts.forEach((predicted, i) => {
    forecastLabels.push(`Day +${i + 1}`);
    const row = document.createElement("tr");
    row.innerHTML = `<td>Day +${i + 1}</td><td>${formatINR(predicted)}</td>`;
    tableBody.appendChild(row);
  });

  const labels = [...actualLabels, ...forecastLabels];

  // To make the transition seamless, the forecast starts where actual ends
  const seamlessForecast = [
    ...new Array(actualCosts.length - 1).fill(null),
    actualCosts[actualCosts.length - 1],
    ...forecastCosts
  ];

  const actualSeries = [
    ...actualCosts,
    ...new Array(forecastCosts.length).fill(null)
  ];

  // Show Day +1 prominently
  document.getElementById("forecastValue").innerText =
    formatINR(forecastCosts[0]);

  if (forecastChart) forecastChart.destroy();

  const fCtx = canvas.getContext("2d");
  const actualGradient = fCtx.createLinearGradient(0, 0, 0, 400);
  actualGradient.addColorStop(0, "rgba(79, 70, 229, 0.3)");
  actualGradient.addColorStop(1, "rgba(79, 70, 229, 0)");

  const forecastGradient = fCtx.createLinearGradient(0, 0, 0, 400);
  forecastGradient.addColorStop(0, "rgba(139, 92, 246, 0.2)");
  forecastGradient.addColorStop(1, "rgba(139, 92, 246, 0)");

  forecastChart = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Historical Cost",
          data: actualSeries,
          borderColor: "#4f46e5",
          backgroundColor: actualGradient,
          fill: true,
          borderWidth: 3,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: "#fff",
          zIndex: 2
        },
        {
          label: "MLE Forecast",
          data: seamlessForecast,
          borderColor: "#8b5cf6",
          backgroundColor: forecastGradient,
          fill: true,
          borderDash: [8, 4],
          borderWidth: 2,
          tension: 0.4,
          pointRadius: 0,
          zIndex: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "top", labels: { usePointStyle: true } },
        tooltip: {
          mode: "index",
          intersect: false,
          backgroundColor: "rgba(15, 23, 42, 0.9)",
          padding: 12,
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${formatINR(ctx.parsed.y)}`
          }
        }
      },
      scales: {
        y: {
          grid: { color: "rgba(0,0,0,0.05)" },
          ticks: {
            callback: v => "₹" + v.toLocaleString()
          }
        },
        x: {
          grid: { display: false }
        }
      }
    }
  });
}

/* =========================
   ANOMALIES TABLE
========================= */


function explainWhy(cost, avgCost, costChange = 0) {
  if (costChange > 0.5)
    return "Sudden cost spike compared to previous usage";
  if (cost > avgCost)
    return "Unusually high cost compared to historical average";
  return "Irregular spending pattern detected by AI model";
}

function renderTable(anomalies) {
  const tbody = document.querySelector("#results tbody");
  tbody.innerHTML = "";

  const avgCost =
    anomalies.reduce((s, a) => s + a.Cost, 0) / anomalies.length;

  anomalies.forEach((a, i) => {
    const severity = a.Severity || "Low";

    // Derive priority class from Recommendation text
    const recText = (a.Recommendation || "").toLowerCase();
    const savingsPriority = recText.includes("immediate") || recText.includes("critical")
      ? "High Savings"
      : recText.includes("consider") || recText.includes("review")
      ? "Medium Savings"
      : "Low Savings";

    const prevCost = i > 0 ? anomalies[i - 1].Cost : a.Cost;
    const costChange = (a.Cost - prevCost) / prevCost;

    // Prefer SHAP XAI explanation from Python; fall back to client-side heuristic
    const why = (a.XAI_Reason && a.XAI_Reason !== "Explanation unavailable")
      ? `🔍 ${a.XAI_Reason}`
      : explainWhy(a.Cost, avgCost, costChange);

    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${a.Date}</td>
      <td>${formatINR(a.Cost)}</td>
      <td>${formatINR(a.Estimated_Saving_INR)}</td>
      <td class="sev ${sevClass(severity)}">${severity}</td>
      <td class="xai-reason">${why}</td>
      <td class="rec ${priorityClass(savingsPriority)}">
        ${a.Recommendation}
      </td>
    `;

    tbody.appendChild(row);
  });
}

function priorityClass(p) {
  if (p === "High Savings") return "high";
  if (p === "Medium Savings") return "medium";
  return "low";
}

function sevClass(s) {
  if (s === "High") return "high";
  if (s === "Medium") return "medium";
  return "low";
}

/* =========================
   VIEW SWITCHING
========================= */


/* =========================
   DARK MODE
========================= */
function toggleDark() {
  const isDark = document.body.classList.toggle("dark");
  const theme = isDark ? "dark" : "light";
  localStorage.setItem("theme", theme);
  
  // Sync the settings dropdown if it exists on screen
  const themeSelect = document.getElementById("themeSelect");
  if (themeSelect) themeSelect.value = theme;
}

function loadSettings() {
  fetch("/settings")
    .then(res => {
      if (res.redirected && res.url.includes("login.html")) {
        window.location.href = res.url;
        throw new Error("Session expired");
      }
      return res.json();
    })
    .then(user => {
      document.getElementById("setUsername").value = user.username || "";
      document.getElementById("setEmail").value = user.email || "";
      const nameEl = document.getElementById("setName");
      if (nameEl) nameEl.value = user.name || "";
      const contactEl = document.getElementById("setContact");
      if (contactEl) contactEl.value = user.contact || "";

      // Ensure fields are locked initially
      document.getElementById("setEmail").disabled = true;
      if (nameEl) nameEl.disabled = true;
      if (contactEl) contactEl.disabled = true;

      const loggedUser = document.getElementById("loggedUser");
      if (loggedUser) loggedUser.innerText = user.name || user.username;
    });
}

function enableEdit() {
  document.getElementById("setEmail").disabled = false;
  const nameEl = document.getElementById("setName");
  if (nameEl) nameEl.disabled = false;
  const contactEl = document.getElementById("setContact");
  if (contactEl) contactEl.disabled = false;

  document.getElementById("editBtn").style.display = "none";
  document.getElementById("saveBtn").style.display = "inline-block";
}

function saveSettings() {
  const emailEl = document.getElementById("setEmail");
  const nameEl = document.getElementById("setName");
  const contactEl = document.getElementById("setContact");

  fetch("/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: emailEl.value,
      name: nameEl ? nameEl.value : "",
      contact: contactEl ? contactEl.value : ""
    })
  })
  .then(() => {
    showToast("Settings Updated", "Your profile changes have been saved.", "success");

    document.getElementById("setEmail").disabled = true;
    const nameEl = document.getElementById("setName");
    if (nameEl) nameEl.disabled = true;
    const contactEl = document.getElementById("setContact");
    if (contactEl) contactEl.disabled = true;

    document.getElementById("editBtn").style.display = "inline-block";
    document.getElementById("saveBtn").style.display = "none";

    // Update sidebar name immediately
    const loggedUser = document.getElementById("loggedUser");
    if (loggedUser && nameEl) loggedUser.innerText = nameEl.value;
  });
}

function setTheme() {
  const theme = document.getElementById("themeSelect").value;
  document.body.classList.toggle("dark", theme === "dark");
  localStorage.setItem("theme", theme);
}

// Single DOMContentLoaded — loads settings and restores theme
document.addEventListener("DOMContentLoaded", () => {
  loadSettings();

  const t = localStorage.getItem("theme");
  if (t === "dark") {
    document.body.classList.add("dark");
    const themeSelect = document.getElementById("themeSelect");
    if (themeSelect) themeSelect.value = "dark";
  }
});

function showView(viewId, el) {
  // Hide all views
  document.querySelectorAll(".view").forEach(v =>
    v.classList.remove("active-view")
  );

  // Remove active class from sidebar
  document.querySelectorAll(".nav-item").forEach(n =>
    n.classList.remove("active")
  );

  // Show selected view
  document.getElementById(viewId).classList.add("active-view");
  el.classList.add("active");

  // Load history only when needed
  if (viewId === "history") {
    loadHistory();
  }
}

async function loadHistory() {
  try {
    const res = await fetch("/history");
    if (res.redirected && res.url.includes("login.html")) {
      window.location.href = res.url;
      return;
    }
    const rows = await res.json();

    const tbody = document.querySelector("#historyTable tbody");
    tbody.innerHTML = "";

    if (!rows.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="3" style="text-align:center">
            No saved analysis yet
          </td>
        </tr>`;
      return;
    }

    rows.forEach(r => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${new Date(r.created_at).toLocaleString()}</td>
        <td>${formatINR(r.total)}</td>
        <td>${formatINR(r.savings)}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error("Failed to load history:", err);
  }
}


const fileInput = document.getElementById("file");
const uploadLabel = document.getElementById("uploadLabel");
const fileStatus = document.getElementById("fileStatus");

fileInput.addEventListener("change", () => {
  if (fileInput.files.length) {
    uploadLabel.classList.add("active");
    fileStatus.innerText = "File selected ✓";
  } else {
    uploadLabel.classList.remove("active");
    fileStatus.innerText = "No file selected";
  }
});




function resetPassword() {
  const btn = event?.target || document.querySelector('button[onclick="resetPassword()"]');
  const originalText = btn.innerText;
  
  btn.disabled = true;
  btn.innerText = "⌛ Sending link...";
  
  showToast("Please Wait", "Dispatching your secure reset link...", "success");

  fetch("/initiate-reset", { method: "POST" })
    .then(async res => {
      const data = await res.json();
      if (res.ok) {
        showToast("Email Sent", "A password reset link has been dispatched to your inbox.", "success");
      } else {
        showToast("Failed", data.error || "Could not send reset link.", "error");
      }
    })
    .catch(err => {
      console.error(err);
      showToast("Error", "Server communication failed.", "error");
    })
    .finally(() => {
      btn.disabled = false;
      btn.innerText = originalText;
    });
}

function clearHistory() {
  if (!confirm("Are you absolutely sure you want to delete your entire analysis history? This action cannot be undone.")) {
    return;
  }

  fetch("/clear-history", { method: "POST" })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        showToast("History Cleared", "All your past analysis records have been permanently deleted.", "success");
        // Reload history view if it's currently open
        loadHistory();
      } else {
        showToast("Error", "Failed to clear history. Please try again.");
      }
    })
    .catch(err => {
      console.error(err);
      showToast("Error", "Communication error with server.");
    });
}


function showAIInsight(insight) {
  const panel = document.getElementById("aiPanel");
  if (!panel) return;

  panel.innerHTML = `
    <h3>🧠 AI Cost Intelligence</h3>
    <p><b>Root Cause:</b> ${insight.root_cause}</p>
    <p><b>Risk Level:</b> ${insight.risk_level}</p>
    <p><b>Prevention:</b> ${insight.prevention}</p>
    <p><b>Impact:</b> ${insight.impact}</p>
  `;
}

function toggleAccordion() {
  const accordion = document.getElementById("sidebarAccordion");
  if (accordion) {
    accordion.classList.toggle("open");
  }
}

function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  const collapseBtn = document.getElementById("collapseBtn");
  if (sidebar) {
    sidebar.classList.toggle("collapsed");
    if (sidebar.classList.contains("collapsed")) {
      collapseBtn.innerText = "▶";
      collapseBtn.setAttribute("title", "Expand Sidebar");
    } else {
      collapseBtn.innerText = "◀";
      collapseBtn.setAttribute("title", "Collapse Sidebar");
    }
  }
}