const PARSE_ENDPOINT = '/.netlify/functions/parse-schedule';
const STORAGE_KEY = 'classgrid.schedule.v1';
const DAY_ORDER = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const DAY_FULL = { Mon:'Monday', Tue:'Tuesday', Wed:'Wednesday', Thu:'Thursday', Fri:'Friday', Sat:'Saturday', Sun:'Sunday' };
const TODAY_DAY = DAY_ORDER[(new Date().getDay() + 6) % 7]; // JS Sun=0 -> Mon-first order
const PALETTE = ['var(--p1)','var(--p2)','var(--p3)','var(--p4)','var(--p5)','var(--p6)','var(--p7)','var(--p8)'];

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
const netStatusEls = document.querySelectorAll('.net-status');
const tabWeekly = document.getElementById('tab-weekly');
const tabDaily = document.getElementById('tab-daily');

const greetingEl = document.getElementById('greeting');
const greetingSubEl = document.getElementById('greeting-sub');
const statTotalEl = document.getElementById('stat-total');
const statTodayEl = document.getElementById('stat-today');
const statNextTitleEl = document.getElementById('stat-next-title');
const statNextSubEl = document.getElementById('stat-next-sub');
const statHoursEl = document.getElementById('stat-hours');

const overlay = document.getElementById('overlay');
const sheetTitle = document.getElementById('sheet-title');
const form = document.getElementById('entry-form');
const fSubject = document.getElementById('f-subject');
const fSection = document.getElementById('f-section');
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
dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('keydown', e => {
  if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); fileInput.click(); }
});
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

const STATUS_ICONS = {
  loading: '<span class="spinner" aria-hidden="true"></span>',
  ok: '<svg class="status-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  err: '<svg class="status-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.75"/><path d="M12 8v5M12 16h.01" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg>'
};

function setStatus(msg, kind){
  statusEl.className = 'status-line' + (kind ? ' ' + kind : '');
  if(!msg){ statusEl.innerHTML = ''; return; }
  const icon = STATUS_ICONS[kind] || '';
  statusEl.innerHTML = icon + '<span>' + escapeHtml(msg) + '</span>';
}

