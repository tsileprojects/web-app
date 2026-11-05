/**
 * ==============================================================
 *  TSPL ERROR MONITOR  (stand-alone Google Apps Script)
 * ==============================================================
 *  What it does
 *   1. Finds every Apps Script web app (/exec link) on your TSPL web
 *      site pages automatically (main_ho, unit_*, dept_* ...).
 *   2. Every hour opens each one (read-only GET) and records a
 *      problem when an app is down, removed or throws a script error.
 *   3. Optionally scans the Google Sheets you list in "Watch_Sheets"
 *      for formula errors (#REF!, #ERROR!, #NAME?, #VALUE!).
 *   4. Receives error reports sent by your other programs / dashboard.
 *   5. Serves the list to the bell icon on the HO dashboard.
 *
 *  SAFE BY DESIGN
 *   - It never writes to, edits or deletes anything in your programs
 *     or data sheets. The only file it writes is its own log
 *     spreadsheet "TSPL_Error_Monitor_Log" that setup() creates.
 *   - "Auto-correction" = safe actions only: retrying temporary
 *     failures and closing issues automatically once the program is
 *     healthy again. Code / formula fixes are flagged for you to
 *     approve; they are never changed automatically.
 *
 *  SETUP (one time, ~3 minutes)
 *   1. script.google.com > New project > paste this file > Save.
 *   2. Run  setup  once (Run button) and allow the permissions.
 *   3. Deploy > New deployment > Web app
 *        Execute as: Me      Who has access: Anyone
 *      Copy the /exec URL and paste it into js/notify.js
 *      (TSPL_MONITOR_URL) on the web site.
 * ==============================================================
 */

const MON = {
  SITE_BASE: 'https://tsileprojects.github.io/web-app/',
  SITE_PAGES: [
    'main_ho.html', 'home.html',
    'unit_ap2.html', 'unit_fipl.html', 'unit_mrh.html', 'unit_ts2.html', 'unit_ts4.html', 'unit_ts9.html',
    'dept_cmd.html', 'dept_cmp.html', 'dept_emb.html', 'dept_fsa.html', 'dept_gsd.html', 'dept_gsd_fc.html',
    'dept_ppd.html', 'dept_qty.html', 'dept_smp.html',
    'kpi_data.html', 'doclby_form.html', 'ndl_eform.html', 'ndl_form.html', 'ndl_form1.html'
  ],
  CHECK_EVERY_HOURS: 1,
  SHEET_ERRORS: ['#REF!', '#ERROR!', '#NAME?', '#VALUE!'],   // #N/A and #DIV/0! are often intentional, so skipped
  MAX_CELLS_PER_TAB: 300000,
  LOG_HEADERS: ['ID', 'Key', 'Status', 'Severity', 'Source', 'Program', 'Target', 'Message',
                'First Seen', 'Last Seen', 'Count', 'Resolved At', 'Resolved By', 'Note']
};

/* ---------------------------------------------------------------
 * SETUP
 * ------------------------------------------------------------- */
function setup() {
  const props = PropertiesService.getScriptProperties();
  let ss;
  const id = props.getProperty('LOG_SS_ID');
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) {
    ss = SpreadsheetApp.create('TSPL_Error_Monitor_Log');
    props.setProperty('LOG_SS_ID', ss.getId());
  }
  ensureTab_(ss, 'Log', MON.LOG_HEADERS);
  ensureTab_(ss, 'Apps', ['URL', 'Program', 'Page', 'Enabled (Y/N)', 'Last Status', 'Last Checked']);
  ensureTab_(ss, 'Watch_Sheets', ['Spreadsheet URL or ID', 'Tab name (blank = all tabs)', 'Enabled (Y/N)', 'Last Result', 'Last Checked']);
  const def = ss.getSheetByName('Sheet1'); if (def && ss.getSheets().length > 1) ss.deleteSheet(def);

  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === 'runChecks') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('runChecks').timeBased().everyHours(MON.CHECK_EVERY_HOURS).create();

  discoverApps_();
  runChecks();
  Logger.log('Log sheet: ' + ss.getUrl());
}

function ensureTab_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#e8f1fd');
    sh.setFrozenRows(1);
  }
  return sh;
}

function ss_() {
  return SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('LOG_SS_ID'));
}

