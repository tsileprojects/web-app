/**
 * ==============================================================
 *  ASK TSPL  -  plain-language questions over your Google Sheets
 *  (second file of the "TSPL Error Monitor" Apps Script project)
 * ==============================================================
 *  How it works
 *   1. The question goes to Google Gemini together with a description
 *      of your sheets (column guide below).
 *   2. Gemini writes up to 4 READ-ONLY sheet queries (Google Query
 *      Language - the same as =QUERY() in Sheets).
 *   3. This script runs them on the live sheet and gets exact numbers.
 *   4. Gemini writes a short answer from those numbers only.
 *  The numbers always come from your sheet, not from the AI's memory.
 *  Nothing is ever written to your data sheets.
 *
 *  ONE-TIME SETUP
 *   Project Settings (gear icon) > Script Properties > Add property
 *     GEMINI_API_KEY = <your key from https://aistudio.google.com/apikey>
 *   (optional) GEMINI_MODEL = a specific model id; blank = newest Flash model
 * ==============================================================
 */

const ASK = {
  MAX_QUERIES: 6,
  MAX_ROWS_TO_AI: 60,       // rows of each result shown to the AI for writing the answer
  MAX_ROWS_TO_USER: 200,
  SOURCES: [
    {
      key: 'FSA',
      name: 'FSA / final audit data - all units',
      id: '1_PPSVI0IBkLGmEJRPA1ioA2KBSLdJlNKFxEI3k7V1f8',     // 00_FSA_C_Datamaster_7
      sheet: 'FSA_DM_7', dateCol: 'D',
      guide: [
        'One row per DEFECT LINE of an audit report; report-level columns repeat on every row of that report.',
        'Every report has exactly ONE row with AW = 1.',
        'RULE 1: For anything counted per audit/report (number of audits, pass/fail, pass %, offered qty, sample qty, found major/minor, AQL limits), ALWAYS add "AW = 1" to the WHERE clause.',
        'RULE 2: For defect counts by defect type / category / location, do NOT filter AW = 1; use sum(BB) for major defects and sum(BD) for minor defects (total defects = sum(BB) + sum(BD)).',
        'Columns:',
        ' D  Audit Date (date type). Filter like: D >= date \'2026-10-01\' and D < date \'2026-11-01\'',
        ' E  Report No.',
        ' F  Unit / factory. Values: AP2, FIPL, TS2, TS4, TS9. "AP" or "Anantapur" means AP2.',
        ' G  Floor. Values seen: AP1, AP2 (both in unit AP2), TS9 First Floor, TS9 Second Floor, TS4 Ground Floor, TS4 Top Floor, FIPL NA, TS2 NA, NA NA.',
        ' H  Auditor Name',
        ' I  Audit Type: FSA, Re-FSA, FSA / FINAL, FINAL, Carton Audit, DUPRO, 1st Output Review, 3rd Day Output Review',
        ' J  3rd Party Audit (e.g. QIMA, N/A)',
        ' K  Buyer: Primark, AEO knits, AEO woven, AEO, Zudio, Matalan, Disney, A&F Haddad, A&F, Tommy, Greg Norman, Kenneth cole, Johnston & Murphy, Joules, Nautica',
        ' L  Style No.   M PO No.   N Style Description (free text)   O Brand Name   Q Color',
        ' R  Order Quantity   S Offered Quantity   V Sample Pull Out (pieces inspected)',
        ' AK Measurement result (true/false)   AL Packing Visual   AM Carton Audit',
        ' AN Final Result: PASS or FAIL',
        ' AP Action taken (mostly N/A)',
        ' AR Lot size range   AS Allowed Major   AT Allowed Minor (AQL limits)',
        ' AU Found Major (per report)   AV Found Minor (per report)',
        ' AX Defect Category: Man, Machine, Wash, Material',
        ' AY Defect Type, e.g. Uncut Thread, Broken Stitch, Stain Mark, Oil Stain, Handling Stain, Shade Variation, Shape Off, High Low, Puckering, Skip Stitch, Damage, Raw Edge, Pleats, Open Seam, Poor Pressing, Ready Stitch, Others',
        ' AZ Defect location / operation (free text, e.g. "@ bottom hem")',
        ' BB Major defect count on this defect line   BD Minor defect count on this defect line',
        'Text values can have different case or trailing spaces: use lower(K) contains \'aeo\' or lower(N) contains \'beach\' for buyers, styles and descriptions.',
        'Formulas: Pass % = PASS reports / (PASS + FAIL reports) x 100 -> query: select AN, count(E) where AW = 1 and ... group by AN.',
        '          Defect rate (OQL %) = (sum(AU) + sum(AV)) / sum(V) x 100, with AW = 1.',
        'Unless the user names an audit type, include all audit types and say so.'
      ].join('\n')
    },
    {
      key: 'PROD',
      name: 'DPR - daily sewing production by line (all units)',
      id: '1GtxRnSbt74rvsNMj8WAUAFRZhZlqEEKTgYMD2MFc62E', sheet: 'DPR_DM_L1', dateCol: 'C',   // 00_DPR_Datamaster_Live_1.0
      guide: [
        'One row per sewing line per day. Use for production qty, targets, target achievement, manpower, cutting/loading, WIP, line staff.',
        'For EFFICIENCY % use source EFF (it has available/earned minutes).',
        ' C Date   D Unit (FIPL, TS2, TS4, TS9, AP2)   E Dept. (Sew; HR rows are manpower-only - normally filter E = \'Sew\')',
        ' F Line No. (text: 1, 1A, 4...)   G Buyer   H Style No. (text, often starts with "# ")   I Color   J Order Qty',
        ' K Today Cut   L Cum Cut   M Cutting MP   N Today Load   O Cum Load',
        ' P OB SAM   Q OB MP [T]   R OB MP [O]   T Ptl Target (potential)   X Unit Target (planned target for the day)',
        ' V Utlised MP [T]   AP Utlised MP (total operators used)',
        ' Z Sew Batch Status: R = running, BS = batch start, SC = style change, SS = style start, L Off = line off, Un T = untrained',
        ' AA Running Days on style   AB..AJ hourly output 1st..9th hour   AK Today Pro (pieces produced today)   AL Cum Pro   AM Line WIP',
        ' AN Sew Downtime Status   AO Note/Remarks   AX Cost of Make   AY Booked Eff % (fraction 0.53 = 53%)',
        ' BC Floor   BD AVP   BE GM   BF FM   BG PM   BH Floor IC   BI Line Supervisor   BK IE Manager   BO QC Manager   BP QC Incharge',
        'Target achievement % = sum(AK) / sum(X) x 100 (ignore rows where X = 0). Output per operator = sum(AK)/sum(AP).'
      ].join('\n')
    },
    {
      key: 'EFF',
      name: 'Line efficiency & COT (change-over) - daily per line (all units)',
      id: '1yjSi_FswtY1Edle7SUa5dyHm9biBLmPbG7AgiewJvh4', sheet: 'DPR_Data', dateCol: 'C',    // 00_COT_Datamaster_Live_1.0
      guide: [
        'One row per sewing line per day (updated up to yesterday). Use for EFFICIENCY %, earned/available minutes and change-over (COT) performance.',
        ' C Date   D Unit (FIPL, TS2, TS4, TS9, AP2)   E Dept (Sew)   F Line No   G Buyer   H Style No   I Color',
        ' J OB SAM   K OB MP [T]   L Ptl Target   M Utilised MP   N Unit Target   O Sew Batch Status (R, SC, SS, BS, L Off)',
        ' P Today Pro   Q Aval Min (available minutes)   R Earn Min (earned minutes)   S Eff % (text like "60.21%")',
        ' T Number of Days Run on style   U COT Eff% Slab (target eff for that day of change-over)   V COT Day Result (Achived / Not Achived / NA)',
        ' W Over Result (Achived / Not Achived / NA)   X Day Status (Start Day, Intital Day, Progress Day, Last Day)',
        'EFFICIENCY % = sum(R) / sum(Q) x 100 -> query select D, sum(R), sum(Q) ... group by D. Never average column S.',
        'COT success = count of rows with V = \'Achived\' vs \'Not Achived\'.'
      ].join('\n')
    },
    {
      key: 'QUAL',
      name: 'DQR - daily end-line sewing quality by line (all units)',
      id: '1RDkql2lORQorVp6nRGX2vX4hiPJGR-VumiwHFZ0Qh0Y', sheet: 'DQR_DM_L1', dateCol: 'C',   // 00_DQR_Datamaster_Live_1.0
      guide: [
        'One row per sewing line per day. Use for end-line checking, FTR (first time right), defective %, rejections, alteration backlog.',
        ' C Date   D Unit (FIPL, TS2, TS4, TS9, AP2)   E Dept. (Sew)   F Line No.   G Buyer   H Style No.   I Color   J Order Qty',
        ' K Today Pro   L Cum Pro   N Check Batch Status (R, SC, BS, L Off, BStop)   O..AF hourly checked/passed pairs',
        ' AG Today Checked Pcs   AH Today FTR Passed Pcs   AI Today Defective Pcs   AJ Today Alteration Backlog',
        ' AK Today Altered Check Pcs   AL Today Altered Passed Pcs   AM Today Rejected Pcs   AO Today Passed Pcs   AQ Today Bal to Check',
        ' AR Today\'s Top 3 Defects (mostly NA)   AU..BE grand totals for the style   BF Floor   BJ PM   BL Line Supervisor   BR QC Manager   BS QC Incharge   BT Batch QC',
        'FTR % = sum(AH) / sum(AG) x 100.  Defective % = sum(AI) / sum(AG) x 100.  Rejection % = sum(AM) / sum(AG) x 100.'
      ].join('\n')
    },
    {
      key: 'CUT',
      name: 'DCR - daily cutting report (cut, load, embroidery/print send)',
      id: '1hrvohBCe5AXglLUeO0GoLPXAvIhpbchsHpMq7j1HRGQ', sheet: 'DCR_all_unit', dateCol: 'C',  // 00_DCR_Datamaster_4.0000
      guide: [
        'One row per style/colour per day. Recent data mainly units FIPL and TS2.',
        ' B Unit   C Date   D Buyer (upper case e.g. MATALAN, AEO, DISNEY)   E Style No.   H Colour',
        ' I Order Qty   J +/- (extra %)   K Cut Order Qty   L Today Cut   M Total Cut   N Bal to Cut',
        ' O Today Load   P Total Load   Q Bal to Load   R Today EMB Send   S Total EMB Send   T Bal to EMB Send',
        ' U Today PRINT Send   V Total PRINT Send   W Bal to PRINT Send',
        'Balance figures are cumulative per style - for "current balance" use the latest date (B/C filter with {LATEST}).'
      ].join('\n')
    },
    {
      key: 'COTRQ',
      name: 'COT approval requests (IE head / management approvals)',
      id: '17rqWjNTT3JF-4oY0XfQhj7z1bpLUD6WTjV0Eql0RE9E', sheet: 'COT_Rq', dateCol: 'B',       // 01_COT_Approval Request_Live_1.0
      guide: [
        ' A Sl No   B Submit Date   C Submit by   D Unit   E Date (COT date)   F Line   G Style   H Buyer   I Eff %   J Number of Days Run',
        ' K COT Eff% Slab   L COT Day Result   M Downtime Status   N Note/Remarks   O Request Note',
        ' P IE Head Approval_Status   Q IE Head Comments   R Management Approval_Status   S Management Comments'
      ].join('\n')
    },
    {
      key: 'NDLSTK',
      name: 'Needle stock - daily stock per needle type (CMD store and each unit)',
      tables: {
        CMD: { id: '10ts4-o0eV6xUi8QL9J2e9wmiJogVn0nfL0xseSr7J58', sheet: 'Live_Stock' },
        FIPL: { id: '1VaBU9HxJQSsfbvKCVzJGgBuuaussdP97viq2lW3jZwM', sheet: 'Live_Stock' },
        TS2: { id: '1mGX-AcqIazx5q-qUh0GZ2yq23ShYVxMYkyyxJiX-cbY', sheet: 'Live_Stock' },
        TS4: { id: '14IuvKj4YJ7bWnW-cmT2wmd_bDnrIxAtg6wziX8tEjnQ', sheet: 'Live_Stock' },
        TS9: { id: '1EzSzC68bJAQR-ExTLjZ3-f5huDSlNM5GHTNW1kcki2k', sheet: 'Live_Stock' },
        AP2: { id: '1iOe66_UWfSltLbDDLxhuc_eDb_RXxt-Mc-fculnR5kc', sheet: 'Live_Stock' }
      },
      dateCol: 'B',
      guide: [
        'Choose "table": CMD (central store) or a unit FIPL, TS2, TS4, TS9, AP2. One row per needle type per day.',
        ' B Date   C Unit   D Needle_Type (e.g. FFG-CPX12-14|90, FFG-DBX1-14|90 - system-size|metric)',
        ' E Open Stock   F Rec from Line   G Iss to Line   H Send from CMD   I Rec to CMD   J Total Issues   K Total Receives   L Close Stock',
        'CURRENT STOCK = rows on the latest date: where B = {LATEST}. Low stock: add "and L < 10" etc.'
      ].join('\n')
    },
    {
      key: 'NDLISS',
      name: 'Needle issue register - broken / damaged needles replaced at machines',
      tables: {
        FIPL: { id: '1KBAAaBR-uR0kpqkNzm35daUXn-DsocxD9bzMHlqwB0o', sheet: 'FIPL_Ndl_Data' },
        TS2: { id: '1KBAAaBR-uR0kpqkNzm35daUXn-DsocxD9bzMHlqwB0o', sheet: 'TS2_Ndl_Data' },
        TS4: { id: '1KBAAaBR-uR0kpqkNzm35daUXn-DsocxD9bzMHlqwB0o', sheet: 'TS4_Ndl_Data' },
        TS9: { id: '1KBAAaBR-uR0kpqkNzm35daUXn-DsocxD9bzMHlqwB0o', sheet: 'TS9_Ndl_Data' },
        AP2: { id: '1KBAAaBR-uR0kpqkNzm35daUXn-DsocxD9bzMHlqwB0o', sheet: 'AP2_Ndl_Data' },
        EMB: { id: '1KBAAaBR-uR0kpqkNzm35daUXn-DsocxD9bzMHlqwB0o', sheet: 'Emb_Ndl_Data' },
        SMP: { id: '1KBAAaBR-uR0kpqkNzm35daUXn-DsocxD9bzMHlqwB0o', sheet: 'HOSmp_Ndl_Data' }
      },
      dateCol: 'A',
      guide: [
        'Choose "table": FIPL, TS2, TS4, TS9, AP2, EMB (embroidery) or SMP (HO sample room). One row per needle exchange.',
        ' A Date   B Time   C Unit   D Issuer   E Batch No   F Style (free text)   G Operator ID   H Operation   I Machine Type (e.g. SNLS, DNLS, OL 5T, Kansai 6T, Button Hole, Bartack)',
        ' J Machine No   K Received Needle Type   L Rec Needle (count)   M Reason (Broken, Point out, Part Miss, Beand = bent)   N Remarks   O Issued Needle Type   P Isu Needle',
        'Count needles with sum(L) or count(A).'
      ].join('\n')
    },
    {
      key: 'GSD',
      name: 'GSD / IE work log - OB, cost SAM and TCR requests from merchants',
      id: '10i2hs5eF23gCO50ixFnPrBfnTFqnpIiCd4WXxHUnxbI', sheet: 'Log', dateCol: 'A',        // GSD | Log Register
      guide: [
        ' A Timestamp (request date-time)   B Buyer   C Style Number   D Style Description   E Cluster (Bangalore, Mumbai)',
        ' F Style Status (New Style, Repeated style)   G Style Construction Info   H Merchant Name   I Reference sample (Development, PP, Fit, Proto)',
        ' J Request for (Final OB, Cost SAM, TCR, Finishing OB)   K Specification   M Assigned to   O Start Time   Q End time',
        ' R Task Status (Yet to Do, Completed)   S Total Hours   T Review By   U Reviewed Status'
      ].join('\n')
    },
    {
      key: 'SMP',
      name: 'HO sample room indents (sample requests & stage) - data up to July 2026',
      id: '1_sonnMx-SiB8IyA2gE3twStOdGcWr0t8ua8K5Lle6G8', sheet: 'SmpIndent', dateCol: 'B',  // 0_2_HO_SMP_MASTER
      guide: [
        'One row per sample indent. NOTE: latest entries are from July 2026 - say so when asked about recent months.',
        ' A ID   B Stage Dates (date-time of last stage update)   C Buyer   D Style Number   E Style Description   F Season',
        ' G Style Info (New / Repeated)   H Merchant   I Sample Type (SMS, Silver Seal, Fit, PP...)   J Size   K Total Pcs',
        ' L Construction Info   M Printing   N Embroidery   O Wash   P Others   Q Specification',
        ' R Stage (e.g. "03.Patter Requested", "09.Under Cutting", "11.Loading Pending" - number = stage order)   S Note'
      ].join('\n')
    }

    // More sources can be added here in the same format.
  ]
};

