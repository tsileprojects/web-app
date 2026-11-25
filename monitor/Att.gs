/* ================= TSPL ATTENDANCE APP feed (att.html) =================
   Same data as the Telegram attendance bot ("TSPL Attendance Bot" sheet, botSS_()):
     Workers    - master list (bot columns A:K, plus L Department, M Designation)
     Attendance - workers' own Yes/No replies from Telegram (pre-intimation)
     Register   - HR's final attendance per day (P / A / L / HD), written by this app (created on first use)
   Reads: att_day, att_trend, att_report. Writes (att_mark, att_wsave) need the HR user's app key. */
const ATT_UNITS = ['FIPL', 'TS2', 'TS4', 'TS9', 'AP2'];
const ATT_USERS = {
  hohr: { unit: 'ALL', key: '558401bd815433e9dcefbd3d82eaf3ae7185b4611b4dde1367de948c267bed76' },
  hr_fipl: { unit: 'FIPL', key: '999dc1e54ee7f4c1610c67b11c5ff2aa82a1815ebffae2f899b0dfa470bca2c4' },
  hr_ts2: { unit: 'TS2', key: '1b72900cb8e1414c3c655fb25ad3e9f7d3000d4854da51f41de4af87fe53b413' },
  hr_ts4: { unit: 'TS4', key: '1a6a50eccb7919cfda6d613cf0f8f7b9b4b5fff58a526fb33bfbe8dad7b9633b' },
  hr_ts9: { unit: 'TS9', key: '1552ea57d9f2a8b77f36e9bc2b92731a448eafe671b13547e3b7798dbfdfd4bd' },
  hr_ap2: { unit: 'AP2', key: '47c4743c8020ea333f18f7483a73bfe59f1295556cbb07730fa48f6d941c8d24' }
};
const ATT_REG_HEAD = ['Date', 'Emp Code', 'Name', 'Unit', 'Line', 'Status', 'Reason', 'Marked by', 'Time'];
function attAuth_(p) {
  const u = ATT_USERS[String(p.user || '')];
  if (!u || String(p.key || '') !== u.key) throw new Error('Not allowed - please log in again with your HR login');
  return u;
}
function attD_(v) { return v instanceof Date ? Utilities.formatDate(v, BOT_TZ, 'yyyy-MM-dd') : String(v || '').slice(0, 10); }
function attReg_() {
  const ss = botSS_(); let sh = ss.getSheetByName('Register');
  if (!sh) { sh = ss.insertSheet('Register'); sh.getRange(1, 1, 1, ATT_REG_HEAD.length).setValues([ATT_REG_HEAD]).setFontWeight('bold'); sh.setFrozenRows(1); }
  return sh;
}
function attWorkers_() {
  const sh = botSheet_('Workers'), n = sh.getLastRow();
  if (n < 2) return [];
  if (sh.getRange(1, 12).getValue() === '') sh.getRange(1, 12, 1, 2).setValues([['Department', 'Designation']]);
  return sh.getRange(2, 1, n - 1, 13).getValues().map((r, i) => ({ row: i + 2, code: String(r[0]).trim(), name: String(r[1]).trim(), unit: String(r[2]).trim().toUpperCase(), line: String(r[3]).trim(), shift: String(r[4]).trim(),
    mobile: String(r[5]).trim(), tg: !!String(r[7]).trim(), status: String(r[8]).trim(), dept: String(r[11]).trim(), desig: String(r[12]).trim() })).filter(w => w.code);
}
function attRows_(name, cols) { const sh = name === 'Register' ? attReg_() : botSheet_(name), n = sh.getLastRow(); return n > 1 ? sh.getRange(2, 1, n - 1, cols).getValues() : []; }
function attInUnit_(unit, w) { return unit === 'ALL' || w.unit === unit; }

