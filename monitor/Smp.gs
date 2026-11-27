/**
 * ==============================================================
 *  SAMPLING TRACKER (Nov 2026)  -  part of TSPL Error Monitor
 *  Data: Google Sheet "TSPL_Sampling_Tracker" (SMP_SS below)
 *    Samples    one row per sample line (current state)
 *    Moves      every change, with the state after it (history)
 *    Daily      tailors present per day
 *    History    daily WIP summary before the tracker went live
 *    IndentBase type-wise indent totals before the tracker went live
 *    Lists      buyers, merchants, sample types / groups, stages
 *    Settings   live date, mail to / cc / subject
 *  Read (no sign-in):
 *    ?action=smp_data                 lists + open samples (board)
 *    ?action=smp_report&date=YYYY-MM-DD   all management tables + mail
 *  Write (sign-in):
 *    smp_add   &d={json}   new indent (common fields + lines)
 *    smp_move  &ids=&to=&sub=&qty=&date=   move samples to a stage
 *    smp_edit  &id=&d={json}               correct a sample
 *    smp_daily &date=&tailors=&mock=       tailors present
 *    smp_mail  &date=                      send the daily mail
 *  Nothing is deleted: closing a sample keeps its row.
 * ==============================================================
 */
const SMP_SS = '1VUTi3Z_pPpZD2Z56IbNUnb5s9JhZTXsbBq3hOky69xQ';
const SMP_STAGES = [
  ['5. Pattern Pending', 'A. Pre-Production', ['Pattern Pending']],
  ['6. On Hold', 'A. Pre-Production', ['Pending Issue']],
  ['13. Under Shrinkage', 'A. Pre-Production', ['Under Shrinkage']],
  ['3. Under Cutting', 'B. Yet to Sew', ['Under Cutting', 'Under Smocking']],
  ['4. Loading Pending', 'B. Yet to Sew', ['Loading Pending']],
  ['2. Under Sewing', 'Under Sewing', ['Inline', 'Kaja Btn']],
  ['1. Already Sewn', 'C. Sewing Finished', ['Under Review', 'Under Washing & Dyeing']],
  ['10. Under Printing & Emb', 'C. Sewing Finished', ['Under Printing & Emb']],
  ['9. Awaiting to Dispatch', 'C. Sewing Finished', ['Ready to send']],
  ['7. Handed Over', 'Closed', ['Handover to Merchant']],
  ['Indent Cancelled', 'Closed', ['Indent Cancelled']],
  ['Rejected', 'Closed', ['Rejected']],
  ['Transfer to TS9', 'Closed', ['Transfer to TS9']]
];
const SMP_CLOSE = { '7. Handed Over': 'ho', 'Indent Cancelled': 'cx', 'Rejected': 'cx', 'Transfer to TS9': 'ts9' };
const SMP_EXCL = ['1. Already Sewn', '6. On Hold', '9. Awaiting to Dispatch'];   // "Summery excluding ..." table
const SMP_MER_ORDER = ['Mani', 'Namitha', 'Rajesh', 'Shweta', 'ERS'];
// column order used in the management mail (same as the Excel pivots); new types go at the end
const SMP_ORD_EXCL = ['DEVELOPMENT', 'FIT', 'GPT', 'PA', 'PP', 'PROTO', 'Top', 'Direct', 'SMS', 'size set', 'Emb', 'FDS-PP', 'Black Seal-PP', 'GOLD TAG-PP', 'GOLDSEAL-PP', 'OB', 'ref', 'Blue Seal-PP', 'SHOW CASE'];
const SMP_ORD_IND = ['FIT', 'GOLDSEAL-PP', 'GPT', 'DEVELOPMENT', 'FDS-PP', 'PP', 'OB', 'Black Seal-PP', 'Design', 'PROTO', 'Mock', 'Readseal-PP', 'Photo shoot', 'Sealer', 'size set', 'Top',
  'GOLD TAG-PP', 'Blue Seal-PP', 'Silver Seal-PP', 'Add', 'Trail', 'Collar', 'Emb', 'co-ord', 'ref', 'PA', 'Test', 'Direct', 'SMS'];
const SMP_SH = ['ID', 'Entry Date', 'Indent Date', 'Merchant', 'Merchant (short)', 'Buyer', 'Board No', 'Style No', 'Sample Type', 'Sample Group',
  'Description', 'Fabric & Combo', 'Size', 'Qty', 'Stage', 'Sub-status', 'Stage Date', 'Remark', 'Closed Date', 'Closed As', 'Entered By', 'Updated At'];
const SMP_MH = ['Time', 'Date', 'ID', 'Action', 'From Stage', 'Stage', 'Sub-status', 'Qty', 'Qty Change', 'Note', 'By'];

