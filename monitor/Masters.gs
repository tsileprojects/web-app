/**
 * ==============================================================
 *  MASTERS - ship dates and operator skills (part of TSPL Error Monitor)
 *   ?action=ship_list                       every style/colour with its ship date
 *   ?action=ship_set&token=&buyer=&style=&colour=&ship=YYYY-MM-DD&qty=
 *   ?action=ship_del&token=&style=&colour=
 *   ?action=skill_list&unit=                operators and the operations they can do
 *   ?action=skill_set&token=&unit=&line=&opid=&name=&operation=&level=1-4&eff=
 *   ?action=skill_del&token=&unit=&opid=&operation=
 *  Stored in the "Ship Dates" and "Operator Skills" tabs of the monitor's log spreadsheet.
 *  Anyone signed in can add or change rows; every row records who changed it last.
 * ==============================================================
 */
const MS_SHIP = 'Ship Dates', MS_SKILL = 'Operator Skills';
const MS_SHIP_HEAD = ['Buyer', 'Style', 'Colour', 'Ship date', 'Order qty', 'Updated by', 'Updated at'];
const MS_SKILL_HEAD = ['Unit', 'Line', 'Operator ID', 'Name', 'Operation', 'Level (1-4)', 'Efficiency %', 'Updated by', 'Updated at'];

function msSheet_(name, head) {
  const ss = ss_();
  let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold'); sh.setFrozenRows(1); }
  return sh;
}
function msRows_(sh, n) { const last = sh.getLastRow(); return last < 2 ? [] : sh.getRange(2, 1, last - 1, n).getValues(); }
function msNow_() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm'); }
function msKey_(s) { return String(s || '').replace(/^#\s*/, '').trim().toUpperCase(); }
function msDate_(v) { return v instanceof Date ? kpiFmt_(v) : String(v || '').slice(0, 10); }

function shipList_() {
  const c = CacheService.getScriptCache(), hit = c.get('ms_ship'); if (hit) return JSON.parse(hit);
  const list = msRows_(msSheet_(MS_SHIP, MS_SHIP_HEAD), 7).filter(r => r[1]).map(r => ({ buyer: r[0], style: String(r[1]), colour: String(r[2] || ''),
    ship: msDate_(r[3]), qty: r[4] === '' ? null : +r[4], by: r[5], at: r[6] instanceof Date ? Utilities.formatDate(r[6], Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm') : String(r[6] || '') }));
  const out = { ok: true, list: list };
  try { c.put('ms_ship', JSON.stringify(out), 600); } catch (e) {}
  return out;
}
function shipSet_(p) {
  const u = axUser_(p.token); if (!u) return { ok: false, error: 'signin' };
  const style = dtClean_(p.style, 80).trim(), colour = dtClean_(p.colour, 60).trim(), ship = String(p.ship || '');
  if (!style) return { ok: false, error: 'Enter the style' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ship)) return { ok: false, error: 'Pick the ship date' };
  const sh = msSheet_(MS_SHIP, MS_SHIP_HEAD), rows = msRows_(sh, 3);
  const row = [dtClean_(p.buyer, 60), style, colour, ship, p.qty === '' || p.qty == null ? '' : +p.qty || '', u.name || u.email, msNow_()];
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const i = rows.findIndex(r => msKey_(r[1]) === msKey_(style) && msKey_(r[2]) === msKey_(colour));
    if (i > -1) sh.getRange(i + 2, 1, 1, 7).setValues([row]); else sh.appendRow(row);
  } finally { lock.releaseLock(); }
  CacheService.getScriptCache().remove('ms_ship');
  return { ok: true };
}
function shipDel_(p) {
  const u = axUser_(p.token); if (!u) return { ok: false, error: 'signin' };
  const sh = msSheet_(MS_SHIP, MS_SHIP_HEAD), rows = msRows_(sh, 3);
  const i = rows.findIndex(r => msKey_(r[1]) === msKey_(p.style) && msKey_(r[2]) === msKey_(p.colour));
  if (i < 0) return { ok: false, error: 'Not found' };
  sh.deleteRow(i + 2); CacheService.getScriptCache().remove('ms_ship');
  return { ok: true };
}

function skillList_(unit) {
  unit = String(unit || '').toUpperCase();
  const list = msRows_(msSheet_(MS_SKILL, MS_SKILL_HEAD), 9).filter(r => r[2] && (!unit || String(r[0]).toUpperCase() === unit))
    .map(r => ({ unit: r[0], line: String(r[1]), opid: String(r[2]), name: r[3], operation: r[4], level: +r[5] || 0, eff: r[6] === '' ? null : +r[6], by: r[7] }));
  const ops = {}; list.forEach(x => { ops[x.operation] = (ops[x.operation] || 0) + 1; });
  return { ok: true, unit: unit, list: list, operations: Object.keys(ops).sort() };
}
function skillSet_(p) {
  const u = axUser_(p.token); if (!u) return { ok: false, error: 'signin' };
  const unit = String(p.unit || '').toUpperCase(); if (KPI_UNITS.indexOf(unit) < 0) return { ok: false, error: 'Pick a unit' };
  const opid = dtClean_(p.opid, 30).trim(), op = dtClean_(p.operation, 60).trim();
  if (!opid || !op) return { ok: false, error: 'Enter operator ID and operation' };
  const level = Math.min(4, Math.max(1, +p.level || 1));
  const sh = msSheet_(MS_SKILL, MS_SKILL_HEAD), rows = msRows_(sh, 5);
  const row = [unit, dtClean_(p.line, 10), opid, dtClean_(p.name, 60), op, level, p.eff === '' || p.eff == null ? '' : +p.eff || '', u.name || u.email, msNow_()];
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const i = rows.findIndex(r => String(r[0]).toUpperCase() === unit && msKey_(r[2]) === msKey_(opid) && msKey_(r[4]) === msKey_(op));
    if (i > -1) sh.getRange(i + 2, 1, 1, 9).setValues([row]); else sh.appendRow(row);
  } finally { lock.releaseLock(); }
  return { ok: true };
}
function skillDel_(p) {
  const u = axUser_(p.token); if (!u) return { ok: false, error: 'signin' };
  const unit = String(p.unit || '').toUpperCase(), sh = msSheet_(MS_SKILL, MS_SKILL_HEAD), rows = msRows_(sh, 5);
  const i = rows.findIndex(r => String(r[0]).toUpperCase() === unit && msKey_(r[2]) === msKey_(p.opid) && msKey_(r[4]) === msKey_(p.operation));
  if (i < 0) return { ok: false, error: 'Not found' };
  sh.deleteRow(i + 2);
  return { ok: true };
}
