/* ================= TSPL Needle Stock & Track dashboard (view=stock) =================
   Read-only. Reads the live 02_0x Needle_Stock *_Data_2.0 sheets. Writes nothing. */
var ND_FILES = {
  CMD:  '10ts4-o0eV6xUi8QL9J2e9wmiJogVn0nfL0xseSr7J58',
  FIPL: '1VaBU9HxJQSsfbvKCVzJGgBuuaussdP97viq2lW3jZwM',
  TS2:  '1mGX-AcqIazx5q-qUh0GZ2yq23ShYVxMYkyyxJiX-cbY',
  TS4:  '14IuvKj4YJ7bWnW-cmT2wmd_bDnrIxAtg6wziX8tEjnQ',
  TS9:  '1EzSzC68bJAQR-ExTLjZ3-f5huDSlNM5GHTNW1kcki2k',
  AP2:  '1iOe66_UWfSltLbDDLxhuc_eDb_RXxt-Mc-fculnR5kc'
};
var ND_MON = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};

function ndNum_(v) { var n = Number(String(v).replace(/,/g, '')); return isFinite(n) ? n : 0; }
function ndParseDate_(s) {            // dd-MMM-yy | dd-MMM-yyyy | MMM-yy
  s = String(s || '').trim(); var p = s.split('-');
  if (p.length === 3 && ND_MON[p[1]] !== undefined) { var y = +p[2]; if (y < 100) y += 2000; return new Date(y, ND_MON[p[1]], +p[0]); }
  if (p.length === 2 && ND_MON[p[0]] !== undefined) { var y2 = +p[1]; if (y2 < 100) y2 += 2000; return new Date(y2, ND_MON[p[0]], 1); }
  return null;
}
function ndMonKey_(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2); }
function ndDayKey_(d) { return ndMonKey_(d) + '-' + ('0' + d.getDate()).slice(-2); }