/* ---------- entry used by doGet(action=ask) ---------- */
var ASK_DEADLINE_ = 0;   // stop trying new AI calls after this time (ms epoch)

function askTspl_(question, history) {
  const t0 = Date.now();
  ASK_DEADLINE_ = t0 + 75000;
  question = String(question || '').trim().slice(0, 500);
  if (!question) return { ok: false, error: 'Please type a question.' };
  const key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!key) return { ok: false, error: 'Ask TSPL is installed but the AI key is not set yet (Script Properties > GEMINI_API_KEY).' };

  const cache = CacheService.getScriptCache();
  const ck = 'ask_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, question + '|' + (history || '')));
  const hit = cache.get(ck);
  if (hit) return JSON.parse(hit);

  const tz = Session.getScriptTimeZone();
  const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd (EEEE)');
  let out;
  try {
    // ---- step 1: plan queries
    const plan = gemini_(planPrompt_(today), 'Earlier conversation (may be empty):\n' + String(history || '').slice(0, 1500) +
                         '\n\nQuestion: ' + question, key);
    if (plan.clarify && !(plan.queries && plan.queries.length)) {
      out = { ok: true, answer: plan.clarify, table: null, queries: [], followups: plan.followups || [] };
    } else {
      // ---- step 2: run queries (read-only), one repair attempt for a broken query
      const results = [];
      (plan.queries || []).slice(0, ASK.MAX_QUERIES).forEach(q => {
        let r = runQuery_(q);
        if (r.error && Date.now() < ASK_DEADLINE_ - 20000) {
          const fix = gemini_(planPrompt_(today), 'This query failed with error: ' + r.error + '\nQuery: ' + q.tq +
                              '\nOriginal question: ' + question + '\nReturn JSON with one corrected query in "queries".', key);
          if (fix.queries && fix.queries[0]) { const q2 = Object.assign({}, q, fix.queries[0]); r = runQuery_(q2); q = q2; }
        }
        results.push({ purpose: q.purpose || '', source: q.source + (q.table ? ' / ' + q.table : ''), tq: q.tq, headers: r.headers || [], rows: r.rows || [], error: r.error || '' });
      });
      // ---- step 3: write the answer from the numbers
      const brief = results.map((r, i) => 'Result ' + (i + 1) + ' (' + r.purpose + ')' + (r.error ? ' ERROR: ' + r.error :
        '\n' + [r.headers].concat(r.rows.slice(0, ASK.MAX_ROWS_TO_AI)).map(x => x.join(' | ')).join('\n') +
        (r.rows.length > ASK.MAX_ROWS_TO_AI ? '\n... ' + (r.rows.length - ASK.MAX_ROWS_TO_AI) + ' more rows' : ''))).join('\n\n');
      const ans = gemini_(answerPrompt_(today), 'Question: ' + question + '\n\n' + brief, key);
      const main = results.filter(r => !r.error && r.rows.length)[ans.tableFrom ? Math.max(0, ans.tableFrom - 1) : 0] ||
                   results.filter(r => !r.error && r.rows.length)[0];
      out = {
        ok: true,
        answer: ans.answer || 'No answer.',
        table: ans.table && ans.table.headers ? ans.table
             : (main ? { headers: main.headers, rows: main.rows.slice(0, ASK.MAX_ROWS_TO_USER) } : null),
        queries: results.map(r => ({ purpose: r.purpose, source: sourceName_(String(r.source).split(' / ')[0]) + (String(r.source).indexOf(' / ') > -1 ? ' - ' + String(r.source).split(' / ')[1] : ''), tq: r.tq, rows: r.rows.length, error: r.error })),
        followups: (ans.followups || []).slice(0, 3)
      };
    }
  } catch (e) {
    out = { ok: false, error: friendlyErr_(e) };
  }
  out.ms = Date.now() - t0;
  logAsk_(question, out);
  if (out.ok) cache.put(ck, JSON.stringify(out), 600);
  return out;
}

