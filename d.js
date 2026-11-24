/* ================= e-CUTMAX & FCR AUDIT feed (Nov 2026) =================
   action=ecm_list            -> every style e-Cutmax file of the last 180 days, all factories, with its
                                 Fabric Completion Report (F2) per fabric category + audit flags.
   action=ecm_style&id=<file> -> one style in detail: PO / size break-up (OS), cut log (M1..M10),
                                 fabric utilisation summary (C1..C10), FCR rows.
   READ-ONLY: the factory e-Cutmax files are only read, never written.
   The list comes from an index (a JSON file in this account's Drive) that ecmTick keeps up to date every
   10 minutes, re-reading only files changed since the last run. */
const ECM_FOLDERS = [
  ['FIPL', '1LRWQ4H8UM8sT6Lu_eOmnpPmAlay7Jl9S'], ['FIPL', '1QS-iPwlg9BqvJt0HFtPb_DNFStU1Uv3T'],   // TS3 e-Cutmax = FIPL
  ['TS2', '1oF2IyHFMHNl4IXNxpe3EAJ-ofBuaqKd9'], ['TS2', '1wWrg3TQAtKVhHOAZf8P8cwbwWJ-bct6I'],
  ['TS4', '1I1H08Vqb5nytBLKM4WnXV-7aj1gaDOM0'], ['TS4', '1HFWr7CyAyd1CMgG4AJZlnaseoVEyo2EU'],
  ['TS9', '1BBI8NKEpSM1Wv8UZWYAj94GxIV1GCQHk'], ['TS9', '1aBNSfLw1zSROTYhBPQdLBM1EbxOLz1w0'], ['TS9', '1eKc2efVwWke8RtzN-9LBQOAYc1vQ4Ey_'],
  ['AP2', '1KIwUxVVvVEFvjoRVRIEe7dHPlf_ul8sT']
];
const ECM_DAYS = 180, ECM_INDEX_NAME = 'TSPL_eCutmax_Audit_Index.json';

const ECM_F2_COLS = {
  'category': 'cat', 'color': 'col', 'style sub- description': 'sub', 'color order qty': 'oq', '+/- qty': 'pm', 'total order qty': 'toq', 'uom': 'uom',
  'received from cwh': 'rcw', 'return to cwh': 'tcw', 'location from other style': 'fos', 'location to other style': 'tos',
  'received from other unit': 'fou', 'sent to other unit': 'tou', 'fabric availabe in unit': 'av', 'fabric available in unit': 'av',
  'cut qty': 'cut', 'fabric net used': 'nu', 'fabric +/-': 'fpm', 'unused end bits': 'ueb', 'leftover end bits': 'leb', 're- cutting': 'rc', 're-cutting': 'rc',
  'total fabric utilised': 'tu', 'used for size set': 'ss', 'add-on re-cut / others': 'ao', 'let over / rtg': 'lo', 'left over / rtg': 'lo', 'grand total fabric': 'gt',
  'booked net cons': 'bn', 'booked gross cons': 'bg', 'approved net cons': 'an', 'approved gross cons': 'ag', 'actual net cons': 'xn', 'actual gross cons': 'xg'
};
function ecmNorm_(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase(); }
function ecmNum_(v) { if (typeof v === 'number') return isFinite(v) ? v : 0; const n = Number(String(v || '').replace(/,/g, '')); return isFinite(n) ? n : 0; }
function ecmLabel_(grid, label) {   // value to the right of a label cell such as "Buyer :"
  for (let r = 0; r < grid.length; r++) for (let c = 0; c < grid[r].length; c++)
    if (ecmNorm_(grid[r][c]).indexOf(label) === 0) {
      const own = String(grid[r][c]).split(':').slice(1).join(':').trim(); if (own) return own;
      for (let k = c + 1; k < grid[r].length; k++) { const v = String(grid[r][k]).trim(); if (v && v !== ':') return v; }
    }
  return '';
}

