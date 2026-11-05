/**
 * ==============================================================
 *  ASK TSPL - DEEP REPORTS (part of TSPL Error Monitor)
 *  Three short steps, driven by the report page so nothing hits
 *  Google's time limits and the user sees progress:
 *   ?action=deep_plan&token=&q=        AI plans 4-12 queries (sections + charts)
 *   ?action=deep_run&token=&job=&i=    runs query i on the live sheets (read-only)
 *   ?action=deep_write&token=&job=     AI writes the findings from the exact numbers
 *  Only signed-in users with Unit = HO or Role = Admin (Users tab).
 *  All % / ratios / weekly totals are calculated by the script, never by the AI.
 * ==============================================================
 */
const DEEP = { MAX_QUERIES: 12, MAX_ROWS: 500, ROWS_TO_AI: 40, TTL: 21600 };

function deepUser_(p) {
  const u = axUser_(p.token);
  if (!u) return { error: 'signin' };
  if (!(u.role === 'Admin' || String(u.unit).toUpperCase() === 'HO')) return { error: 'Deep reports are for HO users only. Ask the admin to set your Unit to HO in the Users list.' };
  return { user: u };
}

function deepPlanPrompt_(today) {
  return planPrompt_(today).replace(/Maximum \d+ queries\./, 'Maximum ' + DEEP.MAX_QUERIES + ' queries.')
    .replace(/Return ONLY JSON:[\s\S]*$/, '') + [
    '',
    'THIS IS A DEEP ANALYSIS REPORT ("360 degree"). Plan 4-' + DEEP.MAX_QUERIES + ' queries that together answer the request from several angles,',
    'for example: overall total, factory/unit-wise, buyer-wise, style-wise (top 10-15), floor/line-wise where available, month-wise trend, week-wise trend, day-wise trend,',
    'top defects / reasons, and comparison with the previous period. Pick only the angles that fit the request and the data. Several departments may be combined',
    '(production + efficiency + quality + FSA + cutting + needles) when the user asks for a 360 view of a unit or buyer.',
    'Each query is one report section. For each give "section" (heading), "dim" (unit|buyer|style|line|floor|month|week|day|defect|other) and a chart:',
    '  "chart":{"type":"bar"|"line"|"pie"|"none","x":0,"y":[1]}  (x and y are 0-based column positions in YOUR select; use line for time trends, pie only for shares of a whole).',
    'If a ratio/share is added, its new column comes after your select columns (e.g. select D, sum(R), sum(Q) + ratio -> the % is column 3) and you may chart it.',
    'WEEK-WISE: there is no week function. Select the date column FIRST plus numeric sums, group by the date, and add "week":true -',
    'the script will add up the days into Monday-Sunday weeks (then ratios are calculated on the weekly sums).',
    'MONTH-WISE: use year(C), month(C) in select/group by (month is 0-based - the script shows the month name), or a date range per month.',
    'Order by the date ascending for trends; for rankings order by the measure descending with limit 15.',
    'ALWAYS add a label clause so every column has a plain name managers understand, e.g. label D \'Unit\', sum(AK) \'Output pcs\', sum(X) \'Target pcs\', sum(R) \'Earned min\', sum(Q) \'Available min\', count(E) \'Audits\'.',
    'Give the report a short "title" and the "period" it covers in words.',
    'Return ONLY JSON: {"title":"...","period":"...","queries":[{"section":"...","dim":"unit","source":"PROD","table":"","purpose":"...","tq":"select ...","ratio":[],"share":null,"week":false,"chart":{"type":"bar","x":0,"y":[1]}}],"clarify":""}'
  ].join('\n');
}

function deepWritePrompt_(today) {
  return [
    'You are "Ask TSPL", writing a management analysis report for Texport Syndicate (garment exporter; units FIPL, TS2, TS4, TS9, AP2). Today is ' + today + '.',
    'Write ONLY from the query results given. Never invent or recalculate numbers - percent columns and TOTAL rows were computed exactly by the script; copy them.',
    'Be specific and quantitative: name the best and worst factory/buyer/style/line, the size of gaps, trends (up/down by how much), and anything unusual.',
    'Efficiency = earned / available minutes; pass % = PASS / (PASS + FAIL). If a section is empty or failed, say so briefly.',
    'If the request was in Hindi/Kannada, write in that language.',
    'Return ONLY JSON: {"summary":["4-7 short bullet findings with **bold** key numbers"],',
    '"sections":[{"n":1,"insight":"1-3 sentences for result 1"}, ...one per result...],',
    '"actions":["3-6 concrete suggested actions with owner department"],"watch":["0-4 risks or data gaps to check"]}'
  ].join('\n');
}