/* one day: every worker with Telegram reply + HR register status */
function attDay_(p) {
  const unit = String(p.unit || 'ALL').toUpperCase(), d = String(p.date || botToday_());
  const W = attWorkers_().filter(w => attInUnit_(unit, w) && !/^left/i.test(w.status));
  const rep = {}, reg = {};
  attRows_('Attendance', 10).forEach(r => { if (attD_(r[0]) === d) rep[String(r[1])] = { reply: String(r[5]), reason: String(r[6]), time: String(r[7] instanceof Date ? Utilities.formatDate(r[7], BOT_TZ, 'HH:mm') : r[7]) }; });
  attRows_('Register', 9).forEach(r => { if (attD_(r[0]) === d) reg[String(r[1])] = { st: String(r[5]), reason: String(r[6]), by: String(r[7]), time: String(r[8]) }; });
  let working = true; try { working = botWorkingDay_(d) || String(botSettings_()['Bot active']).toLowerCase() !== 'yes'; } catch (e) {}
  return { ok: true, unit: unit, date: d, working: working, units: ATT_UNITS,
    workers: W.map(w => ({ code: w.code, name: w.name, unit: w.unit, line: w.line, shift: w.shift, mobile: w.mobile, dept: w.dept, desig: w.desig, tg: w.tg,
      reply: rep[w.code] ? rep[w.code].reply : '', why: rep[w.code] ? rep[w.code].reason : '', rt: rep[w.code] ? rep[w.code].time : '',
      st: reg[w.code] ? reg[w.code].st : '', sr: reg[w.code] ? reg[w.code].reason : '', by: reg[w.code] ? reg[w.code].by : '' })) };
}

/* last N days per unit (register + replies) */
function attTrend_(p) {
  const days = Math.min(60, Number(p.days) || 14), unit = String(p.unit || 'ALL').toUpperCase();
  const c = CacheService.getScriptCache(), ck = 'attT_' + unit + '_' + days; if (String(p.fresh) !== '1') { const h = c.get(ck); if (h) return JSON.parse(h); }
  const list = []; for (let i = days - 1; i >= 0; i--) list.push(Utilities.formatDate(new Date(Date.now() - i * 864e5), BOT_TZ, 'yyyy-MM-dd'));
  const inR = {}; list.forEach(d => inR[d] = 1);
  const W = attWorkers_().filter(w => attInUnit_(unit, w) && !/^left/i.test(w.status)), uOf = {}; W.forEach(w => uOf[w.code] = w.unit);
  const head = {}; W.forEach(w => head[w.unit] = (head[w.unit] || 0) + 1);
  const T = {}; const k = (d, u) => (T[d + '|' + u] = T[d + '|' + u] || { P: 0, A: 0, L: 0, HD: 0, yes: 0, no: 0 });
  const lastReg = {}; attRows_('Register', 9).forEach(r => { const d = attD_(r[0]); if (inR[d] && uOf[String(r[1])]) lastReg[d + '|' + r[1]] = String(r[5]).toUpperCase(); });
  Object.keys(lastReg).forEach(x => { const [d, code] = x.split('|'), s = lastReg[x]; const o = k(d, uOf[code]); if (o[s] != null) o[s]++; });
  const lastRep = {}; attRows_('Attendance', 10).forEach(r => { const d = attD_(r[0]); if (inR[d] && uOf[String(r[1])]) lastRep[d + '|' + r[1]] = String(r[5]); });
  Object.keys(lastRep).forEach(x => { const [d, code] = x.split('|'); const o = k(d, uOf[code]); if (/^y/i.test(lastRep[x])) o.yes++; else if (/^n/i.test(lastRep[x])) o.no++; });
  const out = { ok: true, unit: unit, days: list, head: head, data: T };
  try { c.put(ck, JSON.stringify(out), 120); } catch (e) {}
  return out;
}