function planPrompt_(today) {
  return [
    'You turn a garment-factory manager\'s question into Google Visualization Query Language queries over the company\'s Google Sheets.',
    'First pick the right data source(s) for the question (FSA final audits, PROD production, EFF efficiency/COT, QUAL end-line quality, CUT cutting,',
    'COTRQ COT approvals, NDLSTK needle stock, NDLISS needle issues, GSD IE work log, SMP sample indents). A question can use several sources.',
    'Sources with several tables need a "table" value (e.g. a unit name) - use one query per table when several units are asked.',
    'Write {LATEST} (exactly) to mean the latest date present in that table, e.g. where B = {LATEST}.',
    'Today is ' + today + '. "This week" = Monday of this week to today. "Last week" = previous Monday to Sunday.',
    '"This month" = 1st of this month to today. Month names without a year mean the most recent such month.',
    'Use column LETTERS (D, F, AN...) exactly as in the guide. Allowed: select, where, group by, pivot, order by, limit, label, format,',
    'count, sum, avg, min, max, lower, upper, year, month (0-based!), week is not available - use date ranges. Dates: date \'yyyy-mm-dd\'.',
    'You cannot compute percentages inside the query from conditional counts; instead return the counts (e.g. group by AN) and the answer step will compute %.',
    'Keep results small: use group by / order by / limit 20 where sensible. Maximum ' + ASK.MAX_QUERIES + ' queries.',
    'If the question is unclear or not about this data, set "clarify" to a short question back to the user and return no queries.',
    'Data sources:',
    ASK.SOURCES.map(s => '### source "' + s.key + '": ' + s.name + (s.tables ? ' (tables: ' + Object.keys(s.tables).join(', ') + ')' : '') +
                         '\nDate column: ' + (s.dateCol || '-') + '\n' + s.guide).join('\n\n'),
    'Return ONLY JSON: {"queries":[{"source":"FSA","table":"","purpose":"short description","tq":"select ..."}],"clarify":""}'
  ].join('\n');
}

