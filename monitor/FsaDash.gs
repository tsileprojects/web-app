/* ================= FSA DASHBOARD feed (?action=fsa_dash) =================
 * Read-only. Source: 00_FSA_C_Datamaster_7 / FSA_DM_7 (one row per defect line, AW = 1 once per report).
 * Builds compact aggregates the portal page filters by factory, audit type, buyer, day and month.
 * Cached 6 h; rebuilt in the background when older than 10 minutes. */
const FSAD = { id: '1_PPSVI0IBkLGmEJRPA1ioA2KBSLdJlNKFxEI3k7V1f8', sheet: 'FSA_DM_7', from: '2025-08-01', dayWindow: 120, detailDays: 45 };

function fsadCsv_(tq) {
  const url = 'https://docs.google.com/spreadsheets/d/' + FSAD.id + '/gviz/tq?tqx=out:csv&sheet=' + encodeURIComponent(FSAD.sheet) + '&tq=' + encodeURIComponent(tq);
  const r = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
  const b = r.getContentText();
  if (r.getResponseCode() !== 200 || /^\s*</.test(b)) throw new Error('FSA sheet query failed (' + r.getResponseCode() + ')');
  const d = Utilities.parseCsv(b); return d.slice(1);
}
function fsadType_(t) {
  t = String(t || '').trim().toLowerCase();
  if (t === 'fsa' || t === 'fsa / final') return 'FSA';
  if (t === 're-fsa') return 'Re-FSA';
  if (t === 'final') return 'Final';
  if (t === 're-final') return 'Re-Final';
  if (t === 'dupro') return 'DUPRO';
  if (t === 'carton audit') return 'Carton';
  if (/review|pilot/.test(t)) return 'Reviews';
  if (/100%/.test(t)) return '100% Check';
  return 'Other';
}
function fsadBuyer_(b) {
  b = String(b || '').trim(); const l = b.toLowerCase();
  if (/^aeo/.test(l)) return /knit/.test(l) ? 'AEO Knits' : /woven/.test(l) ? 'AEO Woven' : 'AEO';
  if (/haddad/.test(l)) return 'A&F Haddad';
  if (!b) return 'Unknown';
  return b.replace(/\b\w/g, c => c.toUpperCase());
}
function fsadDate_(s) { const m = String(s).match(/^(\d{1,2})-(\w{3})-(\d{2,4})$/); if (m) { const d = new Date(m[2] + ' ' + m[1] + ', ' + (m[3].length === 2 ? '20' + m[3] : m[3])); return isNaN(d) ? null : Utilities.formatDate(d, 'Asia/Kolkata', 'yyyy-MM-dd'); }
  const d = new Date(s); return isNaN(d) ? null : Utilities.formatDate(d, 'Asia/Kolkata', 'yyyy-MM-dd'); }
function fsadN_(v) { const n = parseFloat(String(v).replace(/[,\s]/g, '')); return isNaN(n) ? 0 : n; }

