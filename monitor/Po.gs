/**
 * ==============================================================
 *  PO TRACKER (Nov 2026) - buyer > product > colour > PO, with live DPR
 *  (part of TSPL Error Monitor)
 *   ?action=po_view&buyer=Primark[&fresh=1]
 *  Reads the buyer's PO plan Google Sheet (PO blocks with PO NO / COLOUR / QTY /
 *  CUT / STITCH / IRON / PACK / FSA / F I, optional Fty, Del, Priority), adds the
 *  DPR sewing output for the mapped styles, and checks every PO against its ship date.
 *  Read-only: never writes to the plan sheet or the DPR.
 * ==============================================================
 */
const PO_BUYERS = {
  Primark: {
    id: '1wftJYIXpeR4Sm96TztZYCCb3m80mLfzZ3PaStbLIias',   // "TSPL PO Plan - Primark (live)"
    dprBuyer: 'rimark',                                    // DPR column G contains this
    since: '2026-08-01',                                   // DPR output counted from this date
    map: [   // sheet (+ TOP/BTM part) -> product name + DPR style(s). Same DPR style + colour = one shared pool.
      { sheet: 'Beach Shirt PO wise', product: 'Beach Shirt', dpr: ['# Beach Shirt'] },
      { sheet: 'Trouser PO wise', product: 'Beach Trouser', dpr: ['# Beach Trouser'] },
      { sheet: 'BEach Stripe Trousers', product: 'Beach Stripe Trouser', dpr: ['# Beach Stripe Trouser'] },
      { sheet: 'BEach Stripe Top', product: 'Beach Stripe Top', dpr: [] },
      { sheet: 'Flannel Top & Btm 100k', part: 'TOP', product: 'Flannel PJ Top', dpr: [] },
      { sheet: 'Flannel Top & Btm 100k', part: 'BTM', product: 'Flannel PJ Btm', dpr: ['# FLANNEL PJ BTM'] },
      { sheet: 'SW1990 Shell print Tie top', product: 'SW1990 Shell Print Tie Top', dpr: ['# SW 1990 26 Tie Top'] },
      { sheet: 'SW1545 PRTD SHORTS', product: 'SW1545 Printed Shorts', dpr: ['# SW 1545 26 Shorts'] },
      { sheet: 'Knits Shirt & Shorts 21k', part: 'TOP', product: 'Knits Shirt (Top)', dpr: ['# PJ TOP'] },
      { sheet: 'Knits Shirt & Shorts 21k', part: 'BTM', product: 'Knits Shorts (Btm)', dpr: ['# RIBED BTM'] },
      { sheet: 'Rib Top & BTM PO', product: 'Ribbed Stripe Top & Btm (sets)', dpr: ['# RIBED Stripe TOP', '# RIBED Stripe BTM'] },
      { sheet: 'Rib Top & BTM 50k AIR qty', product: 'Ribbed Stripe Top & Btm - AIR', dpr: ['# RIBED Stripe TOP', '# RIBED Stripe BTM'] }
    ]
  },
  AEO: {
    id: '1oHITcWzGeyRyVZ6aZb4juZbOu87nx6wNm8BI03U0y-k',   // "TSPL PO Plan - AEO (live)" (SPRING 27 delivery update)
    format: 'ho',          // one tab per day: STYLE NO / PO NO / DESTINATION / MODE / HO DATE / TOTAL / CUT / STITCH / FINISH ... - the LAST tab is read
    dprBuyer: 'AEO',
    dprMatch: 'number',    // DPR style "# 5110 Spring 25" belongs to style 5110 (any season)
    since: '2026-10-01',
    map: []
  },
  Matalan: {
    id: '12TgbPya8D54t5jyPUEhSucCTgHcqr1sTYeE1bHsccrw',   // "TSPL PO Plan - Matalan (live)" (line plan, one tab per style)
    format: 'lp',          // every style tab: STYLE NO / DES (Top, BTM) / PO NO / Dest or Colour / HO DATE / QTY / FTY / FI / CUT / STITCH / IRON / PACK / FSA / REMARKS
    skipTabs: /^sheet\d*$/i,
    dprBuyer: 'Matalan',
    dprMatch: 'code',      // DPR "# L38S27061 TOP" = style L38S27061, top half of the set; colours are not matched (DPR colour names differ)
    poolByStyle: true,
    alias: { L38W27061: 'L38S27061' },   // DPR style typed as L38W27061 is the Spring 27 L38S27061 (coral / cream)
    since: '2026-08-01',
    map: []
  },
  Evsyle: {
    id: '1Z4uWx_sLuHIOpsBgDLKF40nwHW1PHVdojvv_3CMrDow',   // "TSPL PO Plan - Evsyle (live)" (Disney + Greg Norman, one tab per style group)
    format: 'lp',          // every tab: Style # / Color / PO.NO / Dest / QTY / CUT / STITCH / IRON / PACK / FSA / F I (= ship) / Rev F I
    skipTabs: /^sheet\d*$/i,
    poRe: /^(TBA|(?=.*\d{3})[A-Z0-9][A-Z0-9 \/.-]{3,})$/,   // POs here: 9736222, CF469, TL117697, MO24348383, DCL-9747047 ...
    productByTab: true,    // a tab = one product line (several style nos, summed); colour row = style no + colour
    noSetGuess: true,
    dprBuyer: ['Disney', 'Greg Norman', 'Aarsan'],
    dprMatch: 'code',      // DPR "# DISNEY 1000137300/301/302" = style 1000137300
    alias: { '100013810': '1000138310', '100017083': '1000117083' },   // style nos typed short in the DPR
    poolByStyle: true, sumDpr: true,
    since: '2026-08-01',
    map: []
  }
};
const PO_FINISH_DAYS = 2;           // sewing must finish this many working days before the ship date
const PO_DONE = /insp\s*clr|t\s*\/\s*o(ut)?$|shipped|dispatch|^rfi$|^rts$/i;   // RFI / RTS = packed, ready for inspection / to ship; T/O = taken out

