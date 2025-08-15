/* ===============================
   JD Evaluation AI (GitHub Pages)
   Reverted UI/UX – single HTML/CSS/JS (no build)
   =============================== */

/** ===============================
 * 1) CẤU HÌNH API GEMINI – SỬA 1 DÒNG NÀY
 * Dán FULL endpoint bạn lấy ở Google AI Studio:
 *   ví dụ:
 *   https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=YOUR_KEY
 * Hoặc endpoint tương đương bạn đã tạo trên API Gateway/Proxy.
 * ================================== */
const GEMINI_API_URL = "AIzaSyD9fDIYcMI_juMCXsoz8StSTOSvPUPid1w";
/** ================================== */

// ---------- helpers ----------
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

const yearEl = $("#year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

// Tabs
const tabEval = $("#tab-eval");
const tabSgrade = $("#tab-sgrade");
const panelEval = $("#panel-eval");
const panelSgrade = $("#panel-sgrade");
function switchTab(which){
  if (which === "eval"){
    tabEval.classList.add("is-active"); tabEval.setAttribute("aria-selected","true");
    tabSgrade.classList.remove("is-active"); tabSgrade.setAttribute("aria-selected","false");
    panelEval.hidden = false; panelEval.classList.add("is-active");
    panelSgrade.hidden = true;  panelSgrade.classList.remove("is-active");
  } else {
    tabSgrade.classList.add("is-active"); tabSgrade.setAttribute("aria-selected","true");
    tabEval.classList.remove("is-active"); tabEval.setAttribute("aria-selected","false");
    panelSgrade.hidden = false; panelSgrade.classList.add("is-active");
    panelEval.hidden = true;    panelEval.classList.remove("is-active");
  }
}
tabEval?.addEventListener("click", ()=> switchTab("eval"));
tabSgrade?.addEventListener("click", ()=> switchTab("sgrade"));

// ---------- Evaluation: file handling ----------
const fileInput = $("#fileInput");
const dropArea = $("#dropArea");
const pickedFile = $("#pickedFile");
const triggerPick = $("#triggerPick");
const jobTitleInput = $("#jobTitleInput");
const btnEvaluate = $("#btnEvaluate");
const btnClear = $("#btnClear");
const resultWrap = $("#resultWrap");
const resultContent = $("#resultContent");
const evalSpinner = $("#evalSpinner");

triggerPick?.addEventListener("click", ()=> fileInput?.click());

const readTextFromFile = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = async (e) => {
    try{
      if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"){
        const arrayBuffer = e.target.result;
        const { value } = await window.mammoth.extractRawText({ arrayBuffer });
        resolve(value);
      } else if (file.type.startsWith("text/") || /\.txt$/i.test(file.name)) {
        resolve(String(e.target.result));
      } else {
        reject(new Error("Định dạng không hỗ trợ. Vui lòng dùng .docx hoặc .txt"));
      }
    }catch(err){ reject(err); }
  };
  reader.onerror = (err) => reject(err);

  if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"){
    reader.readAsArrayBuffer(file);
  } else {
    reader.readAsText(file, "UTF-8");
  }
});

function setPickedLabel(file){
  pickedFile.classList.remove("hidden");
  pickedFile.textContent = `Đã chọn: ${file.name} (${(file.size/1024).toFixed(1)} KB)`;
}

fileInput?.addEventListener("change", async (e)=>{
  const file = e.target.files?.[0];
  if (!file) return;
  setPickedLabel(file);
});

["dragenter","dragover"].forEach(ev => {
  dropArea?.addEventListener(ev, (e)=>{ e.preventDefault(); e.stopPropagation(); });
});
dropArea?.addEventListener("drop", (e)=>{
  e.preventDefault(); e.stopPropagation();
  const f = e.dataTransfer.files?.[0];
  if (f){
    fileInput.files = e.dataTransfer.files;
    setPickedLabel(f);
  }
});

btnClear?.addEventListener("click", ()=>{
  if (fileInput) fileInput.value = "";
  if (pickedFile) pickedFile.classList.add("hidden");
  resultWrap?.classList.add("hidden");
  resultContent.textContent = "";
});

