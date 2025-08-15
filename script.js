// ====== CONFIG ======
// Thay bằng link API bạn lấy ở Google AI Studio
// Ví dụ: https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=AIza...
const GEMINI_API_URL = "AIzaSyD9fDIYcMI_juMCXsoz8StSTOSvPUPid1w";

// ====== Tabs ======
const tabBtns = document.querySelectorAll('.tab-btn');
const tabEvaluate = document.getElementById('tab-evaluate');
const tabSgrade = document.getElementById('tab-sgrade');
tabBtns.forEach(btn=>btn.addEventListener('click',(e)=>{
  tabBtns.forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  if(btn.dataset.tab==='evaluate'){ tabEvaluate.classList.remove('hidden'); tabSgrade.classList.add('hidden'); }
  else { tabSgrade.classList.remove('hidden'); tabEvaluate.classList.add('hidden'); }
}));

// ====== Upload UX ======
const dropArea = document.getElementById('dropArea');
const fileInput = document.getElementById('fileInput');
const fileMeta = document.getElementById('fileMeta');

dropArea.addEventListener('click',()=>fileInput.click());
;['dragenter','dragover'].forEach(ev=>dropArea.addEventListener(ev,(e)=>{e.preventDefault(); dropArea.classList.add('ring-2','ring-emerald-500');}));
;['dragleave','drop'].forEach(ev=>dropArea.addEventListener(ev,(e)=>{e.preventDefault(); dropArea.classList.remove('ring-2','ring-emerald-500');}));
dropArea.addEventListener('drop',(e)=>{
  const f = e.dataTransfer.files?.[0]; if(f) setFile(f);
});
fileInput.addEventListener('change',e=>{
  const f = e.target.files?.[0]; if(f) setFile(f);
});
function setFile(f){
  fileInput.files = new DataTransfer().files; // just keep UX
  fileMeta.textContent = `Đã chọn: ${f.name} (${(f.size/1024).toFixed(1)} KB)`;
  fileMeta.classList.remove('hidden');
  dropArea.dataset.filename = f.name;
  dropArea.dataset.filesize = f.size;
  dropArea._file = f;
}

// ====== Buttons ======
document.getElementById('btnClear').addEventListener('click',()=>{
  document.getElementById('jobTitle').value='';
  fileInput.value=''; dropArea._file=null;
  document.getElementById('resultWrap').classList.add('hidden');
  fileMeta.classList.add('hidden');
});

document.getElementById('btnEval').addEventListener('click', evaluateJD);

// ====== Evaluate ======
async function readFileText(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=async (e)=>{
      try{
        if(file.type==='application/vnd.openxmlformats-officedocument.wordprocessingml.document'){
          const arrayBuffer=e.target.result;
          const res = await window.mammoth.extractRawText({arrayBuffer});
          resolve(res.value);
        }else{
          resolve(e.target.result);
        }
      }catch(err){reject(err);}
    };
    reader.onerror=reject;
    if(file.name.endsWith('.docx')) reader.readAsArrayBuffer(file);
    else reader.readAsText(file,'UTF-8');
  });
}

async function evaluateJD(){
  const title = document.getElementById('jobTitle').value.trim();
  const file = dropArea._file;
  if(!title){toast('Vui lòng nhập tên vị trí công việc'); return;}
  if(!file){toast('Vui lòng tải lên file JD (.docx hoặc .txt)'); return;}

  let jdText='';
  try{ jdText = await readFileText(file); }
  catch(e){ toast('Không đọc được file JD'); return; }

  // Build prompt (rút gọn; có thể gắn pwcPrompt nếu muốn)
  const prompt = `Bạn là chuyên gia đánh giá JD theo PwC. Vị trí: ${title}. Nội dung JD:\n\n${jdText}\n\nHãy tóm tắt ngắn gọn và liệt kê 5 điểm chính.`;

  // Call Gemini (JSON response emulation via text)
  showLoading();
  try{
    const res = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }]}] })
    });
    if(!res.ok){ throw new Error('API lỗi: ' + res.status); }
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.map(p=>p.text).join('\n') || 'Không có nội dung phù hợp.';
    renderResult(title, text);
  }catch(err){
    renderError(err.message || 'Gọi API thất bại');
  }
}

