const PARSE_ENDPOINT = '/.netlify/functions/parse-schedule';
const STORAGE_KEY = 'classgrid.schedule.v1';
const DAY_ORDER = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const TODAY_DAY = DAY_ORDER[(new Date().getDay() + 6) % 7]; // JS Sun=0 -> Mon-first order
const PALETTE = ['#4F46E5','#0EA5E9','#10B981','#D9455F','#F59E0B','#2AA8A0','#8B5CF6','#EC4899'];

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const statusEl = document.getElementById('status');
const thumbEl = document.getElementById('thumb');
const weeklyViewEl = document.getElementById('weekly-view');
const dailyViewEl = document.getElementById('daily-view');
const dayTabsEl = document.getElementById('day-tabs');
const dayViewEl = document.getElementById('day-view');
const courseList = document.getElementById('course-list');
const clearBtn = document.getElementById('clear-btn');
const addBtn = document.getElementById('add-btn');
const netStatus = document.getElementById('net-status');
const netPulse = document.getElementById('net-pulse');
const tabWeekly = document.getElementById('tab-weekly');
const tabDaily = document.getElementById('tab-daily');

const overlay = document.getElementById('overlay');
const sheetTitle = document.getElementById('sheet-title');
const form = document.getElementById('entry-form');
const fSubject = document.getElementById('f-subject');
const fDesc = document.getElementById('f-desc');
const fDay = document.getElementById('f-day');
const fType = document.getElementById('f-type');
const fStart = document.getElementById('f-start');
const fEnd = document.getElementById('f-end');
const fRoom = document.getElementById('f-room');

// Dynamic Live Metric Elements
const statClasses = document.getElementById('stat-classes');
const statLabs = document.getElementById('stat-labs');

let activeDay = null;
let editingIndex = null;

// ---------- storage ----------
function loadSchedule(){
  try{ return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch(e){ return []; }
}
function saveSchedule(entries){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  updateGlobalMetrics(entries);
}

// Update Premium SaaS Analytical Dashboard Counters Accurately
function updateGlobalMetrics(entries) {
  if(!statClasses || !statLabs) return;
  statClasses.textContent = entries.length;
  const labCount = entries.filter(e => e.type === 'lab').length;
  statLabs.textContent = labCount;
}

// ---------- upload flow ----------
dropzone.addEventListener('click', () => fileInput.click());
['dragover','dragenter'].forEach(evt =>
  dropzone.addEventListener(evt, e => { e.preventDefault(); dropzone.classList.add('drag'); })
);
['dragleave','drop'].forEach(evt =>
  dropzone.addEventListener(evt, e => { e.preventDefault(); dropzone.classList.remove('drag'); })
);
dropzone.addEventListener('drop', e => {
  const file = e.dataTransfer.files[0];
  if(file) handleFile(file);
});
fileInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if(file) handleFile(file);
});

function setStatus(msg, kind){
  statusEl.textContent = msg;
  const parent = statusEl.parentElement;
  if (parent) {
    parent.className = 'status-line-container' + (kind ? ' ' + kind : '');
  }
}

async function handleFile(file){
  thumbEl.src = URL.createObjectURL(file);
  thumbEl.style.display = 'block';

  if(!navigator.onLine){
    setStatus('Offline state active — reconnect network to perform autonomous document ingestion analysis.', 'err');
    return;
  }

  setStatus('Reading uploaded source data document channels…', 'loading');
  try{
    const base64 = await fileToBase64(file);
    setStatus('Transmitting payload data array to AI engine core rules matrices…', 'loading');
    const res = await fetch(PARSE_ENDPOINT, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ image: base64, mediaType: file.type || 'image/jpeg' })
    });
    if(!res.ok) throw new Error('Server returned ' + res.status);
    const data = await res.json();
    if(!data.entries || !data.entries.length) throw new Error('No discrete structural academic sessions verified');

    const existing = loadSchedule();
    const merged = existing.length
      ? (confirm(`Discovered ${data.entries.length} valid entries. Overwrite current local system manifest data rules maps entirely? (Cancel merges new streams into database)`)
          ? data.entries
          : existing.concat(data.entries))
      : data.entries;

    saveSchedule(merged);
    render();
    setStatus(`Successfully ingested and mapped ${data.entries.length} structural items cleanly.`, 'ok');
  }catch(err){
    console.error(err);
    setStatus('Ingestion process terminal failure error encountered: ' + err.message, 'err');
  }
}

