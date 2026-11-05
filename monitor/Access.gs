/**
 * ==============================================================
 *  ACCESS: email-code sign-in, approvals, activity log, phone entries
 *  (part of TSPL Error Monitor)
 *
 *  Tabs it creates in the monitor log sheet (first use):
 *   Users           Email | Name | Role (Admin/Approver/User) | Unit | Active (Y/N)
 *   Approval Rules  Type | Step | Approver emails (comma) | Step name
 *   Requests        one row per request, with status and history
 *   Activity        who did what, when
 *   Needle Entries  needle issue / breakage entered from the phone app
 *
 *  Sign-in: user types their email -> a 6-digit code is emailed ->
 *  they type it -> they get a sign-in key valid for 30 days on that
 *  device. Only emails listed (Active = Y) in "Users" can sign in.
 * ==============================================================
 */
const AX = {
  USERS: 'Users', RULES: 'Approval Rules', REQ: 'Requests', ACT: 'Activity', NDL: 'Needle Entries',
  TYPES: ['Needle request', 'Indent / purchase', 'Data correction', 'Daily sign-off'],
  SESSION_DAYS: 30
};

// ---------- sheets ----------
function axSheet_(name, headers, widths) {
  const ss = ss_();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
    (widths || []).forEach((w, i) => { if (w) sh.setColumnWidth(i + 1, w); });
    if (name === AX.USERS) sh.appendRow([REPORT_OWNER, 'Projects Admin', 'Admin', 'HO', 'Y']);
    if (name === AX.RULES) AX.TYPES.forEach(t => sh.appendRow([t, 1, REPORT_OWNER, 'HO approval']));
  }
  return sh;
}
function axUsersSheet_() { return axSheet_(AX.USERS, ['Email', 'Name', 'Role (Admin/Approver/User)', 'Unit', 'Active (Y/N)'], [260, 180, 170, 80, 90]); }
function axRulesSheet_() { return axSheet_(AX.RULES, ['Type', 'Step', 'Approver emails (comma separated)', 'Step name'], [170, 60, 380, 160]); }
function axReqSheet_() { return axSheet_(AX.REQ, ['ID', 'Created', 'Type', 'Unit', 'Title', 'Details', 'Qty', 'Needed by', 'Raised by', 'Raised by name', 'Status', 'Step', 'History', 'Updated'], [110, 140, 130, 60, 220, 320, 60, 100, 220, 140, 110, 50, 420, 140]); }
function axActSheet_() { return axSheet_(AX.ACT, ['Time', 'Who', 'Login', 'Action', 'Detail', 'Page'], [140, 220, 100, 120, 420, 140]); }
function axNdlSheet_() { return axSheet_(AX.NDL, ['ID', 'Entered', 'Date', 'Unit', 'Line', 'Kind', 'Needle type', 'Qty', 'Reason / remark', 'By', 'Device time'], [110, 140, 90, 60, 50, 90, 160, 50, 260, 200, 140]); }

