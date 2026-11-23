/* ================= NEEDLE ISSUED REPORT feed (action=nis_dash[&unit=FIPL]) =================
   Read-only. Same sheet the old "Needle Issued Report" Google page used:
     Ndl_Print_Data (file 1IzRb9H-…), refreshed every minute by 09_Needle_Issue_ReportPrint_2.0 with the last 7 days.
   rows: [date, time, unit, issuer, batch, style, optId, operation, mcType, mcNo, recType, recQty, reason, remarks, issType, issQty]
   Cached 3 minutes; ?fresh=1 rebuilds. */
const NIS_SRC = { id: '1IzRb9H-j_r9XSSYBavEWnMRKUYxJ_y0r9h2kLrKa_A8', sheet: 'Ndl_Print_Data' };
function nisUnit_(u) { u = String(u || '').trim(); const l = u.toLowerCase().replace(/\s+/g, '');
  if (l === 'ap' || l === 'ap2') return 'AP2'; if (l === 'emb') return 'EMB'; if (/^hosmp|^ho/.test(l)) return 'HO Smp'; return u.toUpperCase(); }
function nisBuild_() {
  const tz = Session.getScriptTimeZone(), N = kpiNum_, sh = SpreadsheetApp.openById(NIS_SRC.id).getSheetByName(NIS_SRC.sheet);
  const rows = []; let latest = '';
  if (sh && sh.getLastRow() > 1) {
    const v = sh.getRange(2, 1, sh.getLastRow() - 1, 16).getValues(), d = sh.getRange(2, 2, sh.getLastRow() - 1, 1).getDisplayValues();
    v.forEach((r, i) => {
      let ds = '';
      if (r[0] instanceof Date) ds = Utilities.formatDate(r[0], tz, 'yyyy-MM-dd');
      else { const x = new Date(String(r[0]).replace(/-/g, ' ')); if (!isNaN(x)) ds = Utilities.formatDate(x, tz, 'yyyy-MM-dd'); }
      if (!ds) return; if (ds > latest) latest = ds;
      const s = x => String(x == null ? '' : x).trim();
      rows.push([ds, s(d[i][0]), nisUnit_(r[2]), s(r[3]), s(r[4]), s(r[5]), s(r[6]), s(r[7]), s(r[8]), s(r[9]), s(r[10]), N(r[11]), s(r[12]), s(r[13]), s(r[14]) === '--' ? '' : s(r[14]), N(r[15])]);
    });
  }
  const pad = t => ('0' + t).slice(-8); rows.sort((a, b) => a[0] + pad(a[1]) < b[0] + pad(b[1]) ? 1 : -1);
  const ts = new Date();
  return { ok: true, latest: latest, builtAt: ts.getTime(), generated: Utilities.formatDate(ts, tz, 'dd-MMM-yyyy HH:mm'), rows: rows };
}
function nisDash_(p) {
  const c = CacheService.getScriptCache(), key = 'nis1';
  let out = null;
  if (String(p.fresh) !== '1') {
    const n = c.get(key + '_n');
    if (n) { const keys = []; for (let i = 0; i < +n; i++) keys.push(key + '_' + i); const g = c.getAll(keys); let s = '';
      for (let i = 0; i < keys.length; i++) { if (g[keys[i]] == null) { s = null; break; } s += g[keys[i]]; }
      if (s) out = JSON.parse(s); }
  }
  if (!out) {
    try { out = nisBuild_(); } catch (e) { return { ok: false, error: e.message }; }
    const js = JSON.stringify(out);
    try { const parts = {}; let k = 0; for (let i = 0; i < js.length; i += 95000) parts[key + '_' + (k++)] = js.slice(i, i + 95000); parts[key + '_n'] = String(k); c.putAll(parts, 180); } catch (e) {}
  }
  const u = p.unit ? nisUnit_(p.unit) : '';
  if (u) out = Object.assign({}, out, { unit: u, rows: out.rows.filter(r => r[2] === u) });
  return out;
}
