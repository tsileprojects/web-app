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
  const lines = ['MASTER formula cells: ' + Object.keys(master).length,
    Object.keys(master).map(k => k + ' ' + master[k].slice(0, 70)).join('\n')];
  Object.keys(FSA_SHEETS).forEach(n => {
    try {
      const ss = SpreadsheetApp.openById(FSA_SHEETS[n]), sh = ss.getSheetByName(FSA_TAB);
      if (!sh) { lines.push(n + ': NO FSA_Report TAB'); return; }
      const f = fsaFormulas_(sh), diff = [];
      Object.keys(master).forEach(k => { if (f[k] !== master[k]) diff.push(k + (f[k] ? ' has ' + f[k].slice(0, 50) : ' missing')); });
      Object.keys(f).forEach(k => { if (!(k in master) && !/^=IMAGE\(/i.test(f[k])) diff.push(k + ' extra ' + f[k].slice(0, 50)); });
      const pr = sh.getProtections(SpreadsheetApp.ProtectionType.RANGE).map(p => p.getRange().getA1Notation() + (p.isWarningOnly() ? '(warn)' : ''));
      const ps = sh.getProtections(SpreadsheetApp.ProtectionType.SHEET).map(p => 'SHEET' + (p.isWarningOnly() ? '(warn)' : '') +
        ' open=' + p.getUnprotectedRanges().length + ' editors=' + p.getEditors().length);
      lines.push(n + ': ' + (diff.length ? diff.length + ' DIFF -> ' + diff.slice(0, 12).join('; ') : 'formulas match') +
        ' | protect: ' + (pr.concat(ps).join(', ') || 'none') + ' | file editors ' + ss.getEditors().length);
    } catch (e) { lines.push(n + ': ERROR ' + e.message); }
  });
  Logger.log(lines.join('\n'));
  return lines;
}