function smpSs_() { return SpreadsheetApp.openById(SMP_SS); }
function smpTz_() { return Session.getScriptTimeZone() || 'Asia/Kolkata'; }
function smpD_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, smpTz_(), 'yyyy-MM-dd');
  const s = String(v == null ? '' : v).trim(); const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  return m ? m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2) : '';
}
function smpT_(v) { return v instanceof Date ? Utilities.formatDate(v, smpTz_(), 'yyyy-MM-dd HH:mm:ss') : String(v || ''); }
function smpToday_() { return Utilities.formatDate(new Date(), smpTz_(), 'yyyy-MM-dd'); }
function smpNow_() { return Utilities.formatDate(new Date(), smpTz_(), 'yyyy-MM-dd HH:mm:ss'); }
function smpS_(v, n) { return String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n || 80); }
function smpStage_(s) { for (let i = 0; i < SMP_STAGES.length; i++) if (SMP_STAGES[i][0] === s) return SMP_STAGES[i]; return null; }
function smpOpen_(s) { const x = smpStage_(s); return !!x && x[1] !== 'Closed'; }
function smpVals_(name) { const sh = smpSs_().getSheetByName(name); if (!sh || sh.getLastRow() < 2) return []; return sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues(); }
function smpBump_() { CacheService.getScriptCache().put('smp_ver', String(Date.now()), 21600); }
function smpVer_() { return CacheService.getScriptCache().get('smp_ver') || '0'; }
function smpSettings_() {
  const o = {}; smpVals_('Settings').forEach(r => { o[String(r[0]).trim()] = r[1]; });
  return { live: smpD_(o['Live from']) || '2026-11-26', base: smpD_(o['Indent base till']) || '2026-11-25',
    to: String(o['Mail to'] || '').trim(), cc: String(o['Mail cc'] || '').trim(), subject: String(o['Mail subject'] || 'Sampling status as on {date}') };
}
function smpUser_(p) { const u = axUser_(p.token); return u ? (u.name || u.email) : null; }

/* ---------------- read: lists + open samples ---------------- */
function smpLists_() {
  const L = { buyers: [], merchants: [], groups: [], types: {}, descs: [] };
  smpVals_('Lists').forEach(r => {
    const k = String(r[0]).trim(), v = smpS_(r[1]), x = smpS_(r[2]); if (!v) return;
    if (k === 'Buyer') L.buyers.push(v); else if (k === 'Merchant') L.merchants.push([v, x || v.split('-')[0]]);
    else if (k === 'Sample Group') L.groups.push(v); else if (k === 'Sample Type') L.types[v] = x; else if (k === 'Description') L.descs.push(v);
  });
  L.stages = SMP_STAGES.map(s => ({ s: s[0], g: s[1], subs: s[2] }));
  return L;
}
function smpRowObj_(r) {
  return { id: String(r[0]), entry: smpD_(r[1]), indent: smpD_(r[2]), mer: String(r[3]), m1: String(r[4]), buyer: String(r[5]), board: String(r[6]),
    style: String(r[7]), type: String(r[8]), group: String(r[9]), desc: String(r[10]), fab: String(r[11]), size: String(r[12]), qty: Number(r[13]) || 0,
    stage: String(r[14]), sub: String(r[15]), sdate: smpD_(r[16]), remark: String(r[17]), cdate: smpD_(r[18]), cas: String(r[19]) };
}
function smpData_(p) {
  const key = 'smp_data_' + smpVer_(), c = CacheService.getScriptCache(), hit = c.get(key);
  if (hit && !p.fresh) return JSON.parse(hit);
  const rows = smpVals_('Samples').map(smpRowObj_);
  const today = smpToday_(), lim = smpAddDays_(today, -7);
  const out = { ok: true, lists: smpLists_(), open: rows.filter(r => smpOpen_(r.stage)), recent: rows.filter(r => !smpOpen_(r.stage) && r.cdate >= lim),
    today: today, settings: smpSettings_() };
  out.settings.to = out.settings.to ? out.settings.to.split(/[,;\s]+/).filter(String).length + ' address(es)' : '';
  out.settings.cc = '';
  const daily = {}; smpVals_('Daily').forEach(r => { daily[smpD_(r[0])] = { t: Number(r[1]) || 0, m: Number(r[2]) || 0 }; }); out.daily = daily;
  try { c.put(key, JSON.stringify(out), 300); } catch (e) {}
  return out;
}
function smpAddDays_(d, n) { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return Utilities.formatDate(x, smpTz_(), 'yyyy-MM-dd'); }