/* ---- read e-Cutmax files through the Sheets API (values:batchGet, many files in parallel, read-only) ---- */
function ecmGet_(ids, ranges, render) {
  const tok = ScriptApp.getOAuthToken(), q = ranges.map(r => 'ranges=' + encodeURIComponent(r)).join('&');
  const rs = UrlFetchApp.fetchAll(ids.map(id => ({ url: 'https://sheets.googleapis.com/v4/spreadsheets/' + id + '/values:batchGet?valueRenderOption=' + (render || 'UNFORMATTED_VALUE') + '&' + q, headers: { Authorization: 'Bearer ' + tok }, muteHttpExceptions: true })));
  return rs.map(r => {
    if (r.getResponseCode() !== 200) { let m = 'HTTP ' + r.getResponseCode(); try { m = JSON.parse(r.getContentText()).error.message; } catch (e) {} return { err: m }; }
    const j = JSON.parse(r.getContentText()), out = {};
    (j.valueRanges || []).forEach((v, i) => { out[ranges[i]] = (v.values || []).map(row => row.map(x => x == null ? '' : x)); });
    return out;
  });
}
function ecmPad_(g, n) { return (g || []).map(r => { r = r.slice(); while (r.length < n) r.push(''); return r; }); }
const ECM_R = ['OS!A1:Z6', 'F2!A1:AL30', 'CS!A1:BA16'];
function ecmParse_(got) {
  const out = { cats: [] };
  if (got.err) { out.err = got.err; return out; }
  const os = ecmPad_(got['OS!A1:Z6'], 26);
  if (os.length) {
    out.buyer = ecmLabel_(os, 'buyer'); out.style = ecmLabel_(os, 'style №') || ecmLabel_(os, 'style no'); out.desc = ecmLabel_(os, 'style description');
    out.vg = ecmLabel_(os, 'vg software'); out.grid = ecmLabel_(os, 'size grid');
  }
  const v = ecmPad_(got['F2!A1:AL30'], 38);
  let h = -1;
  for (let r = 0; r < v.length && h < 0; r++) { const t = v[r].map(ecmNorm_); if (t.indexOf('cut qty') > -1 && t.indexOf('fabric net used') > -1) h = r; }
  if (h < 0) { out.err = 'FCR (F2) not found'; return out; }
  const map = {}; v[h].forEach((c, i) => { const k = ECM_F2_COLS[ecmNorm_(c)]; if (k && map[k] == null) map[k] = i; });
  const uoms = [], tally = [], c = ecmPad_(got['CS!A1:BA16'], 53);
  let ch = -1;
  for (let r = 0; r < c.length && ch < 0; r++) if (c[r].map(ecmNorm_).indexOf('uom') > -1) ch = r;
  if (ch > -1) { const hn = c[ch].map(ecmNorm_), iu = hn.indexOf('uom'), it = hn.findIndex(x => x.indexOf('fabric tally') === 0);
    for (let r = ch + 1; r < c.length; r++) { uoms.push(c[r][iu] || ''); tally.push(it > -1 ? c[r][it] : ''); } }
  if (!out.style) { const s = String(v[2] && v[2][2] || ''); out.style = s.split(':').slice(1).join(':').trim(); }
  for (let r = h + 1, n = 0; r < v.length && n < 10; r++) {
    const row = v[r], first = ecmNorm_(row[2]);
    if (first.indexOf('prepared') === 0 || first.indexOf('total') === 0) break;
    if (row[2] === '' && row[3] === '') continue;
    n++;
    const e = { n: n, sheet: n };
    Object.keys(map).forEach(k => { const x = row[map[k]]; e[k] = (k === 'cat' || k === 'col' || k === 'sub' || k === 'uom') ? String(x || '').trim() : ecmNum_(x); });
    if (!e.uom) e.uom = String(uoms[n - 1] || '').trim();
    const t = String(tally[n - 1] || ''); e.tally = /✔|✅|ok|yes/i.test(t) ? 1 : /❌|✖|no/i.test(t) ? 0 : null;
    if (!e.cat && !e.toq && !e.cut && !e.nu) continue;
    Object.keys(e).forEach(k => { if (typeof e[k] === 'number') e[k] = Math.round(e[k] * 10000) / 10000; });
    out.cats.push(e);
  }
  return out;
}

