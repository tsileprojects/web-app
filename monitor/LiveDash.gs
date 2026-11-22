/* ================= LIVE CONTROL ROOM feed (action=live_dash) =================
   Line-wise DPR for one day (today by default; Sunday/no data -> latest day with output).
   Source: the PROD datamaster (DPR_DM_L1) via gviz, same as ?action=today.
   Efficiency = earned min (pcs x OB SAM) / available min (operators x 60 x hours worked).
   Hours worked = last hour with output (live today), at least 8 for finished days.
   COT target slab: day 1-5 = 10% x day, day 6+ = 55%.
   Cached 5 min (today) / 60 min (past days); ?fresh=1 re-reads at most once a minute. */
function liveDash_(p) {
  const tz = Session.getScriptTimeZone(), today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  let date = String(p.date || '');
  const cache = CacheService.getScriptCache();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    // latest date with output, today included
    const lk = 'live_latest', hit = cache.get(lk);
    if (hit && String(p.fresh) !== '1') date = hit;
    else {
      const r = appCsv_(kpiSrc_('PROD'), "select max(C) where E = 'Sew' and AK > 0");
      const v = r.rows && r.rows[0] && r.rows[0][0];
      const d = v ? new Date(v) : null;
      date = d && !isNaN(d) ? Utilities.formatDate(d, tz, 'yyyy-MM-dd') : today;
      cache.put(lk, date, 300);
    }
  }
  const isToday = date === today, key = 'live2_' + date;
  const hit = cache.get(key); if (hit && !tdFresh_(key, p.fresh)) return JSON.parse(hit);

  // D unit, F line, G buyer, H style, I colour, P OB SAM, AP operators, X target, AA running days, Z status, AK today pro, AB..AJ hours
  const q = "select D, F, G, H, I, max(P), sum(AP), sum(X), max(AA), max(Z), sum(AK), " + TD_H.map(c => 'sum(' + c + ')').join(', ') +
    " where C = date '" + date + "' and E = 'Sew' and (X > 0 or AK > 0 or AB > 0) group by D, F, G, H, I";
  const r = appCsv_(kpiSrc_('PROD'), q);
  if (r.error) return { ok: false, error: r.error, date: date };
  let maxDone = 0;
  const rows = (r.rows || []).map(x => {
    const h = tdHours_(x, 11), pro = Math.max(kpiNum_(x[10]), h.sum);
    maxDone = Math.max(maxDone, h.done);
    return { u: String(x[0]).trim().toUpperCase().replace(/^AP$/, 'AP2'), l: String(x[1]).trim(), b: String(x[2] || '').trim() || '-', s: String(x[3] || '').replace(/^#\s*/, '').trim(),
      c: String(x[4] || '').trim(), sam: kpiNum_(x[5]), mp: kpiNum_(x[6]), t: kpiNum_(x[7]), d: kpiNum_(x[8]), st: String(x[9] || '').trim(), p: pro, h: h.hours, done: h.done };
  }).filter(x => x.u && (x.p > 0 || x.t > 0));
  const hrs = isToday ? Math.max(1, maxDone) : Math.max(8, maxDone);
  rows.forEach(x => {
    x.av = Math.round(x.mp * 60 * hrs); x.er = Math.round(x.p * x.sam);
    x.e = x.av ? Math.round(x.er / x.av * 1000) / 10 : 0;
    x.sl = x.d >= 6 ? 55 : x.d >= 1 ? x.d * 10 : 55;
  });

  // recent days for the date picker
  let days = [];
  try {
    const dr = appCsv_(kpiSrc_('PROD'), "select C, sum(AK) where E = 'Sew' and C >= date '" +
      Utilities.formatDate(new Date(new Date(date + 'T12:00:00').getTime() - 20 * 864e5), tz, 'yyyy-MM-dd') + "' group by C order by C desc");
    days = (dr.rows || []).map(x => { const d = new Date(x[0]); return isNaN(d) ? '' : Utilities.formatDate(d, tz, 'yyyy-MM-dd'); }).filter(Boolean).slice(0, 14);
  } catch (e) {}
  if (days.indexOf(date) < 0) days.unshift(date);

  const out = { ok: true, date: date, live: isToday, hours: hrs, time: Utilities.formatDate(new Date(), tz, 'dd-MMM-yyyy HH:mm'), builtAt: Date.now(), days: days, lines: rows,
    note: 'Eff = pcs x OB SAM / (operators x 60 x ' + hrs + ' h)' };
  try { cache.put(key, JSON.stringify(out), isToday ? 300 : 3600); } catch (e) {}
  return out;
}