/* ---------------------------------------------------------------
 * 1. DISCOVER every /exec program linked on the web site
 * ------------------------------------------------------------- */
function discoverApps_() {
  const sh = ss_().getSheetByName('Apps');
  const existing = {};
  if (sh.getLastRow() > 1) {
    sh.getRange(2, 1, sh.getLastRow() - 1, 4).getValues().forEach(r => { existing[r[0]] = r; });
  }
  const found = {};
  const reqs = MON.SITE_PAGES.map(p => ({ url: MON.SITE_BASE + p + '?nocache=' + Date.now(), muteHttpExceptions: true }));
  const resps = UrlFetchApp.fetchAll(reqs);
  resps.forEach((r, i) => {
    if (r.getResponseCode() !== 200) return;
    const html = r.getContentText();
    const re = /(?:data-embed|href|src)\s*=\s*["'](https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec)[^"']*["'][^>]*>([\s\S]{0,400}?)<\/a>/g;
    let m;
    while ((m = re.exec(html)) !== null) {
      const url = m[1];
      const label = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || 'Program';
      if (!found[url]) found[url] = { label: label, page: MON.SITE_PAGES[i] };
    }
    // plain links not inside <a> (e.g. iframe src / JS strings)
    const re2 = /https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec/g;
    let m2;
    while ((m2 = re2.exec(html)) !== null) {
      if (!found[m2[0]]) found[m2[0]] = { label: 'Program on ' + MON.SITE_PAGES[i], page: MON.SITE_PAGES[i] };
    }
  });
  const rows = Object.keys(found).map(u => {
    const old = existing[u];
    return [u, found[u].label, found[u].page, old ? old[3] : 'Y'];
  });
  // keep rows the user added by hand that are no longer on the site
  Object.keys(existing).forEach(u => { if (!found[u] && u) rows.push(existing[u].slice(0, 4)); });
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 4).clearContent();
  if (rows.length) sh.getRange(2, 1, rows.length, 4).setValues(rows);
  return rows.length;
}

/* ---------------------------------------------------------------
 * MAIN SCHEDULED JOB
 * ------------------------------------------------------------- */
function runChecks() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return 'busy';
  try {
    const day = new Date().getDay();
    // re-discover links once a day (first run after midnight) so new programs are picked up
    const props = PropertiesService.getScriptProperties();
    if (props.getProperty('LAST_DISCOVERY_DAY') !== String(day)) {
      try { discoverApps_(); props.setProperty('LAST_DISCOVERY_DAY', String(day)); } catch (e) {}
    }
    const a = checkApps_();
    const s = scanSheets_();
    return 'apps checked: ' + a + ', sheet tabs scanned: ' + s;
  } finally {
    lock.releaseLock();
  }
}

/* ---------------------------------------------------------------
 * 2. HEALTH-CHECK web apps (read-only GET)
 * ------------------------------------------------------------- */
function classify_(resp) {
  // returns {ok:boolean, transient:boolean, info:boolean, msg:string}
  if (!resp) return { ok: false, transient: true, msg: 'No response (network/timeout)' };
  const code = resp.getResponseCode();
  if (code === 302 || code === 301) {
    const loc = String((resp.getHeaders() || {})['Location'] || '');
    if (/accounts\.google\.com/.test(loc)) return { ok: true, info: true, msg: 'Requires Google login (access restricted) - OK' };
    return { ok: true, msg: 'OK (redirect)' };
  }
  if (code === 401 || code === 403) return { ok: true, info: true, msg: 'Access restricted to signed-in users - cannot be checked automatically' };
  if (code === 404) return { ok: false, msg: 'Program not found (404) - deployment removed or link changed' };
  if (code >= 500) return { ok: false, transient: true, msg: 'Google server error ' + code };
  if (code === 429) return { ok: false, transient: true, msg: 'Too many requests (quota) 429' };
  if (code >= 400) return { ok: false, msg: 'HTTP ' + code };
  const body = resp.getContentText().slice(0, 200000);
  let m;
  if (/Script function not found:\s*doGet/i.test(body)) return { ok: false, msg: 'Script function not found: doGet (web app code missing/renamed)' };
  if (/Sorry, unable to open the file at this time/i.test(body)) return { ok: false, msg: 'Google: "unable to open the file" - deployment or file problem' };
  if ((m = body.match(/((?:TypeError|ReferenceError|SyntaxError|RangeError|Exception|Error)\s*:\s*[^<\n]{3,240}?\(line\s*\d+[^)<]*\))/))) {
    return { ok: false, msg: decode_(m[1]) };
  }
  if ((m = body.match(/<title>\s*Error\s*<\/title>[\s\S]{0,2000}?<div[^>]*>([^<]{5,300})<\/div>/i))) {
    return { ok: false, msg: 'Script error: ' + decode_(m[1]) };
  }
  return { ok: true, msg: 'OK' };
}

