/**
 * ==============================================================
 *  DAILY MD REPORT  (part of TSPL Error Monitor)
 * --------------------------------------------------------------
 *  Emails a one-page summary every morning: output vs target for
 *  the last complete day, efficiency (with day and month change),
 *  quality month-to-date, and open program issues.
 *
 *  Who gets it: the "Report Recipients" tab in the monitor sheet
 *    (column A = email, column B = Y/N). Created on first run with
 *    only the owner's email, so nothing goes out to others until
 *    you add them.
 *  When: run installReportTrigger() once -> every day ~9 AM IST.
 *  Test: run sendDailyReport() -> sends now.
 * ==============================================================
 */
const REPORT_TAB = 'Report Recipients';
const REPORT_OWNER = 'eprojectstsil@gmail.com';
const REPORT_SITE = 'https://tsileprojects.github.io/web-app/';

function reportRecipients_() {
  const ss = ss_();
  let sh = ss.getSheetByName(REPORT_TAB);
  if (!sh) {
    sh = ss.insertSheet(REPORT_TAB);
    sh.getRange(1, 1, 1, 3).setValues([['Email', 'Send (Y/N)', 'Name / role']]).setFontWeight('bold');
    sh.getRange(2, 1, 1, 3).setValues([[REPORT_OWNER, 'Y', 'Owner (test)']]);
    sh.setFrozenRows(1); sh.setColumnWidth(1, 260); sh.setColumnWidth(3, 200);
  }
  if (sh.getLastRow() < 2) sh.appendRow([REPORT_OWNER, 'Y', 'Owner (test)']);
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh.getRange(2, 1, n, 2).getValues()
    .filter(r => String(r[1]).trim().toUpperCase() !== 'N')
    .map(r => String(r[0]).replace(/[\s'"<>,;]/g, ''))
    .filter(e => /^[^@]+@[^@]+\.[a-z]{2,}$/i.test(e));
}

/** Output vs target for the last COMPLETE day (before today). */
function reportProduction_() {
  const s = kpiSrc_('PROD');
  const today = kpiFmt_(new Date());
  const from = kpiFmt_(new Date(Date.now() - 8 * 86400000));
  const r0 = gviz_(s, "select C, sum(AK) where E = 'Sew' and C >= date '" + from + "' and C < date '" + today + "' group by C order by C desc");
  let d = null;
  (r0.rows || []).some(x => { if (kpiNum_(x[1]) > 0) { d = kpiFmt_(kpiDate_(x[0])); return true; } return false; });
  const out = { date: d, units: {} };
  if (!d) return out;
  const r = gviz_(s, "select D, sum(AK), sum(X) where C = date '" + d + "' and E = 'Sew' and X > 0 group by D");
  (r.rows || []).forEach(x => { out.units[x[0]] = { pro: kpiNum_(x[1]), tgt: kpiNum_(x[2]) }; });
  return out;
}

function sendDailyReport() {
  const to = reportRecipients_();
  if (!to.length) { Logger.log('No recipients in "' + REPORT_TAB + '".'); return 'no recipients'; }
  const k = kpis_();
  const p = reportProduction_();
  const html = reportHtml_(k, p);
  const dd = p.date || k.effDate || kpiFmt_(new Date());
  const subject = 'TSPL Daily Report - ' + reportDmy_(dd);
  MailApp.sendEmail({ to: to.join(','), subject: subject, htmlBody: html, name: 'TSPL Smart Tool' });
  Logger.log('Sent "' + subject + '" to ' + to.join(', '));
  return 'sent to ' + to.length;
}

/** Run once: daily send around 9 AM India time. Safe to re-run (no duplicates). */
function installReportTrigger() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'sendDailyReport').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('sendDailyReport').timeBased().everyDays(1).atHour(9).nearMinute(0).inTimezone('Asia/Kolkata').create();
  reportRecipients_();   // make sure the recipients tab exists
  return 'Daily report scheduled for ~9 AM IST';
}

function removeReportTrigger() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'sendDailyReport').forEach(t => ScriptApp.deleteTrigger(t));
  return 'Daily report stopped';
}

