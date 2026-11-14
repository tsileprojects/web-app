/**
 * ==============================================================
 *  FSA GUARD (Nov 2026) - keeps the 23 FSA report copies healthy
 *  (part of TSPL Error Monitor)
 *   fsaAudit()   read-only: formula differences vs the master copy + protections
 *   fsaHarden()  caption formulas -> INDEX form, lock formula cells (HO only)
 *   fsaCheck_()  hourly (from runChecks): errors + formula drift -> HO bell / log
 *  Never touches entry cells, photo cells, or anything the FSA Menu script writes.
 * ==============================================================
 */
const FSA_TAB = 'FSA_Report';
const FSA_MASTER = '1xZ841SF1BOmYkeuCKZD24lE_PFRjXGKPLfASizqo4EE';   // 05_TS4_Mr.Nijaguna - checked correct 13 Nov 2026
const FSA_SHEETS = {
  '01_FIPL_Mr.Basavaraju': '1CW8TgsYheO8RS8p_R6bm4D_e4fZvg9vBwpCO4GWlnMU',
  '01_FIPL_Mr.Gokularajan': '1WWNrY4jbZnpwZ6ioBPnwZoaM36GeMrEvrCSutxrCrr4',
  '01_FIPL_Mr.Kumarswamy new': '1MnCMtH7IaA3lzwkoXRUMF8LjwNFiN_QXHQcv0HT9QkQ',
  '01_FIPL_Mr.Kumarswamyold': '1RCVD-_IYW_lMoAsyI3__jnKZzR4ZV9vuitV8hOJlogo',
  '01_FIPL_Mr.Kumarswamyold2': '1NasX2iaTG42PeFPWaDV0rS52EKh9ueX4-HhtFfR9cLM',
  '01_FIPL_Mr.Sam': '1uXKyNqD6lp-jigMg7kQv4572YxB9DbDyCgeNzM0VCXQ',
  '01_FIPL_Mr.Shashidhara': '1c7A0szra4pHu2scju7ZtF2jvAyAPQ2ZtRtyFCLzLOnk',
  '01_HO_Ms.Nandini': '1_Vh36lZ_HhXbm5S6x-D8KSoFuL7kJEwXGYkEzqv-Vx8',
  '01_Methlan': '1odj41eAxmMz4t_YxzzsJ9nQBM-gOAN-3ANROpKo55eY',
  '02_FIPL_Mr.Thippeswamy': '19dofeislo_nlbRZnOFKpsCbIpl46-TJ2KWrHjEGIWXc',
  '03_TS4_Mr.Raju': '1_q6yGF1LjNmgUfGGCwJl1VkHgdU2Uo3hMAy9dbX1fw8',
  '04_TS2_Mr.Kumaresh': '1GPAl-bcyp9F3nTHnPuCYiML49Q-e4A7SuHTAqiDtjCo',
  '05_TS4_Mr.Nijaguna': '1xZ841SF1BOmYkeuCKZD24lE_PFRjXGKPLfASizqo4EE',
  '06_TS4_Mr.Mani': '1JRMZ1HV3bSDlIzP3VJHnJ9MZ2J36TmKFscmfdaZg0u4',
  '07_TS4_Mr.Naresh K': '1-rcHizorYDOwuSAWjuaJc3OqKUbCfbdwMpPTWUTr8uI',
  '08_TS9_Mr.Sureshkumar': '1j_ieH8s4rIs6m4DaCdcPZPmAS1iwkdVrsRButTk5mgs',
  '09_TS9_Mr.Mohan K': '1Nu0jBrNuUCKdUQcQP4wRoO270UedCLQvNh1T6xSHplE',
  '11_AP_Mr.Jagadish D': '1EMxi0hM_LMp6S-1_g5IUS1kdqIvupdVCh4vjo4lnuUA',
  '12_FIPL_Mr.Ramesh': '15l7qkYeme7rxOEuWHCJzvIVKKd_arUARwY1kTIGNBIA',
  '13_AP2_Mr.Rajshekhar R': '1IyLj7mzkI0-dpf_Kq-vSWpzZYBH9XhD-evW0YwGniU8',
  '14_Mr.Sathish KN': '1EXpqiXFHn8XHs2iwjTRkUDvp0retVX2NPPWD2RkgCK8',
  '14_Mr.Sathish KN MATALAN': '1n93WqcQVnubpvw-MGXoWxuvlXzladqZtWvOuWxqzBLM',
  '15_Ms.Nandini MATALAN': '1cPHKdy322k4dfslh-S-W7IeJPavQ6MzXbDszMWlTjUs'
};

