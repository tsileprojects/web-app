/* ================= NEEDLE STOCK DAY & MONTH feed (action=nsd_dash&unit=FIPL|TS2|TS4|TS9|AP2) =================
   Read-only. Same sheets the old "Needle Stock Day & Month" Google pages used:
     <unit> Needle_Stock_Data_2.0 : Live_Stock (date-wise) and Month_Stock (month-wise), A:P.
   live rows (last 35 days, all-zero rows dropped): [date, needleType, open, recLine, issLine, sendCMD, recCMD, totIss, totRec, close]
   month rows: [month(yyyy-MM), needleType, open, recLine, issLine, sendCMD, recCMD, totIss, totRec, close, cycStock, nextCyc, nextPlan, actualIssCMD]
   Cached 10 minutes per unit; ?fresh=1 rebuilds. */
const NSD_FILES = { FIPL: '1VaBU9HxJQSsfbvKCVzJGgBuuaussdP97viq2lW3jZwM', TS2: '1mGX-AcqIazx5q-qUh0GZ2yq23ShYVxMYkyyxJiX-cbY',
  TS4: '14IuvKj4YJ7bWnW-cmT2wmd_bDnrIxAtg6wziX8tEjnQ', TS9: '1EzSzC68bJAQR-ExTLjZ3-f5huDSlNM5GHTNW1kcki2k', AP2: '1iOe66_UWfSltLbDDLxhuc_eDb_RXxt-Mc-fculnR5kc' };
function nsdBuild_(unit) {
  const tz = Session.getScriptTimeZone(), N = kpiNum_, ss = SpreadsheetApp.openById(NSD_FILES[unit]);
  const from = Utilities.formatDate(new Date(Date.now() - 35 * 864e5), tz, 'yyyy-MM-dd');
  const live = [], month = [];
  let latest = '';
  const ls = ss.getSheetByName('Live_Stock');
  if (ls && ls.getLastRow() > 1) {
    ls.getRange(2, 1, ls.getLastRow() - 1, 12).getValues().forEach(r => {
      const ds = dqrDate_(r[1], tz); if (!ds || ds < from || !r[3]) return;
      const v = r.slice(4, 12).map(N); if (!v.some(x => x)) return;
      if (ds > latest) latest = ds;
      live.push([ds, String(r[3]).trim()].concat(v));
    });
  }
  const ms = ss.getSheetByName('Month_Stock');
  if (ms && ms.getLastRow() > 1) {
    ms.getRange(2, 1, ms.getLastRow() - 1, 16).getValues().forEach(r => {
      let m = '';
      if (r[1] instanceof Date) m = Utilities.formatDate(r[1], tz, 'yyyy-MM');
      else { const x = String(r[1]).trim().match(/^([A-Za-z]{3})[A-Za-z]*[-\s](\d{2,4})$/); if (x && DQR_MON_[x[1].toLowerCase()]) m = (x[2].length === 2 ? '20' + x[2] : x[2]) + '-' + ('0' + DQR_MON_[x[1].toLowerCase()]).slice(-2); }
      if (!m || !r[3]) return;
      month.push([m, String(r[3]).trim()].concat(r.slice(4, 16).map(N)));
    });
  }
  const ts = new Date();
  return { ok: true, unit: unit, latest: latest, builtAt: ts.getTime(), generated: Utilities.formatDate(ts, tz, 'dd-MMM-yyyy HH:mm'), live: live, month: month, file: ss.getName() };
}
function nsdDash_(p) {
  const unit = String(p.unit || '').toUpperCase();
  if (!NSD_FILES[unit]) return { ok: false, error: 'Unknown unit ' + unit };
  const c = CacheService.getScriptCache(), key = 'nsd_' + unit;
  if (String(p.fresh) !== '1') {
    const n = c.get(key + '_n');
    if (n) { const keys = []; for (let i = 0; i < +n; i++) keys.push(key + '_' + i); const g = c.getAll(keys); let s = '';
      for (let i = 0; i < keys.length; i++) { if (g[keys[i]] == null) { s = null; break; } s += g[keys[i]]; }
      if (s) return JSON.parse(s); }
  }
  let out; try { out = nsdBuild_(unit); } catch (e) { return { ok: false, error: e.message }; }
  const js = JSON.stringify(out);
  try { const parts = {}; let k = 0; for (let i = 0; i < js.length; i += 95000) parts[key + '_' + (k++)] = js.slice(i, i + 95000); parts[key + '_n'] = String(k); c.putAll(parts, 600); } catch (e) {}
  return out;
}
