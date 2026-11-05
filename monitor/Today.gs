/**
 * ==============================================================
 *  TODAY - LIVE PRODUCTION (part of TSPL Error Monitor)
 *   ?action=today              today's DPR so far, per unit, hour by hour
 *   ?action=prod_day&date=     the same for any date (YYYY-MM-DD)
 *   ?action=drill&unit=&date=  line-wise + product-wise detail (live for today)
 *  Read-only. Today is cached 5 min, past days 30 min.
 *  "Output" = the larger of Today Pro (AK) and the sum of the hourly columns
 *  AB..AJ (1st..9th hour), because AK is sometimes filled only at day end.
 * ==============================================================
 */
const TD_H = ['AB', 'AC', 'AD', 'AE', 'AF', 'AG', 'AH', 'AI', 'AJ'];

function tdToday_() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'); }
function tdHours_(x, from) {
  const hours = TD_H.map((c, i) => kpiNum_(x[from + i]));
  let last = 0; hours.forEach((v, i) => { if (v > 0) last = i + 1; });
  return { hours: hours, sum: hours.reduce((a, b) => a + b, 0), done: last };
}

/** "Update now": re-read the sheet, but at most once a minute per view. */
function tdFresh_(key, fresh) {
  if (String(fresh) !== '1') return false;
  const c = CacheService.getScriptCache();
  if (c.get('fresh_' + key)) return false;
  c.put('fresh_' + key, '1', 60);
  return true;
}

function todayLive_(fresh) { return prodDay_(tdToday_(), fresh); }

function prodDay_(date, fresh) {
  date = String(date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: 'Date must be YYYY-MM-DD' };
  const isToday = date === tdToday_();
  const cache = CacheService.getScriptCache(), key = 'prodday_' + date;
  const hit = cache.get(key); if (hit && !tdFresh_(key, fresh)) return JSON.parse(hit);
  const tz = Session.getScriptTimeZone();
  const out = { ok: true, date: date, live: isToday, time: Utilities.formatDate(new Date(), tz, 'HH:mm'), units: [] };
  const r = appCsv_(kpiSrc_('PROD'), "select D, sum(AK), sum(X), count(F), " + TD_H.map(c => 'sum(' + c + ')').join(', ') +
    " where C = date '" + date + "' and E = 'Sew' and X > 0 group by D");
  if (r.error) return { ok: false, error: r.error, date: date };
  const by = {};
  (r.rows || []).forEach(x => {
    const h = tdHours_(x, 4);
    by[x[0]] = { unit: x[0], pro: Math.max(kpiNum_(x[1]), h.sum), tgt: kpiNum_(x[2]), lines: kpiNum_(x[3]), hours: h.hours, hoursDone: h.done };
  });
  KPI_UNITS.forEach(u => out.units.push(by[u] || { unit: u, pro: 0, tgt: 0, lines: 0, hours: [], hoursDone: 0 }));
  try { cache.put(key, JSON.stringify(out), isToday ? 300 : 1800); } catch (e) {}
  return out;
}