function axClean_(s, max) { return String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').trim().replace(/^[=+\-@]+/, '').slice(0, max || 200); }
function axEmail_(s) { return String(s || '').trim().toLowerCase(); }
function axHash_(s) { return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)); }
function axNow_() { return new Date(); }
function axFmt_(d) { return Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd-MMM-yy HH:mm'); }

function axUsers_() {
  const sh = axUsersSheet_(), n = sh.getLastRow() - 1;
  if (n < 1) return {};
  const out = {};
  sh.getRange(2, 1, n, 5).getValues().forEach(r => {
    const e = axEmail_(r[0]); if (!/@/.test(e)) return;
    if (String(r[4]).trim().toUpperCase() === 'N') return;
    out[e] = { email: e, name: String(r[1] || e.split('@')[0]).trim(), role: (String(r[2] || 'User').trim() || 'User'), unit: String(r[3] || '').trim().toUpperCase() };
  });
  return out;
}

function axLog_(who, login, action, detail, page) {
  try { axActSheet_().appendRow([axNow_(), who || '', login || '', action, "'" + axClean_(detail, 400), axClean_(page, 60)]); } catch (e) {}
}

/** Offline phone entries are re-sent until confirmed; the device id stops duplicates. */
function axSeen_(cid) {
  cid = axClean_(cid, 40); if (!cid) return false;
  const c = CacheService.getScriptCache();
  if (c.get('cid_' + cid)) return true;
  c.put('cid_' + cid, '1', 21600); return false;
}

// ---------- sign-in ----------
function axStart_(p) {
  const email = axEmail_(p.email);
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(email)) return { ok: false, error: 'Enter a valid email' };
  const u = axUsers_()[email];
  if (!u) return { ok: false, error: 'This email is not registered. Ask HO (Projects) to add you to the Users list.' };
  const cache = CacheService.getScriptCache();
  if (cache.get('otp_wait_' + email)) return { ok: false, error: 'A code was just sent. Please wait one minute before asking again.' };
  const code = String(Math.floor(100000 + Math.random() * 900000));
  cache.put('otp_' + email, JSON.stringify({ h: axHash_(email + ':' + code), tries: 0 }), 600);
  cache.put('otp_wait_' + email, '1', 60);
  MailApp.sendEmail({ to: email, name: 'TSPL Smart Tool', subject: 'TSPL sign-in code: ' + code,
    htmlBody: '<div style="font-family:Arial,sans-serif;font-size:14px">Your TSPL sign-in code is<div style="font-size:28px;font-weight:bold;letter-spacing:4px;margin:10px 0">' + code + '</div>It works for 10 minutes. If you did not ask for this, ignore this email.</div>' });
  axLog_(email, p.login, 'sign-in code', 'code emailed', p.page);
  return { ok: true, name: u.name };
}

function axVerify_(p) {
  const email = axEmail_(p.email), code = String(p.code || '').replace(/\D/g, '');
  const cache = CacheService.getScriptCache();
  const raw = cache.get('otp_' + email);
  if (!raw) return { ok: false, error: 'Code expired. Ask for a new code.' };
  const o = JSON.parse(raw);
  if (o.tries >= 5) { cache.remove('otp_' + email); return { ok: false, error: 'Too many wrong tries. Ask for a new code.' }; }
  if (axHash_(email + ':' + code) !== o.h) { o.tries++; cache.put('otp_' + email, JSON.stringify(o), 600); return { ok: false, error: 'Wrong code. Please check the email and try again.' }; }
  cache.remove('otp_' + email);
  const u = axUsers_()[email];
  if (!u) return { ok: false, error: 'This email is not registered.' };
  const token = Utilities.getUuid() + Utilities.getUuid().replace(/-/g, '');
  const exp = Date.now() + AX.SESSION_DAYS * 86400000;
  PropertiesService.getScriptProperties().setProperty('ses_' + axHash_(token).slice(0, 40), JSON.stringify({ e: email, x: exp }));
  axCleanSessions_();
  axLog_(email, p.login, 'signed in', u.name + ' (' + u.role + ')', p.page);
  return { ok: true, token: token, user: u, expires: exp };
}

function axCleanSessions_() {
  try {
    const props = PropertiesService.getScriptProperties(), all = props.getProperties(), now = Date.now();
    Object.keys(all).forEach(k => { if (k.indexOf('ses_') === 0) { try { if (JSON.parse(all[k]).x < now) props.deleteProperty(k); } catch (e) { props.deleteProperty(k); } } });
  } catch (e) {}
}

/** Returns the signed-in user for a token, or null. */
function axUser_(token) {
  if (!token || String(token).length < 40) return null;
  const raw = PropertiesService.getScriptProperties().getProperty('ses_' + axHash_(String(token)).slice(0, 40));
  if (!raw) return null;
  const s = JSON.parse(raw);
  if (s.x < Date.now()) return null;
  const u = axUsers_()[s.e];   // removed / deactivated users lose access at once
  return u || null;
}

function axSignOut_(p) {
  if (p.token) PropertiesService.getScriptProperties().deleteProperty('ses_' + axHash_(String(p.token)).slice(0, 40));
  return { ok: true };
}

