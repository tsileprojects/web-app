/**
 * ==============================================================
 *  NEEDLE CONTROL TOWER + LINE DEFECTS (part of TSPL Error Monitor)
 *   ?action=needle_tower            every unit + CMD: stock, days of cover, 14-day use, suggestions
 *   ?action=line_defects&unit=&date= defect counts by line and defect name (end-line QC; TS2, FIPL, AP2)
 *  Read-only. Reads the Live_Stock tables and the QC summary tabs only - never the
 *  needle entry file, so it cannot slow the Needle Issue Form. Cached 15 / 5 minutes.
 * ==============================================================
 */
const TW_DAYS = 14;               // window for average daily use
const TW_COVER_TARGET = 7;        // suggest enough stock for this many days
const TW_LOW = 3;                 // below this many days of cover = low
const TW_SURPLUS = 15;            // above this many days of cover = can give some away
const TW_NTREQ = { id: '1nZisFRe-vUlKuGcMLvSexQWlTm7gdRQxqlg1tmvUuzQ', sheet: 'NT_Req' };
const TW_QC = {
  TS2: { id: '1tflN8tumxBqvhckxDixGgsqs3m_D7E-i_AgHmP6IX1I', sheet: 'TS2_ELDft_Smy' },
  FIPL: { id: '1tflN8tumxBqvhckxDixGgsqs3m_D7E-i_AgHmP6IX1I', sheet: 'TS2_ELDft_Smy' },
  AP2: { id: '1SE_mkH8rAa8lZq7e5afgg9U5qg1gyv6FMVych_-LvMc', sheet: 'AP2_ELDft_Smy' }
};

function twRound10_(n) { return Math.ceil(n / 10) * 10; }
function twMonth_(v) {   // '2026-12-01', 'Dec-2026', 'December 2026', '12/2026' -> Date (1st of month)
  const d = kpiDate_(v); if (d) return d;
  const s = String(v || '').trim(); if (!s) return null;
  const m = s.match(/^(\d{1,2})[\/-](\d{4})$/); if (m) return new Date(+m[2], +m[1] - 1, 1);
  const t = new Date('1 ' + s.replace(/-/g, ' ')); if (!isNaN(t)) return t;
  const t2 = new Date(s); return isNaN(t2) ? null : t2;
}

