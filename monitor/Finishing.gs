/**
 * ==============================================================
 *  FINISHING - hourly finishing entries + live feed (Nov 2026)
 *  (part of TSPL Error Monitor)
 *   ?action=fin_add&token=&unit=&hour=1-9&table=&buyer=&style=&colour=
 *          &iron=&chk=&pass=&alt=&rej=&pack=&ctn=&note=
 *   ?action=fin_void&token=&id=          (marks a same-day entry as a mistake)
 *   ?action=fin_list&unit=&date=YYYY-MM-DD  (read, no sign-in needed)
 *   ?action=fin_sum&date=                   (all units, read)
 *  Rows go to the "Finishing" tab of the monitor's log spreadsheet.
 *  Each entry = quantities done in that hour (not running totals).
 *  Mistakes are never deleted: they are marked VOID and left out.
 * ==============================================================
 */
const FN_TAB = 'Finishing';
const FN_HEAD = ['ID', 'Date', 'Unit', 'Hour', 'Table / Line', 'Buyer', 'Style', 'Colour', 'Ironed', 'Checked', 'Passed', 'Alter',
  'Reject', 'Packed', 'Cartons', 'Note', 'Logged by', 'Logged at', 'Status'];
const FN_Q = ['iron', 'chk', 'pass', 'alt', 'rej', 'pack', 'ctn'];