function decode_(s) {
  return String(s).replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}

function fetchSafe_(urls) {
  const reqs = urls.map(u => ({ url: u, followRedirects: false, muteHttpExceptions: true }));
  try { return UrlFetchApp.fetchAll(reqs); }
  catch (e) {
    return urls.map(u => { try { return UrlFetchApp.fetch(u, { followRedirects: false, muteHttpExceptions: true }); } catch (x) { return null; } });
  }
}

function checkApps_() {
  const sh = ss_().getSheetByName('Apps');
  if (sh.getLastRow() < 2) return 0;
  const rng = sh.getRange(2, 1, sh.getLastRow() - 1, 6);
  const rows = rng.getValues();
  const idx = rows.map((r, i) => i).filter(i => rows[i][0] && String(rows[i][3]).toUpperCase() !== 'N');
  const now = new Date();
  for (let c = 0; c < idx.length; c += 15) {
    const chunk = idx.slice(c, c + 15);
    let results = fetchSafe_(chunk.map(i => rows[i][0])).map(classify_);
    // AUTO-CORRECTION #1: temporary failures are retried twice before raising an alert
    for (let attempt = 0; attempt < 2; attempt++) {
      const retry = chunk.map((i, k) => k).filter(k => !results[k].ok && results[k].transient);
      if (!retry.length) break;
      Utilities.sleep(4000);
      const again = fetchSafe_(retry.map(k => rows[chunk[k]][0])).map(classify_);
      retry.forEach((k, j) => { results[k] = again[j]; });
    }
    chunk.forEach((i, k) => {
      const r = results[k];
      rows[i][4] = r.msg; rows[i][5] = now;
      const key = 'APP|' + rows[i][0];
      if (r.ok) autoResolve_(key, 'Program is responding normally again');
      else upsertIssue_({ key: key, severity: r.transient ? 'Warning' : 'Error', source: 'Health check',
                          program: rows[i][1], target: rows[i][0], message: r.msg });
    });
  }
  rng.setValues(rows);
  return idx.length;
}

/* ---------------------------------------------------------------
 * 3. SCAN listed Google Sheets for formula errors (read-only)
 * ------------------------------------------------------------- */
function scanSheets_() {
  const sh = ss_().getSheetByName('Watch_Sheets');
  if (sh.getLastRow() < 2) return 0;
  const rng = sh.getRange(2, 1, sh.getLastRow() - 1, 5);
  const rows = rng.getValues();
  let scanned = 0;
  rows.forEach(r => {
    if (!r[0] || String(r[2]).toUpperCase() === 'N') return;
    const id = (String(r[0]).match(/[-\w]{25,}/) || [String(r[0])])[0];
    const wanted = String(r[1] || '').trim();
    const out = [];
    try {
      const book = SpreadsheetApp.openById(id);
      const tabs = wanted ? [book.getSheetByName(wanted)].filter(Boolean) : book.getSheets();
      if (wanted && !tabs.length) throw new Error('Tab "' + wanted + '" not found');
      tabs.forEach(t => {
        const nr = t.getLastRow(), nc = t.getLastColumn();
        const key = 'SHEET|' + id + '|' + t.getName();
        if (!nr || !nc) { autoResolve_(key, 'No errors now'); return; }
        if (nr * nc > MON.MAX_CELLS_PER_TAB) { out.push(t.getName() + ': too large, skipped'); return; }
        scanned++;
        const vals = t.getRange(1, 1, nr, nc).getDisplayValues();
        const hits = []; let total = 0; const kinds = {};
        for (let y = 0; y < nr; y++) for (let x = 0; x < nc; x++) {
          const v = vals[y][x];
          if (v && v.charAt(0) === '#' && MON.SHEET_ERRORS.indexOf(v) > -1) {
            total++; kinds[v] = (kinds[v] || 0) + 1;
            if (hits.length < 8) hits.push(colLetter_(x + 1) + (y + 1));
          }
        }
        if (total) {
          const kindTxt = Object.keys(kinds).map(k => k + ' x' + kinds[k]).join(', ');
          upsertIssue_({ key: key, severity: 'Error', source: 'Sheet scan', program: book.getName() + ' > ' + t.getName(),
                         target: book.getUrl() + '#gid=' + t.getSheetId(),
                         message: total + ' formula error cell(s): ' + kindTxt + '. First at ' + hits.join(', ') });
          out.push(t.getName() + ': ' + total + ' errors');
        } else autoResolve_(key, 'No formula errors now');
      });
      r[3] = out.length ? out.join(' | ') : 'OK';
    } catch (e) {
      r[3] = 'Cannot open: ' + e.message;
      upsertIssue_({ key: 'SHEET|' + id, severity: 'Warning', source: 'Sheet scan', program: String(r[0]), target: String(r[0]),
                     message: 'Cannot open sheet: ' + e.message });
    }
    r[4] = new Date();
  });
  rng.setValues(rows);
  return scanned;
}