/* ---------------- write helpers ---------------- */
function smpNextId_(sh) {
  const n = sh.getLastRow() - 1; let mx = 0;
  if (n > 0) sh.getRange(2, 1, n, 1).getValues().forEach(r => { const m = String(r[0]).match(/^S(\d+)$/); if (m) mx = Math.max(mx, +m[1]); });
  return mx;
}
function smpDateOk_(p, st) {
  const today = smpToday_(), d = smpD_(p.date) || today;
  if (d > today) throw new Error('Date cannot be in the future');
  if (d < st.live) throw new Error('Date is before the tracker start (' + st.live + ')');
  return d;
}
function smpLock_(fn) { const l = LockService.getScriptLock(); l.waitLock(20000); try { return fn(); } finally { l.releaseLock(); smpBump_(); } }

function smpAdd_(p) {
  const by = smpUser_(p); if (!by) return { ok: false, error: 'signin' };
  let d; try { d = JSON.parse(p.d || '{}'); } catch (e) { return { ok: false, error: 'Bad data' }; }
  const st = smpSettings_(); let date; try { date = smpDateOk_(p, st); } catch (e) { return { ok: false, error: e.message }; }
  const mer = smpS_(d.mer, 60), buyer = smpS_(d.buyer, 60).toUpperCase(), style = smpS_(d.style, 80), group = smpS_(d.group, 40), type = smpS_(d.type, 60) || group;
  if (!mer) return { ok: false, error: 'Pick the merchant' }; if (!buyer) return { ok: false, error: 'Pick the buyer' };
  if (!style) return { ok: false, error: 'Enter the style number' }; if (!group) return { ok: false, error: 'Pick the sample type' };
  const stage = smpStage_(d.stage) && smpOpen_(d.stage) ? d.stage : '5. Pattern Pending', sub = smpStage_(stage)[2][0];
  const lines = (d.lines || []).map(l => ({ fab: smpS_(l.fab, 60), size: smpS_(l.size, 30), qty: Math.round(Number(l.qty)) })).filter(l => l.qty > 0 && l.qty <= 5000);
  if (!lines.length) return { ok: false, error: 'Enter at least one line with a quantity' };
  const m1 = (smpLists_().merchants.filter(m => m[0] === mer)[0] || [mer, mer.split('-')[0]])[1];
  const indent = smpD_(d.indent) || date, now = smpNow_();
  return smpLock_(() => {
    const ss = smpSs_(), sh = ss.getSheetByName('Samples'), mv = ss.getSheetByName('Moves'); let n = smpNextId_(sh); const ids = [];
    const rows = [], moves = [];
    lines.forEach(l => {
      const id = 'S' + ('0000' + (++n)).slice(-5); ids.push(id);
      rows.push([id, date, indent, mer, m1, buyer, smpS_(d.board, 30), style, type, group, smpS_(d.desc, 60), l.fab, l.size, l.qty, stage, sub, date, smpS_(d.remark, 200), '', '', by, now]);
      moves.push([now, date, id, 'NEW', '', stage, sub, l.qty, l.qty, 'New indent', by]);
    });
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, SMP_SH.length).setValues(rows);
    mv.getRange(mv.getLastRow() + 1, 1, moves.length, SMP_MH.length).setValues(moves);
    if (smpLists_().buyers.indexOf(buyer) < 0) ss.getSheetByName('Lists').appendRow(['Buyer', buyer, '']);
    return { ok: true, ids: ids, qty: lines.reduce((a, l) => a + l.qty, 0) };
  });
}

