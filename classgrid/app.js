const PARSE_ENDPOINT = '/.netlify/functions/parse-schedule';
const STORAGE_KEY = 'classgrid.schedule.v1';
const DAY_ORDER = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const TODAY_DAY = DAY_ORDER[(new Date().getDay() + 6) % 7]; // JS Sun=0 -> Mon-first order
const PALETTE = ['#3B6FD9','#1F8A73','#6C4BD9','#D9455F','#E07B39','#2AA8A0','#C0392B','#8E5AE0'];

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
const addHeroBtn = document.getElementById('add-btn-hero');
const netStatus = document.getElementById('net-status');
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

let activeDay = null;
let editingIndex = null;

// ---------- storage ----------
function loadSchedule(){
  try{ return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch(e){ return []; }
}
function saveSchedule(entries){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

// ---------- upload flow ----------
dropzone.addEventListener('click', () => {
  if(dropzone.classList.contains('loading')) return;
  fileInput.click();
});
dropzone.addEventListener('keydown', (e) => {
  if(e.key === 'Enter' || e.key === ' '){
    e.preventDefault();
    if(!dropzone.classList.contains('loading')) fileInput.click();
  }
});
['dragover','dragenter'].forEach(evt =>
  dropzone.addEventListener(evt, e => { e.preventDefault(); if(!dropzone.classList.contains('loading')) dropzone.classList.add('drag'); })
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
  statusEl.className = 'status-line' + (kind ? ' ' + kind : '');
}

function setUploadBusy(isBusy){
  dropzone.classList.toggle('loading', isBusy);
  dropzone.setAttribute('aria-busy', String(isBusy));
}

async function handleFile(file){
  thumbEl.src = URL.createObjectURL(file);
  thumbEl.style.display = 'block';
  setUploadBusy(true);

  if(!navigator.onLine){
    setStatus('You are offline — connect once to scan a new COR. Existing schedule still works below.', 'err');
    setUploadBusy(false);
    return;
  }

  setStatus('Reading image…');
  try{
    const base64 = await fileToBase64(file);
    setStatus('Parsing schedule…');
    const res = await fetch(PARSE_ENDPOINT, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ image: base64, mediaType: file.type || 'image/jpeg' })
    });
    if(!res.ok) throw new Error('Server returned ' + res.status);
    const data = await res.json();
    if(!data.entries || !data.entries.length) throw new Error('No subjects detected');

    const existing = loadSchedule();
    const merged = existing.length
      ? (confirm(`Found ${data.entries.length} class sessions. Replace your current schedule? (Cancel = add to it)`)
          ? data.entries
          : existing.concat(data.entries))
      : data.entries;

    saveSchedule(merged);
    render();
    setStatus(`Added ${data.entries.length} sessions.`, 'ok');
  }catch(err){
    console.error(err);
    setStatus('Could not parse that image: ' + err.message, 'err');
  }finally{
    setUploadBusy(false);
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

function renderSummary(entries){
  const countEl = document.getElementById('stat-count');
  const todayEl = document.getElementById('stat-today');
  const nextEl = document.getElementById('stat-next');

  countEl.textContent = entries.length;
  todayEl.textContent = entries.filter(e => e.day === TODAY_DAY).length;

  const now = new Date();
  const nowMinutes = now.getHours()*60 + now.getMinutes();
  const todayIndex = DAY_ORDER.indexOf(TODAY_DAY);
  const upcoming = entries
    .map(e => ({ ...e, dayIndex: DAY_ORDER.indexOf(e.day), startMin: timeToMinutes(e.start) }))
    .filter(e => e.dayIndex > todayIndex || (e.dayIndex === todayIndex && e.startMin >= nowMinutes))
    .sort((a,b) => a.dayIndex - b.dayIndex || a.startMin - b.startMin)[0];

  nextEl.textContent = upcoming ? `${upcoming.subject} · ${fmt(upcoming.start)}` : '—';
}

// ---------- rendering ----------
function render(){
  const entries = loadSchedule();
  const days = usedDays(entries);

  renderSummary(entries);

  if(!days.length){
    weeklyViewEl.innerHTML = '<div class="empty-note">No classes yet — scan your COR above, or add one manually.</div>';
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
    const label = h < 12 ? `${h===0?12:h}a` : `${h===12?12:h-12}p`;
    hourLabels += `<div class="label" style="top:${top}px;">${label}</div>`;
  }

  const headers = days.map(d => `
    <div style="flex:1;min-width:110px;">
      <div class="day-header${d===TODAY_DAY?' today':''}">${d}${d===TODAY_DAY?'<span class="dot"></span>':''}</div>
    </div>`).join('');

  const cols = days.map(day => {
    const dayEntries = entries.map((e,i)=>({...e,_idx:i})).filter(e => e.day === day);
    const blocks = dayEntries.map(e => {
      const top = (timeToMinutes(e.start) - minStart) * pxPerMin;
      const height = Math.max((timeToMinutes(e.end) - timeToMinutes(e.start)) * pxPerMin, 44);
      const isNow = day === TODAY_DAY && nowMinutes >= timeToMinutes(e.start) && nowMinutes < timeToMinutes(e.end);
      return `<div class="week-block" data-idx="${e._idx}" style="top:${top}px;height:${height}px;background:${colorForSubject(e.subject)};">
        <div class="pill">${fmt(e.start)}–${fmt(e.end)}</div>
        <div class="code">${escapeHtml(e.subject)}</div>
        <div class="room">${escapeHtml(e.room || '')}</div>
        ${isNow ? '<div class="now-badge">Now</div>' : ''}
      </div>`;
    }).join('');
    return `<div class="day-col" style="height:${totalHeight}px;">${blocks}</div>`;
  }).join('');

  weeklyViewEl.innerHTML = `
    <div class="week-scroll">
      <div class="week-headers">
        <div style="width:38px;flex-shrink:0;"></div>
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
    dayViewEl.innerHTML = '<div class="empty-note">No classes this day.</div>';
    return;
  }
  dayViewEl.innerHTML = dayEntries.map(e => `
    <div class="block ${e.type === 'lab' ? 'lab' : ''}" data-idx="${e._idx}">
      <div>
        <div class="time">${fmt(e.start)} – ${fmt(e.end)}</div>
        <div class="code">${escapeHtml(e.subject || '')}</div>
        <div class="desc">${escapeHtml(e.desc || e.section || '')}</div>
        <div class="room">${escapeHtml(e.room || '')}</div>
      </div>
      <div class="edit-hint">tap to edit</div>
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
        <div><strong>${escapeHtml(e.subject || '')}</strong></div>
        <div class="meta">${e.day} · ${fmt(e.start)}-${fmt(e.end)} · ${escapeHtml(e.room || '')}</div>
      </div>
      <button class="danger" data-idx="${i}">Remove</button>
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
    sheetTitle.textContent = 'Edit class';
    fSubject.value = e.subject || '';
    fDesc.value = e.desc || e.section || '';
    fDay.value = e.day;
    fType.value = e.type || 'lec';
    fStart.value = e.start;
    fEnd.value = e.end;
    fRoom.value = e.room || '';
  }else{
    sheetTitle.textContent = 'Add class';
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
addHeroBtn.addEventListener('click', () => openForm());
document.getElementById('cancel-btn').addEventListener('click', closeForm);
overlay.addEventListener('click', (ev) => { if(ev.target === overlay) closeForm(); });

document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', () => {
    document.querySelectorAll('.nav-link').forEach(btn => btn.classList.remove('active'));
    link.classList.add('active');
    const targetId = link.dataset.target;
    const target = document.getElementById(targetId);
    if(target) target.scrollIntoView({behavior: 'smooth', block: 'start'});
  });
});

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
    alert('End time must be after start time.');
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
  if(confirm('Clear your entire schedule?')){
    saveSchedule([]);
    render();
  }
});

// ---------- weekly / daily toggle ----------
tabWeekly.addEventListener('click', () => {
  tabWeekly.classList.add('active'); tabDaily.classList.remove('active');
  weeklyViewEl.style.display = ''; dailyViewEl.style.display = 'none';
});
tabDaily.addEventListener('click', () => {
  tabDaily.classList.add('active'); tabWeekly.classList.remove('active');
  dailyViewEl.style.display = ''; weeklyViewEl.style.display = 'none';
});

// ---------- network status ----------
function updateNetStatus(){
  netStatus.textContent = navigator.onLine ? 'online' : 'offline-ready';
}
window.addEventListener('online', updateNetStatus);
window.addEventListener('offline', updateNetStatus);
updateNetStatus();

// ---------- service worker ----------
if('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(console.error);
  });
}

render();