function deepKey_() { const k = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY'); if (!k) throw new Error('AI key not set (GEMINI_API_KEY)'); return k; }
function deepToday_() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd (EEEE)'); }

function deepPlan_(p) {
  const a = deepUser_(p); if (a.error) return { ok: false, error: a.error };
  const q = String(p.q || '').trim().slice(0, 600);
  if (q.length < 5) return { ok: false, error: 'Please describe the report you want.' };
  ASK_DEADLINE_ = Date.now() + 75000;
  try {
    const plan = gemini_(deepPlanPrompt_(deepToday_()), 'Report request: ' + q, deepKey_());
    if (plan.clarify && !(plan.queries && plan.queries.length)) return { ok: true, clarify: plan.clarify };
    const qs = (plan.queries || []).slice(0, DEEP.MAX_QUERIES).filter(x => x && x.tq && x.source);
    if (!qs.length) return { ok: false, error: 'Could not plan this report. Try naming the unit, department and period.' };
    const job = 'J' + Utilities.getUuid().replace(/-/g, '').slice(0, 16);
    const rec = { q: q, title: plan.title || q, period: plan.period || '', queries: qs, by: a.user.email, at: new Date().toISOString() };
    CacheService.getScriptCache().put('deep_' + job, JSON.stringify(rec), DEEP.TTL);
    axLog_(a.user.email, p.login, 'deep report', q, p.page);
    return { ok: true, job: job, title: rec.title, period: rec.period, sections: qs.map(x => ({ section: x.section || x.purpose, dim: x.dim || '', source: sourceName_(x.source) + (x.table ? ' - ' + x.table : ''), chart: x.chart || null })) };
  } catch (e) { return { ok: false, error: friendlyErr_(e) }; }
}

function deepWeek_(r) {   // first column = date -> Monday-Sunday weeks, numeric columns summed
  const tz = Session.getScriptTimeZone(), sums = {}, order = [];
  r.rows.forEach(row => {
    const d = kpiDate_(row[0]); if (!d) return;
    const mon = new Date(d.getTime()); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
    const k = Utilities.formatDate(mon, tz, 'yyyy-MM-dd');
    if (!sums[k]) { sums[k] = row.map(() => 0); order.push(k); }
    row.forEach((v, i) => { if (i > 0) sums[k][i] += kpiNum_(v); });
  });
  order.sort();
  r.headers = ['Week starting'].concat(r.headers.slice(1));
  r.rows = order.map(k => [Utilities.formatDate(new Date(k + 'T00:00:00'), tz, 'dd-MMM-yy')].concat(sums[k].slice(1).map(v => String(Math.round(v * 100) / 100))));
}

function deepMonthNames_(r) {   // year(C), month(C) -> "Oct-2026" (month is 0-based in the query language)
  const M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const yi = r.headers.findIndex(h => /^year\(/i.test(h)), mi = r.headers.findIndex(h => /^month\(/i.test(h));
  if (yi < 0 || mi < 0) return;
  r.rows.forEach(row => { const m = parseInt(row[mi], 10); if (!isNaN(m)) row[mi] = M[m] + '-' + row[yi]; });
  r.headers[mi] = 'Month';
}

function deepRun_(p) {
  const a = deepUser_(p); if (a.error) return { ok: false, error: a.error };
  const cache = CacheService.getScriptCache();
  const raw = cache.get('deep_' + p.job); if (!raw) return { ok: false, error: 'This report has expired. Please run it again.' };
  const rec = JSON.parse(raw), i = Number(p.i);
  let q = rec.queries[i]; if (!q) return { ok: false, error: 'No such section' };
  ASK_DEADLINE_ = Date.now() + 75000;
  let r = runQuery_(q);
  if (r.error) {
    try {
      const fix = gemini_(planPrompt_(deepToday_()), 'This query failed with error: ' + r.error + '\nQuery: ' + q.tq + '\nSection: ' + (q.section || q.purpose) +
        '\nReport request: ' + rec.q + '\nReturn JSON with one corrected query in "queries".', deepKey_());
      if (fix.queries && fix.queries[0]) { const q2 = Object.assign({}, q, fix.queries[0], { section: q.section, chart: q.chart, week: q.week, dim: q.dim }); const r2 = runQuery_(q2); if (!r2.error) { r = r2; q = q2; rec.queries[i] = q2; cache.put('deep_' + p.job, JSON.stringify(rec), DEEP.TTL); } }
    } catch (e) {}
  }
  const out = { section: q.section || q.purpose, source: sourceName_(q.source) + (q.table ? ' - ' + q.table : ''), tq: q.tq, chart: q.chart || null, error: r.error || '', headers: [], rows: [] };
  if (!r.error) {
    r.headers = (r.headers || []).slice(); r.rows = (r.rows || []).map(x => x.slice());
    if (q.week && r.rows.length) { try { deepWeek_(r); } catch (e) {} }
    deepMonthNames_(r);
    applyCalcs_(r, q);
    out.headers = r.headers; out.rows = r.rows.slice(0, DEEP.MAX_ROWS); out.total = r.rows.length;
  }
  try { cache.put('deep_' + p.job + '_' + i, JSON.stringify({ section: out.section, error: out.error, headers: out.headers, rows: out.rows.slice(0, DEEP.ROWS_TO_AI), total: out.total || 0 }), DEEP.TTL); } catch (e) {}
  return Object.assign({ ok: true, i: i }, out);
}

function deepWrite_(p) {
  const a = deepUser_(p); if (a.error) return { ok: false, error: a.error };
  const cache = CacheService.getScriptCache();
  const raw = cache.get('deep_' + p.job); if (!raw) return { ok: false, error: 'This report has expired. Please run it again.' };
  const rec = JSON.parse(raw);
  const brief = rec.queries.map((q, i) => {
    const r = JSON.parse(cache.get('deep_' + p.job + '_' + i) || '{"error":"not run"}');
    return 'Result ' + (i + 1) + ' - ' + (q.section || q.purpose) + (r.error ? '\nERROR: ' + r.error :
      '\n' + [r.headers].concat(r.rows || []).map(x => x.join(' | ')).join('\n') + ((r.total || 0) > (r.rows || []).length ? '\n... ' + (r.total - r.rows.length) + ' more rows' : ''));
  }).join('\n\n');
  ASK_DEADLINE_ = Date.now() + 75000;
  try {
    const w = gemini_(deepWritePrompt_(deepToday_()), 'Report request: ' + rec.q + '\nTitle: ' + rec.title + '\nPeriod: ' + rec.period + '\n\n' + brief.slice(0, 60000), deepKey_());
    return { ok: true, title: rec.title, period: rec.period, summary: w.summary || [], sections: w.sections || [], actions: w.actions || [], watch: w.watch || [] };
  } catch (e) { return { ok: false, error: friendlyErr_(e) }; }
}
