/* ==============================
   JD Evaluation AI (GitHub Pages)
   UI/UX: Tailwind — Tabs, Cards, Drag&Drop
   Cấu hình API Gemini: sửa 1 dòng dưới đây
================================== */

// === CẤU HÌNH API GEMINI Ở ĐÂY (thay bằng link API của bạn lấy ở Google AI Studio) ===
const GEMINI_API_URL = "AIzaSyD9fDIYcMI_juMCXsoz8StSTOSvPUPid1w";

// State
let uploadedText = "";
let sgradeData = [];

// ---------- Tabs ----------
const tabButtons = document.querySelectorAll(".tab-btn");
const panels = document.querySelectorAll(".tab-panel");
tabButtons.forEach((btn)=>{
  btn.addEventListener("click", () => {
    tabButtons.forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    const target = btn.dataset.target;
    panels.forEach(p => p.classList.add("hidden"));
    document.querySelector(target).classList.remove("hidden");
  });
});

// ---------- Drag & Drop / Upload ----------
const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");

dropZone.addEventListener("click", ()=> fileInput.click());
["dragenter","dragover"].forEach(evt => {
  dropZone.addEventListener(evt, (e)=>{ e.preventDefault(); e.stopPropagation(); dropZone.classList.add("ring-2","ring-emerald-500"); });
});
["dragleave","drop"].forEach(evt => {
  dropZone.addEventListener(evt, (e)=>{ e.preventDefault(); e.stopPropagation(); dropZone.classList.remove("ring-2","ring-emerald-500"); });
});
dropZone.addEventListener("drop", (e)=>{
  if(e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener("change", (e)=>{
  if(e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
});

async function handleFile(file){
  if(file.size > 200*1024*1024){
    alert("File quá lớn (giới hạn 200MB)");
    return;
  }
  const type = file.type;
  const reader = new FileReader();
  reader.onload = async (ev) => {
    try {
      if(type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"){
        const arrayBuffer = ev.target.result;
        const result = await window.mammoth.extractRawText({ arrayBuffer });
        uploadedText = result.value || "";
      } else if(type === "text/plain" || file.name.toLowerCase().endsWith(".txt")){
        uploadedText = ev.target.result;
      } else {
        alert("File không hỗ trợ. Vui lòng chọn .docx hoặc .txt");
        return;
      }
      dropZone.querySelector("p").innerHTML = `<span class="text-white font-semibold">${file.name}</span> — đã nạp nội dung`;
    } catch(err){
      console.error(err);
      alert("Không đọc được file. Vui lòng kiểm tra lại.");
    }
  };
  if(type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"){
    reader.readAsArrayBuffer(file);
  } else {
    reader.readAsText(file, "UTF-8");
  }
}

// ---------- Evaluate ----------
const btnEvaluate = document.getElementById("btnEvaluate");
const btnClear = document.getElementById("btnClear");
const resultContainer = document.getElementById("resultContainer");
const resultView = document.getElementById("resultView");

btnClear.addEventListener("click", ()=>{
  document.getElementById("jobTitle").value = "";
  uploadedText = "";
  dropZone.querySelector("p").innerHTML = `<span class="text-white font-semibold">Click to upload</span> or drag and drop`;
  resultContainer.classList.add("hidden");
  resultView.innerHTML = "";
});

btnEvaluate.addEventListener("click", async ()=>{
  const title = (document.getElementById("jobTitle").value || "").trim();
  if(!title){ alert("Nhập tên vị trí công việc"); return; }
  if(!uploadedText.trim()){ alert("Vui lòng tải JD (.docx/.txt)"); return; }
  if(!GEMINI_API_URL || GEMINI_API_URL.includes("YOUR_GEMINI_API_URL_HERE")){
    alert("Bạn chưa cấu hình GEMINI_API_URL trong script.js");
    return;
  }

  resultContainer.classList.remove("hidden");
  resultView.innerHTML = `<div class="text-soft">Đang gửi yêu cầu tới Gemini...</div>`;

  const prompt = buildPrompt(title, uploadedText);
  try{
    const resp = await fetch(GEMINI_API_URL, {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({
        contents: [{ role:"user", parts:[{ text: prompt }]}],
        generationConfig: {
          response_mime_type: "application/json"
        }
      })
    });
    const data = await resp.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || data.output_text || "";
    const sanitized = text.replace(/^```json\s*|\s*```$/g, "").trim();
    const obj = JSON.parse(sanitized);

    renderResult(obj);
  }catch(err){
    console.error(err);
    resultView.innerHTML = `<div class="text-red-400">Lỗi khi gọi Gemini: ${err?.message || err}</div>`;
  }
});

function buildPrompt(jobTitle, jdText){
  return `Bạn là chuyên gia đánh giá công việc theo phương pháp PwC (12 yếu tố). Hãy trả JSON với schema:
{
  "jobTitle": "string",
  "evaluations": [ { "factor": "string", "grade":"string", "reason":"string", "evidence":"string" } ],
  "summary": { "scope":"string", "complexity":"string", "impact":"string" },
  "similarJobsComparison":"string",
  "overallSummary":"string"
}
Phân tích JD cho vị trí: "${jobTitle}". JD:
${jdText}`;
}

function renderResult(result){
  const { jobTitle, evaluations=[], summary={}, similarJobsComparison="", overallSummary="" } = result || {};
  let rows = evaluations.map((it, idx)=>`
    <tr class="hover:bg-zinc-800/40">
      <td class="td font-semibold text-white">${idx+1}. ${it.factor || ""}</td>
      <td class="td">${it.reason || ""}</td>
      <td class="td italic text-soft">"${it.evidence || ""}"</td>
      <td class="td text-center">
        <span class="inline-flex px-3 py-1 rounded-full bg-emerald-900 text-emerald-300 text-xs font-bold">${it.grade || ""}</span>
      </td>
    </tr>
  `).join("");

  resultView.innerHTML = `
    <div>
      <p class="text-sm text-soft">Kết quả đánh giá theo 12 yếu tố PwC</p>
      <h4 class="text-2xl font-extrabold text-emerald-400">${jobTitle || ""}</h4>
    </div>

    <div>
      <h5 class="text-lg font-bold text-gray-200 mb-3">Bảng đánh giá JD</h5>
      <div class="overflow-x-auto rounded-lg border border-zinc-700 bg-card">
        <table class="min-w-full divide-y divide-zinc-700">
          <thead class="bg-zinc-800/60">
            <tr>
              <th class="th w-2/6">Yếu tố</th>
              <th class="th w-3/6">Lý do</th>
              <th class="th">Dẫn chứng</th>
              <th class="th w-1/6 text-center">Mức</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-zinc-700">${rows}</tbody>
        </table>
      </div>
    </div>

    <div class="space-y-4">
      <div>
        <h5 class="text-lg font-bold text-gray-200 mb-2">Danh sách các JD có phạm vi tương đồng</h5>
        <div class="p-4 bg-zinc-900/50 rounded-lg border border-zinc-700">
          <p class="text-gray-300 whitespace-pre-wrap">${similarJobsComparison || ""}</p>
        </div>
      </div>
      <div>
        <h5 class="text-lg font-bold text-gray-200 mb-2">Nhận xét tổng quan</h5>
        <div class="p-4 bg-zinc-900/50 rounded-lg border border-zinc-700">
          <p class="text-gray-300 whitespace-pre-wrap">${overallSummary || ""}</p>
        </div>
      </div>
    </div>
  `;
}

// ---------- S-Grade ----------
async function loadSgrade(){
  try{
    const res = await fetch("sgrade.json", { cache: "no-store" });
    sgradeData = await res.json();
  }catch{ sgradeData = []; }
  renderSgRanks();
  renderSgTable();
}
loadSgrade();

function renderSgRanks(){
  const rankSet = new Set();
  (sgradeData||[]).forEach(j => { if(j.rank) rankSet.add(j.rank); });
  const sel = document.getElementById("sgRank");
  const current = sel.value;
  sel.innerHTML = `<option value="all">Tất cả</option>` + Array.from(rankSet).sort().map(r=>`<option value="${r}">${r}</option>`).join("");
  if([...sel.options].some(o=>o.value===current)) sel.value = current;
}

function renderSgTable(){
  const term = (document.getElementById("sgSearch").value || "").toLowerCase();
  const rank = document.getElementById("sgRank").value || "all";
  const body = document.getElementById("sgBody");
  const filtered = (sgradeData||[]).filter(j => {
    const m = j.positionName?.toLowerCase().includes(term) || j.vietnameseName?.toLowerCase().includes(term);
    const r = rank === "all" || j.rank === rank;
    return m && r;
  });
  if(filtered.length===0){
    body.innerHTML = `<tr><td class="td text-center text-soft" colspan="4">Không có dữ liệu</td></tr>`;
    return;
  }
  body.innerHTML = filtered.map(j=>`
    <tr class="hover:bg-zinc-800/40">
      <td class="td text-emerald-400 font-medium">${j.positionName||""}</td>
      <td class="td">${j.vietnameseName||""}</td>
      <td class="td">${j.positionType||""}</td>
      <td class="td">${j.rank||""}</td>
    </tr>
  `).join("");
}

document.getElementById("sgSearch").addEventListener("input", renderSgTable);
document.getElementById("sgRank").addEventListener("change", renderSgTable);

// Excel Import/Export/Template
document.getElementById("btnTemplate").addEventListener("click", ()=>{
  const header = ["positionName","vietnameseName","positionType","rank"];
  const example = ["Sample Position","Vị Trí Mẫu","Indirect","S7"];
  const ws = XLSX.utils.aoa_to_sheet([header, example]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Template");
  XLSX.writeFile(wb, "s_grade_template.xlsx");
});

document.getElementById("btnImport").addEventListener("click", ()=> document.getElementById("sgFile").click());
document.getElementById("sgFile").addEventListener("change", (e)=>{
  const f = e.target.files?.[0];
  if(!f) return;
  const reader = new FileReader();
  reader.onload = (ev)=>{
    const data = new Uint8Array(ev.target.result);
    const wb = XLSX.read(data, { type:"array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws);
    const newItems = rows.map(r => ({
      positionName: String(r.positionName||"").trim(),
      vietnameseName: String(r.vietnameseName||"").trim(),
      positionType: String(r.positionType||"").trim(),
      rank: String(r.rank||"").trim()
    })).filter(x => x.positionName && x.rank);
    if(newItems.length===0){ alert("File không có dữ liệu hợp lệ."); return; }
    // append (avoid duplicates by positionName lowercase)
    const set = new Set((sgradeData||[]).map(x=> (x.positionName||"").toLowerCase()));
    const added = [];
    newItems.forEach(n => {
      if(!set.has(n.positionName.toLowerCase())){
        sgradeData.push(n); set.add(n.positionName.toLowerCase()); added.push(n);
      }
    });
    if(added.length===0) alert("Không có vị trí mới (trùng dữ liệu).");
    renderSgRanks();
    renderSgTable();
  };
  reader.readAsArrayBuffer(f);
  e.target.value = "";
});

document.getElementById("btnExport").addEventListener("click", ()=>{
  const rows = (sgradeData||[]).map(x => ({
    positionName: x.positionName||"",
    vietnameseName: x.vietnameseName||"",
    positionType: x.positionType||"",
    rank: x.rank||""
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "SGrade");
  XLSX.writeFile(wb, "sgrade_export.xlsx");
});
