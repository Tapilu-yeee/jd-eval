// Cấu hình API Gemini (thay YOUR_API_KEY_HERE bằng key thật)
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=AIzaSyD9fDIYcMI_juMCXsoz8StSTOSvPUPid1w";

async function processFile() {
  const file = document.getElementById("fileInput").files[0];
  if (!file) return alert("Vui lòng chọn file DOCX hoặc TXT");
  const text = await file.text();
  const response = await fetch(GEMINI_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text }] }]
    })
  });
  const data = await response.json();
  document.getElementById("result").innerText = JSON.stringify(data, null, 2);
}

function openTab(evt, tabId) {
  document.querySelectorAll(".tab-content").forEach(c => c.style.display = "none");
  document.querySelectorAll(".tab-button").forEach(b => b.classList.remove("active"));
  document.getElementById(tabId).style.display = "block";
  evt.currentTarget.classList.add("active");
}

async function loadSGrade() {
  const res = await fetch("sgrade.json");
  const data = await res.json();
  renderSGradeTable(data);
}

function renderSGradeTable(data) {
  const table = document.getElementById("sgradeTable");
  table.innerHTML = "<tr><th>Position Name</th><th>Vietnamese Name</th><th>Position Type</th><th>Rank</th></tr>";
  data.forEach(row => {
    table.innerHTML += `<tr><td>${row.positionName}</td><td>${row.vietnameseName}</td><td>${row.positionType}</td><td>${row.rank}</td></tr>`;
  });
}

function exportSGrade() {
  alert("Tính năng xuất Excel sẽ được bổ sung ở đây.");
}

function importSGrade(evt) {
  alert("Tính năng import Excel sẽ được bổ sung ở đây.");
}

loadSGrade();