function axMe_(p) { const u = axUser_(p.token); return u ? { ok: true, user: u, types: AX.TYPES } : { ok: false, error: 'signin' }; }

// ---------- approvals ----------
function axRules_() {
  const sh = axRulesSheet_(), n = sh.getLastRow() - 1, out = {};
  if (n < 1) return out;
  sh.getRange(2, 1, n, 4).getValues().forEach(r => {
    const t = String(r[0]).trim(); if (!t) return;
    (out[t] = out[t] || []).push({ step: Number(r[1]) || 1, approvers: String(r[2]).split(/[,;\s]+/).map(axEmail_).filter(e => /@/.test(e)), name: String(r[3] || '') });
  });
  Object.keys(out).forEach(t => out[t].sort((a, b) => a.step - b.step));
  return out;
}

function axReqRows_() {
  const sh = axReqSheet_(), n = sh.getLastRow() - 1;
  if (n < 1) return { sh: sh, rows: [] };
  return { sh: sh, rows: sh.getRange(2, 1, n, 14).getValues().map((r, i) => ({ row: i + 2, id: String(r[0]), created: r[1], type: String(r[2]), unit: String(r[3]),
    title: String(r[4]), details: String(r[5]), qty: r[6], needBy: r[7] instanceof Date ? kpiFmt_(r[7]) : String(r[7]), by: String(r[8]), byName: String(r[9]),
    status: String(r[10]), step: Number(r[11]) || 1, history: (function () { try { return JSON.parse(r[12] || '[]'); } catch (e) { return []; } })(), updated: r[13] })) };
}

function axCanApprove_(u, req, rules) {
  if (req.status !== 'Pending') return false;
  const st = (rules[req.type] || []).filter(s => s.step === req.step)[0];
  if (st) return st.approvers.indexOf(u.email) > -1;
  return u.role === 'Admin';   // no rule -> admins approve
}

function axNotify_(to, subject, html) {
  to = (to || []).filter(e => /@/.test(e));
  if (!to.length) return;
  try { MailApp.sendEmail({ to: to.join(','), subject: subject, htmlBody: '<div style="font-family:Arial,sans-serif;font-size:14px">' + html +
    '<p><a href="' + REPORT_SITE + 'requests.html">Open TSPL Requests</a></p></div>', name: 'TSPL Smart Tool' }); } catch (e) {}
}

function axReqNew_(p) {
  const u = axUser_(p.token); if (!u) return { ok: false, error: 'signin' };
  const type = AX.TYPES.indexOf(p.type) > -1 ? p.type : null;
  if (!type) return { ok: false, error: 'Pick a request type' };
  const title = axClean_(p.title, 120), details = axClean_(p.details, 1000);
  if (title.length < 3) return { ok: false, error: 'Write a short title' };
  const unit = axClean_(p.unit, 10).toUpperCase() || u.unit;
  const qty = p.qty === '' || p.qty == null ? '' : Number(p.qty) || '';
  const needBy = /^\d{4}-\d{2}-\d{2}$/.test(String(p.needBy || '')) ? p.needBy : '';
  if (axSeen_(p.cid)) return { ok: true, duplicate: true };
  const rules = axRules_();
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  let id;
  try {
    const sh = axReqSheet_();
    id = 'R' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyMMddHHmmss');
    const hist = [{ t: axFmt_(axNow_()), who: u.name, a: 'Raised' }];
    sh.appendRow([id, axNow_(), type, unit, "'" + title, "'" + details, qty, needBy ? "'" + needBy : '', u.email, u.name, 'Pending', 1, JSON.stringify(hist), axNow_()]);
  } finally { lock.releaseLock(); }
  const st = (rules[type] || [])[0];
  axNotify_(st ? st.approvers : [], 'TSPL request for approval: ' + type + ' - ' + unit,
    '<b>' + u.name + '</b> raised a <b>' + type + '</b> request for <b>' + unit + '</b>:<p><b>' + title + '</b><br>' + details.replace(/\n/g, '<br>') + (qty ? '<br>Qty: ' + qty : '') + (needBy ? '<br>Needed by: ' + needBy : '') + '</p>');
  axLog_(u.email, p.login, 'request raised', id + ' ' + type + ' ' + unit + ': ' + title, p.page);
  return { ok: true, id: id };
}

