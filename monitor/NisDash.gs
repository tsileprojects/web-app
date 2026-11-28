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

/* ================= NEEDLE DASHBOARD feed (action=ndl_dash&unit=Emb&from=YYYY-MM-DD&to=YYYY-MM-DD) =================
   Read-only. Source: Needle 2.0 unit tabs (01_Needle_Issue_FormData_2.0 -> <Unit>_Ndl_Data) = new form entries
   + old-form rows copied in by ndlSync_ every 10 min, so it is complete.
   rows: [date, time, unitIssuer, batch, mcType, mcNo, recType, recQty, reason, issType, issQty, opId, operation, style]
   Cached 2 minutes per unit+range; ?fresh=1 rebuilds. */
const NDL_TABS = { 'FIPL': 'FIPL_Ndl_Data', 'TS2': 'TS2_Ndl_Data', 'TS4': 'TS4_Ndl_Data', 'TS9': 'TS9_Ndl_Data', 'AP2': 'AP2_Ndl_Data', 'HO Smp': 'HOSmp_Ndl_Data', 'EMB': 'Emb_Ndl_Data' };
function ndlDash_(p) {
  const u = nisUnit_(p.unit || ''), tab = NDL_TABS[u]; if (!tab) return { ok: false, error: 'Unknown unit' };
  const tz = Session.getScriptTimeZone(), today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const ok = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
  const to = ok(p.to) ? p.to : today, from = ok(p.from) ? p.from : to.slice(0, 8) + '01';
  const key = 'ndl2_' + tab + '_' + from + '_' + to, c = CacheService.getScriptCache();
  if (String(p.fresh) !== '1') { const h = c.get(key); if (h) return JSON.parse(h); }
  const sh = SpreadsheetApp.openById(NSY_NEW_ID).getSheetByName(tab), rows = [];
  const n = sh ? sh.getLastRow() - 1 : 0;
  if (n > 0) {
    const v = sh.getRange(2, 1, n, 17).getValues(), dv = sh.getRange(2, 2, n, 1).getDisplayValues(), s = x => String(x == null ? '' : x).trim();
    for (let i = 0; i < v.length; i++) {
      const r = v[i]; let d = r[0] instanceof Date ? Utilities.formatDate(r[0], tz, 'yyyy-MM-dd') : s(r[0]).slice(0, 10);
      if (!ok(d) || d < from || d > to) continue;
      rows.push([d, s(dv[i][0]), s(r[16]) || (u + '-' + s(r[3])), s(r[4]), s(r[8]), s(r[9]), s(r[10]), Number(r[11]) || 0, s(r[12]), s(r[14]), Number(r[15]) || 0, s(r[6]), s(r[7]), s(r[5])]);
    }
  }
  const out = { ok: true, unit: u, from: from, to: to, generated: Utilities.formatDate(new Date(), tz, 'dd-MMM-yyyy HH:mm'), rows: rows };
  try { const js = JSON.stringify(out); if (js.length < 95000) c.put(key, js, 120); } catch (e) {}
  return out;
}