/* report: per worker counts between two dates */
function attReport_(p) {
  const unit = String(p.unit || 'ALL').toUpperCase(), from = String(p.from || botToday_()), to = String(p.to || botToday_());
  const W = attWorkers_().filter(w => attInUnit_(unit, w)), by = {}; W.forEach(w => by[w.code] = { code: w.code, name: w.name, unit: w.unit, line: w.line, dept: w.dept, status: w.status, P: 0, A: 0, L: 0, HD: 0, yes: 0, no: 0, days: {} });
  const reg = {}; attRows_('Register', 9).forEach(r => { const d = attD_(r[0]); if (d >= from && d <= to && by[String(r[1])]) reg[d + '|' + r[1]] = { s: String(r[5]).toUpperCase(), why: String(r[6]) }; });
  Object.keys(reg).forEach(x => { const code = x.split('|')[1], o = by[code], s = reg[x].s; if (o[s] != null) o[s]++; o.days[x.split('|')[0]] = s; });
  const rep = {}; attRows_('Attendance', 10).forEach(r => { const d = attD_(r[0]); if (d >= from && d <= to && by[String(r[1])]) rep[d + '|' + r[1]] = String(r[5]); });
  Object.keys(rep).forEach(x => { const o = by[x.split('|')[1]]; if (/^y/i.test(rep[x])) o.yes++; else if (/^n/i.test(rep[x])) o.no++; });
  return { ok: true, unit: unit, from: from, to: to, rows: Object.keys(by).map(k => by[k]) };
}

/* HR marks attendance: d = JSON [[code, status, reason], ...] (sent in small parts) */
function attMark_(p) {
  const u = attAuth_(p), d = String(p.date || ''), rows = JSON.parse(p.d || '[]');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error('Bad date');
  const W = {}; attWorkers_().forEach(w => W[w.code] = w);
  const now = Utilities.formatDate(new Date(), BOT_TZ, 'dd-MMM HH:mm'), out = [];
  rows.forEach(r => { const w = W[String(r[0])]; if (!w || (u.unit !== 'ALL' && w.unit !== u.unit)) return; const s = String(r[1]).toUpperCase(); if (['P', 'A', 'L', 'HD'].indexOf(s) < 0) return;
    out.push([d, w.code, w.name, w.unit, w.line, s, String(r[2] || '').slice(0, 120), String(p.user), now]); });
  if (out.length) { const lock = LockService.getScriptLock(); lock.waitLock(20000); try { const sh = attReg_(); sh.getRange(sh.getLastRow() + 1, 1, out.length, ATT_REG_HEAD.length).setValues(out); } finally { lock.releaseLock(); } }
  CacheService.getScriptCache().removeAll(['attT_ALL_14', 'attT_' + u.unit + '_14']);
  return { ok: true, saved: out.length };
}

/* add / edit / import workers: d = JSON [[code, name, unit, line, shift, mobile, dept, desig, status], ...] */
function attWsave_(p) {
  const u = attAuth_(p), rows = JSON.parse(p.d || '[]');
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const sh = botSheet_('Workers'), W = attWorkers_(), idx = {}; W.forEach(w => idx[w.code] = w);
    let add = 0, upd = 0; const app = [];
    rows.forEach(r => {
      const code = String(r[0] || '').trim(), unit = String(r[2] || '').trim().toUpperCase(); if (!code || !String(r[1] || '').trim()) return;
      if (u.unit !== 'ALL' && unit !== u.unit) return;
      const ex = idx[code];
      if (ex) { if (u.unit !== 'ALL' && ex.unit !== u.unit) return;
        sh.getRange(ex.row, 1, 1, 6).setValues([[code, r[1], unit, r[3] || '', r[4] || '', r[5] || '']]);
        sh.getRange(ex.row, 12, 1, 2).setValues([[r[6] || '', r[7] || '']]);
        if (/^left/i.test(r[8] || '')) sh.getRange(ex.row, 9).setValue('Left');
        else if (r[8] && /^left/i.test(ex.status)) sh.getRange(ex.row, 9).setValue(ex.tg ? 'Active' : '');
        upd++; }
      else { app.push([code, r[1], unit, r[3] || '', r[4] || '', r[5] || '', 'en', '', /^left/i.test(r[8] || '') ? 'Left' : '', new Date(), '', r[6] || '', r[7] || '']); idx[code] = { code: code, unit: unit }; add++; }
    });
    if (app.length) sh.getRange(sh.getLastRow() + 1, 1, app.length, 13).setValues(app);
    try { botDrop_(); } catch (e) {}
    return { ok: true, added: add, updated: upd };
  } finally { lock.releaseLock(); }
}