function smpMove_(p) {
  const by = smpUser_(p); if (!by) return { ok: false, error: 'signin' };
  const to = String(p.to || ''), tg = smpStage_(to); if (!tg) return { ok: false, error: 'Pick the stage' };
  const sub = tg[2].indexOf(p.sub) > -1 ? p.sub : tg[2][0];
  const st = smpSettings_(); let date; try { date = smpDateOk_(p, st); } catch (e) { return { ok: false, error: e.message }; }
  const ids = String(p.ids || '').split(',').map(s => s.trim()).filter(String); if (!ids.length) return { ok: false, error: 'Tick at least one sample' };
  const part = Math.round(Number(p.qty) || 0), note = smpS_(p.note, 200);
  return smpLock_(() => {
    const ss = smpSs_(), sh = ss.getSheetByName('Samples'), mv = ss.getSheetByName('Moves'), n = sh.getLastRow() - 1;
    const vals = sh.getRange(2, 1, n, SMP_SH.length).getValues(), now = smpNow_(), moves = [], add = []; let done = 0, q = 0, next = smpNextId_(sh);
    const closing = !smpOpen_(to);
    ids.forEach(id => {
      const i = vals.findIndex(r => String(r[0]) === id); if (i < 0) return;
      const r = vals[i], from = String(r[14]), qty = Number(r[13]) || 0;
      if (!smpOpen_(from) && !smpOpen_(to)) return;                 // closed -> closed: nothing to do
      if (from === to && String(r[15]) === sub) return;
      if (ids.length === 1 && part > 0 && part < qty && smpOpen_(from)) {   // part of the qty moves: split the line
        const nid = 'S' + ('0000' + (++next)).slice(-5), nr = r.slice();
        nr[0] = nid; nr[13] = part; nr[14] = to; nr[15] = sub; nr[16] = date; nr[18] = closing ? date : ''; nr[19] = closing ? to : ''; nr[20] = by; nr[21] = now;
        r[13] = qty - part; r[21] = now; add.push(nr);
        moves.push([now, date, id, 'SPLIT', from, from, r[15], qty - part, -part, 'Split ' + part + ' to ' + nid + (note ? ' · ' + note : ''), by]);
        moves.push([now, date, nid, 'SPLIT-IN', from, to, sub, part, part, 'From ' + id + (note ? ' · ' + note : ''), by]);
        sh.getRange(i + 2, 1, 1, SMP_SH.length).setValues([r]); done++; q += part; return;
      }
      r[14] = to; r[15] = sub; r[16] = date; r[18] = closing ? date : ''; r[19] = closing ? to : ''; r[21] = now;
      moves.push([now, date, id, smpOpen_(from) ? 'MOVE' : 'REOPEN', from, to, sub, qty, 0, note, by]);
      sh.getRange(i + 2, 1, 1, SMP_SH.length).setValues([r]); done++; q += qty;
    });
    if (add.length) sh.getRange(sh.getLastRow() + 1, 1, add.length, SMP_SH.length).setValues(add);
    if (moves.length) mv.getRange(mv.getLastRow() + 1, 1, moves.length, SMP_MH.length).setValues(moves);
    return done ? { ok: true, moved: done, qty: q } : { ok: false, error: 'Nothing changed' };
  });
}

function smpEdit_(p) {
  const by = smpUser_(p); if (!by) return { ok: false, error: 'signin' };
  let d; try { d = JSON.parse(p.d || '{}'); } catch (e) { return { ok: false, error: 'Bad data' }; }
  const st = smpSettings_(), date = smpToday_();
  return smpLock_(() => {
    const ss = smpSs_(), sh = ss.getSheetByName('Samples'), n = sh.getLastRow() - 1, ids = sh.getRange(2, 1, n, 1).getValues();
    const i = ids.findIndex(r => String(r[0]) === String(p.id)); if (i < 0) return { ok: false, error: 'Not found' };
    const rg = sh.getRange(i + 2, 1, 1, SMP_SH.length), r = rg.getValues()[0], now = smpNow_(), old = Number(r[13]) || 0;
    const F = { mer: 3, buyer: 5, board: 6, style: 7, type: 8, group: 9, desc: 10, fab: 11, size: 12, remark: 17 };
    Object.keys(F).forEach(k => { if (d[k] != null) r[F[k]] = k === 'buyer' ? smpS_(d[k], 60).toUpperCase() : smpS_(d[k], k === 'remark' ? 200 : 80); });
    if (d.mer != null) r[4] = (smpLists_().merchants.filter(m => m[0] === r[3])[0] || [r[3], String(r[3]).split('-')[0]])[1];
    if (d.indent) r[2] = smpD_(d.indent) || r[2];
    let delta = 0;
    if (d.qty != null) {
      const nq = Math.round(Number(d.qty)); if (!(nq > 0 && nq <= 5000)) return { ok: false, error: 'Qty must be 1 - 5000' };
      if (nq !== old) { if (!smpOpen_(String(r[14]))) return { ok: false, error: 'Qty of a closed sample cannot be changed' }; delta = nq - old; r[13] = nq; }
    }
    r[21] = now; rg.setValues([r]);
    ss.getSheetByName('Moves').appendRow([now, date < st.live ? st.live : date, String(p.id), 'EDIT', r[14], r[14], r[15], r[13], delta, delta ? 'Qty ' + old + ' -> ' + r[13] : 'Details corrected', by]);
    return { ok: true };
  });
}

