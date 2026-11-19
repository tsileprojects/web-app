/* ================= HELP DESK: issues reported from the portal Help button =================
 * POST {action:'help', name, login, page, pageUrl, program, programUrl, type, message, photos:[dataUrl..], env}
 * -> logs to the HO bell (Log sheet, source "Help desk"), keeps a copy in the "Help" sheet,
 *    saves screenshots to a private Drive folder, then runs automatic checks / safe fixes.
 * Uses only what the monitor already has (Sheets, Drive, UrlFetch): no new permissions. */
const HELP_HEAD = ['Ticket', 'Time', 'Name', 'Login', 'Page', 'Program', 'Program URL', 'Type', 'Message', 'Photos', 'Auto-check', 'Environment'];

function helpSheet_() {
  const ss = ss_(); let sh = ss.getSheetByName('Help');
  if (!sh) { sh = ss.insertSheet('Help'); sh.appendRow(HELP_HEAD); sh.setFrozenRows(1); sh.getRange(1, 1, 1, HELP_HEAD.length).setFontWeight('bold'); }
  return sh;
}
function helpFolder_() {
  const props = PropertiesService.getScriptProperties(), id = props.getProperty('helpFolder');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  const f = DriveApp.createFolder('TSPL Help Uploads');
  props.setProperty('helpFolder', f.getId());
  return f;
}
function helpClean_(v, n) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n); }

function helpSubmit_(b) {
  const name = helpClean_(b.name, 80), login = helpClean_(b.login, 40), page = helpClean_(b.page, 120);
  const program = helpClean_(b.program, 150) || page || 'TSPL portal', url = helpClean_(b.programUrl, 400);
  const type = helpClean_(b.type, 40), text = String(b.message || '').trim().slice(0, 2000);
  const photos = (Array.isArray(b.photos) ? b.photos : []).slice(0, 3);
  if (!name) return { ok: false, error: 'Please enter your name' };
  if (!text && !photos.length) return { ok: false, error: 'Please describe the issue' };

  // the same report sent twice within 2 minutes returns the same ticket
  const cache = CacheService.getScriptCache();
  const ck = 'help_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, name + '|' + program + '|' + text + '|' + photos.length));
  const dup = cache.get(ck); if (dup) return JSON.parse(dup);

  const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyMMdd_HHmmss');
  const links = [];
  photos.forEach((p, i) => {
    const m = String(p || '').match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/); if (!m) return;
    const bytes = Utilities.base64Decode(m[2]); if (bytes.length > 4 * 1024 * 1024) return;
    const f = helpFolder_().createFile(Utilities.newBlob(bytes, 'image/' + m[1], 'help_' + stamp + '_' + (login || 'user') + '_' + (i + 1) + '.' + (m[1] === 'jpeg' ? 'jpg' : m[1])));
    links.push(f.getUrl());
  });

  const who = name + (login ? ' (' + login + ')' : '');
  const head = (type ? '[' + type + '] ' : '') + text.replace(/\s+/g, ' ');
  const tail = ' — reported by ' + who + (page && page !== program ? ' on ' + page : '') + (links.length ? ' | Photos: ' + links.join(' ') : '');
  const msg = head.slice(0, Math.max(200, 1000 - tail.length)) + tail;

  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  let id;
  try {
    id = upsertIssue_({ key: 'HELP|' + Utilities.getUuid().slice(0, 13), severity: type === 'Question' ? 'Warning' : 'Error',
      source: 'Help desk', program: program, target: url, message: msg });
  } finally { lock.releaseLock(); }

  let auto = { fixed: false, steps: [] };
  try { auto = helpAutoCheck_(id, program, url, text); } catch (e) { auto.steps.push('Automatic check could not run: ' + e.message); }
  const note = auto.steps.join(' · ') || 'No automatic fix for this kind of issue - HO will review.';
  try {
    if (auto.fixed) setStatus_(id, 'Auto-resolved', 'Auto (help desk)', note);
    else helpNote_(id, 'Auto-check: ' + note);
  } catch (e) {}

  helpSheet_().appendRow([id, new Date(), name, login, page, program, url, type, text, links.join('\n'), note, helpClean_(b.env, 400)]);
  const out = { ok: true, ticket: id, fixed: auto.fixed, steps: auto.steps, photos: links.length };
  cache.put(ck, JSON.stringify(out), 120);
  return out;
}