function axReqList_(p) {
  const u = axUser_(p.token); if (!u) return { ok: false, error: 'signin' };
  const rules = axRules_(), all = axReqRows_().rows;
  const view = all.map(r => {
    const steps = rules[r.type] || [];
    const st = steps.filter(s => s.step === r.step)[0];
    return { id: r.id, created: r.created, type: r.type, unit: r.unit, title: r.title, details: r.details, qty: r.qty, needBy: r.needBy, byName: r.byName, by: r.by,
      status: r.status, step: r.step, steps: steps.length || 1, stepName: st ? st.name : '', history: r.history, updated: r.updated,
      canApprove: axCanApprove_(u, r, rules), mine: r.by === u.email };
  }).reverse();
  const seeAll = u.role === 'Admin' || u.role === 'Approver';
  return { ok: true, user: u, types: AX.TYPES, requests: view.filter(r => seeAll || r.mine || r.canApprove).slice(0, 400) };
}

function axReqAct_(p) {
  const u = axUser_(p.token); if (!u) return { ok: false, error: 'signin' };
  const decision = p.decision === 'approve' ? 'approve' : p.decision === 'reject' ? 'reject' : p.decision === 'cancel' ? 'cancel' : null;
  if (!decision) return { ok: false, error: 'Bad decision' };
  const comment = axClean_(p.comment, 400);
  if (decision === 'reject' && comment.length < 3) return { ok: false, error: 'Please write the reason for rejecting' };
  const rules = axRules_();
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  let r, newStatus, next = null;
  try {
    const d = axReqRows_(); r = d.rows.filter(x => x.id === String(p.id))[0];
    if (!r) return { ok: false, error: 'Request not found' };
    if (decision === 'cancel') {
      if (r.by !== u.email || r.status !== 'Pending') return { ok: false, error: 'Only the person who raised a pending request can cancel it' };
      newStatus = 'Cancelled';
    } else {
      if (!axCanApprove_(u, r, rules)) return { ok: false, error: 'You are not the approver for this step' };
      const steps = rules[r.type] || [];
      if (decision === 'reject') newStatus = 'Rejected';
      else { next = steps.filter(s => s.step > r.step)[0]; newStatus = next ? 'Pending' : 'Approved'; }
    }
    r.history.push({ t: axFmt_(axNow_()), who: u.name, a: decision === 'approve' ? 'Approved' + (rules[r.type] && rules[r.type].length > 1 ? ' (step ' + r.step + ')' : '') : decision === 'reject' ? 'Rejected' : 'Cancelled', c: comment });
    d.sh.getRange(r.row, 11, 1, 4).setValues([[newStatus, next ? next.step : r.step, JSON.stringify(r.history), axNow_()]]);
  } finally { lock.releaseLock(); }
  if (next) axNotify_(next.approvers, 'TSPL request for approval: ' + r.type + ' - ' + r.unit, '<b>' + r.byName + '</b>\'s request was approved at step ' + r.step + ' by ' + u.name + ' and now needs your approval:<p><b>' + r.title + '</b><br>' + r.details + '</p>');
  if (decision !== 'cancel') axNotify_([r.by], 'TSPL request ' + newStatus.toLowerCase() + ': ' + r.title,
    'Your <b>' + r.type + '</b> request <b>' + r.title + '</b> is now <b>' + (next ? 'approved at step ' + r.step + ', waiting for the next approver' : newStatus) + '</b> (by ' + u.name + ')' + (comment ? '<p>Comment: ' + comment + '</p>' : ''));
  axLog_(u.email, p.login, 'request ' + decision, r.id + ' ' + r.type + ' ' + r.unit + ': ' + r.title + (comment ? ' - ' + comment : ''), p.page);
  return { ok: true, status: newStatus };
}