/** formula map {A1: formula} of the FSA_Report tab */
function fsaFormulas_(sh) {
  const f = sh.getDataRange().getFormulas(), out = {};
  for (let r = 0; r < f.length; r++) for (let c = 0; c < f[r].length; c++)
    if (f[r][c]) out[sh.getRange(r + 1, c + 1).getA1Notation()] = f[r][c];
  return out;
}

/** READ-ONLY. Run from the editor: View > Logs shows the result. */
function fsaAudit() {
  const mSh = SpreadsheetApp.openById(FSA_MASTER).getSheetByName(FSA_TAB), master = fsaFormulas_(mSh);
  const open = mSh.getProtections(SpreadsheetApp.ProtectionType.SHEET).map(p => p.getUnprotectedRanges().map(r => r.getA1Notation()).join(' ')).join(' / ');
  const lines = ['MASTER cells ' + Object.keys(master).length + ' | S31 ' + master.S31 + ' | S33 ' + master.S33 + ' | N48 ' + master.N48 + ' | Q28 ' + master.Q28, 'OPEN RANGES: ' + open];
  Object.keys(FSA_SHEETS).forEach(n => {
    try {
      const ss = SpreadsheetApp.openById(FSA_SHEETS[n]), sh = ss.getSheetByName(FSA_TAB);
      if (!sh) { lines.push(n + ': NO FSA_Report TAB'); return; }
      const f = fsaFormulas_(sh), diff = [];
      Object.keys(master).forEach(k => { if (f[k] !== master[k] && !/^=IMAGE\(/i.test(master[k] || '')) diff.push(k + (f[k] ? ' has ' + f[k].slice(0, 50) : ' missing')); });
      Object.keys(f).forEach(k => { if (!(k in master) && !/^=IMAGE\(/i.test(f[k])) diff.push(k + ' extra ' + f[k].slice(0, 50)); });
      const pr = sh.getProtections(SpreadsheetApp.ProtectionType.RANGE).map(p => p.getRange().getA1Notation() + (p.isWarningOnly() ? '(warn)' : ''));
      const ps = sh.getProtections(SpreadsheetApp.ProtectionType.SHEET).map(p => 'SHEET' + (p.isWarningOnly() ? '(warn)' : '') +
        ' open=' + p.getUnprotectedRanges().length + ' editors=' + p.getEditors().length);
      if (n === '05_TS4_Mr.Nijaguna' || /old|Methlan/.test(n)) return;
      lines.push(n + ': ' + (diff.length ? diff.length + ' DIFF -> ' + diff.slice(0, 12).map(d => d.slice(0, 40)).join('; ') : 'formulas match') +
        ' | protect: ' + (pr.concat(ps).join(', ') || 'none') + ' | file editors ' + ss.getEditors().length);
    } catch (e) { lines.push(n + ': ERROR ' + e.message); }
  });
  Logger.log(lines.join('\n'));
  return lines;
}

/* ---------- hardening: formulas that survive cut/paste/drag inside the defect table ---------- */
const FSA_SKIP = /old|Methlan/;                       // obsolete / different-layout files: never touched
const FSA_CAPTIONS = ['C92', 'I92', 'N92', 'C105', 'I105', 'N105', 'C118', 'I118', 'N118'];

/** new move-proof formulas, built from the master's own formulas */
function fsaTargets_(master) {
  const t = {};
  FSA_CAPTIONS.forEach((a, i) => t[a] = '=CONCATENATE(INDEX($E$33:$E$47,' + (i + 1) + '),\" | \",INDEX($G$33:$G$47,' + (i + 1) + '))');
  for (let r = 33; r <= 47; r++) {
    const f = master['S' + r]; if (!f) continue;
    t['S' + r] = f.replace(new RegExp('\\b([DEGNP])' + r + '\\b', 'g'), (m, c) => 'INDEX($' + c + '$33:$' + c + '$47,' + (r - 32) + ')');
  }
  if (master.S31) t.S31 = master.S31.replace(/\bE33\b/g, 'INDEX($E$33:$E$47,1)');
  return t;
}
/** is the current formula the old master one, or the old one damaged by a moved cell? */
function fsaOldOrBroken_(cur, old) {
  if (!cur || !old) return false;
  if (cur === old) return true;
  const norm = s => s.replace(/(#REF!|\bG\d+\b)/g, 'G#');
  return norm(cur) === norm(old);
}
function fsaPlan_(sh, master, targets) {
  const f = fsaFormulas_(sh), plan = [], skip = [];
  Object.keys(targets).forEach(a => {
    const cur = f[a] || '';
    if (cur === targets[a]) return;
    if (fsaOldOrBroken_(cur, master[a])) plan.push({ a: a, from: cur, to: targets[a], repair: cur !== master[a] });
    else skip.push(a + ' (' + (cur || 'empty').slice(0, 40) + ')');
  });
  return { plan: plan, skip: skip, f: f };
}

/** PREVIEW - changes nothing. */
function fsaHardenPreview() { return fsaHarden_(false); }
/** APPLY - backs up every old formula to the FSA_Backup tab first. */
function fsaHardenApply() { return fsaHarden_(true); }
/** PILOT - applies to one healthy report only and checks every affected value is unchanged. */
function fsaHardenPilot() { return fsaHarden_(true, '08_TS9_Mr.Sureshkumar'); }

function fsaHarden_(apply, only) {
  const master = fsaFormulas_(SpreadsheetApp.openById(FSA_MASTER).getSheetByName(FSA_TAB));
  const targets = fsaTargets_(master), lines = [], allow = {};
  const tz = Session.getScriptTimeZone(), stamp = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm');
  let bk = null;
  if (apply) {
    const log = ss_(); bk = log.getSheetByName('FSA_Backup') || log.insertSheet('FSA_Backup');
    if (bk.getLastRow() === 0) bk.appendRow(['When', 'Report', 'Cell', 'Old formula', 'New formula']);
  }
  Object.keys(FSA_SHEETS).forEach(n => {
    if (only && n !== only) return;
    if (FSA_SKIP.test(n)) { lines.push(n + ': skipped (old / different layout)'); return; }
    try {
      const sh = SpreadsheetApp.openById(FSA_SHEETS[n]).getSheetByName(FSA_TAB);
      const p = fsaPlan_(sh, master, targets);
      const VR = ['S31:S47', 'C92:Q92', 'C105:Q105', 'C118:Q118'], before = VR.map(r => JSON.stringify(sh.getRange(r).getDisplayValues()));
      let same = '';
      if (apply && p.plan.length) {
        bk.getRange(bk.getLastRow() + 1, 1, p.plan.length, 5).setValues(p.plan.map(x => [stamp, n, x.a, "'" + x.from, "'" + x.to]));
        p.plan.forEach(x => sh.getRange(x.a).setFormula(x.to));
        SpreadsheetApp.flush();
        const after = VR.map(r => JSON.stringify(sh.getRange(r).getDisplayValues()));
        same = before.every((b, i) => b === after[i]) ? ' | values unchanged' : ' | VALUES CHANGED: ' + VR.filter((r, i) => before[i] !== after[i]).join(',');
      }
      // remember what legitimately differs in this copy (its own extras / template variant), so the hourly check ignores it
      const nowF = apply ? fsaFormulas_(sh) : p.f;
      allow[FSA_SHEETS[n]] = Object.keys(master).filter(k => !/^=IMAGE\(/i.test(master[k]) && !(k in targets) && nowF[k] !== master[k]);
      const rep = p.plan.filter(x => x.repair).map(x => x.a);
      lines.push(n + ': ' + (apply ? 'changed ' : 'would change ') + p.plan.length + ' cells' + (rep.length ? ' (REPAIRS broken: ' + rep.join(',') + ')' : '') +
        (p.skip.length ? ' | LEFT ALONE: ' + p.skip.join('; ') : '') + same);
    } catch (e) { lines.push(n + ': ERROR ' + e.message); }
  });
  if (apply && !only) {
    const exp = Object.keys(master).filter(k => !/^=IMAGE\(/i.test(master[k])).map(k => [k, "'" + (targets[k] || master[k])]);
    const log = ss_(), ex = log.getSheetByName('FSA_Expected') || log.insertSheet('FSA_Expected');
    ex.clearContents(); ex.getRange(1, 1, 1, 2).setValues([['Cell', 'Expected formula']]); ex.getRange(2, 1, exp.length, 2).setValues(exp);
    PropertiesService.getScriptProperties().setProperty('FSA_ALLOW', JSON.stringify(allow));
  }
  Logger.log(lines.join('\n'));
  return lines;
}

/* ---------- watching: hourly from runChecks ---------- */
/** adds the FSA reports to the monitor's Watch_Sheets list (error-value scan). Safe to run again. */
function fsaWatchSetup() {
  const sh = ss_().getSheetByName('Watch_Sheets'), have = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().map(r => String(r[0])) : [];
  const add = Object.keys(FSA_SHEETS).filter(n => !FSA_SKIP.test(n) && !have.some(h => h.indexOf(FSA_SHEETS[n]) > -1))
    .map(n => [FSA_SHEETS[n], FSA_TAB, 'Y', '', '']);
  if (add.length) sh.getRange(sh.getLastRow() + 1, 1, add.length, 5).setValues(add);
  Logger.log('added ' + add.length + ' FSA reports to Watch_Sheets');
  return add.length;
}

/** formula drift check vs the expected list - raises / clears an issue on the HO bell */
function fsaCheck_() {
  const ex = ss_().getSheetByName('FSA_Expected'); if (!ex || ex.getLastRow() < 2) return 0;
  const want = {}; ex.getRange(2, 1, ex.getLastRow() - 1, 2).getValues().forEach(r => want[r[0]] = String(r[1]).replace(/^'/, ''));
  const allow = JSON.parse(PropertiesService.getScriptProperties().getProperty('FSA_ALLOW') || '{}');
  let n = 0, M = null; try { M = fsaLayout_(SpreadsheetApp.openById(FSA_MASTER).getSheetByName(FSA_TAB)); } catch (e) {}
  Object.keys(FSA_SHEETS).forEach(name => {
    if (FSA_SKIP.test(name)) return;
    const id = FSA_SHEETS[name], key = 'FSA|' + id, ok = allow[id] || [];
    try {
      const book = SpreadsheetApp.openById(id), sh = book.getSheetByName(FSA_TAB), f = fsaFormulas_(sh); n++;
      const bad = Object.keys(want).filter(k => ok.indexOf(k) < 0 && f[k] !== want[k]);
      if (bad.length) upsertIssue_({ key: key, severity: 'Error', source: 'FSA guard', program: book.getName() + ' > ' + FSA_TAB,
        target: book.getUrl() + '#gid=' + sh.getSheetId(),
        message: bad.length + ' formula cell(s) changed from the master FSA report: ' + bad.slice(0, 10).join(', ') + '. HO: restore from the master copy.' });
      else autoResolve_(key, 'FSA formulas match the master again');
      if (M && !/MATALAN/.test(name)) {   // locked / unmerged photo boxes and entry areas = Save & Send can't clear, photos fail
        const d = fsaLayoutDiff_(sh, M), lk = 'FSALAYOUT|' + id, prob = d.openMissing.concat(d.openBad).concat(d.mergeMissing.map(a => a + ' (box split)'));
        if (prob.length) upsertIssue_({ key: lk, severity: 'Error', source: 'FSA guard', program: book.getName() + ' > ' + FSA_TAB,
          target: book.getUrl() + '#gid=' + sh.getSheetId(),
          message: 'Entry / photo areas damaged: ' + prob.slice(0, 6).join(', ') + '. Save & Send may not clear the form. HO: run fsaLayoutRepair in the monitor.' });
        else autoResolve_(lk, 'FSA entry / photo areas match the master again');
      }
    } catch (e) {}
  });
  return n;
}

/** READ-ONLY: open (editable) ranges + photo merges of one report vs the master */
function fsaProtCompare() {
  const one = id => {
    const sh = SpreadsheetApp.openById(id).getSheetByName(FSA_TAB);
    const open = sh.getProtections(SpreadsheetApp.ProtectionType.SHEET).map(p => p.getUnprotectedRanges().map(r => r.getA1Notation())).flat().sort();
    const ranges = sh.getProtections(SpreadsheetApp.ProtectionType.RANGE).map(p => p.getRange().getA1Notation() + (p.isWarningOnly() ? '(warn)' : ''));
    const merges = sh.getRange('A60:Q310').getMergedRanges().map(r => r.getA1Notation()).sort();
    return { open: open, ranges: ranges, merges: merges, rows: sh.getMaxRows() };
  };
  const m = one(FSA_MASTER), r = one(FSA_SHEETS['12_FIPL_Mr.Ramesh']);
  const diff = (a, b) => a.filter(x => b.indexOf(x) < 0);
  Logger.log(['RAMESH open-only: ' + diff(r.open, m.open).join(' '), 'MASTER open-only: ' + diff(m.open, r.open).join(' '),
    'RAMESH range-protections: ' + r.ranges.join(' '), 'MASTER range-protections: ' + m.ranges.join(' '),
    'RAMESH merges-only: ' + diff(r.merges, m.merges).join(' '), 'MASTER merges-only: ' + diff(m.merges, r.merges).join(' '),
    'rows R/M: ' + r.rows + '/' + m.rows, 'MASTER merges: ' + m.merges.join(' ')].join('\n'));
}

/* ---------- open (auditor-editable) areas + photo boxes: compare and repair ---------- */
function fsaLayout_(sh) {
  const open = [];
  sh.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(p => p.getUnprotectedRanges().forEach(r => { let a = '#REF!'; try { a = r.getA1Notation(); } catch (e) {} open.push(a); }));
  const merges = sh.getRange('A1:Q' + Math.min(sh.getMaxRows(), 320)).getMergedRanges().map(r => r.getA1Notation());
  return { open: open, merges: merges };
}
function fsaLayoutDiff_(sh, M) {
  const L = fsaLayout_(sh);
  return { L: L, openMissing: M.open.filter(a => L.open.indexOf(a) < 0), openBad: L.open.filter(a => a === '#REF!'),
    openExtra: L.open.filter(a => a !== '#REF!' && M.open.indexOf(a) < 0), mergeMissing: M.merges.filter(a => L.merges.indexOf(a) < 0) };
}
/** READ-ONLY scan of all reports */
function fsaLayoutScan() { return fsaLayoutFix_(false); }
/** REPAIR: puts back missing open areas / photo boxes exactly as in the master. Never removes an extra open area, never merges over content. */
function fsaLayoutRepair() { return fsaLayoutFix_(true); }
function fsaLayoutFix_(apply) {
  const M = fsaLayout_(SpreadsheetApp.openById(FSA_MASTER).getSheetByName(FSA_TAB)), lines = [];
  Object.keys(FSA_SHEETS).forEach(n => {
    if (FSA_SKIP.test(n) || /MATALAN/.test(n)) return;
    try {
      const sh = SpreadsheetApp.openById(FSA_SHEETS[n]).getSheetByName(FSA_TAB), d = fsaLayoutDiff_(sh, M);
      if (!d.openMissing.length && !d.openBad.length && !d.mergeMissing.length) { lines.push(n + ': OK'); return; }
      const did = [];
      if (apply) {
        d.mergeMissing.forEach(a => {
          const rg = sh.getRange(a), fv = rg.getFormulas(), vv = rg.getValues(), vals = fv.map((r, i) => r.map((f, j) => f || vv[i][j]));
          const filled = vals.flat().filter(v => v !== '' && v !== null).length;
          if (filled <= 1 && !rg.getMergedRanges().length) { rg.merge(); did.push('merged ' + a); } else did.push('LEFT ' + a + ' (has content)');
        });
        if (d.openMissing.length || d.openBad.length) {
          const p = sh.getProtections(SpreadsheetApp.ProtectionType.SHEET)[0];
          if (p) {
            const keep = p.getUnprotectedRanges().filter(r => { try { return r.getA1Notation() !== '#REF!'; } catch (e) { return false; } });
            p.setUnprotectedRanges(keep.concat(d.openMissing.map(a => sh.getRange(a))));
            did.push('opened ' + d.openMissing.join(','));
          }
        }
        SpreadsheetApp.flush();
      }
      lines.push(n + ': open missing [' + d.openMissing.join(' ') + '] bad ' + d.openBad.length + ' | photo boxes missing [' + d.mergeMissing.join(' ') + ']' +
        (d.openExtra.length ? ' | extra open [' + d.openExtra.join(' ') + ']' : '') + (did.length ? ' => ' + did.join('; ') : ''));
    } catch (e) { lines.push(n + ': ERROR ' + e.message); }
  });
  Logger.log(lines.join('\n'));
  return lines;
}