function needleTower_() {
  const c = CacheService.getScriptCache(), hit = c.get('ndl_tower_v1');
  if (hit) return JSON.parse(hit);
  const tables = kpiSrc_('NDLSTK').tables, tz = Session.getScriptTimeZone();
  const units = {}, trend = {}, errors = [];
  Object.keys(tables).forEach(u => {
    const t = tables[u];
    const m = appCsv_(t, 'select max(B)');
    const last = m.error ? null : kpiDate_(m.rows[0] && m.rows[0][0]);
    if (!last) { errors.push(u + ': no stock date'); units[u] = { unit: u, date: null, types: [] }; return; }
    const from = new Date(last.getTime() - (TW_DAYS - 1) * 864e5);
    // per type: latest close, total issued to line in the window
    const r = appCsv_(t, "select D, sum(G), max(B) where B >= date '" + kpiFmt_(from) + "' and B <= date '" + kpiFmt_(last) + "' group by D");
    const now = appCsv_(t, "select D, sum(L), sum(G) where B = date '" + kpiFmt_(last) + "' group by D");
    const per = {};
    (r.rows || []).forEach(x => { const k = String(x[0] || '').trim(); if (k) per[k] = { type: k, used14: kpiNum_(x[1]) }; });
    (now.rows || []).forEach(x => { const k = String(x[0] || '').trim(); if (!k) return; per[k] = per[k] || { type: k, used14: 0 }; per[k].stock = kpiNum_(x[1]); per[k].today = kpiNum_(x[2]); });
    const types = Object.keys(per).map(k => {
      const p = per[k]; p.stock = p.stock || 0; p.today = p.today || 0;
      p.avg = Math.round(p.used14 / TW_DAYS * 10) / 10;
      p.cover = p.avg > 0 ? Math.round(p.stock / p.avg * 10) / 10 : null;
      return p;
    });
    const d = appCsv_(t, "select B, sum(G) where B >= date '" + kpiFmt_(from) + "' group by B order by B");
    (d.rows || []).forEach(x => { const dt = kpiDate_(x[0]); if (!dt) return; const k = kpiFmt_(dt); trend[k] = (trend[k] || 0) + (u === 'CMD' ? 0 : kpiNum_(x[1])); });
    const stock = types.reduce((a, p) => a + p.stock, 0), avg = types.reduce((a, p) => a + p.avg, 0);
    units[u] = { unit: u, date: kpiFmt_(last), stock: stock, avg: Math.round(avg * 10) / 10,
      cover: avg > 0 ? Math.round(stock / avg * 10) / 10 : null, today: types.reduce((a, p) => a + p.today, 0), types: types };
  });

  // next month's plan requirement (NT_Req: A unit, B month, C needle type, D total req)
  const need = {};
  try {
    const nm = new Date(); nm.setDate(1); nm.setMonth(nm.getMonth() + 1);
    const r = appCsv_(TW_NTREQ, 'select A, B, C, sum(D) group by A, B, C');
    (r.rows || []).forEach(x => {
      const dt = twMonth_(x[1]); if (!dt || dt.getMonth() !== nm.getMonth() || dt.getFullYear() !== nm.getFullYear()) return;
      const k = String(x[0]).trim().toUpperCase() + '|' + String(x[2]).trim().toUpperCase();
      need[k] = (need[k] || 0) + kpiNum_(x[3]);
    });
  } catch (e) { errors.push('plan: ' + e.message); }

  // suggestions: units below TW_LOW days of cover -> move from a unit with surplus, else issue from CMD, else buy
  const sugg = [], cmd = units.CMD || { types: [] };
  const cmdLeft = {}; cmd.types.forEach(p => { cmdLeft[p.type.toUpperCase()] = p.stock; });
  KPI_UNITS.forEach(u => {
    (units[u] ? units[u].types : []).forEach(p => {
      if (p.cover === null || p.cover >= TW_LOW) return;
      const key = p.type.toUpperCase();
      let qty = twRound10_(Math.max(p.avg * TW_COVER_TARGET - p.stock, 10));
      const s = { unit: u, type: p.type, stock: p.stock, avg: p.avg, cover: p.cover, need: need[u + '|' + key] || null, qty: qty };
      let donor = null;
      KPI_UNITS.forEach(v => {
        if (v === u || donor) return;
        const q = (units[v] ? units[v].types : []).filter(x => x.type.toUpperCase() === key)[0];
        if (q && q.cover !== null && q.cover > TW_SURPLUS && q.stock - q.avg * TW_SURPLUS >= qty) donor = v;
        if (q && q.cover === null && q.stock >= qty * 2) donor = v;   // stock but no recent use
      });
      if (donor) { s.action = 'move'; s.from = donor; s.text = 'Move ' + qty + ' from ' + donor; }
      else if ((cmdLeft[key] || 0) >= qty) { s.action = 'issue'; s.from = 'CMD'; s.text = 'Issue ' + qty + ' from CMD'; cmdLeft[key] -= qty; }
      else { s.action = 'buy'; s.text = 'Buy ' + qty; }
      sugg.push(s);
    });
  });
  sugg.sort((a, b) => a.cover - b.cover);

  const top = [];
  KPI_UNITS.forEach(u => (units[u] ? units[u].types : []).forEach(p => { if (p.used14 > 0) top.push({ unit: u, type: p.type, used14: p.used14, avg: p.avg }); }));
  top.sort((a, b) => b.used14 - a.used14);

  const out = { ok: true, time: Utilities.formatDate(new Date(), tz, 'HH:mm'), units: ['CMD'].concat(KPI_UNITS).map(u => {
      const x = units[u] || { unit: u, types: [] }; return { unit: u, date: x.date, stock: x.stock || 0, avg: x.avg || 0, cover: x.cover, today: x.today || 0,
        low: (x.types || []).filter(p => p.cover !== null && p.cover < TW_LOW).length }; }),
    suggestions: sugg.slice(0, 40), top: top.slice(0, 10),
    trend: Object.keys(trend).sort().map(k => ({ date: k, used: trend[k] })), rules: { days: TW_DAYS, low: TW_LOW, surplus: TW_SURPLUS, target: TW_COVER_TARGET }, errors: errors };
  try { c.put('ndl_tower_v1', JSON.stringify(out), 900); } catch (e) {}
  return out;
}

/** Defects by line and defect name for one unit and date, from the end-line QC summary tabs. */
function lineDefects_(unit, date) {
  unit = String(unit || '').toUpperCase();
  const t = TW_QC[unit];
  if (!t) return { ok: true, unit: unit, available: false, note: 'End-line QC tablets are not used in ' + unit + ' yet.' };
  date = String(date || '') || tdToday_();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: 'Date must be YYYY-MM-DD' };
  const c = CacheService.getScriptCache(), key = 'ldef_' + unit + '_' + date, hit = c.get(key);
  if (hit) return JSON.parse(hit);
  const r = appCsv_(t, 'select *');
  if (r.error) return { ok: false, error: r.error };
  const head = r.headers.map(h => String(h).trim()), want = Utilities.formatDate(new Date(date + 'T00:00:00'), Session.getScriptTimeZone(), 'dd-MMM-yyyy');
  const lines = {}, total = {};
  r.rows.forEach(x => {
    const d = kpiDate_(x[0]); const ds = d ? kpiFmt_(d) : String(x[0]).trim();
    if (ds !== date && String(x[0]).trim() !== want) return;
    if (String(x[1]).trim().toUpperCase() !== unit) return;
    const ln = String(x[2]).trim(); const L = lines[ln] = lines[ln] || { line: ln, total: 0, defects: {} };
    for (let i = 7; i < head.length; i++) {
      const n = kpiNum_(x[i]); if (!n || !head[i]) continue;
      L.defects[head[i]] = (L.defects[head[i]] || 0) + n; L.total += n; total[head[i]] = (total[head[i]] || 0) + n;
    }
  });
  const sortObj = o => Object.keys(o).map(k => ({ name: k, n: o[k] })).sort((a, b) => b.n - a.n);
  const out = { ok: true, unit: unit, date: date, available: true, total: sortObj(total),
    lines: Object.keys(lines).map(k => ({ line: k, total: lines[k].total, defects: sortObj(lines[k].defects) })) };
  try { c.put(key, JSON.stringify(out), date === tdToday_() ? 300 : 1800); } catch (e) {}
  return out;
}