function poKeyCol_(c) { return String(c || '').toUpperCase().replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim(); }
function poNum_(v) { if (v instanceof Date) return null; const n = Number(v); return v === '' || v === null || isNaN(n) ? null : Math.round(n); }   // a date typed in a qty column is not a qty
function poYmd_(d) { return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd'); }

/** every PO line in the plan workbook */
function poParse_(cfg) {
  if (cfg.format === 'ho') return poParseHo_(cfg);
  if (cfg.format === 'lp') return poParseLp_(cfg);
  const KEYS = { 'fty': 'fty', 'po no': 'po', 'colour': 'colour', 'color': 'colour', 'qty': 'qty', 'del': 'del', 'cut': 'cut', 'stitch': 'stitch',
    'iron': 'iron', 'pack': 'pack', 'fsa': 'fsa', 'f i': 'fi', 'priority': 'priority', 'remarks': 'remarks' };
  const out = [], issues = [], seen = {};
  SpreadsheetApp.openById(cfg.id).getSheets().forEach(sh => {
    const rows = sh.getDataRange().getValues();
    rows.forEach((row, ri) => {
      const cells = row.map(c => String(c === null ? '' : c).trim().toLowerCase());
      cells.forEach((c, ci) => {
        if (c !== 'po no') return;
        const start = ci > 0 && cells[ci - 1] === 'fty' ? ci - 1 : ci, hdr = {};
        for (let k = start; k < Math.min(start + 14, cells.length); k++) {
          const h = cells[k];
          if (KEYS[h] && !(KEYS[h] in hdr)) hdr[KEYS[h]] = k; else if (h === '' && k > ci + 3) break;
        }
        const above = ri > 0 ? String(rows[ri - 1][start] || '').trim().toUpperCase() : '';
        const part = /^(TOP|BTM|BOTTOM|SHORTS)$/.test(above) ? (above === 'BOTTOM' ? 'BTM' : above) : '';
        const m = cfg.map.filter(x => x.sheet === sh.getName() && (x.part || '') === (part === 'SHORTS' ? '' : part))[0] ||
                  cfg.map.filter(x => x.sheet === sh.getName())[0];
        if (!m) { issues.push('Sheet "' + sh.getName() + '"' + (part ? ' ' + part : '') + ' is not linked to a product yet'); return; }
        for (let r = ri + 1; r < rows.length; r++) {
          const R = rows[r], g = k => k in hdr ? R[hdr[k]] : '';
          const po = String(g('po') || '').trim();
          if (po.toLowerCase() === 'po no') break;
          if (!/^[A-Z]\d{6,}$/.test(po)) continue;
          const del = g('del') instanceof Date ? g('del') : null, fi = g('fi');
          const ship = del || (fi instanceof Date ? fi : null);
          const x = { product: m.product, dpr: m.dpr, fty: String(g('fty') || '').trim().toUpperCase().replace(/^AP$/, 'AP2'), po: po,
            colour: String(g('colour') || '').trim().toUpperCase(), qty: poNum_(g('qty')) || 0, cut: poNum_(g('cut')), stitch: poNum_(g('stitch')),
            iron: poNum_(g('iron')), pack: poNum_(g('pack')), fsa: poNum_(g('fsa')), ship: ship ? poYmd_(ship) : '',
            status: fi instanceof Date ? '' : String(fi || '').trim(), priority: String(g('priority') || '').trim() };
          if (x.ship && (x.ship < '2026-06-01' || x.ship > '2027-12-31')) x.shipOdd = true;
          // one PO + colour can sit on several rows (size / pack splits): merge them
          const mk = m.product + '|' + po + '|' + x.colour, prev = seen[mk];
          if (!prev) { seen[mk] = x; out.push(x); continue; }
          ['qty', 'cut', 'stitch', 'iron', 'pack', 'fsa'].forEach(f => { if (x[f] !== null) prev[f] = (prev[f] || 0) + x[f]; });
          if (x.ship && (!prev.ship || x.ship < prev.ship)) { prev.ship = x.ship; prev.shipOdd = x.shipOdd; }
          if (x.status !== prev.status && (!prev.status || PO_DONE.test(prev.status))) prev.status = x.status;
          if (!prev.fty) prev.fty = x.fty;
        }
      });
    });
  });
  out.filter(x => x.shipOdd).forEach(x => { x.note0 = 'Ship date ' + x.ship + ' in the plan looks wrong'; issues.push(x.product + ' PO ' + x.po + ' ' + x.colour + ': ship date ' + x.ship + ' looks wrong - please correct it in the plan sheet'); x.ship = ''; });
  return { lines: out, issues: issues };
}

/** AEO-style daily delivery update: the last tab, PO rows grouped under "dd MMM HO" headings */
function poParseHo_(cfg) {
  const out = [], issues = [], seen = {};
  const sheets = SpreadsheetApp.openById(cfg.id).getSheets(), sh = sheets[sheets.length - 1];
  const rows = sh.getDataRange().getValues();
  let hr = -1;
  for (let i = 0; i < Math.min(rows.length, 10); i++) if (rows[i].some(c => String(c).trim().toUpperCase() === 'PO NO')) { hr = i; break; }
  if (hr < 0) return { lines: [], issues: ['No "PO NO" header found on tab "' + sh.getName() + '"'], tab: sh.getName() };
  const H = {}, raw = rows[hr].map(c => String(c).trim().toUpperCase().replace(/\s+/g, ' '));
  const want = { 'STYLE NO': 'style', 'PO NO': 'po', 'DESTINATION': 'dest', 'MODE': 'mode', 'HO DATE': 'ship', 'TOTAL': 'qty', 'CUT': 'cut', 'STITCH': 'stitch',
    'FINISH': 'iron', 'CARTON PACK B': 'carton', 'FSA STATUS': 'fsa', 'REMARKS': 'status' };
  raw.forEach((h, i) => { const k = want[h] || (h.indexOf('CARTON PACK') === 0 ? 'carton' : ''); if (k && !(k in H)) H[k] = i; });
  const asOn = raw.map((h, i) => /^AS ON|PPD/.test(h) ? i : -1).filter(i => i >= 0);   // revised / planned dates, latest column last
  for (let r = hr + 1; r < rows.length; r++) {
    const R = rows[r], g = k => k in H ? R[H[k]] : '';
    const po = String(g('po') || '').replace(/[^0-9A-Za-z]/g, ''), style = String(g('style') || '').trim();
    if (!/^\d{5,}$/.test(po) || !style) continue;
    const ship = g('ship') instanceof Date ? poYmd_(g('ship')) : '';
    const carton = poNum_(g('carton')), fsa = poNum_(g('fsa'));
    const x = { product: 'Style ' + style, dpr: [style], fty: '', po: po, colour: 'ALL', qty: poNum_(g('qty')) || 0, cut: poNum_(g('cut')), stitch: poNum_(g('stitch')),
      iron: poNum_(g('iron')), pack: carton || fsa ? Math.max(carton || 0, fsa || 0) : null, fsa: fsa, ship: ship,
      status: String(g('status') || '').trim().replace(/^T\/0$/i, 'T/O'), priority: [String(g('dest') || '').trim(), String(g('mode') || '').trim()].filter(Boolean).join(' · ') };
    if (/^rts$/i.test(x.status)) x.status = 'RTS';
    const rev = asOn.map(i => R[i]).filter(v => v instanceof Date).pop();
    if (rev && poYmd_(rev) !== ship) x.priority += (x.priority ? ' · ' : '') + 'revised ' + Utilities.formatDate(rev, Session.getScriptTimeZone(), 'dd-MMM');
    if (!ship) x.note0 = 'No HO date in the plan';
    const mk = x.product + '|' + po + '|' + x.priority, prev = seen[mk];
    if (!prev) { seen[mk] = x; out.push(x); continue; }
    ['qty', 'cut', 'stitch', 'iron', 'pack', 'fsa'].forEach(f => { if (x[f] !== null) prev[f] = (prev[f] || 0) + x[f]; });
    if (x.status !== prev.status && (!prev.status || PO_DONE.test(prev.status))) prev.status = x.status;
  }
  return { lines: out, issues: issues, tab: sh.getName() };
}

/** Matalan-style line plan: one tab per style, PO rows under a "STYLE NO ... PO NO" header, Top / BTM rows = one set */
/** style code used to match the DPR: "# DISNEY 1000137300/301" -> 1000137300, "DCL -1000145297" -> 1000145297, "ASS27OG13" -> ASS270G13 */
function poCode_(s, cfg) {
  s = String(s || '').toUpperCase();
  const tok = s.replace(/[#\/]/g, ' ').replace(/-(?=\d)/g, ' ').split(/\s+/).filter(t => /\d/.test(t) && t.replace(/[^A-Z0-9]/g, '').length >= 6)[0] || s;
  const c0 = tok.replace(/[^A-Z0-9]/g, '').replace(/O/g, '0');
  return (cfg && cfg.alias || {})[c0] || c0;
}

function poParseLp_(cfg) {
  const out = [], issues = [], tz = Session.getScriptTimeZone();
  const norm = h => String(h || '').toUpperCase().replace(/[^A-Z]/g, '');
  const isD = v => v instanceof Date && !isNaN(v);
  const done = s => /t\s*[\/.]\s*o(ut)?\b|insp\w*\s*cl|^ready|^rts$|^rfi$|shipped|dispatch/i.test(String(s || '').trim());
  SpreadsheetApp.openById(cfg.id).getSheets().forEach(sh => {
    const name = sh.getName(); if (cfg.skipTabs && cfg.skipTabs.test(name)) return;
    const rows = sh.getDataRange().getValues();
    let hr = -1;
    for (let i = 0; i < Math.min(rows.length, 8); i++) { const h = rows[i].map(norm); if (h.indexOf('PONO') > -1 && (h.indexOf('STYLENO') > -1 || h.indexOf('STYLE') > -1 || h.indexOf('QTY') > -1)) { hr = i; break; } }
    if (hr < 0) return;
    const h = rows[hr].map(norm), C = {}, fi = [];
    h.forEach((x, i) => {
      const k = { STYLENO: 'style', STYLE: 'style', PONO: 'po', DES: 'part', DESC: 'part', DEST: 'colour', COLOUR: 'colour', COLOR: 'colour', HODATE: 'ship', DEL: 'ship',
        QTY: 'qty', FTY: 'fty', CUT: 'cut', STITCH: 'stitch', IRON: 'iron', PACK: 'pack', FSA: 'fsa', REMARKS: 'rem', REVFI: 'rev' }[x];
      if (k && !(k in C)) C[k] = i;
      if (x === 'FI') fi.push(i);
      if (/^REVFI/.test(x) && !('rev' in C)) C.rev = i;
    });
    if (!('ship' in C) && fi.length) C.ship = fi.shift();   // old tabs: first "F I" column is the hand-over date
    if (fi.length) C.fi = fi[fi.length - 1];
    if (!('po' in C) || !('qty' in C)) { issues.push('Tab "' + name.trim() + '": PO NO / QTY columns not found'); return; }
    const grp = {}, order = [];
    for (let r = hr + 1; r < rows.length; r++) {
      const R = rows[r], g = k => k in C ? R[C[k]] : '';
      const po = String(g('po') || '').trim().toUpperCase().replace(/\s+/g, ' ');
      if (!(cfg.poRe || /^[A-Z]\d{6,}$/).test(po)) continue;
      const sv = g('style'), st0 = sv instanceof Date ? '' : String(sv || '').trim().toUpperCase();
      if ('style' in C && cfg.poRe && !/(?:\D*\d){3}/.test(st0)) continue;   // loose PO rule: the row must carry a real style no
      if (!('style' in C) && !/[A-Z]/i.test(String(g('colour') || ''))) continue;
      const style = st0 || (order.length ? grp[order[order.length - 1]].style : name.trim().toUpperCase().split(/\s+/)[0]);
      const colour = String(g('colour') || '').trim().toUpperCase().replace(/\s*\/\s*/g, ' / ') || 'ALL';
      const p0 = String(g('part') || '').toUpperCase(), part = /BTM|BOTTOM|SHORT|PANT|TROUSER/.test(p0) ? 'BTM' : /TOP|SHIRT/.test(p0) ? 'TOP' : '';
      const fiv = g('fi'), last = Math.max.apply(null, ['cut', 'stitch', 'iron', 'pack', 'fsa', 'fi'].filter(k => k in C).map(k => C[k])), from = 'rem' in C ? Math.min(C.rem, last + 1) : last + 1;
      const rem = R.slice(from, from + 4).filter(v => typeof v === 'string' && v.trim()).join(' ').trim();   // remarks often spill into the next columns
      const ship = isD(g('ship')) ? poYmd_(g('ship')) : '';
      const shv = g('ship'), rv = g('rev');
      const status = [!isD(fiv) && String(fiv || '').trim() ? String(fiv).trim() : '', !isD(shv) && typeof shv === 'string' && C.ship !== C.fi ? shv.trim() : '',
        !isD(rv) && typeof rv === 'string' ? rv.trim() : '', rem].filter(Boolean).join(' ');
      const k = style + '|' + po + '|' + colour;
      let G = grp[k]; if (!G) { G = grp[k] = { style: style, po: po, colour: colour, parts: {}, ship: ship, fty: '', status: [], rev: '', fiDate: '' }; order.push(k); }
      if (ship && (!G.ship || ship < G.ship)) G.ship = ship;
      const fty = String(g('fty') || '').trim().toUpperCase().replace(/\s+/g, ''); if (fty && !G.fty) G.fty = fty === 'AP' ? 'AP2' : fty;
      if (status) G.status.push(status);
      if (isD(g('rev'))) G.rev = poYmd_(g('rev'));
      if (isD(fiv)) G.fiDate = poYmd_(fiv);
      // same part twice with the same qty and no part name = the other half of a set (e.g. NW108)
      let pk = part || 'X'; if (!part && !cfg.noSetGuess && G.parts[pk] && G.parts[pk].qty === (poNum_(g('qty')) || 0) && !G.parts.Y) pk = 'Y';
      const P = G.parts[pk] = G.parts[pk] || { qty: 0, cut: null, stitch: null, iron: null, pack: null, fsa: null };
      P.qty += poNum_(g('qty')) || 0;
      ['cut', 'stitch', 'iron', 'pack', 'fsa'].forEach(f => { const v = poNum_(g(f)); if (v !== null) P[f] = (P[f] || 0) + v; });
    }
    const tabCodes = []; order.forEach(k => { const c = poCode_(grp[k].style, cfg); if (tabCodes.indexOf(c) < 0) tabCodes.push(c); });
    order.forEach(k => {
      const G = grp[k], ps = Object.keys(G.parts).map(p => G.parts[p]), names = Object.keys(G.parts);
      const set = names.indexOf('TOP') > -1 && names.indexOf('BTM') > -1 || names.indexOf('Y') > -1;
      const mn = f => ps.some(p => p[f] === null) ? (ps.every(p => p[f] === null) ? null : Math.min.apply(null, ps.map(p => p[f] || 0))) : Math.min.apply(null, ps.map(p => p[f]));
      const code = poCode_(G.style, cfg);
      const st = G.status.filter(Boolean), allDone = st.length > 0 && st.some(done) && !st.some(s => /pending|hold|\bbal\b/i.test(s));
      const byTab = cfg.productByTab, label = name.trim().replace(/\s+/g, ' ');
      const x = { product: byTab ? label : G.style + (set ? ' (set)' : ''), dpr: byTab ? tabCodes.map(c => c + '|*') : set ? [code + '|TOP', code + '|BTM'] : [code + '|*'], fty: G.fty, po: G.po,
        colour: byTab && (tabCodes.length > 1 || G.style !== label.toUpperCase()) ? G.style + (G.colour !== 'ALL' ? ' · ' + G.colour : '') : G.colour,
        qty: Math.max.apply(null, ps.map(p => p.qty)), cut: mn('cut'), stitch: mn('stitch'), iron: mn('iron'), pack: mn('pack'), fsa: mn('fsa'), ship: G.ship,
        status: allDone ? (/t\s*[\/.]\s*o/i.test(st.join(' ')) ? 'T/O' : /ready/i.test(st.join(' ')) ? 'RTS' : 'Insp clrd') : (st[0] || '').slice(0, 60),
 priority: [byTab ? '' : 'tab ' + name.trim(), G.rev && G.rev !== G.ship ? 'rev FI ' + Utilities.formatDate(new Date(G.rev + 'T12:00:00'), tz, 'dd-MMM') : (G.fiDate ? 'FI ' + Utilities.formatDate(new Date(G.fiDate + 'T12:00:00'), tz, 'dd-MMM') : '')].filter(Boolean).join(' · ') };
      if (x.ship && (x.ship < '2026-03-01' || x.ship > '2027-12-31')) { issues.push(x.product + ' PO ' + x.po + ' ' + x.colour + ': HO date ' + x.ship + ' looks wrong - please correct it in tab "' + name.trim() + '"'); x.shipOdd = true; x.note0 = 'HO date ' + x.ship + ' looks wrong'; x.ship = ''; }
      if (!x.ship && !x.note0) x.note0 = 'No HO date in the plan';
      out.push(x);
    });
  });
  return { lines: out, issues: issues };
}

/** DPR sewing output per style + colour: total since cfg.since, recent daily rate, today's lines */
function poDpr_(cfg) {
  const src = kpiSrc_('PROD'), today = tdToday_(), bw = '(' + [].concat(cfg.dprBuyer).map(b => "G contains '" + b + "'").join(' or ') + ')';
  const tot = appCsv_(src, "select H, I, D, sum(AK) where " + bw + " and C >= date '" + cfg.since + "' and E = 'Sew' group by H, I, D");
  const from = Utilities.formatDate(new Date(Date.now() - 14 * 864e5), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const day = appCsv_(src, "select H, I, C, sum(AK) where " + bw + " and C >= date '" + from + "' and E = 'Sew' group by H, I, C");
  const now = appCsv_(src, "select D, F, H, I, sum(X), sum(AK) where " + bw + " and C = date '" + today + "' and E = 'Sew' group by D, F, H, I");
  const codeKey = s => {   // "# L38S27061 TOP" -> "L38S27061|TOP"; keys already in that form pass through
    s = String(s || '').toUpperCase(); if (s.indexOf('|') > -1) return s;
    return poCode_(s, cfg) + '|' + (/\b(BTM|BOTTOM|SHORTS?|PANTS?|TROUSERS?)\b/.test(s) ? 'BTM' : /\b(TOP|SHIRT)\b/.test(s) ? 'TOP' : '');
  };
  const key = cfg.dprMatch === 'code' ? ((s, c) => codeKey(s))
            : cfg.dprMatch === 'number' ? ((s, c) => ((String(s || '').match(/\d{4,}/) || [String(s || '').trim().toUpperCase()])[0]) + '|')
                                         : ((s, c) => String(s || '').trim().toUpperCase() + '|' + poKeyCol_(c));
  const star = k => cfg.dprMatch === 'code' && k.slice(-2) !== '|*' ? [k, k.split('|')[0] + '|*'] : [k];   // code mode: also a whole-style total
  const sewn = {}, units = {}, rate = {}, lines = [];
  (tot.rows || []).forEach(x => star(key(x[0], x[1])).forEach(k => { sewn[k] = (sewn[k] || 0) + kpiNum_(x[3]); (units[k] = units[k] || {})[x[2]] = (units[k][x[2]] || 0) + kpiNum_(x[3]); }));
  const byDay = {};
  const ymd = v => { if (v instanceof Date) return poYmd_(v); const p = String(v).split(/[-\/]/); return p.length === 3 ? (p[0].length === 4 ? p[0] + '-' + ('0' + p[1]).slice(-2) + '-' + ('0' + p[2]).slice(-2) : p[2] + '-' + ('0' + p[1]).slice(-2) + '-' + ('0' + p[0]).slice(-2)) : String(v); };
  (day.rows || []).forEach(x => { const d = ymd(x[2]); star(key(x[0], x[1])).forEach(k => { (byDay[k] = byDay[k] || {})[d] = (byDay[k][d] || 0) + kpiNum_(x[3]); }); });
  Object.keys(byDay).forEach(k => {   // average of the last 6 days that had output (today counts only if it already beats yesterday's pace)
    const ds = Object.keys(byDay[k]).sort().filter(d => d !== today && byDay[k][d] > 0).slice(-6);
    rate[k] = ds.length ? Math.round(ds.reduce((a, d) => a + byDay[k][d], 0) / ds.length) : 0;
  });
  (now.rows || []).forEach(x => lines.push({ unit: x[0], line: String(x[1]), style: String(x[2] || '').trim(), colour: String(x[3] || '').trim(), tgt: kpiNum_(x[4]), pro: kpiNum_(x[5]) }));
  return { sewn: sewn, units: units, rate: rate, lines: lines, key: key };
}

function poWorkDays_(fromYmd, toYmd) {   // Mon-Sat between today (exclusive) and date (inclusive)
  let n = 0; const d = new Date(fromYmd + 'T12:00:00'), end = new Date(toYmd + 'T12:00:00');
  while (d < end) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0) n++; }
  return n;
}
function poMinusWorkDays_(ymd, n) { const d = new Date(ymd + 'T12:00:00'); while (n > 0) { d.setDate(d.getDate() - 1); if (d.getDay() !== 0) n--; } return poYmd_(d); }

/* ---------- FSA audits (00_FSA_C_Datamaster_7) - one row per defect, so reports are de-duplicated ---------- */
const PO_FSA_DM = { id: '1_PPSVI0IBkLGmEJRPA1ioA2KBSLdJlNKFxEI3k7V1f8', sheet: 'FSA_DM_7' };
function poFsaKey_(v) { return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
function poFsa_() {
  const c = CacheService.getScriptCache(), hit = poCacheGet_(c, 'po_fsa2');
  if (hit) return JSON.parse(hit);
  const since = Utilities.formatDate(new Date(Date.now() - 240 * 864e5), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const r = appCsv_(PO_FSA_DM, "select F, E, M, Q, max(S), max(AN), max(D), max(T) where D >= date '" + since + "' and M is not null group by F, E, M, Q");
  const by = {};
  (r.rows || []).forEach(x => {
    const k = poFsaKey_(x[2]); if (k.length < 5) return;
    const res = String(x[5] || '').trim().toUpperCase(), q = kpiNum_(x[4]), d = String(x[6] || '');
    const dd = (d.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/) || []), ymd = dd.length ? dd[1] + '-' + ('0' + dd[2]).slice(-2) + '-' + ('0' + dd[3]).slice(-2) : '';
    (by[k] = by[k] || []).push({ col: poKeyCol_(x[3]), q: q, t: kpiNum_(x[7]), res: res, d: ymd, unit: x[0] });
  });
  const out = { at: new Date().toISOString(), by: by, error: r.error || '' };
  poCachePut_(c, 'po_fsa2', JSON.stringify(out), 1800);
  return out;
}
/** FSA audit summary for one PO line (colour used only when the PO has audits for several colours) */
function poFsaFor_(F, po, colour, qty) {
  const keys = String(po || '').split(/[\/,&+]| and /i).map(poFsaKey_).filter(k => k.length >= 5);
  let rows = []; keys.forEach(k => { rows = rows.concat(F.by[k] || []); });
  if (!rows.length) return null;
  const cols = {}; rows.forEach(x => cols[x.col] = 1);
  if (Object.keys(cols).length > 1 && colour) {
    const want = poKeyCol_(colour), w1 = want.split(/[\s\/\-]+/)[0];
    const m = rows.filter(x => x.col === want || (w1 && x.col.split(/[\s\/\-]+/)[0] === w1));
    if (m.length) rows = m;
  }
  rows.sort((a, b) => a.d < b.d ? -1 : 1);
  const last = rows[rows.length - 1];
  // passed = the highest cumulative quantity cleared by a PASS report ("Total Offered" is cumulative; final re-audits repeat the full PO)
  const passed = rows.filter(x => x.res === 'PASS').reduce((a, x) => Math.max(a, x.q, x.t), 0);
  return { pass: qty ? Math.min(qty, passed) : passed, offered: rows.reduce((a, x) => Math.max(a, x.q, x.t), 0),
    fail: rows.filter(x => x.res === 'FAIL').length, reports: rows.length, last: last.d, lastRes: last.res };
}

function poView_(buyer, fresh) {
  buyer = buyer && PO_BUYERS[buyer] ? buyer : Object.keys(PO_BUYERS)[0];
  const cfg = PO_BUYERS[buyer], c = CacheService.getScriptCache(), ck = 'po_' + buyer;
  const hit = poCacheGet_(c, ck); if (hit && !tdFresh_(ck, fresh)) return JSON.parse(hit);
  const today = tdToday_(), P = poParse_(cfg), D = poDpr_(cfg);
  let FSA = { by: {} }; try { FSA = poFsa_(); } catch (e) {}
  P.lines.forEach(x => { const f = poFsaFor_(FSA, x.po, x.colour, x.qty); x.fa = f; x.fsaQ = f ? f.pass : (x.fsa || 0); });
  const linked = {}; (cfg.map.length ? cfg.map : P.lines).forEach(x => x.dpr.forEach(st => linked[D.key(st, '').split('|')[0]] = 1));
  const free = {}; Object.keys(D.sewn).forEach(k => { const st = k.split('|')[0]; if (!linked[st]) free[st] = (free[st] || 0) + D.sewn[k]; });
  Object.keys(free).filter(st => free[st] > 0).forEach(st => P.issues.push('DPR style "' + st + '" (' + free[st].toLocaleString() + ' pcs sewn since ' + cfg.since + ') is not linked to any PO sheet - tell us which product it belongs to'));
  // ---- shared pools: same DPR style(s) + colour. Sewn pieces are given to POs in ship-date order.
  const pools = {};
  P.lines.forEach(x => {
    const pk = (x.dpr.join('+') || ('PLAN:' + x.product)) + '|' + (cfg.poolByStyle ? '' : poKeyCol_(x.colour));
    (pools[pk] = pools[pk] || { dpr: x.dpr, colour: cfg.poolByStyle ? '' : poKeyCol_(x.colour), pos: [] }).pos.push(x);
  });
  Object.keys(pools).forEach(pk => {
    const pl = pools[pk];
    // DPR sewn for the pool: sets (top + btm) = the smaller of the two
    let dprSewn = null, rate = 0, unitSplit = {};
    if (pl.dpr.length) {
      const parts = pl.dpr.map(s => D.key(s, pl.colour));
      const agg = cfg.sumDpr ? (a => a.reduce((x, y) => x + y, 0)) : (a => Math.min.apply(null, a));   // sets: the smaller half; style groups: the sum
      dprSewn = agg(parts.map(k => D.sewn[k] || 0));
      rate = agg(parts.map(k => D.rate[k] || 0));
      parts.forEach(k => Object.keys(D.units[k] || {}).forEach(u => unitSplit[u] = Math.max(unitSplit[u] || 0, D.units[k][u])));
    }
    const planStitch = pl.pos.reduce((a, x) => a + (x.stitch || 0), 0);
    const sewnTotal = Math.max(dprSewn || 0, planStitch);
    pl.sewn = sewnTotal; pl.dprSewn = dprSewn; pl.rate = rate; pl.units = unitSplit;
    // allocate in ship order (no date last), then check each PO's cumulative need against the projection
    const order = pl.pos.slice().sort((a, b) => (a.ship || '9999') < (b.ship || '9999') ? -1 : (a.ship || '9999') > (b.ship || '9999') ? 1 : 0);
    let left = sewnTotal, cum = 0;
    order.forEach(x => {
      x.sewnEst = Math.min(x.qty, Math.max(left, 0)); left -= x.qty; cum += x.qty;
      const done = PO_DONE.test(x.status) || (x.pack !== null && x.pack >= x.qty && x.qty > 0);
      x.done = done; x.risk = 'ok'; x.note = '';
      if (done) { x.risk = 'done'; return; }
      if (!x.ship || x.shipOdd) { x.risk = 'nodate'; x.note = x.note0 || 'No ship date in the plan'; return; }
      x.daysLeft = poWorkDays_(today, x.ship) * (x.ship >= today ? 1 : -1);
      const sewBy = poMinusWorkDays_(x.ship, PO_FINISH_DAYS), wd = sewBy > today ? poWorkDays_(today, sewBy) : 0;
      const proj = sewnTotal + rate * wd, need = cum;
      x.needPerDay = wd > 0 ? Math.max(0, Math.ceil((need - sewnTotal) / wd)) : null;
      if (x.ship < today) { x.risk = 'late'; x.note = 'Ship date passed, ' + Math.max(0, x.qty - (x.pack || 0)).toLocaleString() + ' pcs not packed'; return; }
      if (sewnTotal >= need) {   // sewing covered - watch finishing
        const packLeft = x.qty - (x.pack || 0);
        if (x.daysLeft <= 1 && packLeft > 0) { x.risk = 'warn'; x.note = packLeft.toLocaleString() + ' pcs still to iron/pack'; }
        return;
      }
      if (proj < need) { x.risk = 'risk'; x.note = 'Short ' + Math.round(need - proj).toLocaleString() + ' pcs by ' + sewBy + (wd > 0 ? ' - needs ' + x.needPerDay + '/day, running ' + rate + '/day' : ' - sewing should already be finished' + (rate ? ' (running ' + rate + '/day)' : '')); }
      else if (proj < need * 1.05 || wd <= 2) { x.risk = 'warn'; x.note = 'Tight - needs ' + x.needPerDay + '/day, running ' + rate + '/day'; }
    });
  });
  // ---- build product > colour > PO
  const prods = {}, rank = { late: 4, risk: 3, warn: 2, nodate: 1, ok: 0, done: -1 };
  P.lines.forEach(x => {
    const p = prods[x.product] = prods[x.product] || { product: x.product, dpr: x.dpr, colours: {} };
    const ck2 = poKeyCol_(x.colour), col = p.colours[ck2] = p.colours[ck2] || { colour: ck2, pos: [] };
    col.pos.push({ po: x.po, colour: x.colour, fty: x.fty, qty: x.qty, cut: x.cut, stitch: x.stitch, iron: x.iron, pack: x.pack, fsa: x.fsa, fsaQ: x.fsaQ, fa: x.fa,
      ship: x.ship, shipOdd: !!x.shipOdd, status: x.status, priority: x.priority, sewnEst: x.sewnEst, risk: x.risk, note: x.note, daysLeft: x.daysLeft, needPerDay: x.needPerDay });
  });
  const products = Object.keys(prods).map(pn => {
    const p = prods[pn];
    const colours = Object.keys(p.colours).map(cn => {
      const col = p.colours[cn], pk = (p.dpr.join('+') || ('PLAN:' + pn)) + '|' + (cfg.poolByStyle ? '' : cn), pl = pools[pk] || {};
      const s = f => col.pos.reduce((a, x) => a + (x[f] || 0), 0);
      const open = col.pos.filter(x => x.risk !== 'done');
      col.pos.sort((a, b) => (a.ship || '9999') < (b.ship || '9999') ? -1 : 1);
      return { colour: cn, qty: s('qty'), stitch: s('stitch'), iron: s('iron'), pack: s('pack'), fsa: s('fsa'), fsaQ: s('fsaQ'), fsaFail: col.pos.reduce((a, x) => a + (x.fa ? x.fa.fail : 0), 0), sewnEst: s('sewnEst'),
        dprSewn: pl.dprSewn, poolSewn: pl.sewn, rate: pl.rate || 0, units: pl.units || {},
        nextShip: open.map(x => x.ship).filter(Boolean).sort()[0] || '', risk: col.pos.reduce((a, x) => rank[x.risk] > rank[a] ? x.risk : a, 'done'),
        poCount: col.pos.length, pos: col.pos };
    }).sort((a, b) => b.qty - a.qty);
    const s = f => colours.reduce((a, x) => a + (x[f] || 0), 0);
    const live = D.lines.filter(l => p.dpr.some(st => D.key(st, '').split('|')[0] === D.key(l.style, '').split('|')[0]));
    return { product: pn, dpr: p.dpr, qty: s('qty'), stitch: s('stitch'), pack: s('pack'), fsaQ: s('fsaQ'), fsaFail: s('fsaFail'), sewnEst: s('sewnEst'), rate: cfg.poolByStyle ? ((colours[0] || {}).rate || 0) : s('rate'),
      poCount: colours.reduce((a, x) => a + x.poCount, 0), nextShip: colours.map(x => x.nextShip).filter(Boolean).sort()[0] || '',
      risk: colours.reduce((a, x) => rank[x.risk] > rank[a] ? x.risk : a, 'done'), colours: colours,
      lines: live, todayPro: live.reduce((a, l) => a + l.pro, 0) };
  }).sort((a, b) => rank[b.risk] - rank[a.risk] || (a.nextShip || '9999').localeCompare(b.nextShip || '9999'));
  const alerts = [];
  products.forEach(p => p.colours.forEach(col => col.pos.forEach(x => {
    if (x.risk === 'risk' || x.risk === 'late' || x.risk === 'warn') alerts.push({ product: p.product, colour: col.colour, po: x.po, fty: x.fty, qty: x.qty, ship: x.ship, risk: x.risk, note: x.note });
  })));
  alerts.sort((a, b) => (rank[b.risk] - rank[a.risk]) || (a.ship || '').localeCompare(b.ship || ''));
  const s = f => products.reduce((a, x) => a + (x[f] || 0), 0);
  const out = { ok: true, buyer: buyer, buyers: Object.keys(PO_BUYERS), date: today, time: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm'),
    sheetUrl: 'https://docs.google.com/spreadsheets/d/' + cfg.id + '/edit', finishDays: PO_FINISH_DAYS, tab: P.tab || '', since: cfg.since,
    total: { qty: s('qty'), stitch: s('stitch'), pack: s('pack'), fsaQ: s('fsaQ'), fsaFail: s('fsaFail'), sewnEst: s('sewnEst'), pos: s('poCount'), todayPro: s('todayPro') },
    fsaAt: FSA.at || '',
    products: products, alerts: alerts, issues: P.issues };
  poCachePut_(c, ck, JSON.stringify(out), 2100);   // warmed by warmFeeds every 30 min
  return out;
}

/** script cache holds 100 KB per key - split bigger feeds into parts */
function poCachePut_(c, k, s, ttl) {
  try { const n = Math.ceil(s.length / 90000), o = {}; o[k + '_n'] = String(n); for (let i = 0; i < n; i++) o[k + '_' + i] = s.slice(i * 90000, (i + 1) * 90000); c.putAll(o, ttl); } catch (e) {}
}
function poCacheGet_(c, k) {
  try { const n = +c.get(k + '_n'); if (!n) return null; const ks = []; for (let i = 0; i < n; i++) ks.push(k + '_' + i);
    const g = c.getAll(ks); return ks.every(x => g[x] != null) ? ks.map(x => g[x]).join('') : null; } catch (e) { return null; }
}

/** at-risk POs for the daily alert email (ship within 14 days, or already late) */
function poAlertItems_() {
  const items = [], lim = Utilities.formatDate(new Date(Date.now() + 14 * 864e5), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  Object.keys(PO_BUYERS).forEach(b => {
    let v = null; try { v = poView_(b); } catch (e) { return; }
    (v.alerts || []).filter(a => a.risk !== 'warn' && a.ship && a.ship <= lim).forEach(a => items.push({ unit: a.fty || 'TSPL', key: 'po_' + a.po + '_' + a.colour + '_' + a.risk,
      kind: 'SHIP', text: b + ' ' + a.product + ' ' + a.colour + ' PO ' + a.po + ' (' + a.qty.toLocaleString() + ' pcs, ship ' + a.ship + '): ' + a.note }));
  });
  return items;
}
