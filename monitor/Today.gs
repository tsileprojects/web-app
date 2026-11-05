/**
 * ==============================================================
 *  TODAY - LIVE PRODUCTION (part of TSPL Error Monitor)
 *   ?action=today   today's DPR so far, per unit, with hour-by-hour output
 *  One light query, cached 5 minutes. Read-only.
 *  "So far" = the larger of Today Pro (AK) and the sum of the hourly columns
 *  AB..AJ (1st..9th hour), because AK is sometimes filled only at day end.
 * ==============================================================
 */
function todayLive_() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('today_v1'); if (hit) return JSON.parse(hit);
  const tz = Session.getScriptTimeZone();
  const date = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const out = { ok: true, date: date, time: Utilities.formatDate(new Date(), tz, 'HH:mm'), units: [] };
  const H = ['AB', 'AC', 'AD', 'AE', 'AF', 'AG', 'AH', 'AI', 'AJ'];
  const r = appCsv_(kpiSrc_('PROD'), "select D, sum(AK), sum(X), count(F), " + H.map(c => 'sum(' + c + ')').join(', ') +
    " where C = date '" + date + "' and E = 'Sew' and X > 0 group by D");
  if (r.error) return { ok: false, error: r.error, date: date };
  const by = {};
  (r.rows || []).forEach(x => {
    const hours = H.map((c, i) => kpiNum_(x[4 + i]));
    const hourSum = hours.reduce((a, b) => a + b, 0);
    let last = 0; hours.forEach((v, i) => { if (v > 0) last = i + 1; });
    by[x[0]] = { unit: x[0], pro: Math.max(kpiNum_(x[1]), hourSum), tgt: kpiNum_(x[2]), lines: kpiNum_(x[3]), hours: hours, hoursDone: last };
  });
  KPI_UNITS.forEach(u => out.units.push(by[u] || { unit: u, pro: 0, tgt: 0, lines: 0, hours: [], hoursDone: 0 }));
  try { cache.put('today_v1', JSON.stringify(out), 300); } catch (e) {}
  return out;
}