function answerPrompt_(today) {
  return [
    'You are "Ask TSPL", an assistant for garment-factory managers at Texport Syndicate (units FIPL, TS2, TS4, TS9, AP2; departments sewing, quality, cutting, IE/GSD, CMD needle store, sample room). Today is ' + today + '.',
    'Percentages must be computed from sums as the data guide says (e.g. efficiency = earned min / available min), never by averaging percentages.',
    'Write the answer ONLY from the query results given. Never invent numbers. Do the arithmetic carefully (percent to 1 decimal).',
    'If a result is empty, say no records were found for that filter and suggest what to check.',
    'Pass % = PASS / (PASS + FAIL) only. Say the denominator correctly (e.g. "93 of 157 concluded audits") and mention audits with no result ("-" or blank) separately.',
    'Only suggest follow-ups that this data can answer (unit, floor, auditor, buyer, style, defect type, date) - there is no line-wise data.',
    'Answer in 1-4 short sentences, leading with the key number. Use **bold** for the key figure. Mention the period and unit used.',
    'If the question was in Hindi/Kannada/Tamil/Telugu, answer in that language.',
    'Optionally give a clean table for the user (max 15 rows) with readable headers, e.g. pass/fail counts with Pass %.',
    'Return ONLY JSON: {"answer":"...","table":{"headers":["..."],"rows":[["..."]]} or null,"tableFrom":0,"followups":["up to 3 short follow-up questions"]}'
  ].join('\n');
}