function fsadBuild_() {
  const today = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd');
  const dayFrom = Utilities.formatDate(new Date(Date.now() - FSAD.dayWindow * 864e5), 'Asia/Kolkata', 'yyyy-MM-dd');
  const detFrom = Utilities.formatDate(new Date(Date.now() - FSAD.detailDays * 864e5), 'Asia/Kolkata', 'yyyy-MM-dd');
  // report level: D E F G H I K L M R S V AN AU AV
  const rows = fsadCsv_("select D,E,F,G,H,I,K,L,M,R,S,V,AN,AU,AV where AW = 1 and D >= date '" + FSAD.from + "'");
  const M = {}, D = {}, A = {}, det = [], poSeen = {};
  const add = (map, key, r, po) => {
    const o = map[key] || (map[key] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]); // n pass fail offered sample major minor failQty orderQty passQty
    o[0]++; if (r.res === 'PASS') { o[1]++; o[9] += r.off; } else if (r.res === 'FAIL') { o[2]++; o[7] += r.off; }
    o[3] += r.off; o[4] += r.smp; o[5] += r.maj; o[6] += r.min;
    const pk = key + '|' + po; if (po && !poSeen[pk]) { poSeen[pk] = 1; o[8] += r.ord; }
  };
  rows.forEach(x => {
    const d = fsadDate_(x[0]); if (!d || d > today) return;
    const unit = String(x[2]).trim().toUpperCase().replace(/^AP$/, 'AP2'); if (!unit) return;
    const r = { res: String(x[12]).trim().toUpperCase(), off: fsadN_(x[10]), smp: fsadN_(x[11]), maj: fsadN_(x[13]), min: fsadN_(x[14]), ord: fsadN_(x[9]) };
    const type = fsadType_(x[5]), buyer = fsadBuyer_(x[6]), po = String(x[8] || x[7] || '').trim().toUpperCase();
    add(M, d.slice(0, 7) + '|' + unit + '|' + type + '|' + buyer, r, po);
    if (d >= dayFrom) add(D, d + '|' + unit + '|' + type + '|' + buyer, r, po);
    const aud = String(x[4]).trim() || 'Unknown';
    const ak = d.slice(0, 7) + '|' + unit + '|' + aud, a = A[ak] || (A[ak] = [0, 0, 0, 0]); a[0]++; if (r.res === 'PASS') a[1]++; else if (r.res === 'FAIL') a[2]++; a[3] += r.off;
    if (d >= detFrom) det.push([d, String(x[1]), unit, '', aud, type, buyer, String(x[7]).trim(), String(x[8]).trim(), r.ord, r.off, r.smp, r.res, r.maj, r.min]);
  });
  det.sort((a, b) => a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : (+b[1] || 0) - (+a[1] || 0));
  // defects: month x unit x type x defect type x category
  const dr = fsadCsv_("select year(D), month(D), F, I, AY, AX, sum(BB), sum(BD) where D >= date '" + FSAD.from + "' and (BB > 0 or BD > 0) group by year(D), month(D), F, I, AY, AX");
  const raw = {}, CAT = {}, tot = {};
  dr.forEach(x => {
    const mk = x[0] + '-' + ('0' + (+x[1] + 1)).slice(-2), unit = String(x[2]).trim().toUpperCase().replace(/^AP$/, 'AP2'), ty = fsadType_(x[3]);
    let dt = String(x[4]).replace(/\s+/g, ' ').trim(); dt = dt ? dt.charAt(0).toUpperCase() + dt.slice(1).toLowerCase() : 'Others';
    const cat = String(x[5]).trim() || '-', mj = fsadN_(x[6]), mn = fsadN_(x[7]);
    const k = mk + '|' + unit + '|' + dt, o = raw[k] || (raw[k] = [0, 0]); o[0] += mj; o[1] += mn;
    const ck = mk + '|' + unit + '|' + cat; CAT[ck] = (CAT[ck] || 0) + mj + mn;
    tot[mk + '|' + dt] = (tot[mk + '|' + dt] || 0) + mj + mn;
  });
  // keep the 12 most frequent defect types of each month, the rest become "Others"
  const keep = {}, byM = {};
  Object.keys(tot).forEach(k => { const p = k.split('|'); (byM[p[0]] = byM[p[0]] || []).push([p[1], tot[k]]); });
  Object.keys(byM).forEach(m => byM[m].sort((a, b) => b[1] - a[1]).slice(0, 12).forEach(x => { keep[m + '|' + x[0]] = 1; }));
  const DF = {};
  Object.keys(raw).forEach(k => { const p = k.split('|'), nk = keep[p[0] + '|' + p[2]] ? k : p[0] + '|' + p[1] + '|Others', o = DF[nk] || (DF[nk] = [0, 0]); o[0] += raw[k][0]; o[1] += raw[k][1]; });
  return { builtAt: Date.now(), generated: Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd-MMM-yyyy HH:mm'), today: today, dayFrom: dayFrom, detFrom: detFrom,
    month: M, day: D, aud: A, def: DF, cat: CAT, det: det,
    fields: ['audits', 'pass', 'fail', 'offered', 'sample', 'major', 'minor', 'failQty', 'orderQty', 'passQty'] };
}

function fsaDash_(p) {
  const c = CacheService.getScriptCache();
  if (!(p && p.fresh)) {
    const n = c.get('fsad_n');
    if (n) { const keys = []; for (let i = 0; i < +n; i++) keys.push('fsad_' + i); const g = c.getAll(keys); let s = '';
      for (let i = 0; i < keys.length; i++) { if (g[keys[i]] == null) { s = null; break; } s += g[keys[i]]; }
      if (s) return JSON.parse(s); }
  }
  const out = fsadBuild_(); const js = JSON.stringify(out);
  try { const parts = {}; let k = 0; for (let i = 0; i < js.length; i += 95000) parts['fsad_' + (k++)] = js.slice(i, i + 95000); parts.fsad_n = String(k); c.putAll(parts, 21600); } catch (e) {}
  return out;
}