function colLetter_(n) { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; }

/* ---------------------------------------------------------------
 * ISSUE LOG helpers (only writes to the monitor's own log sheet)
 * ------------------------------------------------------------- */
function logSheet_() { return ss_().getSheetByName('Log'); }

function readLog_() {
  const sh = logSheet_();
  const n = sh.getLastRow() - 1;
  return n > 0 ? sh.getRange(2, 1, n, MON.LOG_HEADERS.length).getValues() : [];
}

function upsertIssue_(o) {
  const sh = logSheet_();
  const rows = readLog_();
  const now = new Date();
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i][1] === o.key && rows[i][2] === 'Open') {
      sh.getRange(i + 2, 4).setValue(o.severity);
      sh.getRange(i + 2, 8).setValue(String(o.message).slice(0, 1000));
      sh.getRange(i + 2, 10, 1, 2).setValues([[now, (Number(rows[i][10]) || 1) + 1]]);
      return rows[i][0];
    }
  }
  const id = 'E' + Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyMMddHHmmss') + Math.floor(Math.random() * 90 + 10);
  sh.appendRow([id, o.key, 'Open', o.severity || 'Error', o.source || '', o.program || '', o.target || '',
                String(o.message || '').slice(0, 1000), now, now, 1, '', '', '']);
  return id;
}

// AUTO-CORRECTION #2: an open issue closes itself when the next check is healthy
function autoResolve_(key, note) {
  const sh = logSheet_();
  const rows = readLog_();
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][1] === key && rows[i][2] === 'Open') {
      sh.getRange(i + 2, 3).setValue('Auto-resolved');
      sh.getRange(i + 2, 12, 1, 3).setValues([[new Date(), 'Auto (monitor)', note]]);
    }
  }
}

function setStatus_(id, status, by, note) {
  const sh = logSheet_();
  const rows = readLog_();
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === id) {
      sh.getRange(i + 2, 3).setValue(status);
      sh.getRange(i + 2, 12, 1, 3).setValues([[new Date(), by || 'Dashboard', note || '']]);
      return true;
    }
  }
  return false;
}

/* ---------------------------------------------------------------
 * WEB API used by the bell icon (JSONP so it works from GitHub Pages)
 *   ?action=list            open issues + last 15 closed
 *   ?action=recheck&id=..   re-test that program/sheet now
 *   ?action=resolve&id=..   mark resolved (by you)
 *   ?action=runnow          run all checks now
 *   ?action=log&program=..&message=..   report an error
 *   ?action=ask&q=..&h=..   Ask TSPL question (see Ask.gs)
 * ------------------------------------------------------------- */
function doGet(e) {
  const p = (e && e.parameter) || {};
  let out;
  try {
    switch (p.action) {
      case 'list': out = listIssues_(); break;
      case 'resolve': out = { ok: setStatus_(p.id, 'Resolved', 'Dashboard user', p.note || '') }; break;
      case 'ignore': out = { ok: setStatus_(p.id, 'Ignored', 'Dashboard user', p.note || '') }; break;
      case 'recheck': out = recheck_(p.id); break;
      case 'runnow': out = { ok: true, result: runChecks() }; break;
      case 'log': out = { ok: true, id: logReport_(p) }; break;
      case 'ask': out = askTspl_(p.q, p.h); break;
      case 'kpis': out = kpis_(); break;
      case 'apps': out = appsStatus_(); break;
      default: out = { ok: true, service: 'TSPL Error Monitor', time: new Date() };
    }
  } catch (err) { out = { ok: false, error: String(err && err.message || err) }; }
  return respond_(out, p.callback);
}

