(() => {
  const { parse, SITES } = window.EIParser;
  const $ = s => document.querySelector(s);
  const siteName = id => (SITES.find(s => s.id === id) || {}).name || id;

  // ---------- storage ----------
  const KEY = 'ei.v1';
  const DEFAULTS = () => ({ entries: [], settings: { rate: 0.72 } });
  let db = load();
  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY));
      if (d && Array.isArray(d.entries)) return { entries: d.entries, settings: { ...DEFAULTS().settings, ...d.settings } };
    } catch (e) {}
    return DEFAULTS();
  }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); }
    catch (e) { toast('Could not save on this device'); }
  }

  // ---------- helpers ----------
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => iso(new Date());
  const addDays = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d); };
  const sheetDate = s => { const [y, m, d] = s.split('-'); return `${+m}.${+d}.${y.slice(2)}`; };
  const niceDate = s => {
    if (s === today()) return 'Today';
    if (s === addDays(today(), -1)) return 'Yesterday';
    return new Date(s + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  };
  const hrs = min => +(min / 60).toFixed(2);
  const fmtH = min => `${hrs(min)} h`;
  const fmtDur = min => {
    const h = Math.floor(min / 60), m = Math.round(min % 60);
    return h && m ? `${h} h ${m} min` : h ? `${h} h` : `${m} min`;
  };
  const num = v => +(+v).toFixed(2);
  const money = n => n.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
  const mondayOf = s => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return iso(d); };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  let toastT;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600);
  }

  // ---------- draft (the Add form) ----------
  let draft;
  const freshDraft = (type = 'time') => ({ type, site: null, minutes: 0, miles: '', note: '', date: today() });
  draft = freshDraft();

  function renderAdd() {
    $('#segTime').classList.toggle('on', draft.type === 'time');
    $('#segMiles').classList.toggle('on', draft.type === 'mileage');
    $('#timeCtl').hidden = draft.type !== 'time';
    $('#milesCtl').hidden = draft.type !== 'mileage';
    $('#noteLbl').firstChild.textContent = draft.type === 'time' ? 'What for ' : 'Note ';

    $('#sites').innerHTML = SITES.map(s => `<button data-site="${s.id}" class="${draft.site === s.id ? 'on' : ''}">${s.name}</button>`).join('');

    $('#rdBig').textContent = draft.minutes ? fmtH(draft.minutes) : '0 h';
    $('#rdSub').textContent = draft.minutes ? fmtDur(draft.minutes) : 'tap to add time';

    const recent = draft.site ? [...new Set(db.entries.filter(e => e.type === 'mileage' && e.site === draft.site).sort((a, b) => b.created - a.created).map(e => e.miles))].slice(0, 4) : [];
    $('#recentMiles').innerHTML = recent.map(m => `<button data-miles="${m}">${m} mi</button>`).join('');

    if (document.activeElement !== $('#miles')) $('#miles').value = draft.miles;
    if (document.activeElement !== $('#note')) $('#note').value = draft.note;
    $('#date').value = draft.date;

    const ok = draft.site && (draft.type === 'time' ? draft.minutes > 0 : +draft.miles > 0);
    $('#save').disabled = !ok;
    $('#save').textContent = !draft.site ? 'Pick a site' : ok ? (draft.type === 'time' ? `Save ${fmtDur(draft.minutes)} · ${siteName(draft.site)}` : `Save ${num(draft.miles)} mi · ${siteName(draft.site)}`) : draft.type === 'time' ? 'Add some time' : 'Enter miles';
  }

  function applyParsed(text) {
    const p = parse(text);
    if (!text.trim()) return;
    draft.type = p.type;
    if (p.siteId) draft.site = p.siteId;
    if (p.type === 'time' && p.minutes) draft.minutes = p.minutes;
    if (p.type === 'mileage' && p.miles) draft.miles = p.miles;
    if (p.note) draft.note = p.note;
    if (p.dateOffset) draft.date = addDays(today(), p.dateOffset);
    renderAdd();
    if (p.siteAmbiguous) toast('Which Chandler — Phase 1 or Phase 2?');
    else if (!p.siteId && !draft.site) toast('Couldn’t tell which site — tap one above');
    else if (p.type === 'time' && !p.minutes) toast('Couldn’t catch the time — tap +15 below');
  }

  $('#fill').onclick = () => { applyParsed($('#q').value); $('#q').blur(); };
  $('#q').addEventListener('keydown', e => { if (e.key === 'Enter') $('#fill').click(); });

  $('#segTime').onclick = () => { draft.type = 'time'; renderAdd(); };
  $('#segMiles').onclick = () => { draft.type = 'mileage'; renderAdd(); };
  $('#sites').onclick = e => { const b = e.target.closest('[data-site]'); if (b) { draft.site = b.dataset.site; renderAdd(); } };
  $('#timeCtl').onclick = e => {
    const b = e.target.closest('[data-add]'); if (!b) return;
    const v = b.dataset.add;
    draft.minutes = v === 'reset' ? 0 : Math.max(0, draft.minutes + +v);
    renderAdd();
  };
  $('#recentMiles').onclick = e => { const b = e.target.closest('[data-miles]'); if (b) { draft.miles = +b.dataset.miles; renderAdd(); } };
  $('#miles').oninput = e => { draft.miles = e.target.value; renderAdd(); };
  $('#note').oninput = e => { draft.note = e.target.value; };
  $('#date').onchange = e => { draft.date = e.target.value || today(); };

  $('#save').onclick = () => {
    const e = {
      id: uid(), created: Date.now(), type: draft.type, site: draft.site, date: draft.date,
      minutes: draft.type === 'time' ? draft.minutes : 0,
      miles: draft.type === 'mileage' ? num(draft.miles) : 0,
      note: draft.note.trim(), exported: false,
    };
    db.entries.push(e); persist();
    toast(e.type === 'time' ? `Saved ${fmtDur(e.minutes)} · ${siteName(e.site)}` : `Saved ${e.miles} mi · ${siteName(e.site)}`);
    draft = freshDraft(draft.type); $('#q').value = '';
    renderAdd(); renderHeader();
  };

  // voice (works in Safari; in a home-screen app the keyboard mic is the fallback)
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SR) {
    $('#mic').hidden = false;
    $('#mic').onclick = () => {
      try {
        const r = new SR(); r.lang = 'en-US'; r.interimResults = true;
        $('#mic').classList.add('live');
        r.onresult = ev => { $('#q').value = [...ev.results].map(x => x[0].transcript).join(' '); };
        r.onerror = () => { $('#mic').classList.remove('live'); toast('Mic unavailable — use the keyboard’s mic key'); };
        r.onend = () => { $('#mic').classList.remove('live'); if ($('#q').value) applyParsed($('#q').value); };
        r.start();
      } catch (err) { toast('Mic unavailable — use the keyboard’s mic key'); }
    };
  }

  // ---------- header ----------
  function renderHeader() {
    const t = db.entries.filter(e => e.date === today());
    const min = t.filter(e => e.type === 'time').reduce((a, e) => a + e.minutes, 0);
    const mi = t.filter(e => e.type === 'mileage').reduce((a, e) => a + e.miles, 0);
    const bits = [];
    if (min) bits.push(fmtH(min)); if (mi) bits.push(`${num(mi)} mi`);
    $('#hdrSub').textContent = bits.length ? `Today · ${bits.join(' · ')}` : new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  }

  // ---------- log ----------
  let logSite = 'all';
  function renderLog() {
    const mon = mondayOf(today()), monthStart = today().slice(0, 8) + '01';
    const sum = (from, type) => db.entries.filter(e => e.date >= from && e.type === type).reduce((a, e) => a + (type === 'time' ? e.minutes : e.miles), 0);
    $('#stats').innerHTML = [
      ['Today', today()], ['This week', mon], ['This month', monthStart],
    ].map(([l, from]) => `<div class="stat"><b>${fmtH(sum(from, 'time'))}</b><span>${l} · ${num(sum(from, 'mileage'))} mi</span></div>`).join('');

    $('#logFilter').innerHTML = [['all', 'All'], ...SITES.map(s => [s.id, s.name])]
      .map(([id, n]) => `<button data-f="${id}" class="${logSite === id ? 'on' : ''}">${n}</button>`).join('');

    const list = db.entries.filter(e => logSite === 'all' || e.site === logSite).sort((a, b) => b.date.localeCompare(a.date) || b.created - a.created);
    if (!list.length) { $('#logList').innerHTML = '<p class="empty">Nothing logged yet.</p>'; return; }
    let html = '', cur = '';
    for (const e of list) {
      if (e.date !== cur) {
        cur = e.date;
        const day = list.filter(x => x.date === cur);
        const m = day.filter(x => x.type === 'time').reduce((a, x) => a + x.minutes, 0);
        html += `<div class="day"><span>${niceDate(cur)}</span><span>${m ? fmtH(m) : ''}</span></div>`;
      }
      const amt = e.type === 'time' ? fmtH(e.minutes) : `${num(e.miles)} mi`;
      const sub = e.type === 'time' ? fmtDur(e.minutes) : 'mileage';
      html += `<button class="entry ${e.exported ? 'done' : ''}" data-id="${e.id}"><div class="l"><b>${siteName(e.site)}</b><span>${esc(e.note) || (e.type === 'mileage' ? 'Mileage' : '—')}</span></div><div class="r">${amt}<small>${e.exported ? 'exported' : sub}</small></div></button>`;
    }
    $('#logList').innerHTML = html;
  }
  const esc = s => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  $('#logFilter').onclick = e => { const b = e.target.closest('[data-f]'); if (b) { logSite = b.dataset.f; renderLog(); } };
  $('#logList').onclick = e => { const b = e.target.closest('[data-id]'); if (b) openEdit(b.dataset.id); };

  // edit dialog
  let editing = null;
  function openEdit(id) {
    editing = db.entries.find(e => e.id === id); if (!editing) return;
    $('#eSite').innerHTML = SITES.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    $('#eSite').value = editing.site;
    $('#eAmtLbl').textContent = editing.type === 'time' ? 'Minutes' : 'Miles';
    $('#eAmt').value = editing.type === 'time' ? editing.minutes : editing.miles;
    $('#eNote').value = editing.note; $('#eDate').value = editing.date;
    $('#edit').showModal();
  }
  $('#editForm').onsubmit = () => {
    if (!editing) return;
    const v = +$('#eAmt').value;
    editing.site = $('#eSite').value; editing.note = $('#eNote').value.trim(); editing.date = $('#eDate').value || editing.date;
    if (editing.type === 'time') editing.minutes = v > 0 ? v : editing.minutes; else editing.miles = v > 0 ? num(v) : editing.miles;
    editing.exported = false; persist(); renderLog(); renderHeader();
  };
  $('#eCancel').onclick = () => $('#edit').close();
  $('#eDel').onclick = () => {
    if (!confirm('Delete this entry?')) return;
    db.entries = db.entries.filter(e => e !== editing); persist(); $('#edit').close(); renderLog(); renderHeader();
  };

  // ---------- export ----------
  function exportSet() {
    const site = $('#exSite').value, scope = $('#exScope').value;
    const rows = db.entries.filter(e => (site === 'all' || e.site === site) && (scope === 'all' || !e.exported))
      .sort((a, b) => a.date.localeCompare(b.date) || a.created - b.created);
    return { site, rows, time: rows.filter(e => e.type === 'time'), miles: rows.filter(e => e.type === 'mileage') };
  }
  function renderExport() {
    const { time, miles } = exportSet();
    const tm = time.reduce((a, e) => a + e.minutes, 0), mi = miles.reduce((a, e) => a + e.miles, 0);
    $('#exSummary').innerHTML = `<div><span>Hours</span><b>${hrs(tm)} h · ${time.length} entries</b></div><div><span>Mileage</span><b>${num(mi)} mi · ${money(mi * db.settings.rate)}</b></div>`;
    $('#copyHours').disabled = !time.length; $('#copyMiles').disabled = !miles.length;
    $('#markDone').disabled = !(time.length + miles.length);
    $('#dlCsv').disabled = !(time.length + miles.length);
  }
  function fillExportSites() {
    const keep = $('#exSite').value || 'all';
    $('#exSite').innerHTML = `<option value="all">All sites</option>` + SITES.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    $('#exSite').value = keep;
  }
  const hoursTSV = ({ site, time }) => time.map(e => [hrs(e.minutes), sheetDate(e.date), site === 'all' ? `${siteName(e.site)}: ${e.note}`.replace(/: $/, '') : e.note].join('\t')).join('\n');
  const milesTSV = ({ miles }) => miles.map(e => [e.miles, siteName(e.site), sheetDate(e.date)].join('\t')).join('\n');

  async function copy(text, okMsg) {
    try { await navigator.clipboard.writeText(text); }
    catch (err) {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (e2) { toast('Copy failed'); ta.remove(); return; }
      ta.remove();
    }
    toast(okMsg);
  }
  $('#exSite').onchange = $('#exScope').onchange = renderExport;
  $('#copyHours').onclick = () => { const s = exportSet(); copy(hoursTSV(s), `Copied ${s.time.length} rows — paste into the sheet`); };
  $('#copyMiles').onclick = () => { const s = exportSet(); copy(milesTSV(s), `Copied ${s.miles.length} rows — paste into the sheet`); };
  $('#markDone').onclick = () => {
    const { rows } = exportSet();
    if (!rows.length || !confirm(`Mark ${rows.length} entries as exported?`)) return;
    rows.forEach(e => e.exported = true); persist(); renderExport(); renderLog(); toast('Marked as exported');
  };
  const csvCell = v => /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v;
  $('#dlCsv').onclick = () => {
    const { rows } = exportSet();
    const lines = [['Type', 'Site', 'Date', 'Hours', 'Miles', 'Task'].join(',')].concat(rows.map(e =>
      [e.type, siteName(e.site), sheetDate(e.date), e.type === 'time' ? hrs(e.minutes) : '', e.type === 'mileage' ? e.miles : '', csvCell(e.note)].map(csvCell).join(',')));
    saveFile(`embellished-${today()}.csv`, lines.join('\n'), 'text/csv');
  };
  async function saveFile(name, text, type) {
    const file = new File([text], name, { type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  }

  // settings
  $('#rate').value = db.settings.rate;
  $('#rate').onchange = e => { const v = +e.target.value; if (v >= 0) { db.settings.rate = v; persist(); renderExport(); } };
  $('#bkp').onclick = () => saveFile(`embellished-backup-${today()}.json`, JSON.stringify(db, null, 1), 'application/json');
  $('#rst').onclick = () => $('#rstFile').click();
  $('#rstFile').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (!Array.isArray(d.entries)) throw 0;
      if (!confirm(`Replace everything on this phone with ${d.entries.length} entries from the backup?`)) return;
      db = { entries: d.entries, settings: { ...DEFAULTS().settings, ...d.settings } }; persist();
      $('#rate').value = db.settings.rate; renderAll(); toast('Backup restored');
    } catch (err) { toast('That file isn’t a valid backup'); }
    e.target.value = '';
  };

  // ---------- tabs ----------
  function show(tab) {
    for (const t of ['add', 'log', 'export']) $(`#view-${t}`).hidden = t !== tab;
    document.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    if (tab === 'log') renderLog();
    if (tab === 'export') { fillExportSites(); renderExport(); }
    window.scrollTo(0, 0);
  }
  document.querySelector('nav').onclick = e => { const b = e.target.closest('[data-tab]'); if (b) show(b.dataset.tab); };

  function renderAll() { renderHeader(); renderAdd(); renderLog(); fillExportSites(); renderExport(); }
  renderAll();

  // opened with ?q=… (e.g. from an iOS Shortcut) → pre-fill the form
  const q = new URLSearchParams(location.search).get('q');
  if (q) { $('#q').value = q; applyParsed(q); history.replaceState(null, '', location.pathname); }

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