function fileToBase64(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ---------- helpers ----------
function fmt(t){
  const [h,m] = t.split(':').map(Number);
  const suffix = h < 12 ? 'AM' : 'PM';
  const h12 = (h % 12) || 12;
  return `${h12}:${String(m).padStart(2,'0')} ${suffix}`;
}
function timeToMinutes(t){
  const [h,m] = t.split(':').map(Number);
  return h*60 + m;
}
function usedDays(entries){
  return DAY_ORDER.filter(d => entries.some(e => e.day === d));
}
function colorForSubject(subject){
  let hash = 0;
  for(let i=0;i<subject.length;i++) hash = (hash*31 + subject.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ---------- rendering ----------
function render(){
  const entries = loadSchedule();
  const days = usedDays(entries);
  
  updateGlobalMetrics(entries);

  if(!days.length){
    weeklyViewEl.innerHTML = '<div class="empty-note"><svg width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>No course structural records detected inside the dynamic system storage indices framework yet. Ingest your COR above to build out the schedule map grid automatically.</div>';
    dayTabsEl.innerHTML = '';
    dayViewEl.innerHTML = '';
    courseList.innerHTML = '';
    return;
  }

  if(!activeDay || !days.includes(activeDay)) activeDay = days.includes(TODAY_DAY) ? TODAY_DAY : days[0];

  renderWeekly(entries, days);
  renderTabs(entries, days);
  renderDay(entries);
  renderList(entries);
}

function renderWeekly(entries, days){
  let minStart = Math.min(...entries.map(e => timeToMinutes(e.start)));
  let maxEnd = Math.max(...entries.map(e => timeToMinutes(e.end)));
  minStart = Math.floor(minStart/60)*60;
  maxEnd = Math.ceil(maxEnd/60)*60;
  const pxPerMin = 1.3;
  const totalHeight = (maxEnd - minStart) * pxPerMin;

  const now = new Date();
  const nowMinutes = now.getHours()*60 + now.getMinutes();

  let hourLabels = '';
  for(let m = minStart; m <= maxEnd; m += 120){
    const top = (m - minStart) * pxPerMin;
    const h = Math.floor(m/60);
    const label = h < 12 ? `${h===0?12:h} AM` : `${h===12?12:h-12} PM`;
    hourLabels += `<div class="label" style="top:${top}px;">${label}</div>`;
  }

  const headers = days.map(d => `
    <div class="day-header-wrapper">
      <div class="day-header${d===TODAY_DAY?' today':''}">${d}${d===TODAY_DAY?'<span class="dot"></span>':''}</div>
    </div>`).join('');

  const cols = days.map(day => {
    const dayEntries = entries.map((e,i)=>({...e,_idx:i})).filter(e => e.day === day);
    const blocks = dayEntries.map(e => {
      const top = (timeToMinutes(e.start) - minStart) * pxPerMin;
      const height = Math.max((timeToMinutes(e.end) - timeToMinutes(e.start)) * pxPerMin, 54);
      const isNow = day === TODAY_DAY && nowMinutes >= timeToMinutes(e.start) && nowMinutes < timeToMinutes(e.end);
      return `<div class="week-block" data-idx="${e._idx}" style="top:${top}px;height:${height}px;background-color:${colorForSubject(e.subject)};">
        <div>
          <div class="pill">${fmt(e.start)} – ${fmt(e.end)}</div>
          <div class="code">${escapeHtml(e.subject)}</div>
        </div>
        <div class="room">${escapeHtml(e.room || 'N/A')}</div>
        ${isNow ? '<div class="now-badge">ACTIVE</div>' : ''}
      </div>`;
    }).join('');
    return `<div class="day-col" style="height:${totalHeight}px;">${blocks}</div>`;
  }).join('');

  weeklyViewEl.innerHTML = `
    <div class="week-scroll">
      <div class="week-headers">
        <div style="width:54px;flex-shrink:0;background:white;border-right:1px solid var(--slate-200);"></div>
        ${headers}
      </div>
      <div class="week-body">
        <div class="time-axis" style="height:${totalHeight}px;">${hourLabels}</div>
        ${cols}
      </div>
    </div>`;

  weeklyViewEl.querySelectorAll('.week-block').forEach(el => {
    el.addEventListener('click', () => openForm(Number(el.dataset.idx)));
  });
}

function renderTabs(entries, days){
  dayTabsEl.innerHTML = days.map(d =>
    `<div class="day-tab${d===activeDay?' active':''}" data-day="${d}">${d}</div>`
  ).join('');
  dayTabsEl.querySelectorAll('.day-tab').forEach(el => {
    el.addEventListener('click', () => { activeDay = el.dataset.day; render(); });
  });
}

function renderDay(entries){
  const dayEntries = entries
    .map((e, i) => ({...e, _idx: i}))
    .filter(e => e.day === activeDay)
    .sort((a,b) => a.start.localeCompare(b.start));
  if(!dayEntries.length){
    dayViewEl.innerHTML = '<div class="empty-note">No scheduled items verified active on this calendar indexes vector channel.</div>';
    return;
  }
  dayViewEl.innerHTML = dayEntries.map(e => `
    <div class="block ${e.type === 'lab' ? 'lab' : ''}" data-idx="${e._idx}">
      <div class="block-main-details">
        <div class="time">${fmt(e.start)} – ${fmt(e.end)}</div>
        <div class="code">${escapeHtml(e.subject || '')}</div>
        <div class="desc">${escapeHtml(e.desc || e.section || '')}</div>
        <div class="room">${escapeHtml(e.room || 'Unassigned Workspace')}</div>
      </div>
      <div class="edit-hint">Modify Tracked Parameters</div>
    </div>`).join('');
  dayViewEl.querySelectorAll('.block').forEach(el => {
    el.addEventListener('click', () => openForm(Number(el.dataset.idx)));
  });
}

function renderList(entries){
  if(!entries.length){ courseList.innerHTML = ''; return; }
  courseList.innerHTML = entries.map((e, i) => `
    <div class="course-row">
      <div>
        <div class="course-title-label">${escapeHtml(e.subject || 'Untagged Block')}</div>
        <div class="meta">${e.day} · ${fmt(e.start)} - ${fmt(e.end)} · ${escapeHtml(e.room || 'No Room')}</div>
      </div>
      <button class="btn btn-danger-mini" data-idx="${i}">Remove Entry</button>
    </div>`).join('');

  courseList.querySelectorAll('button[data-idx]').forEach(btn => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const idx = Number(btn.dataset.idx);
      const entries = loadSchedule();
      entries.splice(idx, 1);
      saveSchedule(entries);
      render();
    });
  });
}

