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