function ndBuild_() {
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var from = new Date(today.getTime() - 45 * 864e5);
  var out = { builtAt: Date.now(), generated: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd-MMM-yyyy HH:mm'),
              units: {}, errors: [] };
  Object.keys(ND_FILES).forEach(function (u) {
    try {
      var ss = SpreadsheetApp.openById(ND_FILES[u]);
      var U = { months: {}, types: {}, daily: {}, lastDate: '' };
      // ---- Month_Stock
      var ms = ss.getSheetByName('Month_Stock');
      if (ms && ms.getLastRow() > 1) {
        var nc = Math.min(ms.getLastColumn(), 16);
        var mv = ms.getRange(2, 1, ms.getLastRow() - 1, nc).getDisplayValues();
        mv.forEach(function (r) {
          var d = ndParseDate_(r[1]); if (!d || !r[3]) return;
          var mk = ndMonKey_(d), t = r[3];
          var rec = { o: ndNum_(r[4]), rl: ndNum_(r[5]), il: ndNum_(r[6]), sc: ndNum_(r[7]), rc: ndNum_(r[8]),
                      c: ndNum_(r[11]), cy: ndNum_(r[12]), ncy: ndNum_(r[13]), np: ndNum_(r[14]), ai: ndNum_(r[15]) };
          var M = U.months[mk] || (U.months[mk] = { o:0, rl:0, il:0, sc:0, rc:0, c:0, np:0, cy:0, ncy:0, ai:0, n:0 });
          ['o','rl','il','sc','rc','c','np','cy','ncy','ai'].forEach(function (k) { M[k] += rec[k]; }); M.n++;
          var T = U.types[t] || (U.types[t] = { m: {} });
          T.m[mk] = rec;
        });
      }
      // ---- Live_Stock (last ~45 days, read from the bottom)
      var ls = ss.getSheetByName('Live_Stock');
      if (ls && ls.getLastRow() > 1) {
        var last = ls.getLastRow(), take = Math.min(last - 1, 9000);
        var lv = ls.getRange(last - take + 1, 2, take, 11).getDisplayValues();
        var latest = null;
        lv.forEach(function (r) {
          var d = ndParseDate_(r[0]); if (!d || d < from || !r[2]) return;
          var dk = ndDayKey_(d);
          var D = U.daily[dk] || (U.daily[dk] = { rl:0, il:0, sc:0, rc:0 });
          D.rl += ndNum_(r[4]); D.il += ndNum_(r[5]); D.sc += ndNum_(r[6]); D.rc += ndNum_(r[7]);
          var mk2 = ndMonKey_(d), LM = U.lm || (U.lm = {}), LT = (LM[mk2] || (LM[mk2] = {}));
          var x = LT[r[2]] || (LT[r[2]] = { o: ndNum_(r[3]), od: dk, rl:0, il:0, sc:0, rc:0, c:0, cd: '' });
          if (dk < x.od) { x.o = ndNum_(r[3]); x.od = dk; }
          x.rl += ndNum_(r[4]); x.il += ndNum_(r[5]); x.sc += ndNum_(r[6]); x.rc += ndNum_(r[7]);
          if (dk >= x.cd) { x.c = ndNum_(r[10]); x.cd = dk; }
          if (!latest || dk >= latest) {
            latest = dk;
            var T = U.types[r[2]] || (U.types[r[2]] = { m: {} });
            T.live = ndNum_(r[10]); T.liveD = dk;
          }
        });
        U.lastDate = latest || '';
        // month missing from Month_Stock (e.g. CMD current month): build it from the daily rows
        Object.keys(U.lm || {}).forEach(function (mk) {
          if (U.months[mk] || mk !== ndMonKey_(today)) return;
          var M = U.months[mk] = { o:0, rl:0, il:0, sc:0, rc:0, c:0, np:0, cy:0, ncy:0, ai:0, n:0 };
          Object.keys(U.lm[mk]).forEach(function (t) {
            var x = U.lm[mk][t], rec = { o: x.o, rl: x.rl, il: x.il, sc: x.sc, rc: x.rc, c: x.c, cy:0, ncy:0, np:0, ai:0 };
            var T = U.types[t] || (U.types[t] = { m: {} }); T.m[mk] = rec;
            ['o','rl','il','sc','rc','c'].forEach(function (k) { M[k] += rec[k]; }); M.n++;
          });
        });
        delete U.lm;
      }
      // keep only types with some activity / stock, compact the per-month history
      Object.keys(U.types).forEach(function (t) {
        var T = U.types[t], any = Math.abs(T.live || 0) > 0;
        Object.keys(T.m).forEach(function (mk) { var r = T.m[mk]; if (r.o || r.c || r.rl || r.il || r.sc || r.rc || r.np) any = true; });
        if (!any) delete U.types[t];
        else if (T.liveD && T.liveD !== U.lastDate) delete T.live;   // stale type row
      });
      out.units[u] = U;
    } catch (e) { out.errors.push(u + ': ' + e.message); }
  });
  return out;
}

function needleDashData_(force) {
  var cache = CacheService.getScriptCache();
  if (!force) {
    var n = cache.get('nd_n');
    if (n) {
      var keys = []; for (var i = 0; i < +n; i++) keys.push('nd_' + i);
      var got = cache.getAll(keys), s = '';
      for (var j = 0; j < keys.length; j++) { if (got[keys[j]] == null) { s = null; break; } s += got[keys[j]]; }
      if (s) return s;
    }
  }
  var json = JSON.stringify(ndBuild_());
  try {
    var parts = {}, k = 0;
    for (var p = 0; p < json.length; p += 90000) parts['nd_' + (k++)] = json.slice(p, p + 90000);
    parts.nd_n = String(k);
    cache.putAll(parts, 21600);   // kept up to 6 h; the page refreshes it in the background when older than 10 min
  } catch (e) {}
  return json;
}

/* JSONP feed for the portal page stock.html (action=needle_dash) */
function needleDash_(p) { return JSON.parse(needleDashData_(String(p.fresh) === '1')); }