function smpDaily_(p) {
  const by = smpUser_(p); if (!by) return { ok: false, error: 'signin' };
  const st = smpSettings_(); let date; try { date = smpDateOk_(p, st); } catch (e) { return { ok: false, error: e.message }; }
  const t = Math.round(Number(p.tailors)), m = Math.max(0, Math.round(Number(p.mock) || 0));
  if (!(t >= 0 && t <= 300)) return { ok: false, error: 'Enter tailors present' };
  return smpLock_(() => {
    const sh = smpSs_().getSheetByName('Daily'), n = sh.getLastRow() - 1;
    const row = [date, t, m, smpS_(p.note, 200), by, smpNow_()];
    if (n > 0) { const ds = sh.getRange(2, 1, n, 1).getValues(); const i = ds.findIndex(r => smpD_(r[0]) === date); if (i > -1) { sh.getRange(i + 2, 1, 1, 6).setValues([row]); return { ok: true }; } }
    sh.appendRow(row); return { ok: true };
  });
}

/* ---------------- report ---------------- */
function smpReport_(p) {
  const date = smpD_(p.date) || smpToday_();
  const key = 'smp_rep_' + date + '_' + smpVer_(), c = CacheService.getScriptCache(), hit = c.get(key);
  if (hit && !p.fresh) return JSON.parse(hit);
  const out = smpBuild_(date);
  try { c.put(key, JSON.stringify(out), 300); } catch (e) {}
  return out;
}

