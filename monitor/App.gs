/**
 * ==============================================================
 *  PHONE APP FEEDS (part of TSPL Error Monitor)
 *   ?action=app_home&token=       one call for the app home screen
 *   ?action=needle_types          needle types from the CMD Live_Stock sheet
 *   ?action=needle_stock&unit=    latest stock per needle type for a unit (+ CMD)
 *   ?action=photo&id=&token=      small photo (base64) for a note
 *   ?action=cid_done&cid=         has an offline entry with this id been saved?
 *   POST {action:'note_photo',...} note with a photo (saved in Drive folder
 *                                  "TSPL App Photos", private to the owner)
 *  Read-only on all data sheets.
 * ==============================================================
 */
const APP_PHOTO_FOLDER = 'TSPL App Photos';

function appCsv_(t, tq) {   // like gviz_ but without the row cap
  const url = 'https://docs.google.com/spreadsheets/d/' + t.id + '/gviz/tq?tqx=out:csv&sheet=' + encodeURIComponent(t.sheet) + '&tq=' + encodeURIComponent(tq);
  const r = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
  const body = r.getContentText();
  if (r.getResponseCode() !== 200 || /^\s*</.test(body) || /^\s*\{\s*"version"/.test(body)) return { error: 'Query failed (' + r.getResponseCode() + ')' };
  const d = Utilities.parseCsv(body);
  return { headers: d[0] || [], rows: d.slice(1) };
}

function appHome_(p) {
  const out = { ok: true, time: new Date() };
  out.k = kpis_();
  try { out.notes = notes_().notes.slice(0, 15); } catch (e) { out.notes = []; }
  const u = axUser_(p.token);
  if (u) {
    out.user = u;
    try {
      const rules = axRules_(), rows = axReqRows_().rows;
      const todo = rows.filter(r => axCanApprove_(u, r, rules)).reverse();
      out.todo = todo.slice(0, 20).map(r => ({ id: r.id, type: r.type, unit: r.unit, title: r.title, details: r.details, qty: r.qty, needBy: r.needBy, byName: r.byName, created: r.created, step: r.step }));
      out.todoCount = todo.length;
      out.minePending = rows.filter(r => r.by === u.email && r.status === 'Pending').length;
    } catch (e) { out.todo = []; out.todoCount = 0; }
  }
  return out;
}

function appNeedleTypes_() {
  const c = CacheService.getScriptCache(), hit = c.get('ndl_types_v1');
  if (hit) return JSON.parse(hit);
  const t = kpiSrc_('NDLSTK').tables.CMD;
  const m = appCsv_(t, 'select max(B)');
  const d = m.error ? null : kpiDate_(m.rows[0] && m.rows[0][0]);
  const rows = d ? (appCsv_(t, "select D, sum(L) where B = date '" + kpiFmt_(d) + "' group by D").rows || []) : [];
  const types = rows.filter(x => x[0]).map(x => ({ type: String(x[0]).trim(), cmd: kpiNum_(x[1]) })).sort((a, b) => a.type.localeCompare(b.type));
  const out = { ok: true, types: types };
  try { c.put('ndl_types_v1', JSON.stringify(out), 1800); } catch (e) {}
  return out;
}

function appNeedleStock_(p) {
  const unit = String(p.unit || '').toUpperCase();
  const tables = kpiSrc_('NDLSTK').tables;
  if (!tables[unit] || unit === 'CMD') return { ok: false, error: 'Pick a unit (FIPL, TS2, TS4, TS9, AP2)' };
  const c = CacheService.getScriptCache(), key = 'ndl_stock_' + unit, hit = c.get(key);
  if (hit) return JSON.parse(hit);
  function latest(t) {
    const m = appCsv_(t, 'select max(B)'); const d = m.error ? null : kpiDate_(m.rows[0] && m.rows[0][0]);
    if (!d) return { date: null, rows: [] };
    const r = appCsv_(t, "select D, sum(E), sum(J), sum(K), sum(L) where B = date '" + kpiFmt_(d) + "' group by D");
    return { date: kpiFmt_(d), rows: r.rows || [] };
  }
  const u = latest(tables[unit]), cmd = latest(tables.CMD);
  const cmdMap = {}; cmd.rows.forEach(x => { cmdMap[String(x[0]).trim()] = kpiNum_(x[4]); });
  const list = u.rows.filter(x => x[0]).map(x => ({ type: String(x[0]).trim(), open: kpiNum_(x[1]), issues: kpiNum_(x[2]), receives: kpiNum_(x[3]), close: kpiNum_(x[4]), cmd: cmdMap[String(x[0]).trim()] }))
    .sort((a, b) => a.close - b.close);
  const out = { ok: true, unit: unit, date: u.date, cmdDate: cmd.date, list: list };
  try { c.put(key, JSON.stringify(out), 900); } catch (e) {}
  return out;
}

// ---------- photos ----------
function appFolder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('photoFolder');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  const f = DriveApp.createFolder(APP_PHOTO_FOLDER);
  props.setProperty('photoFolder', f.getId());
  return f;
}

/** POST body: {action:'note_photo', token, unit, line, date, text, cid, photo:'data:image/jpeg;base64,...'} */
function appNotePhoto_(b) {
  const u = axUser_(b.token); if (!u) return { ok: false, error: 'signin' };
  const cache = CacheService.getScriptCache();
  if (b.cid && cache.get('cidok_' + b.cid)) return { ok: true, duplicate: true };
  let fileId = '';
  const m = String(b.photo || '').match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (m) {
    const bytes = Utilities.base64Decode(m[2]);
    if (bytes.length > 4 * 1024 * 1024) return { ok: false, error: 'Photo too large' };
    const blob = Utilities.newBlob(bytes, 'image/' + m[1], 'note_' + (b.unit || '') + '_' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyMMdd_HHmmss') + '.' + (m[1] === 'jpeg' ? 'jpg' : m[1]));
    fileId = appFolder_().createFile(blob).getId();
  }
  const p = { token: b.token, unit: b.unit, line: b.line, date: b.date, text: b.text || (fileId ? 'Photo' : ''), by: u.name, login: b.login, page: 'app' };
  const r = axNoteSigned_(p);
  if (r.ok && fileId && r.id) {
    const sh = notesSheet_(), n = sh.getLastRow();
    const ids = sh.getRange(Math.max(2, n - 50), 1, Math.min(51, n - 1), 1).getValues();
    for (let i = ids.length - 1; i >= 0; i--) if (String(ids[i][0]) === r.id) { sh.getRange(Math.max(2, n - 50) + i, 8).setValue(fileId); break; }
  }
  if (r.ok && b.cid) cache.put('cidok_' + b.cid, '1', 21600);
  return r.ok ? { ok: true, id: r.id, photo: fileId } : r;
}

function appPhoto_(p) {
  const u = axUser_(p.token); if (!u) return { ok: false, error: 'signin' };
  const id = String(p.id || '');
  if (!/^[\w-]{20,}$/.test(id)) return { ok: false, error: 'Bad id' };
  const f = DriveApp.getFileById(id);
  const parents = f.getParents();
  const folderId = PropertiesService.getScriptProperties().getProperty('photoFolder');
  if (!parents.hasNext() || parents.next().getId() !== folderId) return { ok: false, error: 'Not an app photo' };
  const b = f.getBlob();
  return { ok: true, data: 'data:' + b.getContentType() + ';base64,' + Utilities.base64Encode(b.getBytes()) };
}

function appCidDone_(p) {
  const cid = String(p.cid || '');
  return { ok: true, done: !!(cid && CacheService.getScriptCache().get('cidok_' + cid)) };
}