function fnSheet_() {
  const ss = ss_();
  let sh = ss.getSheetByName(FN_TAB);
  if (!sh) {
    sh = ss.insertSheet(FN_TAB);
    sh.getRange(1, 1, 1, FN_HEAD.length).setValues([FN_HEAD]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}
function fnNum_(v) { const n = Math.round(Number(v)); return isFinite(n) && n > 0 ? Math.min(n, 100000) : 0; }
function fnClear_(unit, date) {
  const c = CacheService.getScriptCache(); c.remove('fn_' + unit + '_' + date); c.remove('fn_sum_' + date);
}

function fnAdd_(p) {
  const u = axUser_(p.token); if (!u) return { ok: false, error: 'signin' };
  const unit = String(p.unit || '').toUpperCase(); if (KPI_UNITS.indexOf(unit) < 0) return { ok: false, error: 'Pick a unit' };
  const hour = Math.round(Number(p.hour)); if (!(hour >= 1 && hour <= 12)) return { ok: false, error: 'Pick the hour' };
  const style = dtClean_(p.style, 60); if (!style) return { ok: false, error: 'Enter the style' };
  const q = {}; FN_Q.forEach(k => q[k] = fnNum_(p[k]));
  if (!FN_Q.some(k => q[k])) return { ok: false, error: 'Enter at least one quantity' };
  if (q.pass + q.alt + q.rej > q.chk && q.chk) return { ok: false, error: 'Passed + alter + reject is more than checked' };
  const tz = Session.getScriptTimeZone(), now = new Date(), date = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  const id = 'FN' + Utilities.formatDate(now, tz, 'yyMMddHHmmss') + Math.floor(Math.random() * 90 + 10);
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    fnSheet_().appendRow([id, date, unit, hour, dtClean_(p.table, 20), dtClean_(p.buyer, 40), style, dtClean_(p.colour, 40),
      q.iron, q.chk, q.pass, q.alt, q.rej, q.pack, q.ctn, dtClean_(p.note, 200), u.name || u.email,
      Utilities.formatDate(now, tz, 'yyyy-MM-dd HH:mm'), 'OK']);
  } finally { lock.releaseLock(); }
  fnClear_(unit, date);
  return { ok: true, id: id };
}

function fnVoid_(p) {
  const u = axUser_(p.token); if (!u) return { ok: false, error: 'signin' };
  const sh = fnSheet_(), n = sh.getLastRow() - 1; if (n < 1) return { ok: false, error: 'Not found' };
  const top = Math.max(2, n - 3000 + 2), ids = sh.getRange(top, 1, sh.getLastRow() - top + 1, 1).getValues();
  const today = tdToday_();
  for (let i = ids.length - 1; i >= 0; i--) {
    if (String(ids[i][0]) !== String(p.id)) continue;
    const row = sh.getRange(top + i, 1, 1, FN_HEAD.length).getValues()[0];
    const d = row[1] instanceof Date ? kpiFmt_(row[1]) : String(row[1]).slice(0, 10);
    if (d !== today) return { ok: false, error: 'Only today\'s entries can be corrected' };
    sh.getRange(top + i, FN_HEAD.length).setValue('VOID by ' + (u.name || u.email));
    fnClear_(String(row[2]).toUpperCase(), d);
    return { ok: true };
  }
  return { ok: false, error: 'Not found' };
}

/** today's (or a day's) non-void rows, optionally for one unit */
function fnRows_(unit, date) {
  const sh = fnSheet_(), n = sh.getLastRow() - 1; if (n < 1) return [];
  const rows = sh.getRange(Math.max(2, n - 3000 + 2), 1, Math.min(n, 3000), FN_HEAD.length).getValues();   // recent rows only
  return rows.filter(r => {
    const d = r[1] instanceof Date ? kpiFmt_(r[1]) : String(r[1]).slice(0, 10);
    return d === date && String(r[18] || 'OK') === 'OK' && (!unit || String(r[2]).toUpperCase() === unit);
  });
}
function fnTot_(rows) {
  const t = { iron: 0, chk: 0, pass: 0, alt: 0, rej: 0, pack: 0, ctn: 0 };
  let chkQ = 0;   // checked qty only from rows that recorded pass/alter/reject (FSR day imports carry checked qty only)
  rows.forEach(r => {
    FN_Q.forEach((k, i) => t[k] += Number(r[8 + i]) || 0);
    if ((Number(r[10]) || 0) + (Number(r[11]) || 0) + (Number(r[12]) || 0) > 0) chkQ += Number(r[9]) || 0;
  });
  t.passPct = chkQ ? Math.round(t.pass / chkQ * 1000) / 10 : null;
  return t;
}

function fnList_(unit, date) {
  unit = String(unit || '').toUpperCase(); date = String(date || '') || tdToday_();
  const c = CacheService.getScriptCache(), key = 'fn_' + unit + '_' + date, hit = c.get(key);
  if (hit) return JSON.parse(hit);
  const rows = fnRows_(unit, date), byHour = [], byStyle = {};
  for (let h = 1; h <= 12; h++) byHour.push({ hour: h, iron: 0, chk: 0, pass: 0, pack: 0 });
  rows.forEach(r => {
    const h = byHour[(Number(r[3]) || 1) - 1];
    if (h) { h.iron += +r[8] || 0; h.chk += +r[9] || 0; h.pass += +r[10] || 0; h.pack += +r[13] || 0; }
    const k = [r[6], r[7]].join('|');
    (byStyle[k] = byStyle[k] || { buyer: r[5], style: r[6], colour: r[7], rows: [] }).rows.push(r);
  });
  const styles = Object.keys(byStyle).map(k => Object.assign({ buyer: byStyle[k].buyer, style: byStyle[k].style, colour: byStyle[k].colour },
    fnTot_(byStyle[k].rows))).sort((a, b) => b.pack - a.pack);
  const list = rows.slice(-60).reverse().map(r => ({ id: r[0], hour: r[3], table: r[4], buyer: r[5], style: r[6], colour: r[7],
    iron: r[8], chk: r[9], pass: r[10], alt: r[11], rej: r[12], pack: r[13], ctn: r[14], note: r[15], by: r[16],
    at: r[17] instanceof Date ? Utilities.formatDate(r[17], Session.getScriptTimeZone(), 'HH:mm') : String(r[17]).slice(11, 16) }));
  const last = byHour.reduce((a, h) => (h.iron || h.chk || h.pack) ? h.hour : a, 0);
  const out = { ok: true, unit: unit, date: date, total: fnTot_(rows), byHour: byHour.slice(0, Math.max(9, last)), lastHour: last,
    styles: styles, list: list, entries: rows.length };
  try { c.put(key, JSON.stringify(out), 60); } catch (e) {}
  return out;
}

function fnSum_(date) {
  date = String(date || '') || tdToday_();
  const c = CacheService.getScriptCache(), key = 'fn_sum_' + date, hit = c.get(key);
  if (hit) return JSON.parse(hit);
  const rows = fnRows_('', date), units = {};
  KPI_UNITS.forEach(u => units[u] = fnTot_(rows.filter(r => String(r[2]).toUpperCase() === u)));
  const out = { ok: true, date: date, units: units, total: fnTot_(rows), entries: rows.length };
  try { c.put(key, JSON.stringify(out), 60); } catch (e) {}
  return out;
}
