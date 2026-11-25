/* ================= GSD SHEET VIEWER feed (action=gs_view&k=<key>[&tab=<sheetId>]) =================
   Read-only. Shows the GSD team's Google Sheets as portal pages. Only the sheets listed here can be read.
   Uses the Sheets API (values:batchGet / spreadsheets.get) through ecmGet_'s token. */
const GS_VIEW = {
  needle: ['1rekp5LyRhUQLjxLTtqhLA57SeUDDvejtkI4EKRVYcGs', 'Needle Details'],
  mc: ['1-zpviK1eMMCwiEdjpXcV1jLyeiYqPRh_DRC55Aa4trU', 'Machine Details'],
  mcold: ['1cDxz9fqGzRszWDXOggdChaOMImVwCB27atVYaDDYvcQ', 'Machine Details (old)'],
  cotreq: ['17rqWjNTT3JF-4oY0XfQhj7z1bpLUD6WTjV0Eql0RE9E', 'COT Request'],
  indent: ['10i2hs5eF23gCO50ixFnPrBfnTFqnpIiCd4WXxHUnxbI', 'Indent Details'],
  ulp: ['1nW7CoUhPhpuHjWVSjfEmcrKJF_3wcoQ1NUCzerwi_F0', 'Unit Line Plans'],
  mcl_fipl: ['19Tp4xb4Gb0UfkXHDYIjjQET-8H2JnJJk7BwL0demTWE', 'FIPL | Mc List & Line Plan'],
  mcl_ts2: ['1U-SejE8qkwk9RuBSAUj1jWKlZQcy5uKm8EjCQqwJcZY', 'TS2 | Mc List & Line Plan'],
  mcl_ts4: ['1Gp5BWM-MB_U9NvywWSqWNFcpf7pppmSIYRwYlftKj28', 'TS4 | Mc List & Line Plan'],
  mcl_ts9: ['1-xvNlcODe6h03-BndxUCXU5psDFUnVYQ8aJFc1jQaG0', 'TS9 | Mc List & Line Plan'],
  mcl_ap2: ['1FYPDUDUo3pK2syfgmWqV0cNZCevrO7wfwX2uBcpPcJo', 'AP2 | Mc List & Line Plan'],
  mcl_tspl: ['1nkCRjl3V2ZzUczFZj2kuF8Wd_fEuBQ-Vfz-g9Si3a2Q', 'TSPL / CMD | Mc List & Line Plan']
};
function gsMeta_(id) {
  const r = UrlFetchApp.fetch('https://sheets.googleapis.com/v4/spreadsheets/' + id + '?fields=properties.title,sheets(properties(sheetId,title,index,hidden,gridProperties(rowCount,columnCount)))',
    { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) throw new Error('Sheet not readable (' + r.getResponseCode() + ')');
  const j = JSON.parse(r.getContentText());
  return { title: j.properties.title, tabs: (j.sheets || []).map(s => s.properties).filter(p => !p.hidden).sort((a, b) => a.index - b.index)
    .map(p => ({ gid: p.sheetId, name: p.title, rows: p.gridProperties ? p.gridProperties.rowCount : 0, cols: p.gridProperties ? p.gridProperties.columnCount : 0 })) };
}
function gsColL_(n) { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - 1 - m) / 26 | 0; } return s; }
function gsView_(p) {
  const k = String(p.k || ''), def = GS_VIEW[k];
  if (!def) return { ok: false, error: 'Unknown sheet' };
  const q = String(p.q || '').trim().toLowerCase(), pg = Math.max(0, Number(p.page) || 0), N = 1000, asc = String(p.order) === 'asc';
  const c = CacheService.getScriptCache(), key = 'gsv2_' + k + '_' + (p.tab || '') + '_' + pg + '_' + (asc ? 'a' : 'd') + '_' + Utilities.base64EncodeWebSafe(q).slice(0, 60);
  if (String(p.fresh) !== '1') { const n = Number(c.get(key + '_n') || 0); if (n) { const parts = c.getAll(Array.from({ length: n }, (_, i) => key + '_' + i)); let s = ''; for (let i = 0; i < n; i++) { if (parts[key + '_' + i] == null) { s = ''; break; } s += parts[key + '_' + i]; } if (s) return JSON.parse(s); } }
  const meta = gsMeta_(def[0]);
  if (!meta.tabs.length) return { ok: false, error: 'No visible tabs' };
  const tab = meta.tabs.filter(t => String(t.gid) === String(p.tab))[0] || meta.tabs[0];
  const cols = Math.min(tab.cols || 26, 110), L = gsColL_(cols), nm = "'" + tab.name.replace(/'/g, "''") + "'!";
  const g0 = ecmGet_([def[0]], [nm + 'A1:' + L + '12', nm + 'A1:D' + (tab.rows || 1000)], 'FORMATTED_VALUE')[0];
  if (g0.err) return { ok: false, error: g0.err };
  const top = g0[nm + 'A1:' + L + '12'] || [], colA = g0[nm + 'A1:D' + (tab.rows || 1000)] || [];
  let last = colA.length; while (last > 0 && !(colA[last - 1] || []).some(x => String(x).trim() !== '')) last--;
  // header = the row among the first 12 with the most filled cells (earliest on a tie)
  let hdr = 0, best = -1; top.forEach((r, i) => { const n = r.filter(x => String(x).trim() !== '').length; if (n > best) { best = n; hdr = i; } });
  const dataStart = hdr + 2;   // 1-based first data row
  let rowsOut = [], total = Math.max(0, last - dataStart + 1), from = dataStart, pages = Math.max(1, Math.ceil(total / N)), matches = null;
  if (q) {
    const all = ecmGet_([def[0]], [nm + 'A' + dataStart + ':' + L + Math.max(dataStart, last)], 'FORMATTED_VALUE')[0];
    const vv = (all[nm + 'A' + dataStart + ':' + L + Math.max(dataStart, last)] || []).map((r, i) => ({ r: r, n: dataStart + i })).filter(o => o.r.join(' ').toLowerCase().indexOf(q) > -1);
    matches = vv.length; if (!asc) vv.reverse();
    rowsOut = vv.slice(0, 1500).map(o => [o.n].concat(o.r)); pages = 1;
  } else if (total) {
    let a, b;
    if (asc) { a = dataStart + pg * N; b = Math.min(last, a + N - 1); } else { b = last - pg * N; a = Math.max(dataStart, b - N + 1); }
    if (b >= a) {
      const rg = nm + 'A' + a + ':' + L + b, got = ecmGet_([def[0]], [rg], 'FORMATTED_VALUE')[0];
      rowsOut = (got[rg] || []).map((r, i) => [a + i].concat(r));
      while (rowsOut.length < b - a + 1) rowsOut.push([a + rowsOut.length]);
      if (!asc) rowsOut.reverse();
    }
  }
  const head = top.slice(0, hdr + 1);
  const w = [head].concat([rowsOut.map(r => r.slice(1))]).reduce((m, block) => block.reduce((mm, r) => { let l = r.length; while (l && String(r[l - 1]).trim() === '') l--; return Math.max(mm, l); }, m), 0);
  const fix = r => { r = (r || []).slice(0, w).map(x => String(x == null ? '' : x)); while (r.length < w) r.push(''); return r; };
  const out = { ok: true, k: k, title: def[1], file: meta.title, id: def[0], tabs: meta.tabs.map(t => ({ gid: t.gid, name: t.name })), tab: { gid: tab.gid, name: tab.name },
    titles: head.slice(0, hdr).map(r => r.filter(x => String(x).trim() !== '').join(' · ')).filter(Boolean), header: fix(head[hdr]),
    rows: rowsOut.filter(r => r.slice(1).some(x => String(x).trim() !== '')).map(r => [r[0]].concat(fix(r.slice(1)))), total: total, page: pg, pages: pages, per: N, asc: asc, q: q, matches: matches,
    at: Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd-MMM-yyyy HH:mm') };
  const js = JSON.stringify(out);
  try { const parts = {}; let n = 0; for (let i = 0; i < js.length; i += 95000) parts[key + '_' + (n++)] = js.slice(i, i + 95000); if (n <= 40) { parts[key + '_n'] = String(n); c.putAll(parts, 300); } } catch (e) {}
  return out;
}