/* ---- audit flags for one style ---- */
function ecmFlags_(s) {
  const f = [];
  s.cats.forEach(c => {
    const nm = (c.cat || 'Cat ' + c.n) + (c.col ? ' ' + c.col : '');
    if (c.cut > 0 && c.toq > 0 && c.cut > c.toq) f.push({ k: 'over', c: nm, t: 'Cut ' + Math.round(c.cut).toLocaleString() + ' vs order ' + Math.round(c.toq).toLocaleString() + ' (+' + Math.round((c.cut / c.toq - 1) * 100) + '%)' });
    if (c.cut > 0 && c.an > 0 && c.xn > c.an * 1.02) f.push({ k: 'cons', c: nm, t: 'Actual net cons ' + c.xn.toFixed(3) + ' vs approved ' + c.an.toFixed(3) + ' (+' + ((c.xn / c.an - 1) * 100).toFixed(1) + '%)' });
    if (c.cut > 0 && !(c.an > 0)) f.push({ k: 'noapp', c: nm, t: 'Cutting started but approved consumption not entered' });
    if (c.cut > 0 && c.nu > 0 && !(c.av > 0)) f.push({ k: 'nofab', c: nm, t: 'Fabric used ' + c.nu.toFixed(1) + ' but fabric received (in-house) not entered' });
    else if (c.av > 0 && c.gt > 0 && Math.abs(c.av - c.gt) > Math.max(1, c.av * 0.01)) f.push({ k: 'tally', c: nm, t: 'Fabric in unit ' + c.av.toFixed(1) + ' vs accounted ' + c.gt.toFixed(1) + ' (' + (c.av - c.gt > 0 ? 'unaccounted ' : 'used more than received ') + Math.abs(c.av - c.gt).toFixed(1) + ')' });
  });
  return f;
}

/* ---- index (Drive JSON) ---- */
function ecmIndexFile_() {
  const it = DriveApp.getRootFolder().getFilesByName(ECM_INDEX_NAME);
  return it.hasNext() ? it.next() : DriveApp.getRootFolder().createFile(ECM_INDEX_NAME, '{"files":{}}', 'application/json');
}
function ecmLoadIndex_() { try { return JSON.parse(ecmIndexFile_().getBlob().getDataAsString()); } catch (e) { return { files: {} }; } }

