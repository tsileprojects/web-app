/* ================= COT DASHBOARD feed (action=cot_dash) =================
   Source: 00_COT_Datamaster_Live_1.0
     COT_Result : one row per line batch (its latest day) – the same rows the Looker COT report used
     DPR_Data   : every line, every day – used for the live line status and the day-by-day ramp-up curve
   Cached for 6 hours in chunks; ?fresh=1 rebuilds (about 10 s). */
const COTD = { id: '1yjSi_FswtY1Edle7SUa5dyHm9biBLmPbG7AgiewJvh4' };

function cotNum_(v) { if (typeof v === 'number') return v; const n = parseFloat(String(v == null ? '' : v).replace(/[,%\s]/g, '')); return isNaN(n) ? 0 : n; }
function cotPct_(v) { const n = typeof v === 'number' ? (Math.abs(v) <= 2 ? v * 100 : v) : cotNum_(v); return Math.round(n * 10) / 10; }
function cotDate_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Kolkata', 'yyyy-MM-dd');
  const s = String(v || '').trim(); let m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/); if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[0] : '';
}
function cotStyle_(s) { return String(s || '').replace(/^#\s*/, '').trim(); }
function cotRead_(name, cols) {
  const sh = SpreadsheetApp.openById(COTD.id).getSheetByName(name), n = sh.getLastRow();
  return n > 1 ? sh.getRange(2, 3, n - 1, cols).getValues() : [];
}

function cotBuild_() {
  const t0 = Date.now();
  // DPR_Data C:X -> Date, Unit, Dept, Line, Buyer, Style, Color, SAM, OBMP, PtlTgt, UtilMP, UnitTgt, BatchSt, TodayPro, AvalMin, EarnMin, Eff, Days, Slab, DayRes, OverRes, DayStatus
  const D = cotRead_('DPR_Data', 22).map(r => ({ d: cotDate_(r[0]), unit: String(r[1]).trim().toUpperCase(), line: String(r[3]).trim(), buyer: String(r[4]).trim() || '-', style: cotStyle_(r[5]), color: String(r[6]).trim(),
    sam: cotNum_(r[7]), mp: cotNum_(r[8]), util: cotNum_(r[10]), tgt: cotNum_(r[11]), st: String(r[12]).trim(), pro: cotNum_(r[13]), aval: cotNum_(r[14]), earn: cotNum_(r[15]),
    eff: cotPct_(r[16]), days: cotNum_(r[17]), slab: cotPct_(r[18]), dres: String(r[19]).trim(), ores: String(r[20]).trim(), ds: String(r[21]).trim() })).filter(x => x.d && x.unit);
  const latest = D.reduce((m, x) => x.d > m ? x.d : m, '');
  const r1 = n => Math.round(n * 10) / 10;

  // live line status on the latest date
  const live = D.filter(x => x.d === latest).map(x => [x.unit, x.line, x.buyer, x.style, x.color, x.sam, x.mp, x.util, x.tgt, x.pro, r1(x.eff), x.days, x.slab, x.dres, x.ores, x.st]);

  // day-by-day efficiency per line batch key (for the batch sparkline) and the ramp-up curve
  const effBy = {}, ramp = {}, mEff = {};
  D.forEach(x => {
    const mk = x.d.slice(0, 7);
    const em = mEff[mk + '|' + x.unit] || (mEff[mk + '|' + x.unit] = [0, 0]); em[0] += x.aval; em[1] += x.earn;
    if (x.days < 1) return;
    const k = x.unit + '|' + x.line + '|' + x.style.toUpperCase() + '|' + x.color.toUpperCase();
    (effBy[k] = effBy[k] || []).push([x.d, x.days, r1(x.eff)]);
    if (x.days <= 20 && x.eff > 0) { const rk = mk + '|' + x.unit + '|' + x.days, o = ramp[rk] || (ramp[rk] = [0, 0, 0]); o[0] += x.eff; o[1]++; o[2] += x.slab; }
  });

  // COT_Result C:W -> Date, Unit, Dept, Line, Buyer, Style, Color, SAM, OBMP, PtlTgt, UtilMP, UnitTgt, BatchSt, TodayPro, AvalMin, EarnMin, Eff, Days, Slab, DayRes, OverRes
  const bat = [];
  cotRead_('COT_Result', 21).forEach(r => {
    const d = cotDate_(r[0]), unit = String(r[1]).trim().toUpperCase(); if (!d || !unit) return;
    const line = String(r[3]).trim(), style = cotStyle_(r[5]), color = String(r[6]).trim(), days = cotNum_(r[17]);
    const dres = String(r[19]).trim(), ores = String(r[20]).trim();
    const res = /^ach/i.test(ores) ? 'A' : /^not/i.test(ores) ? 'N' : days >= 1 ? 'U' : '-';   // U = still inside the COT ramp-up (days 1-5)
    const su = days >= 6 && days <= 8 && /^not/i.test(dres) ? 1 : 0;                          // start-up fail
    const k = unit + '|' + line + '|' + style.toUpperCase() + '|' + color.toUpperCase();
    const from = Utilities.formatDate(new Date(new Date(d + 'T12:00:00+05:30').getTime() - (days + 10) * 864e5), 'Asia/Kolkata', 'yyyy-MM-dd');
    const effs = []; (effBy[k] || []).forEach(e => { if (e[0] >= from && e[0] <= d && e[1] <= 30) effs[e[1] - 1] = e[2]; });
    for (let i = 0; i < effs.length; i++) if (effs[i] == null) effs[i] = null;
    bat.push([unit, line, String(r[4]).trim() || '-', style, color, cotNum_(r[7]), cotNum_(r[8]), d, days, r1(cotPct_(r[16])), cotPct_(r[18]), dres, ores, cotNum_(r[13]), cotNum_(r[11]), res, su, effs]);
  });
  bat.sort((a, b) => a[7] < b[7] ? 1 : a[7] > b[7] ? -1 : 0);

  const ts = new Date();
  return { builtAt: ts.getTime(), generated: Utilities.formatDate(ts, 'Asia/Kolkata', 'dd-MMM-yyyy HH:mm'), latest: latest, ms: Date.now() - t0,
    live: live, bat: bat, ramp: ramp, mEff: mEff,
    fields: { live: ['unit', 'line', 'buyer', 'style', 'color', 'sam', 'obMp', 'utilMp', 'target', 'pro', 'eff', 'days', 'slab', 'dayRes', 'overRes', 'batchSt'],
      bat: ['unit', 'line', 'buyer', 'style', 'color', 'sam', 'obMp', 'date', 'days', 'eff', 'slab', 'dayRes', 'overRes', 'pro', 'target', 'res', 'startupFail', 'effByDay'],
      ramp: 'month|unit|day -> [sumEff, n, sumSlab]', mEff: 'month|unit -> [availMin, earnMin]' } };
}

function cotDash_(p) {
  const c = CacheService.getScriptCache();
  if (!(p && p.fresh)) {
    const n = c.get('cotd_n');
    if (n) { const keys = []; for (let i = 0; i < +n; i++) keys.push('cotd_' + i); const g = c.getAll(keys); let s = '';
      for (let i = 0; i < keys.length; i++) { if (g[keys[i]] == null) { s = null; break; } s += g[keys[i]]; }
      if (s) return JSON.parse(s); }
  }
  const out = cotBuild_(); const js = JSON.stringify(out);
  try { const parts = {}; let k = 0; for (let i = 0; i < js.length; i += 95000) parts['cotd_' + (k++)] = js.slice(i, i + 95000); parts.cotd_n = String(k); c.putAll(parts, 21600); } catch (e) {}
  return out;
}

/* ---------- style history (action=cot_style&q=text[&unit=TS4]) ----------
   Every line batch of the styles whose name contains q, with start / last day, running or closed, totals,
   the COT result and the day-by-day rows from DPR_Data. Read-only; cached 5 minutes per search. */
function cotStyleHist_(p) {
  const q = String(p.q || '').toLowerCase().trim(), unit = String(p.unit || '').toUpperCase();
  if (q.length < 2) return { ok: false, error: 'Type at least 2 letters of the style' };
  const c = CacheService.getScriptCache(), key = 'cots3_' + Utilities.base64EncodeWebSafe(unit + '|' + q).slice(0, 200);
  const hit = c.get(key); if (hit) return JSON.parse(hit);
  // fast path: let the sheet filter the rows (gviz query) instead of reading the whole DPR_Data
  const src = { id: COTD.id, sheet: 'DPR_Data' }, qs = q.replace(/'/g, '');
  const res0 = appCsv_(src, "select C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W where lower(H) contains '" + qs + "'" + (unit ? " and upper(D) = '" + unit + "'" : ''));
  if (res0.error) return { ok: false, error: res0.error };
  const dt = v => cotDate_(v) || (function () { const d = new Date(v); return isNaN(d) ? '' : Utilities.formatDate(d, 'Asia/Kolkata', 'yyyy-MM-dd'); })();   // CSV dates come as dd/MM/yyyy
  const mx = appCsv_(src, 'select max(C)'), latest = mx.rows && mx.rows[0] ? dt(mx.rows[0][0]) : '';
  const rows = (res0.rows || []).map(r => { r[0] = dt(r[0]); return r; });
  const g = {};
  rows.forEach(r => {
    const d = cotDate_(r[0]), u = String(r[1]).trim().toUpperCase(); if (!d || !u || (unit && u !== unit)) return;
    const style = cotStyle_(r[5]); if (style.toLowerCase().indexOf(q) < 0) return;
    const k = u + '|' + String(r[3]).trim() + '|' + style.toUpperCase() + '|' + String(r[6]).trim().toUpperCase();
    (g[k] = g[k] || []).push({ d: d, u: u, line: String(r[3]).trim(), buyer: String(r[4]).trim() || '-', style: style, color: String(r[6]).trim(), sam: cotNum_(r[7]),
      mp: cotNum_(r[8]), util: cotNum_(r[10]), tgt: cotNum_(r[11]), st: String(r[12]).trim(), pro: cotNum_(r[13]), aval: cotNum_(r[14]), earn: cotNum_(r[15]),
      eff: cotPct_(r[16]), days: cotNum_(r[17]), slab: cotPct_(r[18]), dres: String(r[19]).trim(), ores: String(r[20]).trim() });
  });
  const r1 = n => Math.round(n * 10) / 10, out = [];
  Object.keys(g).forEach(k => {
    const a = g[k].sort((x, y) => x.d < y.d ? -1 : 1);
    let cur = null;
    a.forEach(x => {   // a new batch starts when the day count goes back down (style loaded again on that line)
      if (!cur || (x.days >= 1 && x.days < cur.lastDays)) { cur = { rows: [] }; out.push(cur); }
      cur.rows.push(x); if (x.days >= 1) cur.lastDays = x.days;
    });
  });
  const bats = out.map(b => {
    const f = b.rows[0], l = b.rows[b.rows.length - 1], lr = b.rows.filter(x => x.days >= 1).pop() || l;
    let pro = 0, aval = 0, earn = 0, best = 0; b.rows.forEach(x => { pro += x.pro; aval += x.aval; earn += x.earn; if (x.eff > best) best = x.eff; });
    return { unit: f.u, line: f.line, buyer: l.buyer, style: f.style, color: f.color, sam: l.sam, start: f.d, last: lr.d, running: lr.d === latest,
      days: lr.days, pro: pro, eff: aval ? r1(earn / aval * 100) : 0, best: r1(best), lastEff: r1(lr.eff), ores: lr.ores, dres: lr.dres, mp: l.mp, util: l.util,
      daily: b.rows.map(x => [x.d, x.days, x.util, x.tgt, x.pro, r1(x.eff), x.slab, x.dres]) };
  }).sort((x, y) => x.start < y.start ? 1 : -1).slice(0, 80);
  const res = { ok: true, q: q, latest: latest, batches: bats };
  try { const js = JSON.stringify(res); if (js.length < 95000) c.put(key, js, 300); } catch (e) {}
  return res;
}