/* ---------- read-only sheet query (Google Visualization API) ---------- */
function runQuery_(q) {
  const src = ASK.SOURCES.filter(s => s.key === q.source)[0] || ASK.SOURCES[0];
  let t = src;
  if (src.tables) {
    const tk = String(q.table || '').toUpperCase();
    t = src.tables[tk];
    if (!t) return { error: 'Choose "table" for source ' + src.key + ': ' + Object.keys(src.tables).join(', ') };
  }
  let tq = String(q.tq || '').trim();
  if (!/^select\b/i.test(tq)) return { error: 'Only SELECT queries are allowed' };
  if (tq.indexOf('{LATEST}') > -1) {
    const mx = gviz_(t, 'select max(' + (src.dateCol || 'A') + ')');
    if (mx.error) return mx;
    const v = mx.rows[0] && mx.rows[0][0];
    const d = v ? new Date(String(v).replace(/^(\d{4})-(\d{1,2})-(\d{1,2}).*/, '$1/$2/$3')) : null;
    if (!d || isNaN(d)) return { error: 'Could not find the latest date' };
    tq = tq.split('{LATEST}').join("date '" + Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd') + "'");
    q.tq = tq;
  }
  return gviz_(t, tq);
}

function gviz_(t, tq) {
  const url = 'https://docs.google.com/spreadsheets/d/' + t.id + '/gviz/tq?tqx=out:csv&sheet=' +
              encodeURIComponent(t.sheet) + '&tq=' + encodeURIComponent(tq);
  const r = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
  const body = r.getContentText();
  if (r.getResponseCode() !== 200 || /^\s*</.test(body) || /^\s*\{\s*"version"/.test(body) ||
      /google\.visualization\.Query\.setResponse/.test(body)) {
    const m = body.match(/"detailed_message":"([^"]+)"/) || body.match(/"message":"([^"]+)"/);
    return { error: m ? m[1] : 'Query failed (HTTP ' + r.getResponseCode() + ')' };
  }
  const data = Utilities.parseCsv(body);
  if (!data.length) return { headers: [], rows: [] };
  return { headers: data[0], rows: data.slice(1).slice(0, ASK.MAX_ROWS_TO_USER) };
}

function sourceName_(k) { const s = ASK.SOURCES.filter(x => x.key === k)[0]; return s ? s.name : k; }

/* ---------- Gemini ---------- */
// Tries the best model first; if Google says it is busy (429/500/503) it moves on to the next model.
function gemini_(system, user, key) {
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: { responseMimeType: 'application/json' }
  });
  const cache = CacheService.getScriptCache();
  const models = geminiModels_(key);
  const okModel = cache.get('gemini_ok');
  if (okModel && models.indexOf(okModel) > 0) { models.splice(models.indexOf(okModel), 1); models.unshift(okModel); }
  let lastErr = 'no model available';
  for (let i = 0; i < Math.min(models.length, 4); i++) {
    const model = models[i];
    for (let attempt = 0; attempt < 2; attempt++) {
      if (ASK_DEADLINE_ && Date.now() > ASK_DEADLINE_) throw new Error('AI 503: timed out waiting for a free model');
      const r = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent', {
        method: 'post', contentType: 'application/json', headers: { 'x-goog-api-key': key }, payload: body, muteHttpExceptions: true
      });
      const code = r.getResponseCode();
      let res = {}; try { res = JSON.parse(r.getContentText() || '{}'); } catch (e) {}
      if (code === 200) {
        let txt = '';
        try { txt = res.candidates[0].content.parts.filter(p => p.text && !p.thought).map(p => p.text).join(''); } catch (e) {}
        txt = txt.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
        cache.put('gemini_ok', model, 600);
        try { return JSON.parse(txt); } catch (e) { throw new Error('AI returned an unreadable reply'); }
      }
      lastErr = 'AI ' + code + ': ' + ((res.error && res.error.message) || '');
      if (code === 400 || code === 401 || code === 403) throw new Error(lastErr);       // key / request problem: do not retry
      if (code === 404) break;                                                            // model not available: next model
      if (attempt === 0) Utilities.sleep(1200);
    }
  }
  throw new Error(lastErr);
}

