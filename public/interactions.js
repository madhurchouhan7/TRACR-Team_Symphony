/* ═══════════════════════════════════════════════════════════════════════
   SENTINEL AML — Interaction Layer
   Handles: Modals, Toasts, Notification Panel, Global Search,
            Case Drawer, Tab Filters, Settings Save, Export stubs
   ═══════════════════════════════════════════════════════════════════════ */

// ── 1. TOAST SYSTEM ────────────────────────────────────────────────────
const TOAST_ICONS = { success: 'check_circle', error: 'error', warn: 'warning', info: 'info' };
const TOAST_COLORS = {
  success: 'bg-tertiary-fixed text-on-tertiary-fixed-variant border-tertiary-container',
  error:   'bg-error-container text-on-error-container border-error',
  warn:    'bg-secondary-fixed text-on-secondary-fixed-variant border-secondary',
  info:    'bg-primary-fixed text-on-primary-fixed border-primary'
};

function toast(message, type = 'info', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-2 items-center pointer-events-none';
    document.body.appendChild(container);
  }
  const t = document.createElement('div');
  t.className = `pointer-events-auto flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl border text-sm font-semibold transition-all duration-300 opacity-0 translate-y-2 ${TOAST_COLORS[type]}`;
  t.innerHTML = `<span class="material-symbols-outlined text-lg" style="font-variation-settings:'FILL' 1;">${TOAST_ICONS[type]}</span><span>${message}</span>`;
  container.appendChild(t);
  requestAnimationFrame(() => { t.classList.remove('opacity-0','translate-y-2'); });
  setTimeout(() => {
    t.classList.add('opacity-0','translate-y-2');
    setTimeout(() => t.remove(), 300);
  }, duration);
}

// ── 2. MODAL SYSTEM ────────────────────────────────────────────────────
function openModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.remove('hidden');
  requestAnimationFrame(() => {
    m.querySelector('.modal-panel')?.classList.remove('scale-95','opacity-0');
  });
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  const panel = m.querySelector('.modal-panel');
  if (panel) {
    panel.classList.add('scale-95','opacity-0');
    setTimeout(() => m.classList.add('hidden'), 200);
  } else {
    m.classList.add('hidden');
  }
}

// Close modal on backdrop click
document.addEventListener('click', e => {
  if (e.target.matches('.modal-backdrop')) {
    closeModal(e.target.closest('[id]').id);
  }
});