// other Apps Script programs can POST JSON: {program, where, message, severity}
function doPost(e) {
  let body = {};
  try { body = JSON.parse(e.postData.contents || '{}'); } catch (x) { body = { message: e && e.postData && e.postData.contents }; }
  return respond_({ ok: true, id: logReport_(body) });
}

function respond_(obj, cb) {
  const json = JSON.stringify(obj);
  if (cb && /^[\w.$]+$/.test(cb)) {
    return ContentService.createTextOutput(cb + '(' + json + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function logReport_(p) {
  const program = String(p.program || 'Unknown program').slice(0, 150);
  const message = String(p.message || 'Unknown error').slice(0, 1000);
  const where = String(p.where || '').slice(0, 300);
  const key = 'RPT|' + program + '|' + message.slice(0, 120);
  // flood protection: the same error is counted, not duplicated
  const cache = CacheService.getScriptCache();
  const ck = Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, key));
  if (cache.get(ck)) return cache.get(ck);
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const id = upsertIssue_({ key: key, severity: p.severity || 'Error', source: p.source || 'Program report',
                              program: program, target: where, message: message });
    cache.put(ck, id, 120);
    return id;
  } finally { lock.releaseLock(); }
}

function listIssues_() {
  const rows = readLog_();
  const toObj = r => ({ id: r[0], status: r[2], severity: r[3], source: r[4], program: r[5], target: r[6],
                        message: r[7], first: r[8], last: r[9], count: r[10], resolvedAt: r[11], resolvedBy: r[12], note: r[13] });
  const open = rows.filter(r => r[2] === 'Open').map(toObj).reverse();
  const closed = rows.filter(r => r[2] !== 'Open').slice(-15).map(toObj).reverse();
  return { ok: true, open: open, closed: closed, time: new Date() };
}

function recheck_(id) {
  const rows = readLog_();
  const row = rows.filter(r => r[0] === id)[0];
  if (!row) return { ok: false, error: 'Issue not found' };
  const key = String(row[1]);
  if (key.indexOf('APP|') === 0) {
    const url = key.slice(4);
    const r = classify_(fetchSafe_([url])[0]);
    if (r.ok) { setStatus_(id, 'Auto-resolved', 'Re-check', 'Program responding normally'); return { ok: true, fixed: true, msg: r.msg }; }
    upsertIssue_({ key: key, severity: r.transient ? 'Warning' : 'Error', source: 'Health check', program: row[5], target: url, message: r.msg });
    return { ok: true, fixed: false, msg: r.msg };
  }
  if (key.indexOf('SHEET|') === 0) {
    scanSheets_();
    const now = readLog_().filter(r => r[0] === id)[0];
    return { ok: true, fixed: now && now[2] !== 'Open', msg: now && now[2] !== 'Open' ? 'No formula errors now' : String(now ? now[7] : '') };
  }
  return { ok: true, fixed: false, msg: 'This error was reported by a program. Fix the cause, then press Resolved.' };
}

/* ---------------------------------------------------------------
 * OPTIONAL helper to paste into your OTHER Apps Script programs.
 * It only REPORTS errors; your program behaves exactly as before.
 *
 *   const TSPL_MONITOR_URL = 'PASTE_MONITOR_EXEC_URL';
 *   function TSPL_report(err, where) {
 *     try {
 *       UrlFetchApp.fetch(TSPL_MONITOR_URL, { method: 'post', contentType: 'application/json',
 *         muteHttpExceptions: true,
 *         payload: JSON.stringify({ program: 'NAME OF THIS PROGRAM', where: where || '',
 *                                   message: String(err && err.stack || err) }) });
 *     } catch (e) {}
 *   }
 *   // usage inside any function:
 *   //   try { ...existing code... } catch (e) { TSPL_report(e, 'saveData'); throw e; }
 * ------------------------------------------------------------- */