function showLoading(){
  const wrap = document.getElementById('resultWrap');
  wrap.classList.remove('hidden');
  wrap.querySelector('#currentPane').innerHTML = `<div class="result-card"><div class="animate-pulse h-4 bg-gray-700 rounded w-1/3 mb-3"></div><div class="space-y-2"><div class="h-3 bg-gray-700 rounded"></div><div class="h-3 bg-gray-700 rounded w-5/6"></div><div class="h-3 bg-gray-700 rounded w-2/3"></div></div></div>`;
}

function renderResult(title, text){
  const wrap = document.getElementById('resultWrap');
  wrap.classList.remove('hidden');
  document.querySelector('[data-swap="current"]').classList.add('active');
  document.querySelector('[data-swap="history"]').classList.remove('active');
  document.getElementById('historyPane').classList.add('hidden');
  document.getElementById('currentPane').classList.remove('hidden');

  const html = `<div class="result-card space-y-3">
    <div class="card-title text-emerald-400">${escapeHtml(title)}</div>
    <div class="text-gray-300 whitespace-pre-wrap">${escapeHtml(text)}</div>
  </div>`;
  document.getElementById('currentPane').innerHTML = html;
  pushHistory(title, text);
}

function renderError(msg){
  const wrap = document.getElementById('resultWrap'); wrap.classList.remove('hidden');
  document.getElementById('currentPane').innerHTML = `<div class="result-card border-red-700" style="border-color:#b91c1c"><div class="text-red-300 font-bold mb-2">Lỗi</div><div class="text-red-200">${escapeHtml(msg)}</div></div>`;
}

function escapeHtml(str){return str.replace(/[&<>"']/g,(m)=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));}

// ====== History (client-side) ======
const swapBtns = document.querySelectorAll('#tabsEvalHistory .pill');
swapBtns.forEach(b=>b.addEventListener('click',()=>{
  swapBtns.forEach(x=>x.classList.remove('active'));
  b.classList.add('active');
  const isHistory = b.dataset.swap==='history';
  document.getElementById('historyPane').classList.toggle('hidden',!isHistory);
  document.getElementById('currentPane').classList.toggle('hidden',isHistory);
}));

function pushHistory(title, text){
  const pane = document.getElementById('historyPane');
  const item = document.createElement('div');
  item.className='result-card space-y-2';
  item.innerHTML = `<div class="card-title">${escapeHtml(title)}</div><div class="text-sm text-gray-400 whitespace-pre-wrap">${escapeHtml(text)}</div>`;
  pane.prepend(item);
}

// ====== Toast ======
function toast(msg){
  const t = document.createElement('div');
  t.className = 'fixed top-4 right-4 bg-gray-900 border border-gray-700 text-gray-100 px-4 py-2 rounded-lg shadow-lg';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(()=>t.remove(), 2500);
}

// (Optional) S-Grade table init từ JSON trong repo
fetch('sgrade.json').then(r=>r.json()).then(data=>{
  const table = document.getElementById('sgradeTable');
  const header = `<thead class="bg-gray-800/50"><tr>
    <th class="table-cell text-left text-xs font-bold text-gray-400 uppercase">Tên vị trí</th>
    <th class="table-cell text-left text-xs font-bold text-gray-400 uppercase">Tên Tiếng Việt</th>
    <th class="table-cell text-left text-xs font-bold text-gray-400 uppercase">Loại vị trí</th>
    <th class="table-cell text-left text-xs font-bold text-gray-400 uppercase">Cấp bậc</th>
  </tr></thead>`;
  const rows = (data||[]).map(j=>`<tr class="hover:bg-gray-800/50">
    <td class="table-cell text-emerald-400">${escapeHtml(j.positionName||'')}</td>
    <td class="table-cell">${escapeHtml(j.vietnameseName||'')}</td>
    <td class="table-cell">${escapeHtml(j.positionType||'')}</td>
    <td class="table-cell">${escapeHtml(j.rank||'')}</td>
  </tr>`).join('');
  table.innerHTML = header + `<tbody class="bg-[#1f2937] divide-y divide-gray-700">${rows}</tbody>`;
}).catch(()=>{});
