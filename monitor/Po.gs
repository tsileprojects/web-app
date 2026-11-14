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
  }
};
const PO_FINISH_DAYS = 2;           // sewing must finish this many working days before the ship date
const PO_DONE = /insp\s*clr|t\s*\/\s*out|shipped|dispatch|^rfi$/i;   // RFI = packed, ready for inspection

function poKeyCol_(c) { return String(c || '').toUpperCase().replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim(); }
function poNum_(v) { const n = Number(v); return v === '' || v === null || isNaN(n) ? null : Math.round(n); }
function poYmd_(d) { return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd'); }

/** every PO line in the plan workbook */
function poParse_(cfg) {
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

/** DPR sewing output per style + colour: total since cfg.since, recent daily rate, today's lines */
function poDpr_(cfg) {
  const src = kpiSrc_('PROD'), today = tdToday_();
  const tot = appCsv_(src, "select H, I, D, sum(AK) where G contains '" + cfg.dprBuyer + "' and C >= date '" + cfg.since + "' and E = 'Sew' group by H, I, D");
  const from = Utilities.formatDate(new Date(Date.now() - 14 * 864e5), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const day = appCsv_(src, "select H, I, C, sum(AK) where G contains '" + cfg.dprBuyer + "' and C >= date '" + from + "' and E = 'Sew' group by H, I, C");
  const now = appCsv_(src, "select D, F, H, I, sum(X), sum(AK) where G contains '" + cfg.dprBuyer + "' and C = date '" + today + "' and E = 'Sew' group by D, F, H, I");
  const key = (s, c) => String(s || '').trim().toUpperCase() + '|' + poKeyCol_(c);
  const sewn = {}, units = {}, rate = {}, lines = [];
  (tot.rows || []).forEach(x => { const k = key(x[0], x[1]); sewn[k] = (sewn[k] || 0) + kpiNum_(x[3]); (units[k] = units[k] || {})[x[2]] = (units[k][x[2]] || 0) + kpiNum_(x[3]); });
  const byDay = {};
  const ymd = v => { if (v instanceof Date) return poYmd_(v); const p = String(v).split(/[-\/]/); return p.length === 3 ? (p[0].length === 4 ? p[0] + '-' + ('0' + p[1]).slice(-2) + '-' + ('0' + p[2]).slice(-2) : p[2] + '-' + ('0' + p[1]).slice(-2) + '-' + ('0' + p[0]).slice(-2)) : String(v); };
  (day.rows || []).forEach(x => { const k = key(x[0], x[1]), d = ymd(x[2]); (byDay[k] = byDay[k] || {})[d] = (byDay[k][d] || 0) + kpiNum_(x[3]); });
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

function poView_(buyer, fresh) {
  buyer = buyer && PO_BUYERS[buyer] ? buyer : Object.keys(PO_BUYERS)[0];
  const cfg = PO_BUYERS[buyer], c = CacheService.getScriptCache(), ck = 'po_' + buyer;
  const hit = poCacheGet_(c, ck); if (hit && !tdFresh_(ck, fresh)) return JSON.parse(hit);
  const today = tdToday_(), P = poParse_(cfg), D = poDpr_(cfg);
  const linked = {}; cfg.map.forEach(x => x.dpr.forEach(st => linked[st.toUpperCase()] = 1));
  const free = {}; Object.keys(D.sewn).forEach(k => { const st = k.split('|')[0]; if (!linked[st]) free[st] = (free[st] || 0) + D.sewn[k]; });
  Object.keys(free).filter(st => free[st] > 0).forEach(st => P.issues.push('DPR style "' + st + '" (' + free[st].toLocaleString() + ' pcs sewn since ' + cfg.since + ') is not linked to any PO sheet - tell us which product it belongs to'));
  // ---- shared pools: same DPR style(s) + colour. Sewn pieces are given to POs in ship-date order.
  const pools = {};
  P.lines.forEach(x => {
    const pk = (x.dpr.join('+') || ('PLAN:' + x.product)) + '|' + poKeyCol_(x.colour);
    (pools[pk] = pools[pk] || { dpr: x.dpr, colour: poKeyCol_(x.colour), pos: [] }).pos.push(x);
  });
  Object.keys(pools).forEach(pk => {
    const pl = pools[pk];
    // DPR sewn for the pool: sets (top + btm) = the smaller of the two
    let dprSewn = null, rate = 0, unitSplit = {};
    if (pl.dpr.length) {
      const parts = pl.dpr.map(s => D.key(s, pl.colour));
      dprSewn = Math.min.apply(null, parts.map(k => D.sewn[k] || 0));
      rate = Math.min.apply(null, parts.map(k => D.rate[k] || 0));
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
    col.pos.push({ po: x.po, colour: x.colour, fty: x.fty, qty: x.qty, cut: x.cut, stitch: x.stitch, iron: x.iron, pack: x.pack, fsa: x.fsa,
      ship: x.ship, shipOdd: !!x.shipOdd, status: x.status, priority: x.priority, sewnEst: x.sewnEst, risk: x.risk, note: x.note, daysLeft: x.daysLeft, needPerDay: x.needPerDay });
  });
  const products = Object.keys(prods).map(pn => {
    const p = prods[pn];
    const colours = Object.keys(p.colours).map(cn => {
      const col = p.colours[cn], pk = (p.dpr.join('+') || ('PLAN:' + pn)) + '|' + cn, pl = pools[pk] || {};
      const s = f => col.pos.reduce((a, x) => a + (x[f] || 0), 0);
      const open = col.pos.filter(x => x.risk !== 'done');
      col.pos.sort((a, b) => (a.ship || '9999') < (b.ship || '9999') ? -1 : 1);
      return { colour: cn, qty: s('qty'), stitch: s('stitch'), iron: s('iron'), pack: s('pack'), fsa: s('fsa'), sewnEst: s('sewnEst'),
        dprSewn: pl.dprSewn, poolSewn: pl.sewn, rate: pl.rate || 0, units: pl.units || {},
        nextShip: open.map(x => x.ship).filter(Boolean).sort()[0] || '', risk: col.pos.reduce((a, x) => rank[x.risk] > rank[a] ? x.risk : a, 'done'),
        poCount: col.pos.length, pos: col.pos };
    }).sort((a, b) => b.qty - a.qty);
    const s = f => colours.reduce((a, x) => a + (x[f] || 0), 0);
    const live = D.lines.filter(l => p.dpr.some(st => st.toUpperCase() === l.style.toUpperCase()));
    return { product: pn, dpr: p.dpr, qty: s('qty'), stitch: s('stitch'), pack: s('pack'), sewnEst: s('sewnEst'), rate: s('rate'),
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
    sheetUrl: 'https://docs.google.com/spreadsheets/d/' + cfg.id + '/edit', finishDays: PO_FINISH_DAYS,
    total: { qty: s('qty'), stitch: s('stitch'), pack: s('pack'), sewnEst: s('sewnEst'), pos: s('poCount'), todayPro: s('todayPro') },
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