async function handleFile(file){
  thumbEl.src = URL.createObjectURL(file);
  thumbEl.style.display = 'block';

  if(!navigator.onLine){
    setStatus('You are offline — connect once to scan a new COR. Existing schedule still works below.', 'err');
    return;
  }

  setStatus('Reading image…', 'loading');
  try{
    const base64 = await fileToBase64(file);
    setStatus('Parsing schedule with AI…', 'loading');
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
    setStatus(`Added ${data.entries.length} sessions to your schedule.`, 'ok');
  }catch(err){
    console.error(err);
    setStatus('Could not parse that image: ' + err.message, 'err');
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
function formatDuration(totalMinutes){
  const h = Math.floor(totalMinutes/60);
  const m = totalMinutes % 60;
  if(h <= 0) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}
// Builds the "CRI 169 · Sec A" style label used across every view.
function subjectLabel(e){
  const subject = escapeHtml(e.subject || '');
  return e.section ? `${subject} <span class="section-tag">Sec ${escapeHtml(e.section)}</span>` : subject;
}

// ---------- rendering ----------
function render(){
  const entries = loadSchedule();
  const days = usedDays(entries);

  updateGreeting(entries);
  updateStats(entries);

  if(!days.length){
    weeklyViewEl.innerHTML = emptyStateHtml(
      'No classes yet',
      'Scan your COR above, or add a class manually to build your week.'
    );
    dayTabsEl.innerHTML = '';
    dayViewEl.innerHTML = emptyStateHtml('No classes yet', 'Scan your COR above, or add a class manually.');
    courseList.innerHTML = '';
    return;
  }

  if(!activeDay || !days.includes(activeDay)) activeDay = days.includes(TODAY_DAY) ? TODAY_DAY : days[0];

  renderWeekly(entries, days);
  renderTabs(entries, days);
  renderDay(entries);
  renderList(entries);
}

function emptyStateHtml(title, sub){
  return `<div class="empty-note">
    <svg class="empty-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="4.5" width="17" height="16" rx="3" stroke="currentColor" stroke-width="1.5"/>
      <path d="M3.5 9.5h17M8 3v3M16 3v3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M9 14l3 3 4.5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.35"/>
    </svg>
    <div class="empty-title">${escapeHtml(title)}</div>
    <div class="empty-sub">${escapeHtml(sub)}</div>
  </div>`;
}

function updateGreeting(entries){
  const hour = new Date().getHours();
  const part = hour < 12 ? 'morning' : (hour < 18 ? 'afternoon' : 'evening');
  greetingEl.textContent = `Good ${part} 👋`;
  greetingSubEl.textContent = entries.length
    ? `You have ${entries.length} class session${entries.length === 1 ? '' : 's'} this week.`
    : `Here's what your week looks like once you add classes.`;
}

function updateStats(entries){
  statTotalEl.textContent = entries.length;

  const todayCount = entries.filter(e => e.day === TODAY_DAY).length;
  statTodayEl.textContent = todayCount;

  const totalMinutes = entries.reduce((sum, e) => sum + Math.max(timeToMinutes(e.end) - timeToMinutes(e.start), 0), 0);
  statHoursEl.textContent = entries.length ? formatDuration(totalMinutes) : '0h';

  const next = findNextClass(entries);
  if(!next){
    statNextTitleEl.textContent = entries.length ? 'No more classes' : 'No classes yet';
    statNextSubEl.textContent = entries.length ? "You're free for the rest of the week." : 'Scan your COR to get started';
    return;
  }
  statNextTitleEl.textContent = `${next.entry.subject || 'Class'} · ${fmt(next.entry.start)}`;
  const when = next.daysAhead === 0 ? 'Today' : (next.daysAhead === 1 ? 'Tomorrow' : DAY_FULL[next.entry.day]);
  statNextSubEl.textContent = `${when}${next.entry.room ? ' · ' + next.entry.room : ''}`;
}

function findNextClass(entries){
  if(!entries.length) return null;
  const now = new Date();
  const nowMinutes = now.getHours()*60 + now.getMinutes();
  const todayIdx = DAY_ORDER.indexOf(TODAY_DAY);

  for(let ahead = 0; ahead <= 7; ahead++){
    const dayIdx = (todayIdx + ahead) % 7;
    const day = DAY_ORDER[dayIdx];
    const candidates = entries
      .filter(e => e.day === day && (ahead > 0 || timeToMinutes(e.start) >= nowMinutes))
      .sort((a,b) => a.start.localeCompare(b.start));
    if(candidates.length) return { entry: candidates[0], daysAhead: ahead };
  }
  return null;
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
  const showNowLine = nowMinutes >= minStart && nowMinutes <= maxEnd;

  let hourLabels = '';
  for(let m = minStart; m <= maxEnd; m += 120){
    const top = (m - minStart) * pxPerMin;
    const h = Math.floor(m/60);
    const label = h < 12 ? `${h===0?12:h}a` : `${h===12?12:h-12}p`;
    hourLabels += `<div class="label" style="top:${top}px;">${label}</div>`;
  }

  const headers = days.map(d => `
    <div style="flex:1;min-width:118px;">
      <div class="day-header${d===TODAY_DAY?' today':''}">${d}${d===TODAY_DAY?'<span class="dot"></span>':''}</div>
    </div>`).join('');

  const cols = days.map(day => {
    const isToday = day === TODAY_DAY;
    const dayEntries = entries.map((e,i)=>({...e,_idx:i})).filter(e => e.day === day);
    const blocks = dayEntries.map(e => {
      const top = (timeToMinutes(e.start) - minStart) * pxPerMin;
      const height = Math.max((timeToMinutes(e.end) - timeToMinutes(e.start)) * pxPerMin, 44);
      const isNow = isToday && nowMinutes >= timeToMinutes(e.start) && nowMinutes < timeToMinutes(e.end);
      return `<div class="week-block" data-idx="${e._idx}" tabindex="0" role="button" aria-label="${escapeHtml(e.subject||'Class')} ${fmt(e.start)} to ${fmt(e.end)}" style="top:${top}px;height:${height}px;background:${colorForSubject(e.subject||'')};cursor:pointer;">
        <div class="pill">${fmt(e.start)}–${fmt(e.end)}</div>
        <div class="code">${subjectLabel(e)}</div>
        <div class="room">${escapeHtml(e.room || '')}</div>
        ${isNow ? '<div class="now-badge">Now</div>' : ''}
      </div>`;
    }).join('');
    const nowLine = (isToday && showNowLine)
      ? `<div class="now-line" style="top:${(nowMinutes - minStart) * pxPerMin}px;"></div>`
      : '';
    return `<div class="day-col${isToday?' is-today':''}" style="height:${totalHeight}px;">${blocks}${nowLine}</div>`;
  }).join('');

  weeklyViewEl.innerHTML = `
    <div class="week-scroll">
      <div class="week-headers">
        <div style="width:44px;flex-shrink:0;"></div>
        ${headers}
      </div>
      <div class="week-body">
        <div class="time-axis" style="height:${totalHeight}px;">${hourLabels}</div>
        ${cols}
      </div>
    </div>`;

  weeklyViewEl.querySelectorAll('.week-block').forEach(el => {
    el.addEventListener('click', () => openForm(Number(el.dataset.idx)));
    el.addEventListener('keydown', e => {
      if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); openForm(Number(el.dataset.idx)); }
    });
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
    dayViewEl.innerHTML = emptyStateHtml('No classes this day', 'Enjoy the free time, or add a class below.');
    return;
  }
  dayViewEl.innerHTML = dayEntries.map(e => `
    <div class="block ${e.type === 'lab' ? 'lab' : ''}" data-idx="${e._idx}" tabindex="0" role="button">
      <div>
        <div class="time">${fmt(e.start)} – ${fmt(e.end)}</div>
        <div class="code">${subjectLabel(e)}</div>
        ${e.desc ? `<div class="desc">${escapeHtml(e.desc)}</div>` : ''}
        <div class="room">${escapeHtml(e.room || '')}</div>
      </div>
      <div class="edit-hint">tap to edit</div>
    </div>`).join('');
  dayViewEl.querySelectorAll('.block').forEach(el => {
    el.addEventListener('click', () => openForm(Number(el.dataset.idx)));
    el.addEventListener('keydown', e => {
      if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); openForm(Number(el.dataset.idx)); }
    });
  });
}