// ── 3. NEW CASE MODAL ─────────────────────────────────────────────────
function injectNewCaseModal() {
  if (document.getElementById('modal-new-case')) return;
  const html = `
  <div id="modal-new-case" class="hidden fixed inset-0 z-[150] flex items-center justify-center p-4">
    <div class="modal-backdrop absolute inset-0 bg-black/30 backdrop-blur-sm"></div>
    <div class="modal-panel relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8 scale-95 opacity-0 transition-all duration-200">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="text-xl font-extrabold tracking-tight text-slate-900">Initialize New Case</h2>
          <p class="text-sm text-slate-500 mt-0.5">Create a new investigation docket in the Sentinel ledger.</p>
        </div>
        <button onclick="closeModal('modal-new-case')" class="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <div class="space-y-4">
        <div>
          <label class="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Entity / Subject</label>
          <input id="nc-entity" type="text" placeholder="e.g., Global Apex Corp" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all"/>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Risk Level</label>
            <select id="nc-risk" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all">
              <option>Critical</option>
              <option>High</option>
              <option selected>Medium</option>
              <option>Low</option>
            </select>
          </div>
          <div>
            <label class="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Assign Analyst</label>
            <select id="nc-analyst" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all">
              <option>Marcus Chen</option>
              <option>Sarah Jenkins</option>
              <option>David Miller</option>
              <option>Elena Rodriguez</option>
              <option>Unassigned</option>
            </select>
          </div>
        </div>
        <div>
          <label class="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Case Type</label>
          <div class="flex gap-2 flex-wrap">
            <button class="case-type-btn px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold" onclick="selectCaseType(this)">SAR Filing</button>
            <button class="case-type-btn px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold" onclick="selectCaseType(this)">CTR Filing</button>
            <button class="case-type-btn px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold" onclick="selectCaseType(this)">Internal Audit</button>
            <button class="case-type-btn px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold" onclick="selectCaseType(this)">KYC Review</button>
          </div>
        </div>
        <div>
          <label class="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Notes</label>
          <textarea id="nc-notes" rows="3" placeholder="Initial observations, flagged transactions, source of concern…" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all"></textarea>
        </div>
      </div>
      <div class="mt-6 flex gap-3 justify-end">
        <button onclick="closeModal('modal-new-case')" class="px-5 py-2.5 rounded-lg bg-slate-100 text-slate-600 text-sm font-semibold hover:bg-slate-200 transition-colors">Cancel</button>
        <button onclick="submitNewCase()" class="px-5 py-2.5 rounded-lg text-white text-sm font-semibold shadow-sm hover:opacity-90 transition-all" style="background:linear-gradient(15deg,#3525cd,#4f46e5)">
          <span class="material-symbols-outlined text-sm align-middle mr-1">add</span>Create Case
        </button>
      </div>
    </div>
  </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

function selectCaseType(btn) {
  btn.closest('.flex').querySelectorAll('.case-type-btn').forEach(b => {
    b.className = 'case-type-btn px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold';
  });
  btn.className = 'case-type-btn px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold';
}

function submitNewCase() {
  const entity = document.getElementById('nc-entity')?.value?.trim();
  if (!entity) {
    toast('Please enter an entity name.', 'error');
    document.getElementById('nc-entity')?.focus();
    return;
  }
  closeModal('modal-new-case');
  const caseId = `CASE-${Math.floor(Math.random()*9000+1000)}-${Math.floor(Math.random()*900+100)}`;
  toast(`Case ${caseId} created for "${entity}"`, 'success');
  // Navigate to cases page and add a row
  setTimeout(() => navigate('cases'), 400);
}

// Expose openNewCase globally
window.openNewCase = function() {
  injectNewCaseModal();
  setTimeout(() => openModal('modal-new-case'), 10);
};

// ── 4. NOTIFICATION PANEL ──────────────────────────────────────────────
const NOTIFICATIONS = [
  { icon: 'flag', color: 'text-error', bg: 'bg-error-container', title: 'Rapid Shell Inflow Detected', body: 'Entity: Apex Logistics Inc. — Risk score 94', time: '2m ago', unread: true },
  { icon: 'account_tree', color: 'text-secondary', bg: 'bg-secondary-fixed', title: 'Layering Pattern Confirmed', body: 'Entity: Marcus V. Silva — Medium confidence', time: '45m ago', unread: true },
  { icon: 'payments', color: 'text-error', bg: 'bg-error-container', title: 'Structuring Burst — 14 transactions', body: 'Multiple cash deposits sub-threshold', time: '1h ago', unread: true },
  { icon: 'language', color: 'text-tertiary', bg: 'bg-tertiary-fixed', title: 'High-Risk Geo Transfer', body: 'Entity: Global Trade Ltd. — Cayman Islands', time: '3h ago', unread: false },
  { icon: 'verified_user', color: 'text-primary', bg: 'bg-primary-fixed', title: 'KYC Renewal Required', body: 'External Auditor access expires in 7 days', time: '5h ago', unread: false },
];

function injectNotificationPanel() {
  if (document.getElementById('notif-panel')) return;
  const items = NOTIFICATIONS.map(n => `
    <div class="flex gap-4 px-5 py-4 hover:bg-slate-50 transition-colors cursor-pointer border-b border-slate-50 last:border-0 ${n.unread ? 'bg-indigo-50/30' : ''}">
      <div class="w-9 h-9 rounded-full ${n.bg} flex-shrink-0 flex items-center justify-center">
        <span class="material-symbols-outlined ${n.color} text-lg" style="font-variation-settings:'FILL' 1;">${n.icon}</span>
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex justify-between items-start gap-2">
          <p class="text-xs font-bold text-slate-800 leading-snug">${n.title}</p>
          ${n.unread ? '<span class="w-1.5 h-1.5 bg-indigo-600 rounded-full flex-shrink-0 mt-1"></span>' : ''}
        </div>
        <p class="text-[11px] text-slate-500 mt-0.5 truncate">${n.body}</p>
        <p class="text-[10px] text-slate-400 mt-1">${n.time}</p>
      </div>
    </div>`).join('');

  const html = `
  <div id="notif-panel" class="hidden fixed top-16 right-4 z-[100] w-96 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
    <div class="flex items-center justify-between px-5 py-4 border-b border-slate-100">
      <div class="flex items-center gap-2">
        <h3 class="text-sm font-bold text-slate-900">Notifications</h3>
        <span class="px-1.5 py-0.5 bg-indigo-600 text-white text-[10px] font-bold rounded-full">3</span>
      </div>
      <div class="flex gap-2">
        <button onclick="markAllRead()" class="text-[10px] font-bold text-indigo-600 hover:underline">Mark all read</button>
        <button onclick="toggleNotifications()" class="p-1 hover:bg-slate-100 rounded text-slate-400">
          <span class="material-symbols-outlined text-sm">close</span>
        </button>
      </div>
    </div>
    <div class="max-h-96 overflow-y-auto">${items}</div>
    <div class="px-5 py-3 bg-slate-50 border-t border-slate-100 text-center">
      <button class="text-xs font-bold text-indigo-600 hover:underline">View all activity log</button>
    </div>
  </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

let notifOpen = false;
window.toggleNotifications = function() {
  injectNotificationPanel();
  const panel = document.getElementById('notif-panel');
  notifOpen = !notifOpen;
  panel.classList.toggle('hidden', !notifOpen);
};

window.markAllRead = function() {
  document.querySelectorAll('#notif-panel .bg-indigo-50\\/30').forEach(el => el.classList.remove('bg-indigo-50/30'));
  document.querySelectorAll('#notif-panel .bg-indigo-600.rounded-full.flex-shrink-0').forEach(el => el.remove());
  const badge = document.querySelector('#notif-panel h3 + span');
  if (badge) badge.remove();
  // Hide badge on bell
  document.querySelectorAll('.badge-pulse').forEach(b => b.classList.add('opacity-0'));
  toast('All notifications marked as read', 'success', 2000);
};

// Close panel when clicking outside
document.addEventListener('click', e => {
  if (notifOpen && !e.target.closest('#notif-panel') && !e.target.closest('[title="Notifications"]')) {
    notifOpen = false;
    document.getElementById('notif-panel')?.classList.add('hidden');
  }
});

// ── 5. GLOBAL SEARCH ───────────────────────────────────────────────────
const SEARCH_INDEX = [
  { label: 'Overview Dashboard', icon: 'dashboard', page: 'overview', match: 'overview dashboard activity kpi' },
  { label: 'Live Monitoring — Transaction Stream', icon: 'monitor_heart', page: 'live', match: 'live monitoring transaction stream throughput' },
  { label: 'Network Analysis — Entity Inspector', icon: 'hub', page: 'network', match: 'network analysis entity graph nodes' },
  { label: 'Behavioral Analysis — Radar', icon: 'psychology', page: 'behavioral', match: 'behavioral analysis radar xai pattern' },
  { label: 'Case Management — CASE-8829-102', icon: 'work', page: 'cases', match: 'case management investigation global vertex' },
  { label: 'Case Management — CASE-7712-404', icon: 'work', page: 'cases', match: 'case elena moretti SAR filing' },
  { label: 'Compliance Reports', icon: 'assessment', page: 'reports', match: 'reports compliance SAR CTR audit filing' },
  { label: 'System Settings — AI Sensitivity', icon: 'settings', page: 'settings', match: 'settings sensitivity permission audit' },
  { label: 'Alert: Rapid Shell Inflow', icon: 'flag', page: 'live', match: 'alert rapid shell inflow apex logistics' },
  { label: 'Alert: Layering Detection', icon: 'account_tree', page: 'behavioral', match: 'alert layering detection marcus silva' },
];

function injectSearchDropdown() {
  if (document.getElementById('search-dropdown')) return;
  const html = `
  <div id="search-dropdown" class="hidden absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden z-[100]">
    <div id="search-results" class="max-h-72 overflow-y-auto"></div>
    <div class="px-4 py-2 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 font-medium">Press <kbd class="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-mono">Enter</kbd> to search · <kbd class="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-mono">Esc</kbd> to close</div>
  </div>`;
  document.querySelector('#global-search')?.parentElement?.insertAdjacentHTML('afterend', html);
  // Make parent relative
  document.querySelector('#global-search')?.parentElement?.classList.add('relative');
}

const searchInput = document.getElementById('global-search');
if (searchInput) {
  searchInput.addEventListener('input', function() {
    injectSearchDropdown();
    const q = this.value.toLowerCase().trim();
    const dd = document.getElementById('search-dropdown');
    const results = document.getElementById('search-results');
    if (!q) { dd.classList.add('hidden'); return; }

    const hits = SEARCH_INDEX.filter(item => item.match.includes(q) || item.label.toLowerCase().includes(q));
    if (!hits.length) {
      results.innerHTML = `<div class="px-4 py-6 text-center text-sm text-slate-400">No results for "<span class="font-semibold">${q}</span>"</div>`;
    } else {
      results.innerHTML = hits.map(h => `
        <div class="flex items-center gap-3 px-4 py-3 hover:bg-indigo-50 transition-colors cursor-pointer" onclick="navigate('${h.page}'); closeSearch();">
          <span class="material-symbols-outlined text-indigo-600 text-lg">${h.icon}</span>
          <span class="text-sm font-medium text-slate-800">${h.label}</span>
        </div>`).join('');
    }
    dd.classList.remove('hidden');
  });

  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeSearch();
  });
}

