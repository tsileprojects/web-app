/* ================= NEEDLE PLAN feed (action=np_dash&unit=FIPL|TS2|TS4|TS9|AP2) =================
   Read-only. Same OUTPUT sheet of 01_Needle_Calc_Sheet_7.0 the old Looker "Needle Plan" dashboards use:
   one row per unit / month / line / style with plan qty and needle requirement per needle type.
   rows: [month yyyy-MM, line, style, start, end, runDays, planQty, totalReq, [[typeIdx, n], …]]  (last 4 months onward)
   Cached 10 minutes per unit. */
const NP_SRC = { id: '1nZisFRe-vUlKuGcMLvSexQWlTm7gdRQxqlg1tmvUuzQ', sheet: 'OUTPUT' };
function npBuild_() {
  const tz = Session.getScriptTimeZone(), N = kpiNum_, sh = SpreadsheetApp.openById(NP_SRC.id).getSheetByName(NP_SRC.sheet);
  const nc = sh.getLastColumn(), v = sh.getRange(1, 1, sh.getLastRow(), nc).getDisplayValues();
  const hdr = v[0], types = [], tcol = [];
  for (let c = 10; c < nc; c++) { const t = String(hdr[c] || '').trim(); if (t && t !== '---') { tcol.push(c); types.push(t); } }
  const d0 = new Date(); d0.setMonth(d0.getMonth() - 4); const from = Utilities.formatDate(d0, tz, 'yyyy-MM');
  const byUnit = {};
  const mon = s => { const m = String(s).trim().match(/(?:\d{1,2}-)?([A-Za-z]{3})[A-Za-z]*-(\d{2,4})$/); if (!m || !DQR_MON_[m[1].toLowerCase()]) return ''; return (m[2].length === 2 ? '20' + m[2] : m[2]) + '-' + ('0' + DQR_MON_[m[1].toLowerCase()]).slice(-2); };
  for (let r = 1; r < v.length; r++) {
    const x = v[r]; let u = String(x[0]).trim().toUpperCase(); if (!u) continue; if (u === 'AP') u = 'AP2';
    const m = mon(x[1]); if (!m || m < from) continue;
    const list = []; tcol.forEach((c, i) => { const n = N(x[c]); if (n) list.push([i, n]); });
    (byUnit[u] = byUnit[u] || []).push([m, String(x[2]).trim(), String(x[3]).trim(), String(x[4]).trim(), String(x[5]).trim(), N(x[6]), N(x[7]), N(x[8]), list]);
  }
  // line totals (RESULT) and needle-type totals (NT_Req), as the Looker report shows them
  const ss = sh.getParent(), byLine = {}, byType = {};
  const rs = ss.getSheetByName('RESULT'); if (rs && rs.getLastRow() > 1) rs.getRange(2, 1, rs.getLastRow() - 1, 4).getDisplayValues().forEach(x => {
    let u = String(x[0]).trim().toUpperCase(); if (u === 'AP') u = 'AP2'; const m = mon(x[1]); if (!u || !m || m < from) return; const n = N(x[3]); if (!n) return;
    (byLine[u] = byLine[u] || []).push([m, String(x[2]).trim(), n]); });
  const nt = ss.getSheetByName('NT_Req'); if (nt && nt.getLastRow() > 1) nt.getRange(2, 1, nt.getLastRow() - 1, 4).getDisplayValues().forEach(x => {
    let u = String(x[0]).trim().toUpperCase(); if (u === 'AP') u = 'AP2'; const m = mon(x[1]); if (!u || !m || m < from) return; const n = N(x[3]); if (!n) return;
    (byType[u] = byType[u] || []).push([m, String(x[2]).trim(), n]); });
  const ts = new Date();
  return { types: types, byUnit: byUnit, byLine: byLine, byType: byType, builtAt: ts.getTime(), generated: Utilities.formatDate(ts, tz, 'dd-MMM-yyyy HH:mm') };
}
function npDash_(p) {
  const unit = String(p.unit || '').toUpperCase();
  const c = CacheService.getScriptCache(), key = 'np1_' + unit;
  if (String(p.fresh) !== '1') { const hit = c.get(key); if (hit) return JSON.parse(hit); }
  let all; try { all = npBuild_(); } catch (e) { return { ok: false, error: e.message }; }
  const units = Object.keys(all.byUnit);
  units.forEach(u => {
    const rows = all.byUnit[u], used = {};
    rows.forEach(r => r[8].forEach(p2 => { used[p2[0]] = 1; }));
    const idx = Object.keys(used).map(Number).sort((a, b) => a - b), remap = {}; idx.forEach((o, i) => { remap[o] = i; });
    const out = { ok: true, unit: u, units: units, types: idx.map(i => all.types[i]), rows: rows.map(r => r.slice(0, 8).concat([r[8].map(p2 => [remap[p2[0]], p2[1]])])), lines: all.byLine[u] || [], ntypes: all.byType[u] || [], builtAt: all.builtAt, generated: all.generated };
    try { c.put('np1_' + u, JSON.stringify(out), 600); } catch (e) {}
    if (u === unit) all.hit = out;
  });
  return all.hit || { ok: false, error: 'No needle plan rows for ' + unit, units: units };
}
