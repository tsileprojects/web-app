/* ================= MACHINE PLAN (Mc_Plan) feed (action=mcp_dash&unit=FIPL|TS2|TS4|TS9|AP2|CMD|TSPL) =================
   Read-only. Same <UNIT>_Mc_Req sheets (A5:CY108) the old "Mc_Plan Dashboard" Google pages read; the unit
   "Mc_Plan_Dispaly & Calc" projects keep recalculating them every 10 minutes.
   out: { dates:['24-Nov-2026',…], rows:[{n, ih, sm, nu, os, av, q:[required per date]}] }   Cached 5 minutes. */
const MCP_FILES = {
  FIPL: ['19Tp4xb4Gb0UfkXHDYIjjQET-8H2JnJJk7BwL0demTWE', 'FIPL_Mc_Req'], TS2: ['1U-SejE8qkwk9RuBSAUj1jWKlZQcy5uKm8EjCQqwJcZY', 'TS2_Mc_Req'],
  TS4: ['1Gp5BWM-MB_U9NvywWSqWNFcpf7pppmSIYRwYlftKj28', 'TS4_Mc_Req'], TS9: ['1-xvNlcODe6h03-BndxUCXU5psDFUnVYQ8aJFc1jQaG0', 'TS9_Mc_Req'],
  AP2: ['1FYPDUDUo3pK2syfgmWqV0cNZCevrO7wfwX2uBcpPcJo', 'AP2_Mc_Req'], CMD: ['1PzUHCBWccYa6twGBMD8IFpR-vaVN6u4qhK-qUwf4W4Q', 'CMD_Mc_Req'],
  TSPL: ['1nkCRjl3V2ZzUczFZj2kuF8Wd_fEuBQ-Vfz-g9Si3a2Q', 'TSPL_Mc_Req']
};
function mcpBuild_(unit) {
  const tz = Session.getScriptTimeZone(), f = MCP_FILES[unit];
  const values = SpreadsheetApp.openById(f[0]).getSheetByName(f[1]).getRange('A5:CY108').getValues();
  let h = -1;
  for (let r = 0; r < Math.min(values.length, 10) && h < 0; r++)
    for (let c = 0; c < values[r].length; c++) if (String(values[r][c] || '').trim() === 'Grouping Machines') { h = r; break; }
  if (h < 0) return { ok: false, error: 'Could not find the "Grouping Machines" header in ' + f[1] };
  const names = { 'Grouping Machines': 'g', 'In-House Machines': 'ih', 'In-House': 'ih', 'Sampling Machines': 'sm', 'Sampling': 'sm',
    'Non Usable Machines': 'nu', 'Non Usable': 'nu', 'Out Source Machines': 'os', 'Out Source': 'os', 'Available Machines': 'av', 'Available': 'av' };
  const hdr = values[h], idx = {}, dates = [], seen = {};
  const parse = t => { const m = String(t).match(/(\d+)-([A-Za-z]+)-(\d+)/); if (!m) return null; const mo = DQR_MON_[m[2].slice(0, 3).toLowerCase()]; if (!mo) return null; let y = +m[3]; if (y < 100) y += 2000; return new Date(y, mo - 1, +m[1]); };
  for (let i = 0; i < hdr.length; i++) {
    const cell = hdr[i]; if (cell === '' || cell == null) continue;
    const t = cell instanceof Date ? '' : String(cell).trim();
    if (t && names[t] && idx[names[t]] == null) idx[names[t]] = i;
    const d = cell instanceof Date ? cell : parse(t);
    if (d && !isNaN(d)) { const k = Utilities.formatDate(d, tz, 'yyyy-MM-dd'); if (!seen[k]) { seen[k] = 1; dates.push({ i: i, k: k }); } }
  }
  dates.sort((a, b) => a.k < b.k ? -1 : 1);
  const map = {}, order = [];
  for (let r = h + 1; r < values.length; r++) {
    const row = values[r], nm = String(row[idx.g] || '').trim(); if (!nm || nm === '0') continue;
    if (!map[nm]) { map[nm] = { n: nm, ih: 0, sm: 0, nu: 0, os: 0, av: 0, q: dates.map(() => 0) }; order.push(nm); }
    const e = map[nm];
    ['ih', 'sm', 'nu', 'os', 'av'].forEach(k => { if (idx[k] != null && typeof row[idx[k]] === 'number') e[k] += row[idx[k]]; });
    dates.forEach((d, j) => { if (typeof row[d.i] === 'number') e.q[j] += row[d.i]; });
  }
  const ts = new Date();
  return { ok: true, unit: unit, dates: dates.map(d => d.k), rows: order.map(n => map[n]), builtAt: ts.getTime(), generated: Utilities.formatDate(ts, tz, 'dd-MMM-yyyy HH:mm') };
}
function mcpDash_(p) {
  const unit = String(p.unit || '').toUpperCase();
  if (!MCP_FILES[unit]) return { ok: false, error: 'Unknown unit ' + unit };
  const c = CacheService.getScriptCache(), key = 'mcp1_' + unit;
  if (String(p.fresh) !== '1') { const hit = c.get(key); if (hit) return JSON.parse(hit); }
  let out; try { out = mcpBuild_(unit); } catch (e) { return { ok: false, error: e.message }; }
  try { c.put(key, JSON.stringify(out), 300); } catch (e) {}
  return out;
}