window.closeSearch = function() {
  document.getElementById('search-dropdown')?.classList.add('hidden');
  if (searchInput) searchInput.value = '';
};

document.addEventListener('click', e => {
  if (!e.target.closest('#global-search') && !e.target.closest('#search-dropdown')) {
    document.getElementById('search-dropdown')?.classList.add('hidden');
  }
});

// ── 6. CASE DETAIL SIDE DRAWER ─────────────────────────────────────────
const CASE_DATA = {
  'CASE-8829-102': { entity: 'Global Vertex Holdings LLC', risk: 'Critical', status: 'Investigation In Progress', analyst: 'Marcus Chen', amount: '₹2.4M', since: 'Oct 10, 2023', desc: 'Multi-layered offshore wire transfers to Cayman and BVI entities. Pattern consistent with trade-based money laundering.' },
  'CASE-7712-404': { entity: 'Elena Moretti', risk: 'Medium', status: 'Pending SAR Filing', analyst: 'Sarah Jenkins', amount: '₹1.8L', since: 'Oct 18, 2023', desc: 'Unusual cash deposits followed by immediate international transfers. Geographic velocity anomaly detected.' },
  'CASE-9021-332': { entity: 'Argo Maritime Logistics', risk: 'Low', status: 'Initial Review', analyst: 'Unassigned', amount: '₹42K', since: 'Oct 22, 2023', desc: 'Flagged due to industry peer outlier analysis. No confirmed suspicious activity yet. Pending KYC documentation.' },
  'CASE-4423-901': { entity: 'Techno-Core Systems Inc.', risk: 'Critical', status: 'Internal Audit', analyst: 'David Miller', amount: '₹5.1M', since: 'Oct 5, 2023', desc: 'Rapid cycling of funds across 7 shell companies. Cryptocurrency off-ramp detected via DEX swap.' },
  'CASE-1209-661': { entity: 'Jameson Estate Fund', risk: 'Medium', status: 'Information Requested', analyst: 'Elena Rodriguez', amount: '₹6.2L', since: 'Oct 19, 2023', desc: 'Real estate purchase pattern inconsistent with declared income. Source of wealth documentation requested.' },
};

