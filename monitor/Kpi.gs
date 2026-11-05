/**
 * ==============================================================
 *  KPI + STATUS FEED for TV mode and the status page
 *  (third file of the "TSPL Error Monitor" project - read-only)
 *   ?action=kpis  -> latest production vs target, efficiency (+10-day
 *                    trend), FTR and FSA pass % month-to-date, per unit
 *   ?action=apps  -> every program the monitor checks, with its status
 * ==============================================================
 */
const KPI_UNITS = ['AP2', 'FIPL', 'TS2', 'TS4', 'TS9'];

function kpiSrc_(key) { return ASK.SOURCES.filter(s => s.key === key)[0]; }

function kpiDate_(v) {
  const m = String(v || '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}
function kpiFmt_(d) { return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd'); }
function kpiNum_(v) { const n = parseFloat(String(v).replace(/[,%\s]/g, '')); return isNaN(n) ? 0 : n; }
function kpiMax_(src, col) { const r = gviz_(src, 'select max(' + col + ')'); return r.error ? null : kpiDate_(r.rows[0] && r.rows[0][0]); }

/** Fast path for the web pages: fresh copy, else the last saved copy (kept up to date by refreshKpis). */
function kpis_() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('kpis_v1') || cache.get('kpis_stale');
  kpiEnsureTrigger_();
  if (hit) return JSON.parse(hit);
  return kpisCompute_();
}

/** Time trigger (every 30 min, 6 AM - 10 PM): rebuild the numbers so nobody waits. */
function refreshKpis() {
  const h = Number(Utilities.formatDate(new Date(), 'Asia/Kolkata', 'H'));
  if (h < 6 || h >= 22) return 'night - skipped';
  const k = kpisCompute_();
  try {
    const p = reportProduction_();
    const c = CacheService.getScriptCache();
    c.put('report_v1', JSON.stringify({ ok: true, k: k, p: p }), 1800);
    c.put('report_stale', JSON.stringify({ ok: true, k: k, p: p }), 21600);
  } catch (e) {}
  return 'refreshed';
}

function kpiEnsureTrigger_() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('kpiTrigger') === '1') return;
  try {
    if (!ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'refreshKpis'))
      ScriptApp.newTrigger('refreshKpis').timeBased().everyMinutes(30).create();
    props.setProperty('kpiTrigger', '1');
  } catch (e) {}
}

