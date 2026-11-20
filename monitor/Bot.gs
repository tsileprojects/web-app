/* =====================================================================================
 *  TSPL ATTENDANCE BOT (Telegram)  -  part of the TSPL Error Monitor project
 *  Every working morning each registered worker is asked "Coming to work today?" (Yes / No).
 *  "No" asks a reason. Supervisors get instant alerts for their line, HR / GM get one summary
 *  per unit at cut-off, plus late-change alerts. Data lives in the "TSPL Attendance Bot" sheet.
 *
 *  One-time setup (HO):
 *   1. botSetup()           - creates the sheet (Settings, Workers, Admins, Attendance, Holidays, Log)
 *   2. Telegram @BotFather  - create the bot, copy its token
 *   3. Project Settings > Script properties: add  TG_TOKEN = <token>   (only the owner sees it)
 *   4. botConnect()         - links Telegram to this web app and installs the 5-minute timer
 * ===================================================================================== */
const BOT_URL = 'https://script.google.com/macros/s/AKfycbz4dLAQFFJ1yxrHJZrQRtzThsVHRuVcJz3ZrYb3SBMTXIVq6NonUXgDWqnVzE-9b9k0/exec';
const BOT_TZ = 'Asia/Kolkata';
const BOT_HEAD = {
  Settings: ['Setting', 'Value', 'Notes'],
  Workers: ['Emp Code', 'Name', 'Unit', 'Line', 'Shift', 'Mobile', 'Language (en/kn/hi)', 'Telegram ID', 'Status', 'Joined On', 'Last Reply'],
  Admins: ['Name', 'Role (HR/GM/Unit Head/Supervisor)', 'Mobile', 'Unit (All or FIPL/TS2/...)', 'Line (blank = all)', 'Instant alerts (Yes/No)', 'Daily summary (Yes/No)', 'Telegram ID', 'Status'],
  Attendance: ['Date', 'Emp Code', 'Name', 'Unit', 'Line', 'Reply', 'Reason', 'Time', 'After cut-off', 'Marked by'],
  Holidays: ['Date', 'Holiday'],
  Log: ['Time', 'Event', 'Detail']
};
const BOT_DEFAULTS = [
  ['Bot active', 'Yes', 'No = bot sends nothing'],
  ['Ask time', '07:00', 'Morning question to all workers (24h, IST)'],
  ['Reminder time', '08:00', 'One reminder to workers who have not replied'],
  ['Cut-off time', '08:30', 'Summary to HR / GM / unit heads; later changes are flagged'],
  ['Weekly off', 'Sunday', 'Comma separated, e.g. Sunday'],
  ['Units in pilot', 'All', 'All, or e.g. FIPL,TS9'],
  ['Auto-approve when mobile matches', 'Yes', 'Worker whose shared mobile matches the Workers list is activated at once']
];