function ecmTick() {
  const h = Number(Utilities.formatDate(new Date(), 'Asia/Kolkata', 'H'));
  if (h < 6 || h >= 23) return 'night - skipped';
  const lock = LockService.getScriptLock(); if (!lock.tryLock(2000)) return 'busy';
  try { return ecmRefresh_(230000); } finally { lock.releaseLock(); }
}
function ecmRefresh_(budget) {
  const t0 = Date.now(), idx = ecmLoadIndex_(), seen = {}, cutoff = Date.now() - ECM_DAYS * 864e5, todo = [];
  ECM_FOLDERS.forEach(([u, fid]) => {
    let folder; try { folder = DriveApp.getFolderById(fid); } catch (e) { return; }
    const it = folder.getFilesByType(MimeType.GOOGLE_SHEETS);
    while (it.hasNext()) {
      const f = it.next(), id = f.getId(), mod = f.getLastUpdated().getTime();
      if (mod < cutoff || seen[id]) continue;
      seen[id] = 1;
      const old = idx.files[id];
      if (old && old.mod === mod && !old.err) { old.u = u; old.t = f.getName(); continue; }
      todo.push({ u: u, f: f, mod: mod, old: old });
    }
  });
  Object.keys(idx.files).forEach(id => { if (!seen[id]) delete idx.files[id]; });
  todo.sort((a, b) => b.mod - a.mod);
  let done = 0;
  for (let i = 0; i < todo.length; i += 15) {
    if (Date.now() - t0 > budget) break;
    const part = todo.slice(i, i + 15), got = ecmGet_(part.map(j => j.f.getId()), ECM_R);
    part.forEach((j, k) => {
      const e = ecmParse_(got[k]);
      e.id = j.f.getId(); e.u = j.u; e.t = j.f.getName(); e.mod = j.mod;
      e.flags = ecmFlags_(e);
      idx.files[e.id] = e; done++;
    });
  }
  idx.built = Date.now(); idx.pending = todo.length - done;
  ecmIndexFile_().setContent(JSON.stringify(idx));
  CacheService.getScriptCache().remove('ecml_n');
  return 'e-Cutmax index: ' + Object.keys(idx.files).length + ' files, read ' + done + ', pending ' + idx.pending + ' in ' + Math.round((Date.now() - t0) / 1000) + 's';
}
function ecmSetup_() {
  const have = ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'ecmTick');
  if (!have.length) ScriptApp.newTrigger('ecmTick').timeBased().everyMinutes(10).create();
  return ecmRefresh_(300000);
}

/* ---- feeds ---- */
function ecmList_(p) {
  const c = CacheService.getScriptCache();
  if (String(p.fresh) !== '1') { const n = Number(c.get('ecml_n') || 0); if (n) { const parts = c.getAll(Array.from({ length: n }, (_, i) => 'ecml_' + i)); let s = ''; for (let i = 0; i < n; i++) { if (parts['ecml_' + i] == null) { s = ''; break; } s += parts['ecml_' + i]; } if (s) return JSON.parse(s); } }
  const idx = ecmLoadIndex_(), tz = 'Asia/Kolkata';
  const styles = Object.keys(idx.files).map(id => idx.files[id]).sort((a, b) => b.mod - a.mod).map(e => ({
    id: e.id, u: e.u, t: e.t, buyer: e.buyer || '', style: e.style || '', desc: e.desc || '', vg: e.vg || '', grid: e.grid || '',
    mod: e.mod, modS: Utilities.formatDate(new Date(e.mod), tz, 'dd-MMM-yy HH:mm'), err: e.err || '', cats: e.cats, flags: e.flags || []
  }));
  const out = { ok: true, styles: styles, built: idx.built || 0, builtS: idx.built ? Utilities.formatDate(new Date(idx.built), tz, 'dd-MMM-yyyy HH:mm') : '', pending: idx.pending || 0, days: ECM_DAYS };
  const js = JSON.stringify(out);
  try { const parts = {}; let k = 0; for (let i = 0; i < js.length; i += 95000) parts['ecml_' + (k++)] = js.slice(i, i + 95000); parts.ecml_n = String(k); c.putAll(parts, 600); } catch (e) {}
  return out;
}