// ---------- activity ----------
function axHit_(p) {
  try { const sh = axActSheet_(); if (sh.getLastRow() > 60000) sh.deleteRows(2, 20000); } catch (e) {}
  axLog_(axClean_(p.who, 80), axClean_(p.login, 40), 'opened', axClean_(p.detail, 200), p.page);
  return { ok: true };
}

function axActivity_(p) {
  const u = axUser_(p.token); if (!u) return { ok: false, error: 'signin' };
  if (u.role !== 'Admin') return { ok: false, error: 'Only Admin users can see the activity log' };
  const sh = axActSheet_(), last = sh.getLastRow();
  if (last < 2) return { ok: true, rows: [] };
  const n = Math.min(1500, last - 1);
  const rows = sh.getRange(last - n + 1, 1, n, 6).getValues().reverse().map(r => ({ t: r[0], who: String(r[1]), login: String(r[2]), action: String(r[3]), detail: String(r[4]), page: String(r[5]) }));
  return { ok: true, rows: rows };
}

// ---------- phone entries ----------
function axNeedle_(p) {
  const u = axUser_(p.token); if (!u) return { ok: false, error: 'signin' };
  const unit = axClean_(p.unit, 10).toUpperCase(), kind = /^(issue|breakage|return)$/i.test(p.kind) ? p.kind.toLowerCase() : null;
  const qty = Number(p.qty);
  if (!unit) return { ok: false, error: 'Pick a unit' };
  if (!kind) return { ok: false, error: 'Pick issue, breakage or return' };
  if (!(qty > 0 && qty < 100000)) return { ok: false, error: 'Enter the quantity' };
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(p.date || '')) ? p.date : kpiFmt_(new Date());
  // de-duplicate offline re-sends using the device id
  if (axSeen_(p.cid)) return { ok: true, duplicate: true };
  const id = 'D' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyMMddHHmmss') + Math.floor(Math.random() * 90 + 10);
  axNdlSheet_().appendRow([id, axNow_(), "'" + date, unit, "'" + axClean_(p.line, 10), kind, "'" + axClean_(p.ntype, 60), qty, "'" + axClean_(p.remark, 300), u.email, axClean_(p.devTime, 30)]);
  axLog_(u.email, p.login, 'needle ' + kind, unit + ' line ' + axClean_(p.line, 10) + ' ' + axClean_(p.ntype, 60) + ' x' + qty, p.page);
  return { ok: true, id: id };
}

function axNeedleList_(p) {
  const u = axUser_(p.token); if (!u) return { ok: false, error: 'signin' };
  const sh = axNdlSheet_(), last = sh.getLastRow();
  if (last < 2) return { ok: true, rows: [] };
  const n = Math.min(300, last - 1);
  const rows = sh.getRange(last - n + 1, 1, n, 10).getValues().reverse()
    .map(r => ({ id: String(r[0]), date: r[2] instanceof Date ? kpiFmt_(r[2]) : String(r[2]), unit: String(r[3]), line: String(r[4]), kind: String(r[5]), ntype: String(r[6]), qty: r[7], remark: String(r[8]), by: String(r[9]) }))
    .filter(r => u.role !== 'User' || r.by === u.email || (u.unit && r.unit === u.unit));
  return { ok: true, rows: rows };
}

/** Notes added while signed in carry the person's name. */
function axNoteSigned_(p) {
  const u = axUser_(p.token);
  if (u) { p.by = u.name; }
  if (axSeen_(p.cid)) return { ok: true, duplicate: true };
  const r = addNote_(p);
  if (r.ok) axLog_(u ? u.email : axClean_(p.by, 40), p.login, 'note added', axClean_(p.unit, 10) + ' ' + axClean_(p.line, 10) + ': ' + axClean_(p.text, 200), p.page);
  return r;
}

/** Run once from the editor to create all the new tabs. */
function setupAccess() {
  axUsersSheet_(); axRulesSheet_(); axReqSheet_(); axActSheet_(); axNdlSheet_();
  return 'Access tabs ready';
}
