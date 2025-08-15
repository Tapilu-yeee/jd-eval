const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
$("#y").textContent = new Date().getFullYear();

// tabs
$$(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    $$(".tab").forEach(b => b.classList.remove("active"));
    $$(".tab-panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    const id = btn.dataset.tab;
    document.getElementById(id).classList.add("active");
  });
});

// ---------- Evaluation: file reading ----------
let jdText = "";
$("#jdFile").addEventListener("change", async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  $("#fileInfo").textContent = "Đang đọc file...";
  try{
    if (f.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || f.name.endsWith(".docx")) {
      const arrayBuffer = await f.arrayBuffer();
      const result = await window.mammoth.extractRawText({ arrayBuffer });
      jdText = result.value || "";
    } else if (f.type === "text/plain" || f.name.endsWith(".txt")) {
      jdText = await f.text();
    } else {
      throw new Error("File không hỗ trợ. Hãy dùng .docx hoặc .txt");
    }
    $("#fileInfo").textContent = `Đã tải: ${f.name} (${(f.size/1024).toFixed(1)} KB)`;
  }catch(err){
    $("#fileInfo").textContent = "Lỗi: " + err.message;
    jdText = "";
  }
});

async function callGemini(apiKey, prompt){
  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + encodeURIComponent(apiKey);
  const body = { contents: [{ parts: [{ text: prompt }]}], generationConfig: { temperature: 0.2 } };
  const res = await fetch(url, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(body) });
  if(!res.ok){ const t = await res.text(); throw new Error("Gemini API error: " + res.status + " " + t); }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "";
  return text;
}

function buildPrompt(jobTitle, jd) {
  return `Bạn là chuyên gia đánh giá công việc PwC. Hãy phân tích JD sau và trả về JSON với dạng:
{
  "jobTitle": "...",
  "evaluations": [
    {"factor": "Trình độ học vấn", "grade":"A", "reason":"...", "evidence":"..."},
    {"factor": "Kinh nghiệm", "grade":"B", "reason":"...", "evidence":"..."}
  ],
  "similarJobsComparison":"...",
  "overallSummary":"..."
}
Chỉ in JSON thuần, không giải thích.
Tiêu đề: ${jobTitle}
JD:
${jd}`;
}

function renderResult(obj){
  $("#panelResult").classList.remove("hidden");
  $("#resultHeader").innerHTML = `<p class="muted">Kết quả đánh giá theo 12 yếu tố PwC</p><h2>${obj.jobTitle || $("#jobTitle").value || "Job Title"}</h2>`;
  const rows = (obj.evaluations || []).map((it, i) => `
    <tr>
      <td>${i+1}. ${it.factor||""}</td>
      <td>${it.reason||""}</td>
      <td><span class="muted">"${it.evidence||""}"</span></td>
      <td class="center"><span class="badge">${it.grade||""}</span></td>
    </tr>`).join("");
  const table = `<div class="section-title">Bảng đánh giá JD</div>
    <div class="table-wrap"><table class="table"><thead><tr>
    <th>Yếu tố</th><th>Lý do</th><th>Dẫn chứng</th><th>Mức</th>
    </tr></thead><tbody>${rows || '<tr><td colspan="4" class="muted center">Không có dữ liệu.</td></tr>'}</tbody></table></div>`;
  const similar = `<div class="section-title">Danh sách JD tương đồng</div><div class="box">${(obj.similarJobsComparison || "Không có dữ liệu.")}</div>`;
  const summary = `<div class="section-title">Nhận xét tổng quan</div><div class="box">${(obj.overallSummary || "Không có dữ liệu.")}</div>`;
  $("#resultBody").innerHTML = table + similar + summary;
}

$("#btnEvaluate").addEventListener("click", async ()=>{
  const title = $("#jobTitle").value.trim();
  if(!title){ alert("Vui lòng nhập tên vị trí."); return; }
  if(!jdText.trim()){ alert("Vui lòng tải JD (.docx hoặc .txt)."); return; }
  const apiKey = $("#apiKey").value.trim();
  $("#panelResult").classList.remove("hidden");
  $("#resultHeader").innerHTML = `<p class="muted">Đang xử lý...</p>`;
  $("#resultBody").innerHTML = ``;
  try{
    if(!apiKey){
      const mock = { jobTitle:title, evaluations:[
        {factor:"Trình độ học vấn", grade:"H1", reason:"Tốt nghiệp đại học...", evidence:"Trong JD yêu cầu bằng ĐH."},
        {factor:"Kinh nghiệm", grade:"G1", reason:"Tối thiểu 3 năm...", evidence:"JD yêu cầu 3+ năm."}
      ], similarJobsComparison:"Tương đồng với các JD quản lý vận hành cấp cơ sở.", overallSummary:"Vai trò thiên về điều phối vận hành, phối hợp đa phòng ban." };
      renderResult(mock); return;
    }
    const prompt = buildPrompt(title, jdText.slice(0, 20000));
    const text = await callGemini(apiKey, prompt);
    let parsed;
    try{ parsed = JSON.parse(text.replace(/```json|```/g,"").trim()); }
    catch(e){ throw new Error("Phản hồi AI không phải JSON hợp lệ:\n" + text); }
    renderResult(parsed);
  }catch(err){
    $("#resultHeader").innerHTML = `<p class="muted">Lỗi</p>`;
    $("#resultBody").innerHTML = `<div class="box" style="border-color:#7f1d1d;color:#fecaca">${err.message}</div>`;
  }
});