function injectCaseDrawer() {
  if (document.getElementById('case-drawer')) return;
  const html = `
  <div id="case-drawer" class="hidden fixed inset-y-0 right-0 z-[120] w-full max-w-md bg-white shadow-2xl flex flex-col">
    <div class="flex items-center justify-between px-6 py-5 border-b border-slate-100">
      <div>
        <p id="cd-id" class="text-[10px] font-bold text-indigo-600 uppercase tracking-widest"></p>
        <h3 id="cd-entity" class="text-lg font-extrabold text-slate-900 tracking-tight mt-0.5"></h3>
      </div>
      <button onclick="closeCaseDrawer()" class="p-2 hover:bg-slate-100 rounded-lg text-slate-400">
        <span class="material-symbols-outlined">close</span>
      </button>
    </div>
    <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      <div class="grid grid-cols-3 gap-3">
        <div class="bg-slate-50 rounded-xl p-4"><p class="text-[10px] text-slate-400 uppercase font-bold mb-1">Risk</p><p id="cd-risk" class="text-sm font-extrabold"></p></div>
        <div class="bg-slate-50 rounded-xl p-4"><p class="text-[10px] text-slate-400 uppercase font-bold mb-1">Amount</p><p id="cd-amount" class="text-sm font-extrabold text-indigo-700"></p></div>
        <div class="bg-slate-50 rounded-xl p-4"><p class="text-[10px] text-slate-400 uppercase font-bold mb-1">Since</p><p id="cd-since" class="text-xs font-bold text-slate-600"></p></div>
      </div>
      <div><p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Status</p><p id="cd-status" class="text-sm font-semibold text-slate-800"></p></div>
      <div><p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Assigned Analyst</p><p id="cd-analyst" class="text-sm font-semibold text-slate-800"></p></div>
      <div><p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Investigation Summary</p><p id="cd-desc" class="text-sm text-slate-600 leading-relaxed"></p></div>
      <div>
        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Quick Actions</p>
        <div class="flex flex-wrap gap-2">
          <button onclick="toast('SAR filing workflow initiated.','info'); closeCaseDrawer();" class="px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg hover:bg-indigo-100 transition-colors">File SAR</button>
          <button onclick="toast('Case escalated to Senior Compliance Officer.','warn'); closeCaseDrawer();" class="px-3 py-1.5 bg-amber-50 text-amber-700 text-xs font-bold rounded-lg hover:bg-amber-100 transition-colors">Escalate</button>
          <button onclick="toast('Case marked closed. Audit trail updated.','success'); closeCaseDrawer();" class="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-200 transition-colors">Close Case</button>
          <button onclick="navigate('behavioral'); closeCaseDrawer();" class="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-200 transition-colors">View Profile</button>
        </div>
      </div>
      <div class="pt-4 border-t border-slate-100">
        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Add Note</p>
        <textarea id="cd-note" rows="3" placeholder="Add investigation note…" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all"></textarea>
        <button onclick="saveNote()" class="mt-2 w-full py-2 text-xs font-bold text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors">Save Note</button>
      </div>
    </div>
  </div>
  <div id="case-drawer-overlay" class="hidden fixed inset-0 bg-black/20 z-[110]" onclick="closeCaseDrawer()"></div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

window.openCaseDrawer = function(caseId) {
  injectCaseDrawer();
  const data = CASE_DATA[caseId];
  if (!data) return;
  document.getElementById('cd-id').textContent = caseId;
  document.getElementById('cd-entity').textContent = data.entity;
  document.getElementById('cd-risk').textContent = data.risk;
  document.getElementById('cd-amount').textContent = data.amount;
  document.getElementById('cd-since').textContent = data.since;
  document.getElementById('cd-status').textContent = data.status;
  document.getElementById('cd-analyst').textContent = data.analyst;
  document.getElementById('cd-desc').textContent = data.desc;
  document.getElementById('cd-note').value = '';

  const riskEl = document.getElementById('cd-risk');
  const colorMap = { Critical: 'text-red-600', High: 'text-orange-600', Medium: 'text-amber-600', Low: 'text-emerald-600' };
  riskEl.className = `text-sm font-extrabold ${colorMap[data.risk] || ''}`;

  document.getElementById('case-drawer').classList.remove('hidden');
  document.getElementById('case-drawer-overlay').classList.remove('hidden');
};

window.closeCaseDrawer = function() {
  document.getElementById('case-drawer')?.classList.add('hidden');
  document.getElementById('case-drawer-overlay')?.classList.add('hidden');
};

window.saveNote = function() {
  const note = document.getElementById('cd-note')?.value?.trim();
  if (!note) return;
  toast('Investigation note saved to case docket.', 'success');
  document.getElementById('cd-note').value = '';
};

// ── 7. WIRE UP BUTTONS AFTER PAGE RENDER ──────────────────────────────
// Called by navigate() after DOM injection
window.wirePageInteractions = function(page) {
  if (page === 'overview' || page === 'cases') {
    // Wire "New Case" buttons
    document.querySelectorAll('[id="btn-new-case"], button').forEach(btn => {
      if (btn.textContent.includes('New Case') || btn.textContent.includes('Initialize New Case')) {
        btn.addEventListener('click', () => window.openNewCase(), { once: true });
      }
    });
  }

  if (page === 'cases') {
    // Wire case rows
    document.querySelectorAll('table tbody tr').forEach(row => {
      const caseId = row.querySelector('td span.font-bold')?.textContent?.trim();
      if (caseId && CASE_DATA[caseId]) {
        row.style.cursor = 'pointer';
        row.addEventListener('click', () => window.openCaseDrawer(caseId));
      }
    });

    // Wire tab filter buttons
    document.querySelectorAll('[class*="tracking-wider"][class*="rounded-lg"]').forEach(btn => {
      if (['All Cases','Flagged','Under Review','Closed'].includes(btn.textContent.trim())) {
        btn.addEventListener('click', function() {
          this.closest('div').querySelectorAll('button').forEach(b => {
            b.className = 'px-4 py-2 rounded-lg text-xs font-bold text-on-surface-variant uppercase tracking-wider hover:bg-white/50 transition-colors';
          });
          this.className = 'bg-surface-container-lowest px-4 py-2 rounded-lg text-xs font-bold text-primary uppercase tracking-wider border-b-2 border-primary';
          toast(`Filtered: ${this.textContent.trim()}`, 'info', 1800);
        });
      }
    });
  }

  if (page === 'reports') {
    // Export PDF
    document.querySelectorAll('button').forEach(btn => {
      if (btn.textContent.includes('Export PDF')) {
        btn.addEventListener('click', () => toast('Generating PDF report… download will begin shortly.', 'info'), { once: true });
      }
      if (btn.textContent.includes('New Filing')) {
        btn.addEventListener('click', () => toast('Filing wizard coming soon.', 'info'), { once: true });
      }
    });
  }

  if (page === 'live') {
    // Historical Export
    document.querySelectorAll('button').forEach(btn => {
      if (btn.textContent.includes('Historical Export')) {
        btn.addEventListener('click', () => toast('Exporting historical data as CSV…', 'info'), { once: true });
      }
      if (btn.textContent.includes('Global Risk Config')) {
        btn.addEventListener('click', () => { navigate('settings'); toast('Navigated to AI Risk Configuration.', 'info'); }, { once: true });
      }
      if (btn.textContent.includes('Dismiss Noise')) {
        btn.addEventListener('click', () => toast('Alert dismissed and logged.', 'success', 2000));
      }
      if (btn.textContent.includes('Flag Account')) {
        btn.addEventListener('click', () => toast('Account flagged for enhanced monitoring.', 'warn', 2500));
      }
      if (btn.textContent.includes('Snooze')) {
        btn.addEventListener('click', () => toast('Alert snoozed for 4 hours.', 'info', 2000));
      }
      if (btn.textContent.includes('Verify Identity')) {
        btn.addEventListener('click', () => toast('Identity verification request sent.', 'info'));
      }
    });

    // Emergency button
    document.querySelector('button[title]') || document.querySelectorAll('.fixed.bottom-8').forEach(btn => {
      if (btn.querySelector('.material-symbols-outlined')?.textContent === 'emergency') {
        btn.addEventListener('click', () => toast('Emergency freeze protocol activated! Compliance team notified.', 'error', 5000));
      }
    });
  }

  if (page === 'settings') {
    // Save button
    document.querySelectorAll('.fixed.bottom-8 button, button').forEach(btn => {
      if (btn.querySelector('.material-symbols-outlined')?.textContent === 'save') {
        btn.addEventListener('click', () => toast('Settings saved. AI model re-indexed successfully.', 'success'));
      }
    });
    // Re-index button
    document.querySelectorAll('button').forEach(btn => {
      if (btn.textContent.includes('Re-Index Ledger')) {
        btn.addEventListener('click', () => {
          toast('Ledger re-indexing started. ETA: ~2 minutes.', 'info');
          btn.textContent = 'Re-Indexing…';
          btn.disabled = true;
          setTimeout(() => {
            btn.textContent = 'Re-Index Ledger';
            btn.disabled = false;
            toast('Ledger re-indexed successfully.', 'success');
          }, 4000);
        });
      }
      if (btn.textContent.includes('Manage Backups')) {
        btn.addEventListener('click', () => toast('Backup manager opening…', 'info', 2000));
      }
      if (btn.textContent.includes('Invite Analyst')) {
        btn.addEventListener('click', () => toast('Analyst invitation workflow coming soon.', 'info'));
      }
      if (btn.textContent.includes('Export CSV')) {
        btn.addEventListener('click', () => toast('Exporting audit log as CSV…', 'info'));
      }
    });
  }

  if (page === 'network') {
    document.querySelectorAll('button').forEach(btn => {
      if (btn.textContent.includes('Flag for Investigation')) {
        btn.addEventListener('click', () => { window.openNewCase(); }, { once: true });
      }
    });
  }

  if (page === 'behavioral') {
    document.querySelectorAll('button').forEach(btn => {
      if (btn.textContent.includes('Export Full Audit')) {
        btn.addEventListener('click', () => toast('Exporting behavioral audit trail…', 'info'), { once: true });
      }
    });
    document.querySelectorAll('button[class*="more_vert"],.material-symbols-outlined').forEach(icon => {
      if (icon.textContent === 'more_vert') {
        icon.parentElement?.addEventListener('click', () => toast('Row actions menu coming soon.', 'info', 1500));
      }
    });
  }
};

// ── 8. NOTIFICATION BELL WIRING ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const bell = document.querySelector('[title="Notifications"]');
  if (bell) bell.addEventListener('click', () => window.toggleNotifications());
});

// Also wire since DOMContentLoaded may have already fired
(function() {
  const bell = document.querySelector('[title="Notifications"]');
  if (bell && !bell._notifWired) {
    bell.addEventListener('click', () => window.toggleNotifications());
    bell._notifWired = true;
  }
})();

// ── 9. KEYBOARD SHORTCUTS ─────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    document.getElementById('global-search')?.focus();
  }
  if (e.key === 'Escape') {
    closeSearch();
    notifOpen = false;
    document.getElementById('notif-panel')?.classList.add('hidden');
    closeCaseDrawer();
  }
});

// ── 10. EXPOSE HELPERS ────────────────────────────────────────────────
window._sentinel = { toast, openModal, closeModal };
