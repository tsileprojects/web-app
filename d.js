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
  const c = CacheService.getScriptCache(), key = 'gsv1_' + k + '_' + (p.tab || '');
  if (String(p.fresh) !== '1') { const n = Number(c.get(key + '_n') || 0); if (n) { const parts = c.getAll(Array.from({ length: n }, (_, i) => key + '_' + i)); let s = ''; for (let i = 0; i < n; i++) { if (parts[key + '_' + i] == null) { s = ''; break; } s += parts[key + '_' + i]; } if (s) return JSON.parse(s); } }
  const meta = gsMeta_(def[0]);
  if (!meta.tabs.length) return { ok: false, error: 'No visible tabs' };
  const tab = meta.tabs.filter(t => String(t.gid) === String(p.tab))[0] || meta.tabs[0];
  const rows = Math.min(tab.rows || 1000, 4000), cols = Math.min(tab.cols || 26, 90);
  const rg = "'" + tab.name.replace(/'/g, "''") + "'!A1:" + gsColL_(cols) + rows;
  const got = ecmGet_([def[0]], [rg], 'FORMATTED_VALUE')[0];
  if (got.err) return { ok: false, error: got.err };
  let v = got[rg] || [];
  while (v.length && !v[v.length - 1].some(x => String(x).trim() !== '')) v.pop();
  const w = v.reduce((m, r) => { let l = r.length; while (l && String(r[l - 1]).trim() === '') l--; return Math.max(m, l); }, 0);
  v = v.map(r => { r = r.slice(0, w); while (r.length < w) r.push(''); return r.map(x => String(x)); });
  const out = { ok: true, k: k, title: def[1], file: meta.title, id: def[0], tabs: meta.tabs.map(t => ({ gid: t.gid, name: t.name })), tab: { gid: tab.gid, name: tab.name },
    values: v, truncated: (tab.rows || 0) > 4000 || (tab.cols || 0) > 90, at: Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd-MMM-yyyy HH:mm') };
  const js = JSON.stringify(out);
  try { const parts = {}; let n = 0; for (let i = 0; i < js.length; i += 95000) parts[key + '_' + (n++)] = js.slice(i, i + 95000); if (n <= 40) { parts[key + '_n'] = String(n); c.putAll(parts, 300); } } catch (e) {}
  return out;
}