function ecmStyle_(p) {
  const id = String(p.id || '');
  const idx = ecmLoadIndex_(), base = idx.files[id];
  if (!base) return { ok: false, error: 'Style file not found in the e-Cutmax audit list' };   // only indexed e-Cutmax files can be opened
  const c = CacheService.getScriptCache(), key = 'ecms_' + id + '_' + base.mod;
  if (String(p.fresh) !== '1') { const hit = c.get(key); if (hit) return JSON.parse(hit); }
  const tz = 'Asia/Kolkata';
  const got0 = ecmGet_([id], ECM_R)[0], fresh = ecmParse_(got0); fresh.flags = ecmFlags_(fresh);
  if (fresh.err && !fresh.cats.length) return { ok: false, error: fresh.err };
  const out = { ok: true, id: id, u: base.u, t: base.t, buyer: fresh.buyer, style: fresh.style, desc: fresh.desc, vg: fresh.vg, grid: fresh.grid, cats: fresh.cats, flags: fresh.flags,
    modS: Utilities.formatDate(new Date(base.mod), tz, 'dd-MMM-yyyy HH:mm'), pos: [], sizes: [], cuts: [], util: [] };
  const rr = ['OS!A1:AB80']; fresh.cats.forEach(cat => { if (cat.cut > 0) rr.push('M' + cat.sheet + '!B16:N616'); rr.push('C' + cat.sheet + '!C9:S9'); });
  const got = ecmGet_([id], rr, 'FORMATTED_VALUE')[0];
  if (got.err) return out;
  // POs and size break-up (OS)
  const g = ecmPad_(got['OS!A1:AB80'], 28); let h = -1;
  for (let r = 0; r < g.length && h < 0; r++) if (g[r].some(x => ecmNorm_(x) === 'po №.' || ecmNorm_(x) === 'po no.')) h = r;
  if (h > -1) {
    const hd = g[h].map(ecmNorm_), ip = hd.findIndex(x => x === 'po №.' || x === 'po no.'), ic = hd.indexOf('color'), id2 = hd.findIndex(x => x.indexOf('destination') === 0), idd = hd.findIndex(x => x.indexOf('delivery') === 0), itd = hd.indexOf('tod');
    const s0 = itd > -1 ? itd + 1 : 10;
    for (let k = s0; k < g[h].length; k++) { const nm = String(g[h][k]).trim(); if (!nm || /total|note/i.test(nm)) break; out.sizes.push(nm); }
    for (let r = h + 1; r < g.length; r++) {
      const row = g[r]; if (!String(row[ip] || '').trim()) continue;
      const q = out.sizes.map((_, k) => ecmNum_(row[s0 + k]));
      out.pos.push({ po: row[ip], color: ic > -1 ? row[ic] : '', dest: id2 > -1 ? row[id2] : '', del: idd > -1 ? row[idd] : '', tod: itd > -1 ? row[itd] : '', q: q, tot: q.reduce((a, b) => a + b, 0) });
    }
  }
  // cut log (M sheets) + utilisation summary (C sheets)
  fresh.cats.forEach(cat => {
    const v = ecmPad_(got['M' + cat.sheet + '!B16:N616'], 13); let cur = null;
    v.forEach(r => {
      const t = Number(r[0]);
      if (t === 1 && String(r[1]).trim() !== '') cur = { cat: cat.n, no: r[1], lot: r[2], lay: ecmNum_(r[3]), mlen: ecmNum_(r[4]), mw: ecmNum_(r[6]), fw: ecmNum_(r[7]), date: String(r[12] || '') };
      else if (t === 3 && cur) { cur.qty = ecmNum_(r[2]); cur.ways = ecmNum_(r[3]); cur.laylen = ecmNum_(r[4]); cur.reqM = ecmNum_(r[5]); cur.consM = ecmNum_(r[6]); cur.reqKg = ecmNum_(r[7]); cur.consKg = ecmNum_(r[8]); cur.start = r[9]; cur.end = r[10]; if (cur.lay > 0 || cur.qty > 0) out.cuts.push(cur); cur = null; }
    });
    const cr = ((got['C' + cat.sheet + '!C9:S9'] || [])[0] || []).map(ecmNum_);
    if (cr.some(x => x)) out.util.push({ cat: cat.n, rolls: cr[0] || 0, issued: cr[1] || 0, cut: cr[2] || 0, net: cr[3] || 0, netCons: cr[4] || 0, endBits: cr[5] || 0, fpm: cr[6] || 0, uebLen: cr[7] || 0, ueb: cr[8] || 0, reb: cr[9] || 0, leb: cr[10] || 0, rc: cr[11] || 0, used: cr[12] || 0, grossCons: cr[13] || 0, broll: cr[14] || 0, brollRe: cr[15] || 0, brollLeft: cr[16] || 0 });
  });
  try { c.put(key, JSON.stringify(out), 900); } catch (e) {}
  return out;
}