// Newest stable "Flash" models first, then "Flash-Lite" as backup (list cached 6 h). GEMINI_MODEL overrides.
function geminiModels_(key) {
  const fixed = PropertiesService.getScriptProperties().getProperty('GEMINI_MODEL');
  const cache = CacheService.getScriptCache();
  let list = null;
  const c = cache.get('gemini_models'); if (c) list = JSON.parse(c);
  if (!list) {
    list = [];
    try {
      const r = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': key }, muteHttpExceptions: true });
      const names = (JSON.parse(r.getContentText()).models || [])
        .filter(m => (m.supportedGenerationMethods || []).indexOf('generateContent') > -1)
        .map(m => m.name.replace(/^models\//, ''));
      const ver = n => parseFloat(n.split('-')[1]) || 0;
      const flash = names.filter(n => /^gemini-\d+(\.\d+)?-flash$/.test(n)).sort((a, b) => ver(b) - ver(a));
      const lite = names.filter(n => /^gemini-\d+(\.\d+)?-flash-lite$/.test(n)).sort((a, b) => ver(b) - ver(a));
      list = flash.slice(0, 2).concat(lite.slice(0, 1), flash.slice(2, 3));
    } catch (e) {}
    if (!list.length) list = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
    cache.put('gemini_models', JSON.stringify(list), 21600);
  }
  if (fixed) { const f = fixed.replace(/^models\//, ''); list = [f].concat(list.filter(x => x !== f)); }
  return list.slice();
}

function friendlyErr_(e) {
  const m = String(e && e.message || e);
  if (/API key not valid|API_KEY_INVALID|403/.test(m)) return 'The AI key is not valid. Please check GEMINI_API_KEY.';
  if (/429|503|500|quota|RESOURCE_EXHAUSTED|high demand|overloaded/i.test(m)) return 'Google AI is busy right now. Please try again in a minute.';
  return 'Sorry, could not answer: ' + m.slice(0, 200);
}

/* ---------- usage log (monitor's own spreadsheet, tab Ask_Log) ---------- */
function logAsk_(question, out) {
  try {
    const ss = ss_();
    const sh = ss.getSheetByName('Ask_Log') || ensureTab_(ss, 'Ask_Log', ['Time', 'Question', 'OK', 'Answer / Error', 'Queries', 'Seconds']);
    sh.appendRow([new Date(), question, out.ok ? 'Y' : 'N', String(out.ok ? out.answer : out.error).slice(0, 500),
                  (out.queries || []).map(q => q.tq).join('\n').slice(0, 1500), Math.round((out.ms || 0) / 100) / 10]);
  } catch (e) {}
}

/* ---------- run this once from the editor to test ---------- */
function testAsk() {
  Logger.log(JSON.stringify(askTspl_('AP2 FSA pass % in October 2026'), null, 1));
}