$("#btnReset").addEventListener("click", ()=>{
  $("#jobTitle").value = "";
  $("#jdFile").value = "";
  $("#fileInfo").textContent = "";
  jdText = "";
  $("#panelResult").classList.add("hidden");
});

// ---------- S-Grade: JSON + Excel ----------
let sData = [];
let filtered = [];

async function loadSGrade(){
  try{
    const res = await fetch("./sgrade.json", {cache:"no-store"});
    sData = await res.json();
  }catch{
    sData = [];
  }
  filtered = [...sData];
  fillRanks();
  renderTable();
}
function fillRanks(){
  const sel = $("#rankFilter");
  const ranks = Array.from(new Set(sData.map(x => x.rank))).sort((a,b)=>{
    const na=parseInt((a||'').replace(/\D+/g,''))||0;
    const nb=parseInt((b||'').replace(/\D+/g,''))||0;
    return na-nb || String(a).localeCompare(String(b));
  });
  sel.innerHTML = `<option value="all">Tất cả</option>` + ranks.map(r=>`<option value="${r}">${r}</option>`).join("");
}

function renderTable(){
  const body = $("#sTableBody");
  if(filtered.length===0){
    body.innerHTML = `<tr><td colspan="4" class="muted center">Không có dữ liệu.</td></tr>`;
    return;
  }
  body.innerHTML = filtered.map(j => `
    <tr>
      <td>${j.positionName||""}</td>
      <td>${j.vietnameseName||""}</td>
      <td>${j.positionType||""}</td>
      <td>${j.rank||""}</td>
    </tr>`).join("");
}

$("#searchInput").addEventListener("input", applyFilter);
$("#rankFilter").addEventListener("change", applyFilter);
function applyFilter(){
  const term = $("#searchInput").value.trim().toLowerCase();
  const r = $("#rankFilter").value;
  filtered = sData.filter(j => {
    const txt = (j.positionName+" "+j.vietnameseName).toLowerCase();
    const okT = !term || txt.includes(term);
    const okR = (r==="all") || (j.rank===r);
    return okT && okR;
  });
  renderTable();
}

// Download template
$("#btnDownloadTemplate").addEventListener("click", ()=>{
  window.location.href = "./s_grade_template.xlsx";
});

// Import Excel
$("#btnImportExcel").addEventListener("click", ()=> $("#excelImport").click());
$("#excelImport").addEventListener("change", async (e)=>{
  $("#importMsg").textContent = "";
  const f = e.target.files?.[0];
  if(!f) return;
  if(!f.name.endsWith(".xlsx")){ $("#importMsg").textContent = "Vui lòng chọn file .xlsx"; return; }
  const data = await f.arrayBuffer();
  const wb = XLSX.read(data, {type:"array"});
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws);
  const expected = ["positionName","vietnameseName","positionType","rank"];
  const ok = expected.every(k => Object.prototype.hasOwnProperty.call(rows[0]||{}, k));
  if(!ok){ $("#importMsg").textContent = "Sai header. Cần: " + expected.join(", "); return; }
  const add = rows.map(r => ({
    positionName: String(r.positionName||"").trim(),
    vietnameseName: String(r.vietnameseName||"").trim(),
    positionType: String(r.positionType||"").trim(),
    rank: String(r.rank||"").trim()
  })).filter(x => x.positionName && x.rank);
  const exists = new Set(sData.map(x=> (x.positionName||"").toLowerCase()));
  const newOnes = add.filter(x => !exists.has(x.positionName.toLowerCase()));
  sData = sData.concat(newOnes);
  applyFilter();
  $("#importMsg").textContent = `Đã thêm ${newOnes.length} vị trí mới.`;
  e.target.value = "";
});

// Export Excel
$("#btnExportExcel").addEventListener("click", ()=>{
  const ws = XLSX.utils.json_to_sheet(sData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "SGrade");
  XLSX.writeFile(wb, "s_grade_export.xlsx");
});

loadSGrade();