/** writes the note column of an open issue without closing it */
function helpNote_(id, note) {
  const sh = logSheet_(), rows = readLog_();
  for (let i = rows.length - 1; i >= 0; i--) if (rows[i][0] === id) { sh.getRange(i + 2, 14).setValue(String(note).slice(0, 1000)); return true; }
  return false;
}

/** automatic checks and SAFE fixes only: re-test the program, repair FSA entry/photo boxes, link known issues */
function helpAutoCheck_(id, program, url, text) {
  const steps = []; let fixed = false;
  const hay = (program + ' ' + url + ' ' + text).toLowerCase();

  // 1. the program itself: is it responding?
  if (/^https:\/\/(script\.google\.com|lookerstudio\.google\.com|datastudio\.google\.com|docs\.google\.com)\//.test(url)) {
    try {
      const r = classify_(fetchSafe_([url])[0]);
      steps.push(r.ok ? 'Program checked: responding normally' : 'Program checked: ' + r.msg);
    } catch (e) { steps.push('Program could not be tested automatically'); }
  }

  // 2. FSA report named in the program or the message: compare with the master and repair entry/photo boxes
  if (typeof FSA_SHEETS !== 'undefined' && /fsa/.test(hay)) {
    const tok = n => n.toLowerCase().replace(/^\d+_/, '').split(/[_ ]+/).map(t => t.replace(/^m[rs]s?\.?/, '')).filter(t => t.length > 2);
    const names = Object.keys(FSA_SHEETS).filter(n => {
      if (FSA_SKIP.test(n) || /MATALAN/.test(n)) return false;
      const t = tok(n), person = t[t.length - 1];
      return person && hay.indexOf(person) > -1 && (t.length < 2 || hay.indexOf(t[0]) > -1);
    });
    if (names.length === 1) {
      try {
        const sh = SpreadsheetApp.openById(FSA_SHEETS[names[0]]).getSheetByName(FSA_TAB);
        const M = fsaLayout_(SpreadsheetApp.openById(FSA_MASTER).getSheetByName(FSA_TAB)), d = fsaLayoutDiff_(sh, M), did = [];
        d.mergeMissing.forEach(a => {
          const rg = sh.getRange(a), filled = rg.getValues().flat().filter(v => v !== '' && v !== null).length;
          if (filled <= 1 && !rg.getMergedRanges().length) { rg.merge(); did.push(a); }
        });
        if (d.openMissing.length || d.openBad.length) {
          const p = sh.getProtections(SpreadsheetApp.ProtectionType.SHEET)[0];
          if (p) {
            const keep = p.getUnprotectedRanges().filter(r => { try { return r.getA1Notation() !== '#REF!'; } catch (e) { return false; } });
            p.setUnprotectedRanges(keep.concat(d.openMissing.map(a => sh.getRange(a)))); did.push('entry areas ' + d.openMissing.join(','));
          }
        }
        if (did.length) { SpreadsheetApp.flush(); fixed = true; steps.push('FSA report ' + names[0] + ': repaired ' + did.join(', ')); }
        else steps.push('FSA report ' + names[0] + ': layout matches the master');
      } catch (e) { steps.push('FSA report check failed: ' + e.message); }
    }
  }

  // 3. already known to the monitor?
  try {
    const p = program.toLowerCase().split(' > ')[0];
    const known = readLog_().filter(r => r[2] === 'Open' && r[0] !== id && String(r[1]).indexOf('HELP|') !== 0 && p && String(r[5]).toLowerCase().indexOf(p) > -1);
    if (known.length) steps.push('Already being tracked: ' + known.slice(0, 3).map(r => r[0]).join(', '));
  } catch (e) {}

  if (!fixed) steps.push('Sent to HO for review');
  return { fixed: fixed, steps: steps };
}