// ---------- call Gemini ----------
async function callGemini(prompt){
  if (!GEMINI_API_URL || GEMINI_API_URL.startsWith("REPLACE_")){
    throw new Error("Bạn chưa cấu hình GEMINI_API_URL trong script.js.");
  }
  const body = {
    contents: [{role:"user", parts:[{text: prompt}]}],
    generationConfig: { temperature: 0.2 }
  };
  const res = await fetch(GEMINI_API_URL, {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok){
    const t = await res.text();
    throw new Error(`Gemini trả lỗi ${res.status}: ${t}`);
  }
  const json = await res.json();
  // Lấy text đầu tiên
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return text;
}

btnEvaluate?.addEventListener("click", async ()=>{
  try{
    const jobTitle = jobTitleInput?.value?.trim();
    if (!jobTitle) return alert("Vui lòng nhập tên vị trí công việc.");
    const file = fileInput?.files?.[0];
    if (!file) return alert("Vui lòng chọn JD (.docx hoặc .txt).");

    btnEvaluate.disabled = true; evalSpinner.classList.remove("hidden");

    const jdText = await readTextFromFile(file);
    const prompt = buildPrompt(jobTitle, jdText);

    const text = await callGemini(prompt);
    // có thể model trả về JSON hoặc markdown-codefence
    const clean = text.replace(/^```json\n?|```$/g, "").trim();
    let obj;
    try{ obj = JSON.parse(clean); }
    catch(_){ obj = { raw: text }; }

    renderResult(obj);

  }catch(err){
    console.error(err);
    alert("Lỗi: " + err.message);
  }finally{
    btnEvaluate.disabled = false; evalSpinner.classList.add("hidden");
  }
});

// Prompt đơn giản – bạn có thể thay bằng file pWC prompt của bạn
function buildPrompt(jobTitle, jdText){
  return `Hãy phân tích JD cho vị trí: "${jobTitle}". 
Trả về JSON với các khóa: 
- jobTitle (chuỗi)
- evaluations (mảng các {factor, grade, reason, evidence})
- similarJobsComparison (chuỗi)
- overallSummary (chuỗi)

JD:
${jdText}`;
}

function renderResult(data){
  resultWrap.classList.remove("hidden");
  const parts = [];

  parts.push(`**Chức danh:** ${data.jobTitle || ""}`);

  if (Array.isArray(data.evaluations)){
    const rows = data.evaluations.map((it,i)=> 
      `${i+1}. ${it.factor} — [${it.grade}]\nLý do: ${it.reason}\nDẫn chứng: "${it.evidence}"`)
      .join("\n\n");
    parts.push("\n### Bảng đánh giá\n" + rows);
  }

  if (data.similarJobsComparison){
    parts.push("\n### Các JD tương đồng\n" + data.similarJobsComparison);
  }
  if (data.overallSummary){
    parts.push("\n### Nhận xét tổng quan\n" + data.overallSummary);
  }

  resultContent.textContent = parts.join("\n\n");
}

// ---------- S-Grade ----------
const tbody = $("#sgradeTbody");
const filterRank = $("#filterRank");
const filterTerm = $("#filterTerm");
const importBtn = $("#btnImportXlsx");
const exportBtn = $("#btnExportXlsx");
const downloadTplBtn = $("#btnDownloadTpl");
const hiddenImport = $("#hiddenImport");

let sgradeData = [];
let filtered = [];

async function loadSgrade(){
  try{
    const res = await fetch("sgrade.json", {cache:"no-store"});
    sgradeData = await res.json();
  }catch{
    sgradeData = [
      {id:1, positionName:"Sample Position", vietnameseName:"Vị Trí Mẫu", positionType:"Indirect", rank:"S7"},
      {id:2, positionName:"Junior Accountant", vietnameseName:"Kế toán viên", positionType:"Indirect", rank:"S3"},
    ];
  }
  populateRanks();
  applyFilter();
}
function populateRanks(){
  const set = new Set(["all"]);
  sgradeData.forEach(j => set.add(j.rank));
  filterRank.innerHTML = "";
  set.forEach(v=>{
    const opt = document.createElement("option");
    opt.value = v; opt.textContent = v === "all" ? "Tất cả" : v;
    filterRank.appendChild(opt);
  });
}
function applyFilter(){
  const term = filterTerm.value.trim().toLowerCase();
  const r = filterRank.value;
  filtered = sgradeData.filter(j=>{
    const okRank = (r==="all" || j.rank === r);
    const okTerm = !term || j.positionName.toLowerCase().includes(term)
                 || j.vietnameseName.toLowerCase().includes(term);
    return okRank && okTerm;
  });
  renderTable();
}
function renderTable(){
  tbody.innerHTML = "";
  filtered.forEach(job=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${job.positionName}</td>
      <td>${job.vietnameseName||""}</td>
      <td>${job.positionType||""}</td>
      <td>${job.rank}</td>
    `;
    tbody.appendChild(tr);
  });
}
filterTerm?.addEventListener("input", applyFilter);
filterRank?.addEventListener("change", applyFilter);

downloadTplBtn?.addEventListener("click", ()=>{
  const header = ["positionName","vietnameseName","positionType","rank"];
  const example = ["Sample Position","Vị Trí Mẫu","Indirect","S7"];
  const ws = XLSX.utils.aoa_to_sheet([header, example]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Template");
  XLSX.writeFile(wb, "s_grade_template.xlsx");
});
importBtn?.addEventListener("click", ()=> hiddenImport.click());
hiddenImport?.addEventListener("change", async (e)=>{
  const file = e.target.files?.[0]; if(!file) return;
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws);
  const imported = rows.map(r=>({
    id: Date.now()+Math.random(),
    positionName: String(r.positionName||"").trim(),
    vietnameseName: String(r.vietnameseName||"").trim(),
    positionType: String(r.positionType||"").trim(),
    rank: String(r.rank||"").trim()
  })).filter(x=>x.positionName && x.rank);
  sgradeData = sgradeData.concat(imported);
  populateRanks(); applyFilter();
  hiddenImport.value = "";
});
exportBtn?.addEventListener("click", ()=>{
  const header = ["positionName","vietnameseName","positionType","rank"];
  const rows = filtered.map(j=>[j.positionName,j.vietnameseName||"",j.positionType||"",j.rank]);
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "S-Grade");
  XLSX.writeFile(wb, "s_grade_export.xlsx");
});

loadSgrade();