function smpBuild_(date) {
  const st = smpSettings_();
  const samples = {}; smpVals_('Samples').forEach(r => { const o = smpRowObj_(r); samples[o.id] = o; });
  const moves = smpVals_('Moves').map(r => ({ t: smpT_(r[0]), d: smpD_(r[1]), id: String(r[2]), a: String(r[3]), from: String(r[4]), s: String(r[5]), sub: String(r[6]), q: Number(r[7]) || 0, dq: Number(r[8]) || 0 }))
    .filter(m => m.d && m.id).sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : a.t < b.t ? -1 : a.t > b.t ? 1 : 0);
  const byId = {}; moves.forEach(m => (byId[m.id] = byId[m.id] || []).push(m));
  const daily = {}; smpVals_('Daily').forEach(r => { daily[smpD_(r[0])] = { t: Number(r[1]) || 0, m: Number(r[2]) || 0 }; });
  function stateAt(id, d) { const L = byId[id] || []; let s = null; for (let i = 0; i < L.length && L[i].d <= d; i++) s = L[i]; return s; }

  // ---- day list: history days + live days with activity, up to the date ----
  const hist = smpVals_('History').map(r => ({ d: smpD_(r[0]), op: +r[1] || 0, rc: +r[2] || 0, ho: +r[3] || 0, cx: +r[4] || 0, ts9: +r[5] || 0, wip: +r[6] || 0, tl: String(r[7] || '') }))
    .filter(h => h.d && h.d < st.live && h.d <= date);
  const act = {}; moves.forEach(m => { if (m.a !== 'IMPORT' && m.d >= st.live && m.d <= date) act[m.d] = 1; });
  Object.keys(daily).forEach(d => { if (d >= st.live && d <= date) act[d] = 1; });
  if (date >= st.live) act[date] = 1;
  const live = Object.keys(act).sort();
  let prevWip = hist.length ? hist[hist.length - 1].wip : 0;
  const days = hist.slice();
  live.forEach(d => {
    let rc = 0, ho = 0, cx = 0, ts9 = 0;
    moves.forEach(m => {
      if (m.d !== d || m.a === 'IMPORT') return;
      if (m.a === 'NEW') rc += m.dq; else if (m.a === 'EDIT') rc += m.dq;
      const k = SMP_CLOSE[m.s];
      if ((m.a === 'MOVE' || m.a === 'SPLIT-IN') && k && smpOpen_(m.from)) { if (k === 'ho') ho += m.q; else if (k === 'cx') cx += m.q; else ts9 += m.q; }
      if (m.a === 'REOPEN') { const k2 = SMP_CLOSE[m.from]; if (k2 === 'ho') ho -= m.q; else if (k2 === 'cx') cx -= m.q; else if (k2 === 'ts9') ts9 -= m.q; }
      if (m.a === 'SPLIT-IN' && k && !smpOpen_(m.from)) {}   // closed -> closed not counted
    });
    let wip = 0; Object.keys(byId).forEach(id => { const s = stateAt(id, d); if (s && smpOpen_(s.s)) wip += s.q; });
    const dy = daily[d], tl = dy ? 'Using ' + dy.t + (dy.m ? '+' + dy.m + ' Mock Opt' : '') : '';
    days.push({ d: d, op: prevWip, rc: rc, ho: ho, cx: cx, ts9: ts9, wip: wip, tl: tl, live: 1, gap: prevWip + rc - ho - cx - ts9 - wip });
    prevWip = wip;
  });
  const mon = date.slice(0, 7), mdays = days.filter(x => x.d.slice(0, 7) === mon);
  const sum = k => mdays.reduce((a, x) => a + (x[k] || 0), 0);
  const tdy = days.filter(x => x.d === date)[0] || { rc: 0, ho: 0 };
  const tot = { op: mdays.length ? mdays[0].op : 0, rc: sum('rc'), ho: sum('ho'), cx: sum('cx'), ts9: sum('ts9'), wip: mdays.length ? mdays[mdays.length - 1].wip : 0 };
  const avg = { rc: mdays.length ? tot.rc / mdays.length : 0, ho: mdays.length ? tot.ho / mdays.length : 0 };

  // ---- state of every sample at the end of the date ----
  const open = [];
  Object.keys(byId).forEach(id => { const s = stateAt(id, date), o = samples[id]; if (s && o && smpOpen_(s.s) && s.q > 0) open.push({ o: o, s: s.s, sub: s.sub, q: s.q }); });
  const mers = SMP_MER_ORDER.slice(); open.forEach(x => { if (mers.indexOf(x.o.m1) < 0) mers.push(x.o.m1); });
  const usedM = mers.filter(m => open.some(x => x.o.m1 === m));
  // stage x merchant
  const stage = []; SMP_STAGES.filter(s => s[1] !== 'Closed').forEach(s => {
    const v = usedM.map(m => open.filter(x => x.s === s[0] && x.o.m1 === m).reduce((a, x) => a + x.q, 0));
    if (v.some(Boolean)) stage.push({ g: s[1], s: s[0], v: v });
  });
  // buyer x group excluding sewn / on hold / awaiting
  function pivot(list, rk, ck, ord) {
    const rows = [], cols = [], m = {};
    list.forEach(x => { const r = rk(x), c = ck(x); if (rows.indexOf(r) < 0) rows.push(r); if (cols.indexOf(c) < 0) cols.push(c); m[r + '\u0001' + c] = (m[r + '\u0001' + c] || 0) + x.q; });
    const oi = c => { const i = (ord || []).map(z => z.toLowerCase()).indexOf(String(c).toLowerCase()); return i < 0 ? 999 : i; };
    cols.sort((a, b) => oi(a) - oi(b));
    return { rows: rows, cols: cols, v: rows.map(r => cols.map(c => m[r + '\u0001' + c] || 0)) };
  }
  const excl = pivot(open.filter(x => SMP_EXCL.indexOf(x.s) < 0), x => x.o.buyer, x => x.o.group, SMP_ORD_EXCL);
  // type-wise indent raised till date
  const base = date >= st.base ? smpVals_('IndentBase').map(r => ({ o: { buyer: String(r[0]), group: String(r[1]) }, q: Number(r[2]) || 0 })) : [];
  moves.forEach(m => { if ((m.a === 'NEW' || (m.a === 'EDIT' && m.dq)) && m.d > st.base && m.d <= date && samples[m.id]) base.push({ o: samples[m.id], q: m.dq }); });
  const indent = pivot(base, x => x.o.buyer, x => x.o.group, SMP_ORD_IND);
  // already sewn: sub-status x merchant
  const sewnL = open.filter(x => x.s === '1. Already Sewn'), sewM = usedM.filter(m => sewnL.some(x => x.o.m1 === m));
  const subs = []; sewnL.forEach(x => { if (subs.indexOf(x.sub) < 0) subs.push(x.sub); }); const so = smpStage_('1. Already Sewn')[2]; subs.sort((a, b) => (so.indexOf(a) + 99 * (so.indexOf(a) < 0)) - (so.indexOf(b) + 99 * (so.indexOf(b) < 0)));
  const sewn = { cols: sewM, rows: subs, v: subs.map(s => sewM.map(m => sewnL.filter(x => x.sub === s && x.o.m1 === m).reduce((a, x) => a + x.q, 0))) };

  const R = { ok: true, date: date, live: st.live, days: mdays, tot: tot, avg: avg, today: { rc: tdy.rc, ho: tdy.ho }, merchants: usedM, stage: stage,
    excl: excl, indent: indent, sewn: sewn, openQty: open.reduce((a, x) => a + x.q, 0), built: smpNow_(), mailTo: !!st.to };
  R.mail = smpMailHtml_(R);
  R.subject = st.subject.replace('{date}', smpNice_(date));
  return R;
}