/** Line-wise and product-wise detail for one unit and date (live for today). */
function drillLive_(unit, date, fresh) {
  unit = String(unit || '').toUpperCase();
  if (KPI_UNITS.indexOf(unit) < 0) return { ok: false, error: 'Unknown unit' };
  date = String(date || '') || tdToday_();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: 'Date must be YYYY-MM-DD' };
  const isToday = date === tdToday_();
  const cache = CacheService.getScriptCache(), key = 'drill3_' + unit + '_' + date;
  const hit = cache.get(key); if (hit && !tdFresh_(key, fresh)) return JSON.parse(hit);
  const lines = {}, errs = [];
  const L = no => { no = String(no == null ? '' : no).trim(); if (!no) return null; return lines[no] = lines[no] || { line: no, styles: [] }; };
  const w = "D = '" + unit + "' and C = date '" + date + "'";
  try {
    // F line, G buyer, H style, I colour, Z status | AK today, X target, AP operators, AO remark, J order qty, AL cum pro, L cum cut, O cum load, AM WIP | hourly
    const r = appCsv_(kpiSrc_('PROD'), "select F, G, H, I, Z, sum(AK), sum(X), sum(AP), max(AO), max(J), sum(AL), max(L), max(O), sum(AM), " + TD_H.map(c => 'sum(' + c + ')').join(', ') +
      " where " + w + " and E = 'Sew' group by F, G, H, I, Z");
    if (r.error) errs.push('production: ' + r.error);
    (r.rows || []).forEach(x => {
      const l = L(x[0]); if (!l) return;
      const h = tdHours_(x, 14), pro = Math.max(kpiNum_(x[5]), h.sum), tgt = kpiNum_(x[6]);
      const st = { buyer: String(x[1] || '').trim(), style: String(x[2] || '').trim(), color: String(x[3] || '').trim(), status: String(x[4] || '').trim(), pro: pro, tgt: tgt,
        order: kpiNum_(x[9]), dprCum: kpiNum_(x[10]), cumCut: kpiNum_(x[11]), cumLoad: kpiNum_(x[12]), wip: kpiNum_(x[13]), hours: h.hours };
      l.styles.push(st);
      l.buyer = l.buyer || st.buyer;
      if ((l.style || '').split(', ').indexOf(st.style) < 0) l.style = l.style ? l.style + ', ' + st.style : st.style;
      if ((l.color || '').split(', ').indexOf(st.color) < 0 && st.color) l.color = l.color ? l.color + ', ' + st.color : st.color;
      l.status = st.status;
      l.pro = (l.pro || 0) + pro; l.tgt = (l.tgt || 0) + tgt; l.mp = (l.mp || 0) + kpiNum_(x[7]); l.wip = (l.wip || 0) + st.wip;
      l.hours = (l.hours || TD_H.map(() => 0)).map((v, i) => v + h.hours[i]);
      l.hoursDone = Math.max(l.hoursDone || 0, h.done);
      const rem = String(x[8] || '').trim(); if (rem && !/^(na|n\/a|-|0)$/i.test(rem)) l.remark = rem.slice(0, 120);
    });
  } catch (e) { errs.push('production: ' + e.message); }
  if (!isToday) {   // efficiency is in COT up to yesterday only
    try {
      const r = appCsv_(kpiSrc_('EFF'), "select F, sum(R), sum(Q) where " + w + " group by F");
      (r.rows || []).forEach(x => { const l = L(x[0]); if (!l) return; l.earn = kpiNum_(x[1]); l.avail = kpiNum_(x[2]); l.eff = l.avail ? Math.round(l.earn / l.avail * 1000) / 10 : null; });
    } catch (e) { errs.push('efficiency: ' + e.message); }
  }
  try {
    const r = appCsv_(kpiSrc_('QUAL'), "select F, sum(AH), sum(AG), sum(AI) where " + w + " group by F");
    (r.rows || []).forEach(x => { const l = L(x[0]); if (!l) return; const chk = kpiNum_(x[2]); l.chk = chk;
      l.ftr = chk ? Math.round(kpiNum_(x[1]) / chk * 1000) / 10 : null; l.dft = chk ? Math.round(kpiNum_(x[3]) / chk * 1000) / 10 : null; });
  } catch (e) { errs.push('quality: ' + e.message); }
  const list = Object.keys(lines).map(k => lines[k]).sort((a, b) => {
    const na = parseFloat(a.line), nb = parseFloat(b.line);
    return (isNaN(na) || isNaN(nb)) ? String(a.line).localeCompare(b.line) : (na - nb || String(a.line).localeCompare(b.line));
  });
  // product-wise (buyer + style), with colours
  const prod = {};
  list.forEach(l => (l.styles || []).forEach(s => {
    const k = s.buyer + '|' + s.style;
    const p = prod[k] = prod[k] || { buyer: s.buyer, style: s.style, lines: [], pro: 0, tgt: 0, colors: {} };
    p.pro += s.pro; p.tgt += s.tgt; if (p.lines.indexOf(l.line) < 0) p.lines.push(l.line);
    const ck = s.color || '-';
    const c = p.colors[ck] = p.colors[ck] || { color: ck, lines: [], pro: 0, tgt: 0, order: 0, dprCum: 0, cumCut: 0, cumLoad: 0, wip: 0 };
    c.pro += s.pro; c.tgt += s.tgt; c.dprCum += s.dprCum; c.wip += s.wip; if (c.lines.indexOf(l.line) < 0) c.lines.push(l.line);
    c.order = Math.max(c.order, s.order); c.cumCut = Math.max(c.cumCut, s.cumCut); c.cumLoad = Math.max(c.cumLoad, s.cumLoad);
  }));
  // cumulative produced to date (sum of every day's output) for these styles - this unit and all units
  const styleNames = Object.keys(prod).map(k => prod[k].style).filter((v, i, a) => v && a.indexOf(v) === i).slice(0, 25);
  if (styleNames.length) {
    try {
      const cond = styleNames.map(n => "H = '" + n.replace(/'/g, "\\'") + "'").join(' or ');
      const r = appCsv_(kpiSrc_('PROD'), "select D, H, I, sum(AK), min(C) where E = 'Sew' and C <= date '" + date + "' and (" + cond + ") group by D, H, I");
      if (r.error) errs.push('cumulative: ' + r.error);
      (r.rows || []).forEach(x => {
        const u = String(x[0]).trim(), st = String(x[1] || '').trim(), col = String(x[2] || '').trim() || '-', n = kpiNum_(x[3]), first = kpiDate_(x[4]);
        Object.keys(prod).forEach(k => {
          const p = prod[k]; if (p.style !== st) return;
          p.cumAll = (p.cumAll || 0) + n;
          if (!p.unitsRun) p.unitsRun = []; if (p.unitsRun.indexOf(u) < 0) p.unitsRun.push(u);
          if (u === unit) {
            p.cumUnit = (p.cumUnit || 0) + n;
            if (first && (!p.since || first < new Date(p.since))) p.since = kpiFmt_(first);
            if (p.colors[col]) p.colors[col].cumUnit = (p.colors[col].cumUnit || 0) + n;
          }
        });
      });
    } catch (e) { errs.push('cumulative: ' + e.message); }
  }
  const products = Object.keys(prod).map(k => {
    const p = prod[k];
    p.colors = Object.keys(p.colors).map(c => p.colors[c]).sort((a, b) => b.pro - a.pro);
    p.order = p.colors.reduce((a, c) => a + (c.order || 0), 0);
    p.dprCum = p.colors.reduce((a, c) => a + (c.dprCum || 0), 0);
    p.wip = p.colors.reduce((a, c) => a + (c.wip || 0), 0);
    return p;
  }).sort((a, b) => b.pro - a.pro);
  const out = { ok: true, unit: unit, date: date, live: isToday, time: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm'), lines: list, products: products, errors: errs };
  try { cache.put(key, JSON.stringify(out), isToday ? 300 : 1800); } catch (e) {}
  return out;
}