// ---------- add / edit sheet ----------
function openForm(idx){
  const entries = loadSchedule();
  editingIndex = (idx === undefined) ? null : idx;
  if(editingIndex !== null){
    const e = entries[editingIndex];
    sheetTitle.textContent = 'Modify Course Parameters';
    fSubject.value = e.subject || '';
    fDesc.value = e.desc || e.section || '';
    fDay.value = e.day;
    fType.value = e.type || 'lec';
    fStart.value = e.start;
    fEnd.value = e.end;
    fRoom.value = e.room || '';
  }else{
    sheetTitle.textContent = 'Append New Class Parameters Block';
    form.reset();
    fDay.value = activeDay || 'Mon';
    fType.value = 'lec';
  }
  overlay.classList.add('open');
}
function closeForm(){
  overlay.classList.remove('open');
  editingIndex = null;
}

addBtn.addEventListener('click', () => openForm());
document.getElementById('cancel-btn').addEventListener('click', closeForm);
overlay.addEventListener('click', (ev) => { if(ev.target === overlay) closeForm(); });

form.addEventListener('submit', (ev) => {
  ev.preventDefault();
  const entry = {
    subject: fSubject.value.trim(),
    desc: fDesc.value.trim(),
    day: fDay.value,
    type: fType.value,
    start: fStart.value,
    end: fEnd.value,
    room: fRoom.value.trim()
  };
  if(entry.end <= entry.start){
    alert('Terminal finish parameters timestamp matrix must conclude after initialization starting boundary timeline parameters.');
    return;
  }
  const entries = loadSchedule();
  if(editingIndex !== null){
    entries[editingIndex] = entry;
  }else{
    entries.push(entry);
  }
  saveSchedule(entries);
  activeDay = entry.day;
  closeForm();
  render();
});

clearBtn.addEventListener('click', () => {
  if(confirm('Purge total local relational array database indices maps definitively? This action is non-reversible.')){
    saveSchedule([]);
    render();
  }
});

// ---------- weekly / daily navigation handler panel switch toggles ----------
tabWeekly.addEventListener('click', () => {
  tabWeekly.classList.add('active'); tabDaily.classList.remove('active');
  weeklyViewEl.style.display = ''; dailyViewEl.style.display = 'none';
});
tabDaily.addEventListener('click', () => {
  tabDaily.classList.add('active'); tabWeekly.classList.remove('active');
  dailyViewEl.style.display = ''; weeklyViewEl.style.display = 'none';
});

// ---------- network status tracker system ----------
function updateNetStatus(){
  const isOnline = navigator.onLine;
  netStatus.textContent = isOnline ? 'Network Standby' : 'Offline Local Mode';
  if(isOnline) {
    netPulse.className = 'status-pulse-dot online';
  } else {
    netPulse.className = 'status-pulse-dot offline';
  }
}
window.addEventListener('online', updateNetStatus);
window.addEventListener('offline', updateNetStatus);
updateNetStatus();

// ---------- service worker deployment setup initialization ----------
if('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(console.error);
  });
}

render();
