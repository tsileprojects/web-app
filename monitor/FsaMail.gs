/**
 * FSA report mail queue – automatic resend (added 17-Nov-2026)
 *
 * When an FSA sheet cannot mail its report because Google's daily mail limit is used up,
 * the FSA script saves the PDF in Drive and writes a QUEUED row in the hidden "Mail_Queue"
 * tab of that same FSA file. This runs every 30 minutes (called from checkAlerts) and sends
 * the queued reports, oldest first, as soon as mail is available again.
 *
 * Nothing in the FSA reports themselves is changed: only the Mail_Queue tab rows are updated.
 */
const FSA_MAIL_RESERVE = 5;   // keep a few mails free for the monitor's own alerts

function fsaMailFlush() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return 'busy';
  try {
    const pending = [];
    Object.keys(FSA_SHEETS).forEach(n => {
      try {
        const ss = SpreadsheetApp.openById(FSA_SHEETS[n]), q = ss.getSheetByName('Mail_Queue');
        if (!q || q.getLastRow() < 2) return;
        const v = q.getRange(2, 1, q.getLastRow() - 1, 9).getValues();
        v.forEach((r, i) => { if (r[6] === 'QUEUED') pending.push({ n, q, row: i + 2, at: r[0], to: r[1], cc: r[2], subject: r[3], body: r[4], pdf: r[5] }); });
      } catch (e) { console.log('FSA queue read ' + n + ': ' + e.message); }
    });
    if (!pending.length) return 'nothing queued';
    pending.sort((a, b) => new Date(a.at) - new Date(b.at));
    let sent = 0;
    for (const p of pending) {
      const need = String(p.to + ',' + p.cc).split(',').filter(x => x.trim()).length;
      if (MailApp.getRemainingDailyQuota() - FSA_MAIL_RESERVE < need) break;
      try {
        const mail = { to: p.to, subject: p.subject, htmlBody: p.body };
        if (p.cc) mail.cc = p.cc;
        if (p.pdf) mail.attachments = [DriveApp.getFileById(p.pdf).getBlob()];
        MailApp.sendEmail(mail);
        p.q.getRange(p.row, 7, 1, 3).setValues([['SENT', new Date(), 'Sent automatically by TSPL Error Monitor']]);
        sent++;
      } catch (e) {
        if (/too many times|quota|limit/i.test(e.message)) break;
        p.q.getRange(p.row, 9).setValue('Retry: ' + e.message.slice(0, 150));
      }
    }
    return sent + ' sent, ' + (pending.length - sent) + ' still queued';
  } finally { lock.releaseLock(); }
}

/** Quick view for checking: lists every queued / sent row across all FSA files. */
function fsaMailQueueStatus() {
  const out = [];
  Object.keys(FSA_SHEETS).forEach(n => {
    try {
      const q = SpreadsheetApp.openById(FSA_SHEETS[n]).getSheetByName('Mail_Queue');
      if (!q || q.getLastRow() < 2) return;
      q.getRange(2, 1, q.getLastRow() - 1, 9).getValues().forEach(r => out.push(n + ' | ' + r[6] + ' | ' + r[3]));
    } catch (e) { out.push(n + ' | ERROR ' + e.message); }
  });
  console.log(out.join('\n') || 'queue empty');
  return out;
}