// ---------- formatting ----------
function reportDmy_(s) {
  if (!s) return '';
  const p = String(s).split('-');
  return ('0' + p[2]).slice(-2) + '-' + ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+p[1] - 1] + '-' + p[0].slice(2);
}
function reportN_(v) { return v == null ? '-' : Math.round(v).toLocaleString('en-IN'); }
function reportP_(v) { return v == null ? '-' : (Math.round(v * 10) / 10).toFixed(1) + '%'; }
function reportColor_(v, good, warn) { return v == null ? '#64748b' : v >= good ? '#15803d' : v >= warn ? '#b45309' : '#b91c1c'; }
function reportDelta_(now, prev) {
  if (now == null || prev == null) return '<span style="color:#94a3b8">-</span>';
  const d = Math.round((now - prev) * 10) / 10;
  return '<span style="color:' + (d >= 0 ? '#15803d' : '#b91c1c') + '">' + (d >= 0 ? '&#9650; ' : '&#9660; ') + Math.abs(d).toFixed(1) + '</span>';
}

function reportHtml_(k, p) {
  const units = k.units || [];
  const th = 'style="padding:8px 10px;text-align:right;font-size:12px;color:#475569;border-bottom:2px solid #cbd5e1;background:#f1f5f9"';
  const thl = th.replace('right', 'left');
  const td = 'style="padding:8px 10px;text-align:right;border-bottom:1px solid #e2e8f0;font-size:13px"';
  const tdl = td.replace('right', 'left');
  let tp = 0, tt = 0;
  const prodRows = units.map(u => {
    const x = p.units[u.unit] || {};
    tp += x.pro || 0; tt += x.tgt || 0;
    const ach = x.tgt ? x.pro / x.tgt * 100 : null;
    return '<tr><td ' + tdl + '><b>' + u.unit + '</b></td><td ' + td + '>' + reportN_(x.pro) + '</td><td ' + td + '>' + reportN_(x.tgt) +
      '</td><td ' + td + '><b style="color:' + reportColor_(ach, 98, 90) + '">' + reportP_(ach) + '</b></td><td ' + td + '>' + (x.tgt ? reportN_(x.pro - x.tgt) : '-') + '</td></tr>';
  }).join('');
  const totAch = tt ? tp / tt * 100 : null;
  const prodTot = '<tr style="background:#f8fafc"><td ' + tdl + '><b>TSPL</b></td><td ' + td + '><b>' + reportN_(tp) + '</b></td><td ' + td + '><b>' + reportN_(tt) +
    '</b></td><td ' + td + '><b style="color:' + reportColor_(totAch, 98, 90) + '">' + reportP_(totAch) + '</b></td><td ' + td + '><b>' + reportN_(tp - tt) + '</b></td></tr>';

  const effRows = units.map(u => {
    const t = (k.trend || {})[u.unit] || [], prev = t.length > 1 ? t[t.length - 2].eff : null;
    return '<tr><td ' + tdl + '><b>' + u.unit + '</b></td><td ' + td + '><b style="color:' + reportColor_(u.eff, 55, 45) + '">' + reportP_(u.eff) + '</b></td><td ' + td + '>' + reportDelta_(u.eff, prev) +
      '</td><td ' + td + '>' + reportP_(u.effMtd) + '</td><td ' + td + '>' + reportP_(u.effPrevMonth) + '</td><td ' + td + '>' + reportDelta_(u.effMtd, u.effPrevMonth) + '</td></tr>';
  }).join('');

  const qRows = units.map(u =>
    '<tr><td ' + tdl + '><b>' + u.unit + '</b></td><td ' + td + '>' + (u.ftr == null ? '<span style="color:#94a3b8">No DQR data</span>' : '<b style="color:' + reportColor_(u.ftr, 95, 90) + '">' + reportP_(u.ftr) + '</b>') +
    '</td><td ' + td + '>' + (u.fsa == null ? '<span style="color:#94a3b8">No audits</span>' : '<b style="color:' + reportColor_(u.fsa, 85, 70) + '">' + reportP_(u.fsa) + '</b>') +
    '</td><td ' + td + '>' + (u.fsaN ? (u.fsaPass || 0) + ' / ' + (u.fsaFail || 0) : '-') + '</td></tr>').join('');

  const watch = [];
  units.forEach(u => {
    const x = p.units[u.unit] || {}, ach = x.tgt ? x.pro / x.tgt * 100 : null;
    if (ach != null && ach < 90) watch.push(u.unit + ' output at ' + reportP_(ach) + ' of target (' + reportN_(x.tgt - x.pro) + ' pcs short).');
    if (u.eff != null && u.eff < 45) watch.push(u.unit + ' efficiency ' + reportP_(u.eff) + ' on ' + reportDmy_(k.effDate) + '.');
    if (u.effMtd != null && u.effPrevMonth != null && u.effMtd - u.effPrevMonth <= -5) watch.push(u.unit + ' efficiency this month ' + reportP_(u.effMtd) + ' vs ' + reportP_(u.effPrevMonth) + ' last month.');
    if (u.fsa != null && u.fsa < 70) watch.push(u.unit + ' FSA pass rate ' + reportP_(u.fsa) + ' this month.');
  });
  if (k.openIssues) watch.push(k.openIssues + ' program issue(s) open - see the bell on the HO dashboard.');

  const h2 = 'style="font-size:15px;color:#0f172a;margin:22px 0 8px"';
  const tbl = 'style="border-collapse:collapse;width:100%;max-width:640px"';
  return '<div style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;max-width:680px">' +
    '<div style="background:#0b1630;color:#fff;padding:16px 20px;border-radius:8px"><div style="font-size:20px;font-weight:bold">TSPL Daily Report</div>' +
    '<div style="font-size:13px;color:#a9bddc;margin-top:4px">Output for ' + reportDmy_(p.date) + ' &middot; efficiency for ' + reportDmy_(k.effDate) + ' &middot; quality month to date</div></div>' +
    (watch.length ? '<div style="margin-top:16px;padding:12px 16px;background:#fef2f2;border-left:4px solid #dc2626;border-radius:6px;font-size:13px"><b>Needs attention</b><ul style="margin:6px 0 0;padding-left:18px">' +
      watch.map(w => '<li style="margin:3px 0">' + w + '</li>').join('') + '</ul></div>'
      : '<div style="margin-top:16px;padding:12px 16px;background:#f0fdf4;border-left:4px solid #16a34a;border-radius:6px;font-size:13px"><b>All units on track.</b></div>') +
    '<h2 ' + h2 + '>Output vs target &middot; ' + reportDmy_(p.date) + '</h2><table ' + tbl + '><tr><th ' + thl + '>Unit</th><th ' + th + '>Output</th><th ' + th + '>Target</th><th ' + th + '>Achieved</th><th ' + th + '>+/- pcs</th></tr>' + prodRows + prodTot + '</table>' +
    '<h2 ' + h2 + '>Efficiency &middot; ' + reportDmy_(k.effDate) + '</h2><table ' + tbl + '><tr><th ' + thl + '>Unit</th><th ' + th + '>Day</th><th ' + th + '>vs day before</th><th ' + th + '>This month</th><th ' + th + '>Last month</th><th ' + th + '>Change</th></tr>' + effRows + '</table>' +
    '<h2 ' + h2 + '>Quality &middot; month to date</h2><table ' + tbl + '><tr><th ' + thl + '>Unit</th><th ' + th + '>End-line FTR</th><th ' + th + '>FSA pass %</th><th ' + th + '>FSA pass / fail</th></tr>' + qRows + '</table>' +
    '<p style="font-size:12px;color:#64748b;margin-top:22px">Efficiency = earned minutes / available minutes (COT). FTR = first-time-right pieces / checked pieces (DQR). FSA pass % = passed / (passed + failed) final audits.<br>' +
    'Live board: <a href="' + REPORT_SITE + 'tv.html">TV display</a> &middot; <a href="' + REPORT_SITE + 'main_ho.html">HO dashboard</a>. To change who receives this, edit the "' + REPORT_TAB + '" tab in the monitor sheet.</p></div>';
}