/* ---------------- texts (workers choose their language) ---------------- */
const BT = {
  en: { ask: 'Good morning {n}!\nAre you coming to work today ({d})?', yes: '✅ Yes, coming', no: '❌ No, not coming',
        why: 'Sorry to hear that. Please choose the reason:', okY: '✅ Thank you {n}. Marked: COMING today ({d}).',
        okN: '❌ Noted {n}. Marked: NOT COMING today ({d}) – {r}.\nIf your plan changes, send /today to answer again.',
        remind: 'Reminder: please tell us if you are coming to work today ({d}).', expired: 'This question has expired. Send /today to answer for today.',
        reasons: ['Sick', 'Personal work', 'Family function', 'Leave already approved', 'Other'],
        lang: 'Language set to English.', joined: 'Welcome {n}! You are registered ({u} {l}). Every working morning I will ask if you are coming to work.',
        pending: 'Thank you. Your request has been sent to HR. You will get a message once approved.',
        status: 'Today ({d}) you answered: {s}', none: 'You have not answered for today ({d}) yet.', off: 'Today ({d}) is a holiday / weekly off. No reply needed.',
        help: 'Commands:\n/today – answer for today\n/status – see your answer\n/lang – change language' },
  kn: { ask: 'ಶುಭೋದಯ {n}!\nನೀವು ಇಂದು ({d}) ಕೆಲಸಕ್ಕೆ ಬರುತ್ತೀರಾ?', yes: '✅ ಹೌದು, ಬರುತ್ತೇನೆ', no: '❌ ಇಲ್ಲ, ಬರುವುದಿಲ್ಲ',
        why: 'ದಯವಿಟ್ಟು ಕಾರಣವನ್ನು ಆಯ್ಕೆಮಾಡಿ:', okY: '✅ ಧನ್ಯವಾದಗಳು {n}. ಇಂದು ({d}) ಬರುತ್ತೀರಿ ಎಂದು ದಾಖಲಿಸಲಾಗಿದೆ.',
        okN: '❌ ಸರಿ {n}. ಇಂದು ({d}) ಬರುವುದಿಲ್ಲ ಎಂದು ದಾಖಲಿಸಲಾಗಿದೆ – {r}.\nಯೋಜನೆ ಬದಲಾದರೆ /today ಕಳುಹಿಸಿ.',
        remind: 'ನೆನಪಿನ ಸಂದೇಶ: ಇಂದು ({d}) ಕೆಲಸಕ್ಕೆ ಬರುತ್ತೀರಾ ಎಂದು ದಯವಿಟ್ಟು ತಿಳಿಸಿ.', expired: 'ಈ ಪ್ರಶ್ನೆಯ ಸಮಯ ಮುಗಿದಿದೆ. ಇಂದಿಗೆ ಉತ್ತರಿಸಲು /today ಕಳುಹಿಸಿ.',
        reasons: ['ಅನಾರೋಗ್ಯ', 'ವೈಯಕ್ತಿಕ ಕೆಲಸ', 'ಕುಟುಂಬ ಕಾರ್ಯಕ್ರಮ', 'ರಜೆ ಮಂಜೂರಾಗಿದೆ', 'ಇತರೆ'],
        lang: 'ಭಾಷೆ: ಕನ್ನಡ.', joined: 'ಸ್ವಾಗತ {n}! ನಿಮ್ಮ ನೋಂದಣಿ ಆಗಿದೆ ({u} {l}). ಪ್ರತಿ ಕೆಲಸದ ದಿನ ಬೆಳಿಗ್ಗೆ ಕೆಲಸಕ್ಕೆ ಬರುತ್ತೀರಾ ಎಂದು ಕೇಳುತ್ತೇನೆ.',
        pending: 'ಧನ್ಯವಾದಗಳು. ನಿಮ್ಮ ವಿನಂತಿಯನ್ನು HR ಗೆ ಕಳುಹಿಸಲಾಗಿದೆ. ಅನುಮೋದನೆಯಾದ ನಂತರ ಸಂದೇಶ ಬರುತ್ತದೆ.',
        status: 'ಇಂದು ({d}) ನಿಮ್ಮ ಉತ್ತರ: {s}', none: 'ಇಂದು ({d}) ನೀವು ಇನ್ನೂ ಉತ್ತರಿಸಿಲ್ಲ.', off: 'ಇಂದು ({d}) ರಜೆ. ಉತ್ತರ ಬೇಕಾಗಿಲ್ಲ.',
        help: 'ಆಜ್ಞೆಗಳು:\n/today – ಇಂದಿಗೆ ಉತ್ತರಿಸಿ\n/status – ನಿಮ್ಮ ಉತ್ತರ ನೋಡಿ\n/lang – ಭಾಷೆ ಬದಲಿಸಿ' },
  hi: { ask: 'सुप्रभात {n}!\nक्या आप आज ({d}) काम पर आ रहे हैं?', yes: '✅ हाँ, आ रहा/रही हूँ', no: '❌ नहीं आ पाऊँगा/पाऊँगी',
        why: 'कृपया कारण चुनें:', okY: '✅ धन्यवाद {n}। आज ({d}) आने का जवाब दर्ज हो गया।',
        okN: '❌ ठीक है {n}। आज ({d}) न आने का जवाब दर्ज हो गया – {r}।\nयोजना बदले तो /today भेजें।',
        remind: 'याद दिलाना: कृपया बताएं कि आप आज ({d}) काम पर आ रहे हैं या नहीं।', expired: 'इस सवाल का समय खत्म हो गया। आज का जवाब देने के लिए /today भेजें।',
        reasons: ['बीमार', 'निजी काम', 'पारिवारिक कार्यक्रम', 'छुट्टी पहले से स्वीकृत', 'अन्य'],
        lang: 'भाषा: हिंदी।', joined: 'स्वागत है {n}! आपका पंजीकरण हो गया ({u} {l})। हर कार्य-दिवस सुबह मैं पूछूँगा कि आप काम पर आ रहे हैं या नहीं।',
        pending: 'धन्यवाद। आपका अनुरोध HR को भेज दिया गया है। स्वीकृति के बाद संदेश आएगा।',
        status: 'आज ({d}) आपका जवाब: {s}', none: 'आपने आज ({d}) अभी जवाब नहीं दिया है।', off: 'आज ({d}) छुट्टी है। जवाब की ज़रूरत नहीं।',
        help: 'कमांड:\n/today – आज का जवाब दें\n/status – अपना जवाब देखें\n/lang – भाषा बदलें' }
};
function bt_(lang, key, vars) {
  let s = (BT[lang] || BT.en)[key] || BT.en[key] || '';
  Object.keys(vars || {}).forEach(k => { s = s.split('{' + k + '}').join(vars[k]); });
  return s;
}