function renderList(entries){
  if(!entries.length){ courseList.innerHTML = ''; return; }
  courseList.innerHTML = entries.map((e, i) => `
    <div class="course-row">
      <div>
        <div class="title-line"><span class="swatch" style="background:${colorForSubject(e.subject||'')};"></span><strong>${subjectLabel(e)}</strong></div>
        <div class="meta">${e.day} · ${fmt(e.start)}–${fmt(e.end)} · ${escapeHtml(e.room || '')}</div>
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
function clearFormErrors(){
  form.querySelectorAll('.invalid').forEach(el => el.classList.remove('invalid'));
  form.querySelectorAll('.field-error.visible').forEach(el => el.classList.remove('visible'));
}

function openForm(idx){
  const entries = loadSchedule();
  editingIndex = (idx === undefined) ? null : idx;
  clearFormErrors();
  if(editingIndex !== null){
    const e = entries[editingIndex];
    sheetTitle.textContent = 'Edit class';
    fSubject.value = e.subject || '';
    fSection.value = e.section || '';
    fDesc.value = e.desc || '';
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
  window.setTimeout(() => fSubject.focus(), 50);
}
function closeForm(){
  overlay.classList.remove('open');
  editingIndex = null;
}

addBtn.addEventListener('click', () => openForm());
document.getElementById('cancel-btn').addEventListener('click', closeForm);
overlay.addEventListener('click', (ev) => { if(ev.target === overlay) closeForm(); });
document.addEventListener('keydown', ev => {
  if(ev.key === 'Escape' && overlay.classList.contains('open')) closeForm();
});

form.addEventListener('submit', (ev) => {
  ev.preventDefault();
  clearFormErrors();

  let hasError = false;
  if(!fSubject.value.trim()){
    fSubject.classList.add('invalid');
    form.querySelector('[data-error-for="f-subject"]').classList.add('visible');
    hasError = true;
  }
  if(!fStart.value || !fEnd.value || fEnd.value <= fStart.value){
    fStart.classList.add('invalid');
    fEnd.classList.add('invalid');
    form.querySelector('[data-error-for="f-time"]').classList.add('visible');
    hasError = true;
  }
  if(hasError){
    form.querySelector('.invalid').focus();
    return;
  }

  const entry = {
    subject: fSubject.value.trim(),
    section: fSection.value.trim(),
    desc: fDesc.value.trim(),
    day: fDay.value,
    type: fType.value,
    start: fStart.value,
    end: fEnd.value,
    room: fRoom.value.trim()
  };
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
  tabWeekly.classList.add('active'); tabWeekly.setAttribute('aria-selected','true');
  tabDaily.classList.remove('active'); tabDaily.setAttribute('aria-selected','false');
  weeklyViewEl.style.display = ''; dailyViewEl.style.display = 'none';
});
tabDaily.addEventListener('click', () => {
  tabDaily.classList.add('active'); tabDaily.setAttribute('aria-selected','true');
  tabWeekly.classList.remove('active'); tabWeekly.setAttribute('aria-selected','false');
  dailyViewEl.style.display = ''; weeklyViewEl.style.display = 'none';
});

// ---------- network status ----------
function updateNetStatus(){
  const online = navigator.onLine;
  netStatusEls.forEach(el => {
    el.classList.toggle('is-online', online);
    el.classList.toggle('is-offline', !online);
    const textEl = el.querySelector('.status-text');
    if(textEl) textEl.textContent = online ? 'online' : 'offline-ready';
  });
}
window.addEventListener('online', updateNetStatus);
window.addEventListener('offline', updateNetStatus);
updateNetStatus();

// ---------- sidebar / bottom-nav scrollspy ----------
const navSections = ['dashboard','upload','schedule']
  .map(id => document.getElementById(id))
  .filter(Boolean);
const navLinks = document.querySelectorAll('.nav-link, .bottom-link');

if('IntersectionObserver' in window && navSections.length){
  const spy = new IntersectionObserver((entriesList) => {
    entriesList.forEach(entry => {
      if(entry.isIntersecting){
        const id = entry.target.id;
        navLinks.forEach(link => {
          link.classList.toggle('active', link.dataset.section === id);
        });
      }
    });
  }, { rootMargin: '-40% 0px -50% 0px', threshold: 0 });
  navSections.forEach(sec => spy.observe(sec));
}

// ---------- service worker ----------
if('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(console.error);
  });
}

render();
