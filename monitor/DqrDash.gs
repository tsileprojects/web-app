/* ================= DQR (end-line QC app) DASHBOARD feed (action=dqr_dash) =================
   Reads the same summary sheets the old Google DQR Qty / DQR Dft dashboards used (read-only):
     00_Sew_EL_Data FIPL & TS2 : TS2_Hr_Smy + TS2_ELDft_Smy   (units FIPL, TS2)
     00_Sew_EL_Data AP2        : AP2_Hr_Smy + AP2_ELDft_Smy   (unit AP2)
   q rows : [date, unit, line, style, colour, chk, pass, dft, rej, altChk, altPass, altDft, altBacklog, totChk, totPass, h1..h8, ot]
   d rows : [date, unit, line, style, colour, category, total, [[defectIdx, n], ...]]
   Last 40 days. Cached 5 minutes (chunked); ?fresh=1 rebuilds. */
const DQR_SRC = [
  { id: '1tflN8tumxBqvhckxDixGgsqs3m_D7E-i_AgHmP6IX1I', hr: 'TS2_Hr_Smy', dft: 'TS2_ELDft_Smy' },
  { id: '1SE_mkH8rAa8lZq7e5afgg9U5qg1gyv6FMVych_-LvMc', hr: 'AP2_Hr_Smy', dft: 'AP2_ELDft_Smy' }
];
const DQR_MON_ = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
function dqrDate_(v, tz) {
  if (v instanceof Date) return isNaN(v) ? '' : Utilities.formatDate(v, tz, 'yyyy-MM-dd');
  const s = String(v || '').trim(); let m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/), d, mo, y;
  if (m) { d = +m[1]; mo = +m[2]; y = +m[3]; }
  else if ((m = s.match(/^(\d{1,2})[-\s]([A-Za-z]{3})[A-Za-z]*[-\s](\d{4})$/))) { d = +m[1]; mo = DQR_MON_[m[2].toLowerCase()]; y = +m[3]; }
  else return '';
  if (!mo || !d) return '';
  return y + '-' + ('0' + mo).slice(-2) + '-' + ('0' + d).slice(-2);
}
function dqrBuild_() {
  const tz = Session.getScriptTimeZone(), errors = [], N = kpiNum_;
  const from = Utilities.formatDate(new Date(Date.now() - 40 * 864e5), tz, 'yyyy-MM-dd');
  const q = [], d = [], defIdx = {}, defects = [];
  let latest = '';
  const unitOf = u => { u = String(u || '').trim().toUpperCase(); return u === 'AP' ? 'AP2' : u; };
  DQR_SRC.forEach(src => {
    let ss; try { ss = SpreadsheetApp.openById(src.id); } catch (e) { errors.push(src.hr + ': ' + e.message); return; }
    // ---- quantity / hourly
    const hs = ss.getSheetByName(src.hr);
    if (hs && hs.getLastRow() > 1) {
      const v = hs.getRange(2, 1, hs.getLastRow() - 1, 27).getValues();
      v.forEach(r => {
        const ds = dqrDate_(r[0], tz); if (!ds || ds < from || !r[1]) return;
        if (ds > latest) latest = ds;
        const row = [ds, unitOf(r[1]), String(r[2]).trim(), String(r[3] || '').replace(/^#\s*/, '').trim(), String(r[4] || '').trim()];
        [5, 6, 7, 8, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26].forEach(i => row.push(N(r[i])));
        if (row[5] || row[13]) q.push(row);
      });
    } else errors.push(src.hr + ': sheet missing/empty');
    // ---- defects
    const dsh = ss.getSheetByName(src.dft);
    if (dsh && dsh.getLastRow() > 1) {
      const nc = dsh.getLastColumn(), hdr = dsh.getRange(1, 1, 1, nc).getValues()[0];
      const v = dsh.getRange(2, 1, dsh.getLastRow() - 1, nc).getValues();
      v.forEach(r => {
        const ds = dqrDate_(r[0], tz); if (!ds || ds < from || !r[1]) return;
        const cat = String(r[5] || '').trim(); if (!cat || /total/i.test(cat)) return;
        const list = [];
        for (let i = 7; i < nc; i++) {
          const n = N(r[i]); if (!n) continue;
          const name = String(hdr[i] || '').trim(); if (!name || /^no defects$/i.test(name)) continue;
          if (!(name in defIdx)) { defIdx[name] = defects.length; defects.push(name); }
          list.push([defIdx[name], n]);
        }
        const tot = N(r[6]) || list.reduce((a, b) => a + b[1], 0);
        if (!tot) return;
        d.push([ds, unitOf(r[1]), String(r[2]).trim(), String(r[3] || '').replace(/^#\s*/, '').trim(), String(r[4] || '').trim(), cat, tot, list]);
      });
    } else errors.push(src.dft + ': sheet missing/empty');
  });
  const ts = new Date();
  return { ok: q.length > 0 || d.length > 0, error: errors.join('; '), errors: errors, builtAt: ts.getTime(),
    generated: Utilities.formatDate(ts, tz, 'dd-MMM-yyyy HH:mm'), latest: latest, from: from, q: q, d: d, defects: defects };
}

function dqrDash_(p) {
  const c = CacheService.getScriptCache();
  if (String(p.fresh) !== '1') {
    const n = c.get('dqrd2_n');
    if (n) { const keys = []; for (let i = 0; i < +n; i++) keys.push('dqrd2_' + i); const g = c.getAll(keys); let s = '';
      for (let i = 0; i < keys.length; i++) { if (g[keys[i]] == null) { s = null; break; } s += g[keys[i]]; }
      if (s) return JSON.parse(s); }
  }
  const out = dqrBuild_(); if (!out.ok) return out;
  const js = JSON.stringify(out);
  try { const parts = {}; let k = 0; for (let i = 0; i < js.length; i += 95000) parts['dqrd2_' + (k++)] = js.slice(i, i + 95000); parts.dqrd2_n = String(k); c.putAll(parts, 300); } catch (e) {}
  return out;
}