function kpisCompute_() {
  const cache = CacheService.getScriptCache();
  const out = { ok: true, asOf: new Date(), units: {}, trend: {} };
  KPI_UNITS.forEach(u => out.units[u] = { unit: u });
  const errs = [];
  const tz = Session.getScriptTimeZone();
  const now = new Date(); const monthStart = kpiFmt_(new Date(now.getFullYear(), now.getMonth(), 1));

  // Production vs target - latest DPR date
  try {
    const s = kpiSrc_('PROD'); const dm = kpiMax_(s, 'C');
    let d = null;
    if (dm) {   // latest day that already has output (today's rows fill in during the shift)
      const r0 = gviz_(s, "select C, sum(AK) where E = 'Sew' and C >= date '" + kpiFmt_(new Date(dm.getTime() - 6 * 86400000)) + "' group by C order by C desc");
      (r0.rows || []).some(x => { if (kpiNum_(x[1]) > 0) { d = kpiDate_(x[0]); return true; } return false; });
      if (!d) d = dm;
    }
    if (d) {
      out.prodDate = kpiFmt_(d);
      const r = gviz_(s, "select D, sum(AK), sum(X) where C = date '" + out.prodDate + "' and E = 'Sew' and X > 0 group by D");
      (r.rows || []).forEach(x => { if (out.units[x[0]]) { out.units[x[0]].pro = kpiNum_(x[1]); out.units[x[0]].tgt = kpiNum_(x[2]); } });
    }
  } catch (e) { errs.push('production: ' + e.message); }

  // Efficiency - latest COT date + 10-day trend
  try {
    const s = kpiSrc_('EFF'); const d = kpiMax_(s, 'C');
    if (d) {
      out.effDate = kpiFmt_(d);
      const from = kpiFmt_(new Date(d.getTime() - 13 * 86400000));
      const r = gviz_(s, "select C, D, sum(R), sum(Q) where C >= date '" + from + "' group by C, D order by C");
      (r.rows || []).forEach(x => {
        const u = x[1]; if (!out.units[u]) return;
        const e = kpiNum_(x[3]) ? Math.round(kpiNum_(x[2]) / kpiNum_(x[3]) * 1000) / 10 : null;
        const dd = kpiDate_(x[0]); if (!dd || e === null) return;
        (out.trend[u] = out.trend[u] || []).push({ d: kpiFmt_(dd), eff: e });
        if (kpiFmt_(dd) === out.effDate) { out.units[u].eff = e; out.units[u].earn = kpiNum_(x[2]); out.units[u].avail = kpiNum_(x[3]); }
      });
      KPI_UNITS.forEach(u => { if (out.trend[u]) out.trend[u] = out.trend[u].slice(-10); });
    }
  } catch (e) { errs.push('efficiency: ' + e.message); }

  // Efficiency this month vs last month (month-on-month arrows)
  try {
    const s = kpiSrc_('EFF');
    const prevStart = kpiFmt_(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    const r = gviz_(s, "select D, sum(R), sum(Q) where C >= date '" + prevStart + "' and C < date '" + monthStart + "' group by D");
    (r.rows || []).forEach(x => { const u = out.units[x[0]]; if (u && kpiNum_(x[2])) u.effPrevMonth = Math.round(kpiNum_(x[1]) / kpiNum_(x[2]) * 1000) / 10; });
    const r2 = gviz_(s, "select D, sum(R), sum(Q) where C >= date '" + monthStart + "' group by D");
    (r2.rows || []).forEach(x => { const u = out.units[x[0]]; if (u && kpiNum_(x[2])) u.effMtd = Math.round(kpiNum_(x[1]) / kpiNum_(x[2]) * 1000) / 10; });
  } catch (e) { errs.push('efficiency month: ' + e.message); }

  // FTR month to date
  try {
    const r = gviz_(kpiSrc_('QUAL'), "select D, sum(AH), sum(AG) where C >= date '" + monthStart + "' group by D");
    (r.rows || []).forEach(x => { const u = out.units[x[0]]; if (u) { u.ftrPass = kpiNum_(x[1]); u.ftrChk = kpiNum_(x[2]); u.ftr = u.ftrChk ? Math.round(u.ftrPass / u.ftrChk * 1000) / 10 : null; } });
  } catch (e) { errs.push('ftr: ' + e.message); }

  // FSA pass % month to date
  try {
    const r = gviz_(kpiSrc_('FSA'), "select F, AN, count(E) where AW = 1 and D >= date '" + monthStart + "' group by F, AN");
    (r.rows || []).forEach(x => {
      const u = out.units[x[0]]; if (!u) return;
      const res = String(x[1]).toUpperCase().trim(), n = kpiNum_(x[2]);
      if (res === 'PASS') u.fsaPass = (u.fsaPass || 0) + n; else if (res === 'FAIL') u.fsaFail = (u.fsaFail || 0) + n;
    });
    KPI_UNITS.forEach(k => { const u = out.units[k]; const t = (u.fsaPass || 0) + (u.fsaFail || 0); u.fsa = t ? Math.round((u.fsaPass || 0) / t * 1000) / 10 : null; u.fsaN = t; });
  } catch (e) { errs.push('fsa: ' + e.message); }

  out.units = KPI_UNITS.map(u => out.units[u]);
  out.monthStart = monthStart; out.errors = errs;
  try { out.openIssues = listIssues_().open.length; } catch (e) { out.openIssues = null; }
  const js = JSON.stringify(out);
  cache.put('kpis_v1', js, 900);
  cache.put('kpis_stale', js, 21600);
  return out;
}

function appsStatus_() {
  const sh = ss_().getSheetByName('Apps');
  const n = sh.getLastRow() - 1;
  const rows = n > 0 ? sh.getRange(2, 1, n, 6).getValues() : [];
  const open = {};
  try { listIssues_().open.forEach(i => { open[i.target] = i; }); } catch (e) {}
  return {
    ok: true, time: new Date(),
    apps: rows.filter(r => r[0]).map(r => {
      const st = String(r[4] || '');
      const issue = open[r[0]];
      const state = String(r[3]).toUpperCase() === 'N' ? 'off' : issue ? 'down' : /^OK/.test(st) ? 'ok' : /restricted|login/i.test(st) ? 'restricted' : st ? 'down' : 'unknown';
      return { program: r[1], page: r[2], status: st || 'Not checked yet', state: state, checked: r[5], issue: issue ? issue.message : '' };
    })
  };
}