function smpNice_(d) {
  const x = new Date(d + 'T12:00:00'), n = x.getDate(), s = (n % 10 === 1 && n !== 11) ? 'st' : (n % 10 === 2 && n !== 12) ? 'nd' : (n % 10 === 3 && n !== 13) ? 'rd' : 'th';
  return n + s + ' /' + Utilities.formatDate(x, smpTz_(), 'MMM-yy');
}
function smpMailHtml_(R) {
  const B = 'border:1px solid #7f7f7f;padding:3px 7px;font:13px Calibri,Arial,sans-serif;', H = B + 'background:#dce6f1;font-weight:bold;text-align:center;', N = B + 'text-align:right;';
  const f = v => v ? Math.round(v).toLocaleString('en-IN') : '-';
  const day = d => { const x = new Date(d + 'T12:00:00'), n = x.getDate(); return n + ((n % 10 === 1 && n !== 11) ? 'st' : (n % 10 === 2 && n !== 12) ? 'nd' : (n % 10 === 3 && n !== 13) ? 'rd' : 'th') + ' ' + Utilities.formatDate(x, smpTz_(), 'MMM'); };
  let h = '<div style="font:14px Calibri,Arial,sans-serif;color:#000">Dear sir,<br><br>Following is the status of sampling as on today.<br>Today ' + R.today.ho + ' samples are handed over.<br>Today ' + R.today.rc +
    ' Indent received samples.<br><br>Month Avg. indent received ' + Math.round(R.avg.rc) + '<br>Month Avg. Handover ' + Math.round(R.avg.ho) + '<br><br>';
  // 1. WIP summary
  h += '<table style="border-collapse:collapse"><tr><th colspan="7" style="' + H + '">Summary of WIP garment @ sampling (Date ' + smpNice_(R.date) + ' )</th></tr>' +
    '<tr><th style="' + H + '">Date</th><th style="' + H + '">Opening Balance</th><th style="' + H + '">Indent Recvd tdy</th><th style="' + H + '">Handover to merchant</th><th style="' + H + '">Indent Cancel/Rejected</th><th style="' + H + '">WIP @ Sampling</th><th style="' + H + '">Tailors Present</th></tr>' +
    '<tr><td style="' + B + '"></td><td style="' + H + '">A</td><td style="' + H + '">B</td><td style="' + H + '">C</td><td style="' + H + '">E</td><td style="' + B + '"></td><td style="' + B + '"></td></tr>';
  R.days.forEach(x => { h += '<tr><td style="' + N + '">' + day(x.d) + '</td><td style="' + N + '">' + f(x.op) + '</td><td style="' + N + '">' + f(x.rc) + '</td><td style="' + N + '">' + f(x.ho) + '</td><td style="' + N + '">' + f(x.cx + x.ts9) + '</td><td style="' + N + '">' + f(x.wip) + '</td><td style="' + B + '">' + (x.tl || '') + '</td></tr>'; });
  h += '<tr><td style="' + B + 'font-weight:bold">Total</td><td style="' + N + 'font-weight:bold">' + f(R.tot.op) + '</td><td style="' + N + 'font-weight:bold">' + f(R.tot.rc) + '</td><td style="' + N + 'font-weight:bold">' + f(R.tot.ho) + '</td><td style="' + N + 'font-weight:bold">' + f(R.tot.cx + R.tot.ts9) + '</td><td style="' + N + 'font-weight:bold">' + f(R.tot.wip) + '</td><td style="' + B + '"></td></tr>' +
    '<tr><td style="' + B + 'font-weight:bold">This Month Avg/day</td><td style="' + B + '"></td><td style="' + N + 'font-weight:bold">' + R.avg.rc.toFixed(2) + '</td><td style="' + N + 'font-weight:bold">' + R.avg.ho.toFixed(2) + '</td><td style="' + B + '" colspan="3"></td></tr></table><br>';
  // 2. stage x merchant
  const M = R.merchants;
  h += '<table style="border-collapse:collapse"><tr><th style="' + H + '">Stage</th><th style="' + H + '">process1</th>' + M.map(m => '<th style="' + H + '">' + m + '</th>').join('') + '<th style="' + H + '">Grand Total</th></tr>';
  const gt = M.map(() => 0); let G = 0, lastG = null, gsum = null;
  function gTot() { if (!gsum) return ''; const t = gsum.reduce((a, b) => a + b, 0); return '<tr><td style="' + H + 'text-align:left">' + lastG + ' Total</td><td style="' + H + '"></td>' + gsum.map(v => '<td style="' + N + 'background:#dce6f1;font-weight:bold">' + (v || '') + '</td>').join('') + '<td style="' + N + 'background:#dce6f1;font-weight:bold">' + t + '</td></tr>'; }
  R.stage.forEach(r => {
    if (r.g !== lastG) { h += gTot(); lastG = r.g; gsum = M.map(() => 0); h += ''; }
    const t = r.v.reduce((a, b) => a + b, 0); r.v.forEach((v, i) => { gsum[i] += v; gt[i] += v; }); G += t;
    h += '<tr><td style="' + B + 'font-weight:bold">' + (gsum.every((v, i) => v === r.v[i]) ? r.g : '') + '</td><td style="' + B + '">' + r.s + '</td>' + r.v.map(v => '<td style="' + N + '">' + (v || '') + '</td>').join('') + '<td style="' + N + '">' + t + '</td></tr>';
  });
  h += gTot() + '<tr><td style="' + H + 'text-align:left">Grand Total</td><td style="' + H + '"></td>' + gt.map(v => '<td style="' + N + 'background:#dce6f1;font-weight:bold">' + v + '</td>').join('') + '<td style="' + N + 'background:#dce6f1;font-weight:bold">' + G + '</td></tr></table><br>';
  // 3 & 4 pivots
  function piv(title, P, sub) {
    const ct = P.cols.map((c, j) => P.v.reduce((a, r) => a + r[j], 0)), all = ct.reduce((a, b) => a + b, 0);
    let x = '<b style="font:bold 14px Calibri,Arial">' + title + '</b><br><table style="border-collapse:collapse;margin-top:4px"><tr><th style="' + H + '"></th><th colspan="' + (P.cols.length + 1) + '" style="' + H + '">' + sub + '</th></tr><tr><th style="' + H + 'text-align:left">BUYER</th>' +
      P.cols.map(c => '<th style="' + H + '">' + c + '</th>').join('') + '<th style="' + H + '">Grand Total</th></tr>';
    P.rows.forEach((r, i) => { x += '<tr><td style="' + B + '">' + r + '</td>' + P.v[i].map(v => '<td style="' + N + '">' + (v || '') + '</td>').join('') + '<td style="' + N + '">' + P.v[i].reduce((a, b) => a + b, 0) + '</td></tr>'; });
    return x + '<tr><td style="' + H + 'text-align:left">Grand Total</td>' + ct.map(v => '<td style="' + N + 'background:#dce6f1;font-weight:bold">' + v + '</td>').join('') + '<td style="' + N + 'background:#dce6f1;font-weight:bold">' + all + '</td></tr></table><br>';
  }
  h += piv('Summery excluding Already Sewn, on hold and Awaiting to dispatch', R.excl, 'Type of Sample 1');
  h += piv('Type Wise Indent Raised', R.indent, 'Type Wise Indent Raised ( Till Date )');
  // 5. sewn status
  const S = R.sewn, sct = S.cols.map((c, j) => S.v.reduce((a, r) => a + r[j], 0));
  h += '<b style="font:bold 14px Calibri,Arial">Following is the status of samples which have already been sewing.</b><br><table style="border-collapse:collapse;margin-top:4px"><tr><th style="' + H + 'text-align:left">Row Labels</th>' + S.cols.map(c => '<th style="' + H + '">' + c + '</th>').join('') + '<th style="' + H + '">Grand Total</th></tr>';
  S.rows.forEach((r, i) => { h += '<tr><td style="' + B + '">' + r + '</td>' + S.v[i].map(v => '<td style="' + N + '">' + (v || '') + '</td>').join('') + '<td style="' + N + '">' + S.v[i].reduce((a, b) => a + b, 0) + '</td></tr>'; });
  h += '<tr><td style="' + H + 'text-align:left">Grand Total</td>' + sct.map(v => '<td style="' + N + 'background:#dce6f1;font-weight:bold">' + v + '</td>').join('') + '<td style="' + N + 'background:#dce6f1;font-weight:bold">' + sct.reduce((a, b) => a + b, 0) + '</td></tr></table><br>Regards</div>';
  return h;
}

function smpMail_(p) {
  const by = smpUser_(p); if (!by) return { ok: false, error: 'signin' };
  const st = smpSettings_(); if (!st.to) return { ok: false, error: 'Add the mail list first: TSPL_Sampling_Tracker > Settings > "Mail to"' };
  const R = smpBuild_(smpD_(p.date) || smpToday_());
  if (MailApp.getRemainingDailyQuota() < 2) return { ok: false, error: 'Daily mail limit reached - please send tomorrow or copy the mail' };
  MailApp.sendEmail({ to: st.to, cc: st.cc, subject: R.subject, htmlBody: R.mail, name: 'TSPL Sampling' });
  smpSs_().getSheetByName('Moves').appendRow([smpNow_(), smpToday_(), '-', 'MAIL', '', '', '', 0, 0, 'Daily mail sent for ' + R.date + ' to ' + st.to, by]);
  return { ok: true, to: st.to };
}

/** run once from the editor after pasting: checks the sheet and the report */
function smpTest() { const r = smpBuild_('2026-11-25'); Logger.log(JSON.stringify({ wip: r.tot.wip, rc: r.tot.rc, ho: r.tot.ho, open: r.openQty, stage: r.stage.length, excl: r.excl.rows.length, indent: r.indent.rows.length })); }
