// =====================================================================
//  SPEED (Nov 2026): rebuild slow feeds in the background so no viewer waits.
//  warmFeeds runs from refreshKpis (every 30 min, 6 AM - 10 PM): needle tower + today's line data
//  per unit. Read-only: it only fills the cache the pages already use.
// =====================================================================
function warmFeeds() {
  const h = Number(Utilities.formatDate(new Date(), 'Asia/Kolkata', 'H'));
  if (h < 6 || h >= 22) return 'night - skipped';
  const t0 = Date.now(), done = [];
  try { needleTower_(true); done.push('tower'); } catch (e) { done.push('tower ERR ' + e.message); }
  try { Object.keys(PO_BUYERS).forEach(b => poView_(b, 1)); done.push('po'); } catch (e) { done.push('po ERR ' + e.message); }
  const day = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd');
  KPI_UNITS.forEach(u => {
    if (Date.now() - t0 > 240000) return;
    try { drillLive_(u, day); done.push(u + ' drill'); } catch (e) {}
    try { lineDefects_(u, day); done.push(u + ' qc'); } catch (e) {}
  });
  return done.join(', ') + ' in ' + Math.round((Date.now() - t0) / 1000) + 's';
}

function speedSetup_() {
  const have = ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'warmFeeds');
  if (!have.length) ScriptApp.newTrigger('warmFeeds').timeBased().everyMinutes(10).create();
  return { ok: true, installed: !have.length, warm: warmFeeds() };
}
