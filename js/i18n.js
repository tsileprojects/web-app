/* TSPL labels in English, Kannada and Hindi.
   Use:  TSPL_T('key')  or put data-i18n="key" (text), data-i18n-ph="key" (placeholder),
         data-i18n-tip="key" (tooltip) on an element and call TSPL_I18N.apply().
   Program names, unit codes and numbers are not translated. */
(function () {
  'use strict';
  var D = {
    en: {
      search: 'Search programs…', pinned: 'Pinned', noMatch: 'No program matches.',
      tipTheme: 'Dark / light mode. Your choice is remembered on this computer.',
      tipTv: 'TV display. Full-screen live board for the floor or meeting-room TV.',
      tipStatus: 'Program status. Which programs are working, down or need login.',
      tipReport: 'Daily report. Unit summary with line-wise detail, notes and Excel / PDF download.',
      tipLang: 'Language: English / ಕನ್ನಡ / हिंदी',
      tipBell: 'Notifications. Program errors found by the monitor.',
      tipAsk: 'Ask TSPL. Ask a question in plain words.',
      tipFull: 'Full screen. Press Esc to come back.',
      loading: 'Loading…', loadingDash: 'Loading dashboard…', updatedNow: 'updated just now', updatedMin: 'updated {n} min ago',
      refresh: 'Refresh', unit: 'Unit', line: 'Line', output: 'Output', target: 'Target', achieved: 'Achieved',
      efficiency: 'Efficiency', thisMonth: 'This month', lastMonth: 'Last month', change: 'Change',
      ftr: 'End-line FTR', fsa: 'FSA pass %', quality: 'Quality - month to date', notes: 'Notes',
      outputVsTarget: 'Output vs target', needsAttention: 'Needs attention', allOnTrack: 'All units on track. Well done!',
      vsDayBefore: 'vs day before', monthVsLast: 'this month vs last', lastDays: 'Last {n} days', pcs: 'pcs',
      noDqr: 'No DQR data', noAudits: 'No audits yet', ranking: 'Efficiency ranking', unitsSlide: 'Units - production & efficiency',
      tryAgain: 'Still collecting the live numbers. Trying again in 1 minute…',
      working: 'Working', problem: 'Problem', loginNeeded: 'Login needed', notMonitored: 'Not monitored', notChecked: 'Not checked',
      program: 'Program', status: 'Status', lastChecked: 'Last checked', searchProg: 'Search program or page…', programStatus: 'Program Status',
      dailyReport: 'Daily Report', downloadXls: 'Download Excel', printPdf: 'Print / PDF', clickUnit: 'Click a unit to see line-wise detail.',
      buyer: 'Buyer', style: 'Style', mp: 'Operators', remark: 'Remark', dft: 'Defective %',
      addNote: 'Add a note', notePh: 'What happened? e.g. Line 4 down 2 hours - power cut', yourName: 'Your name', save: 'Save note',
      date: 'Date', allUnits: 'All units (TSPL)', noNotes: 'No notes yet.', saved: 'Saved.', by: 'by', back: 'Back to summary'
    },
    kn: {
      search: 'ಪ್ರೋಗ್ರಾಂ ಹುಡುಕಿ…', pinned: 'ಪಿನ್ ಮಾಡಿದವು', noMatch: 'ಯಾವುದೇ ಪ್ರೋಗ್ರಾಂ ಸಿಗಲಿಲ್ಲ.',
      tipTheme: 'ಡಾರ್ಕ್ / ಲೈಟ್ ಮೋಡ್. ನಿಮ್ಮ ಆಯ್ಕೆಯನ್ನು ಈ ಕಂಪ್ಯೂಟರ್ ನೆನಪಿಟ್ಟುಕೊಳ್ಳುತ್ತದೆ.',
      tipTv: 'ಟಿವಿ ಡಿಸ್‌ಪ್ಲೇ. ಫ್ಲೋರ್ ಅಥವಾ ಮೀಟಿಂಗ್ ರೂಮ್ ಟಿವಿಗಾಗಿ ಲೈವ್ ಬೋರ್ಡ್.',
      tipStatus: 'ಪ್ರೋಗ್ರಾಂ ಸ್ಥಿತಿ. ಯಾವ ಪ್ರೋಗ್ರಾಂಗಳು ಕೆಲಸ ಮಾಡುತ್ತಿವೆ, ಯಾವುದು ನಿಂತಿದೆ.',
      tipReport: 'ದೈನಂದಿನ ವರದಿ. ಯುನಿಟ್ ಸಾರಾಂಶ, ಲೈನ್ ವಿವರ, ಟಿಪ್ಪಣಿಗಳು ಮತ್ತು Excel / PDF ಡೌನ್‌ಲೋಡ್.',
      tipLang: 'ಭಾಷೆ: English / ಕನ್ನಡ / हिंदी',
      tipBell: 'ಸೂಚನೆಗಳು. ಮಾನಿಟರ್ ಕಂಡುಹಿಡಿದ ಪ್ರೋಗ್ರಾಂ ದೋಷಗಳು.',
      tipAsk: 'Ask TSPL. ಸರಳ ಪದಗಳಲ್ಲಿ ಪ್ರಶ್ನೆ ಕೇಳಿ.',
      tipFull: 'ಪೂರ್ಣ ಪರದೆ. ಹಿಂದಿರುಗಲು Esc ಒತ್ತಿರಿ.',
      loading: 'ಲೋಡ್ ಆಗುತ್ತಿದೆ…', loadingDash: 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್ ಲೋಡ್ ಆಗುತ್ತಿದೆ…', updatedNow: 'ಈಗಷ್ಟೇ ಅಪ್‌ಡೇಟ್ ಆಗಿದೆ', updatedMin: '{n} ನಿಮಿಷ ಹಿಂದೆ ಅಪ್‌ಡೇಟ್',
      refresh: 'ರಿಫ್ರೆಶ್', unit: 'ಯುನಿಟ್', line: 'ಲೈನ್', output: 'ಉತ್ಪಾದನೆ', target: 'ಗುರಿ', achieved: 'ಸಾಧನೆ',
      efficiency: 'ದಕ್ಷತೆ', thisMonth: 'ಈ ತಿಂಗಳು', lastMonth: 'ಕಳೆದ ತಿಂಗಳು', change: 'ಬದಲಾವಣೆ',
      ftr: 'ಎಂಡ್-ಲೈನ್ FTR', fsa: 'FSA ಪಾಸ್ %', quality: 'ಗುಣಮಟ್ಟ - ಈ ತಿಂಗಳು', notes: 'ಟಿಪ್ಪಣಿಗಳು',
      outputVsTarget: 'ಉತ್ಪಾದನೆ / ಗುರಿ', needsAttention: 'ಗಮನ ಬೇಕು', allOnTrack: 'ಎಲ್ಲಾ ಯುನಿಟ್‌ಗಳು ಸರಿಯಾಗಿವೆ. ಶಾಭಾಷ್!',
      vsDayBefore: 'ಹಿಂದಿನ ದಿನಕ್ಕೆ ಹೋಲಿಸಿದರೆ', monthVsLast: 'ಈ ತಿಂಗಳು / ಕಳೆದ ತಿಂಗಳು', lastDays: 'ಕಳೆದ {n} ದಿನಗಳು', pcs: 'ಪೀಸ್',
      noDqr: 'DQR ಡೇಟಾ ಇಲ್ಲ', noAudits: 'ಆಡಿಟ್ ಇನ್ನೂ ಇಲ್ಲ', ranking: 'ದಕ್ಷತೆ ಶ್ರೇಣಿ', unitsSlide: 'ಯುನಿಟ್‌ಗಳು - ಉತ್ಪಾದನೆ ಮತ್ತು ದಕ್ಷತೆ',
      tryAgain: 'ಲೈವ್ ಸಂಖ್ಯೆಗಳನ್ನು ಸಂಗ್ರಹಿಸಲಾಗುತ್ತಿದೆ. 1 ನಿಮಿಷದಲ್ಲಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸುತ್ತದೆ…',
      working: 'ಕೆಲಸ ಮಾಡುತ್ತಿದೆ', problem: 'ಸಮಸ್ಯೆ', loginNeeded: 'ಲಾಗಿನ್ ಬೇಕು', notMonitored: 'ಮಾನಿಟರ್ ಇಲ್ಲ', notChecked: 'ಪರಿಶೀಲಿಸಿಲ್ಲ',
      program: 'ಪ್ರೋಗ್ರಾಂ', status: 'ಸ್ಥಿತಿ', lastChecked: 'ಕೊನೆಯ ಪರಿಶೀಲನೆ', searchProg: 'ಪ್ರೋಗ್ರಾಂ ಅಥವಾ ಪುಟ ಹುಡುಕಿ…', programStatus: 'ಪ್ರೋಗ್ರಾಂ ಸ್ಥಿತಿ',
      dailyReport: 'ದೈನಂದಿನ ವರದಿ', downloadXls: 'Excel ಡೌನ್‌ಲೋಡ್', printPdf: 'ಪ್ರಿಂಟ್ / PDF', clickUnit: 'ಲೈನ್ ವಿವರ ನೋಡಲು ಯುನಿಟ್ ಮೇಲೆ ಕ್ಲಿಕ್ ಮಾಡಿ.',
      buyer: 'ಬೈಯರ್', style: 'ಸ್ಟೈಲ್', mp: 'ಆಪರೇಟರ್‌ಗಳು', remark: 'ಟಿಪ್ಪಣಿ', dft: 'ದೋಷ %',
      addNote: 'ಟಿಪ್ಪಣಿ ಸೇರಿಸಿ', notePh: 'ಏನಾಯಿತು? ಉದಾ: ಲೈನ್ 4 - 2 ಗಂಟೆ ನಿಂತಿತ್ತು - ಕರೆಂಟ್ ಇರಲಿಲ್ಲ', yourName: 'ನಿಮ್ಮ ಹೆಸರು', save: 'ಉಳಿಸಿ',
      date: 'ದಿನಾಂಕ', allUnits: 'ಎಲ್ಲಾ ಯುನಿಟ್‌ಗಳು (TSPL)', noNotes: 'ಇನ್ನೂ ಟಿಪ್ಪಣಿಗಳಿಲ್ಲ.', saved: 'ಉಳಿಸಲಾಗಿದೆ.', by: '-', back: 'ಸಾರಾಂಶಕ್ಕೆ ಹಿಂತಿರುಗಿ'
    },
    hi: {
      search: 'प्रोग्राम खोजें…', pinned: 'पिन किए गए', noMatch: 'कोई प्रोग्राम नहीं मिला।',
      tipTheme: 'डार्क / लाइट मोड। आपकी पसंद इस कंप्यूटर पर याद रहती है।',
      tipTv: 'टीवी डिस्प्ले। फ्लोर या मीटिंग रूम टीवी के लिए लाइव बोर्ड।',
      tipStatus: 'प्रोग्राम स्थिति। कौन से प्रोग्राम चल रहे हैं, कौन से बंद हैं।',
      tipReport: 'दैनिक रिपोर्ट। यूनिट सारांश, लाइन विवरण, नोट्स और Excel / PDF डाउनलोड।',
      tipLang: 'भाषा: English / ಕನ್ನಡ / हिंदी',
      tipBell: 'सूचनाएं। मॉनिटर द्वारा मिली प्रोग्राम त्रुटियां।',
      tipAsk: 'Ask TSPL। सरल शब्दों में सवाल पूछें।',
      tipFull: 'पूरी स्क्रीन। वापस आने के लिए Esc दबाएं।',
      loading: 'लोड हो रहा है…', loadingDash: 'डैशबोर्ड लोड हो रहा है…', updatedNow: 'अभी अपडेट हुआ', updatedMin: '{n} मिनट पहले अपडेट',
      refresh: 'रिफ्रेश', unit: 'यूनिट', line: 'लाइन', output: 'उत्पादन', target: 'लक्ष्य', achieved: 'प्राप्त',
      efficiency: 'दक्षता', thisMonth: 'इस महीने', lastMonth: 'पिछले महीने', change: 'बदलाव',
      ftr: 'एंड-लाइन FTR', fsa: 'FSA पास %', quality: 'गुणवत्ता - इस महीने', notes: 'नोट्स',
      outputVsTarget: 'उत्पादन / लक्ष्य', needsAttention: 'ध्यान दें', allOnTrack: 'सभी यूनिट ठीक चल रही हैं। शाबाश!',
      vsDayBefore: 'पिछले दिन की तुलना में', monthVsLast: 'इस महीने / पिछले महीने', lastDays: 'पिछले {n} दिन', pcs: 'पीस',
      noDqr: 'DQR डेटा नहीं', noAudits: 'अभी कोई ऑडिट नहीं', ranking: 'दक्षता रैंकिंग', unitsSlide: 'यूनिट - उत्पादन और दक्षता',
      tryAgain: 'लाइव आंकड़े जुटाए जा रहे हैं। 1 मिनट में फिर कोशिश होगी…',
      working: 'चल रहा है', problem: 'समस्या', loginNeeded: 'लॉगिन चाहिए', notMonitored: 'मॉनिटर नहीं', notChecked: 'जांचा नहीं',
      program: 'प्रोग्राम', status: 'स्थिति', lastChecked: 'आखिरी जांच', searchProg: 'प्रोग्राम या पेज खोजें…', programStatus: 'प्रोग्राम स्थिति',
      dailyReport: 'दैनिक रिपोर्ट', downloadXls: 'Excel डाउनलोड', printPdf: 'प्रिंट / PDF', clickUnit: 'लाइन विवरण देखने के लिए यूनिट पर क्लिक करें।',
      buyer: 'बायर', style: 'स्टाइल', mp: 'ऑपरेटर', remark: 'टिप्पणी', dft: 'दोष %',
      addNote: 'नोट जोड़ें', notePh: 'क्या हुआ? जैसे: लाइन 4 - 2 घंटे बंद - बिजली नहीं थी', yourName: 'आपका नाम', save: 'नोट सेव करें',
      date: 'तारीख', allUnits: 'सभी यूनिट (TSPL)', noNotes: 'अभी कोई नोट नहीं।', saved: 'सेव हो गया।', by: '-', back: 'सारांश पर वापस'
    }
  };
  var lang = 'en';
  try { lang = localStorage.getItem('tsplLang') || 'en'; } catch (e) {}
  if (!D[lang]) lang = 'en';
  function t(k, vars) {
    var s = (D[lang] && D[lang][k]) || D.en[k] || k;
    if (vars) Object.keys(vars).forEach(function (v) { s = s.replace('{' + v + '}', vars[v]); });
    return s;
  }
  function apply(root) {
    root = root || document;
    root.querySelectorAll('[data-i18n]').forEach(function (e) { e.textContent = t(e.getAttribute('data-i18n')); });
    root.querySelectorAll('[data-i18n-ph]').forEach(function (e) { e.setAttribute('placeholder', t(e.getAttribute('data-i18n-ph'))); });
    root.querySelectorAll('[data-i18n-tip]').forEach(function (e) { e.setAttribute('data-tip', t(e.getAttribute('data-i18n-tip'))); });
    document.documentElement.setAttribute('lang', lang);
  }
  function set(l) {
    if (!D[l]) return;
    try { localStorage.setItem('tsplLang', l); } catch (e) {}
    location.reload();
  }
  window.TSPL_T = t;
  window.TSPL_I18N = { t: t, apply: apply, set: set, lang: function () { return lang; }, langs: [['en', 'EN'], ['kn', 'ಕನ್ನಡ'], ['hi', 'हिंदी']] };
})();