/* ---------------- sheet helpers ---------------- */
function botSS_() {
  const id = PropertiesService.getScriptProperties().getProperty('BOT_SS');
  if (!id) throw new Error('Run botSetup() first');
  return SpreadsheetApp.openById(id);
}
function botSheet_(n) { return botSS_().getSheetByName(n); }
function botRows_(n) { const sh = botSheet_(n), r = sh.getLastRow(); return r > 1 ? sh.getRange(2, 1, r - 1, BOT_HEAD[n].length).getValues() : []; }
function botSettings_() {
  const c = CacheService.getScriptCache(), hit = c.get('bot_set'); if (hit) return JSON.parse(hit);
  const o = {}; botRows_('Settings').forEach(r => { if (r[0]) o[String(r[0]).trim()] = r[1] instanceof Date ? Utilities.formatDate(r[1], BOT_TZ, 'HH:mm') : String(r[1]).trim(); });
  c.put('bot_set', JSON.stringify(o), 300); return o;
}
function botLog_(ev, d) { try { botSheet_('Log').appendRow([new Date(), ev, String(d || '').slice(0, 500)]); } catch (e) {} }
function botMob_(m) { return String(m || '').replace(/\D/g, '').slice(-10); }
function botToday_() { return Utilities.formatDate(new Date(), BOT_TZ, 'yyyy-MM-dd'); }
function botNice_(d) { return Utilities.formatDate(new Date(d + 'T12:00:00+05:30'), BOT_TZ, 'EEE dd MMM'); }
function botNow_() { return Utilities.formatDate(new Date(), BOT_TZ, 'HH:mm'); }
function botEsc_(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function botInPilot_(unit) { const u = (botSettings_()['Units in pilot'] || 'All').toUpperCase(); return u === 'ALL' || u.split(/\s*,\s*/).indexOf(String(unit).toUpperCase()) > -1; }

function botWorkingDay_(d) {
  const s = botSettings_(); if (String(s['Bot active']).toLowerCase() !== 'yes') return false;
  const day = Utilities.formatDate(new Date(d + 'T12:00:00+05:30'), BOT_TZ, 'EEEE').toLowerCase();
  if (String(s['Weekly off'] || 'Sunday').toLowerCase().split(/\s*,\s*/).indexOf(day) > -1) return false;
  return !botRows_('Holidays').some(r => r[0] && Utilities.formatDate(new Date(r[0]), BOT_TZ, 'yyyy-MM-dd') === d);
}

/* workers / admins indexed by Telegram ID (cached 10 min, cleared on change) */
function botPeople_() {
  const c = CacheService.getScriptCache(), hit = c.get('bot_ppl'); if (hit) return JSON.parse(hit);
  const w = {}, a = {};
  botRows_('Workers').forEach((r, i) => { if (r[7]) w[String(r[7])] = { row: i + 2, code: String(r[0]), name: String(r[1]), unit: String(r[2]), line: String(r[3]), lang: String(r[6] || 'en'), status: String(r[8]) }; });
  botRows_('Admins').forEach((r, i) => { if (r[7]) a[String(r[7])] = { row: i + 2, name: String(r[0]), role: String(r[1]), unit: String(r[3] || 'All'), line: String(r[4] || ''), instant: /^y/i.test(r[5]), summary: /^y/i.test(r[6]), status: String(r[8] || 'Active') }; });
  const o = { w: w, a: a }; try { c.put('bot_ppl', JSON.stringify(o), 600); } catch (e) {}
  return o;
}
function botDrop_() { CacheService.getScriptCache().removeAll(['bot_ppl', 'bot_set']); }

/* ---------------- Telegram API ---------------- */
function botTok_() { const t = PropertiesService.getScriptProperties().getProperty('TG_TOKEN'); if (!t) throw new Error('TG_TOKEN not set in Script properties'); return t; }
function tg_(method, payload) {
  const r = UrlFetchApp.fetch('https://api.telegram.org/bot' + botTok_() + '/' + method, { method: 'post', contentType: 'application/json', payload: JSON.stringify(payload || {}), muteHttpExceptions: true });
  let j = {}; try { j = JSON.parse(r.getContentText()); } catch (e) {}
  if (!j.ok) botLog_('tg error ' + method, r.getResponseCode() + ' ' + (j.description || ''));
  return j;
}
function tgSend_(chat, text, kb) { const p = { chat_id: chat, text: text, parse_mode: 'HTML', disable_web_page_preview: true }; if (kb) p.reply_markup = kb; return tg_('sendMessage', p); }
function tgLong_(chat, text) { // split at 3800 characters on line breaks
  let buf = ''; text.split('\n').forEach(l => { if ((buf + l).length > 3800) { tgSend_(chat, buf); buf = ''; } buf += l + '\n'; }); if (buf.trim()) tgSend_(chat, buf);
}
function askKb_(lang, d) { const k = d.replace(/-/g, ''); return { inline_keyboard: [[{ text: bt_(lang, 'yes'), callback_data: 'a|' + k + '|Y' }], [{ text: bt_(lang, 'no'), callback_data: 'a|' + k + '|N' }]] }; }
function reasonKb_(lang, d) { const k = d.replace(/-/g, ''); return { inline_keyboard: bt_(lang, 'reasons').map((t, i) => [{ text: t, callback_data: 'r|' + k + '|' + i }]) }; }
function langKb_() { return { inline_keyboard: [[{ text: 'English', callback_data: 'l|en' }, { text: 'ಕನ್ನಡ', callback_data: 'l|kn' }, { text: 'हिंदी', callback_data: 'l|hi' }]] }; }

/* send many messages fast but under Telegram's 30/second limit; marks workers who blocked the bot */
function tgBulk_(list) {
  const base = 'https://api.telegram.org/bot' + botTok_() + '/sendMessage'; let sent = 0, failed = 0; const blocked = [];
  for (let i = 0; i < list.length; i += 25) {
    const part = list.slice(i, i + 25);
    const res = UrlFetchApp.fetchAll(part.map(m => ({ url: base, method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      payload: JSON.stringify({ chat_id: m.chat, text: m.text, parse_mode: 'HTML', reply_markup: m.kb }) })));
    res.forEach((r, j) => { if (r.getResponseCode() === 200) sent++; else { failed++; if (r.getResponseCode() === 403) blocked.push(part[j].chat); } });
    if (i + 25 < list.length) Utilities.sleep(1100);
  }
  if (blocked.length) {
    const sh = botSheet_('Workers'), ppl = botPeople_();
    blocked.forEach(id => { const w = ppl.w[String(id)]; if (w) sh.getRange(w.row, 9).setValue('Blocked bot'); });
    botDrop_();
  }
  return { sent: sent, failed: failed, blocked: blocked.length };
}

/* ---------------- replies ---------------- */
function botLatest_(d) { // latest reply per emp code for date d
  const m = {}; botRows_('Attendance').forEach(r => { const rd = r[0] instanceof Date ? Utilities.formatDate(r[0], BOT_TZ, 'yyyy-MM-dd') : String(r[0]); if (rd === d) m[String(r[1])] = { reply: r[5], reason: r[6], time: r[7], late: r[8], by: r[9] }; });
  return m;
}
function botAfterCut_() { return botNow_() >= (botSettings_()['Cut-off time'] || '08:30'); }
function botRecord_(w, d, reply, reason, by) {
  const late = botAfterCut_() && !!PropertiesService.getScriptProperties().getProperty('botSum_' + d);
  botSheet_('Attendance').appendRow([d, w.code, w.name, w.unit, w.line, reply, reason || '', botNow_(), late ? 'Yes' : '', by || 'Self']);
  botSheet_('Workers').getRange(w.row, 11).setValue(d + ' ' + reply);
  const who = '<b>' + botEsc_(w.name) + '</b> (' + botEsc_(w.code) + ') · ' + botEsc_(w.unit) + (w.line ? ' L' + botEsc_(w.line) : '');
  if (reply === 'No' || late) {
    const msg = (late ? '⚠️ <b>Late change</b> (after cut-off)\n' : '❌ <b>Not coming today</b>\n') + who + '\n' + (reply === 'No' ? 'Reason: ' + botEsc_(reason || '-') : '✅ Now says: coming') + (by && by !== 'Self' ? '\nMarked by ' + botEsc_(by) : '');
    const ppl = botPeople_();
    Object.keys(ppl.a).forEach(id => {
      const a = ppl.a[id]; if (!/active/i.test(a.status)) return;
      const inScope = (a.unit.toUpperCase() === 'ALL' || a.unit.toUpperCase() === w.unit.toUpperCase()) && (!a.line || a.line === w.line);
      if (inScope && (a.instant || (late && a.summary))) tgSend_(id, msg);
    });
  }
}

/* ---------------- webhook (called from doPost when ?tg=<secret>) ---------------- */
function botWebhook_(e) {
  const ok = ContentService.createTextOutput('ok');
  try {
    if ((e.parameter || {}).tg !== PropertiesService.getScriptProperties().getProperty('BOT_SECRET')) return ok;
    const u = JSON.parse(e.postData.contents || '{}');
    const c = CacheService.getScriptCache(); if (!u.update_id || c.get('upd_' + u.update_id)) return ok; c.put('upd_' + u.update_id, '1', 21600);
    if (u.callback_query) botCallback_(u.callback_query); else if (u.message) botMessage_(u.message);
  } catch (x) { botLog_('webhook error', x && x.stack || x); }
  return ok;
}

function botMessage_(m) {
  if (!m.chat || m.chat.type !== 'private') return;
  const id = String(m.from.id), text = String(m.text || '').trim(), ppl = botPeople_(), w = ppl.w[id], a = ppl.a[id], d = botToday_();
  const cache = CacheService.getScriptCache();

  if (m.contact) return botJoin_(m, id);
  if (cache.get('awaitcode_' + id) && text && text.charAt(0) !== '/') return botCode_(m, id, text);

  if (/^\/start/.test(text) || (!w && !a)) {
    if (w && /active/i.test(w.status)) return tgSend_(id, bt_(w.lang, 'joined', { n: botEsc_(w.name), u: w.unit, l: w.line ? 'L' + w.line : '' }) + '\n\n' + bt_(w.lang, 'help'));
    if (a) return tgSend_(id, botAdminHelp_(a));
    return tgSend_(id, 'Welcome to <b>TSPL Attendance</b>.\nನಮಸ್ಕಾರ · नमस्ते\n\nTo register, tap the button below to share your phone number.\nನೋಂದಣಿಗಾಗಿ ಕೆಳಗಿನ ಬಟನ್ ಒತ್ತಿ · पंजीकरण के लिए नीचे बटन दबाएँ',
      { keyboard: [[{ text: '📱 Share my phone number', request_contact: true }]], resize_keyboard: true, one_time_keyboard: true });
  }
  if (a) return botAdminCmd_(id, a, text);
  if (!/active/i.test(w.status)) return tgSend_(id, bt_(w.lang, 'pending'));
  if (/^\/lang/.test(text)) return tgSend_(id, 'Choose language / ಭಾಷೆ / भाषा', langKb_());
  if (/^\/status/.test(text)) { const r = botLatest_(d)[w.code]; return tgSend_(id, !botWorkingDay_(d) ? bt_(w.lang, 'off', { d: botNice_(d) }) : r ? bt_(w.lang, 'status', { d: botNice_(d), s: r.reply === 'Yes' ? bt_(w.lang, 'yes') : bt_(w.lang, 'no') + (r.reason ? ' – ' + r.reason : '') }) : bt_(w.lang, 'none', { d: botNice_(d) })); }
  if (/^\/today/.test(text)) return botWorkingDay_(d) ? tgSend_(id, bt_(w.lang, 'ask', { n: botEsc_(w.name), d: botNice_(d) }), askKb_(w.lang, d)) : tgSend_(id, bt_(w.lang, 'off', { d: botNice_(d) }));
  return tgSend_(id, bt_(w.lang, 'help'));
}

function botJoin_(m, id) {
  const ct = m.contact; if (String(ct.user_id) !== id) return tgSend_(id, 'Please share <b>your own</b> number using the button.');
  const mob = botMob_(ct.phone_number), ss = botSS_(), rm = { remove_keyboard: true };
  const ad = botRows_('Admins'); for (let i = 0; i < ad.length; i++) if (botMob_(ad[i][2]) === mob) {
    ss.getSheetByName('Admins').getRange(i + 2, 8, 1, 2).setValues([[id, 'Active']]); botDrop_(); botLog_('admin joined', ad[i][0]);
    return tgSend_(id, '✅ Registered as <b>' + botEsc_(ad[i][1]) + '</b> – ' + botEsc_(ad[i][0]) + ' (' + botEsc_(ad[i][3] || 'All') + (ad[i][4] ? ' L' + botEsc_(ad[i][4]) : '') + ').\n\n' + botAdminHelp_({ role: String(ad[i][1]) }), rm);
  }
  const wr = botRows_('Workers'), auto = /^y/i.test(botSettings_()['Auto-approve when mobile matches'] || 'Yes');
  for (let i = 0; i < wr.length; i++) if (botMob_(wr[i][5]) === mob) {
    const st = auto ? 'Active' : 'Pending';
    ss.getSheetByName('Workers').getRange(i + 2, 8, 1, 3).setValues([[id, st, new Date()]]); botDrop_(); botLog_('worker joined', wr[i][0] + ' ' + st);
    if (!auto) { botAskApproval_(i + 2, wr[i], id); return tgSend_(id, bt_(wr[i][6], 'pending'), rm); }
    tgSend_(id, bt_(wr[i][6] || 'en', 'joined', { n: botEsc_(wr[i][1]), u: wr[i][2], l: wr[i][3] ? 'L' + wr[i][3] : '' }), rm);
    return tgSend_(id, 'Choose language / ಭಾಷೆ ಆಯ್ಕೆಮಾಡಿ / भाषा चुनें', langKb_());
  }
  CacheService.getScriptCache().put('awaitcode_' + id, mob, 3600);
  return tgSend_(id, 'Your number is not in the list yet. Please type your <b>employee code</b>.\nನಿಮ್ಮ ನೌಕರ ಸಂಖ್ಯೆ ಟೈಪ್ ಮಾಡಿ · अपना कर्मचारी कोड लिखें', rm);
}

function botCode_(m, id, code) {
  const cache = CacheService.getScriptCache(), mob = cache.get('awaitcode_' + id); cache.remove('awaitcode_' + id);
  const sh = botSheet_('Workers'), wr = botRows_('Workers'); let row = 0, r;
  for (let i = 0; i < wr.length; i++) if (String(wr[i][0]).trim().toUpperCase() === code.toUpperCase()) { row = i + 2; r = wr[i]; break; }
  const nm = [m.from.first_name, m.from.last_name].filter(Boolean).join(' ');
  if (!row) { sh.appendRow([code, nm, '', '', '', mob, 'en', id, 'Pending', new Date(), '']); row = sh.getLastRow(); r = [code, nm, '', '', '', mob]; }
  else sh.getRange(row, 8, 1, 3).setValues([[id, 'Pending', new Date()]]);
  botDrop_(); botAskApproval_(row, r, id, mob);
  return tgSend_(id, bt_('en', 'pending') + '\n' + bt_('kn', 'pending') + '\n' + bt_('hi', 'pending'));
}

function botAskApproval_(row, r, id, mob) {
  const ppl = botPeople_(), txt = '🆕 <b>Worker wants to join</b>\nCode: ' + botEsc_(r[0]) + '\nName: ' + botEsc_(r[1]) + '\nUnit/Line: ' + botEsc_(r[2] || '?') + ' ' + botEsc_(r[3] || '') + '\nMobile: ' + botEsc_(mob || r[5] || '') + (r[2] ? '' : '\n(Not in the Workers list – fill unit and line in the sheet after approving)');
  Object.keys(ppl.a).forEach(aid => { const a = ppl.a[aid]; if (/^(hr|gm)/i.test(a.role) && /active/i.test(a.status)) tgSend_(aid, txt, { inline_keyboard: [[{ text: '✅ Approve', callback_data: 'ap|' + row + '|' + id }, { text: '✖ Reject', callback_data: 'rj|' + row + '|' + id }]] }); });
}

function botCallback_(q) {
  const id = String(q.from.id), data = String(q.data || ''), p = data.split('|'), ppl = botPeople_(), w = ppl.w[id], a = ppl.a[id];
  const edit = (t, kb) => tg_('editMessageText', { chat_id: q.message.chat.id, message_id: q.message.message_id, text: t, parse_mode: 'HTML', reply_markup: kb || { inline_keyboard: [] } });
  tg_('answerCallbackQuery', { callback_query_id: q.id });
  const d = botToday_(), key = d.replace(/-/g, '');

  if (p[0] === 'l' && w) { botSheet_('Workers').getRange(w.row, 7).setValue(p[1]); botDrop_(); return edit(bt_(p[1], 'lang') + '\n\n' + bt_(p[1], 'help')); }
  if ((p[0] === 'a' || p[0] === 'r') && w) {
    if (!/active/i.test(w.status)) return edit(bt_(w.lang, 'pending'));
    if (p[1] !== key) return edit(bt_(w.lang, 'expired'));
    if (p[0] === 'a' && p[2] === 'Y') { botRecord_(w, d, 'Yes', '', 'Self'); return edit(bt_(w.lang, 'okY', { n: botEsc_(w.name), d: botNice_(d) })); }
    if (p[0] === 'a' && p[2] === 'N') return edit(bt_(w.lang, 'why'), reasonKb_(w.lang, d));
    const reason = BT.en.reasons[+p[2]] || 'Other';
    botRecord_(w, d, 'No', reason, 'Self');
    return edit(bt_(w.lang, 'okN', { n: botEsc_(w.name), d: botNice_(d), r: bt_(w.lang, 'reasons')[+p[2]] || reason }));
  }
  if ((p[0] === 'ap' || p[0] === 'rj') && a && /^(hr|gm)/i.test(a.role)) {
    const sh = botSheet_('Workers'), row = +p[1], r = sh.getRange(row, 1, 1, 11).getValues()[0];
    if (String(r[7]) !== p[2]) return edit('This request is out of date.');
    if (String(r[8]) !== 'Pending') return edit('Already handled: ' + botEsc_(r[8]) + ' (' + botEsc_(r[1]) + ')');
    sh.getRange(row, 9).setValue(p[0] === 'ap' ? 'Active' : 'Rejected'); botDrop_();
    if (p[0] === 'ap') { tgSend_(p[2], bt_(r[6] || 'en', 'joined', { n: botEsc_(r[1]), u: r[2], l: r[3] ? 'L' + r[3] : '' })); tgSend_(p[2], 'Choose language / ಭಾಷೆ / भाषा', langKb_()); }
    botLog_(p[0] === 'ap' ? 'approved' : 'rejected', r[0] + ' by ' + a.name);
    return edit((p[0] === 'ap' ? '✅ Approved: ' : '✖ Rejected: ') + botEsc_(r[1]) + ' (' + botEsc_(r[0]) + ') by ' + botEsc_(a.name));
  }
  if (p[0] === 'px' && a) { // supervisor marks a worker of their line
    const wr = botRows_('Workers'); let row = 0; for (let i = 0; i < wr.length; i++) if (String(wr[i][0]) === p[1]) { row = i + 2; break; }
    if (!row) return edit('Worker not found');
    const r = wr[row - 2], wk = { row: row, code: String(r[0]), name: String(r[1]), unit: String(r[2]), line: String(r[3]) };
    if (!botAdminSees_(a, wk)) return edit('Not in your line.');
    botRecord_(wk, d, p[2] === 'Y' ? 'Yes' : 'No', p[2] === 'Y' ? '' : 'Marked by supervisor', a.name);
    return edit((p[2] === 'Y' ? '✅ ' : '❌ ') + botEsc_(wk.name) + ' marked ' + (p[2] === 'Y' ? 'coming' : 'not coming') + '. Send /line for the rest.');
  }
}

/* ---------------- admins ---------------- */
function botAdminHelp_(a) {
  return 'Admin commands:\n/today – attendance now (your units)\n/absent [unit] – who is not coming\n/notreplied [unit] – who has not answered' + (/super/i.test(a.role) ? '\n/line – mark workers of your line who have not answered' : '') + '\n/help – this list';
}
function botAdminSees_(a, w) { return (a.unit.toUpperCase() === 'ALL' || a.unit.toUpperCase() === String(w.unit).toUpperCase()) && (!a.line || a.line === String(w.line)); }
function botAdminCmd_(id, a, text) {
  const d = botToday_(), arg = text.split(/\s+/)[1] || '';
  if (/^\/today/.test(text)) return tgLong_(id, botSummaryText_(a, d, arg));
  if (/^\/absent/.test(text)) return tgLong_(id, botListText_(a, d, 'No', arg));
  if (/^\/notreplied/.test(text)) return tgLong_(id, botListText_(a, d, '', arg));
  if (/^\/line/.test(text)) {
    const lat = botLatest_(d), todo = botActive_().filter(w => botAdminSees_(a, w) && !lat[w.code]).slice(0, 40);
    if (!todo.length) return tgSend_(id, 'Everyone in your line has answered for today. 👍');
    todo.forEach(w => tgSend_(id, botEsc_(w.name) + ' (' + botEsc_(w.code) + ') L' + botEsc_(w.line), { inline_keyboard: [[{ text: '✅ Coming', callback_data: 'px|' + w.code + '|Y' }, { text: '❌ Not coming', callback_data: 'px|' + w.code + '|N' }]] }));
    return;
  }
  return tgSend_(id, botAdminHelp_(a));
}
function botActive_() {
  return botRows_('Workers').map((r, i) => ({ row: i + 2, code: String(r[0]), name: String(r[1]), unit: String(r[2]), line: String(r[3]), lang: String(r[6] || 'en'), tg: String(r[7]), status: String(r[8]) }))
    .filter(w => w.tg && /active/i.test(w.status) && botInPilot_(w.unit));
}
function botSummaryText_(a, d, only) {
  const lat = botLatest_(d), ws = botActive_().filter(w => botAdminSees_(a, w) && (!only || w.unit.toUpperCase() === only.toUpperCase()));
  if (!botWorkingDay_(d)) return 'Today (' + botNice_(d) + ') is a holiday / weekly off.';
  const g = {}, tot = { y: 0, n: 0, p: 0 };
  ws.forEach(w => { const k = w.unit || '?', l = w.line || '-'; g[k] = g[k] || { y: 0, n: 0, p: 0, lines: {} }; g[k].lines[l] = g[k].lines[l] || { y: 0, n: 0, p: 0 };
    const r = lat[w.code], f = !r ? 'p' : r.reply === 'Yes' ? 'y' : 'n'; g[k][f]++; g[k].lines[l][f]++; tot[f]++; });
  const out = ['📋 <b>Attendance – ' + botNice_(d) + '</b> (as of ' + botNow_() + ')', 'Registered: ' + ws.length + ' · ✅ ' + tot.y + ' · ❌ ' + tot.n + ' · ⏳ ' + tot.p, ''];
  Object.keys(g).sort().forEach(k => {
    out.push('<b>' + botEsc_(k) + '</b> – ✅ ' + g[k].y + ' · ❌ ' + g[k].n + ' · ⏳ ' + g[k].p);
    Object.keys(g[k].lines).sort((x, y) => (parseFloat(x) || 0) - (parseFloat(y) || 0)).forEach(l => { const v = g[k].lines[l]; if (v.n || v.p) out.push('   Line ' + botEsc_(l) + ': ✅' + v.y + ' ❌' + v.n + ' ⏳' + v.p); });
  });
  const no = ws.filter(w => lat[w.code] && lat[w.code].reply === 'No');
  if (no.length) { out.push('', '<b>Not coming</b>'); no.slice(0, 60).forEach(w => out.push('• ' + botEsc_(w.name) + ' (' + botEsc_(w.code) + ') ' + botEsc_(w.unit) + ' L' + botEsc_(w.line) + ' – ' + botEsc_(lat[w.code].reason || '-'))); if (no.length > 60) out.push('… +' + (no.length - 60) + ' more: send /absent'); }
  out.push('', '⏳ = not answered · /notreplied for the list');
  return out.join('\n');
}
function botListText_(a, d, kind, only) {
  const lat = botLatest_(d), ws = botActive_().filter(w => botAdminSees_(a, w) && (!only || w.unit.toUpperCase() === only.toUpperCase()));
  const list = ws.filter(w => kind === 'No' ? lat[w.code] && lat[w.code].reply === 'No' : !lat[w.code]);
  if (!list.length) return kind === 'No' ? 'Nobody has said "not coming" today.' : 'Everyone has answered today. 👍';
  return '<b>' + (kind === 'No' ? 'Not coming' : 'Not answered') + ' – ' + botNice_(d) + '</b> (' + list.length + ')\n' +
    list.map(w => '• ' + botEsc_(w.name) + ' (' + botEsc_(w.code) + ') ' + botEsc_(w.unit) + ' L' + botEsc_(w.line) + (kind === 'No' ? ' – ' + botEsc_(lat[w.code].reason || '-') : '')).join('\n');
}

/* ---------------- daily timer (every 5 minutes) ---------------- */
function botTick() {
  if (!PropertiesService.getScriptProperties().getProperty('TG_TOKEN')) return 'no token';
  const d = botToday_(), now = botNow_(), P = PropertiesService.getScriptProperties();
  if (now < '05:00' || now > '13:00') return 'outside morning window';
  const s = botSettings_();
  if (!botWorkingDay_(d)) return 'off day';
  const lock = LockService.getScriptLock(); if (!lock.tryLock(1000)) return 'busy';
  try {
    const cut = s['Cut-off time'] || '08:30';
    if (now >= (s['Ask time'] || '07:00') && now < cut && !P.getProperty('botAsk_' + d)) {
      P.setProperty('botAsk_' + d, '1');
      const ws = botActive_(), r = tgBulk_(ws.map(w => ({ chat: w.tg, text: bt_(w.lang, 'ask', { n: botEsc_(w.name), d: botNice_(d) }), kb: askKb_(w.lang, d) })));
      botLog_('morning question', ws.length + ' workers · sent ' + r.sent + ' · failed ' + r.failed + ' · blocked ' + r.blocked);
    }
    if (now >= (s['Reminder time'] || '08:00') && now < cut && P.getProperty('botAsk_' + d) && !P.getProperty('botRem_' + d)) {
      P.setProperty('botRem_' + d, '1');
      const lat = botLatest_(d), ws = botActive_().filter(w => !lat[w.code]);
      const r = tgBulk_(ws.map(w => ({ chat: w.tg, text: bt_(w.lang, 'remind', { d: botNice_(d) }), kb: askKb_(w.lang, d) })));
      botLog_('reminder', ws.length + ' workers · sent ' + r.sent);
    }
    if (now >= cut && !P.getProperty('botSum_' + d) && P.getProperty('botAsk_' + d)) {
      P.setProperty('botSum_' + d, '1');
      const ppl = botPeople_(); let n = 0;
      Object.keys(ppl.a).forEach(id => { const a = ppl.a[id]; if (a.summary && /active/i.test(a.status)) { tgLong_(id, botSummaryText_(a, d, '')); n++; } });
      botLog_('cut-off summary', 'sent to ' + n + ' admins');
    }
  } finally { lock.releaseLock(); }
  // tidy old day flags (keep 7 days)
  Object.keys(P.getProperties()).forEach(k => { const m = k.match(/^bot(?:Ask|Rem|Sum)_(\d{4}-\d{2}-\d{2})$/); if (m && (new Date(d) - new Date(m[1])) / 864e5 > 7) P.deleteProperty(k); });
  return 'ok';
}

/* ---------------- one-time setup ---------------- */
function botSetup() {
  const P = PropertiesService.getScriptProperties();
  let ss; const have = P.getProperty('BOT_SS');
  if (have) { try { ss = SpreadsheetApp.openById(have); } catch (e) {} }
  if (!ss) { ss = SpreadsheetApp.create('TSPL Attendance Bot'); P.setProperty('BOT_SS', ss.getId()); }
  Object.keys(BOT_HEAD).forEach((n, i) => {
    let sh = ss.getSheetByName(n);
    if (!sh) { sh = i === 0 && ss.getSheets().length === 1 && ss.getSheets()[0].getLastRow() === 0 ? ss.getSheets()[0].setName(n) : ss.insertSheet(n); }
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, BOT_HEAD[n].length).setValues([BOT_HEAD[n]]).setFontWeight('bold').setBackground('#0B2545').setFontColor('#FFFFFF');
      sh.setFrozenRows(1);
      sh.autoResizeColumns(1, BOT_HEAD[n].length);
    }
  });
  const st = ss.getSheetByName('Settings'); st.getRange('B:B').setNumberFormat('@'); if (st.getLastRow() < 2) st.getRange(2, 1, BOT_DEFAULTS.length, 3).setValues(BOT_DEFAULTS);
  ['Workers', 'Admins'].forEach(n => { const sh = ss.getSheetByName(n); sh.getRange('F:F').setNumberFormat('@'); if (n === 'Admins') sh.getRange('C:C').setNumberFormat('@'); sh.getRange('H:H').setNumberFormat('@'); });
  ss.getSheetByName('Workers').getRange('A:A').setNumberFormat('@');
  ss.getSheetByName('Attendance').getRange('A:A').setNumberFormat('@'); ss.getSheetByName('Attendance').getRange('H:H').setNumberFormat('@');
  if (!P.getProperty('BOT_SECRET')) P.setProperty('BOT_SECRET', Utilities.getUuid().replace(/-/g, ''));
  botDrop_();
  return { ok: true, sheet: ss.getUrl() };
}

/** run after TG_TOKEN is saved in Script properties */
function botConnect() {
  const P = PropertiesService.getScriptProperties();
  const me = tg_('getMe', {}); if (!me.ok) throw new Error('Token not accepted by Telegram');
  const hook = tg_('setWebhook', { url: BOT_URL + '?tg=' + P.getProperty('BOT_SECRET'), allowed_updates: ['message', 'callback_query'], drop_pending_updates: true, max_connections: 20 });
  tg_('setMyCommands', { commands: [{ command: 'today', description: 'Answer: coming to work today?' }, { command: 'status', description: 'See my answer' }, { command: 'lang', description: 'Change language' }, { command: 'help', description: 'Help' }] });
  if (!ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'botTick')) ScriptApp.newTrigger('botTick').timeBased().everyMinutes(5).create();
  botLog_('connected', '@' + me.result.username);
  return { ok: !!hook.ok, bot: '@' + me.result.username, webhook: hook.description || '' };
}
function botStatus() { return { token: !!PropertiesService.getScriptProperties().getProperty('TG_TOKEN'), hook: tg_('getWebhookInfo', {}).result }; }
