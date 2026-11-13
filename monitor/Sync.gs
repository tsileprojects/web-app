// =====================================================================
//  OLD NEEDLE FORM -> NEEDLE 2.0 UNIT TABS  (automatic copy, Nov 2026)
//  AP2 / TS4 / TS9 / Emb kept using the old form (00_Needle Form_A_GS_File_11.0,
//  tab NeedleData) after the 2.0 tabs were loaded on 27 Oct, so their 2.0 stock
//  stopped moving. This copies every new old-form row into the matching 2.0 tab
//  (01_Needle_Issue_FormData_2.0 -> <Unit>_Ndl_Data) in the 2.0 layout.
//  SAFE: only reads the old sheet; only appends to the 2.0 tabs (appendRow, same
//  as the form itself); remembers the last copied row so nothing is copied twice.
// =====================================================================
var NSY_OLD_ID = '1cgCFqAKGA_E6o6IgwiZfSLiZjAhpXC040SySpIxpoys';
var NSY_NEW_ID = '1KBAAaBR-uR0kpqkNzm35daUXn-DsocxD9bzMHlqwB0o';
var NSY_FROM = new Date(2026, 9, 28);           // 28 Oct 2026: first day not in the 2.0 tabs
var NSY_PROP = 'ndl_old_sync_row';              // next old-sheet row to copy
var NSY_TABS = { 'FIPL': 'FIPL_Ndl_Data', 'TS2': 'TS2_Ndl_Data', 'TS4': 'TS4_Ndl_Data', 'TS9': 'TS9_Ndl_Data',
                 'AP2': 'AP2_Ndl_Data', 'HO Smp': 'HOSmp_Ndl_Data', 'Emb': 'Emb_Ndl_Data', 'CMD': 'CMD_Ndl_Data' };

function syncOldNeedle() { return ndlSync_(240000); }   // trigger entry (every 10 min)

function nsyStartRow_(old, last) {
  var n = Math.min(last - 1, 12000), top = last - n + 1;
  var a = old.getRange(top, 1, n, 1).getValues();
  for (var i = 0; i < a.length; i++) {
    if (a[i][0] instanceof Date && a[i][0] >= NSY_FROM) return top + i;
  }
  return last + 1;
}

function ndlSync_(maxMs) {
  var t0 = Date.now(), lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return { ok: false, busy: true };
  var props = PropertiesService.getScriptProperties(), copied = {}, skipped = 0, next = 0;
  try {
    var old = SpreadsheetApp.openById(NSY_OLD_ID).getSheetByName('NeedleData');
    var last = old.getLastRow();
    next = Number(props.getProperty(NSY_PROP) || 0) || nsyStartRow_(old, last);
    if (next > last) { props.setProperty(NSY_PROP, String(next)); return { ok: true, copied: {}, upTo: next - 1, last: last }; }
    var ss = SpreadsheetApp.openById(NSY_NEW_ID), sheets = {}, tz = Session.getScriptTimeZone();
    var n = Math.min(last - next + 1, 1500);
    var vals = old.getRange(next, 1, n, 22).getValues();
    for (var i = 0; i < vals.length; i++) {
      if (Date.now() - t0 > maxMs) break;
      var r = vals[i], unit = String(r[1] || '').trim(), tab = NSY_TABS[unit];
      if (!(r[0] instanceof Date) || !tab) { skipped++; next++; continue; }
      var sh = sheets[tab] || (sheets[tab] = ss.getSheetByName(tab));
      if (!sh) { skipped++; next++; continue; }
      sh.appendRow([
        Utilities.formatDate(r[0], tz, 'yyyy-MM-dd'), Utilities.formatDate(r[0], tz, 'HH:mm:ss'),
        unit, r[2], r[3], r[4], r[5], r[6], r[7], r[8],
        r[17], r[18], r[12], r[13], r[19], r[20], r[21]
      ]);
      next++;
      copied[unit] = (copied[unit] || 0) + 1;
    }
    return { ok: true, copied: copied, skipped: skipped, upTo: next - 1, last: last, more: next <= last };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e), upTo: next - 1 };
  } finally {
    if (next) props.setProperty(NSY_PROP, String(next));
    lock.releaseLock();
  }
}

function ndlSyncSetup_() {
  var have = ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === 'syncOldNeedle'; });
  if (!have.length) ScriptApp.newTrigger('syncOldNeedle').timeBased().everyMinutes(10).create();
  return { ok: true, installed: !have.length, already: have.length > 0 };
}

function ndlSyncStatus_() {
  var p = PropertiesService.getScriptProperties().getProperty(NSY_PROP);
  var last = SpreadsheetApp.openById(NSY_OLD_ID).getSheetByName('NeedleData').getLastRow();
  return { ok: true, nextRow: Number(p || 0), oldLastRow: last, behind: p ? Math.max(0, last - Number(p) + 1) : null };
}
