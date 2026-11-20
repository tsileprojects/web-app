/**
 * ==============================================================
 *  PLUS - downtime log, email alerts, AI insight in the 9 AM report
 *  (part of TSPL Error Monitor)
 *   ?action=dt_add&token=&unit=&line=&reason=&machine=&start=HH:mm&end=HH:mm&note=
 *   ?action=dt_end&token=&id=&end=HH:mm
 *   ?action=dt_list&unit=&date=YYYY-MM-DD        (read, no sign-in needed)
 *   ?action=alerts_setup                         (installs the 30-minute alert check once)
 *  Downtime rows go to the "Downtime" tab of the monitor's log spreadsheet.
 *  Alerts go to the "Alert Recipients" tab (owner only until you add people).
 * ==============================================================
 */
const DT_TAB = 'Downtime';
const DT_REASONS = ['Machine breakdown', 'No input / feeding', 'Power cut', 'Style changeover', 'Quality issue / rework',
  'Operator absent', 'Waiting for trims / accessories', 'Needle / attachment problem', 'Other'];
const AL_TAB = 'Alert Recipients';

function dtSheet_() {
  const ss = ss_();
  let sh = ss.getSheetByName(DT_TAB);
  if (!sh) {
    sh = ss.insertSheet(DT_TAB);
    sh.getRange(1, 1, 1, 13).setValues([['ID', 'Date', 'Unit', 'Line', 'Machine', 'Reason', 'Start', 'End', 'Minutes', 'Note', 'Logged by', 'Logged at', 'Closed by']]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}
function dtTime_(s) { s = String(s || '').trim(); return /^\d{1,2}:\d{2}$/.test(s) ? ('0' + s).slice(-5) : ''; }
function dtMins_(a, b) {
  if (!a || !b) return '';
  const m = (+b.slice(0, 2) * 60 + +b.slice(3)) - (+a.slice(0, 2) * 60 + +a.slice(3));
  return m >= 0 ? m : '';
}
function dtClean_(s, n) { return String(s == null ? '' : s).replace(/^[=+\-@]+/, '').slice(0, n || 200); }

function dtAdd_(p) {
  const u = axUser_(p.token); if (!u) return { ok: false, error: 'signin' };
  const unit = String(p.unit || '').toUpperCase(); if (KPI_UNITS.indexOf(unit) < 0) return { ok: false, error: 'Pick a unit' };
  const line = dtClean_(p.line, 10); if (!line) return { ok: false, error: 'Enter the line number' };
  const reason = DT_REASONS.indexOf(p.reason) > -1 ? p.reason : 'Other';
  const tz = Session.getScriptTimeZone(), now = new Date();
  const start = dtTime_(p.start) || Utilities.formatDate(now, tz, 'HH:mm'), end = dtTime_(p.end);
  const id = 'DT' + Utilities.formatDate(now, tz, 'yyMMddHHmmss') + Math.floor(Math.random() * 90 + 10);
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    dtSheet_().appendRow([id, Utilities.formatDate(now, tz, 'yyyy-MM-dd'), unit, line, dtClean_(p.machine, 40), reason, start, end,
      dtMins_(start, end), dtClean_(p.note, 300), u.name || u.email, Utilities.formatDate(now, tz, 'yyyy-MM-dd HH:mm'), end ? (u.name || u.email) : '']);
  } finally { lock.releaseLock(); }
  CacheService.getScriptCache().remove('dt_' + unit + '_' + Utilities.formatDate(now, tz, 'yyyy-MM-dd'));
  return { ok: true, id: id };
}

function dtEnd_(p) {
  const u = axUser_(p.token); if (!u) return { ok: false, error: 'signin' };
  const end = dtTime_(p.end) || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm');
  const sh = dtSheet_(), n = sh.getLastRow() - 1; if (n < 1) return { ok: false, error: 'Not found' };
  const ids = sh.getRange(2, 1, n, 1).getValues();
  for (let i = n - 1; i >= 0; i--) {
    if (String(ids[i][0]) !== String(p.id)) continue;
    const row = sh.getRange(i + 2, 1, 1, 13).getValues()[0];
    const start = dtTime_(Utilities.formatDate(new Date('1970-01-01T' + String(row[6]).slice(0, 5) + ':00'), 'UTC', 'HH:mm')) || dtTime_(row[6]);
    sh.getRange(i + 2, 8, 1, 2).setValues([[end, dtMins_(start, end)]]);
    sh.getRange(i + 2, 13).setValue(u.name || u.email);
    CacheService.getScriptCache().remove('dt_' + row[2] + '_' + kpiFmt_(row[1] instanceof Date ? row[1] : kpiDate_(String(row[1]))));
    return { ok: true };
  }
  return { ok: false, error: 'Not found' };
}

function dtList_(unit, date) {
  unit = String(unit || '').toUpperCase();
  date = String(date || '') || tdToday_();
  const c = CacheService.getScriptCache(), key = 'dt_' + unit + '_' + date, hit = c.get(key);
  if (hit) return JSON.parse(hit);
  const sh = dtSheet_(), n = sh.getLastRow() - 1, tz = Session.getScriptTimeZone();
  const nowHm = Utilities.formatDate(new Date(), tz, 'HH:mm');
  const fmt = v => v instanceof Date ? Utilities.formatDate(v, tz, 'HH:mm') : dtTime_(v);
  const list = [];
  if (n > 0) {
    const rows = sh.getRange(Math.max(2, n - 1500 + 2), 1, Math.min(n, 1500), 13).getValues();   // recent rows only
    rows.forEach(r => {
      const d = r[1] instanceof Date ? kpiFmt_(r[1]) : String(r[1]).slice(0, 10);
      if (d !== date || (unit && String(r[2]).toUpperCase() !== unit)) return;
      const start = fmt(r[6]), end = fmt(r[7]);
      const open = !end && date === tdToday_();
      list.push({ id: r[0], unit: r[2], line: String(r[3]), machine: r[4], reason: r[5], start: start, end: end,
        mins: end ? dtMins_(start, end) : (open ? dtMins_(start, nowHm) : ''), open: open, note: r[9], by: r[10] });
    });
  }
  const byLine = {};
  list.forEach(x => { byLine[x.line] = (byLine[x.line] || 0) + (+x.mins || 0); });
  const out = { ok: true, unit: unit, date: date, reasons: DT_REASONS, list: list.reverse(), byLine: byLine,
    total: list.reduce((a, x) => a + (+x.mins || 0), 0) };
  try { c.put(key, JSON.stringify(out), 60); } catch (e) {}
  return out;
}

/* ---------------- email alerts ---------------- */
function alertRecipients_() {
  const ss = ss_();
  let sh = ss.getSheetByName(AL_TAB);
  if (!sh) {
    sh = ss.insertSheet(AL_TAB);
    sh.getRange(1, 1, 1, 4).setValues([['Email', 'Send (Y/N)', 'Units (blank = all, e.g. TS2,FIPL)', 'Name / role']]).setFontWeight('bold');
    sh.getRange(2, 1, 1, 4).setValues([[REPORT_OWNER, 'Y', '', 'Owner (test)']]);
    sh.setFrozenRows(1); sh.setColumnWidth(1, 260); sh.setColumnWidth(3, 220);
  }
  const n = sh.getLastRow() - 1; if (n < 1) return [];
  return sh.getRange(2, 1, n, 3).getValues().filter(r => String(r[1]).trim().toUpperCase() !== 'N')
    .map(r => ({ email: String(r[0]).replace(/[\s'"<>,;]/g, ''), units: String(r[2] || '').toUpperCase().split(/[\s,]+/).filter(Boolean) }))
    .filter(r => /^[^@]+@[^@]+\.[a-z]{2,}$/i.test(r.email));
}

function alertsSetup_() {
  const has = ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'checkAlerts');
  if (!has) ScriptApp.newTrigger('checkAlerts').timeBased().everyMinutes(30).create();
  alertRecipients_();
  return { ok: true, installed: !has, already: has };
}

/** Runs every 30 minutes; emails only NEW problems (each one at most once a day). */
function checkAlerts() {
  try { fsaMailFlush(); } catch (e) { console.log('fsaMailFlush: ' + e.message); }
  const tz = Session.getScriptTimeZone(), now = new Date();
  const hm = +Utilities.formatDate(now, tz, 'H') * 60 + +Utilities.formatDate(now, tz, 'm');
  if (now.getDay() === 0 || hm < 9 * 60 + 30 || hm > 18 * 60 + 30) return 'outside working hours';
  const today = tdToday_(), items = [];
  KPI_UNITS.forEach(u => {
    let d = null; try { d = drillLive_(u, today); } catch (e) {}
    const lines = (d && d.lines) || [];
    if (hm >= 11 * 60 && !lines.some(l => (l.pro || 0) > 0)) items.push({ unit: u, key: 'nodpr', kind: 'DPR', text: u + ': no DPR output entered yet today' });
    lines.forEach(l => {
      const h = l.hoursDone || 0, perHr = (l.tgt || 0) / 9;
      if (h < 2 || !perHr) return;
      const a = l.hours[h - 1] / perHr, b = l.hours[h - 2] / perHr;
      if (a < 0.85 && b < 0.85) items.push({ unit: u, key: 'low_' + l.line + '_' + h, kind: 'OUTPUT',
        text: u + ' Line ' + l.line + ': below 85% of hourly target for 2 hours (H' + (h - 1) + ' ' + Math.round(b * 100) + '%, H' + h + ' ' + Math.round(a * 100) + '%)' });
    });
    try {
      dtList_(u, today).list.forEach(x => { if (x.open && +x.mins >= 30) items.push({ unit: u, key: 'dt_' + x.id, kind: 'DOWNTIME',
        text: u + ' Line ' + x.line + ': ' + x.reason + ' open for ' + x.mins + ' min' + (x.machine ? ' (' + x.machine + ')' : '') }); });
    } catch (e) {}
  });
  try {
    (needleTower_().suggestions || []).forEach(s => { if (s.cover !== null && s.cover < 1) items.push({ unit: s.unit, key: 'ndl_' + s.type,
      kind: 'NEEDLE', text: s.unit + ': ' + s.type + ' has under 1 day of stock (' + Math.max(s.stock, 0) + ' pcs) - ' + s.text }); });
  } catch (e) {}
  try { if (hm >= 10 * 60) poAlertItems_().forEach(x => items.push(x)); } catch (e) {}   // PO ship-date reminders (each PO once a day)
  const props = PropertiesService.getScriptProperties(), seenKey = 'alerts_seen_' + today;
  const seen = JSON.parse(props.getProperty(seenKey) || '{}');
  const fresh = items.filter(x => !seen[x.unit + '|' + x.key]);
  if (!fresh.length) return 'nothing new';
  fresh.forEach(x => { seen[x.unit + '|' + x.key] = 1; });
  props.setProperty(seenKey, JSON.stringify(seen));
  props.getKeys().forEach(k => { if (k.indexOf('alerts_seen_') === 0 && k !== seenKey) props.deleteProperty(k); });
  let sent = 0;
  alertRecipients_().forEach(r => {
    const mine = fresh.filter(x => !r.units.length || r.units.indexOf(x.unit) > -1);
    if (!mine.length) return;
    const color = { OUTPUT: '#b91c1c', DOWNTIME: '#b45309', NEEDLE: '#9a3412', DPR: '#475569', SHIP: '#7c2d12' };
    const html = '<div style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;max-width:620px">' +
      '<h2 style="margin:0 0 6px;font-size:18px">TSPL - ' + mine.length + ' item' + (mine.length > 1 ? 's need' : ' needs') + ' action</h2>' +
      '<p style="margin:0 0 12px;color:#475569;font-size:13px">' + Utilities.formatDate(now, tz, 'dd MMM yyyy, HH:mm') + '</p>' +
      mine.map(x => '<div style="padding:10px 12px;margin:0 0 8px;border-radius:8px;background:#f8fafc;border:1px solid #e2e8f0">' +
        '<b style="font-size:11px;color:#fff;background:' + (color[x.kind] || '#334155') + ';padding:2px 6px;border-radius:4px">' + x.kind + '</b> ' +
        '<span style="font-size:14px">' + x.text.replace(/</g, '&lt;') + '</span></div>').join('') +
      '<p style="margin:14px 0 0"><a href="' + REPORT_SITE + 'floor.html" style="color:#1d4ed8">Open the floor screen</a> &middot; ' +
      '<a href="' + REPORT_SITE + 'needle.html" style="color:#1d4ed8">Needle control tower</a> &middot; ' +
      '<a href="' + REPORT_SITE + 'po.html" style="color:#1d4ed8">PO tracker</a></p>' +
      '<p style="color:#94a3b8;font-size:11px">Each problem is emailed once a day. Change who gets these in the "' + AL_TAB + '" tab of the TSPL_Error_Monitor_Log sheet.</p></div>';
    MailApp.sendEmail({ to: r.email, subject: 'TSPL alert: ' + mine[0].text.slice(0, 80) + (mine.length > 1 ? ' (+' + (mine.length - 1) + ' more)' : ''), htmlBody: html, name: 'TSPL Smart Tool' });
    sent++;
  });
  return 'sent ' + fresh.length + ' new item(s) to ' + sent;
}

/* ---------------- AI insight for the 9 AM report ---------------- */
function reportAddInsight_(html, k, p) {
  try {
    const key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY'); if (!key) return html;
    const facts = { productionDate: p.date, production: p.units, efficiencyDate: k.effDate,
      units: (k.units || []).map(u => ({ unit: u.unit, effDay: u.eff, effMonthToDate: u.effMtd, effLastMonth: u.effPrevMonth, ftrMonth: u.ftr, fsaPassPct: u.fsa })) };
    ASK_DEADLINE_ = Date.now() + 45000;
    const w = gemini_('You write a short insight box for a garment factory MD\'s morning email. Use ONLY the numbers given. ' +
      'Return JSON {"good":"...","bad":"...","fix":"..."}: one plain sentence each - what went well, what went wrong, the one thing to fix today. ' +
      'Name units and numbers. No greetings, no markdown, under 30 words each.', JSON.stringify(facts).slice(0, 8000), key);
    if (!w || !w.good) return html;
    const e = s => String(s || '').replace(/</g, '&lt;');
    const box = '<div style="margin:0 0 18px;padding:12px 14px;border-radius:10px;background:#eff6ff;border:1px solid #bfdbfe">' +
      '<div style="font-size:12px;font-weight:bold;color:#1d4ed8;margin-bottom:6px">TODAY IN 3 LINES (auto-written from the figures below)</div>' +
      '<div style="font-size:13px;margin:3px 0"><b style="color:#15803d">Went well:</b> ' + e(w.good) + '</div>' +
      '<div style="font-size:13px;margin:3px 0"><b style="color:#b91c1c">Went wrong:</b> ' + e(w.bad) + '</div>' +
      '<div style="font-size:13px;margin:3px 0"><b style="color:#1e3a8a">Fix today:</b> ' + e(w.fix) + '</div></div>';
    const i = html.indexOf('<h2 ');
    return i > 0 ? html.slice(0, i) + box + html.slice(i) : html;
  } catch (e) { return html; }   // the report must never fail because of the insight box
}
