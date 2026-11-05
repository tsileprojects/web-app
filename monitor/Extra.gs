/**
 * ==============================================================
 *  EXTRA FEEDS (part of TSPL Error Monitor)
 *   ?action=report             -> unit summary for the report page
 *   ?action=drill&unit=TS4&date=2026-11-04  -> line-wise detail
 *   ?action=notes              -> notes on numbers (last 31 days)
 *   ?action=addnote&unit=&line=&date=&text=&by=  -> add a note
 *  Read-only on all data sheets. Notes are kept in the "Notes" tab
 *  of the monitor log sheet.
 * ==============================================================
 */
const NOTES_TAB = 'Notes';

function reportData_() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('report_v2') || cache.get('report_stale2'); if (hit) return JSON.parse(hit);
  const out = { ok: true, k: kpis_(), p: reportProduction_() };
  try { cache.put('report_v2', JSON.stringify(out), 900); cache.put('report_stale2', JSON.stringify(out), 21600); } catch (e) {}
  return out;
}

function drill_(unit, date) {
  unit = String(unit || '').toUpperCase();
  if (KPI_UNITS.indexOf(unit) < 0) return { ok: false, error: 'Unknown unit' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) return { ok: false, error: 'Date must be YYYY-MM-DD' };
  const key = 'drill_' + unit + '_' + date;
  const cache = CacheService.getScriptCache();
  const hit = cache.get(key); if (hit) return JSON.parse(hit);
  const lines = {}, errs = [];
  function L(no) { no = String(no == null ? '' : no).trim(); if (!no) return null; return lines[no] = lines[no] || { line: no }; }
  const w = "D = '" + unit + "' and C = date '" + date + "'";
  try {
    const r = gviz_(kpiSrc_('PROD'), "select F, G, H, Z, sum(AK), sum(X), sum(AP), max(AO) where " + w + " and E = 'Sew' group by F, G, H, Z");
    (r.rows || []).forEach(x => { const l = L(x[0]); if (!l) return;
      l.buyer = l.buyer ? l.buyer : x[1]; l.style = l.style ? l.style + ', ' + x[2] : x[2]; l.status = x[3];
      l.pro = (l.pro || 0) + kpiNum_(x[4]); l.tgt = (l.tgt || 0) + kpiNum_(x[5]); l.mp = (l.mp || 0) + kpiNum_(x[6]);
      if (x[7] && String(x[7]).trim() && String(x[7]).trim() !== '-') l.remark = String(x[7]).slice(0, 120); });
  } catch (e) { errs.push('production: ' + e.message); }
  try {
    const r = gviz_(kpiSrc_('EFF'), "select F, sum(R), sum(Q) where " + w + " group by F");
    (r.rows || []).forEach(x => { const l = L(x[0]); if (!l) return; l.earn = kpiNum_(x[1]); l.avail = kpiNum_(x[2]);
      l.eff = l.avail ? Math.round(l.earn / l.avail * 1000) / 10 : null; });
  } catch (e) { errs.push('efficiency: ' + e.message); }
  try {
    const r = gviz_(kpiSrc_('QUAL'), "select F, sum(AH), sum(AG), sum(AI) where " + w + " group by F");
    (r.rows || []).forEach(x => { const l = L(x[0]); if (!l) return; const chk = kpiNum_(x[2]);
      l.chk = chk; l.ftr = chk ? Math.round(kpiNum_(x[1]) / chk * 1000) / 10 : null; l.dft = chk ? Math.round(kpiNum_(x[3]) / chk * 1000) / 10 : null; });
  } catch (e) { errs.push('quality: ' + e.message); }
  const list = Object.keys(lines).map(k => lines[k]).sort((a, b) => {
    const na = parseFloat(a.line), nb = parseFloat(b.line);
    return (isNaN(na) || isNaN(nb)) ? String(a.line).localeCompare(b.line) : (na - nb || String(a.line).localeCompare(b.line));
  });
  const out = { ok: true, unit: unit, date: date, lines: list, errors: errs };
  try { cache.put(key, JSON.stringify(out), 600); } catch (e) {}
  return out;
}

function notesSheet_() {
  const ss = ss_();
  let sh = ss.getSheetByName(NOTES_TAB);
  if (!sh) {
    sh = ss.insertSheet(NOTES_TAB);
    sh.getRange(1, 1, 1, 7).setValues([['ID', 'Added', 'Date', 'Unit', 'Line', 'Note', 'By']]).setFontWeight('bold');
    sh.setFrozenRows(1); sh.setColumnWidth(6, 420);
  }
  return sh;
}

function notes_() {
  const sh = notesSheet_();
  const n = sh.getLastRow() - 1;
  if (n < 1) return { ok: true, notes: [] };
  const from = kpiFmt_(new Date(Date.now() - 31 * 86400000));
  const rows = sh.getRange(2, 1, n, 7).getValues();
  const notes = rows.map(r => ({ id: String(r[0]), added: r[1], date: r[2] instanceof Date ? kpiFmt_(r[2]) : String(r[2]),
      unit: String(r[3]), line: String(r[4]), text: String(r[5]), by: String(r[6]) }))
    .filter(x => x.date >= from && x.text).reverse().slice(0, 300);
  return { ok: true, notes: notes };
}

function addNote_(p) {
  const clean = (s, max) => String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').trim().replace(/^[=+\-@]+/, '').slice(0, max);
  const unit = clean(p.unit, 10).toUpperCase();
  const text = clean(p.text, 300), by = clean(p.by, 40), line = clean(p.line, 10);
  const date = String(p.date || '');
  if (KPI_UNITS.indexOf(unit) < 0 && unit !== 'TSPL') return { ok: false, error: 'Pick a unit' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: 'Pick a date' };
  if (text.length < 3) return { ok: false, error: 'Write the note' };
  if (!by) return { ok: false, error: 'Write your name' };
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const sh = notesSheet_();
    if (sh.getLastRow() > 5000) return { ok: false, error: 'Notes sheet is full - please archive old notes' };
    const id = 'N' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyMMddHHmmss') + Math.floor(Math.random() * 90 + 10);
    sh.appendRow([id, new Date(), "'" + date, unit, line ? "'" + line : '', "'" + text, "'" + by]);
    return { ok: true, id: id };
  } finally { lock.releaseLock(); }
}
