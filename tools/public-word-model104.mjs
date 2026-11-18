var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// source_code/تعديلات على المكتبة/.artifacts/frontend-offline-typecheck-workspace/6818751f-d824-4098-862b-514dc2e81ea0/packages/e40a8fa62b11394bb3c9ef2858bc23c7c234c52a49d9142e925b1c0748cc3c78/lib/node.cjs
var require_node = __commonJS({
  "source_code/\u062A\u0639\u062F\u064A\u0644\u0627\u062A \u0639\u0644\u0649 \u0627\u0644\u0645\u0643\u062A\u0628\u0629/.artifacts/frontend-offline-typecheck-workspace/6818751f-d824-4098-862b-514dc2e81ea0/packages/e40a8fa62b11394bb3c9ef2858bc23c7c234c52a49d9142e925b1c0748cc3c78/lib/node.cjs"(exports) {
    "use strict";
    exports.deflate = deflate;
    exports.deflateSync = deflateSync;
    exports.inflate = inflate;
    exports.inflateSync = inflateSync;
    exports.gzip = gzip;
    exports.compress = gzip;
    exports.gzipSync = gzipSync;
    exports.compressSync = gzipSync;
    exports.gunzip = gunzip;
    exports.gunzipSync = gunzipSync;
    exports.zlib = zlib;
    exports.zlibSync = zlibSync;
    exports.unzlib = unzlib;
    exports.unzlibSync = unzlibSync;
    exports.gzip = gzip;
    exports.compress = gzip;
    exports.decompress = decompress;
    exports.decompressSync = decompressSync;
    exports.strToU8 = strToU8;
    exports.strFromU8 = strFromU8;
    exports.zip = zip;
    exports.zipSync = zipSync;
    exports.unzip = unzip;
    exports.unzipSync = unzipSync2;
    var _a;
    var Worker;
    var isMarkedAsUntransferable;
    var workerAdd = ";var __w=require('worker_threads');__w.parentPort.on('message',function(m){onmessage({data:m})}),postMessage=function(m,t){__w.parentPort.postMessage(m,t)},close=process.exit;self=global";
    try {
      _a = __require("worker_threads"), Worker = _a.Worker, isMarkedAsUntransferable = _a.isMarkedAsUntransferable;
    } catch (e) {
    }
    var node_worker_1 = {};
    node_worker_1["default"] = Worker ? function(c, _, msg, transfer, cb) {
      var done = false;
      var w = new Worker(c + workerAdd, { eval: true }).on("error", function(e) {
        return cb(e, null);
      }).on("message", function(m) {
        return cb(null, m);
      }).on("exit", function(c2) {
        if (c2 && !done)
          cb(new Error("exited with code " + c2), null);
      });
      if (isMarkedAsUntransferable)
        transfer = transfer.filter(function(t) {
          return !isMarkedAsUntransferable(t);
        });
      w.postMessage(msg, transfer);
      w.terminate = function() {
        done = true;
        return Worker.prototype.terminate.call(w);
      };
      return w;
    } : function(_, __, ___, ____, cb) {
      setImmediate(function() {
        return cb(new Error("async operations unsupported - update to Node 12+ (or Node 10-11 with the --experimental-worker CLI flag)"), null);
      });
      var NOP = function() {
      };
      return {
        terminate: NOP,
        postMessage: NOP
      };
    };
    var u8 = Uint8Array;
    var u16 = Uint16Array;
    var i32 = Int32Array;
    var fleb = new u8([
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      1,
      1,
      1,
      1,
      2,
      2,
      2,
      2,
      3,
      3,
      3,
      3,
      4,
      4,
      4,
      4,
      5,
      5,
      5,
      5,
      0,
      /* unused */
      0,
      0,
      /* impossible */
      0
    ]);
    var fdeb = new u8([
      0,
      0,
      0,
      0,
      1,
      1,
      2,
      2,
      3,
      3,
      4,
      4,
      5,
      5,
      6,
      6,
      7,
      7,
      8,
      8,
      9,
      9,
      10,
      10,
      11,
      11,
      12,
      12,
      13,
      13,
      /* unused */
      0,
      0
    ]);
    var clim = new u8([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
    var freb = function(eb, start) {
      var b = new u16(31);
      for (var i2 = 0; i2 < 31; ++i2) {
        b[i2] = start += 1 << eb[i2 - 1];
      }
      var r = new i32(b[30]);
      for (var i2 = 1; i2 < 30; ++i2) {
        for (var j = b[i2]; j < b[i2 + 1]; ++j) {
          r[j] = j - b[i2] << 5 | i2;
        }
      }
      return { b, r };
    };
    var _a = freb(fleb, 2);
    var fl = _a.b;
    var revfl = _a.r;
    fl[28] = 258, revfl[258] = 28;
    var _b = freb(fdeb, 0);
    var fd = _b.b;
    var revfd = _b.r;
    var rev = new u16(32768);
    for (i = 0; i < 32768; ++i) {
      x = (i & 43690) >> 1 | (i & 21845) << 1;
      x = (x & 52428) >> 2 | (x & 13107) << 2;
      x = (x & 61680) >> 4 | (x & 3855) << 4;
      rev[i] = ((x & 65280) >> 8 | (x & 255) << 8) >> 1;
    }
    var x;
    var i;
    var hMap = (function(cd, mb, r) {
      var s = cd.length;
      var i2 = 0;
      var l = new u16(mb);
      for (; i2 < s; ++i2) {
        if (cd[i2])
          ++l[cd[i2] - 1];
      }
      var le = new u16(mb);
      for (i2 = 1; i2 < mb; ++i2) {
        le[i2] = le[i2 - 1] + l[i2 - 1] << 1;
      }
      var co;
      if (r) {
        co = new u16(1 << mb);
        var rvb = 15 - mb;
        for (i2 = 0; i2 < s; ++i2) {
          if (cd[i2]) {
            var sv = i2 << 4 | cd[i2];
            var r_1 = mb - cd[i2];
            var v = le[cd[i2] - 1]++ << r_1;
            for (var m = v | (1 << r_1) - 1; v <= m; ++v) {
              co[rev[v] >> rvb] = sv;
            }
          }
        }
      } else {
        co = new u16(s);
        for (i2 = 0; i2 < s; ++i2) {
          if (cd[i2]) {
            co[i2] = rev[le[cd[i2] - 1]++] >> 15 - cd[i2];
          }
        }
      }
      return co;
    });
    var flt = new u8(288);
    for (i = 0; i < 144; ++i)
      flt[i] = 8;
    var i;
    for (i = 144; i < 256; ++i)
      flt[i] = 9;
    var i;
    for (i = 256; i < 280; ++i)
      flt[i] = 7;
    var i;
    for (i = 280; i < 288; ++i)
      flt[i] = 8;
    var i;
    var fdt = new u8(32);
    for (i = 0; i < 32; ++i)
      fdt[i] = 5;
    var i;
    var flm = /* @__PURE__ */ hMap(flt, 9, 0);
    var flrm = /* @__PURE__ */ hMap(flt, 9, 1);
    var fdm = /* @__PURE__ */ hMap(fdt, 5, 0);
    var fdrm = /* @__PURE__ */ hMap(fdt, 5, 1);
    var max = function(a) {
      var m = a[0];
      for (var i2 = 1; i2 < a.length; ++i2) {
        if (a[i2] > m)
          m = a[i2];
      }
      return m;
    };
    var bits = function(d, p, m) {
      var o = p / 8 | 0;
      return (d[o] | d[o + 1] << 8) >> (p & 7) & m;
    };
    var bits16 = function(d, p) {
      var o = p / 8 | 0;
      return (d[o] | d[o + 1] << 8 | d[o + 2] << 16) >> (p & 7);
    };
    var shft = function(p) {
      return (p + 7) / 8 | 0;
    };
    var slc = function(v, s, e) {
      if (s == null || s < 0)
        s = 0;
      if (e == null || e > v.length)
        e = v.length;
      return new u8(v.subarray(s, e));
    };
    exports.FlateErrorCode = {
      UnexpectedEOF: 0,
      InvalidBlockType: 1,
      InvalidLengthLiteral: 2,
      InvalidDistance: 3,
      StreamFinished: 4,
      NoStreamHandler: 5,
      InvalidHeader: 6,
      NoCallback: 7,
      InvalidUTF8: 8,
      ExtraFieldTooLong: 9,
      InvalidDate: 10,
      FilenameTooLong: 11,
      StreamFinishing: 12,
      InvalidZipData: 13,
      UnknownCompressionMethod: 14
    };
    var ec = [
      "unexpected EOF",
      "invalid block type",
      "invalid length/literal",
      "invalid distance",
      "stream finished",
      "no stream handler",
      ,
      // determined by compression function
      "no callback",
      "invalid UTF-8 data",
      "extra field too long",
      "date not in range 1980-2099",
      "filename too long",
      "stream finishing",
      "invalid zip data"
      // determined by unknown compression method
    ];
    var err = function(ind, msg, nt) {
      var e = new Error(msg || ec[ind]);
      e.code = ind;
      if (Error.captureStackTrace)
        Error.captureStackTrace(e, err);
      if (!nt)
        throw e;
      return e;
    };
    var inflt = function(dat, st, buf, dict) {
      var sl = dat.length, dl = dict ? dict.length : 0;
      if (!sl || st.f && !st.l)
        return buf || new u8(0);
      var noBuf = !buf;
      var resize = noBuf || st.i != 2;
      var noSt = st.i;
      if (noBuf)
        buf = new u8(sl * 3);
      var cbuf = function(l2) {
        var bl = buf.length;
        if (l2 > bl) {
          var nbuf = new u8(Math.max(bl * 2, l2));
          nbuf.set(buf);
          buf = nbuf;
        }
      };
      var final = st.f || 0, pos = st.p || 0, bt = st.b || 0, lm = st.l, dm = st.d, lbt = st.m, dbt = st.n;
      var tbts = sl * 8;
      do {
        if (!lm) {
          final = bits(dat, pos, 1);
          var type = bits(dat, pos + 1, 3);
          pos += 3;
          if (!type) {
            var s = shft(pos) + 4, l = dat[s - 4] | dat[s - 3] << 8, t = s + l;
            if (t > sl) {
              if (noSt)
                err(0);
              break;
            }
            if (resize)
              cbuf(bt + l);
            buf.set(dat.subarray(s, t), bt);
            st.b = bt += l, st.p = pos = t * 8, st.f = final;
            continue;
          } else if (type == 1)
            lm = flrm, dm = fdrm, lbt = 9, dbt = 5;
          else if (type == 2) {
            var hLit = bits(dat, pos, 31) + 257, hcLen = bits(dat, pos + 10, 15) + 4;
            var tl = hLit + bits(dat, pos + 5, 31) + 1;
            pos += 14;
            var ldt = new u8(tl);
            var clt = new u8(19);
            for (var i2 = 0; i2 < hcLen; ++i2) {
              clt[clim[i2]] = bits(dat, pos + i2 * 3, 7);
            }
            pos += hcLen * 3;
            var clb = max(clt), clbmsk = (1 << clb) - 1;
            var clm = hMap(clt, clb, 1);
            for (var i2 = 0; i2 < tl; ) {
              var r = clm[bits(dat, pos, clbmsk)];
              pos += r & 15;
              var s = r >> 4;
              if (s < 16) {
                ldt[i2++] = s;
              } else {
                var c = 0, n = 0;
                if (s == 16)
                  n = 3 + bits(dat, pos, 3), pos += 2, c = ldt[i2 - 1];
                else if (s == 17)
                  n = 3 + bits(dat, pos, 7), pos += 3;
                else if (s == 18)
                  n = 11 + bits(dat, pos, 127), pos += 7;
                while (n--)
                  ldt[i2++] = c;
              }
            }
            var lt = ldt.subarray(0, hLit), dt = ldt.subarray(hLit);
            lbt = max(lt);
            dbt = max(dt);
            lm = hMap(lt, lbt, 1);
            dm = hMap(dt, dbt, 1);
          } else
            err(1);
          if (pos > tbts) {
            if (noSt)
              err(0);
            break;
          }
        }
        if (resize)
          cbuf(bt + 131072);
        var lms = (1 << lbt) - 1, dms = (1 << dbt) - 1;
        var lpos = pos;
        for (; ; lpos = pos) {
          var c = lm[bits16(dat, pos) & lms], sym = c >> 4;
          pos += c & 15;
          if (pos > tbts) {
            if (noSt)
              err(0);
            break;
          }
          if (!c)
            err(2);
          if (sym < 256)
            buf[bt++] = sym;
          else if (sym == 256) {
            lpos = pos, lm = null;
            break;
          } else {
            var add = sym - 254;
            if (sym > 264) {
              var i2 = sym - 257, b = fleb[i2];
              add = bits(dat, pos, (1 << b) - 1) + fl[i2];
              pos += b;
            }
            var d = dm[bits16(dat, pos) & dms], dsym = d >> 4;
            if (!d)
              err(3);
            pos += d & 15;
            var dt = fd[dsym];
            if (dsym > 3) {
              var b = fdeb[dsym];
              dt += bits16(dat, pos) & (1 << b) - 1, pos += b;
            }
            if (pos > tbts) {
              if (noSt)
                err(0);
              break;
            }
            if (resize)
              cbuf(bt + 131072);
            var end = bt + add;
            if (bt < dt) {
              var shift = dl - dt, dend = Math.min(dt, end);
              if (shift + bt < 0)
                err(3);
              for (; bt < dend; ++bt)
                buf[bt] = dict[shift + bt];
            }
            for (; bt < end; ++bt)
              buf[bt] = buf[bt - dt];
          }
        }
        st.l = lm, st.p = lpos, st.b = bt, st.f = final;
        if (lm)
          final = 1, st.m = lbt, st.d = dm, st.n = dbt;
      } while (!final);
      return bt != buf.length && noBuf ? slc(buf, 0, bt) : buf.subarray(0, bt);
    };
    var wbits = function(d, p, v) {
      v <<= p & 7;
      var o = p / 8 | 0;
      d[o] |= v;
      d[o + 1] |= v >> 8;
    };
    var wbits16 = function(d, p, v) {
      v <<= p & 7;
      var o = p / 8 | 0;
      d[o] |= v;
      d[o + 1] |= v >> 8;
      d[o + 2] |= v >> 16;
    };
    var hTree = function(d, mb) {
      var t = [];
      for (var i2 = 0; i2 < d.length; ++i2) {
        if (d[i2])
          t.push({ s: i2, f: d[i2] });
      }
      var s = t.length;
      var t2 = t.slice();
      if (!s)
        return { t: et, l: 0 };
      if (s == 1) {
        var v = new u8(t[0].s + 1);
        v[t[0].s] = 1;
        return { t: v, l: 1 };
      }
      t.sort(function(a, b) {
        return a.f - b.f;
      });
      t.push({ s: -1, f: 25001 });
      var l = t[0], r = t[1], i0 = 0, i1 = 1, i22 = 2;
      t[0] = { s: -1, f: l.f + r.f, l, r };
      while (i1 != s - 1) {
        l = t[t[i0].f < t[i22].f ? i0++ : i22++];
        r = t[i0 != i1 && t[i0].f < t[i22].f ? i0++ : i22++];
        t[i1++] = { s: -1, f: l.f + r.f, l, r };
      }
      var maxSym = t2[0].s;
      for (var i2 = 1; i2 < s; ++i2) {
        if (t2[i2].s > maxSym)
          maxSym = t2[i2].s;
      }
      var tr = new u16(maxSym + 1);
      var mbt = ln(t[i1 - 1], tr, 0);
      if (mbt > mb) {
        var i2 = 0, dt = 0;
        var lft = mbt - mb, cst = 1 << lft;
        t2.sort(function(a, b) {
          return tr[b.s] - tr[a.s] || a.f - b.f;
        });
        for (; i2 < s; ++i2) {
          var i2_1 = t2[i2].s;
          if (tr[i2_1] > mb) {
            dt += cst - (1 << mbt - tr[i2_1]);
            tr[i2_1] = mb;
          } else
            break;
        }
        dt >>= lft;
        while (dt > 0) {
          var i2_2 = t2[i2].s;
          if (tr[i2_2] < mb)
            dt -= 1 << mb - tr[i2_2]++ - 1;
          else
            ++i2;
        }
        for (; i2 >= 0 && dt; --i2) {
          var i2_3 = t2[i2].s;
          if (tr[i2_3] == mb) {
            --tr[i2_3];
            ++dt;
          }
        }
        mbt = mb;
      }
      return { t: new u8(tr), l: mbt };
    };
    var ln = function(n, l, d) {
      return n.s == -1 ? Math.max(ln(n.l, l, d + 1), ln(n.r, l, d + 1)) : l[n.s] = d;
    };
    var lc = function(c) {
      var s = c.length;
      while (s && !c[--s])
        ;
      var cl = new u16(++s);
      var cli = 0, cln = c[0], cls = 1;
      var w = function(v) {
        cl[cli++] = v;
      };
      for (var i2 = 1; i2 <= s; ++i2) {
        if (c[i2] == cln && i2 != s)
          ++cls;
        else {
          if (!cln && cls > 2) {
            for (; cls > 138; cls -= 138)
              w(32754);
            if (cls > 2) {
              w(cls > 10 ? cls - 11 << 5 | 28690 : cls - 3 << 5 | 12305);
              cls = 0;
            }
          } else if (cls > 3) {
            w(cln), --cls;
            for (; cls > 6; cls -= 6)
              w(8304);
            if (cls > 2)
              w(cls - 3 << 5 | 8208), cls = 0;
          }
          while (cls--)
            w(cln);
          cls = 1;
          cln = c[i2];
        }
      }
      return { c: cl.subarray(0, cli), n: s };
    };
    var clen = function(cf, cl) {
      var l = 0;
      for (var i2 = 0; i2 < cl.length; ++i2)
        l += cf[i2] * cl[i2];
      return l;
    };
    var wfblk = function(out, pos, dat) {
      var s = dat.length;
      var o = shft(pos + 2);
      out[o] = s & 255;
      out[o + 1] = s >> 8;
      out[o + 2] = out[o] ^ 255;
      out[o + 3] = out[o + 1] ^ 255;
      for (var i2 = 0; i2 < s; ++i2)
        out[o + i2 + 4] = dat[i2];
      return (o + 4 + s) * 8;
    };
    var wblk = function(dat, out, final, syms, lf, df, eb, li, bs, bl, p) {
      wbits(out, p++, final);
      ++lf[256];
      var _a2 = hTree(lf, 15), dlt = _a2.t, mlb = _a2.l;
      var _b2 = hTree(df, 15), ddt = _b2.t, mdb = _b2.l;
      var _c = lc(dlt), lclt = _c.c, nlc = _c.n;
      var _d = lc(ddt), lcdt = _d.c, ndc = _d.n;
      var lcfreq = new u16(19);
      for (var i2 = 0; i2 < lclt.length; ++i2)
        ++lcfreq[lclt[i2] & 31];
      for (var i2 = 0; i2 < lcdt.length; ++i2)
        ++lcfreq[lcdt[i2] & 31];
      var _e = hTree(lcfreq, 7), lct = _e.t, mlcb = _e.l;
      var nlcc = 19;
      for (; nlcc > 4 && !lct[clim[nlcc - 1]]; --nlcc)
        ;
      var flen = bl + 5 << 3;
      var ftlen = clen(lf, flt) + clen(df, fdt) + eb;
      var dtlen = clen(lf, dlt) + clen(df, ddt) + eb + 14 + 3 * nlcc + clen(lcfreq, lct) + 2 * lcfreq[16] + 3 * lcfreq[17] + 7 * lcfreq[18];
      if (bs >= 0 && flen <= ftlen && flen <= dtlen)
        return wfblk(out, p, dat.subarray(bs, bs + bl));
      var lm, ll, dm, dl;
      wbits(out, p, 1 + (dtlen < ftlen)), p += 2;
      if (dtlen < ftlen) {
        lm = hMap(dlt, mlb, 0), ll = dlt, dm = hMap(ddt, mdb, 0), dl = ddt;
        var llm = hMap(lct, mlcb, 0);
        wbits(out, p, nlc - 257);
        wbits(out, p + 5, ndc - 1);
        wbits(out, p + 10, nlcc - 4);
        p += 14;
        for (var i2 = 0; i2 < nlcc; ++i2)
          wbits(out, p + 3 * i2, lct[clim[i2]]);
        p += 3 * nlcc;
        var lcts = [lclt, lcdt];
        for (var it = 0; it < 2; ++it) {
          var clct = lcts[it];
          for (var i2 = 0; i2 < clct.length; ++i2) {
            var len = clct[i2] & 31;
            wbits(out, p, llm[len]), p += lct[len];
            if (len > 15)
              wbits(out, p, clct[i2] >> 5 & 127), p += clct[i2] >> 12;
          }
        }
      } else {
        lm = flm, ll = flt, dm = fdm, dl = fdt;
      }
      for (var i2 = 0; i2 < li; ++i2) {
        var sym = syms[i2];
        if (sym > 255) {
          var len = sym >> 18 & 31;
          wbits16(out, p, lm[len + 257]), p += ll[len + 257];
          if (len > 7)
            wbits(out, p, sym >> 23 & 31), p += fleb[len];
          var dst = sym & 31;
          wbits16(out, p, dm[dst]), p += dl[dst];
          if (dst > 3)
            wbits16(out, p, sym >> 5 & 8191), p += fdeb[dst];
        } else {
          wbits16(out, p, lm[sym]), p += ll[sym];
        }
      }
      wbits16(out, p, lm[256]);
      return p + ll[256];
    };
    var deo = /* @__PURE__ */ new i32([65540, 131080, 131088, 131104, 262176, 1048704, 1048832, 2114560, 2117632]);
    var et = /* @__PURE__ */ new u8(0);
    var dflt = function(dat, lvl, plvl, pre, post, st) {
      var s = st.z || dat.length;
      var o = new u8(pre + s + 5 * (1 + Math.ceil(s / 7e3)) + post);
      var w = o.subarray(pre, o.length - post);
      var lst = st.l;
      var pos = (st.r || 0) & 7;
      if (lvl) {
        if (pos)
          w[0] = st.r >> 3;
        var opt = deo[lvl - 1];
        var n = opt >> 13, c = opt & 8191;
        var msk_1 = (1 << plvl) - 1;
        var prev = st.p || new u16(32768), head = st.h || new u16(msk_1 + 1);
        var bs1_1 = Math.ceil(plvl / 3), bs2_1 = 2 * bs1_1;
        var hsh = function(i3) {
          return (dat[i3] ^ dat[i3 + 1] << bs1_1 ^ dat[i3 + 2] << bs2_1) & msk_1;
        };
        var syms = new i32(25e3);
        var lf = new u16(288), df = new u16(32);
        var lc_1 = 0, eb = 0, i2 = st.i || 0, li = 0, wi = st.w || 0, bs = 0;
        for (; i2 + 2 < s; ++i2) {
          var hv = hsh(i2);
          var imod = i2 & 32767, pimod = head[hv];
          prev[imod] = pimod;
          head[hv] = imod;
          if (wi <= i2) {
            var rem = s - i2;
            if ((lc_1 > 7e3 || li > 24576) && (rem > 423 || !lst)) {
              pos = wblk(dat, w, 0, syms, lf, df, eb, li, bs, i2 - bs, pos);
              li = lc_1 = eb = 0, bs = i2;
              for (var j = 0; j < 286; ++j)
                lf[j] = 0;
              for (var j = 0; j < 30; ++j)
                df[j] = 0;
            }
            var l = 2, d = 0, ch_1 = c, dif = imod - pimod & 32767;
            if (rem > 2 && hv == hsh(i2 - dif)) {
              var maxn = Math.min(n, rem) - 1;
              var maxd = Math.min(32767, i2);
              var ml = Math.min(258, rem);
              while (dif <= maxd && --ch_1 && imod != pimod) {
                if (dat[i2 + l] == dat[i2 + l - dif]) {
                  var nl = 0;
                  for (; nl < ml && dat[i2 + nl] == dat[i2 + nl - dif]; ++nl)
                    ;
                  if (nl > l) {
                    l = nl, d = dif;
                    if (nl > maxn)
                      break;
                    var mmd = Math.min(dif, nl - 2);
                    var md = 0;
                    for (var j = 0; j < mmd; ++j) {
                      var ti = i2 - dif + j & 32767;
                      var pti = prev[ti];
                      var cd = ti - pti & 32767;
                      if (cd > md)
                        md = cd, pimod = ti;
                    }
                  }
                }
                imod = pimod, pimod = prev[imod];
                dif += imod - pimod & 32767;
              }
            }
            if (d) {
              syms[li++] = 268435456 | revfl[l] << 18 | revfd[d];
              var lin = revfl[l] & 31, din = revfd[d] & 31;
              eb += fleb[lin] + fdeb[din];
              ++lf[257 + lin];
              ++df[din];
              wi = i2 + l;
              ++lc_1;
            } else {
              syms[li++] = dat[i2];
              ++lf[dat[i2]];
            }
          }
        }
        for (i2 = Math.max(i2, wi); i2 < s; ++i2) {
          syms[li++] = dat[i2];
          ++lf[dat[i2]];
        }
        pos = wblk(dat, w, lst, syms, lf, df, eb, li, bs, i2 - bs, pos);
        if (!lst) {
          st.r = pos & 7 | w[pos / 8 | 0] << 3;
          pos -= 7;
          st.h = head, st.p = prev, st.i = i2, st.w = wi;
        }
      } else {
        for (var i2 = st.w || 0; i2 < s + lst; i2 += 65535) {
          var e = i2 + 65535;
          if (e >= s) {
            w[pos / 8 | 0] = lst;
            e = s;
          }
          pos = wfblk(w, pos + 1, dat.subarray(i2, e));
        }
        st.i = s;
      }
      return slc(o, 0, pre + shft(pos) + post);
    };
    var crct = /* @__PURE__ */ (function() {
      var t = new Int32Array(256);
      for (var i2 = 0; i2 < 256; ++i2) {
        var c = i2, k = 9;
        while (--k)
          c = (c & 1 && -306674912) ^ c >>> 1;
        t[i2] = c;
      }
      return t;
    })();
    var crc = function() {
      var c = -1;
      return {
        p: function(d) {
          var cr = c;
          for (var i2 = 0; i2 < d.length; ++i2)
            cr = crct[cr & 255 ^ d[i2]] ^ cr >>> 8;
          c = cr;
        },
        d: function() {
          return ~c;
        }
      };
    };
    var adler = function() {
      var a = 1, b = 0;
      return {
        p: function(d) {
          var n = a, m = b;
          var l = d.length | 0;
          for (var i2 = 0; i2 != l; ) {
            var e = Math.min(i2 + 2655, l);
            for (; i2 < e; ++i2)
              m += n += d[i2];
            n = (n & 65535) + 15 * (n >> 16), m = (m & 65535) + 15 * (m >> 16);
          }
          a = n, b = m;
        },
        d: function() {
          a %= 65521, b %= 65521;
          return (a & 255) << 24 | (a & 65280) << 8 | (b & 255) << 8 | b >> 8;
        }
      };
    };
    var dopt = function(dat, opt, pre, post, st) {
      if (!st) {
        st = { l: 1 };
        if (opt.dictionary) {
          var dict = opt.dictionary.subarray(-32768);
          var newDat = new u8(dict.length + dat.length);
          newDat.set(dict);
          newDat.set(dat, dict.length);
          dat = newDat;
          st.w = dict.length;
        }
      }
      return dflt(dat, opt.level == null ? 6 : opt.level, opt.mem == null ? st.l ? Math.ceil(Math.max(8, Math.min(13, Math.log(dat.length))) * 1.5) : 20 : 12 + opt.mem, pre, post, st);
    };
    var mrg = function(a, b) {
      var o = {};
      for (var k in a)
        o[k] = a[k];
      for (var k in b)
        o[k] = b[k];
      return o;
    };
    var wcln = function(fn, fnStr, td2) {
      var dt = fn();
      var st = fn.toString();
      var ks = st.slice(st.indexOf("[") + 1, st.lastIndexOf("]")).replace(/\s+/g, "").split(",");
      for (var i2 = 0; i2 < dt.length; ++i2) {
        var v = dt[i2], k = ks[i2];
        if (typeof v == "function") {
          fnStr += ";" + k + "=";
          var st_1 = v.toString();
          if (v.prototype) {
            if (st_1.indexOf("[native code]") != -1) {
              var spInd = st_1.indexOf(" ", 8) + 1;
              fnStr += st_1.slice(spInd, st_1.indexOf("(", spInd));
            } else {
              fnStr += st_1;
              for (var t in v.prototype)
                fnStr += ";" + k + ".prototype." + t + "=" + v.prototype[t].toString();
            }
          } else
            fnStr += st_1;
        } else
          td2[k] = v;
      }
      return fnStr;
    };
    var ch = [];
    var cbfs = function(v) {
      var tl = [];
      for (var k in v) {
        if (v[k].buffer) {
          tl.push((v[k] = new v[k].constructor(v[k])).buffer);
        }
      }
      return tl;
    };
    var wrkr = function(fns, init, id, cb) {
      if (!ch[id]) {
        var fnStr = "", td_1 = {}, m = fns.length - 1;
        for (var i2 = 0; i2 < m; ++i2)
          fnStr = wcln(fns[i2], fnStr, td_1);
        ch[id] = { c: wcln(fns[m], fnStr, td_1), e: td_1 };
      }
      var td2 = mrg({}, ch[id].e);
      return (0, node_worker_1.default)(ch[id].c + ";onmessage=function(e){for(var k in e.data)self[k]=e.data[k];onmessage=" + init.toString() + "}", id, td2, cbfs(td2), cb);
    };
    var bInflt = function() {
      return [u8, u16, i32, fleb, fdeb, clim, fl, fd, flrm, fdrm, rev, ec, hMap, max, bits, bits16, shft, slc, err, inflt, inflateSync, pbf, gopt];
    };
    var bDflt = function() {
      return [u8, u16, i32, fleb, fdeb, clim, revfl, revfd, flm, flt, fdm, fdt, rev, deo, et, hMap, wbits, wbits16, hTree, ln, lc, clen, wfblk, wblk, shft, slc, dflt, dopt, deflateSync, pbf];
    };
    var gze = function() {
      return [gzh, gzhl, wbytes, crc, crct];
    };
    var guze = function() {
      return [gzs, gzl];
    };
    var zle = function() {
      return [zlh, wbytes, adler];
    };
    var zule = function() {
      return [zls];
    };
    var pbf = function(msg) {
      return postMessage(msg, [msg.buffer]);
    };
    var gopt = function(o) {
      return o && {
        out: o.size && new u8(o.size),
        dictionary: o.dictionary
      };
    };
    var cbify = function(dat, opts, fns, init, id, cb) {
      var w = wrkr(fns, init, id, function(err2, dat2) {
        w.terminate();
        cb(err2, dat2);
      });
      w.postMessage([dat, opts], opts.consume ? [dat.buffer] : []);
      return function() {
        w.terminate();
      };
    };
    var astrm = function(strm) {
      strm.ondata = function(dat, final) {
        return postMessage([dat, final], [dat.buffer]);
      };
      return function(ev) {
        if (ev.data[0]) {
          strm.push(ev.data[0], ev.data[1]);
          postMessage([ev.data[0].length]);
        } else
          strm.flush(ev.data[1]);
      };
    };
    var astrmify = function(fns, strm, opts, init, id, flush, ext) {
      var t;
      var w = wrkr(fns, init, id, function(err2, dat) {
        if (err2)
          w.terminate(), strm.ondata.call(strm, err2);
        else if (!Array.isArray(dat))
          ext(dat);
        else if (dat.length == 1) {
          strm.queuedSize -= dat[0];
          if (strm.ondrain)
            strm.ondrain(dat[0]);
        } else {
          if (dat[1])
            w.terminate();
          strm.ondata.call(strm, err2, dat[0], dat[1]);
        }
      });
      w.postMessage(opts);
      strm.queuedSize = 0;
      strm.push = function(d, f) {
        if (!strm.ondata)
          err(5);
        if (t)
          strm.ondata(err(4, 0, 1), null, !!f);
        strm.queuedSize += d.length;
        w.postMessage([d, t = f], d.buffer instanceof ArrayBuffer ? [d.buffer] : []);
      };
      strm.terminate = function() {
        w.terminate();
      };
      if (flush) {
        strm.flush = function(sync) {
          w.postMessage([0, sync]);
        };
      }
    };
    var b2 = function(d, b) {
      return d[b] | d[b + 1] << 8;
    };
    var b4 = function(d, b) {
      return (d[b] | d[b + 1] << 8 | d[b + 2] << 16 | d[b + 3] << 24) >>> 0;
    };
    var b8 = function(d, b) {
      return b4(d, b) + b4(d, b + 4) * 4294967296;
    };
    var wbytes = function(d, b, v) {
      for (; v; ++b)
        d[b] = v, v >>>= 8;
    };
    var gzh = function(c, o) {
      var fn = o.filename;
      c[0] = 31, c[1] = 139, c[2] = 8, c[8] = o.level < 2 ? 4 : o.level == 9 ? 2 : 0, c[9] = 3;
      if (o.mtime != 0)
        wbytes(c, 4, Math.floor(new Date(o.mtime || Date.now()) / 1e3));
      if (fn) {
        c[3] = 8;
        for (var i2 = 0; i2 <= fn.length; ++i2)
          c[i2 + 10] = fn.charCodeAt(i2);
      }
    };
    var gzs = function(d) {
      if (d[0] != 31 || d[1] != 139 || d[2] != 8)
        err(6, "invalid gzip data");
      var flg = d[3];
      var st = 10;
      if (flg & 4)
        st += (d[10] | d[11] << 8) + 2;
      for (var zs = (flg >> 3 & 1) + (flg >> 4 & 1); zs > 0; zs -= !d[st++])
        ;
      return st + (flg & 2);
    };
    var gzl = function(d) {
      var l = d.length;
      return (d[l - 4] | d[l - 3] << 8 | d[l - 2] << 16 | d[l - 1] << 24) >>> 0;
    };
    var gzhl = function(o) {
      return 10 + (o.filename ? o.filename.length + 1 : 0);
    };
    var zlh = function(c, o) {
      var lv = o.level, fl2 = lv == 0 ? 0 : lv < 6 ? 1 : lv == 9 ? 3 : 2;
      c[0] = 120, c[1] = fl2 << 6 | (o.dictionary && 32);
      c[1] |= 31 - (c[0] << 8 | c[1]) % 31;
      if (o.dictionary) {
        var h = adler();
        h.p(o.dictionary);
        wbytes(c, 2, h.d());
      }
    };
    var zls = function(d, dict) {
      if ((d[0] & 15) != 8 || d[0] >> 4 > 7 || (d[0] << 8 | d[1]) % 31)
        err(6, "invalid zlib data");
      if ((d[1] >> 5 & 1) == +!dict)
        err(6, "invalid zlib data: " + (d[1] & 32 ? "need" : "unexpected") + " dictionary");
      return (d[1] >> 3 & 4) + 2;
    };
    function StrmOpt(opts, cb) {
      if (typeof opts == "function")
        cb = opts, opts = {};
      this.ondata = cb;
      return opts;
    }
    var Deflate = /* @__PURE__ */ (function() {
      function Deflate2(opts, cb) {
        if (typeof opts == "function")
          cb = opts, opts = {};
        this.ondata = cb;
        this.o = opts || {};
        this.s = { l: 0, i: 32768, w: 32768, z: 32768 };
        this.b = new u8(98304);
        if (this.o.dictionary) {
          var dict = this.o.dictionary.subarray(-32768);
          this.b.set(dict, 32768 - dict.length);
          this.s.i = 32768 - dict.length;
        }
      }
      Deflate2.prototype.p = function(c, f) {
        this.ondata(dopt(c, this.o, 0, 0, this.s), f);
      };
      Deflate2.prototype.push = function(chunk, final) {
        if (!this.ondata)
          err(5);
        if (this.s.l)
          err(4);
        var endLen = chunk.length + this.s.z;
        if (endLen > this.b.length) {
          if (endLen > 2 * this.b.length - 32768) {
            var newBuf = new u8(endLen & -32768);
            newBuf.set(this.b.subarray(0, this.s.z));
            this.b = newBuf;
          }
          var split = this.b.length - this.s.z;
          this.b.set(chunk.subarray(0, split), this.s.z);
          this.s.z = this.b.length;
          this.p(this.b, false);
          this.b.set(this.b.subarray(-32768));
          this.b.set(chunk.subarray(split), 32768);
          this.s.z = chunk.length - split + 32768;
          this.s.i = 32766, this.s.w = 32768;
        } else {
          this.b.set(chunk, this.s.z);
          this.s.z += chunk.length;
        }
        this.s.l = final & 1;
        if (this.s.z > this.s.w + 8191 || final) {
          this.p(this.b, final || false);
          this.s.w = this.s.i, this.s.i -= 2;
        }
        if (final) {
          this.s = this.o = {};
          this.b = et;
        }
      };
      Deflate2.prototype.flush = function(sync) {
        if (!this.ondata)
          err(5);
        if (this.s.l)
          err(4);
        this.p(this.b, false);
        this.s.w = this.s.i, this.s.i -= 2;
        if (sync) {
          var c = new u8(6);
          c[0] = this.s.r >> 3;
          var ep = wfblk(c, this.s.r, et);
          this.s.r = 0;
          this.ondata(c.subarray(0, ep >> 3), false);
        }
      };
      return Deflate2;
    })();
    exports.Deflate = Deflate;
    var AsyncDeflate = /* @__PURE__ */ (function() {
      function AsyncDeflate2(opts, cb) {
        astrmify([
          bDflt,
          function() {
            return [astrm, Deflate];
          }
        ], this, StrmOpt.call(this, opts, cb), function(ev) {
          var strm = new Deflate(ev.data);
          onmessage = astrm(strm);
        }, 6, 1);
      }
      return AsyncDeflate2;
    })();
    exports.AsyncDeflate = AsyncDeflate;
    function deflate(data, opts, cb) {
      if (!cb)
        cb = opts, opts = {};
      if (typeof cb != "function")
        err(7);
      return cbify(data, opts, [
        bDflt
      ], function(ev) {
        return pbf(deflateSync(ev.data[0], ev.data[1]));
      }, 0, cb);
    }
    function deflateSync(data, opts) {
      return dopt(data, opts || {}, 0, 0);
    }
    var Inflate = /* @__PURE__ */ (function() {
      function Inflate2(opts, cb) {
        if (typeof opts == "function")
          cb = opts, opts = {};
        this.ondata = cb;
        var dict = opts && opts.dictionary && opts.dictionary.subarray(-32768);
        this.s = { i: 0, b: dict ? dict.length : 0 };
        this.o = new u8(32768);
        this.p = new u8(0);
        if (dict)
          this.o.set(dict);
      }
      Inflate2.prototype.e = function(c) {
        if (!this.ondata)
          err(5);
        if (this.d)
          err(4);
        if (!this.p.length)
          this.p = c;
        else if (c.length) {
          var n = new u8(this.p.length + c.length);
          n.set(this.p), n.set(c, this.p.length), this.p = n;
        }
      };
      Inflate2.prototype.c = function(final) {
        this.s.i = +(this.d = final || false);
        var bts = this.s.b;
        var dt = inflt(this.p, this.s, this.o);
        this.ondata(slc(dt, bts, this.s.b), this.d);
        this.o = slc(dt, this.s.b - 32768), this.s.b = this.o.length;
        this.p = slc(this.p, this.s.p / 8 | 0), this.s.p &= 7;
      };
      Inflate2.prototype.push = function(chunk, final) {
        this.e(chunk), this.c(final);
      };
      return Inflate2;
    })();
    exports.Inflate = Inflate;
    var AsyncInflate = /* @__PURE__ */ (function() {
      function AsyncInflate2(opts, cb) {
        astrmify([
          bInflt,
          function() {
            return [astrm, Inflate];
          }
        ], this, StrmOpt.call(this, opts, cb), function(ev) {
          var strm = new Inflate(ev.data);
          onmessage = astrm(strm);
        }, 7, 0);
      }
      return AsyncInflate2;
    })();
    exports.AsyncInflate = AsyncInflate;
    function inflate(data, opts, cb) {
      if (!cb)
        cb = opts, opts = {};
      if (typeof cb != "function")
        err(7);
      return cbify(data, opts, [
        bInflt
      ], function(ev) {
        return pbf(inflateSync(ev.data[0], gopt(ev.data[1])));
      }, 1, cb);
    }
    function inflateSync(data, opts) {
      return inflt(data, { i: 2 }, opts && opts.out, opts && opts.dictionary);
    }
    var Gzip = /* @__PURE__ */ (function() {
      function Gzip2(opts, cb) {
        this.c = crc();
        this.l = 0;
        this.v = 1;
        Deflate.call(this, opts, cb);
      }
      Gzip2.prototype.push = function(chunk, final) {
        this.c.p(chunk);
        this.l += chunk.length;
        Deflate.prototype.push.call(this, chunk, final);
      };
      Gzip2.prototype.p = function(c, f) {
        var raw = dopt(c, this.o, this.v && gzhl(this.o), f && 8, this.s);
        if (this.v)
          gzh(raw, this.o), this.v = 0;
        if (f)
          wbytes(raw, raw.length - 8, this.c.d()), wbytes(raw, raw.length - 4, this.l);
        this.ondata(raw, f);
      };
      Gzip2.prototype.flush = function(sync) {
        Deflate.prototype.flush.call(this, sync);
      };
      return Gzip2;
    })();
    exports.Gzip = Gzip;
    exports.Compress = Gzip;
    var AsyncGzip = /* @__PURE__ */ (function() {
      function AsyncGzip2(opts, cb) {
        astrmify([
          bDflt,
          gze,
          function() {
            return [astrm, Deflate, Gzip];
          }
        ], this, StrmOpt.call(this, opts, cb), function(ev) {
          var strm = new Gzip(ev.data);
          onmessage = astrm(strm);
        }, 8, 1);
      }
      return AsyncGzip2;
    })();
    exports.AsyncGzip = AsyncGzip;
    exports.AsyncCompress = AsyncGzip;
    function gzip(data, opts, cb) {
      if (!cb)
        cb = opts, opts = {};
      if (typeof cb != "function")
        err(7);
      return cbify(data, opts, [
        bDflt,
        gze,
        function() {
          return [gzipSync];
        }
      ], function(ev) {
        return pbf(gzipSync(ev.data[0], ev.data[1]));
      }, 2, cb);
    }
    function gzipSync(data, opts) {
      if (!opts)
        opts = {};
      var c = crc(), l = data.length;
      c.p(data);
      var d = dopt(data, opts, gzhl(opts), 8), s = d.length;
      return gzh(d, opts), wbytes(d, s - 8, c.d()), wbytes(d, s - 4, l), d;
    }
    var Gunzip = /* @__PURE__ */ (function() {
      function Gunzip2(opts, cb) {
        this.v = 1;
        this.r = 0;
        Inflate.call(this, opts, cb);
      }
      Gunzip2.prototype.push = function(chunk, final) {
        Inflate.prototype.e.call(this, chunk);
        this.r += chunk.length;
        if (this.v) {
          var p = this.p.subarray(this.v - 1);
          var s = p.length > 3 ? gzs(p) : 4;
          if (s > p.length) {
            if (!final)
              return;
          } else if (this.v > 1 && this.onmember) {
            this.onmember(this.r - p.length);
          }
          this.p = p.subarray(s), this.v = 0;
        }
        Inflate.prototype.c.call(this, 0);
        if (this.s.f && !this.s.l) {
          this.v = shft(this.s.p) + 9;
          this.s = { i: 0 };
          this.o = new u8(0);
          this.push(new u8(0), final);
        } else if (final) {
          Inflate.prototype.c.call(this, final);
        }
      };
      return Gunzip2;
    })();
    exports.Gunzip = Gunzip;
    var AsyncGunzip = /* @__PURE__ */ (function() {
      function AsyncGunzip2(opts, cb) {
        var _this = this;
        astrmify([
          bInflt,
          guze,
          function() {
            return [astrm, Inflate, Gunzip];
          }
        ], this, StrmOpt.call(this, opts, cb), function(ev) {
          var strm = new Gunzip(ev.data);
          strm.onmember = function(offset) {
            return postMessage(offset);
          };
          onmessage = astrm(strm);
        }, 9, 0, function(offset) {
          return _this.onmember && _this.onmember(offset);
        });
      }
      return AsyncGunzip2;
    })();
    exports.AsyncGunzip = AsyncGunzip;
    function gunzip(data, opts, cb) {
      if (!cb)
        cb = opts, opts = {};
      if (typeof cb != "function")
        err(7);
      return cbify(data, opts, [
        bInflt,
        guze,
        function() {
          return [gunzipSync];
        }
      ], function(ev) {
        return pbf(gunzipSync(ev.data[0], ev.data[1]));
      }, 3, cb);
    }
    function gunzipSync(data, opts) {
      var st = gzs(data);
      if (st + 8 > data.length)
        err(6, "invalid gzip data");
      return inflt(data.subarray(st, -8), { i: 2 }, opts && opts.out || new u8(gzl(data)), opts && opts.dictionary);
    }
    var Zlib = /* @__PURE__ */ (function() {
      function Zlib2(opts, cb) {
        this.c = adler();
        this.v = 1;
        Deflate.call(this, opts, cb);
      }
      Zlib2.prototype.push = function(chunk, final) {
        this.c.p(chunk);
        Deflate.prototype.push.call(this, chunk, final);
      };
      Zlib2.prototype.p = function(c, f) {
        var raw = dopt(c, this.o, this.v && (this.o.dictionary ? 6 : 2), f && 4, this.s);
        if (this.v)
          zlh(raw, this.o), this.v = 0;
        if (f)
          wbytes(raw, raw.length - 4, this.c.d());
        this.ondata(raw, f);
      };
      Zlib2.prototype.flush = function(sync) {
        Deflate.prototype.flush.call(this, sync);
      };
      return Zlib2;
    })();
    exports.Zlib = Zlib;
    var AsyncZlib = /* @__PURE__ */ (function() {
      function AsyncZlib2(opts, cb) {
        astrmify([
          bDflt,
          zle,
          function() {
            return [astrm, Deflate, Zlib];
          }
        ], this, StrmOpt.call(this, opts, cb), function(ev) {
          var strm = new Zlib(ev.data);
          onmessage = astrm(strm);
        }, 10, 1);
      }
      return AsyncZlib2;
    })();
    exports.AsyncZlib = AsyncZlib;
    function zlib(data, opts, cb) {
      if (!cb)
        cb = opts, opts = {};
      if (typeof cb != "function")
        err(7);
      return cbify(data, opts, [
        bDflt,
        zle,
        function() {
          return [zlibSync];
        }
      ], function(ev) {
        return pbf(zlibSync(ev.data[0], ev.data[1]));
      }, 4, cb);
    }
    function zlibSync(data, opts) {
      if (!opts)
        opts = {};
      var a = adler();
      a.p(data);
      var d = dopt(data, opts, opts.dictionary ? 6 : 2, 4);
      return zlh(d, opts), wbytes(d, d.length - 4, a.d()), d;
    }
    var Unzlib = /* @__PURE__ */ (function() {
      function Unzlib2(opts, cb) {
        Inflate.call(this, opts, cb);
        this.v = opts && opts.dictionary ? 2 : 1;
      }
      Unzlib2.prototype.push = function(chunk, final) {
        Inflate.prototype.e.call(this, chunk);
        if (this.v) {
          if (this.p.length < 6 && !final)
            return;
          this.p = this.p.subarray(zls(this.p, this.v - 1)), this.v = 0;
        }
        if (final) {
          if (this.p.length < 4)
            err(6, "invalid zlib data");
          this.p = this.p.subarray(0, -4);
        }
        Inflate.prototype.c.call(this, final);
      };
      return Unzlib2;
    })();
    exports.Unzlib = Unzlib;
    var AsyncUnzlib = /* @__PURE__ */ (function() {
      function AsyncUnzlib2(opts, cb) {
        astrmify([
          bInflt,
          zule,
          function() {
            return [astrm, Inflate, Unzlib];
          }
        ], this, StrmOpt.call(this, opts, cb), function(ev) {
          var strm = new Unzlib(ev.data);
          onmessage = astrm(strm);
        }, 11, 0);
      }
      return AsyncUnzlib2;
    })();
    exports.AsyncUnzlib = AsyncUnzlib;
    function unzlib(data, opts, cb) {
      if (!cb)
        cb = opts, opts = {};
      if (typeof cb != "function")
        err(7);
      return cbify(data, opts, [
        bInflt,
        zule,
        function() {
          return [unzlibSync];
        }
      ], function(ev) {
        return pbf(unzlibSync(ev.data[0], gopt(ev.data[1])));
      }, 5, cb);
    }
    function unzlibSync(data, opts) {
      return inflt(data.subarray(zls(data, opts && opts.dictionary), -4), { i: 2 }, opts && opts.out, opts && opts.dictionary);
    }
    var Decompress = /* @__PURE__ */ (function() {
      function Decompress2(opts, cb) {
        this.o = StrmOpt.call(this, opts, cb) || {};
        this.G = Gunzip;
        this.I = Inflate;
        this.Z = Unzlib;
      }
      Decompress2.prototype.i = function() {
        var _this = this;
        this.s.ondata = function(dat, final) {
          _this.ondata(dat, final);
        };
      };
      Decompress2.prototype.push = function(chunk, final) {
        if (!this.ondata)
          err(5);
        if (!this.s) {
          if (this.p && this.p.length) {
            var n = new u8(this.p.length + chunk.length);
            n.set(this.p), n.set(chunk, this.p.length);
          } else
            this.p = chunk;
          if (this.p.length > 2) {
            this.s = this.p[0] == 31 && this.p[1] == 139 && this.p[2] == 8 ? new this.G(this.o) : (this.p[0] & 15) != 8 || this.p[0] >> 4 > 7 || (this.p[0] << 8 | this.p[1]) % 31 ? new this.I(this.o) : new this.Z(this.o);
            this.i();
            this.s.push(this.p, final);
            this.p = null;
          }
        } else
          this.s.push(chunk, final);
      };
      return Decompress2;
    })();
    exports.Decompress = Decompress;
    var AsyncDecompress = /* @__PURE__ */ (function() {
      function AsyncDecompress2(opts, cb) {
        Decompress.call(this, opts, cb);
        this.queuedSize = 0;
        this.G = AsyncGunzip;
        this.I = AsyncInflate;
        this.Z = AsyncUnzlib;
      }
      AsyncDecompress2.prototype.i = function() {
        var _this = this;
        this.s.ondata = function(err2, dat, final) {
          _this.ondata(err2, dat, final);
        };
        this.s.ondrain = function(size) {
          _this.queuedSize -= size;
          if (_this.ondrain)
            _this.ondrain(size);
        };
      };
      AsyncDecompress2.prototype.push = function(chunk, final) {
        this.queuedSize += chunk.length;
        Decompress.prototype.push.call(this, chunk, final);
      };
      return AsyncDecompress2;
    })();
    exports.AsyncDecompress = AsyncDecompress;
    function decompress(data, opts, cb) {
      if (!cb)
        cb = opts, opts = {};
      if (typeof cb != "function")
        err(7);
      return data[0] == 31 && data[1] == 139 && data[2] == 8 ? gunzip(data, opts, cb) : (data[0] & 15) != 8 || data[0] >> 4 > 7 || (data[0] << 8 | data[1]) % 31 ? inflate(data, opts, cb) : unzlib(data, opts, cb);
    }
    function decompressSync(data, opts) {
      return data[0] == 31 && data[1] == 139 && data[2] == 8 ? gunzipSync(data, opts) : (data[0] & 15) != 8 || data[0] >> 4 > 7 || (data[0] << 8 | data[1]) % 31 ? inflateSync(data, opts) : unzlibSync(data, opts);
    }
    var fltn = function(d, p, t, o) {
      for (var k in d) {
        var val = d[k], n = p + k, op = o;
        if (Array.isArray(val))
          op = mrg(o, val[1]), val = val[0];
        if (ArrayBuffer.isView(val))
          t[n] = [val, op];
        else {
          t[n += "/"] = [new u8(0), op];
          fltn(val, n, t, o);
        }
      }
    };
    var te = typeof TextEncoder != "undefined" && /* @__PURE__ */ new TextEncoder();
    var td = typeof TextDecoder != "undefined" && /* @__PURE__ */ new TextDecoder();
    var tds = 0;
    try {
      td.decode(et, { stream: true });
      tds = 1;
    } catch (e) {
    }
    var dutf8 = function(d) {
      for (var r = "", i2 = 0; ; ) {
        var c = d[i2++];
        var eb = (c > 127) + (c > 223) + (c > 239);
        if (i2 + eb > d.length)
          return { s: r, r: slc(d, i2 - 1) };
        if (!eb)
          r += String.fromCharCode(c);
        else if (eb == 3) {
          c = ((c & 15) << 18 | (d[i2++] & 63) << 12 | (d[i2++] & 63) << 6 | d[i2++] & 63) - 65536, r += String.fromCharCode(55296 | c >> 10, 56320 | c & 1023);
        } else if (eb & 1)
          r += String.fromCharCode((c & 31) << 6 | d[i2++] & 63);
        else
          r += String.fromCharCode((c & 15) << 12 | (d[i2++] & 63) << 6 | d[i2++] & 63);
      }
    };
    var DecodeUTF8 = /* @__PURE__ */ (function() {
      function DecodeUTF82(cb) {
        this.ondata = cb;
        if (tds)
          this.t = new TextDecoder();
        else
          this.p = et;
      }
      DecodeUTF82.prototype.push = function(chunk, final) {
        if (!this.ondata)
          err(5);
        final = !!final;
        if (this.t) {
          this.ondata(this.t.decode(chunk, { stream: true }), final);
          if (final) {
            if (this.t.decode().length)
              err(8);
            this.t = null;
          }
          return;
        }
        if (!this.p)
          err(4);
        var dat = new u8(this.p.length + chunk.length);
        dat.set(this.p);
        dat.set(chunk, this.p.length);
        var _a2 = dutf8(dat), s = _a2.s, r = _a2.r;
        if (final) {
          if (r.length)
            err(8);
          this.p = null;
        } else
          this.p = r;
        this.ondata(s, final);
      };
      return DecodeUTF82;
    })();
    exports.DecodeUTF8 = DecodeUTF8;
    var EncodeUTF8 = /* @__PURE__ */ (function() {
      function EncodeUTF82(cb) {
        this.ondata = cb;
      }
      EncodeUTF82.prototype.push = function(chunk, final) {
        if (!this.ondata)
          err(5);
        if (this.d)
          err(4);
        this.ondata(strToU8(chunk), this.d = final || false);
      };
      return EncodeUTF82;
    })();
    exports.EncodeUTF8 = EncodeUTF8;
    function strToU8(str, latin1) {
      if (latin1) {
        var ar_1 = new u8(str.length);
        for (var i2 = 0; i2 < str.length; ++i2)
          ar_1[i2] = str.charCodeAt(i2);
        return ar_1;
      }
      if (te)
        return te.encode(str);
      var l = str.length;
      var ar = new u8(str.length + (str.length >> 1));
      var ai = 0;
      var w = function(v) {
        ar[ai++] = v;
      };
      for (var i2 = 0; i2 < l; ++i2) {
        if (ai + 5 > ar.length) {
          var n = new u8(ai + 8 + (l - i2 << 1));
          n.set(ar);
          ar = n;
        }
        var c = str.charCodeAt(i2);
        if (c < 128 || latin1)
          w(c);
        else if (c < 2048)
          w(192 | c >> 6), w(128 | c & 63);
        else if (c > 55295 && c < 57344)
          c = 65536 + (c & 1023 << 10) | str.charCodeAt(++i2) & 1023, w(240 | c >> 18), w(128 | c >> 12 & 63), w(128 | c >> 6 & 63), w(128 | c & 63);
        else
          w(224 | c >> 12), w(128 | c >> 6 & 63), w(128 | c & 63);
      }
      return slc(ar, 0, ai);
    }
    function strFromU8(dat, latin1) {
      if (latin1) {
        var r = "";
        for (var i2 = 0; i2 < dat.length; i2 += 16384)
          r += String.fromCharCode.apply(null, dat.subarray(i2, i2 + 16384));
        return r;
      } else if (td) {
        return td.decode(dat);
      } else {
        var _a2 = dutf8(dat), s = _a2.s, r = _a2.r;
        if (r.length)
          err(8);
        return s;
      }
    }
    var dbf = function(l) {
      return l == 1 ? 3 : l < 6 ? 2 : l == 9 ? 1 : 0;
    };
    var slzh = function(d, b) {
      return b + 30 + b2(d, b + 26) + b2(d, b + 28);
    };
    var zh = function(d, b, z) {
      var fnl = b2(d, b + 28), efl = b2(d, b + 30), fn = strFromU8(d.subarray(b + 46, b + 46 + fnl), !(b2(d, b + 8) & 2048)), es = b + 46 + fnl;
      var _a2 = z64hs(d, es, efl, z, b4(d, b + 20), b4(d, b + 24), b4(d, b + 42)), sc = _a2[0], su = _a2[1], off = _a2[2];
      return [b2(d, b + 10), sc, su, fn, es + efl + b2(d, b + 32), off];
    };
    var z64hs = function(d, b, l, z, sc, su, off) {
      var nsc = sc == 4294967295, nsu = su == 4294967295, noff = off == 4294967295, e = b + l;
      var nf = nsc + nsu + noff;
      if (z && nf) {
        for (; b + 4 < e; b += 4 + b2(d, b + 2)) {
          if (b2(d, b) == 1) {
            return [
              nsc ? b8(d, b + 4 + 8 * nsu) : sc,
              nsu ? b8(d, b + 4) : su,
              noff ? b8(d, b + 4 + 8 * (nsu + nsc)) : off,
              1
            ];
          }
        }
        if (z < 2)
          err(13);
      }
      return [sc, su, off, 0];
    };
    var exfl = function(ex) {
      var le = 0;
      if (ex) {
        for (var k in ex) {
          var l = ex[k].length;
          if (l > 65535)
            err(9);
          le += l + 4;
        }
      }
      return le;
    };
    var wzh = function(d, b, f, fn, u, c, ce, co) {
      var fl2 = fn.length, ex = f.extra, col = co && co.length;
      var exl = exfl(ex);
      wbytes(d, b, ce != null ? 33639248 : 67324752), b += 4;
      if (ce != null)
        d[b++] = 20, d[b++] = f.os;
      d[b] = 20, b += 2;
      d[b++] = f.flag << 1 | (c < 0 && 8), d[b++] = u && 8;
      d[b++] = f.compression & 255, d[b++] = f.compression >> 8;
      var dt = new Date(f.mtime == null ? Date.now() : f.mtime), y = dt.getFullYear() - 1980;
      if (y < 0 || y > 119)
        err(10);
      wbytes(d, b, y << 25 | dt.getMonth() + 1 << 21 | dt.getDate() << 16 | dt.getHours() << 11 | dt.getMinutes() << 5 | dt.getSeconds() >> 1), b += 4;
      if (c != -1) {
        wbytes(d, b, f.crc);
        wbytes(d, b + 4, c < 0 ? -c - 2 : c);
        wbytes(d, b + 8, f.size);
      }
      wbytes(d, b + 12, fl2);
      wbytes(d, b + 14, exl), b += 16;
      if (ce != null) {
        wbytes(d, b, col);
        wbytes(d, b + 6, f.attrs);
        wbytes(d, b + 10, ce), b += 14;
      }
      d.set(fn, b);
      b += fl2;
      if (exl) {
        for (var k in ex) {
          var exf = ex[k], l = exf.length;
          wbytes(d, b, +k);
          wbytes(d, b + 2, l);
          d.set(exf, b + 4), b += 4 + l;
        }
      }
      if (col)
        d.set(co, b), b += col;
      return b;
    };
    var wzf = function(o, b, c, d, e) {
      wbytes(o, b, 101010256);
      wbytes(o, b + 8, c);
      wbytes(o, b + 10, c);
      wbytes(o, b + 12, d);
      wbytes(o, b + 16, e);
    };
    var ZipPassThrough = /* @__PURE__ */ (function() {
      function ZipPassThrough2(filename) {
        this.filename = filename;
        this.c = crc();
        this.size = 0;
        this.compression = 0;
      }
      ZipPassThrough2.prototype.process = function(chunk, final) {
        this.ondata(null, chunk, final);
      };
      ZipPassThrough2.prototype.push = function(chunk, final) {
        if (!this.ondata)
          err(5);
        this.c.p(chunk);
        this.size += chunk.length;
        if (final)
          this.crc = this.c.d();
        this.process(chunk, final || false);
      };
      return ZipPassThrough2;
    })();
    exports.ZipPassThrough = ZipPassThrough;
    var ZipDeflate = /* @__PURE__ */ (function() {
      function ZipDeflate2(filename, opts) {
        var _this = this;
        if (!opts)
          opts = {};
        ZipPassThrough.call(this, filename);
        this.d = new Deflate(opts, function(dat, final) {
          _this.ondata(null, dat, final);
        });
        this.compression = 8;
        this.flag = dbf(opts.level);
      }
      ZipDeflate2.prototype.process = function(chunk, final) {
        try {
          this.d.push(chunk, final);
        } catch (e) {
          this.ondata(e, null, final);
        }
      };
      ZipDeflate2.prototype.push = function(chunk, final) {
        ZipPassThrough.prototype.push.call(this, chunk, final);
      };
      return ZipDeflate2;
    })();
    exports.ZipDeflate = ZipDeflate;
    var AsyncZipDeflate = /* @__PURE__ */ (function() {
      function AsyncZipDeflate2(filename, opts) {
        var _this = this;
        if (!opts)
          opts = {};
        ZipPassThrough.call(this, filename);
        this.d = new AsyncDeflate(opts, function(err2, dat, final) {
          _this.ondata(err2, dat, final);
        });
        this.compression = 8;
        this.flag = dbf(opts.level);
        this.terminate = this.d.terminate;
      }
      AsyncZipDeflate2.prototype.process = function(chunk, final) {
        this.d.push(chunk, final);
      };
      AsyncZipDeflate2.prototype.push = function(chunk, final) {
        ZipPassThrough.prototype.push.call(this, chunk, final);
      };
      return AsyncZipDeflate2;
    })();
    exports.AsyncZipDeflate = AsyncZipDeflate;
    var Zip = /* @__PURE__ */ (function() {
      function Zip2(cb) {
        this.ondata = cb;
        this.u = [];
        this.d = 1;
      }
      Zip2.prototype.add = function(file) {
        var _this = this;
        if (!this.ondata)
          err(5);
        if (this.d & 2)
          this.ondata(err(4 + (this.d & 1) * 8, 0, 1), null, false);
        else {
          var f = strToU8(file.filename), fl_1 = f.length;
          var com = file.comment, o = com && strToU8(com);
          var u = fl_1 != file.filename.length || o && com.length != o.length;
          var hl_1 = fl_1 + exfl(file.extra) + 30;
          if (fl_1 > 65535)
            this.ondata(err(11, 0, 1), null, false);
          var header = new u8(hl_1);
          wzh(header, 0, file, f, u, -1);
          var chks_1 = [header];
          var pAll_1 = function() {
            for (var _i = 0, chks_2 = chks_1; _i < chks_2.length; _i++) {
              var chk = chks_2[_i];
              _this.ondata(null, chk, false);
            }
            chks_1 = [];
          };
          var tr_1 = this.d;
          this.d = 0;
          var ind_1 = this.u.length;
          var uf_1 = mrg(file, {
            f,
            u,
            o,
            t: function() {
              if (file.terminate)
                file.terminate();
            },
            r: function() {
              pAll_1();
              if (tr_1) {
                var nxt = _this.u[ind_1 + 1];
                if (nxt)
                  nxt.r();
                else
                  _this.d = 1;
              }
              tr_1 = 1;
            }
          });
          var cl_1 = 0;
          file.ondata = function(err2, dat, final) {
            if (err2) {
              _this.ondata(err2, dat, final);
              _this.terminate();
            } else {
              cl_1 += dat.length;
              chks_1.push(dat);
              if (final) {
                var dd = new u8(16);
                wbytes(dd, 0, 134695760);
                wbytes(dd, 4, file.crc);
                wbytes(dd, 8, cl_1);
                wbytes(dd, 12, file.size);
                chks_1.push(dd);
                uf_1.c = cl_1, uf_1.b = hl_1 + cl_1 + 16, uf_1.crc = file.crc, uf_1.size = file.size;
                if (tr_1)
                  uf_1.r();
                tr_1 = 1;
              } else if (tr_1)
                pAll_1();
            }
          };
          this.u.push(uf_1);
        }
      };
      Zip2.prototype.end = function() {
        var _this = this;
        if (this.d & 2) {
          this.ondata(err(4 + (this.d & 1) * 8, 0, 1), null, true);
          return;
        }
        if (this.d)
          this.e();
        else
          this.u.push({
            r: function() {
              if (!(_this.d & 1))
                return;
              _this.u.splice(-1, 1);
              _this.e();
            },
            t: function() {
            }
          });
        this.d = 3;
      };
      Zip2.prototype.e = function() {
        var bt = 0, l = 0, tl = 0;
        for (var _i = 0, _a2 = this.u; _i < _a2.length; _i++) {
          var f = _a2[_i];
          tl += 46 + f.f.length + exfl(f.extra) + (f.o ? f.o.length : 0);
        }
        var out = new u8(tl + 22);
        for (var _b2 = 0, _c = this.u; _b2 < _c.length; _b2++) {
          var f = _c[_b2];
          wzh(out, bt, f, f.f, f.u, -f.c - 2, l, f.o);
          bt += 46 + f.f.length + exfl(f.extra) + (f.o ? f.o.length : 0), l += f.b;
        }
        wzf(out, bt, this.u.length, tl, l);
        this.ondata(null, out, true);
        this.d = 2;
      };
      Zip2.prototype.terminate = function() {
        for (var _i = 0, _a2 = this.u; _i < _a2.length; _i++) {
          var f = _a2[_i];
          f.t();
        }
        this.d = 2;
      };
      return Zip2;
    })();
    exports.Zip = Zip;
    function zip(data, opts, cb) {
      if (!cb)
        cb = opts, opts = {};
      if (typeof cb != "function")
        err(7);
      var r = {};
      fltn(data, "", r, opts);
      var k = Object.keys(r);
      var lft = k.length, o = 0, tot = 0;
      var slft = lft, files = new Array(lft);
      var term = [];
      var tAll = function() {
        for (var i3 = 0; i3 < term.length; ++i3)
          term[i3]();
      };
      var cbd = function(a, b) {
        mt(function() {
          cb(a, b);
        });
      };
      mt(function() {
        cbd = cb;
      });
      var cbf = function() {
        var out = new u8(tot + 22), oe = o, cdl = tot - o;
        tot = 0;
        for (var i3 = 0; i3 < slft; ++i3) {
          var f = files[i3];
          try {
            var l = f.c.length;
            wzh(out, tot, f, f.f, f.u, l);
            var badd = 30 + f.f.length + exfl(f.extra);
            var loc = tot + badd;
            out.set(f.c, loc);
            wzh(out, o, f, f.f, f.u, l, tot, f.m), o += 16 + badd + (f.m ? f.m.length : 0), tot = loc + l;
          } catch (e) {
            return cbd(e, null);
          }
        }
        wzf(out, o, files.length, cdl, oe);
        cbd(null, out);
      };
      if (!lft)
        cbf();
      var _loop_1 = function(i3) {
        var fn = k[i3];
        var _a2 = r[fn], file = _a2[0], p = _a2[1];
        var c = crc(), size = file.length;
        c.p(file);
        var f = strToU8(fn), s = f.length;
        var com = p.comment, m = com && strToU8(com), ms = m && m.length;
        var exl = exfl(p.extra);
        var compression = p.level == 0 ? 0 : 8;
        var cbl = function(e, d) {
          if (e) {
            tAll();
            cbd(e, null);
          } else {
            var l = d.length;
            files[i3] = mrg(p, {
              size,
              crc: c.d(),
              c: d,
              f,
              m,
              u: s != fn.length || m && com.length != ms,
              compression
            });
            o += 30 + s + exl + l;
            tot += 76 + 2 * (s + exl) + (ms || 0) + l;
            if (!--lft)
              cbf();
          }
        };
        if (s > 65535)
          cbl(err(11, 0, 1), null);
        if (!compression)
          cbl(null, file);
        else if (size < 16e4) {
          try {
            cbl(null, deflateSync(file, p));
          } catch (e) {
            cbl(e, null);
          }
        } else
          term.push(deflate(file, p, cbl));
      };
      for (var i2 = 0; i2 < slft; ++i2) {
        _loop_1(i2);
      }
      return tAll;
    }
    function zipSync(data, opts) {
      if (!opts)
        opts = {};
      var r = {};
      var files = [];
      fltn(data, "", r, opts);
      var o = 0;
      var tot = 0;
      for (var fn in r) {
        var _a2 = r[fn], file = _a2[0], p = _a2[1];
        var compression = p.level == 0 ? 0 : 8;
        var f = strToU8(fn), s = f.length;
        var com = p.comment, m = com && strToU8(com), ms = m && m.length;
        var exl = exfl(p.extra);
        if (s > 65535)
          err(11);
        var d = compression ? deflateSync(file, p) : file, l = d.length;
        var c = crc();
        c.p(file);
        files.push(mrg(p, {
          size: file.length,
          crc: c.d(),
          c: d,
          f,
          m,
          u: s != fn.length || m && com.length != ms,
          o,
          compression
        }));
        o += 30 + s + exl + l;
        tot += 76 + 2 * (s + exl) + (ms || 0) + l;
      }
      var out = new u8(tot + 22), oe = o, cdl = tot - o;
      for (var i2 = 0; i2 < files.length; ++i2) {
        var f = files[i2];
        wzh(out, f.o, f, f.f, f.u, f.c.length);
        var badd = 30 + f.f.length + exfl(f.extra);
        out.set(f.c, f.o + badd);
        wzh(out, o, f, f.f, f.u, f.c.length, f.o, f.m), o += 16 + badd + (f.m ? f.m.length : 0);
      }
      wzf(out, o, files.length, cdl, oe);
      return out;
    }
    var UnzipPassThrough = /* @__PURE__ */ (function() {
      function UnzipPassThrough2() {
      }
      UnzipPassThrough2.prototype.push = function(chunk, final) {
        this.ondata(null, chunk, final);
      };
      UnzipPassThrough2.compression = 0;
      return UnzipPassThrough2;
    })();
    exports.UnzipPassThrough = UnzipPassThrough;
    var UnzipInflate = /* @__PURE__ */ (function() {
      function UnzipInflate2() {
        var _this = this;
        this.i = new Inflate(function(dat, final) {
          _this.ondata(null, dat, final);
        });
      }
      UnzipInflate2.prototype.push = function(chunk, final) {
        try {
          this.i.push(chunk, final);
        } catch (e) {
          this.ondata(e, null, final);
        }
      };
      UnzipInflate2.compression = 8;
      return UnzipInflate2;
    })();
    exports.UnzipInflate = UnzipInflate;
    var AsyncUnzipInflate = /* @__PURE__ */ (function() {
      function AsyncUnzipInflate2(_, sz) {
        var _this = this;
        if (sz < 32e4) {
          this.i = new Inflate(function(dat, final) {
            _this.ondata(null, dat, final);
          });
        } else {
          this.i = new AsyncInflate(function(err2, dat, final) {
            _this.ondata(err2, dat, final);
          });
          this.terminate = this.i.terminate;
        }
      }
      AsyncUnzipInflate2.prototype.push = function(chunk, final) {
        if (this.i.terminate)
          chunk = slc(chunk, 0);
        this.i.push(chunk, final);
      };
      AsyncUnzipInflate2.compression = 8;
      return AsyncUnzipInflate2;
    })();
    exports.AsyncUnzipInflate = AsyncUnzipInflate;
    var Unzip = /* @__PURE__ */ (function() {
      function Unzip2(cb) {
        this.onfile = cb;
        this.k = [];
        this.o = {
          0: UnzipPassThrough
        };
        this.p = et;
      }
      Unzip2.prototype.push = function(chunk, final) {
        var _this = this;
        if (!this.onfile)
          err(5);
        if (!this.p)
          err(4);
        if (this.c > 0) {
          var len = Math.min(this.c, chunk.length);
          var toAdd = chunk.subarray(0, len);
          this.c -= len;
          if (this.d)
            this.d.push(toAdd, !this.c);
          else
            this.k[0].push(toAdd);
          chunk = chunk.subarray(len);
          if (chunk.length)
            return this.push(chunk, final);
        } else {
          var f = 0, i2 = 0, is = void 0, buf = void 0;
          if (!this.p.length)
            buf = chunk;
          else if (!chunk.length)
            buf = this.p;
          else {
            buf = new u8(this.p.length + chunk.length);
            buf.set(this.p), buf.set(chunk, this.p.length);
          }
          var l = buf.length, oc = this.c, add = oc && this.d;
          var _loop_2 = function() {
            var sig = b4(buf, i2);
            if (sig == 67324752) {
              f = 1, is = i2;
              this_1.d = null;
              this_1.c = 0;
              var bf = b2(buf, i2 + 6), cmp_1 = b2(buf, i2 + 8), u = bf & 2048, dd = bf & 8, fnl = b2(buf, i2 + 26), es = b2(buf, i2 + 28);
              if (l > i2 + 30 + fnl + es) {
                var chks_3 = [];
                this_1.k.unshift(chks_3);
                f = 2;
                var lsc = b4(buf, i2 + 18), lsu = b4(buf, i2 + 22);
                var fn_1 = strFromU8(buf.subarray(i2 + 30, i2 += 30 + fnl), !u);
                var _a2 = z64hs(buf, i2, es, 2, lsc, lsu, 0), sc_1 = _a2[0], su_1 = _a2[1], z64 = _a2[3];
                if (dd)
                  sc_1 = -1 - z64;
                i2 += es;
                this_1.c = sc_1;
                var d_1;
                var file_1 = {
                  name: fn_1,
                  compression: cmp_1,
                  start: function() {
                    if (!file_1.ondata)
                      err(5);
                    if (!sc_1)
                      file_1.ondata(null, et, true);
                    else {
                      var ctr = _this.o[cmp_1];
                      if (!ctr)
                        file_1.ondata(err(14, "unknown compression type " + cmp_1, 1), null, false);
                      d_1 = sc_1 < 0 ? new ctr(fn_1) : new ctr(fn_1, sc_1, su_1);
                      d_1.ondata = function(err2, dat3, final2) {
                        file_1.ondata(err2, dat3, final2);
                      };
                      for (var _i = 0, chks_4 = chks_3; _i < chks_4.length; _i++) {
                        var dat2 = chks_4[_i];
                        d_1.push(dat2, false);
                      }
                      if (_this.k[0] == chks_3 && _this.c)
                        _this.d = d_1;
                      else
                        d_1.push(et, true);
                    }
                  },
                  terminate: function() {
                    if (d_1 && d_1.terminate)
                      d_1.terminate();
                  }
                };
                if (sc_1 >= 0)
                  file_1.size = sc_1, file_1.originalSize = su_1;
                this_1.onfile(file_1);
              }
              return "break";
            } else if (oc) {
              if (sig == 134695760) {
                is = i2 += 12 + (oc == -2 && 8), f = 3, this_1.c = 0;
                return "break";
              } else if (sig == 33639248) {
                is = i2 -= 4, f = 3, this_1.c = 0;
                return "break";
              }
            }
          };
          var this_1 = this;
          for (; i2 < l - 4; ++i2) {
            var state_1 = _loop_2();
            if (state_1 === "break")
              break;
          }
          this.p = et;
          if (oc < 0) {
            var dat = f ? buf.subarray(0, is - 12 - (oc == -2 && 8) - (b4(buf, is - 16) == 134695760 && 4)) : buf.subarray(0, i2);
            if (add)
              add.push(dat, !!f);
            else
              this.k[+(f == 2)].push(dat);
          }
          if (f & 2)
            return this.push(buf.subarray(i2), final);
          this.p = buf.subarray(i2);
        }
        if (final) {
          if (this.c)
            err(13);
          this.p = null;
        }
      };
      Unzip2.prototype.register = function(decoder) {
        this.o[decoder.compression] = decoder;
      };
      return Unzip2;
    })();
    exports.Unzip = Unzip;
    var mt = typeof queueMicrotask == "function" ? queueMicrotask : typeof setTimeout == "function" ? setTimeout : function(fn) {
      fn();
    };
    function unzip(data, opts, cb) {
      if (!cb)
        cb = opts, opts = {};
      if (typeof cb != "function")
        err(7);
      var term = [];
      var tAll = function() {
        for (var i3 = 0; i3 < term.length; ++i3)
          term[i3]();
      };
      var files = {};
      var cbd = function(a, b) {
        mt(function() {
          cb(a, b);
        });
      };
      mt(function() {
        cbd = cb;
      });
      var e = data.length - 22;
      for (; b4(data, e) != 101010256; --e) {
        if (!e || data.length - e > 65558) {
          cbd(err(13, 0, 1), null);
          return tAll;
        }
      }
      ;
      var lft = b2(data, e + 8);
      if (lft) {
        var c = lft;
        var o = b4(data, e + 16);
        var z = b4(data, e - 20) == 117853008;
        if (z) {
          var ze = b4(data, e - 12);
          z = b4(data, ze) == 101075792;
          if (z) {
            c = lft = b4(data, ze + 32);
            o = b4(data, ze + 48);
          }
        }
        var fltr = opts && opts.filter;
        var _loop_3 = function(i3) {
          var _a2 = zh(data, o, z), c_1 = _a2[0], sc = _a2[1], su = _a2[2], fn = _a2[3], no = _a2[4], off = _a2[5], b = slzh(data, off);
          o = no;
          var cbl = function(e2, d) {
            if (e2) {
              tAll();
              cbd(e2, null);
            } else {
              if (d)
                files[fn] = d;
              if (!--lft)
                cbd(null, files);
            }
          };
          if (!fltr || fltr({
            name: fn,
            size: sc,
            originalSize: su,
            compression: c_1
          })) {
            if (!c_1)
              cbl(null, slc(data, b, b + sc));
            else if (c_1 == 8) {
              var infl = data.subarray(b, b + sc);
              if (su < 524288 || sc > 0.8 * su) {
                try {
                  cbl(null, inflateSync(infl, { out: new u8(su) }));
                } catch (e2) {
                  cbl(e2, null);
                }
              } else
                term.push(inflate(infl, { size: su }, cbl));
            } else
              cbl(err(14, "unknown compression type " + c_1, 1), null);
          } else
            cbl(null, null);
        };
        for (var i2 = 0; i2 < c; ++i2) {
          _loop_3(i2);
        }
      } else
        cbd(null, {});
      return tAll;
    }
    function unzipSync2(data, opts) {
      var files = {};
      var e = data.length - 22;
      for (; b4(data, e) != 101010256; --e) {
        if (!e || data.length - e > 65558)
          err(13);
      }
      ;
      var c = b2(data, e + 8);
      if (!c)
        return {};
      var o = b4(data, e + 16);
      var z = b4(data, e - 20) == 117853008;
      if (z) {
        var ze = b4(data, e - 12);
        z = b4(data, ze) == 101075792;
        if (z) {
          c = b4(data, ze + 32);
          o = b4(data, ze + 48);
        }
      }
      var fltr = opts && opts.filter;
      for (var i2 = 0; i2 < c; ++i2) {
        var _a2 = zh(data, o, z), c_2 = _a2[0], sc = _a2[1], su = _a2[2], fn = _a2[3], no = _a2[4], off = _a2[5], b = slzh(data, off);
        o = no;
        if (!fltr || fltr({
          name: fn,
          size: sc,
          originalSize: su,
          compression: c_2
        })) {
          if (!c_2)
            files[fn] = slc(data, b, b + sc);
          else if (c_2 == 8)
            files[fn] = inflateSync(data.subarray(b, b + sc), { out: new u8(su) });
          else
            err(14, "unknown compression type " + c_2);
        }
      }
      return files;
    }
  }
});

// source_code/تعديلات على المكتبة/.artifacts/zuwayd-word-followup-20261007/build-dependency-runtime/node_modules/fast-xml-parser/src/util.js
var require_util = __commonJS({
  "source_code/\u062A\u0639\u062F\u064A\u0644\u0627\u062A \u0639\u0644\u0649 \u0627\u0644\u0645\u0643\u062A\u0628\u0629/.artifacts/zuwayd-word-followup-20261007/build-dependency-runtime/node_modules/fast-xml-parser/src/util.js"(exports) {
    "use strict";
    var nameStartChar = ":A-Za-z_\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD";
    var nameChar = nameStartChar + "\\-.\\d\\u00B7\\u0300-\\u036F\\u203F-\\u2040";
    var nameRegexp = "[" + nameStartChar + "][" + nameChar + "]*";
    var regexName = new RegExp("^" + nameRegexp + "$");
    var getAllMatches = function(string, regex) {
      const matches = [];
      let match = regex.exec(string);
      while (match) {
        const allmatches = [];
        allmatches.startIndex = regex.lastIndex - match[0].length;
        const len = match.length;
        for (let index = 0; index < len; index++) {
          allmatches.push(match[index]);
        }
        matches.push(allmatches);
        match = regex.exec(string);
      }
      return matches;
    };
    var isName = function(string) {
      const match = regexName.exec(string);
      return !(match === null || typeof match === "undefined");
    };
    exports.isExist = function(v) {
      return typeof v !== "undefined";
    };
    exports.isEmptyObject = function(obj) {
      return Object.keys(obj).length === 0;
    };
    exports.merge = function(target, a, arrayMode) {
      if (a) {
        const keys = Object.keys(a);
        const len = keys.length;
        for (let i = 0; i < len; i++) {
          if (arrayMode === "strict") {
            target[keys[i]] = [a[keys[i]]];
          } else {
            target[keys[i]] = a[keys[i]];
          }
        }
      }
    };
    exports.getValue = function(v) {
      if (exports.isExist(v)) {
        return v;
      } else {
        return "";
      }
    };
    var DANGEROUS_PROPERTY_NAMES = [
      // '__proto__',
      // 'constructor',
      // 'prototype',
      "hasOwnProperty",
      "toString",
      "valueOf",
      "__defineGetter__",
      "__defineSetter__",
      "__lookupGetter__",
      "__lookupSetter__"
    ];
    var criticalProperties = ["__proto__", "constructor", "prototype"];
    exports.isName = isName;
    exports.getAllMatches = getAllMatches;
    exports.nameRegexp = nameRegexp;
    exports.DANGEROUS_PROPERTY_NAMES = DANGEROUS_PROPERTY_NAMES;
    exports.criticalProperties = criticalProperties;
  }
});

// source_code/تعديلات على المكتبة/.artifacts/zuwayd-word-followup-20261007/build-dependency-runtime/node_modules/fast-xml-parser/src/validator.js
var require_validator = __commonJS({
  "source_code/\u062A\u0639\u062F\u064A\u0644\u0627\u062A \u0639\u0644\u0649 \u0627\u0644\u0645\u0643\u062A\u0628\u0629/.artifacts/zuwayd-word-followup-20261007/build-dependency-runtime/node_modules/fast-xml-parser/src/validator.js"(exports) {
    "use strict";
    var util = require_util();
    var defaultOptions = {
      allowBooleanAttributes: false,
      //A tag can have attributes without any value
      unpairedTags: []
    };
    exports.validate = function(xmlData, options) {
      options = Object.assign({}, defaultOptions, options);
      const tags = [];
      let tagFound = false;
      let reachedRoot = false;
      if (xmlData[0] === "\uFEFF") {
        xmlData = xmlData.substr(1);
      }
      for (let i = 0; i < xmlData.length; i++) {
        if (xmlData[i] === "<" && xmlData[i + 1] === "?") {
          i += 2;
          i = readPI(xmlData, i);
          if (i.err) return i;
        } else if (xmlData[i] === "<") {
          let tagStartPos = i;
          i++;
          if (xmlData[i] === "!") {
            i = readCommentAndCDATA(xmlData, i);
            continue;
          } else {
            let closingTag = false;
            if (xmlData[i] === "/") {
              closingTag = true;
              i++;
            }
            let tagName = "";
            for (; i < xmlData.length && xmlData[i] !== ">" && xmlData[i] !== " " && xmlData[i] !== "	" && xmlData[i] !== "\n" && xmlData[i] !== "\r"; i++) {
              tagName += xmlData[i];
            }
            tagName = tagName.trim();
            if (tagName[tagName.length - 1] === "/") {
              tagName = tagName.substring(0, tagName.length - 1);
              i--;
            }
            if (!validateTagName(tagName)) {
              let msg;
              if (tagName.trim().length === 0) {
                msg = "Invalid space after '<'.";
              } else {
                msg = "Tag '" + tagName + "' is an invalid name.";
              }
              return getErrorObject("InvalidTag", msg, getLineNumberForPosition(xmlData, i));
            }
            const result = readAttributeStr(xmlData, i);
            if (result === false) {
              return getErrorObject("InvalidAttr", "Attributes for '" + tagName + "' have open quote.", getLineNumberForPosition(xmlData, i));
            }
            let attrStr = result.value;
            i = result.index;
            if (attrStr[attrStr.length - 1] === "/") {
              const attrStrStart = i - attrStr.length;
              attrStr = attrStr.substring(0, attrStr.length - 1);
              const isValid = validateAttributeString(attrStr, options);
              if (isValid === true) {
                tagFound = true;
              } else {
                return getErrorObject(isValid.err.code, isValid.err.msg, getLineNumberForPosition(xmlData, attrStrStart + isValid.err.line));
              }
            } else if (closingTag) {
              if (!result.tagClosed) {
                return getErrorObject("InvalidTag", "Closing tag '" + tagName + "' doesn't have proper closing.", getLineNumberForPosition(xmlData, i));
              } else if (attrStr.trim().length > 0) {
                return getErrorObject("InvalidTag", "Closing tag '" + tagName + "' can't have attributes or invalid starting.", getLineNumberForPosition(xmlData, tagStartPos));
              } else if (tags.length === 0) {
                return getErrorObject("InvalidTag", "Closing tag '" + tagName + "' has not been opened.", getLineNumberForPosition(xmlData, tagStartPos));
              } else {
                const otg = tags.pop();
                if (tagName !== otg.tagName) {
                  let openPos = getLineNumberForPosition(xmlData, otg.tagStartPos);
                  return getErrorObject(
                    "InvalidTag",
                    "Expected closing tag '" + otg.tagName + "' (opened in line " + openPos.line + ", col " + openPos.col + ") instead of closing tag '" + tagName + "'.",
                    getLineNumberForPosition(xmlData, tagStartPos)
                  );
                }
                if (tags.length == 0) {
                  reachedRoot = true;
                }
              }
            } else {
              const isValid = validateAttributeString(attrStr, options);
              if (isValid !== true) {
                return getErrorObject(isValid.err.code, isValid.err.msg, getLineNumberForPosition(xmlData, i - attrStr.length + isValid.err.line));
              }
              if (reachedRoot === true) {
                return getErrorObject("InvalidXml", "Multiple possible root nodes found.", getLineNumberForPosition(xmlData, i));
              } else if (options.unpairedTags.indexOf(tagName) !== -1) {
              } else {
                tags.push({ tagName, tagStartPos });
              }
              tagFound = true;
            }
            for (i++; i < xmlData.length; i++) {
              if (xmlData[i] === "<") {
                if (xmlData[i + 1] === "!") {
                  i++;
                  i = readCommentAndCDATA(xmlData, i);
                  continue;
                } else if (xmlData[i + 1] === "?") {
                  i = readPI(xmlData, ++i);
                  if (i.err) return i;
                } else {
                  break;
                }
              } else if (xmlData[i] === "&") {
                const afterAmp = validateAmpersand(xmlData, i);
                if (afterAmp == -1)
                  return getErrorObject("InvalidChar", "char '&' is not expected.", getLineNumberForPosition(xmlData, i));
                i = afterAmp;
              } else {
                if (reachedRoot === true && !isWhiteSpace(xmlData[i])) {
                  return getErrorObject("InvalidXml", "Extra text at the end", getLineNumberForPosition(xmlData, i));
                }
              }
            }
            if (xmlData[i] === "<") {
              i--;
            }
          }
        } else {
          if (isWhiteSpace(xmlData[i])) {
            continue;
          }
          return getErrorObject("InvalidChar", "char '" + xmlData[i] + "' is not expected.", getLineNumberForPosition(xmlData, i));
        }
      }
      if (!tagFound) {
        return getErrorObject("InvalidXml", "Start tag expected.", 1);
      } else if (tags.length == 1) {
        return getErrorObject("InvalidTag", "Unclosed tag '" + tags[0].tagName + "'.", getLineNumberForPosition(xmlData, tags[0].tagStartPos));
      } else if (tags.length > 0) {
        return getErrorObject("InvalidXml", "Invalid '" + JSON.stringify(tags.map((t) => t.tagName), null, 4).replace(/\r?\n/g, "") + "' found.", { line: 1, col: 1 });
      }
      return true;
    };
    function isWhiteSpace(char) {
      return char === " " || char === "	" || char === "\n" || char === "\r";
    }
    function readPI(xmlData, i) {
      const start = i;
      for (; i < xmlData.length; i++) {
        if (xmlData[i] == "?" || xmlData[i] == " ") {
          const tagname = xmlData.substr(start, i - start);
          if (i > 5 && tagname === "xml") {
            return getErrorObject("InvalidXml", "XML declaration allowed only at the start of the document.", getLineNumberForPosition(xmlData, i));
          } else if (xmlData[i] == "?" && xmlData[i + 1] == ">") {
            i++;
            break;
          } else {
            continue;
          }
        }
      }
      return i;
    }
    function readCommentAndCDATA(xmlData, i) {
      if (xmlData.length > i + 5 && xmlData[i + 1] === "-" && xmlData[i + 2] === "-") {
        for (i += 3; i < xmlData.length; i++) {
          if (xmlData[i] === "-" && xmlData[i + 1] === "-" && xmlData[i + 2] === ">") {
            i += 2;
            break;
          }
        }
      } else if (xmlData.length > i + 8 && xmlData[i + 1] === "D" && xmlData[i + 2] === "O" && xmlData[i + 3] === "C" && xmlData[i + 4] === "T" && xmlData[i + 5] === "Y" && xmlData[i + 6] === "P" && xmlData[i + 7] === "E") {
        let angleBracketsCount = 1;
        for (i += 8; i < xmlData.length; i++) {
          if (xmlData[i] === "<") {
            angleBracketsCount++;
          } else if (xmlData[i] === ">") {
            angleBracketsCount--;
            if (angleBracketsCount === 0) {
              break;
            }
          }
        }
      } else if (xmlData.length > i + 9 && xmlData[i + 1] === "[" && xmlData[i + 2] === "C" && xmlData[i + 3] === "D" && xmlData[i + 4] === "A" && xmlData[i + 5] === "T" && xmlData[i + 6] === "A" && xmlData[i + 7] === "[") {
        for (i += 8; i < xmlData.length; i++) {
          if (xmlData[i] === "]" && xmlData[i + 1] === "]" && xmlData[i + 2] === ">") {
            i += 2;
            break;
          }
        }
      }
      return i;
    }
    var doubleQuote = '"';
    var singleQuote = "'";
    function readAttributeStr(xmlData, i) {
      let attrStr = "";
      let startChar = "";
      let tagClosed = false;
      for (; i < xmlData.length; i++) {
        if (xmlData[i] === doubleQuote || xmlData[i] === singleQuote) {
          if (startChar === "") {
            startChar = xmlData[i];
          } else if (startChar !== xmlData[i]) {
          } else {
            startChar = "";
          }
        } else if (xmlData[i] === ">") {
          if (startChar === "") {
            tagClosed = true;
            break;
          }
        }
        attrStr += xmlData[i];
      }
      if (startChar !== "") {
        return false;
      }
      return {
        value: attrStr,
        index: i,
        tagClosed
      };
    }
    var validAttrStrRegxp = new RegExp(`(\\s*)([^\\s=]+)(\\s*=)?(\\s*(['"])(([\\s\\S])*?)\\5)?`, "g");
    function validateAttributeString(attrStr, options) {
      const matches = util.getAllMatches(attrStr, validAttrStrRegxp);
      const attrNames = {};
      for (let i = 0; i < matches.length; i++) {
        if (matches[i][1].length === 0) {
          return getErrorObject("InvalidAttr", "Attribute '" + matches[i][2] + "' has no space in starting.", getPositionFromMatch(matches[i]));
        } else if (matches[i][3] !== void 0 && matches[i][4] === void 0) {
          return getErrorObject("InvalidAttr", "Attribute '" + matches[i][2] + "' is without value.", getPositionFromMatch(matches[i]));
        } else if (matches[i][3] === void 0 && !options.allowBooleanAttributes) {
          return getErrorObject("InvalidAttr", "boolean attribute '" + matches[i][2] + "' is not allowed.", getPositionFromMatch(matches[i]));
        }
        const attrName = matches[i][2];
        if (!validateAttrName(attrName)) {
          return getErrorObject("InvalidAttr", "Attribute '" + attrName + "' is an invalid name.", getPositionFromMatch(matches[i]));
        }
        if (!attrNames.hasOwnProperty(attrName)) {
          attrNames[attrName] = 1;
        } else {
          return getErrorObject("InvalidAttr", "Attribute '" + attrName + "' is repeated.", getPositionFromMatch(matches[i]));
        }
      }
      return true;
    }
    function validateNumberAmpersand(xmlData, i) {
      let re = /\d/;
      if (xmlData[i] === "x") {
        i++;
        re = /[\da-fA-F]/;
      }
      for (; i < xmlData.length; i++) {
        if (xmlData[i] === ";")
          return i;
        if (!xmlData[i].match(re))
          break;
      }
      return -1;
    }
    function validateAmpersand(xmlData, i) {
      i++;
      if (xmlData[i] === ";")
        return -1;
      if (xmlData[i] === "#") {
        i++;
        return validateNumberAmpersand(xmlData, i);
      }
      let count = 0;
      for (; i < xmlData.length; i++, count++) {
        if (xmlData[i].match(/\w/) && count < 20)
          continue;
        if (xmlData[i] === ";")
          break;
        return -1;
      }
      return i;
    }
    function getErrorObject(code, message, lineNumber) {
      return {
        err: {
          code,
          msg: message,
          line: lineNumber.line || lineNumber,
          col: lineNumber.col
        }
      };
    }
    function validateAttrName(attrName) {
      return util.isName(attrName);
    }
    function validateTagName(tagname) {
      return util.isName(tagname);
    }
    function getLineNumberForPosition(xmlData, index) {
      const lines = xmlData.substring(0, index).split(/\r?\n/);
      return {
        line: lines.length,
        // column number is last line's length + 1, because column numbering starts at 1:
        col: lines[lines.length - 1].length + 1
      };
    }
    function getPositionFromMatch(match) {
      return match.startIndex + match[1].length;
    }
  }
});

// source_code/تعديلات على المكتبة/.artifacts/zuwayd-word-followup-20261007/build-dependency-runtime/node_modules/fast-xml-parser/src/xmlparser/OptionsBuilder.js
var require_OptionsBuilder = __commonJS({
  "source_code/\u062A\u0639\u062F\u064A\u0644\u0627\u062A \u0639\u0644\u0649 \u0627\u0644\u0645\u0643\u062A\u0628\u0629/.artifacts/zuwayd-word-followup-20261007/build-dependency-runtime/node_modules/fast-xml-parser/src/xmlparser/OptionsBuilder.js"(exports) {
    var { DANGEROUS_PROPERTY_NAMES, criticalProperties } = require_util();
    var defaultOnDangerousProperty = (name) => {
      if (DANGEROUS_PROPERTY_NAMES.includes(name)) {
        return "__" + name;
      }
      return name;
    };
    var defaultOptions = {
      preserveOrder: false,
      attributeNamePrefix: "@_",
      attributesGroupName: false,
      textNodeName: "#text",
      ignoreAttributes: true,
      removeNSPrefix: false,
      // remove NS from tag name or attribute name if true
      allowBooleanAttributes: false,
      //a tag can have attributes without any value
      //ignoreRootElement : false,
      parseTagValue: true,
      parseAttributeValue: false,
      trimValues: true,
      //Trim string values of tag and attributes
      cdataPropName: false,
      numberParseOptions: {
        hex: true,
        leadingZeros: true,
        eNotation: true
      },
      tagValueProcessor: function(tagName, val) {
        return val;
      },
      attributeValueProcessor: function(attrName, val) {
        return val;
      },
      stopNodes: [],
      //nested tags will not be parsed even for errors
      alwaysCreateTextNode: false,
      isArray: () => false,
      commentPropName: false,
      unpairedTags: [],
      processEntities: true,
      htmlEntities: false,
      ignoreDeclaration: false,
      ignorePiTags: false,
      transformTagName: false,
      transformAttributeName: false,
      updateTag: function(tagName, jPath, attrs) {
        return tagName;
      },
      // skipEmptyListItem: false
      captureMetaData: false,
      maxNestedTags: 100,
      strictReservedNames: true,
      onDangerousProperty: defaultOnDangerousProperty
    };
    function validatePropertyName(propertyName, optionName) {
      if (typeof propertyName !== "string") {
        return;
      }
      const normalized = propertyName.toLowerCase();
      if (DANGEROUS_PROPERTY_NAMES.some((dangerous) => normalized === dangerous.toLowerCase())) {
        throw new Error(
          `[SECURITY] Invalid ${optionName}: "${propertyName}" is a reserved JavaScript keyword that could cause prototype pollution`
        );
      }
      if (criticalProperties.some((dangerous) => normalized === dangerous.toLowerCase())) {
        throw new Error(
          `[SECURITY] Invalid ${optionName}: "${propertyName}" is a reserved JavaScript keyword that could cause prototype pollution`
        );
      }
    }
    function normalizeProcessEntities(value) {
      if (typeof value === "boolean") {
        return {
          enabled: value,
          // true or false
          maxEntitySize: 1e4,
          maxExpansionDepth: 10,
          maxTotalExpansions: 1e3,
          maxExpandedLength: 1e5,
          allowedTags: null,
          tagFilter: null
        };
      }
      if (typeof value === "object" && value !== null) {
        return {
          enabled: value.enabled !== false,
          maxEntitySize: Math.max(1, value.maxEntitySize ?? 1e4),
          maxExpansionDepth: Math.max(1, value.maxExpansionDepth ?? 1e4),
          maxTotalExpansions: Math.max(1, value.maxTotalExpansions ?? Infinity),
          maxExpandedLength: Math.max(1, value.maxExpandedLength ?? 1e5),
          maxEntityCount: Math.max(1, value.maxEntityCount ?? 1e3),
          allowedTags: value.allowedTags ?? null,
          tagFilter: value.tagFilter ?? null
        };
      }
      return normalizeProcessEntities(true);
    }
    var buildOptions = function(options) {
      const built = Object.assign({}, defaultOptions, options);
      const propertyNameOptions = [
        { value: built.attributeNamePrefix, name: "attributeNamePrefix" },
        { value: built.attributesGroupName, name: "attributesGroupName" },
        { value: built.textNodeName, name: "textNodeName" },
        { value: built.cdataPropName, name: "cdataPropName" },
        { value: built.commentPropName, name: "commentPropName" }
      ];
      for (const { value, name } of propertyNameOptions) {
        if (value) {
          validatePropertyName(value, name);
        }
      }
      if (built.onDangerousProperty === null) {
        built.onDangerousProperty = defaultOnDangerousProperty;
      }
      built.processEntities = normalizeProcessEntities(built.processEntities);
      return built;
    };
    exports.buildOptions = buildOptions;
    exports.defaultOptions = defaultOptions;
  }
});

// source_code/تعديلات على المكتبة/.artifacts/zuwayd-word-followup-20261007/build-dependency-runtime/node_modules/fast-xml-parser/src/xmlparser/xmlNode.js
var require_xmlNode = __commonJS({
  "source_code/\u062A\u0639\u062F\u064A\u0644\u0627\u062A \u0639\u0644\u0649 \u0627\u0644\u0645\u0643\u062A\u0628\u0629/.artifacts/zuwayd-word-followup-20261007/build-dependency-runtime/node_modules/fast-xml-parser/src/xmlparser/xmlNode.js"(exports, module) {
    "use strict";
    var XmlNode = class {
      constructor(tagname) {
        this.tagname = tagname;
        this.child = [];
        this[":@"] = {};
      }
      add(key, val) {
        if (key === "__proto__") key = "#__proto__";
        this.child.push({ [key]: val });
      }
      addChild(node) {
        if (node.tagname === "__proto__") node.tagname = "#__proto__";
        if (node[":@"] && Object.keys(node[":@"]).length > 0) {
          this.child.push({ [node.tagname]: node.child, [":@"]: node[":@"] });
        } else {
          this.child.push({ [node.tagname]: node.child });
        }
      }
    };
    module.exports = XmlNode;
  }
});

// source_code/تعديلات على المكتبة/.artifacts/zuwayd-word-followup-20261007/build-dependency-runtime/node_modules/fast-xml-parser/src/xmlparser/DocTypeReader.js
var require_DocTypeReader = __commonJS({
  "source_code/\u062A\u0639\u062F\u064A\u0644\u0627\u062A \u0639\u0644\u0649 \u0627\u0644\u0645\u0643\u062A\u0628\u0629/.artifacts/zuwayd-word-followup-20261007/build-dependency-runtime/node_modules/fast-xml-parser/src/xmlparser/DocTypeReader.js"(exports, module) {
    var util = require_util();
    var DocTypeReader = class {
      constructor(options) {
        this.suppressValidationErr = !options;
        this.options = options || {};
      }
      readDocType(xmlData, i) {
        const entities = /* @__PURE__ */ Object.create(null);
        let entityCount = 0;
        if (xmlData[i + 3] === "O" && xmlData[i + 4] === "C" && xmlData[i + 5] === "T" && xmlData[i + 6] === "Y" && xmlData[i + 7] === "P" && xmlData[i + 8] === "E") {
          i = i + 9;
          let angleBracketsCount = 1;
          let hasBody = false, comment = false;
          let exp = "";
          for (; i < xmlData.length; i++) {
            if (xmlData[i] === "<" && !comment) {
              if (hasBody && hasSeq(xmlData, "!ENTITY", i)) {
                i += 7;
                let entityName, val;
                [entityName, val, i] = this.readEntityExp(xmlData, i + 1, this.suppressValidationErr);
                if (val.indexOf("&") === -1) {
                  if (this.options.enabled !== false && this.options.maxEntityCount != null && entityCount >= this.options.maxEntityCount) {
                    throw new Error(
                      `Entity count (${entityCount + 1}) exceeds maximum allowed (${this.options.maxEntityCount})`
                    );
                  }
                  const escaped = entityName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                  entities[entityName] = {
                    regx: RegExp(`&${escaped};`, "g"),
                    val
                  };
                  entityCount++;
                }
              } else if (hasBody && hasSeq(xmlData, "!ELEMENT", i)) {
                i += 8;
                const { index } = this.readElementExp(xmlData, i + 1);
                i = index;
              } else if (hasBody && hasSeq(xmlData, "!ATTLIST", i)) {
                i += 8;
              } else if (hasBody && hasSeq(xmlData, "!NOTATION", i)) {
                i += 9;
                const { index } = this.readNotationExp(xmlData, i + 1, this.suppressValidationErr);
                i = index;
              } else if (hasSeq(xmlData, "!--", i)) {
                comment = true;
              } else {
                throw new Error(`Invalid DOCTYPE`);
              }
              angleBracketsCount++;
              exp = "";
            } else if (xmlData[i] === ">") {
              if (comment) {
                if (xmlData[i - 1] === "-" && xmlData[i - 2] === "-") {
                  comment = false;
                  angleBracketsCount--;
                }
              } else {
                angleBracketsCount--;
              }
              if (angleBracketsCount === 0) {
                break;
              }
            } else if (xmlData[i] === "[") {
              hasBody = true;
            } else {
              exp += xmlData[i];
            }
          }
          if (angleBracketsCount !== 0) {
            throw new Error(`Unclosed DOCTYPE`);
          }
        } else {
          throw new Error(`Invalid Tag instead of DOCTYPE`);
        }
        return { entities, i };
      }
      readEntityExp(xmlData, i) {
        i = skipWhitespace(xmlData, i);
        let entityName = "";
        while (i < xmlData.length && !/\s/.test(xmlData[i]) && xmlData[i] !== '"' && xmlData[i] !== "'") {
          entityName += xmlData[i];
          i++;
        }
        validateEntityName(entityName);
        i = skipWhitespace(xmlData, i);
        if (!this.suppressValidationErr) {
          if (xmlData.substring(i, i + 6).toUpperCase() === "SYSTEM") {
            throw new Error("External entities are not supported");
          } else if (xmlData[i] === "%") {
            throw new Error("Parameter entities are not supported");
          }
        }
        let entityValue = "";
        [i, entityValue] = this.readIdentifierVal(xmlData, i, "entity");
        if (this.options.enabled !== false && this.options.maxEntitySize != null && entityValue.length > this.options.maxEntitySize) {
          throw new Error(
            `Entity "${entityName}" size (${entityValue.length}) exceeds maximum allowed size (${this.options.maxEntitySize})`
          );
        }
        i--;
        return [entityName, entityValue, i];
      }
      readNotationExp(xmlData, i) {
        i = skipWhitespace(xmlData, i);
        let notationName = "";
        while (i < xmlData.length && !/\s/.test(xmlData[i])) {
          notationName += xmlData[i];
          i++;
        }
        !this.suppressValidationErr && validateEntityName(notationName);
        i = skipWhitespace(xmlData, i);
        const identifierType = xmlData.substring(i, i + 6).toUpperCase();
        if (!this.suppressValidationErr && identifierType !== "SYSTEM" && identifierType !== "PUBLIC") {
          throw new Error(`Expected SYSTEM or PUBLIC, found "${identifierType}"`);
        }
        i += identifierType.length;
        i = skipWhitespace(xmlData, i);
        let publicIdentifier = null;
        let systemIdentifier = null;
        if (identifierType === "PUBLIC") {
          [i, publicIdentifier] = this.readIdentifierVal(xmlData, i, "publicIdentifier");
          i = skipWhitespace(xmlData, i);
          if (xmlData[i] === '"' || xmlData[i] === "'") {
            [i, systemIdentifier] = this.readIdentifierVal(xmlData, i, "systemIdentifier");
          }
        } else if (identifierType === "SYSTEM") {
          [i, systemIdentifier] = this.readIdentifierVal(xmlData, i, "systemIdentifier");
          if (!this.suppressValidationErr && !systemIdentifier) {
            throw new Error("Missing mandatory system identifier for SYSTEM notation");
          }
        }
        return { notationName, publicIdentifier, systemIdentifier, index: --i };
      }
      readIdentifierVal(xmlData, i, type) {
        let identifierVal = "";
        const startChar = xmlData[i];
        if (startChar !== '"' && startChar !== "'") {
          throw new Error(`Expected quoted string, found "${startChar}"`);
        }
        i++;
        while (i < xmlData.length && xmlData[i] !== startChar) {
          identifierVal += xmlData[i];
          i++;
        }
        if (xmlData[i] !== startChar) {
          throw new Error(`Unterminated ${type} value`);
        }
        i++;
        return [i, identifierVal];
      }
      readElementExp(xmlData, i) {
        i = skipWhitespace(xmlData, i);
        let elementName = "";
        while (i < xmlData.length && !/\s/.test(xmlData[i])) {
          elementName += xmlData[i];
          i++;
        }
        if (!this.suppressValidationErr && !util.isName(elementName)) {
          throw new Error(`Invalid element name: "${elementName}"`);
        }
        i = skipWhitespace(xmlData, i);
        let contentModel = "";
        if (xmlData[i] === "E" && hasSeq(xmlData, "MPTY", i)) {
          i += 4;
        } else if (xmlData[i] === "A" && hasSeq(xmlData, "NY", i)) {
          i += 2;
        } else if (xmlData[i] === "(") {
          i++;
          while (i < xmlData.length && xmlData[i] !== ")") {
            contentModel += xmlData[i];
            i++;
          }
          if (xmlData[i] !== ")") {
            throw new Error("Unterminated content model");
          }
        } else if (!this.suppressValidationErr) {
          throw new Error(`Invalid Element Expression, found "${xmlData[i]}"`);
        }
        return {
          elementName,
          contentModel: contentModel.trim(),
          index: i
        };
      }
      readAttlistExp(xmlData, i) {
        i = skipWhitespace(xmlData, i);
        let elementName = "";
        while (i < xmlData.length && !/\s/.test(xmlData[i])) {
          elementName += xmlData[i];
          i++;
        }
        validateEntityName(elementName);
        i = skipWhitespace(xmlData, i);
        let attributeName = "";
        while (i < xmlData.length && !/\s/.test(xmlData[i])) {
          attributeName += xmlData[i];
          i++;
        }
        if (!validateEntityName(attributeName)) {
          throw new Error(`Invalid attribute name: "${attributeName}"`);
        }
        i = skipWhitespace(xmlData, i);
        let attributeType = "";
        if (xmlData.substring(i, i + 8).toUpperCase() === "NOTATION") {
          attributeType = "NOTATION";
          i += 8;
          i = skipWhitespace(xmlData, i);
          if (xmlData[i] !== "(") {
            throw new Error(`Expected '(', found "${xmlData[i]}"`);
          }
          i++;
          let allowedNotations = [];
          while (i < xmlData.length && xmlData[i] !== ")") {
            let notation = "";
            while (i < xmlData.length && xmlData[i] !== "|" && xmlData[i] !== ")") {
              notation += xmlData[i];
              i++;
            }
            notation = notation.trim();
            if (!validateEntityName(notation)) {
              throw new Error(`Invalid notation name: "${notation}"`);
            }
            allowedNotations.push(notation);
            if (xmlData[i] === "|") {
              i++;
              i = skipWhitespace(xmlData, i);
            }
          }
          if (xmlData[i] !== ")") {
            throw new Error("Unterminated list of notations");
          }
          i++;
          attributeType += " (" + allowedNotations.join("|") + ")";
        } else {
          while (i < xmlData.length && !/\s/.test(xmlData[i])) {
            attributeType += xmlData[i];
            i++;
          }
          const validTypes = ["CDATA", "ID", "IDREF", "IDREFS", "ENTITY", "ENTITIES", "NMTOKEN", "NMTOKENS"];
          if (!this.suppressValidationErr && !validTypes.includes(attributeType.toUpperCase())) {
            throw new Error(`Invalid attribute type: "${attributeType}"`);
          }
        }
        i = skipWhitespace(xmlData, i);
        let defaultValue = "";
        if (xmlData.substring(i, i + 8).toUpperCase() === "#REQUIRED") {
          defaultValue = "#REQUIRED";
          i += 8;
        } else if (xmlData.substring(i, i + 7).toUpperCase() === "#IMPLIED") {
          defaultValue = "#IMPLIED";
          i += 7;
        } else {
          [i, defaultValue] = this.readIdentifierVal(xmlData, i, "ATTLIST");
        }
        return {
          elementName,
          attributeName,
          attributeType,
          defaultValue,
          index: i
        };
      }
    };
    var skipWhitespace = (data, index) => {
      while (index < data.length && /\s/.test(data[index])) {
        index++;
      }
      return index;
    };
    function hasSeq(data, seq, i) {
      for (let j = 0; j < seq.length; j++) {
        if (seq[j] !== data[i + j + 1]) return false;
      }
      return true;
    }
    function validateEntityName(name) {
      if (util.isName(name))
        return name;
      else
        throw new Error(`Invalid entity name ${name}`);
    }
    module.exports = DocTypeReader;
  }
});

// source_code/تعديلات على المكتبة/.artifacts/zuwayd-word-followup-20261007/build-dependency-runtime/node_modules/strnum/strnum.js
var require_strnum = __commonJS({
  "source_code/\u062A\u0639\u062F\u064A\u0644\u0627\u062A \u0639\u0644\u0649 \u0627\u0644\u0645\u0643\u062A\u0628\u0629/.artifacts/zuwayd-word-followup-20261007/build-dependency-runtime/node_modules/strnum/strnum.js"(exports, module) {
    var hexRegex = /^[-+]?0x[a-fA-F0-9]+$/;
    var numRegex = /^([\-\+])?(0*)([0-9]*(\.[0-9]*)?)$/;
    var consider = {
      hex: true,
      // oct: false,
      leadingZeros: true,
      decimalPoint: ".",
      eNotation: true
      //skipLike: /regex/
    };
    function toNumber(str, options = {}) {
      options = Object.assign({}, consider, options);
      if (!str || typeof str !== "string") return str;
      let trimmedStr = str.trim();
      if (options.skipLike !== void 0 && options.skipLike.test(trimmedStr)) return str;
      else if (str === "0") return 0;
      else if (options.hex && hexRegex.test(trimmedStr)) {
        return parse_int(trimmedStr, 16);
      } else if (trimmedStr.search(/[eE]/) !== -1) {
        const notation = trimmedStr.match(/^([-\+])?(0*)([0-9]*(\.[0-9]*)?[eE][-\+]?[0-9]+)$/);
        if (notation) {
          if (options.leadingZeros) {
            trimmedStr = (notation[1] || "") + notation[3];
          } else {
            if (notation[2] === "0" && notation[3][0] === ".") {
            } else {
              return str;
            }
          }
          return options.eNotation ? Number(trimmedStr) : str;
        } else {
          return str;
        }
      } else {
        const match = numRegex.exec(trimmedStr);
        if (match) {
          const sign = match[1];
          const leadingZeros = match[2];
          let numTrimmedByZeros = trimZeros(match[3]);
          if (!options.leadingZeros && leadingZeros.length > 0 && sign && trimmedStr[2] !== ".") return str;
          else if (!options.leadingZeros && leadingZeros.length > 0 && !sign && trimmedStr[1] !== ".") return str;
          else if (options.leadingZeros && leadingZeros === str) return 0;
          else {
            const num = Number(trimmedStr);
            const numStr = "" + num;
            if (numStr.search(/[eE]/) !== -1) {
              if (options.eNotation) return num;
              else return str;
            } else if (trimmedStr.indexOf(".") !== -1) {
              if (numStr === "0" && numTrimmedByZeros === "") return num;
              else if (numStr === numTrimmedByZeros) return num;
              else if (sign && numStr === "-" + numTrimmedByZeros) return num;
              else return str;
            }
            if (leadingZeros) {
              return numTrimmedByZeros === numStr || sign + numTrimmedByZeros === numStr ? num : str;
            } else {
              return trimmedStr === numStr || trimmedStr === sign + numStr ? num : str;
            }
          }
        } else {
          return str;
        }
      }
    }
    function trimZeros(numStr) {
      if (numStr && numStr.indexOf(".") !== -1) {
        numStr = numStr.replace(/0+$/, "");
        if (numStr === ".") numStr = "0";
        else if (numStr[0] === ".") numStr = "0" + numStr;
        else if (numStr[numStr.length - 1] === ".") numStr = numStr.substr(0, numStr.length - 1);
        return numStr;
      }
      return numStr;
    }
    function parse_int(numStr, base) {
      if (parseInt) return parseInt(numStr, base);
      else if (Number.parseInt) return Number.parseInt(numStr, base);
      else if (window && window.parseInt) return window.parseInt(numStr, base);
      else throw new Error("parseInt, Number.parseInt, window.parseInt are not supported");
    }
    module.exports = toNumber;
  }
});

// source_code/تعديلات على المكتبة/.artifacts/zuwayd-word-followup-20261007/build-dependency-runtime/node_modules/fast-xml-parser/src/ignoreAttributes.js
var require_ignoreAttributes = __commonJS({
  "source_code/\u062A\u0639\u062F\u064A\u0644\u0627\u062A \u0639\u0644\u0649 \u0627\u0644\u0645\u0643\u062A\u0628\u0629/.artifacts/zuwayd-word-followup-20261007/build-dependency-runtime/node_modules/fast-xml-parser/src/ignoreAttributes.js"(exports, module) {
    function getIgnoreAttributesFn(ignoreAttributes) {
      if (typeof ignoreAttributes === "function") {
        return ignoreAttributes;
      }
      if (Array.isArray(ignoreAttributes)) {
        return (attrName) => {
          for (const pattern of ignoreAttributes) {
            if (typeof pattern === "string" && attrName === pattern) {
              return true;
            }
            if (pattern instanceof RegExp && pattern.test(attrName)) {
              return true;
            }
          }
        };
      }
      return () => false;
    }
    module.exports = getIgnoreAttributesFn;
  }
});

// source_code/تعديلات على المكتبة/.artifacts/zuwayd-word-followup-20261007/build-dependency-runtime/node_modules/fast-xml-parser/src/xmlparser/OrderedObjParser.js
var require_OrderedObjParser = __commonJS({
  "source_code/\u062A\u0639\u062F\u064A\u0644\u0627\u062A \u0639\u0644\u0649 \u0627\u0644\u0645\u0643\u062A\u0628\u0629/.artifacts/zuwayd-word-followup-20261007/build-dependency-runtime/node_modules/fast-xml-parser/src/xmlparser/OrderedObjParser.js"(exports, module) {
    "use strict";
    var util = require_util();
    var xmlNode = require_xmlNode();
    var DocTypeReader = require_DocTypeReader();
    var toNumber = require_strnum();
    var getIgnoreAttributesFn = require_ignoreAttributes();
    var OrderedObjParser = class {
      constructor(options) {
        this.options = options;
        this.currentNode = null;
        this.tagsNodeStack = [];
        this.docTypeEntities = {};
        this.lastEntities = {
          "apos": { regex: /&(apos|#39|#x27);/g, val: "'" },
          "gt": { regex: /&(gt|#62|#x3E);/g, val: ">" },
          "lt": { regex: /&(lt|#60|#x3C);/g, val: "<" },
          "quot": { regex: /&(quot|#34|#x22);/g, val: '"' }
        };
        this.ampEntity = { regex: /&(amp|#38|#x26);/g, val: "&" };
        this.htmlEntities = {
          "space": { regex: /&(nbsp|#160);/g, val: " " },
          // "lt" : { regex: /&(lt|#60);/g, val: "<" },
          // "gt" : { regex: /&(gt|#62);/g, val: ">" },
          // "amp" : { regex: /&(amp|#38);/g, val: "&" },
          // "quot" : { regex: /&(quot|#34);/g, val: "\"" },
          // "apos" : { regex: /&(apos|#39);/g, val: "'" },
          "cent": { regex: /&(cent|#162);/g, val: "\xA2" },
          "pound": { regex: /&(pound|#163);/g, val: "\xA3" },
          "yen": { regex: /&(yen|#165);/g, val: "\xA5" },
          "euro": { regex: /&(euro|#8364);/g, val: "\u20AC" },
          "copyright": { regex: /&(copy|#169);/g, val: "\xA9" },
          "reg": { regex: /&(reg|#174);/g, val: "\xAE" },
          "inr": { regex: /&(inr|#8377);/g, val: "\u20B9" },
          "num_dec": { regex: /&#([0-9]{1,7});/g, val: (_, str) => fromCodePoint(str, 10, "&#") },
          "num_hex": { regex: /&#x([0-9a-fA-F]{1,6});/g, val: (_, str) => fromCodePoint(str, 16, "&#x") }
        };
        this.addExternalEntities = addExternalEntities;
        this.parseXml = parseXml;
        this.parseTextData = parseTextData;
        this.resolveNameSpace = resolveNameSpace;
        this.buildAttributesMap = buildAttributesMap;
        this.isItStopNode = isItStopNode;
        this.replaceEntitiesValue = replaceEntitiesValue;
        this.readStopNodeData = readStopNodeData;
        this.saveTextToParentTag = saveTextToParentTag;
        this.addChild = addChild;
        this.ignoreAttributesFn = getIgnoreAttributesFn(this.options.ignoreAttributes);
        this.entityExpansionCount = 0;
        this.currentExpandedLength = 0;
        if (this.options.stopNodes && this.options.stopNodes.length > 0) {
          this.stopNodesExact = /* @__PURE__ */ new Set();
          this.stopNodesWildcard = /* @__PURE__ */ new Set();
          for (let i = 0; i < this.options.stopNodes.length; i++) {
            const stopNodeExp = this.options.stopNodes[i];
            if (typeof stopNodeExp !== "string") continue;
            if (stopNodeExp.startsWith("*.")) {
              this.stopNodesWildcard.add(stopNodeExp.substring(2));
            } else {
              this.stopNodesExact.add(stopNodeExp);
            }
          }
        }
      }
    };
    function addExternalEntities(externalEntities) {
      const entKeys = Object.keys(externalEntities);
      for (let i = 0; i < entKeys.length; i++) {
        const ent = entKeys[i];
        const escaped = ent.replace(/[.\-+*:]/g, "\\.");
        this.lastEntities[ent] = {
          regex: new RegExp("&" + escaped + ";", "g"),
          val: externalEntities[ent]
        };
      }
    }
    function parseTextData(val, tagName, jPath, dontTrim, hasAttributes, isLeafNode, escapeEntities) {
      if (val !== void 0) {
        if (this.options.trimValues && !dontTrim) {
          val = val.trim();
        }
        if (val.length > 0) {
          if (!escapeEntities) val = this.replaceEntitiesValue(val, tagName, jPath);
          const newval = this.options.tagValueProcessor(tagName, val, jPath, hasAttributes, isLeafNode);
          if (newval === null || newval === void 0) {
            return val;
          } else if (typeof newval !== typeof val || newval !== val) {
            return newval;
          } else if (this.options.trimValues) {
            return parseValue(val, this.options.parseTagValue, this.options.numberParseOptions);
          } else {
            const trimmedVal = val.trim();
            if (trimmedVal === val) {
              return parseValue(val, this.options.parseTagValue, this.options.numberParseOptions);
            } else {
              return val;
            }
          }
        }
      }
    }
    function resolveNameSpace(tagname) {
      if (this.options.removeNSPrefix) {
        const tags = tagname.split(":");
        const prefix = tagname.charAt(0) === "/" ? "/" : "";
        if (tags[0] === "xmlns") {
          return "";
        }
        if (tags.length === 2) {
          tagname = prefix + tags[1];
        }
      }
      return tagname;
    }
    var attrsRegx = new RegExp(`([^\\s=]+)\\s*(=\\s*(['"])([\\s\\S]*?)\\3)?`, "gm");
    function buildAttributesMap(attrStr, jPath, tagName) {
      if (this.options.ignoreAttributes !== true && typeof attrStr === "string") {
        const matches = util.getAllMatches(attrStr, attrsRegx);
        const len = matches.length;
        const attrs = {};
        for (let i = 0; i < len; i++) {
          const attrName = this.resolveNameSpace(matches[i][1]);
          if (this.ignoreAttributesFn(attrName, jPath)) {
            continue;
          }
          let oldVal = matches[i][4];
          let aName = this.options.attributeNamePrefix + attrName;
          if (attrName.length) {
            if (this.options.transformAttributeName) {
              aName = this.options.transformAttributeName(aName);
            }
            aName = sanitizeName(aName, this.options);
            if (oldVal !== void 0) {
              if (this.options.trimValues) {
                oldVal = oldVal.trim();
              }
              oldVal = this.replaceEntitiesValue(oldVal, tagName, jPath);
              const newVal = this.options.attributeValueProcessor(attrName, oldVal, jPath);
              if (newVal === null || newVal === void 0) {
                attrs[aName] = oldVal;
              } else if (typeof newVal !== typeof oldVal || newVal !== oldVal) {
                attrs[aName] = newVal;
              } else {
                attrs[aName] = parseValue(
                  oldVal,
                  this.options.parseAttributeValue,
                  this.options.numberParseOptions
                );
              }
            } else if (this.options.allowBooleanAttributes) {
              attrs[aName] = true;
            }
          }
        }
        if (!Object.keys(attrs).length) {
          return;
        }
        if (this.options.attributesGroupName) {
          const attrCollection = {};
          attrCollection[this.options.attributesGroupName] = attrs;
          return attrCollection;
        }
        return attrs;
      }
    }
    var parseXml = function(xmlData) {
      xmlData = xmlData.replace(/\r\n?/g, "\n");
      const xmlObj = new xmlNode("!xml");
      let currentNode = xmlObj;
      let textData = "";
      let jPath = "";
      this.entityExpansionCount = 0;
      this.currentExpandedLength = 0;
      const docTypeReader = new DocTypeReader(this.options.processEntities);
      for (let i = 0; i < xmlData.length; i++) {
        const ch = xmlData[i];
        if (ch === "<") {
          if (xmlData[i + 1] === "/") {
            const closeIndex = findClosingIndex(xmlData, ">", i, "Closing Tag is not closed.");
            let tagName = xmlData.substring(i + 2, closeIndex).trim();
            if (this.options.removeNSPrefix) {
              const colonIndex = tagName.indexOf(":");
              if (colonIndex !== -1) {
                tagName = tagName.substr(colonIndex + 1);
              }
            }
            if (this.options.transformTagName) {
              tagName = this.options.transformTagName(tagName);
            }
            if (currentNode) {
              textData = this.saveTextToParentTag(textData, currentNode, jPath);
            }
            const lastTagName = jPath.substring(jPath.lastIndexOf(".") + 1);
            if (tagName && this.options.unpairedTags.indexOf(tagName) !== -1) {
              throw new Error(`Unpaired tag can not be used as closing tag: </${tagName}>`);
            }
            let propIndex = 0;
            if (lastTagName && this.options.unpairedTags.indexOf(lastTagName) !== -1) {
              propIndex = jPath.lastIndexOf(".", jPath.lastIndexOf(".") - 1);
              this.tagsNodeStack.pop();
            } else {
              propIndex = jPath.lastIndexOf(".");
            }
            jPath = jPath.substring(0, propIndex);
            currentNode = this.tagsNodeStack.pop();
            textData = "";
            i = closeIndex;
          } else if (xmlData[i + 1] === "?") {
            let tagData = readTagExp(xmlData, i, false, "?>");
            if (!tagData) throw new Error("Pi Tag is not closed.");
            textData = this.saveTextToParentTag(textData, currentNode, jPath);
            if (this.options.ignoreDeclaration && tagData.tagName === "?xml" || this.options.ignorePiTags) {
            } else {
              const childNode = new xmlNode(tagData.tagName);
              childNode.add(this.options.textNodeName, "");
              if (tagData.tagName !== tagData.tagExp && tagData.attrExpPresent) {
                childNode[":@"] = this.buildAttributesMap(tagData.tagExp, jPath, tagData.tagName);
              }
              this.addChild(currentNode, childNode, jPath, i);
            }
            i = tagData.closeIndex + 1;
          } else if (xmlData.substr(i + 1, 3) === "!--") {
            const endIndex = findClosingIndex(xmlData, "-->", i + 4, "Comment is not closed.");
            if (this.options.commentPropName) {
              const comment = xmlData.substring(i + 4, endIndex - 2);
              textData = this.saveTextToParentTag(textData, currentNode, jPath);
              currentNode.add(this.options.commentPropName, [{ [this.options.textNodeName]: comment }]);
            }
            i = endIndex;
          } else if (xmlData.substr(i + 1, 2) === "!D") {
            const result = docTypeReader.readDocType(xmlData, i);
            this.docTypeEntities = result.entities;
            i = result.i;
          } else if (xmlData.substr(i + 1, 2) === "![") {
            const closeIndex = findClosingIndex(xmlData, "]]>", i, "CDATA is not closed.") - 2;
            const tagExp = xmlData.substring(i + 9, closeIndex);
            textData = this.saveTextToParentTag(textData, currentNode, jPath);
            let val = this.parseTextData(tagExp, currentNode.tagname, jPath, true, false, true, true);
            if (val == void 0) val = "";
            if (this.options.cdataPropName) {
              currentNode.add(this.options.cdataPropName, [{ [this.options.textNodeName]: tagExp }]);
            } else {
              currentNode.add(this.options.textNodeName, val);
            }
            i = closeIndex + 2;
          } else {
            let result = readTagExp(xmlData, i, this.options.removeNSPrefix);
            let tagName = result.tagName;
            const rawTagName = result.rawTagName;
            let tagExp = result.tagExp;
            let attrExpPresent = result.attrExpPresent;
            let closeIndex = result.closeIndex;
            if (this.options.transformTagName) {
              const newTagName = this.options.transformTagName(tagName);
              if (tagExp === tagName) {
                tagExp = newTagName;
              }
              tagName = newTagName;
            }
            if (this.options.strictReservedNames && (tagName === this.options.commentPropName || tagName === this.options.cdataPropName || tagName === this.options.textNodeName || tagName === this.options.attributesGroupName)) {
              throw new Error(`Invalid tag name: ${tagName}`);
            }
            if (currentNode && textData) {
              if (currentNode.tagname !== "!xml") {
                textData = this.saveTextToParentTag(textData, currentNode, jPath, false);
              }
            }
            const lastTag = currentNode;
            if (lastTag && this.options.unpairedTags.indexOf(lastTag.tagname) !== -1) {
              currentNode = this.tagsNodeStack.pop();
              jPath = jPath.substring(0, jPath.lastIndexOf("."));
            }
            if (tagName !== xmlObj.tagname) {
              jPath += jPath ? "." + tagName : tagName;
            }
            const startIndex = i;
            if (this.isItStopNode(this.stopNodesExact, this.stopNodesWildcard, jPath, tagName)) {
              let tagContent = "";
              if (tagExp.length > 0 && tagExp.lastIndexOf("/") === tagExp.length - 1) {
                if (tagName[tagName.length - 1] === "/") {
                  tagName = tagName.substr(0, tagName.length - 1);
                  jPath = jPath.substr(0, jPath.length - 1);
                  tagExp = tagName;
                } else {
                  tagExp = tagExp.substr(0, tagExp.length - 1);
                }
                i = result.closeIndex;
              } else if (this.options.unpairedTags.indexOf(tagName) !== -1) {
                i = result.closeIndex;
              } else {
                const result2 = this.readStopNodeData(xmlData, rawTagName, closeIndex + 1);
                if (!result2) throw new Error(`Unexpected end of ${rawTagName}`);
                i = result2.i;
                tagContent = result2.tagContent;
              }
              const childNode = new xmlNode(tagName);
              if (tagName !== tagExp && attrExpPresent) {
                childNode[":@"] = this.buildAttributesMap(tagExp, jPath, tagName);
              }
              if (tagContent) {
                tagContent = this.parseTextData(tagContent, tagName, jPath, true, attrExpPresent, true, true);
              }
              jPath = jPath.substr(0, jPath.lastIndexOf("."));
              childNode.add(this.options.textNodeName, tagContent);
              this.addChild(currentNode, childNode, jPath, startIndex);
            } else {
              if (tagExp.length > 0 && tagExp.lastIndexOf("/") === tagExp.length - 1) {
                if (tagName[tagName.length - 1] === "/") {
                  tagName = tagName.substr(0, tagName.length - 1);
                  jPath = jPath.substr(0, jPath.length - 1);
                  tagExp = tagName;
                } else {
                  tagExp = tagExp.substr(0, tagExp.length - 1);
                }
                if (this.options.transformTagName) {
                  const newTagName = this.options.transformTagName(tagName);
                  if (tagExp === tagName) {
                    tagExp = newTagName;
                  }
                  tagName = newTagName;
                }
                const childNode = new xmlNode(tagName);
                if (tagName !== tagExp && attrExpPresent) {
                  childNode[":@"] = this.buildAttributesMap(tagExp, jPath, tagName);
                }
                this.addChild(currentNode, childNode, jPath, startIndex);
                jPath = jPath.substr(0, jPath.lastIndexOf("."));
              } else if (this.options.unpairedTags.indexOf(tagName) !== -1) {
                const childNode = new xmlNode(tagName);
                if (tagName !== tagExp && attrExpPresent) {
                  childNode[":@"] = this.buildAttributesMap(tagExp, jPath);
                }
                this.addChild(currentNode, childNode, jPath, startIndex);
                jPath = jPath.substr(0, jPath.lastIndexOf("."));
                i = result.closeIndex;
                continue;
              } else {
                const childNode = new xmlNode(tagName);
                if (this.tagsNodeStack.length > this.options.maxNestedTags) {
                  throw new Error("Maximum nested tags exceeded");
                }
                this.tagsNodeStack.push(currentNode);
                if (tagName !== tagExp && attrExpPresent) {
                  childNode[":@"] = this.buildAttributesMap(tagExp, jPath, tagName);
                }
                this.addChild(currentNode, childNode, jPath);
                currentNode = childNode;
              }
              textData = "";
              i = closeIndex;
            }
          }
        } else {
          textData += xmlData[i];
        }
      }
      return xmlObj.child;
    };
    function addChild(currentNode, childNode, jPath, startIndex) {
      if (!this.options.captureMetaData) startIndex = void 0;
      const result = this.options.updateTag(childNode.tagname, jPath, childNode[":@"]);
      if (result === false) {
      } else if (typeof result === "string") {
        childNode.tagname = result;
        currentNode.addChild(childNode, startIndex);
      } else {
        currentNode.addChild(childNode, startIndex);
      }
    }
    var replaceEntitiesValue = function(val, tagName, jPath) {
      if (val.indexOf("&") === -1) {
        return val;
      }
      const entityConfig = this.options.processEntities;
      if (!entityConfig.enabled) {
        return val;
      }
      if (entityConfig.allowedTags) {
        if (!entityConfig.allowedTags.includes(tagName)) {
          return val;
        }
      }
      if (entityConfig.tagFilter) {
        if (!entityConfig.tagFilter(tagName, jPath)) {
          return val;
        }
      }
      for (let entityName in this.docTypeEntities) {
        const entity = this.docTypeEntities[entityName];
        const matches = val.match(entity.regx);
        if (matches) {
          this.entityExpansionCount += matches.length;
          if (entityConfig.maxTotalExpansions && this.entityExpansionCount > entityConfig.maxTotalExpansions) {
            throw new Error(
              `Entity expansion limit exceeded: ${this.entityExpansionCount} > ${entityConfig.maxTotalExpansions}`
            );
          }
          const lengthBefore = val.length;
          val = val.replace(entity.regx, entity.val);
          if (entityConfig.maxExpandedLength) {
            this.currentExpandedLength += val.length - lengthBefore;
            if (this.currentExpandedLength > entityConfig.maxExpandedLength) {
              throw new Error(
                `Total expanded content size exceeded: ${this.currentExpandedLength} > ${entityConfig.maxExpandedLength}`
              );
            }
          }
        }
      }
      if (val.indexOf("&") === -1) return val;
      for (const entityName of Object.keys(this.lastEntities)) {
        const entity = this.lastEntities[entityName];
        const matches = val.match(entity.regex);
        if (matches) {
          this.entityExpansionCount += matches.length;
          if (entityConfig.maxTotalExpansions && this.entityExpansionCount > entityConfig.maxTotalExpansions) {
            throw new Error(
              `Entity expansion limit exceeded: ${this.entityExpansionCount} > ${entityConfig.maxTotalExpansions}`
            );
          }
        }
        val = val.replace(entity.regex, entity.val);
      }
      if (val.indexOf("&") === -1) return val;
      if (this.options.htmlEntities) {
        for (const entityName of Object.keys(this.htmlEntities)) {
          const entity = this.htmlEntities[entityName];
          const matches = val.match(entity.regex);
          if (matches) {
            this.entityExpansionCount += matches.length;
            if (entityConfig.maxTotalExpansions && this.entityExpansionCount > entityConfig.maxTotalExpansions) {
              throw new Error(
                `Entity expansion limit exceeded: ${this.entityExpansionCount} > ${entityConfig.maxTotalExpansions}`
              );
            }
          }
          val = val.replace(entity.regex, entity.val);
        }
      }
      val = val.replace(this.ampEntity.regex, this.ampEntity.val);
      return val;
    };
    function saveTextToParentTag(textData, parentNode, jPath, isLeafNode) {
      if (textData) {
        if (isLeafNode === void 0) isLeafNode = parentNode.child.length === 0;
        textData = this.parseTextData(
          textData,
          parentNode.tagname,
          jPath,
          false,
          parentNode[":@"] ? Object.keys(parentNode[":@"]).length !== 0 : false,
          isLeafNode
        );
        if (textData !== void 0 && textData !== "")
          parentNode.add(this.options.textNodeName, textData);
        textData = "";
      }
      return textData;
    }
    function isItStopNode(stopNodesExact, stopNodesWildcard, jPath, currentTagName) {
      if (stopNodesWildcard && stopNodesWildcard.has(currentTagName)) return true;
      if (stopNodesExact && stopNodesExact.has(jPath)) return true;
      return false;
    }
    function tagExpWithClosingIndex(xmlData, i, closingChar = ">") {
      let attrBoundary;
      let tagExp = "";
      for (let index = i; index < xmlData.length; index++) {
        let ch = xmlData[index];
        if (attrBoundary) {
          if (ch === attrBoundary) attrBoundary = "";
        } else if (ch === '"' || ch === "'") {
          attrBoundary = ch;
        } else if (ch === closingChar[0]) {
          if (closingChar[1]) {
            if (xmlData[index + 1] === closingChar[1]) {
              return {
                data: tagExp,
                index
              };
            }
          } else {
            return {
              data: tagExp,
              index
            };
          }
        } else if (ch === "	") {
          ch = " ";
        }
        tagExp += ch;
      }
    }
    function findClosingIndex(xmlData, str, i, errMsg) {
      const closingIndex = xmlData.indexOf(str, i);
      if (closingIndex === -1) {
        throw new Error(errMsg);
      } else {
        return closingIndex + str.length - 1;
      }
    }
    function readTagExp(xmlData, i, removeNSPrefix, closingChar = ">") {
      const result = tagExpWithClosingIndex(xmlData, i + 1, closingChar);
      if (!result) return;
      let tagExp = result.data;
      const closeIndex = result.index;
      const separatorIndex = tagExp.search(/\s/);
      let tagName = tagExp;
      let attrExpPresent = true;
      if (separatorIndex !== -1) {
        tagName = tagExp.substring(0, separatorIndex);
        tagExp = tagExp.substring(separatorIndex + 1).trimStart();
      }
      const rawTagName = tagName;
      if (removeNSPrefix) {
        const colonIndex = tagName.indexOf(":");
        if (colonIndex !== -1) {
          tagName = tagName.substr(colonIndex + 1);
          attrExpPresent = tagName !== result.data.substr(colonIndex + 1);
        }
      }
      return {
        tagName,
        tagExp,
        closeIndex,
        attrExpPresent,
        rawTagName
      };
    }
    function readStopNodeData(xmlData, tagName, i) {
      const startIndex = i;
      let openTagCount = 1;
      for (; i < xmlData.length; i++) {
        if (xmlData[i] === "<") {
          if (xmlData[i + 1] === "/") {
            const closeIndex = findClosingIndex(xmlData, ">", i, `${tagName} is not closed`);
            let closeTagName = xmlData.substring(i + 2, closeIndex).trim();
            if (closeTagName === tagName) {
              openTagCount--;
              if (openTagCount === 0) {
                return {
                  tagContent: xmlData.substring(startIndex, i),
                  i: closeIndex
                };
              }
            }
            i = closeIndex;
          } else if (xmlData[i + 1] === "?") {
            const closeIndex = findClosingIndex(xmlData, "?>", i + 1, "StopNode is not closed.");
            i = closeIndex;
          } else if (xmlData.substr(i + 1, 3) === "!--") {
            const closeIndex = findClosingIndex(xmlData, "-->", i + 3, "StopNode is not closed.");
            i = closeIndex;
          } else if (xmlData.substr(i + 1, 2) === "![") {
            const closeIndex = findClosingIndex(xmlData, "]]>", i, "StopNode is not closed.") - 2;
            i = closeIndex;
          } else {
            const tagData = readTagExp(xmlData, i, ">");
            if (tagData) {
              const openTagName = tagData && tagData.tagName;
              if (openTagName === tagName && tagData.tagExp[tagData.tagExp.length - 1] !== "/") {
                openTagCount++;
              }
              i = tagData.closeIndex;
            }
          }
        }
      }
    }
    function parseValue(val, shouldParse, options) {
      if (shouldParse && typeof val === "string") {
        const newval = val.trim();
        if (newval === "true") return true;
        else if (newval === "false") return false;
        else return toNumber(val, options);
      } else {
        if (util.isExist(val)) {
          return val;
        } else {
          return "";
        }
      }
    }
    function fromCodePoint(str, base, prefix) {
      const codePoint = Number.parseInt(str, base);
      if (codePoint >= 0 && codePoint <= 1114111) {
        return String.fromCodePoint(codePoint);
      } else {
        return prefix + str + ";";
      }
    }
    function sanitizeName(name, options) {
      if (util.criticalProperties.includes(name)) {
        throw new Error(`[SECURITY] Invalid name: "${name}" is a reserved JavaScript keyword that could cause prototype pollution`);
      } else if (util.DANGEROUS_PROPERTY_NAMES.includes(name)) {
        return options.onDangerousProperty(name);
      }
      return name;
    }
    module.exports = OrderedObjParser;
  }
});

// source_code/تعديلات على المكتبة/.artifacts/zuwayd-word-followup-20261007/build-dependency-runtime/node_modules/fast-xml-parser/src/xmlparser/node2json.js
var require_node2json = __commonJS({
  "source_code/\u062A\u0639\u062F\u064A\u0644\u0627\u062A \u0639\u0644\u0649 \u0627\u0644\u0645\u0643\u062A\u0628\u0629/.artifacts/zuwayd-word-followup-20261007/build-dependency-runtime/node_modules/fast-xml-parser/src/xmlparser/node2json.js"(exports) {
    "use strict";
    function prettify(node, options) {
      return compress(node, options);
    }
    function compress(arr, options, jPath) {
      let text;
      const compressedObj = {};
      for (let i = 0; i < arr.length; i++) {
        const tagObj = arr[i];
        const property = propName(tagObj);
        let newJpath = "";
        if (jPath === void 0) newJpath = property;
        else newJpath = jPath + "." + property;
        if (property === options.textNodeName) {
          if (text === void 0) text = tagObj[property];
          else text += "" + tagObj[property];
        } else if (property === void 0) {
          continue;
        } else if (tagObj[property]) {
          let val = compress(tagObj[property], options, newJpath);
          const isLeaf = isLeafTag(val, options);
          if (tagObj[":@"]) {
            assignAttributes(val, tagObj[":@"], newJpath, options);
          } else if (Object.keys(val).length === 1 && val[options.textNodeName] !== void 0 && !options.alwaysCreateTextNode) {
            val = val[options.textNodeName];
          } else if (Object.keys(val).length === 0) {
            if (options.alwaysCreateTextNode) val[options.textNodeName] = "";
            else val = "";
          }
          if (compressedObj[property] !== void 0 && compressedObj.hasOwnProperty(property)) {
            if (!Array.isArray(compressedObj[property])) {
              compressedObj[property] = [compressedObj[property]];
            }
            compressedObj[property].push(val);
          } else {
            if (options.isArray(property, newJpath, isLeaf)) {
              compressedObj[property] = [val];
            } else {
              compressedObj[property] = val;
            }
          }
        }
      }
      if (typeof text === "string") {
        if (text.length > 0) compressedObj[options.textNodeName] = text;
      } else if (text !== void 0) compressedObj[options.textNodeName] = text;
      return compressedObj;
    }
    function propName(obj) {
      const keys = Object.keys(obj);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (key !== ":@") return key;
      }
    }
    function assignAttributes(obj, attrMap, jpath, options) {
      if (attrMap) {
        const keys = Object.keys(attrMap);
        const len = keys.length;
        for (let i = 0; i < len; i++) {
          const atrrName = keys[i];
          if (options.isArray(atrrName, jpath + "." + atrrName, true, true)) {
            obj[atrrName] = [attrMap[atrrName]];
          } else {
            obj[atrrName] = attrMap[atrrName];
          }
        }
      }
    }
    function isLeafTag(obj, options) {
      const { textNodeName } = options;
      const propCount = Object.keys(obj).length;
      if (propCount === 0) {
        return true;
      }
      if (propCount === 1 && (obj[textNodeName] || typeof obj[textNodeName] === "boolean" || obj[textNodeName] === 0)) {
        return true;
      }
      return false;
    }
    exports.prettify = prettify;
  }
});

// source_code/تعديلات على المكتبة/.artifacts/zuwayd-word-followup-20261007/build-dependency-runtime/node_modules/fast-xml-parser/src/xmlparser/XMLParser.js
var require_XMLParser = __commonJS({
  "source_code/\u062A\u0639\u062F\u064A\u0644\u0627\u062A \u0639\u0644\u0649 \u0627\u0644\u0645\u0643\u062A\u0628\u0629/.artifacts/zuwayd-word-followup-20261007/build-dependency-runtime/node_modules/fast-xml-parser/src/xmlparser/XMLParser.js"(exports, module) {
    var { buildOptions } = require_OptionsBuilder();
    var OrderedObjParser = require_OrderedObjParser();
    var { prettify } = require_node2json();
    var validator = require_validator();
    var XMLParser2 = class {
      constructor(options) {
        this.externalEntities = {};
        this.options = buildOptions(options);
      }
      /**
       * Parse XML dats to JS object 
       * @param {string|Buffer} xmlData 
       * @param {boolean|Object} validationOption 
       */
      parse(xmlData, validationOption) {
        if (typeof xmlData === "string") {
        } else if (xmlData.toString) {
          xmlData = xmlData.toString();
        } else {
          throw new Error("XML data is accepted in String or Bytes[] form.");
        }
        if (validationOption) {
          if (validationOption === true) validationOption = {};
          const result = validator.validate(xmlData, validationOption);
          if (result !== true) {
            throw Error(`${result.err.msg}:${result.err.line}:${result.err.col}`);
          }
        }
        const orderedObjParser = new OrderedObjParser(this.options);
        orderedObjParser.addExternalEntities(this.externalEntities);
        const orderedResult = orderedObjParser.parseXml(xmlData);
        if (this.options.preserveOrder || orderedResult === void 0) return orderedResult;
        else return prettify(orderedResult, this.options);
      }
      /**
       * Add Entity which is not by default supported by this library
       * @param {string} key 
       * @param {string} value 
       */
      addEntity(key, value) {
        if (value.indexOf("&") !== -1) {
          throw new Error("Entity value can't have '&'");
        } else if (key.indexOf("&") !== -1 || key.indexOf(";") !== -1) {
          throw new Error("An entity must be set without '&' and ';'. Eg. use '#xD' for '&#xD;'");
        } else if (value === "&") {
          throw new Error("An entity with value '&' is not permitted");
        } else {
          this.externalEntities[key] = value;
        }
      }
    };
    module.exports = XMLParser2;
  }
});

// source_code/تعديلات على المكتبة/.artifacts/zuwayd-word-followup-20261007/build-dependency-runtime/node_modules/fast-xml-parser/src/xmlbuilder/orderedJs2Xml.js
var require_orderedJs2Xml = __commonJS({
  "source_code/\u062A\u0639\u062F\u064A\u0644\u0627\u062A \u0639\u0644\u0649 \u0627\u0644\u0645\u0643\u062A\u0628\u0629/.artifacts/zuwayd-word-followup-20261007/build-dependency-runtime/node_modules/fast-xml-parser/src/xmlbuilder/orderedJs2Xml.js"(exports, module) {
    var EOL = "\n";
    function toXml(jArray, options) {
      let indentation = "";
      if (options.format && options.indentBy.length > 0) {
        indentation = EOL;
      }
      return arrToStr(jArray, options, "", indentation);
    }
    function arrToStr(arr, options, jPath, indentation) {
      let xmlStr = "";
      let isPreviousElementTag = false;
      if (!Array.isArray(arr)) {
        if (arr !== void 0 && arr !== null) {
          let text = arr.toString();
          text = replaceEntitiesValue(text, options);
          return text;
        }
        return "";
      }
      for (let i = 0; i < arr.length; i++) {
        const tagObj = arr[i];
        const tagName = propName(tagObj);
        if (tagName === void 0) continue;
        let newJPath = "";
        if (jPath.length === 0) newJPath = tagName;
        else newJPath = `${jPath}.${tagName}`;
        if (tagName === options.textNodeName) {
          let tagText = tagObj[tagName];
          if (!isStopNode(newJPath, options)) {
            tagText = options.tagValueProcessor(tagName, tagText);
            tagText = replaceEntitiesValue(tagText, options);
          }
          if (isPreviousElementTag) {
            xmlStr += indentation;
          }
          xmlStr += tagText;
          isPreviousElementTag = false;
          continue;
        } else if (tagName === options.cdataPropName) {
          if (isPreviousElementTag) {
            xmlStr += indentation;
          }
          const cdataVal = String(tagObj[tagName][0][options.textNodeName]).replace(/\]\]>/g, "]]]]><![CDATA[>");
          xmlStr += `<![CDATA[${cdataVal}]]>`;
          isPreviousElementTag = false;
          continue;
        } else if (tagName === options.commentPropName) {
          const commentVal = String(tagObj[tagName][0][options.textNodeName]).replace(/--/g, "- -").replace(/-$/, "- ");
          xmlStr += indentation + `<!--${commentVal}-->`;
          isPreviousElementTag = true;
          continue;
        } else if (tagName[0] === "?") {
          const attStr2 = attr_to_str(tagObj[":@"], options);
          const tempInd = tagName === "?xml" ? "" : indentation;
          let piTextNodeName = tagObj[tagName][0][options.textNodeName];
          piTextNodeName = piTextNodeName.length !== 0 ? " " + piTextNodeName : "";
          xmlStr += tempInd + `<${tagName}${piTextNodeName}${attStr2}?>`;
          isPreviousElementTag = true;
          continue;
        }
        let newIdentation = indentation;
        if (newIdentation !== "") {
          newIdentation += options.indentBy;
        }
        const attStr = attr_to_str(tagObj[":@"], options);
        const tagStart = indentation + `<${tagName}${attStr}`;
        const tagValue = arrToStr(tagObj[tagName], options, newJPath, newIdentation);
        if (options.unpairedTags.indexOf(tagName) !== -1) {
          if (options.suppressUnpairedNode) xmlStr += tagStart + ">";
          else xmlStr += tagStart + "/>";
        } else if ((!tagValue || tagValue.length === 0) && options.suppressEmptyNode) {
          xmlStr += tagStart + "/>";
        } else if (tagValue && tagValue.endsWith(">")) {
          xmlStr += tagStart + `>${tagValue}${indentation}</${tagName}>`;
        } else {
          xmlStr += tagStart + ">";
          if (tagValue && indentation !== "" && (tagValue.includes("/>") || tagValue.includes("</"))) {
            xmlStr += indentation + options.indentBy + tagValue + indentation;
          } else {
            xmlStr += tagValue;
          }
          xmlStr += `</${tagName}>`;
        }
        isPreviousElementTag = true;
      }
      return xmlStr;
    }
    function propName(obj) {
      const keys = Object.keys(obj);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
        if (key !== ":@") return key;
      }
    }
    function attr_to_str(attrMap, options) {
      let attrStr = "";
      if (attrMap && !options.ignoreAttributes) {
        for (let attr in attrMap) {
          if (!Object.prototype.hasOwnProperty.call(attrMap, attr)) continue;
          let attrVal = options.attributeValueProcessor(attr, attrMap[attr]);
          attrVal = replaceEntitiesValue(attrVal, options);
          if (attrVal === true && options.suppressBooleanAttributes) {
            attrStr += ` ${attr.substr(options.attributeNamePrefix.length)}`;
          } else {
            attrStr += ` ${attr.substr(options.attributeNamePrefix.length)}="${attrVal}"`;
          }
        }
      }
      return attrStr;
    }
    function isStopNode(jPath, options) {
      jPath = jPath.substr(0, jPath.length - options.textNodeName.length - 1);
      let tagName = jPath.substr(jPath.lastIndexOf(".") + 1);
      for (let index in options.stopNodes) {
        if (options.stopNodes[index] === jPath || options.stopNodes[index] === "*." + tagName) return true;
      }
      return false;
    }
    function replaceEntitiesValue(textValue, options) {
      if (textValue && textValue.length > 0 && options.processEntities) {
        for (let i = 0; i < options.entities.length; i++) {
          const entity = options.entities[i];
          textValue = textValue.replace(entity.regex, entity.val);
        }
      }
      return textValue;
    }
    module.exports = toXml;
  }
});

// source_code/تعديلات على المكتبة/.artifacts/zuwayd-word-followup-20261007/build-dependency-runtime/node_modules/fast-xml-parser/src/xmlbuilder/json2xml.js
var require_json2xml = __commonJS({
  "source_code/\u062A\u0639\u062F\u064A\u0644\u0627\u062A \u0639\u0644\u0649 \u0627\u0644\u0645\u0643\u062A\u0628\u0629/.artifacts/zuwayd-word-followup-20261007/build-dependency-runtime/node_modules/fast-xml-parser/src/xmlbuilder/json2xml.js"(exports, module) {
    "use strict";
    var buildFromOrderedJs = require_orderedJs2Xml();
    var getIgnoreAttributesFn = require_ignoreAttributes();
    var defaultOptions = {
      attributeNamePrefix: "@_",
      attributesGroupName: false,
      textNodeName: "#text",
      ignoreAttributes: true,
      cdataPropName: false,
      format: false,
      indentBy: "  ",
      suppressEmptyNode: false,
      suppressUnpairedNode: true,
      suppressBooleanAttributes: true,
      tagValueProcessor: function(key, a) {
        return a;
      },
      attributeValueProcessor: function(attrName, a) {
        return a;
      },
      preserveOrder: false,
      commentPropName: false,
      unpairedTags: [],
      entities: [
        { regex: new RegExp("&", "g"), val: "&amp;" },
        //it must be on top
        { regex: new RegExp(">", "g"), val: "&gt;" },
        { regex: new RegExp("<", "g"), val: "&lt;" },
        { regex: new RegExp("'", "g"), val: "&apos;" },
        { regex: new RegExp('"', "g"), val: "&quot;" }
      ],
      processEntities: true,
      stopNodes: [],
      // transformTagName: false,
      // transformAttributeName: false,
      oneListGroup: false
    };
    function Builder(options) {
      this.options = Object.assign({}, defaultOptions, options);
      if (this.options.ignoreAttributes === true || this.options.attributesGroupName) {
        this.isAttribute = function() {
          return false;
        };
      } else {
        this.ignoreAttributesFn = getIgnoreAttributesFn(this.options.ignoreAttributes);
        this.attrPrefixLen = this.options.attributeNamePrefix.length;
        this.isAttribute = isAttribute;
      }
      this.processTextOrObjNode = processTextOrObjNode;
      if (this.options.format) {
        this.indentate = indentate;
        this.tagEndChar = ">\n";
        this.newLine = "\n";
      } else {
        this.indentate = function() {
          return "";
        };
        this.tagEndChar = ">";
        this.newLine = "";
      }
    }
    Builder.prototype.build = function(jObj) {
      if (this.options.preserveOrder) {
        return buildFromOrderedJs(jObj, this.options);
      } else {
        if (Array.isArray(jObj) && this.options.arrayNodeName && this.options.arrayNodeName.length > 1) {
          jObj = {
            [this.options.arrayNodeName]: jObj
          };
        }
        return this.j2x(jObj, 0, []).val;
      }
    };
    Builder.prototype.j2x = function(jObj, level, ajPath) {
      let attrStr = "";
      let val = "";
      const jPath = ajPath.join(".");
      for (let key in jObj) {
        if (!Object.prototype.hasOwnProperty.call(jObj, key)) continue;
        if (typeof jObj[key] === "undefined") {
          if (this.isAttribute(key)) {
            val += "";
          }
        } else if (jObj[key] === null) {
          if (this.isAttribute(key)) {
            val += "";
          } else if (key === this.options.cdataPropName) {
            val += "";
          } else if (key[0] === "?") {
            val += this.indentate(level) + "<" + key + "?" + this.tagEndChar;
          } else {
            val += this.indentate(level) + "<" + key + "/" + this.tagEndChar;
          }
        } else if (jObj[key] instanceof Date) {
          val += this.buildTextValNode(jObj[key], key, "", level);
        } else if (typeof jObj[key] !== "object") {
          const attr = this.isAttribute(key);
          if (attr && !this.ignoreAttributesFn(attr, jPath)) {
            attrStr += this.buildAttrPairStr(attr, "" + jObj[key]);
          } else if (!attr) {
            if (key === this.options.textNodeName) {
              let newval = this.options.tagValueProcessor(key, "" + jObj[key]);
              val += this.replaceEntitiesValue(newval);
            } else {
              val += this.buildTextValNode(jObj[key], key, "", level);
            }
          }
        } else if (Array.isArray(jObj[key])) {
          const arrLen = jObj[key].length;
          let listTagVal = "";
          let listTagAttr = "";
          for (let j = 0; j < arrLen; j++) {
            const item = jObj[key][j];
            if (typeof item === "undefined") {
            } else if (item === null) {
              if (key[0] === "?") val += this.indentate(level) + "<" + key + "?" + this.tagEndChar;
              else val += this.indentate(level) + "<" + key + "/" + this.tagEndChar;
            } else if (typeof item === "object") {
              if (this.options.oneListGroup) {
                const result = this.j2x(item, level + 1, ajPath.concat(key));
                listTagVal += result.val;
                if (this.options.attributesGroupName && item.hasOwnProperty(this.options.attributesGroupName)) {
                  listTagAttr += result.attrStr;
                }
              } else {
                listTagVal += this.processTextOrObjNode(item, key, level, ajPath);
              }
            } else {
              if (this.options.oneListGroup) {
                let textValue = this.options.tagValueProcessor(key, item);
                textValue = this.replaceEntitiesValue(textValue);
                listTagVal += textValue;
              } else {
                listTagVal += this.buildTextValNode(item, key, "", level);
              }
            }
          }
          if (this.options.oneListGroup) {
            listTagVal = this.buildObjectNode(listTagVal, key, listTagAttr, level);
          }
          val += listTagVal;
        } else {
          if (this.options.attributesGroupName && key === this.options.attributesGroupName) {
            const Ks = Object.keys(jObj[key]);
            const L = Ks.length;
            for (let j = 0; j < L; j++) {
              attrStr += this.buildAttrPairStr(Ks[j], "" + jObj[key][Ks[j]]);
            }
          } else {
            val += this.processTextOrObjNode(jObj[key], key, level, ajPath);
          }
        }
      }
      return { attrStr, val };
    };
    Builder.prototype.buildAttrPairStr = function(attrName, val) {
      val = this.options.attributeValueProcessor(attrName, "" + val);
      val = this.replaceEntitiesValue(val);
      if (this.options.suppressBooleanAttributes && val === "true") {
        return " " + attrName;
      } else return " " + attrName + '="' + val + '"';
    };
    function processTextOrObjNode(object, key, level, ajPath) {
      const result = this.j2x(object, level + 1, ajPath.concat(key));
      if (object[this.options.textNodeName] !== void 0 && Object.keys(object).length === 1) {
        return this.buildTextValNode(object[this.options.textNodeName], key, result.attrStr, level);
      } else {
        return this.buildObjectNode(result.val, key, result.attrStr, level);
      }
    }
    Builder.prototype.buildObjectNode = function(val, key, attrStr, level) {
      if (val === "") {
        if (key[0] === "?") return this.indentate(level) + "<" + key + attrStr + "?" + this.tagEndChar;
        else {
          return this.indentate(level) + "<" + key + attrStr + this.closeTag(key) + this.tagEndChar;
        }
      } else {
        let tagEndExp = "</" + key + this.tagEndChar;
        let piClosingChar = "";
        if (key[0] === "?") {
          piClosingChar = "?";
          tagEndExp = "";
        }
        if ((attrStr || attrStr === "") && val.indexOf("<") === -1) {
          return this.indentate(level) + "<" + key + attrStr + piClosingChar + ">" + val + tagEndExp;
        } else if (this.options.commentPropName !== false && key === this.options.commentPropName && piClosingChar.length === 0) {
          const safeVal = String(val).replace(/--/g, "- -").replace(/-$/, "- ");
          return this.indentate(level) + `<!--${safeVal}-->` + this.newLine;
        } else {
          return this.indentate(level) + "<" + key + attrStr + piClosingChar + this.tagEndChar + val + this.indentate(level) + tagEndExp;
        }
      }
    };
    Builder.prototype.closeTag = function(key) {
      let closeTag = "";
      if (this.options.unpairedTags.indexOf(key) !== -1) {
        if (!this.options.suppressUnpairedNode) closeTag = "/";
      } else if (this.options.suppressEmptyNode) {
        closeTag = "/";
      } else {
        closeTag = `></${key}`;
      }
      return closeTag;
    };
    Builder.prototype.buildTextValNode = function(val, key, attrStr, level) {
      if (this.options.cdataPropName !== false && key === this.options.cdataPropName) {
        const safeVal = String(val).replace(/\]\]>/g, "]]]]><![CDATA[>");
        return this.indentate(level) + `<![CDATA[${safeVal}]]>` + this.newLine;
      } else if (this.options.commentPropName !== false && key === this.options.commentPropName) {
        const safeVal = String(val).replace(/--/g, "- -").replace(/-$/, "- ");
        return this.indentate(level) + `<!--${safeVal}-->` + this.newLine;
      } else if (key[0] === "?") {
        return this.indentate(level) + "<" + key + attrStr + "?" + this.tagEndChar;
      } else {
        let textValue = this.options.tagValueProcessor(key, val);
        textValue = this.replaceEntitiesValue(textValue);
        if (textValue === "") {
          return this.indentate(level) + "<" + key + attrStr + this.closeTag(key) + this.tagEndChar;
        } else {
          return this.indentate(level) + "<" + key + attrStr + ">" + textValue + "</" + key + this.tagEndChar;
        }
      }
    };
    Builder.prototype.replaceEntitiesValue = function(textValue) {
      if (textValue && textValue.length > 0 && this.options.processEntities) {
        for (let i = 0; i < this.options.entities.length; i++) {
          const entity = this.options.entities[i];
          textValue = textValue.replace(entity.regex, entity.val);
        }
      }
      return textValue;
    };
    function indentate(level) {
      return this.options.indentBy.repeat(level);
    }
    function isAttribute(name) {
      if (name.startsWith(this.options.attributeNamePrefix) && name !== this.options.textNodeName) {
        return name.substr(this.attrPrefixLen);
      } else {
        return false;
      }
    }
    module.exports = Builder;
  }
});

// source_code/تعديلات على المكتبة/.artifacts/zuwayd-word-followup-20261007/build-dependency-runtime/node_modules/fast-xml-parser/src/fxp.js
var require_fxp = __commonJS({
  "source_code/\u062A\u0639\u062F\u064A\u0644\u0627\u062A \u0639\u0644\u0649 \u0627\u0644\u0645\u0643\u062A\u0628\u0629/.artifacts/zuwayd-word-followup-20261007/build-dependency-runtime/node_modules/fast-xml-parser/src/fxp.js"(exports, module) {
    "use strict";
    var validator = require_validator();
    var XMLParser2 = require_XMLParser();
    var XMLBuilder2 = require_json2xml();
    module.exports = {
      XMLParser: XMLParser2,
      XMLValidator: validator,
      XMLBuilder: XMLBuilder2
    };
  }
});

// outputs/active/2026-11-17-mushaf-preview/integrated-private-previews/shamela-inline-headings-review/windows/source/packages/ooxml-model/src/index_package.ts
var import_fflate = __toESM(require_node(), 1);

// outputs/active/2026-11-17-mushaf-preview/integrated-private-previews/shamela-inline-headings-review/windows/source/packages/ooxml-model/src/index_embedded_fonts.ts
function deobfuscateEmbeddedFont(data, fontKey) {
  const hex = fontKey.replace(/[^0-9A-Fa-f]/g, "");
  if (hex.length !== 32 || data.length < 32) return data;
  const key = Uint8Array.from(hex.match(/../g).map((part) => Number.parseInt(part, 16))).reverse();
  const out = data.slice();
  for (let i = 0; i < 32; i++) out[i] = out[i] ^ key[i % 16];
  return out;
}

// outputs/active/2026-11-17-mushaf-preview/integrated-private-previews/shamela-inline-headings-review/windows/source/packages/ooxml-model/src/index_package.ts
function openDocx(bytes) {
  const files = (0, import_fflate.unzipSync)(bytes);
  const dec = new TextDecoder("utf-8");
  const doc = files["word/document.xml"];
  if (!doc) throw new Error("word/document.xml \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
  const get = (n) => files[n] ? dec.decode(files[n]) : null;
  const headerFooterParts = /* @__PURE__ */ new Map();
  for (const name of Object.keys(files)) {
    const b = name.match(/^word\/((?:header|footer)\d+\.xml)$/);
    if (b && b[1]) headerFooterParts.set(b[1], dec.decode(files[name]));
  }
  const partRels = /* @__PURE__ */ new Map();
  const readRels = (relsPath) => {
    const out = /* @__PURE__ */ new Map();
    const xml = get(relsPath);
    if (!xml) return out;
    for (const m of xml.match(/<(?:[\w.-]+:)?Relationship\b[^>]*\/?\s*>/g) ?? []) {
      const id = m.match(/\bId=(['"])(.*?)\1/);
      const tgt = m.match(/\bTarget=(['"])(.*?)\1/);
      if (id?.[2] && tgt?.[2]) out.set(id[2], tgt[2].replace(/^\/?word\//, "").replace(/^\.\.\//, ""));
    }
    return out;
  };
  for (const name of Object.keys(files)) {
    const m = name.match(/^word\/_rels\/(.+)\.rels$/);
    if (m?.[1]) partRels.set(m[1], readRels(name));
  }
  const documentRels = partRels.get("document.xml") ?? /* @__PURE__ */ new Map();
  const diagramDrawings = /* @__PURE__ */ new Map();
  for (const name of Object.keys(files)) {
    const m = name.match(/^word\/(diagrams\/drawing\d+\.xml)$/);
    if (m?.[1]) diagramDrawings.set(m[1], dec.decode(files[name]));
  }
  const chartParts = /* @__PURE__ */ new Map();
  for (const name of Object.keys(files)) {
    const m = name.match(/^word\/(charts\/chart\d+\.xml)$/);
    if (m?.[1]) chartParts.set(m[1], dec.decode(files[name]));
  }
  const mediaFiles = /* @__PURE__ */ new Map();
  for (const name of Object.keys(files)) {
    const m = name.match(/^word\/media\/(.+)$/);
    if (m?.[1]) mediaFiles.set(m[1], files[name]);
  }
  const embeddedFonts = /* @__PURE__ */ new Map();
  const fontFaces = /* @__PURE__ */ new Map();
  const fontTable = get("word/fontTable.xml");
  const fontRels = partRels.get("fontTable.xml") ?? /* @__PURE__ */ new Map();
  for (const font of fontTable?.matchAll(/<w:font\b([^>]*)>([\s\S]*?)<\/w:font>/g) ?? []) {
    const family = font[1].match(/w:name="([^"]+)"/)?.[1] ?? null;
    for (const m of font[2].matchAll(/<w:embed(?:Regular|Bold|Italic|BoldItalic)\b([^>]*)>/g)) {
      const relId = m[1].match(/r:id="([^"]+)"/)?.[1];
      const key = m[1].match(/w:fontKey="([^"]+)"/)?.[1];
      const target = relId ? fontRels.get(relId) : void 0;
      const kind = m[0].match(/<w:embed(Regular|Bold|Italic|BoldItalic)/)?.[1] ?? "Regular";
      if (target && key) fontFaces.set(target.replace(/^\.\//, ""), {
        key,
        family,
        style: kind.includes("Italic") ? "italic" : "normal",
        weight: kind.includes("Bold") ? "700" : "normal"
      });
    }
  }
  for (const name of Object.keys(files)) {
    const m = name.match(/^word\/fonts\/(.+\.(ttf|otf|ttc|odttf))$/i);
    if (m?.[1]) {
      const target = `fonts/${m[1]}`;
      const face = fontFaces.get(target) ?? { key: "", family: null, style: "normal", weight: "normal" };
      embeddedFonts.set(m[1], {
        data: face.key ? deobfuscateEmbeddedFont(files[name], face.key) : files[name],
        family: face.family,
        style: face.style,
        weight: face.weight
      });
    }
  }
  return {
    documentXml: dec.decode(doc),
    stylesXml: get("word/styles.xml"),
    settingsXml: get("word/settings.xml"),
    themeXml: get("word/theme/theme1.xml"),
    numberingXml: get("word/numbering.xml"),
    footnotesXml: get("word/footnotes.xml"),
    endnotesXml: get("word/endnotes.xml"),
    headerFooterParts,
    documentRels,
    partRels,
    diagramDrawings,
    chartParts,
    mediaFiles,
    embeddedFonts
  };
}

// outputs/active/2026-11-17-mushaf-preview/integrated-private-previews/shamela-inline-headings-review/windows/source/packages/ooxml-model/src/index_part_context.ts
var documentPartContext = {
  partRelsRef: /* @__PURE__ */ new Map(),
  diagramsRef: /* @__PURE__ */ new Map(),
  chartsRef: /* @__PURE__ */ new Map(),
  partNameRef: null
};

// outputs/active/2026-11-17-mushaf-preview/integrated-private-previews/shamela-inline-headings-review/windows/source/packages/ooxml-model/src/index_theme.ts
function parseTheme(themeXml, settingsXml = null) {
  const out = /* @__PURE__ */ new Map();
  if (!themeXml) return out;
  const scheme = themeXml.match(/<a:clrScheme[\s\S]*?<\/a:clrScheme>/);
  if (!scheme) return out;
  const ALIAS = {
    dk1: "text1",
    lt1: "background1",
    dk2: "text2",
    lt2: "background2"
  };
  for (const m of scheme[0].matchAll(/<a:(\w+)>([\s\S]*?)<\/a:\1>/g)) {
    const name = m[1];
    const srgb = m[2].match(/<a:srgbClr val="([0-9A-Fa-f]{6})"/);
    const sys = m[2].match(/<a:sysClr[^>]*lastClr="([0-9A-Fa-f]{6})"/);
    const hex = (srgb?.[1] ?? sys?.[1] ?? "").toUpperCase();
    if (!hex) continue;
    out.set(name, hex);
    if (ALIAS[name]) out.set(ALIAS[name], hex);
  }
  const fontScheme = themeXml.match(/<a:fontScheme\b[^>]*>([\s\S]*?)<\/a:fontScheme>/)?.[1];
  if (fontScheme) {
    const bidiLanguage = settingsXml?.match(/<w:themeFontLang\b[^>]*\bw:bidi\s*=\s*["']([^"']+)["']/)?.[1];
    const bidiScript = bidiLanguage && (/-Arab(?:-|$)/i.test(bidiLanguage) || /^ar(?:-|$)/i.test(bidiLanguage)) ? "Arab" : void 0;
    for (const size of ["major", "minor"]) {
      const family = fontScheme.match(new RegExp(`<a:${size}Font>([\\s\\S]*?)<\\/a:${size}Font>`))?.[1];
      if (!family) continue;
      const face = (tag) => family.match(new RegExp(`<a:${tag}\\b[^>]*typeface="([^"]*)"`))?.[1];
      const latin = face("latin"), eastAsia = face("ea"), bidi = face("cs");
      if (latin) {
        out.set(`__font:${size}Ascii`, latin);
        out.set(`__font:${size}HAnsi`, latin);
      }
      if (eastAsia) out.set(`__font:${size}EastAsia`, eastAsia);
      if (bidi) out.set(`__font:${size}Bidi`, bidi);
      else if (bidiScript) {
        const supplemental = [...family.matchAll(/<a:font\b([^>]*)\/?\s*>/g)].find((m) => new RegExp(`\\bscript\\s*=\\s*["']${bidiScript}["']`).test(m[1]))?.[1];
        const resolved = supplemental?.match(/\btypeface\s*=\s*["']([^"']+)["']/)?.[1];
        if (resolved) out.set(`__font:${size}BidiResolved`, resolved);
      }
    }
  }
  const fills = themeXml.match(/<a:fillStyleLst>([\s\S]*?)<\/a:fillStyleLst>/)?.[1];
  if (fills) {
    let idx = 0;
    for (const m of fills.matchAll(/<a:(solidFill|gradFill)\b([^>]*)>([\s\S]*?)<\/a:\1>/g)) {
      idx++;
      if (m[1] !== "gradFill") continue;
      const linear = m[3].match(/<a:lin\b([^>]*)\/?\s*>/);
      const attr = (raw, name) => raw.match(new RegExp(`${name}="([^"]+)"`))?.[1];
      const stops = [];
      for (const gs of m[3].matchAll(/<a:gs\b([^>]*)>([\s\S]*?)<\/a:gs>/g)) {
        const rgb = gs[2].match(/<a:srgbClr\b[^>]*val="([0-9A-Fa-f]{6})"/)?.[1]?.toUpperCase();
        const sch = gs[2].match(/<a:schemeClr\b[^>]*val="([^"]+)"/)?.[1];
        const transforms = {};
        for (const tr of gs[2].matchAll(/<a:(tint|shade|satMod|lumMod|lumOff)\b[^>]*val="(\d+)"/g))
          transforms[tr[1]] = Number(tr[2]);
        stops.push({
          pos: Number(attr(gs[1], "pos") ?? 0) / 1e5,
          token: rgb ?? sch ?? "phClr",
          transforms
        });
      }
      if (stops.length) out.set(`__fillStyle:${idx}`, JSON.stringify({
        angle: (Number(attr(linear?.[1] ?? "", "ang") ?? 0) / 6e4 + 90) % 360,
        stops
      }));
    }
  }
  const effects = themeXml.match(/<a:effectStyleLst>([\s\S]*?)<\/a:effectStyleLst>/)?.[1];
  if (effects) {
    let idx = 0;
    for (const m of effects.matchAll(/<a:effectStyle>([\s\S]*?)<\/a:effectStyle>/g)) {
      idx++;
      const sh = m[1].match(/<a:outerShdw([^>]*)>([\s\S]*?)<\/a:outerShdw>/);
      if (!sh) continue;
      const attr = (name) => sh[1].match(new RegExp(`${name}="([^"]+)"`))?.[1];
      const rgb = sh[2].match(/<a:srgbClr[^>]*val="([0-9A-Fa-f]{6})"/)?.[1]?.toUpperCase();
      const schemeName = sh[2].match(/<a:schemeClr[^>]*val="([^"]+)"/)?.[1];
      const alpha = sh[2].match(/<a:alpha[^>]*val="(\d+)"/)?.[1];
      out.set(`__effectStyle:${idx}`, JSON.stringify({
        blurRad: Number(attr("blurRad") ?? 0),
        dist: Number(attr("dist") ?? 0),
        dir: Number(attr("dir") ?? 0),
        color: rgb ?? out.get(schemeName ?? "") ?? "000000",
        opacity: alpha == null ? 1 : Math.max(0, Math.min(1, Number(alpha) / 1e5))
      }));
    }
  }
  return out;
}

// outputs/active/2026-11-17-mushaf-preview/integrated-private-previews/shamela-inline-headings-review/windows/source/packages/ooxml-model/src/index_xml.ts
var import_fast_xml_parser = __toESM(require_fxp(), 1);
var parser = new import_fast_xml_parser.XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  preserveOrder: true,
  trimValues: false,
  parseTagValue: false
});
var OOXML_CANONICAL_PREFIX = /* @__PURE__ */ new Map([
  ["http://schemas.openxmlformats.org/wordprocessingml/2006/main", "w"],
  ["http://schemas.openxmlformats.org/officeDocument/2006/relationships", "r"],
  ["http://schemas.openxmlformats.org/markup-compatibility/2006", "mc"],
  ["http://schemas.openxmlformats.org/drawingml/2006/main", "a"],
  ["http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing", "wp"],
  ["http://schemas.openxmlformats.org/drawingml/2006/picture", "pic"],
  ["urn:schemas-microsoft-com:vml", "v"],
  ["urn:schemas-microsoft-com:office:office", "o"],
  ["urn:schemas-microsoft-com:office:word", "w10"]
]);
function canonicalizeOoxmlPrefixes(xml) {
  const aliases = [...xml.matchAll(/xmlns:([A-Za-z_][\w.-]*)=(['"])([^'"]+)\2/g)].map((match) => ({ alias: match[1], uri: match[3] }));
  let normalized = xml;
  for (const { alias, uri } of aliases) {
    const canonical = OOXML_CANONICAL_PREFIX.get(uri);
    if (!canonical || canonical === alias) continue;
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    normalized = normalized.replace(new RegExp(`(<\\/?|\\s)${escaped}:`, "g"), `$1${canonical}:`);
    const aliasDecl = new RegExp(`\\s+xmlns:${escaped}=(['"])${uri.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\1`);
    if (new RegExp(`xmlns:${canonical}=(['"])${uri.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\1`).test(normalized)) normalized = normalized.replace(aliasDecl, "");
    else normalized = normalized.replace(new RegExp(`xmlns:${escaped}=`, "g"), `xmlns:${canonical}=`);
  }
  return normalized;
}
function parseOoxml(xml) {
  return parser.parse(canonicalizeOoxmlPrefixes(xml));
}
var builder = new import_fast_xml_parser.XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  preserveOrder: true,
  suppressEmptyNode: false
});
function first(node, name) {
  for (const n of node) if (name in n) return n[name];
  return null;
}
function collectDeep(nodes, name) {
  const out = [];
  for (const n of nodes) {
    for (const key of Object.keys(n)) {
      if (key === ":@" || key === "#text") continue;
      const child = n[key];
      if (!Array.isArray(child)) continue;
      if (key === name)
        out.push({ node: child, attrs: n[":@"] ?? {} });
      out.push(...collectDeep(child, name));
    }
  }
  return out;
}

// outputs/active/2026-11-17-mushaf-preview/integrated-private-previews/shamela-inline-headings-review/windows/source/packages/ooxml-model/src/index_drawing_xml.ts
function drawingRoots(t) {
  if ("w:drawing" in t) return [t["w:drawing"]];
  if ("mc:AlternateContent" in t) {
    const alt = t["mc:AlternateContent"];
    const choice = collectDeep(alt, "mc:Choice")[0]?.node;
    const root = choice ?? collectDeep(alt, "mc:Fallback")[0]?.node;
    return root ? [root] : [];
  }
  if ("w:pict" in t) return [];
  return [];
}
function findAttr(parent, name) {
  for (const n of parent) if (name in n) return n[":@"] ?? {};
  return null;
}

// outputs/active/2026-11-17-mushaf-preview/integrated-private-previews/shamela-inline-headings-review/windows/source/packages/ooxml-model/src/index_paragraph_properties.ts
function indProps(pPr) {
  const ind = pPr ? findAttr(pPr, "w:ind") : null;
  if (!ind) return { indLeft: null, indRight: null, indFirstLine: null };
  const fl = ind["@w:firstLine"] != null || ind["@w:hanging"] != null ? Number(ind["@w:firstLine"] ?? 0) - Number(ind["@w:hanging"] ?? 0) : null;
  return {
    indLeft: ind["@w:left"] != null ? Number(ind["@w:left"]) : null,
    indRight: ind["@w:right"] != null ? Number(ind["@w:right"]) : null,
    indFirstLine: fl
  };
}
function resolveSymChar(font, charHex) {
  if (!charHex) return null;
  const cp = parseInt(charHex, 16);
  if (!Number.isFinite(cp)) return null;
  const isSym = /aga|arabesque|wingding|webding|symbol|marlett/i.test(font ?? "");
  const resolved = isSym && cp < 61440 ? 61440 + cp : cp;
  return String.fromCodePoint(resolved);
}
function sourceSymChar(font, charHex) {
  const cp = parseInt(charHex ?? "", 16);
  if (/^AGA Arabesque$/i.test((font ?? "").trim()) && cp === 61554) return "(";
  return null;
}
function parseTabStops(pPr, retainClears = false) {
  const tabsEl = pPr ? first(pPr, "w:tabs") : null;
  if (!tabsEl) return [];
  const out = [];
  for (const n of tabsEl) {
    if (!("w:tab" in n)) continue;
    const a = n[":@"] ?? {};
    const val = a["@w:val"] ?? "left";
    if (val === "clear" && !retainClears) continue;
    out.push({ val, posTwips: Number(a["@w:pos"] ?? 0), leader: a["@w:leader"] ?? null });
  }
  return out;
}
function resolveParagraphTabStops(styles, styleId, pPr) {
  const chain = [];
  const visited = /* @__PURE__ */ new Set();
  let current = styleId ?? styles.defaultParagraphStyleId;
  while (current && !visited.has(current) && visited.size < 64) {
    visited.add(current);
    const style = styles.byId.get(current);
    if (!style) break;
    chain.unshift(style.tabStops ?? []);
    current = style.basedOn;
  }
  const stops = /* @__PURE__ */ new Map();
  for (const tabs of [...chain, parseTabStops(pPr, true)]) for (const tab of tabs) {
    if (tab.val === "clear") stops.delete(tab.posTwips);
    else stops.set(tab.posTwips, { ...tab });
  }
  return [...stops.values()].sort((a, b) => a.posTwips - b.posTwips);
}
function spacingProps(pPr) {
  const el = pPr ? pPr.find((n) => "w:spacing" in n) : null;
  const sp = el ? el[":@"] ?? {} : null;
  if (!sp) return {
    present: false,
    line: null,
    lineRule: null,
    before: null,
    after: null,
    beforeAuto: null,
    afterAuto: null
  };
  const auto = (name) => sp[`@w:${name}`] == null ? null : !["0", "false", "off"].includes(sp[`@w:${name}`]);
  return {
    present: true,
    line: sp["@w:line"] != null ? Number(sp["@w:line"]) : null,
    lineRule: sp["@w:lineRule"] ?? (sp["@w:line"] != null ? "auto" : null),
    before: sp["@w:before"] != null ? Number(sp["@w:before"]) : null,
    after: sp["@w:after"] != null ? Number(sp["@w:after"]) : null,
    beforeAuto: auto("beforeAutospacing"),
    afterAuto: auto("afterAutospacing")
  };
}
function pPrFlag(pPr, name) {
  if (!pPr || first(pPr, name) === null) return null;
  const value = findAttr(pPr, name)?.["@w:val"];
  return !["0", "false", "off"].includes(value ?? "");
}

// outputs/active/2026-11-17-mushaf-preview/integrated-private-previews/shamela-inline-headings-review/windows/source/packages/ooxml-model/src/index_drawing_color.ts
function drawingColor(hex, transforms) {
  let rgb = [0, 1, 2].map((i) => parseInt(hex.slice(i * 2, i * 2 + 2), 16));
  const shade = transforms.shade;
  if (shade != null) rgb = rgb.map((v) => v * shade / 1e5);
  const tint = transforms.tint;
  if (tint != null) rgb = rgb.map((v) => v + (255 - v) * tint / 1e5);
  const lumMod = transforms.lumMod;
  if (lumMod != null) rgb = rgb.map((v) => v * lumMod / 1e5);
  const lumOff = transforms.lumOff;
  if (lumOff != null) rgb = rgb.map((v) => v + 255 * lumOff / 1e5);
  const satMod = transforms.satMod;
  if (satMod != null) {
    const c = rgb.map((v) => Math.max(0, Math.min(255, v)) / 255);
    const max = Math.max(...c), min = Math.min(...c), l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      const s0 = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      const s = Math.max(0, Math.min(1, s0 * satMod / 1e5));
      const h = max === c[0] ? ((c[1] - c[2]) / d + (c[1] < c[2] ? 6 : 0)) / 6 : max === c[1] ? ((c[2] - c[0]) / d + 2) / 6 : ((c[0] - c[1]) / d + 4) / 6;
      const hue = (p2, q2, t0) => {
        let t = t0;
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        return t < 1 / 6 ? p2 + (q2 - p2) * 6 * t : t < 1 / 2 ? q2 : t < 2 / 3 ? p2 + (q2 - p2) * (2 / 3 - t) * 6 : p2;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
      rgb = [h + 1 / 3, h, h - 1 / 3].map((t) => hue(p, q, t) * 255);
    }
  }
  return rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0").toUpperCase()).join("");
}
function themeGradient(theme, idx, placeholder) {
  const raw = idx ? theme.get(`__fillStyle:${idx}`) : void 0;
  if (!raw || !placeholder) return void 0;
  try {
    const parsed = JSON.parse(raw);
    const stops = parsed.stops.map((stop) => {
      const base = stop.token === "phClr" ? placeholder : theme.get(stop.token) ?? (/^[0-9A-F]{6}$/.test(stop.token) ? stop.token : placeholder);
      return { pos: Math.max(0, Math.min(1, stop.pos)), color: drawingColor(base, stop.transforms) };
    });
    return stops.length ? { angle: parsed.angle, stops } : void 0;
  } catch {
    return void 0;
  }
}
function drawingGradient(node, theme) {
  if (!node) return void 0;
  const stops = collectDeep(node, "a:gs").map((gs) => {
    const rgb = collectDeep(gs.node, "a:srgbClr")[0]?.attrs?.["@val"]?.toUpperCase();
    const scheme = collectDeep(gs.node, "a:schemeClr")[0]?.attrs?.["@val"];
    const base = rgb ?? theme.get(scheme ?? "");
    if (!base) return null;
    const transforms = {};
    for (const name of ["tint", "shade", "satMod", "lumMod", "lumOff"])
      for (const hit of collectDeep(gs.node, `a:${name}`)) transforms[name] = Number(hit.attrs["@val"] ?? 0);
    return {
      pos: Math.max(0, Math.min(1, Number(gs.attrs["@pos"] ?? 0) / 1e5)),
      color: drawingColor(base, transforms)
    };
  }).filter((stop) => Boolean(stop));
  if (!stops.length) return void 0;
  const angle = (Number(collectDeep(node, "a:lin")[0]?.attrs?.["@ang"] ?? 0) / 6e4 + 90) % 360;
  return { angle, stops };
}
function applyTintShade(hex, tint, shade) {
  const f = (v) => v ? parseInt(v, 16) / 255 : null;
  const t = f(tint), sh = f(shade);
  if (t == null && sh == null) return hex;
  const ch = (i) => parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  const conv = (c) => {
    if (t != null) return Math.round(c * t + 255 * (1 - t));
    return Math.round(c * sh);
  };
  return [0, 1, 2].map((i) => conv(ch(i)).toString(16).padStart(2, "0").toUpperCase()).join("");
}
function resolveColor(attrs, theme) {
  if (!attrs) return null;
  const tc = attrs["@w:themeColor"];
  if (tc) {
    const base = theme.get(tc);
    if (base) return applyTintShade(base, attrs["@w:themeTint"], attrs["@w:themeShade"]);
  }
  const v = attrs["@w:val"];
  if (v && v !== "auto" && /^[0-9A-Fa-f]{6}$/.test(v)) return v.toUpperCase();
  return null;
}

// outputs/active/2026-11-17-mushaf-preview/integrated-private-previews/shamela-inline-headings-review/windows/source/packages/ooxml-model/src/index_run_look.ts
var nativeCsBold = /* @__PURE__ */ Symbol("nativeCsBold");
var nativeCsItalic = /* @__PURE__ */ Symbol("nativeCsItalic");
function onFlag(rpr, nm) {
  if (first(rpr, nm) === null) return void 0;
  const v = findAttr(rpr, nm)?.["@w:val"];
  return !["0", "false", "off"].includes(v ?? "");
}
function rPrLook(rpr, theme) {
  if (!rpr) return {};
  const out = {};
  const csBold = onFlag(rpr, "w:bCs"), csItalic = onFlag(rpr, "w:iCs");
  if (csBold !== void 0) out[nativeCsBold] = csBold;
  if (csItalic !== void 0) out[nativeCsItalic] = csItalic;
  const colAttrs = findAttr(rpr, "w:color");
  const col = resolveColor(colAttrs, theme);
  if (col) out.color = col;
  const hl = findAttr(rpr, "w:highlight")?.["@w:val"];
  if (hl && hl !== "none") out.highlight = hl;
  const uAttrs = findAttr(rpr, "w:u");
  if (uAttrs) {
    const uv = uAttrs["@w:val"] ?? "single";
    if (uv !== "none") {
      out.underline = uv;
      const uc = resolveColor(uAttrs, theme);
      if (uc) out.underlineColor = uc;
    }
  }
  const st = onFlag(rpr, "w:strike");
  if (st !== void 0) out.strike = st;
  const ds = onFlag(rpr, "w:dstrike");
  if (ds !== void 0) out.doubleStrike = ds;
  const cp = onFlag(rpr, "w:caps");
  if (cp !== void 0) out.caps = cp;
  const sc = onFlag(rpr, "w:smallCaps");
  if (sc !== void 0) out.smallCaps = sc;
  const it = onFlag(rpr, "w:i") ?? onFlag(rpr, "w:iCs");
  if (it !== void 0) out.italic = it;
  const bd = onFlag(rpr, "w:b") ?? onFlag(rpr, "w:bCs");
  if (bd !== void 0) out.bold = bd;
  const va = findAttr(rpr, "w:vertAlign")?.["@w:val"];
  if (va) {
    out.superscript = va === "superscript";
    out.subscript = va === "subscript";
  }
  const legacyShadow = onFlag(rpr, "w:shadow");
  if (legacyShadow !== void 0) out.legacyShadow = legacyShadow;
  for (const n of rpr) {
    if (!("w:spacing" in n)) continue;
    const v = n[":@"]?.["@w:val"];
    if (v != null && v !== "") out.charSpacing = Number(v);
  }
  const pos = findAttr(rpr, "w:position")?.["@w:val"];
  if (pos != null && pos !== "") out.position = Number(pos) * 10;
  const kn = findAttr(rpr, "w:kern")?.["@w:val"];
  if (kn != null && kn !== "") out.kern = Number(kn);
  const width = findAttr(rpr, "w:w")?.["@w:val"];
  if (width != null && width !== "") out.charScale = Number(width);
  const ligatures = findAttr(rpr, "w14:ligatures")?.["@w14:val"];
  if (ligatures) out.ligatures = ligatures;
  const lang = findAttr(rpr, "w:lang");
  if (lang?.["@w:val"]) out.language = lang["@w:val"];
  if (lang?.["@w:bidi"]) out.bidiLanguage = lang["@w:bidi"];
  if (lang?.["@w:eastAsia"]) out.eastAsiaLanguage = lang["@w:eastAsia"];
  const textFill = collectDeep(rpr, "w14:textFill")[0]?.node;
  const grad = textFill ? collectDeep(textFill, "w14:gradFill")[0]?.node : void 0;
  if (grad) {
    const stops = collectDeep(grad, "w14:gs").map((gs) => {
      const rgb = collectDeep(gs.node, "w14:srgbClr")[0]?.attrs?.["@w14:val"]?.toUpperCase();
      const scheme = collectDeep(gs.node, "w14:schemeClr")[0]?.attrs?.["@w14:val"];
      const base = rgb ?? theme.get(scheme ?? "");
      if (!base) return null;
      const transforms = {};
      for (const name of ["tint", "shade", "satMod", "lumMod", "lumOff"])
        for (const hit of collectDeep(gs.node, `w14:${name}`)) transforms[name] = Number(hit.attrs["@w14:val"] ?? 0);
      return {
        pos: Math.max(0, Math.min(1, Number(gs.attrs["@w14:pos"] ?? 0) / 1e5)),
        color: drawingColor(base, transforms)
      };
    }).filter((stop) => Boolean(stop));
    const lin = collectDeep(grad, "w14:lin")[0]?.attrs;
    if (stops.length) out.textGradient = {
      angle: (Number(lin?.["@w14:ang"] ?? 0) / 6e4 + 90) % 360,
      stops
    };
  }
  const outline = collectDeep(rpr, "w14:textOutline")[0];
  if (outline && !collectDeep(outline.node, "w14:noFill").length) {
    const rgbNode = collectDeep(outline.node, "w14:srgbClr")[0];
    const schemeNode = collectDeep(outline.node, "w14:schemeClr")[0];
    const base = rgbNode?.attrs?.["@w14:val"]?.toUpperCase() ?? theme.get(schemeNode?.attrs?.["@w14:val"] ?? "");
    const colorNode = rgbNode?.node ?? schemeNode?.node;
    if (base && colorNode) {
      const transforms = {};
      for (const name of ["tint", "shade", "satMod", "lumMod", "lumOff"])
        for (const hit of collectDeep(colorNode, `w14:${name}`)) transforms[name] = Number(hit.attrs["@w14:val"] ?? 0);
      out.textOutline = {
        widthTwips: Math.max(0, Number(outline.attrs["@w14:w"] ?? 0) / 635),
        color: drawingColor(base, transforms)
      };
    }
  }
  const shadow = collectDeep(rpr, "w14:shadow")[0];
  if (shadow) {
    const rgbNode = collectDeep(shadow.node, "w14:srgbClr")[0];
    const schemeNode = collectDeep(shadow.node, "w14:schemeClr")[0];
    const base = rgbNode?.attrs?.["@w14:val"]?.toUpperCase() ?? theme.get(schemeNode?.attrs?.["@w14:val"] ?? "");
    const colorNode = rgbNode?.node ?? schemeNode?.node;
    if (base && colorNode) {
      const transforms = {};
      for (const name of ["tint", "shade", "satMod", "lumMod", "lumOff"])
        for (const hit of collectDeep(colorNode, `w14:${name}`)) transforms[name] = Number(hit.attrs["@w14:val"] ?? 0);
      const alpha = collectDeep(colorNode, "w14:alpha")[0]?.attrs?.["@w14:val"];
      const distanceTwips = Number(shadow.attrs["@w14:dist"] ?? 0) / 635;
      const radians = Number(shadow.attrs["@w14:dir"] ?? 0) / 6e4 * Math.PI / 180;
      out.textShadow = {
        xTwips: distanceTwips * Math.cos(radians),
        yTwips: distanceTwips * Math.sin(radians),
        blurTwips: Math.max(0, Number(shadow.attrs["@w14:blurRad"] ?? 0) / 635),
        color: drawingColor(base, transforms),
        opacity: alpha == null ? 1 : Math.max(0, Math.min(1, Number(alpha) / 1e5))
      };
    }
  }
  const reflection = collectDeep(rpr, "w14:reflection")[0]?.attrs;
  if (reflection) {
    const distanceTwips = Number(reflection["@w14:dist"] ?? 0) / 635;
    const radians = Number(reflection["@w14:dir"] ?? 0) / 6e4 * Math.PI / 180;
    out.textReflection = {
      xTwips: distanceTwips * Math.cos(radians),
      yTwips: distanceTwips * Math.sin(radians),
      blurTwips: Math.max(0, Number(reflection["@w14:blurRad"] ?? 0) / 635),
      scaleX: Number(reflection["@w14:sx"] ?? 1e5) / 1e5,
      scaleY: Number(reflection["@w14:sy"] ?? -1e5) / 1e5,
      startOpacity: Math.max(0, Math.min(1, Number(reflection["@w14:stA"] ?? 1e5) / 1e5)),
      endOpacity: Math.max(0, Math.min(1, Number(reflection["@w14:endA"] ?? 0) / 1e5)),
      startPosition: Math.max(0, Math.min(1, Number(reflection["@w14:stPos"] ?? 0) / 1e5)),
      endPosition: Math.max(0, Math.min(1, Number(reflection["@w14:endPos"] ?? 1e5) / 1e5)),
      fadeAngle: (Number(reflection["@w14:fadeDir"] ?? 54e5) / 6e4 + 90) % 360
    };
  }
  return out;
}
function rPrProps(rpr, theme = /* @__PURE__ */ new Map()) {
  if (!rpr) return { sz: null, family: null };
  let sz = null;
  let family = null;
  let latinFamily;
  let csFamily, csSz;
  for (const n of rpr) {
    const a = n[":@"] ?? {};
    if ("w:szCs" in n && a["@w:val"]) sz = csSz = Number(a["@w:val"]);
    else if ("w:sz" in n && sz == null && a["@w:val"]) sz = Number(a["@w:val"]);
    if ("w:rFonts" in n) {
      const themed = (token) => token ? theme.get(`__font:${token}`) : void 0;
      const csToken = a["@w:cstheme"] ?? a["@w:csTheme"];
      csFamily = a["@w:cs"] ?? themed(csToken) ?? (csToken ? theme.get(`__font:${csToken}Resolved`) : void 0) ?? csFamily;
      latinFamily = a["@w:ascii"] ?? a["@w:hAnsi"] ?? themed(a["@w:asciiTheme"]) ?? themed(a["@w:hAnsiTheme"]) ?? latinFamily;
      family = a["@w:cs"] ?? a["@w:ascii"] ?? a["@w:hAnsi"] ?? a["@w:eastAsia"] ?? themed(a["@w:cstheme"] ?? a["@w:csTheme"]) ?? themed(a["@w:asciiTheme"]) ?? themed(a["@w:hAnsiTheme"]) ?? themed(a["@w:eastAsiaTheme"]) ?? family;
    }
  }
  return { sz, family, ...latinFamily ? { latinFamily } : {}, ...csFamily ? { csFamily } : {}, ...csSz != null ? { csSz } : {} };
}

// outputs/active/2026-11-17-mushaf-preview/integrated-private-previews/shamela-inline-headings-review/windows/source/packages/ooxml-model/src/index_table_types.ts
function parseBorders(node) {
  const side = (nm) => {
    const a = findAttr(node, `w:${nm}`);
    if (!a) return null;
    const val = a["@w:val"] ?? "single";
    if (val === "none" || val === "nil") return null;
    return {
      wTwips: Math.round(Number(a["@w:sz"] ?? 4) / 8 * 20),
      spaceTwips: Number(a["@w:space"] ?? 0) * 20,
      // w:space بالنقاط
      color: a["@w:color"] && a["@w:color"] !== "auto" ? a["@w:color"].toUpperCase() : null,
      val
    };
  };
  return {
    top: side("top"),
    bottom: side("bottom"),
    left: side("left"),
    right: side("right"),
    insideH: side("insideH"),
    insideV: side("insideV")
  };
}

// outputs/active/2026-11-17-mushaf-preview/integrated-private-previews/shamela-inline-headings-review/windows/source/packages/ooxml-model/src/index_style_resolution.ts
function overlaySpacing(base, higher) {
  return {
    ...base,
    present: base.present || higher.present,
    line: higher.line ?? base.line,
    lineRule: higher.line != null ? higher.lineRule : base.lineRule,
    lineSource: higher.line != null ? higher.lineSource ?? "style" : base.lineSource ?? null,
    before: higher.before ?? base.before,
    after: higher.after ?? base.after,
    beforeAuto: higher.beforeAuto ?? base.beforeAuto ?? null,
    afterAuto: higher.afterAuto ?? base.afterAuto ?? null
  };
}
function tableLookFlag(attrs, name, dflt) {
  const value = attrs?.[`@w:${name}`];
  if (value != null) return !["0", "false", "off"].includes(value);
  const mask = {
    firstRow: 32,
    lastRow: 64,
    firstColumn: 128,
    lastColumn: 256,
    noHBand: 512,
    noVBand: 1024
  };
  const raw = attrs?.["@w:val"];
  if (raw && mask[name] != null) return (parseInt(raw, 16) & mask[name]) !== 0;
  return dflt;
}
function tableStyleRegionForCell(style, look, row, rowCount, col, colCount, rowBandSize = style?.rowBandSize ?? 1, colBandSize = style?.colBandSize ?? 1) {
  const merged = style ? {
    shdFill: style.whole.shdFill,
    borders: style.whole.borders,
    sz: style.whole.sz,
    family: style.whole.family,
    jc: style.whole.jc,
    ...style.whole.csFamily != null ? { csFamily: style.whole.csFamily } : {},
    ...style.whole.csSz != null ? { csSz: style.whole.csSz } : {},
    bidi: style.whole.bidi,
    look: { ...style.whole.look },
    spacing: { ...style.whole.spacing }
  } : { shdFill: null, borders: null, sz: null, family: null, jc: null, bidi: null, look: {}, spacing: { ...NO_SPACING } };
  if (!style) return merged;
  const apply = (name) => {
    const region = style.regions.get(name);
    if (!region) return;
    if (region.shdFill != null) merged.shdFill = region.shdFill;
    if (region.borders != null) merged.borders = region.borders;
    if (region.sz != null) merged.sz = region.sz;
    if (region.family != null) merged.family = region.family;
    if (region.csFamily != null) merged.csFamily = region.csFamily;
    if (region.csSz != null) merged.csSz = region.csSz;
    if (region.jc != null) merged.jc = region.jc;
    if (region.bidi != null) merged.bidi = region.bidi;
    merged.spacing = overlaySpacing(merged.spacing, region.spacing);
    Object.assign(merged.look, region.look);
  };
  const hasFirstRow = tableLookFlag(look, "firstRow", true);
  const hasFirstCol = tableLookFlag(look, "firstColumn", true);
  const bandRow = Math.max(0, row - (hasFirstRow ? 1 : 0));
  const bandCol = Math.max(0, col - (hasFirstCol ? 1 : 0));
  if (!tableLookFlag(look, "noHBand", false))
    apply(Math.floor(bandRow / Math.max(1, rowBandSize)) % 2 === 0 ? "band1Horz" : "band2Horz");
  if (!tableLookFlag(look, "noVBand", true))
    apply(Math.floor(bandCol / Math.max(1, colBandSize)) % 2 === 0 ? "band1Vert" : "band2Vert");
  if (hasFirstRow && row === 0) apply("firstRow");
  if (tableLookFlag(look, "lastRow", false) && row === rowCount - 1) apply("lastRow");
  if (hasFirstCol && col === 0) apply("firstCol");
  if (tableLookFlag(look, "lastColumn", false) && col === colCount - 1) apply("lastCol");
  if (row === 0 && col === 0) apply("nwCell");
  if (row === 0 && col === colCount - 1) apply("neCell");
  if (row === rowCount - 1 && col === 0) apply("swCell");
  if (row === rowCount - 1 && col === colCount - 1) apply("seCell");
  return merged;
}
function resolveViaStyle(table, styleId, includeDefaults = true, includeFontDefaults = true) {
  let sz = null, family = null, jc = null;
  let latinFamily;
  let numId = null, ilvl = null;
  let csFamily, csSz;
  let bidi = null, suppressAutoHyphens = null, outlineLevel = null;
  let keepNext = null, keepLines = null;
  let contextualSpacing = null;
  let widowControl = null;
  let snapToGrid = null;
  const look = {};
  let indLeft = null, indRight = null, indFirstLine = null;
  const sp = { ...NO_SPACING, lineSource: null };
  let id = styleId, guard = 0;
  while (id && guard++ < 12) {
    const s = table.byId.get(id);
    if (!s) break;
    sz ??= s.sz;
    family ??= s.family;
    jc ??= s.jc;
    bidi ??= s.bidi;
    latinFamily ??= s.latinFamily;
    numId ??= s.numId ?? null;
    ilvl ??= s.ilvl ?? null;
    csFamily ??= s.csFamily;
    csSz ??= s.csSz;
    suppressAutoHyphens ??= s.suppressAutoHyphens;
    outlineLevel ??= s.outlineLevel;
    keepNext ??= s.keepNext;
    keepLines ??= s.keepLines;
    contextualSpacing ??= s.contextualSpacing;
    widowControl ??= s.widowControl;
    snapToGrid ??= s.snapToGrid;
    for (const k of Reflect.ownKeys(s.look))
      if (look[k] === void 0) look[k] = s.look[k];
    indLeft ??= s.indLeft;
    indRight ??= s.indRight;
    indFirstLine ??= s.indFirstLine;
    if (s.spacing.present) {
      sp.present = true;
      if (sp.line == null && s.spacing.line != null) {
        sp.line = s.spacing.line;
        sp.lineRule = s.spacing.lineRule;
        sp.lineSource = "style";
      }
      sp.before ??= s.spacing.before;
      sp.after ??= s.spacing.after;
      sp.beforeAuto ??= s.spacing.beforeAuto ?? null;
      sp.afterAuto ??= s.spacing.afterAuto ?? null;
    }
    id = s.basedOn;
  }
  const dsp = table.defaults.spacing;
  if (includeDefaults && dsp.present) {
    sp.present = true;
    if (sp.line == null && dsp.line != null) {
      sp.line = dsp.line;
      sp.lineRule = dsp.lineRule;
      sp.lineSource = "docDefaults";
    }
    sp.before ??= dsp.before;
    sp.after ??= dsp.after;
    sp.beforeAuto ??= dsp.beforeAuto ?? null;
    sp.afterAuto ??= dsp.afterAuto ?? null;
  }
  return {
    sz: sz ?? (includeFontDefaults ? table.defaults.sz : null),
    family: family ?? (includeFontDefaults ? table.defaults.family : null),
    latinFamily: latinFamily ?? (includeFontDefaults ? table.defaults.latinFamily : void 0),
    csFamily: csFamily ?? (includeFontDefaults ? table.defaults.csFamily : void 0),
    csSz: csSz ?? (includeFontDefaults ? table.defaults.csSz : void 0),
    jc: jc ?? table.defaults.jc,
    bidi: bidi ?? table.defaults.bidi,
    suppressAutoHyphens: suppressAutoHyphens ?? table.defaults.suppressAutoHyphens,
    outlineLevel: outlineLevel ?? table.defaults.outlineLevel,
    keepNext: keepNext ?? table.defaults.keepNext,
    keepLines: keepLines ?? table.defaults.keepLines,
    contextualSpacing: contextualSpacing ?? table.defaults.contextualSpacing,
    widowControl: widowControl ?? table.defaults.widowControl,
    snapToGrid: snapToGrid ?? table.defaults.snapToGrid,
    indLeft: indLeft ?? 0,
    indRight: indRight ?? 0,
    indFirstLine: indFirstLine ?? 0,
    spacing: sp,
    look,
    numId,
    ilvl
  };
}

// outputs/active/2026-11-17-mushaf-preview/integrated-private-previews/shamela-inline-headings-review/windows/source/packages/ooxml-model/src/index_styles.ts
var NO_SPACING = {
  present: false,
  line: null,
  lineRule: null,
  before: null,
  after: null,
  beforeAuto: null,
  afterAuto: null
};
function parseStyles(stylesXml, theme = /* @__PURE__ */ new Map()) {
  const table = {
    defaults: { sz: null, family: null, spacing: NO_SPACING, jc: null, bidi: null, suppressAutoHyphens: null, outlineLevel: null, keepNext: null, keepLines: null, contextualSpacing: null, widowControl: null, snapToGrid: null },
    defaultParagraphStyleId: null,
    byId: /* @__PURE__ */ new Map(),
    nameToId: /* @__PURE__ */ new Map(),
    tableById: /* @__PURE__ */ new Map()
  };
  if (!stylesXml) return table;
  const root = parseOoxml(stylesXml);
  const styles = first(root, "w:styles");
  if (!styles) return table;
  const docDefaults = first(styles, "w:docDefaults");
  if (docDefaults) {
    const rprDefault = first(docDefaults, "w:rPrDefault");
    const rpr = rprDefault ? first(rprDefault, "w:rPr") : null;
    const pprDefault = first(docDefaults, "w:pPrDefault");
    const dpPr = pprDefault ? first(pprDefault, "w:pPr") : null;
    table.defaults = {
      ...rPrProps(rpr, theme),
      spacing: spacingProps(dpPr),
      jc: findAttr(dpPr ?? [], "w:jc")?.["@w:val"] ?? null,
      bidi: pPrFlag(dpPr, "w:bidi"),
      suppressAutoHyphens: pPrFlag(dpPr, "w:suppressAutoHyphens"),
      outlineLevel: findAttr(dpPr ?? [], "w:outlineLvl")?.["@w:val"] != null ? Number(findAttr(dpPr ?? [], "w:outlineLvl")["@w:val"]) : null,
      keepNext: pPrFlag(dpPr, "w:keepNext"),
      keepLines: pPrFlag(dpPr, "w:keepLines"),
      contextualSpacing: pPrFlag(dpPr, "w:contextualSpacing"),
      widowControl: pPrFlag(dpPr, "w:widowControl"),
      snapToGrid: pPrFlag(dpPr, "w:snapToGrid")
    };
  }
  for (const styleNode of styles) {
    if (!("w:style" in styleNode)) continue;
    const a = styleNode[":@"] ?? {};
    const id = a["@w:styleId"];
    if (!id) continue;
    if (a["@w:type"] === "paragraph" && (a["@w:default"] === "1" || a["@w:default"] === "true"))
      table.defaultParagraphStyleId = id;
    const body = styleNode["w:style"];
    const displayName = findAttr(body, "w:name")?.["@w:val"];
    if (displayName) {
      table.nameToId.set(displayName, id);
      table.nameToId.set(displayName.toLowerCase(), id);
    }
    if (a["@w:type"] === "table") {
      const regionOf = (host) => {
        const tcPr = first(host, "w:tcPr");
        const tblPr = first(host, "w:tblPr");
        const shd = findAttr(tcPr ?? tblPr ?? host, "w:shd");
        const rawFill = shd?.["@w:fill"];
        const shdFill = rawFill && !["auto", "FFFFFF", "ffffff", "nil"].includes(rawFill) ? rawFill.toUpperCase() : null;
        const bordersNode = first(tcPr ?? [], "w:tcBorders") ?? first(tblPr ?? [], "w:tblBorders");
        const pPr = first(host, "w:pPr");
        const rPr = first(host, "w:rPr");
        const font = rPrProps(rPr, theme);
        return {
          shdFill,
          borders: bordersNode ? parseBorders(bordersNode) : null,
          ...font,
          jc: pPr ? findAttr(pPr, "w:jc")?.["@w:val"] ?? null : null,
          bidi: pPrFlag(pPr, "w:bidi"),
          look: rPrLook(rPr, theme),
          spacing: spacingProps(pPr)
        };
      };
      const regions = /* @__PURE__ */ new Map();
      for (const child of body) {
        if (!("w:tblStylePr" in child)) continue;
        const type = (child[":@"] ?? {})["@w:type"];
        if (type) regions.set(type, regionOf(child["w:tblStylePr"]));
      }
      const styleTblPr = first(body, "w:tblPr");
      const bandSize = (name) => Math.max(
        1,
        Number(findAttr(styleTblPr ?? [], `w:${name}`)?.["@w:val"] ?? 1) || 1
      );
      table.tableById.set(id, {
        whole: regionOf(body),
        regions,
        rowBandSize: bandSize("tblStyleRowBandSize"),
        colBandSize: bandSize("tblStyleColBandSize")
      });
    }
    const rpr = first(body, "w:rPr");
    const basedOnAttrs = findAttr(body, "w:basedOn");
    const p = rPrProps(rpr, theme);
    const stylePPr = first(body, "w:pPr");
    const ind = indProps(stylePPr);
    const styleNumPr = first(stylePPr ?? [], "w:numPr");
    const jc = stylePPr ? findAttr(stylePPr, "w:jc")?.["@w:val"] ?? null : null;
    table.byId.set(id, {
      tabStops: parseTabStops(stylePPr, true),
      ...p,
      ...ind,
      numId: findAttr(styleNumPr ?? [], "w:numId")?.["@w:val"] ?? null,
      ilvl: findAttr(styleNumPr ?? [], "w:ilvl")?.["@w:val"] ?? null,
      jc,
      bidi: pPrFlag(stylePPr, "w:bidi"),
      suppressAutoHyphens: pPrFlag(stylePPr, "w:suppressAutoHyphens"),
      spacing: spacingProps(stylePPr),
      outlineLevel: findAttr(stylePPr ?? [], "w:outlineLvl")?.["@w:val"] != null ? Number(findAttr(stylePPr ?? [], "w:outlineLvl")["@w:val"]) : null,
      keepNext: pPrFlag(stylePPr, "w:keepNext"),
      keepLines: pPrFlag(stylePPr, "w:keepLines"),
      contextualSpacing: pPrFlag(stylePPr, "w:contextualSpacing"),
      widowControl: pPrFlag(stylePPr, "w:widowControl"),
      snapToGrid: pPrFlag(stylePPr, "w:snapToGrid"),
      look: rPrLook(rpr, theme),
      basedOn: basedOnAttrs?.["@w:val"] ?? null
    });
  }
  for (const [id, style] of table.tableById) style.whole.spacing = resolveViaStyle(table, id, false).spacing;
  return table;
}

// outputs/active/2026-11-17-mushaf-preview/integrated-private-previews/shamela-inline-headings-review/windows/source/packages/ooxml-model/src/index_numbering.ts
function parseNumbering(numberingXml) {
  const table = /* @__PURE__ */ new Map();
  if (!numberingXml) return table;
  const root = parseOoxml(numberingXml);
  const numbering = first(root, "w:numbering");
  if (!numbering) return table;
  const absLvls = /* @__PURE__ */ new Map();
  for (const node of numbering) {
    if ("w:abstractNum" in node) {
      const abs = node["w:abstractNum"];
      const absId = node[":@"]?.["@w:abstractNumId"];
      if (absId == null) continue;
      const lvls = /* @__PURE__ */ new Map();
      for (const l of abs) {
        if (!("w:lvl" in l)) continue;
        const lvl = l["w:lvl"];
        const ilvl = l[":@"]?.["@w:ilvl"];
        const pPr = first(lvl, "w:pPr");
        const ind = pPr ? findAttr(pPr, "w:ind") : null;
        if (ilvl == null) continue;
        const sz = rPrProps(first(lvl, "w:rPr")).sz;
        const markerFonts = findAttr(first(lvl, "w:rPr") ?? [], "w:rFonts");
        const markerFamily = markerFonts?.["@w:ascii"] ?? markerFonts?.["@w:hAnsi"] ?? markerFonts?.["@w:cs"] ?? markerFonts?.["@w:eastAsia"] ?? null;
        const markerRPr = first(lvl, "w:rPr");
        const markerBold = markerRPr ? onFlag(markerRPr, "w:b") ?? onFlag(markerRPr, "w:bCs") ?? false : false;
        const markerUnderline = markerRPr ? findAttr(markerRPr, "w:u")?.["@w:val"] ?? null : null;
        const rawMarkerColor = markerRPr ? findAttr(markerRPr, "w:color")?.["@w:val"] : null;
        const markerColor = rawMarkerColor && /^[0-9A-Fa-f]{6}$/.test(rawMarkerColor) ? rawMarkerColor.toUpperCase() : null;
        if (!ind && sz == null && !first(lvl, "w:numFmt") && !first(lvl, "w:lvlText") && !first(lvl, "w:lvlJc")) continue;
        const left = ind?.["@w:left"] != null ? Number(ind["@w:left"]) : null;
        const right = ind?.["@w:right"] != null ? Number(ind["@w:right"]) : null;
        const hanging = ind?.["@w:hanging"] != null ? Number(ind["@w:hanging"]) : null;
        const firstLine = ind?.["@w:firstLine"] != null ? Number(ind["@w:firstLine"]) : null;
        const fmt = findAttr(lvl, "w:numFmt")?.["@w:val"] ?? null;
        const lvlText = findAttr(lvl, "w:lvlText")?.["@w:val"] ?? null;
        const start = findAttr(lvl, "w:start")?.["@w:val"] != null ? Number(findAttr(lvl, "w:start")?.["@w:val"]) : null;
        const jc = findAttr(lvl, "w:lvlJc")?.["@w:val"] ?? null;
        lvls.set(ilvl, {
          indLeft: left,
          indRight: right,
          indFirstLine: hanging != null ? -hanging : firstLine,
          sz,
          markerFamily,
          markerBold,
          markerUnderline,
          markerColor,
          fmt,
          lvlText,
          start,
          jc,
          paragraphStyleId: findAttr(lvl, "w:pStyle")?.["@w:val"] ?? null
        });
      }
      absLvls.set(absId, lvls);
    }
  }
  for (const node of numbering) {
    if (!("w:num" in node)) continue;
    const num = node["w:num"];
    const numId = node[":@"]?.["@w:numId"];
    const absRef = findAttr(num, "w:abstractNumId")?.["@w:val"];
    if (numId == null || absRef == null) continue;
    const lvls = absLvls.get(String(absRef));
    if (!lvls) continue;
    const startOverrides = /* @__PURE__ */ new Map();
    for (const child of num) {
      if (!("w:lvlOverride" in child)) continue;
      const ilvl = child[":@"]?.["@w:ilvl"];
      const body = child["w:lvlOverride"];
      const raw = findAttr(body, "w:startOverride")?.["@w:val"];
      if (ilvl != null && raw != null && Number.isFinite(Number(raw))) startOverrides.set(ilvl, Number(raw));
    }
    for (const [ilvl, props] of lvls) table.set(`${numId}/${ilvl}`, {
      ...props,
      start: startOverrides.get(ilvl) ?? props.start
    });
  }
  return table;
}

// outputs/active/2026-11-17-mushaf-preview/integrated-private-previews/shamela-inline-headings-review/windows/source/packages/ooxml-model/src/index_tables.ts
function createTableFlattener(context) {
  return (nodes, ctx = null, depth = 0, sharedCellBlock) => {
    const out = [];
    const cellBlock = sharedCellBlock ?? { value: 0 };
    for (const n of nodes) {
      if ("w:p" in n) {
        out.push({ node: n, cell: ctx ? { ...ctx, cellBlockIndex: cellBlock.value } : null });
        if (ctx) cellBlock.value++;
      } else if ("w:sdt" in n) {
        const content = context.first(n["w:sdt"], "w:sdtContent");
        if (content) out.push(...context.flattenBlocks(content, ctx, depth, cellBlock));
      } else if ("w:tbl" in n) {
        if (depth >= context.MAX_TABLE_NESTING) throw new Error(`\u062A\u062C\u0627\u0648\u0632 \u062A\u0639\u0634\u064A\u0634 \u0627\u0644\u062C\u062F\u0627\u0648\u0644 \u0627\u0644\u062D\u062F ${context.MAX_TABLE_NESTING}`);
        const tbl = n["w:tbl"];
        const tblPr = context.first(tbl, "w:tblPr");
        const tblStyleId = tblPr ? context.findAttr(tblPr, "w:tblStyle")?.["@w:val"] ?? null : null;
        const tblWAttr = tblPr ? context.findAttr(tblPr, "w:tblW") : null;
        const tblWVal = Number(tblWAttr?.["@w:w"] ?? 0);
        const tblWType = tblWAttr?.["@w:type"] ?? "auto";
        const tblPrNode = context.first(tbl, "w:tblPr");
        const rawTblLayout = tblPrNode ? context.findAttr(tblPrNode, "w:tblLayout")?.["@w:type"] : void 0;
        const tblLayout = rawTblLayout === "fixed" ? "fixed" : "autofit";
        const tblLook = tblPrNode ? context.findAttr(tblPrNode, "w:tblLook") : null;
        const tableStyle = tblStyleId ? context.styles.tableById.get(tblStyleId) : void 0;
        const directBandSize = (name, fallback) => Math.max(
          1,
          Number(context.findAttr(tblPrNode ?? [], `w:${name}`)?.["@w:val"] ?? fallback) || fallback
        );
        const rowBandSize = directBandSize("tblStyleRowBandSize", tableStyle?.rowBandSize ?? 1);
        const colBandSize = directBandSize("tblStyleColBandSize", tableStyle?.colBandSize ?? 1);
        const bidiVisual = !tblPrNode ? true : context.first(tblPrNode, "w:bidiVisual") !== null && !["0", "false"].includes(context.findAttr(tblPrNode, "w:bidiVisual")?.["@w:val"] ?? "");
        const indAttr = tblPrNode ? context.findAttr(tblPrNode, "w:tblInd") : null;
        const indType = indAttr?.["@w:type"] ?? "dxa";
        const rawInd = Number(indAttr?.["@w:w"] ?? 0);
        const tblIndTwips = ["pct", "auto", "nil"].includes(indType) || rawInd <= 0 ? 0 : rawInd;
        const tblJc = tblPrNode ? context.findAttr(tblPrNode, "w:jc")?.["@w:val"] ?? null : null;
        const tblCellMar = tblPrNode ? context.first(tblPrNode, "w:tblCellMar") : null;
        const tblBordersNode = tblPrNode ? context.first(tblPrNode, "w:tblBorders") : null;
        const tblBorders = tblBordersNode ? context.parseBorders(tblBordersNode) : null;
        const grid = context.collectDeep(tbl, "w:gridCol").map((g) => Number(g.attrs["@w:w"] ?? 0));
        const colX = [];
        let acc = 0;
        for (const w of grid) {
          colX.push(acc);
          acc += w;
        }
        const tableId = context.tableCounter++;
        const tableRows = tbl.filter((item) => "w:tr" in item);
        const rowCount = tableRows.length;
        const colCount = Math.max(1, grid.length);
        let row = 0;
        for (const tr of tbl) {
          if (!("w:tr" in tr)) continue;
          const trPr = context.first(tr["w:tr"], "w:trPr");
          const csVal = trPr ? context.findAttr(trPr, "w:cantSplit")?.["@w:val"] : void 0;
          const cantSplit = trPr ? context.first(trPr, "w:cantSplit") !== null && !["0", "false", "off"].includes(csVal ?? "") : false;
          const headerVal = trPr ? context.findAttr(trPr, "w:tblHeader")?.["@w:val"] : void 0;
          const repeatHeader = trPr ? context.first(trPr, "w:tblHeader") !== null && !["0", "false", "off"].includes(headerVal ?? "") : false;
          const rowTblJc = trPr ? context.findAttr(trPr, "w:jc")?.["@w:val"] ?? tblJc : tblJc;
          const trH = trPr ? context.findAttr(trPr, "w:trHeight") : null;
          const rowHeight = trH?.["@w:val"] != null ? Number(trH["@w:val"]) : null;
          const rowHeightRule = trH?.["@w:hRule"] ?? "auto";
          const cells = tr["w:tr"].filter((c) => "w:tc" in c);
          let col = 0;
          cells.forEach((cell, ci) => {
            const tc = cell["w:tc"];
            const span = Number(context.findAttr(context.first(tc, "w:tcPr") ?? tc, "w:gridSpan")?.["@w:val"] ?? 1);
            const colWTwips = grid.slice(col, col + span).reduce((a, b) => a + b, 0) || 0;
            const tcPr = context.first(tc, "w:tcPr");
            const rawFill = tcPr ? context.findAttr(tcPr, "w:shd")?.["@w:fill"] ?? null : null;
            const directShd = rawFill && !["auto", "FFFFFF", "ffffff", "nil"].includes(rawFill) ? rawFill.toUpperCase() : null;
            const styled = context.tableStyleRegionForCell(
              tableStyle,
              tblLook,
              row,
              rowCount,
              col,
              colCount,
              rowBandSize,
              colBandSize
            );
            const shdFill = directShd ?? styled.shdFill;
            let vMerge = null;
            if (tcPr && context.first(tcPr, "w:vMerge") !== null) {
              const mv = context.findAttr(tcPr, "w:vMerge")?.["@w:val"];
              vMerge = mv === "restart" ? "restart" : "continue";
            }
            const vAlign = tcPr ? context.findAttr(tcPr, "w:vAlign")?.["@w:val"] ?? null : null;
            const textDirection = tcPr ? context.findAttr(tcPr, "w:textDirection")?.["@w:val"] ?? null : null;
            const tcBordersNode = tcPr ? context.first(tcPr, "w:tcBorders") : null;
            const tableBordersForCell = tblBorders ? {
              top: row === 0 ? tblBorders.top : tblBorders.insideH ?? null,
              bottom: row === rowCount - 1 ? tblBorders.bottom : tblBorders.insideH ?? null,
              left: col === 0 ? tblBorders.left : tblBorders.insideV ?? null,
              right: col + Math.max(1, span) >= colCount ? tblBorders.right : tblBorders.insideV ?? null
            } : null;
            const tcBorders = tcBordersNode ? context.parseBorders(tcBordersNode) : tableBordersForCell ?? styled.borders;
            const cellMar = (side, dflt) => {
              const own = tcPr ? context.first(tcPr, "w:tcMar") : null;
              const fromOwn = own ? context.findAttr(own, `w:${side}`)?.["@w:w"] : void 0;
              if (fromOwn != null) return Number(fromOwn);
              const fromTbl = tblCellMar ? context.findAttr(tblCellMar, `w:${side}`)?.["@w:w"] : void 0;
              return fromTbl != null ? Number(fromTbl) : dflt;
            };
            const cc = {
              tableId,
              ...ctx ? {
                parentTableId: ctx.tableId,
                parentRow: ctx.row,
                parentCol: ctx.col,
                parentBlockIndex: cellBlock.value
              } : {},
              nestingDepth: depth,
              row,
              col,
              colXTwips: colX[col] ?? 0,
              colWTwips,
              gridSpan: Math.max(1, span),
              firstInCell: false,
              firstInRow: ci === 0,
              lastInRow: ci === cells.length - 1,
              shdFill,
              tblStyleId,
              totalGridTwips: acc,
              tblWVal,
              tblWType,
              tblLayout,
              cantSplit,
              repeatHeader,
              conditionalStyle: {
                sz: styled.sz,
                family: styled.family,
                jc: styled.jc,
                bidi: styled.bidi,
                look: { ...styled.look },
                spacing: { ...styled.spacing }
              },
              bidiVisual,
              tblIndTwips,
              tblJc: rowTblJc,
              vMerge,
              vAlign,
              textDirection,
              rowHeight,
              rowHeightRule,
              marTop: cellMar("top", 0),
              marBottom: cellMar("bottom", 0),
              marLeft: cellMar("left", 108),
              marRight: cellMar("right", 108),
              tcBorders
            };
            const cellParas = context.flattenBlocks(tc, cc, depth + 1);
            if (cellParas[0]?.cell) cellParas[0].cell = { ...cellParas[0].cell, firstInCell: true };
            out.push(...cellParas);
            col += span;
          });
          row++;
        }
        if (ctx) cellBlock.value++;
      }
    }
    return out;
  };
}

// outputs/active/2026-11-17-mushaf-preview/integrated-private-previews/shamela-inline-headings-review/windows/source/packages/ooxml-model/src/index_inline_drawings.ts
function createInlineDrawingParser(context) {
  return () => {
    for (const root of context.drawingRoots(context.t)) {
      for (const { node: inl } of context.collectDeep(root, "wp:inline")) {
        const ext = context.collectDeep(inl, "wp:extent")[0]?.attrs;
        const cy = ext?.["@cy"];
        if (cy != null) context.inlineImageHTwips = Math.max(context.inlineImageHTwips, Math.round(Number(cy) / 635));
        const dm = context.collectDeep(inl, "dgm:relIds")[0]?.attrs?.["@r:dm"];
        const chartRel = context.collectDeep(inl, "c:chart")[0]?.attrs?.["@r:id"];
        if (chartRel) {
          const rels2 = context.partRelsRef.get(context.partNameRef ?? "document.xml") ?? context.partRelsRef.get("document.xml");
          const target2 = rels2?.get(chartRel);
          const chartXml = target2 ? context.chartsRef.get(target2) : void 0;
          context.anchors.push({
            extentW: ext?.["@cx"] ? Math.round(Number(ext["@cx"]) / 635) : 1500,
            extentH: cy != null ? Math.round(Number(cy) / 635) : 1500,
            posHRel: "column",
            posHOffset: 0,
            posVRel: "paragraph",
            posVOffset: 0,
            posHAlign: null,
            posVAlign: null,
            behindDoc: false,
            zOrder: 0,
            distL: 0,
            distR: 0,
            distT: 0,
            distB: 0,
            wrap: "TopAndBottom",
            rId: null,
            inlineFlow: true,
            chart: chartXml ? context.parseChart(chartXml, context.theme) : {
              kind: "unsupported",
              unsupportedType: "missing-part",
              direction: "column",
              grouping: "",
              title: null,
              legend: { visible: false, position: "r" },
              showValues: false,
              categoryAxis: false,
              valueAxis: false,
              categories: [],
              series: []
            }
          });
          continue;
        }
        if (!dm) {
          const inlineWsp = context.collectDeep(inl, "wps:wsp")[0];
          if (inlineWsp) {
            const spPr = context.collectDeep(inlineWsp.node, "wps:spPr")[0]?.node ?? [];
            const geom = context.collectDeep(spPr, "a:prstGeom")[0];
            const solid = context.collectDeep(spPr, "a:solidFill")[0]?.node;
            const ln = context.collectDeep(spPr, "a:ln")[0];
            const colorOf = (host) => {
              if (!host) return null;
              const rgb = context.collectDeep(host, "a:srgbClr")[0]?.attrs?.["@val"];
              if (rgb) return rgb.toUpperCase();
              const scheme = context.collectDeep(host, "a:schemeClr")[0]?.attrs?.["@val"];
              const aliases = {
                bg1: "lt1",
                tx1: "dk1",
                bg2: "lt2",
                tx2: "dk2"
              };
              return scheme ? context.theme.get(scheme) ?? context.theme.get(aliases[scheme] ?? "") ?? null : null;
            };
            const style = context.collectDeep(inlineWsp.node, "wps:style")[0]?.node;
            const styleLine = style ? context.collectDeep(style, "a:lnRef")[0]?.node : void 0;
            const noFill = spPr.some((child) => "a:noFill" in child);
            const lnNoFill = ln ? ln.node.some((child) => "a:noFill" in child) : false;
            const strokeW = ln?.attrs?.["@w"] ? Math.max(10, Math.round(Number(ln.attrs["@w"]) / 635)) : styleLine ? 15 : 0;
            const tb = context.parseTextBox(inlineWsp.node, context.styles, context.numbering, context.theme);
            const bp = context.collectDeep(inlineWsp.node, "wps:bodyPr")[0]?.attrs ?? {};
            const ins = (k, dflt) => bp[k] != null ? Math.round(Number(bp[k]) / 635) : dflt;
            context.anchors.push({
              extentW: ext?.["@cx"] ? Math.round(Number(ext["@cx"]) / 635) : 1500,
              extentH: cy != null ? Math.round(Number(cy) / 635) : 1500,
              posHRel: "column",
              posHOffset: 0,
              posVRel: "paragraph",
              posVOffset: 0,
              posHAlign: null,
              posVAlign: null,
              behindDoc: false,
              zOrder: 0,
              distL: 0,
              distR: 0,
              distT: 0,
              distB: 0,
              wrap: "",
              rId: null,
              inlineFlow: true,
              shape: {
                prst: geom?.attrs?.["@prst"] ?? "rect",
                fill: noFill ? null : colorOf(solid),
                stroke: lnNoFill ? null : colorOf(ln?.node) ?? colorOf(styleLine) ?? (strokeW ? "000000" : null),
                strokeW,
                adj: null
              },
              ...tb ? {
                textBox: tb,
                boxAnchor: bp["@anchor"] ?? "t",
                boxIns: {
                  t: ins("@tIns", 72),
                  b: ins("@bIns", 72),
                  l: ins("@lIns", 144),
                  r: ins("@rIns", 144)
                }
              } : {}
            });
            continue;
          }
          const bl = context.collectDeep(inl, "a:blip")[0]?.attrs;
          const svg = context.collectDeep(inl, "asvg:svgBlip")[0]?.attrs;
          const docPr = context.collectDeep(inl, "wp:docPr")[0]?.attrs;
          const pictureGeom = context.collectDeep(inl, "pic:spPr")[0] ? context.collectDeep(context.collectDeep(inl, "pic:spPr")[0].node, "a:prstGeom")[0] : void 0;
          const rid = svg?.["@r:embed"] ?? svg?.["@r:link"] ?? bl?.["@r:embed"] ?? bl?.["@r:link"];
          if (rid) {
            const isr = context.collectDeep(inl, "a:srcRect")[0]?.attrs;
            const ixf = context.collectDeep(inl, "a:xfrm")[0]?.attrs;
            const iEffects = context.imageEffectsOf(inl, context.theme);
            const tru = (v) => v === "1" || v === "true";
            context.anchors.push({
              extentW: ext?.["@cx"] ? Math.round(Number(ext["@cx"]) / 635) : 1500,
              extentH: cy != null ? Math.round(Number(cy) / 635) : 1500,
              posHRel: "column",
              posHOffset: 0,
              posVRel: "paragraph",
              posVOffset: 0,
              posHAlign: null,
              posVAlign: null,
              behindDoc: false,
              zOrder: 0,
              distL: 0,
              distR: 0,
              distT: 0,
              distB: 0,
              wrap: "",
              rId: rid,
              inlineFlow: true,
              ...iEffects ? { imageEffects: iEffects } : {},
              ...context.collectDeep(inl, "a:stretch").length ? { stretch: true } : {},
              ...ixf?.["@rot"] ? { rotDeg: Number(ixf["@rot"]) / 6e4 } : {},
              ...tru(ixf?.["@flipH"]) ? { flipH: true } : {},
              ...tru(ixf?.["@flipV"]) ? { flipV: true } : {},
              ...isr && (isr["@l"] || isr["@t"] || isr["@r"] || isr["@b"]) ? { srcRect: {
                l: Number(isr["@l"] ?? 0) / 1e5,
                t: Number(isr["@t"] ?? 0) / 1e5,
                r: Number(isr["@r"] ?? 0) / 1e5,
                b: Number(isr["@b"] ?? 0) / 1e5
              } } : {},
              ...docPr?.["@descr"] ? { alt: docPr["@descr"] } : {},
              ...docPr?.["@title"] || docPr?.["@name"] ? { title: docPr["@title"] ?? docPr["@name"] } : {},
              ...pictureGeom ? { shape: {
                prst: pictureGeom.attrs["@prst"] ?? "rect",
                fill: null,
                stroke: null,
                strokeW: 0,
                adj: null
              } } : {}
            });
          }
          continue;
        }
        const rels = context.partRelsRef.get(context.partNameRef ?? "document.xml") ?? context.partRelsRef.get("document.xml");
        const target = rels?.get(dm);
        if (!target) continue;
        const drawXml = context.diagramsRef.get(target.replace(/data(\d+)\.xml$/, "drawing$1.xml"));
        if (!drawXml) continue;
        const shapes = context.parseDiagramDrawing(drawXml, context.theme, 1);
        if (!shapes.length) continue;
        context.anchors.push({
          extentW: ext?.["@cx"] ? Math.round(Number(ext["@cx"]) / 635) : 0,
          extentH: cy != null ? Math.round(Number(cy) / 635) : 0,
          posHRel: "column",
          posHOffset: 0,
          posVRel: "paragraph",
          posVOffset: 0,
          posHAlign: null,
          posVAlign: null,
          behindDoc: false,
          zOrder: 0,
          distL: 0,
          distR: 0,
          distT: 0,
          distB: 0,
          wrap: "TopAndBottom",
          rId: null,
          diagram: shapes,
          inlineFlow: true
        });
      }
    }
  };
}

// outputs/active/2026-11-17-mushaf-preview/integrated-private-previews/shamela-inline-headings-review/windows/source/packages/ooxml-model/src/word_inline_source_positions.ts
var WordInlineSourcePositions = class extends WeakMap {
  set(anchor, offset) {
    if (!Number.isSafeInteger(offset) || offset < 0) throw Error("word_inline_source_offset");
    anchor.nativeInlineSourceOffset = offset;
    return super.set(anchor, offset);
  }
  get(anchor) {
    const offset = super.get(anchor) ?? anchor?.nativeInlineSourceOffset;
    return Number.isSafeInteger(offset) && offset >= 0 ? offset : void 0;
  }
  has(anchor) {
    return this.get(anchor) !== void 0;
  }
  delete(anchor) {
    const found = this.has(anchor);
    if (anchor) delete anchor.nativeInlineSourceOffset;
    super.delete(anchor);
    return found;
  }
};
var wordInlineSourcePositions = new WordInlineSourcePositions();

// outputs/active/2026-11-17-mushaf-preview/integrated-private-previews/shamela-inline-headings-review/windows/source/packages/ooxml-model/src/index_anchor_drawings.ts
function createAnchorDrawingParser(context) {
  return () => {
    for (const root of context.drawingRoots(context.t)) {
      const EMU = 635;
      for (const { node: anc, attrs: a } of context.collectDeep(root, "wp:anchor")) {
        const ext = context.collectDeep(anc, "wp:extent").map((e) => e.attrs).find((at) => at?.["@cx"] != null && at?.["@cy"] != null);
        const posH = context.collectDeep(anc, "wp:positionH")[0];
        const posV = context.collectDeep(anc, "wp:positionV")[0];
        const alignOf = (w) => {
          if (!w) return null;
          const al = context.collectDeep(w.node, "wp:align")[0];
          const txt = al?.node.find((n) => "#text" in n)?.["#text"];
          return txt != null ? String(txt).trim() : null;
        };
        const off = (w) => {
          if (!w) return 0;
          const o = context.collectDeep(w.node, "wp:posOffset")[0];
          const txt = o?.node.find((n) => "#text" in n)?.["#text"];
          return txt != null ? Math.round(Number(txt) / EMU) : 0;
        };
        const wrap = [
          "wp:wrapSquare",
          "wp:wrapTight",
          "wp:wrapThrough",
          "wp:wrapTopAndBottom",
          "wp:wrapNone"
        ].find((n) => context.collectDeep(anc, n).length > 0) ?? "";
        const wrapNode = wrap ? context.collectDeep(anc, wrap)[0] : void 0;
        const wrapText = wrapNode?.attrs?.["@wrapText"];
        const docPr = context.collectDeep(anc, "wp:docPr")[0]?.attrs;
        const aEffects = context.imageEffectsOf(anc, context.theme);
        const ownsTextBox = context.collectDeep(anc, "wps:txbx").length > 0 || context.collectDeep(anc, "v:textbox").length > 0;
        const textOf = (nodes) => nodes.find((n) => "#text" in n)?.["#text"];
        const sizeH = context.collectDeep(anc, "wp14:sizeRelH")[0];
        const sizeV = context.collectDeep(anc, "wp14:sizeRelV")[0];
        const pctH = sizeH ? textOf(context.collectDeep(sizeH.node, "wp14:pctWidth")[0]?.node ?? []) : null;
        const pctV = sizeV ? textOf(context.collectDeep(sizeV.node, "wp14:pctHeight")[0]?.node ?? []) : null;
        const polygonHost = context.collectDeep(anc, "wp:wrapPolygon")[0];
        const polygon = polygonHost ? [context.collectDeep(polygonHost.node, "wp:start")[0], ...context.collectDeep(polygonHost.node, "wp:lineTo")].filter(Boolean).map((point) => ({ x: Number(point.attrs["@x"] ?? 0), y: Number(point.attrs["@y"] ?? 0) })) : [];
        context.anchors.push({
          extentW: ext ? Math.round(Number(ext["@cx"]) / EMU) : 1500,
          extentH: ext ? Math.round(Number(ext["@cy"]) / EMU) : 1500,
          posHRel: posH?.attrs["@relativeFrom"] ?? "column",
          posHOffset: off(posH),
          posVRel: posV?.attrs["@relativeFrom"] ?? "paragraph",
          posVOffset: off(posV),
          posHAlign: alignOf(posH),
          posVAlign: alignOf(posV),
          behindDoc: a["@behindDoc"] === "1",
          zOrder: Number(a["@relativeHeight"] ?? 0),
          distL: Math.round(Number(a["@distL"] ?? 0) / EMU),
          distR: Math.round(Number(a["@distR"] ?? 0) / EMU),
          distT: Math.round(Number(a["@distT"] ?? 0) / EMU),
          distB: Math.round(Number(a["@distB"] ?? 0) / EMU),
          wrap: wrap.replace("wp:wrap", ""),
          ...["left", "right", "bothSides", "largest"].includes(wrapText ?? "") ? { wrapSide: wrapText } : {},
          rId: ownsTextBox ? null : context.collectDeep(anc, "asvg:svgBlip")[0]?.attrs?.["@r:embed"] ?? context.collectDeep(anc, "asvg:svgBlip")[0]?.attrs?.["@r:link"] ?? context.collectDeep(anc, "a:blip")[0]?.attrs?.["@r:embed"] ?? context.collectDeep(anc, "a:blip")[0]?.attrs?.["@r:link"] ?? null,
          ...aEffects ? { imageEffects: aEffects } : {},
          ...context.relativeSize(sizeH?.attrs["@relativeFrom"], pctH) != null ? { relWidth: context.relativeSize(sizeH?.attrs["@relativeFrom"], pctH) } : {},
          ...context.relativeSize(sizeV?.attrs["@relativeFrom"], pctV) != null ? { relHeight: context.relativeSize(sizeV?.attrs["@relativeFrom"], pctV) } : {},
          allowOverlap: !["0", "false"].includes(a["@allowOverlap"] ?? "1"),
          layoutInCell: !["0", "false"].includes(a["@layoutInCell"] ?? "1"),
          ...polygon.length >= 3 ? { wrapPolygon: polygon } : {},
          ...docPr?.["@descr"] ? { alt: docPr["@descr"] } : {},
          ...docPr?.["@title"] || docPr?.["@name"] ? { title: docPr["@title"] ?? docPr["@name"] } : {},
          ...(() => {
            const chartRel = context.collectDeep(anc, "c:chart")[0]?.attrs?.["@r:id"];
            if (!chartRel) return {};
            const rels = context.partRelsRef.get(context.partNameRef ?? "document.xml") ?? context.partRelsRef.get("document.xml");
            const target = rels?.get(chartRel);
            const xml = target ? context.chartsRef.get(target) : void 0;
            return xml ? { chart: context.parseChart(xml, context.theme) } : {};
          })(),
          ...(() => {
            const dm = context.collectDeep(anc, "dgm:relIds")[0]?.attrs?.["@r:dm"];
            if (!dm) return {};
            const rels = context.partRelsRef.get(context.partNameRef ?? "document.xml") ?? context.partRelsRef.get("document.xml");
            const dataTarget = rels?.get(dm);
            if (!dataTarget) return {};
            const drawName = dataTarget.replace(/data(\d+)\.xml$/, "drawing$1.xml");
            const drawXml = context.diagramsRef.get(drawName);
            if (!drawXml) return {};
            const shapes = context.parseDiagramDrawing(drawXml, context.theme, 1);
            return shapes.length ? { diagram: shapes } : {};
          })(),
          ...(() => {
            const grp = context.collectDeep(anc, "a:grpSp")[0]?.node ?? context.collectDeep(anc, "wpg:wgp")[0]?.node;
            if (!grp) return {};
            const gx = context.collectDeep(grp, "a:xfrm")[0]?.node ?? [];
            const num = (n, tag, at) => Number(context.collectDeep(n ?? [], tag)[0]?.attrs?.[at] ?? 0);
            const chOffX = num(gx, "a:chOff", "@x"), chOffY = num(gx, "a:chOff", "@y");
            const chExtX = num(gx, "a:chExt", "@cx") || 1, chExtY = num(gx, "a:chExt", "@cy") || 1;
            const extX = num(gx, "a:ext", "@cx"), extY = num(gx, "a:ext", "@cy");
            const sx = extX ? extX / chExtX : 1, sy = extY ? extY / chExtY : 1;
            const kids = [];
            for (const sp of [...context.collectDeep(grp, "pic:pic"), ...context.collectDeep(grp, "wps:wsp")]) {
              const kx = context.collectDeep(sp.node, "a:xfrm")[0]?.node ?? [];
              const spPr = context.collectDeep(sp.node, "wps:spPr")[0]?.node ?? context.collectDeep(sp.node, "pic:spPr")[0]?.node ?? sp.node;
              const colorIn = (host) => {
                if (!host) return null;
                const rgb = context.collectDeep(host, "a:srgbClr")[0]?.attrs?.["@val"];
                if (rgb) return rgb.toUpperCase();
                const scheme = context.collectDeep(host, "a:schemeClr")[0]?.attrs?.["@val"];
                return scheme ? context.theme.get(scheme) ?? null : null;
              };
              const fillNode = context.collectDeep(spPr, "a:solidFill")[0]?.node;
              const line = context.collectDeep(spPr, "a:ln")[0];
              const geom = context.collectDeep(spPr, "a:prstGeom")[0];
              const text = context.collectDeep(sp.node, "a:t").map((item) => String(item.node.find((n) => "#text" in n)?.["#text"] ?? "")).join("").trim();
              kids.push({
                x: Math.round((num(kx, "a:off", "@x") - chOffX) * sx / EMU),
                y: Math.round((num(kx, "a:off", "@y") - chOffY) * sy / EMU),
                w: Math.round(num(kx, "a:ext", "@cx") * sx / EMU),
                h: Math.round(num(kx, "a:ext", "@cy") * sy / EMU),
                rId: context.collectDeep(sp.node, "asvg:svgBlip")[0]?.attrs?.["@r:embed"] ?? context.collectDeep(sp.node, "a:blip")[0]?.attrs?.["@r:embed"] ?? null,
                ...geom ? { shape: {
                  prst: geom.attrs["@prst"] ?? "rect",
                  fill: context.collectDeep(spPr, "a:noFill").length ? null : colorIn(fillNode),
                  stroke: line && !context.collectDeep(line.node, "a:noFill").length ? colorIn(line.node) : null,
                  strokeW: line ? Math.round(Number(line.attrs["@w"] ?? 0) / EMU) : 0,
                  adj: null
                } } : {},
                ...text ? { text } : {},
                ...(() => {
                  const xa = (() => {
                    for (const n of sp.node) {
                      const found = context.collectDeep([n], "a:xfrm")[0];
                      if (found) return found.attrs;
                    }
                    return {};
                  })();
                  const csr = context.collectDeep(sp.node, "a:srcRect")[0]?.attrs;
                  const tru = (v) => v === "1" || v === "true";
                  const o = {};
                  if (xa["@rot"]) o["rotDeg"] = Number(xa["@rot"]) / 6e4;
                  if (tru(xa["@flipH"])) o["flipH"] = true;
                  if (tru(xa["@flipV"])) o["flipV"] = true;
                  if (csr && (csr["@l"] || csr["@t"] || csr["@r"] || csr["@b"])) {
                    o["srcRect"] = {
                      l: Number(csr["@l"] ?? 0) / 1e5,
                      t: Number(csr["@t"] ?? 0) / 1e5,
                      r: Number(csr["@r"] ?? 0) / 1e5,
                      b: Number(csr["@b"] ?? 0) / 1e5
                    };
                  }
                  return o;
                })()
              });
            }
            return kids.length ? { groupChildren: kids } : {};
          })(),
          ...(() => {
            const geom = context.collectDeep(anc, "a:prstGeom")[0];
            const vml = context.collectDeep(anc, "v:shape")[0] ?? context.collectDeep(anc, "v:rect")[0] ?? context.collectDeep(anc, "v:line")[0] ?? context.collectDeep(anc, "v:roundrect")[0] ?? context.collectDeep(anc, "v:oval")[0];
            if (!geom && !vml) return {};
            const spPr = context.collectDeep(anc, "wps:spPr")[0]?.node ?? context.collectDeep(anc, "pic:spPr")[0]?.node ?? anc;
            const directChild = (parent, nm) => {
              for (const n of parent) if (nm in n) return n[nm];
              return void 0;
            };
            const solid = directChild(spPr, "a:solidFill");
            const gradFill = directChild(spPr, "a:gradFill");
            const blipFill = directChild(spPr, "a:blipFill");
            const clrOf = (node) => {
              if (!node) return null;
              const srgb = context.collectDeep(node, "a:srgbClr")[0]?.attrs?.["@val"];
              if (srgb) return srgb.toUpperCase();
              const sch = context.collectDeep(node, "a:schemeClr")[0]?.attrs?.["@val"];
              const SCH_ALIAS = {
                bg1: "lt1",
                tx1: "dk1",
                bg2: "lt2",
                tx2: "dk2"
              };
              if (sch) return context.theme.get(sch) ?? context.theme.get(SCH_ALIAS[sch] ?? "") ?? null;
              return null;
            };
            const hasNoFill = directChild(spPr, "a:noFill") !== void 0 && !solid && !gradFill;
            const wspStyle = context.collectDeep(anc, "wps:style")[0]?.node;
            const styleFillRef = wspStyle ? context.collectDeep(wspStyle, "a:fillRef")[0] : void 0;
            const styleFill = styleFillRef?.node;
            const styleLine = wspStyle ? context.collectDeep(wspStyle, "a:lnRef")[0]?.node : void 0;
            const lnRaw = directChild(spPr, "a:ln");
            const lnNode = lnRaw ? { node: lnRaw, attrs: (() => {
              for (const n of spPr) if ("a:ln" in n) return n[":@"] ?? {};
              return {};
            })() } : void 0;
            const lnNoFill = lnRaw ? directChild(lnRaw, "a:noFill") !== void 0 : false;
            const strokeW = lnNode?.attrs?.["@w"] ? Math.max(10, Math.round(Number(lnNode.attrs["@w"]) / EMU)) : 0;
            const adjVal = context.collectDeep(geom?.node ?? [], "a:gd")[0]?.attrs?.["@fmla"];
            const adj = adjVal ? Number(String(adjVal).replace(/[^0-9.-]/g, "")) / 1e5 : null;
            const directGradient = hasNoFill ? void 0 : context.drawingGradient(gradFill, context.theme);
            const fill = hasNoFill ? null : clrOf(solid) ?? directGradient?.stops[0]?.color ?? clrOf(styleFill);
            const gradient = directGradient ?? (hasNoFill ? void 0 : context.themeGradient(context.theme, styleFillRef?.attrs?.["@idx"], clrOf(styleFill)));
            const fillBlip = blipFill ? context.collectDeep(blipFill, "a:blip")[0] : void 0;
            const fillRid = fillBlip?.attrs?.["@r:embed"] ?? fillBlip?.attrs?.["@r:link"];
            const fillCrop = blipFill ? context.collectDeep(blipFill, "a:srcRect")[0]?.attrs : void 0;
            const shapeFill = fillRid ? {
              rId: fillRid,
              mode: blipFill && context.collectDeep(blipFill, "a:tile").length ? "tile" : "stretch",
              ...fillCrop ? { srcRect: {
                l: Number(fillCrop["@l"] ?? 0) / 1e5,
                t: Number(fillCrop["@t"] ?? 0) / 1e5,
                r: Number(fillCrop["@r"] ?? 0) / 1e5,
                b: Number(fillCrop["@b"] ?? 0) / 1e5
              } } : {}
            } : void 0;
            return { shape: {
              prst: geom?.attrs?.["@prst"] ?? (vml ? "rect" : "rect"),
              fill,
              stroke: lnNoFill ? null : clrOf(lnNode?.node) ?? clrOf(styleLine) ?? (strokeW ? "000000" : null),
              strokeW: strokeW || (lnNode ? 12 : styleLine ? 15 : 0),
              adj,
              ...gradient ? { gradient } : {}
            }, ...shapeFill ? { shapeFill } : {} };
          })(),
          ...(() => {
            const sr = context.collectDeep(anc, "a:srcRect")[0]?.attrs;
            const xf = context.collectDeep(anc, "a:xfrm")[0]?.attrs;
            const o = {};
            if (sr && (sr["@l"] || sr["@t"] || sr["@r"] || sr["@b"])) {
              o["srcRect"] = {
                l: Number(sr["@l"] ?? 0) / 1e5,
                t: Number(sr["@t"] ?? 0) / 1e5,
                r: Number(sr["@r"] ?? 0) / 1e5,
                b: Number(sr["@b"] ?? 0) / 1e5
              };
            }
            const rotHost = xf?.["@rot"] ? xf : context.collectDeep(anc, "a:off").length ? void 0 : void 0;
            void rotHost;
            if (xf?.["@rot"]) o["rotDeg"] = Number(xf["@rot"]) / 6e4;
            const truthy = (v) => v === "1" || v === "true";
            if (truthy(xf?.["@flipH"])) o["flipH"] = true;
            if (truthy(xf?.["@flipV"])) o["flipV"] = true;
            if (context.collectDeep(anc, "a:stretch").length) o["stretch"] = true;
            return o;
          })(),
          ...(() => {
            const tb = context.parseTextBox(anc, context.styles, context.numbering, context.theme);
            if (!tb) return {};
            const bodyPr = context.collectDeep(anc, "wps:bodyPr")[0];
            const bp = bodyPr?.attrs ?? {};
            const ins = (k, dflt) => bp[k] != null ? Math.round(Number(bp[k]) / EMU) : dflt;
            return {
              textBox: tb,
              boxAnchor: bp["@anchor"] ?? "t",
              ...bodyPr && context.collectDeep(bodyPr.node, "a:noAutofit").length ? { boxNoAutofit: true } : {},
              boxIns: {
                t: ins("@tIns", 72),
                b: ins("@bIns", 72),
                l: ins("@lIns", 144),
                r: ins("@rIns", 144)
              }
            };
          })()
        });
      }
    }
  };
}

// outputs/active/2026-11-17-mushaf-preview/integrated-private-previews/shamela-inline-headings-review/windows/source/packages/ooxml-model/src/index_runs.ts
var retainedLatinFont = (props) => props.latinFamily;
var csSlot = (props) => props ?? {};
function createRunParser(context) {
  return () => {
    for (let ri = 0; ri < context.runNodes.length; ri++) {
      const rNode = context.runNodes[ri];
      const math = rNode["__math"] ?? null;
      const currentHref = context.hyperlinkRids[ri] ? context.rels?.get(context.hyperlinkRids[ri]) ?? context.hyperlinkRids[ri] : null;
      const r = rNode["w:r"];
      const rpr = context.first(r, "w:rPr");
      const own = context.rPrProps(rpr, context.theme);
      const runStyleId = rpr ? context.findAttr(rpr, "w:rStyle")?.["@w:val"] ?? null : null;
      const runStyle = context.resolveViaStyle(context.styles, runStyleId, true, false);
      const hidden = rpr?.some((node) => "w:vanish" in node) === true && !/^(?:0|false|off)$/i.test(context.findAttr(rpr, "w:vanish")?.["@w:val"] ?? "");
      let text = "";
      const sourceSymbols = [];
      const styleRefSymbolOffsets = [];
      const carriageReturnOffsets = [];
      let symFont = null;
      let noteRef = null;
      let noteBodyRef = null;
      let customMarkStart = null;
      for (const t of r) {
        if ("w:t" in t) {
          const parts = t["w:t"];
          for (const seg of parts) if ("#text" in seg) text += String(seg["#text"]);
          if (text.trim() && !hidden) {
            context.sawText = true;
            context.lastPageBreakKind = null;
          }
        }
        if ("w:cr" in t) {
          carriageReturnOffsets.push(text.length);
          text += "\n";
        }
        if ("w:br" in t) {
          const brType = t[":@"]?.["@w:type"];
          if (brType === "page") {
            if (context.sawText) context.trailingPageBreaks++;
            else context.recordLeadingPageBreak();
            context.lastPageBreakKind = "explicit";
          } else if (brType === "column") {
            context.columnBreak = true;
            context.columnBreakPositions.push(context.paraTextLen + text.length);
            text += "\n";
          } else text += "\n";
        }
        if ("w:lastRenderedPageBreak" in t) {
          if (context.lastPageBreakKind !== "explicit") {
            if (context.sawText) context.trailingPageBreaks++;
            else context.recordLeadingPageBreak();
          }
          context.lastPageBreakKind = "rendered";
        }
        if ("w:noBreakHyphen" in t) {
          text += "\u2011";
          if (!hidden) {
            context.sawText = true;
            context.lastPageBreakKind = null;
          }
        }
        if ("w:softHyphen" in t) {
          sourceSymbols.push({ at: text.length, raw: "" });
          text += "\xAD";
        }
        if ("w:sym" in t) {
          const a = t[":@"] ?? {};
          const ch = context.resolveSymChar(a["@w:font"], a["@w:char"]);
          if (ch) {
            const raw = context.sourceSymChar(a["@w:font"], a["@w:char"]);
            if (raw) sourceSymbols.push({ at: text.length, raw });
            styleRefSymbolOffsets.push({ at: text.length, length: ch.length });
            text += ch;
            symFont = a["@w:font"] ?? null;
            if (!hidden) {
              context.sawText = true;
              context.lastPageBreakKind = null;
            }
          }
        }
        if ("w:footnoteReference" in t || "w:endnoteReference" in t) {
          const a = t[":@"] ?? {};
          const isEnd = "w:endnoteReference" in t;
          const refId = a["@w:id"] ?? null;
          const custom = ["1", "true"].includes(a["@w:customMarkFollows"] ?? "");
          const seq = isEnd ? context.endnoteSeq : context.footnoteSeq;
          const num = custom ? seq.n : ++seq.n;
          noteRef = { id: refId, num, kind: isEnd ? "endnote" : "footnote", custom };
          if (custom) customMarkStart = text.length;
          else {
            text += String(num);
            if (!hidden) {
              context.sawText = true;
              context.lastPageBreakKind = null;
            }
          }
        }
        if ("w:footnoteRef" in t) noteBodyRef = "footnote";
        if ("w:endnoteRef" in t) noteBodyRef = "endnote";
        if ("w:tab" in t) {
          context.tabTextPositions.push(context.paraTextLen + text.length);
          text += "	";
        }
        if ("w:ptab" in t) {
          const a = t[":@"] ?? {};
          context.ptabPositions.push({
            at: context.paraTextLen + text.length,
            relativeTo: a["@w:relativeTo"] ?? "margin",
            alignment: a["@w:alignment"] ?? "left",
            leader: a["@w:leader"] && a["@w:leader"] !== "none" ? a["@w:leader"] : null
          });
          text += "	";
        }
        if ("w:drawing" in t || "w:pict" in t || "mc:AlternateContent" in t || "w:object" in t) context.hasDrawing = true;
        const sourceAnchorCount = context.anchors.length;
        if ("w:drawing" in t || "w:pict" in t || "mc:AlternateContent" in t) createInlineDrawingParser({
          get drawingRoots() {
            return context.drawingRoots;
          },
          get t() {
            return t;
          },
          get collectDeep() {
            return context.collectDeep;
          },
          get inlineImageHTwips() {
            return context.inlineImageHTwips;
          },
          set inlineImageHTwips(value) {
            context.inlineImageHTwips = value;
          },
          get partRelsRef() {
            return context.partRelsRef;
          },
          get partNameRef() {
            return context.partNameRef;
          },
          get chartsRef() {
            return context.chartsRef;
          },
          get anchors() {
            return context.anchors;
          },
          get parseChart() {
            return context.parseChart;
          },
          get theme() {
            return context.theme;
          },
          get parseTextBox() {
            return context.parseTextBox;
          },
          get styles() {
            return context.styles;
          },
          get numbering() {
            return context.numbering;
          },
          get imageEffectsOf() {
            return context.imageEffectsOf;
          },
          get diagramsRef() {
            return context.diagramsRef;
          },
          get parseDiagramDrawing() {
            return context.parseDiagramDrawing;
          }
        })();
        if ("w:pict" in t) {
          for (const va of context.parseVmlShapes(t["w:pict"], context.styles, context.numbering, context.theme)) {
            context.anchors.push(va);
          }
        }
        if ("w:drawing" in t || "w:pict" in t || "mc:AlternateContent" in t) createAnchorDrawingParser({
          get drawingRoots() {
            return context.drawingRoots;
          },
          get t() {
            return t;
          },
          get collectDeep() {
            return context.collectDeep;
          },
          get imageEffectsOf() {
            return context.imageEffectsOf;
          },
          get theme() {
            return context.theme;
          },
          get anchors() {
            return context.anchors;
          },
          get relativeSize() {
            return context.relativeSize;
          },
          get partRelsRef() {
            return context.partRelsRef;
          },
          get partNameRef() {
            return context.partNameRef;
          },
          get chartsRef() {
            return context.chartsRef;
          },
          get parseChart() {
            return context.parseChart;
          },
          get diagramsRef() {
            return context.diagramsRef;
          },
          get parseDiagramDrawing() {
            return context.parseDiagramDrawing;
          },
          get drawingGradient() {
            return context.drawingGradient;
          },
          get themeGradient() {
            return context.themeGradient;
          },
          get parseTextBox() {
            return context.parseTextBox;
          },
          get styles() {
            return context.styles;
          },
          get numbering() {
            return context.numbering;
          }
        })();
        for (const anchor of context.anchors.slice(sourceAnchorCount)) {
          if (!hidden) anchor.nativeDrawingSourceOffset = context.paraTextLen + text.length;
          if (anchor.inlineFlow && !hidden) {
            const rtl2 = rpr && context.first(rpr, "w:rtl") !== null;
            const value = rtl2 ? context.findAttr(rpr, "w:rtl")?.["@w:val"] : void 0;
            anchor.nativeInlineRunDirection = rtl2 && !["0", "false", "off"].includes(value ?? "") ? "rtl" : "ltr";
          }
          if (anchor.inlineFlow && !hidden)
            wordInlineSourcePositions.set(anchor, context.paraTextLen + text.length);
        }
        if ("w:fldChar" in t) {
          const ft = t[":@"]?.["@w:fldCharType"];
          if (ft === "begin") {
            context.fldDepth++;
            context.fldKind = null;
            context.fldInstruction = "";
            context.fldInResult = false;
            context.fldResultMarked = false;
          } else if (ft === "separate") {
            context.fldKind = context.pageFieldKind(context.fldInstruction) ?? context.styleRefField(context.fldInstruction, context.styles);
            context.fldInResult = true;
            context.fldResultMarked = false;
          } else if (ft === "end") {
            context.fldDepth = Math.max(0, context.fldDepth - 1);
            context.fldInResult = false;
            if (!context.fldDepth) {
              context.fldKind = null;
              context.fldInstruction = "";
            }
          }
          context.excluded = context.excluded || "field";
        }
        if ("w:instrText" in t) {
          const parts = t["w:instrText"];
          let instr = "";
          for (const seg of parts) if ("#text" in seg) instr += String(seg["#text"]);
          context.fldInstruction += instr;
          context.excluded = context.excluded || "field";
        }
      }
      if (noteRef?.custom && customMarkStart != null) {
        noteRef.customMark = text.slice(customMarkStart);
        if (noteRef.customMark && !hidden) {
          context.sawText = true;
          context.lastPageBreakKind = null;
        }
      }
      if (!hidden) context.paraTextLen += text.length;
      if (!text && !noteBodyRef) continue;
      const vAlign = rpr ? context.findAttr(rpr, "w:vertAlign")?.["@w:val"] ?? null : null;
      const toggleOn = (nm) => {
        if (!rpr || context.first(rpr, nm) === null) return null;
        const v = context.findAttr(rpr, nm)?.["@w:val"];
        return !["0", "false", "off"].includes(v ?? "");
      };
      const rtl = toggleOn("w:rtl");
      const ltr = toggleOn("w:ltr");
      const direction = rtl !== null ? rtl ? "rtl" : "ltr" : ltr !== null ? ltr ? "ltr" : "rtl" : null;
      const look = {
        ...context.styleProps.look,
        ...context.conditionalStyle?.look,
        ...runStyle.look,
        ...context.rPrLook(context.pPrRPrNode, context.theme),
        ...context.rPrLook(rpr, context.theme)
      };
      const nativeRunLook = { ...context.styleProps.look, ...context.conditionalStyle?.look, ...runStyle.look, ...context.rPrLook(rpr, context.theme) };
      const effectiveEmTwips = (own.sz ?? context.pPrRPr.sz ?? runStyle.sz ?? context.conditionalStyle?.sz ?? context.styleProps.sz) != null ? (own.sz ?? context.pPrRPr.sz ?? runStyle.sz ?? context.conditionalStyle?.sz ?? context.styleProps.sz) * 10 : null;
      const { legacyShadow, superscript: styledSuperscript, subscript: styledSubscript, ...resolvedLook } = look;
      if (legacyShadow && resolvedLook.textShadow == null && effectiveEmTwips != null) {
        const offset = effectiveEmTwips / 24;
        resolvedLook.textShadow = {
          xTwips: offset,
          yTwips: offset,
          blurTwips: 0,
          color: "C0C0C0",
          opacity: 1
        };
      }
      const directBold = toggleOn("w:b") ?? toggleOn("w:bCs");
      const dynamicField = context.simpleFieldKinds[ri] ?? (context.fldInResult && context.fldKind ? context.fldResultMarked ? "" : context.fldKind : null);
      if (dynamicField) context.fldResultMarked = true;
      let sourceText = text;
      let nativeStyleRefText = text;
      for (const symbol of [...sourceSymbols].reverse())
        sourceText = sourceText.slice(0, symbol.at) + symbol.raw + sourceText.slice(symbol.at + 1);
      for (const symbol of [...styleRefSymbolOffsets].reverse())
        nativeStyleRefText = nativeStyleRefText.slice(0, symbol.at) + nativeStyleRefText.slice(symbol.at + symbol.length);
      context.runs.push({
        text,
        ...(own.sz ?? runStyle.sz ?? context.conditionalStyle?.sz ?? context.styleProps.sz) != null ? { nativeWordRunSizeTwips: (own.sz ?? runStyle.sz ?? context.conditionalStyle?.sz ?? context.styleProps.sz) * 10 } : {},
        ...styleRefSymbolOffsets.length ? { nativeStyleRefText } : {},
        ...styleRefSymbolOffsets.length ? { nativeWordSymbolOffsets: styleRefSymbolOffsets.map((o) => ({ ...o })) } : {},
        ...carriageReturnOffsets.length ? { nativeWordCarriageReturnOffsets: [...carriageReturnOffsets] } : {},
        ...sourceText !== text ? { sourceText } : {},
        ...math ? { math } : {},
        direction,
        ...resolvedLook,
        fieldResult: dynamicField,
        noteRef,
        noteBodyRef,
        href: currentHref ?? null,
        ...currentHref && runStyle.look.color && (runStyleId?.toLowerCase() === "hyperlink" || [...context.styles.nameToId].some(([name, id]) => id === runStyleId && name.toLowerCase() === "hyperlink")) && !rpr?.some((n) => "w:color" in n) ? { inheritedHyperlinkColor: true, hyperlinkPrintColor: { ...context.styleProps.look, ...context.conditionalStyle?.look }.color ?? null } : {},
        inheritedHyperlinkUnderline: Boolean(currentHref && runStyle.look.underline && (runStyleId?.toLowerCase() === "hyperlink" || [...context.styles.nameToId].some(([name, id]) => id === runStyleId && name.toLowerCase() === "hyperlink")) && !rpr?.some((n) => "w:u" in n) && !context.pPrRPrNode?.some((n) => "w:u" in n) && !context.styleProps.look.underline),
        superscript: vAlign ? vAlign === "superscript" : styledSuperscript ?? false,
        subscript: vAlign ? vAlign === "subscript" : styledSubscript ?? false,
        bold: directBold ?? resolvedLook.bold ?? false,
        nativeWordRunBold: direction === "rtl" || toggleOn("w:cs") === true ? toggleOn("w:bCs") ?? nativeRunLook[nativeCsBold] ?? false : directBold ?? nativeRunLook.bold ?? false,
        nativeWordRunItalic: direction === "rtl" || toggleOn("w:cs") === true ? toggleOn("w:iCs") ?? nativeRunLook[nativeCsItalic] ?? false : toggleOn("w:i") ?? toggleOn("w:iCs") ?? nativeRunLook.italic ?? false,
        family: symFont ?? own.family ?? context.pPrRPr.family ?? runStyle.family ?? context.conditionalStyle?.family ?? context.styleProps.family,
        nativeLatinFamily: symFont ?? retainedLatinFont(own) ?? retainedLatinFont(context.pPrRPr) ?? retainedLatinFont(runStyle) ?? retainedLatinFont(context.styleProps),
        nativeCsFamily: symFont ? void 0 : csSlot(own).csFamily ?? csSlot(runStyle).csFamily ?? csSlot(context.conditionalStyle).csFamily ?? csSlot(context.styleProps).csFamily,
        nativeCsSizeTwips: symFont ? void 0 : (csSlot(own).csSz ?? csSlot(runStyle).csSz ?? csSlot(context.conditionalStyle).csSz ?? csSlot(context.styleProps).csSz) != null ? (csSlot(own).csSz ?? csSlot(runStyle).csSz ?? csSlot(context.conditionalStyle).csSz ?? csSlot(context.styleProps).csSz) * 10 : void 0,
        emTwips: effectiveEmTwips,
        hidden
      });
    }
  };
}

// outputs/active/2026-11-17-mushaf-preview/integrated-private-previews/shamela-inline-headings-review/windows/source/packages/ooxml-model/src/index_paragraphs.ts
function createParagraphParser(context) {
  const levelLinks = /* @__PURE__ */ new Map();
  for (const [key, props] of context.numbering) if (props.paragraphStyleId) {
    const [num, level] = key.split("/");
    const link = `${num}/${props.paragraphStyleId}`;
    if (!levelLinks.has(link)) levelLinks.set(link, level);
  }
  return () => {
    for (const child of context.flattenBlocks(context.body)) {
      const tableCell = child.cell;
      const p = child.node["w:p"];
      context.idx++;
      const pPr = context.first(p, "w:pPr");
      const styleId = pPr ? context.findAttr(pPr, "w:pStyle")?.["@w:val"] ?? null : null;
      const styleProps = context.resolveViaStyle(context.styles, styleId ?? context.styles.defaultParagraphStyleId);
      const conditionalStyle = tableCell?.conditionalStyle;
      const bidi = context.pPrFlag(pPr, "w:bidi") ?? conditionalStyle?.bidi ?? styleProps.bidi ?? false;
      const directJc = pPr ? context.findAttr(pPr, "w:jc")?.["@w:val"] : void 0;
      const jc = directJc ?? conditionalStyle?.jc ?? styleProps.jc;
      const numPr = pPr ? context.first(pPr, "w:numPr") : null;
      const numId = (numPr ? context.findAttr(numPr, "w:numId")?.["@w:val"] : null) ?? styleProps.numId ?? null;
      const directLevel = numPr ? context.findAttr(numPr, "w:ilvl")?.["@w:val"] : null;
      const linkedStyles = /* @__PURE__ */ new Set();
      let linkedStyle = styleId ?? context.styles.defaultParagraphStyleId;
      while (linkedStyle && !linkedStyles.has(linkedStyle) && linkedStyles.size < 12) {
        linkedStyles.add(linkedStyle);
        linkedStyle = context.styles.byId.get(linkedStyle)?.basedOn ?? null;
      }
      let linkedLevel;
      for (const candidateStyle of linkedStyles) {
        linkedLevel = levelLinks.get(`${numId}/${candidateStyle}`);
        if (linkedLevel != null) break;
      }
      const ilvl = directLevel ?? linkedLevel ?? styleProps.ilvl ?? "0";
      const numbered = numId != null && numId !== "0";
      const numProps = numbered ? context.numbering.get(`${numId}/${ilvl}`) ?? null : null;
      const own = context.indProps(pPr);
      const indLeft = own.indLeft ?? numProps?.indLeft ?? styleProps.indLeft;
      const indRight = own.indRight ?? numProps?.indRight ?? styleProps.indRight;
      const indFirstLine = own.indFirstLine ?? numProps?.indFirstLine ?? styleProps.indFirstLine;
      const pPrRPrNode = pPr ? context.first(pPr, "w:rPr") : null;
      const pPrRPr = context.rPrProps(pPrRPrNode, context.theme);
      const directMarkAsciiFamily = pPr ? context.findAttr(context.first(pPr, "w:rPr") ?? [], "w:rFonts")?.["@w:ascii"] : void 0;
      const markAsciiFamily = directMarkAsciiFamily ?? numProps?.markerFamily ?? null;
      const markSz = pPrRPr.sz ?? conditionalStyle?.sz ?? styleProps.sz ?? null;
      const markEmTwips = markSz != null ? markSz * 10 : null;
      const markLook = { ...styleProps.look, ...conditionalStyle?.look, ...context.rPrLook(pPrRPrNode, context.theme) };
      const paragraphMark = {
        family: pPrRPr.family ?? conditionalStyle?.family ?? styleProps.family,
        emTwips: markEmTwips,
        bold: Boolean(markLook.bold),
        italic: Boolean(markLook.italic)
      };
      let excluded = false;
      const runs = [];
      const anchors = [];
      let sawText = false, leadingPageBreaks = 0, trailingPageBreaks = 0;
      let lastPageBreakKind = null;
      let columnBreak = false;
      const columnBreakPositions = [];
      const tabTextPositions = [];
      const ptabPositions = [];
      let paraTextLen = 0;
      let inlineImageHTwips = 0;
      let hasDrawing = false;
      const recordLeadingPageBreak = () => {
        leadingPageBreaks++;
        for (const anchor of anchors) anchor.pageOffset = (anchor.pageOffset ?? 0) - 1;
      };
      let fldDepth = 0, fldInResult = false, fldResultMarked = false;
      let fldKind = null, fldInstruction = "";
      const runNodes = [];
      const hyperlinkRids = [];
      const simpleFieldKinds = [];
      const collectInlineNodes = (nodes, inheritedHref = null, inheritedField = null) => {
        for (const rNode of nodes) {
          if ("w:r" in rNode) {
            runNodes.push(rNode);
            hyperlinkRids.push(inheritedHref);
            simpleFieldKinds.push(inheritedField);
          } else if ("m:oMath" in rNode) {
            const math = context.parseMathNodes(rNode["m:oMath"]);
            runNodes.push({ "w:r": [{ "w:t": [{ "#text": context.mathPlainText(math) }] }], "__math": math });
            hyperlinkRids.push(inheritedHref);
            simpleFieldKinds.push(inheritedField);
          } else if ("m:oMathPara" in rNode) {
            for (const equation of rNode["m:oMathPara"]) if ("m:oMath" in equation) {
              const math = context.parseMathNodes(equation["m:oMath"]);
              runNodes.push({ "w:r": [{ "w:t": [{ "#text": context.mathPlainText(math) }] }], "__math": math });
              hyperlinkRids.push(inheritedHref);
              simpleFieldKinds.push(inheritedField);
            }
          } else if ("w:hyperlink" in rNode) {
            const hyperlink = rNode["w:hyperlink"];
            const attrs = rNode[":@"];
            const hid = attrs?.["@r:id"] ?? attrs?.["@w:anchor"] ?? inheritedHref;
            collectInlineNodes(hyperlink, hid, inheritedField);
          } else if ("w:fldSimple" in rNode) {
            const attrs = rNode[":@"] ?? {};
            const instruction = attrs["@w:instr"] ?? "";
            const kind = context.pageFieldKind(instruction) ?? context.styleRefField(instruction, context.styles);
            collectInlineNodes(rNode["w:fldSimple"], inheritedHref, kind);
            excluded = excluded || "field";
          } else if ("w:smartTag" in rNode) {
            collectInlineNodes(rNode["w:smartTag"], inheritedHref, inheritedField);
          } else if ("w:sdt" in rNode) {
            const content = context.first(rNode["w:sdt"], "w:sdtContent");
            if (content) collectInlineNodes(content, inheritedHref, inheritedField);
          }
        }
      };
      collectInlineNodes(p);
      createRunParser({
        get runNodes() {
          return runNodes;
        },
        get hyperlinkRids() {
          return hyperlinkRids;
        },
        get rels() {
          return context.rels;
        },
        get first() {
          return context.first;
        },
        get rPrProps() {
          return context.rPrProps;
        },
        get theme() {
          return context.theme;
        },
        get findAttr() {
          return context.findAttr;
        },
        get resolveViaStyle() {
          return context.resolveViaStyle;
        },
        get styles() {
          return context.styles;
        },
        get sawText() {
          return sawText;
        },
        set sawText(value) {
          sawText = value;
        },
        get lastPageBreakKind() {
          return lastPageBreakKind;
        },
        set lastPageBreakKind(value) {
          lastPageBreakKind = value;
        },
        get trailingPageBreaks() {
          return trailingPageBreaks;
        },
        set trailingPageBreaks(value) {
          trailingPageBreaks = value;
        },
        get recordLeadingPageBreak() {
          return recordLeadingPageBreak;
        },
        get columnBreak() {
          return columnBreak;
        },
        set columnBreak(value) {
          columnBreak = value;
        },
        get columnBreakPositions() {
          return columnBreakPositions;
        },
        get paraTextLen() {
          return paraTextLen;
        },
        set paraTextLen(value) {
          paraTextLen = value;
        },
        get resolveSymChar() {
          return context.resolveSymChar;
        },
        get sourceSymChar() {
          return context.sourceSymChar;
        },
        get endnoteSeq() {
          return context.endnoteSeq;
        },
        get footnoteSeq() {
          return context.footnoteSeq;
        },
        get tabTextPositions() {
          return tabTextPositions;
        },
        get ptabPositions() {
          return ptabPositions;
        },
        get hasDrawing() {
          return hasDrawing;
        },
        set hasDrawing(value) {
          hasDrawing = value;
        },
        get drawingRoots() {
          return context.drawingRoots;
        },
        get collectDeep() {
          return context.collectDeep;
        },
        get inlineImageHTwips() {
          return inlineImageHTwips;
        },
        set inlineImageHTwips(value) {
          inlineImageHTwips = value;
        },
        get partRelsRef() {
          return context.partRelsRef;
        },
        get partNameRef() {
          return context.partNameRef;
        },
        get chartsRef() {
          return context.chartsRef;
        },
        get anchors() {
          return anchors;
        },
        get parseChart() {
          return context.parseChart;
        },
        get parseTextBox() {
          return context.parseTextBox;
        },
        get numbering() {
          return context.numbering;
        },
        get imageEffectsOf() {
          return context.imageEffectsOf;
        },
        get diagramsRef() {
          return context.diagramsRef;
        },
        get parseDiagramDrawing() {
          return context.parseDiagramDrawing;
        },
        get parseVmlShapes() {
          return context.parseVmlShapes;
        },
        get relativeSize() {
          return context.relativeSize;
        },
        get drawingGradient() {
          return context.drawingGradient;
        },
        get themeGradient() {
          return context.themeGradient;
        },
        get fldDepth() {
          return fldDepth;
        },
        set fldDepth(value) {
          fldDepth = value;
        },
        get fldKind() {
          return fldKind;
        },
        set fldKind(value) {
          fldKind = value;
        },
        get fldInstruction() {
          return fldInstruction;
        },
        set fldInstruction(value) {
          fldInstruction = value;
        },
        get fldInResult() {
          return fldInResult;
        },
        set fldInResult(value) {
          fldInResult = value;
        },
        get fldResultMarked() {
          return fldResultMarked;
        },
        set fldResultMarked(value) {
          fldResultMarked = value;
        },
        get pageFieldKind() {
          return context.pageFieldKind;
        },
        get styleRefField() {
          return context.styleRefField;
        },
        get excluded() {
          return excluded;
        },
        set excluded(value) {
          excluded = value;
        },
        get styleProps() {
          return styleProps;
        },
        get conditionalStyle() {
          return conditionalStyle;
        },
        get rPrLook() {
          return context.rPrLook;
        },
        get pPrRPrNode() {
          return pPrRPrNode;
        },
        get pPrRPr() {
          return pPrRPr;
        },
        get simpleFieldKinds() {
          return simpleFieldKinds;
        },
        get runs() {
          return runs;
        }
      })();
      const text = runs.filter((r) => !r.hidden).map((r) => r.sourceText ?? r.text).join("");
      if (excluded === "field" && text.trim()) excluded = false;
      if (!text.trim()) excluded = excluded || "empty";
      const pBdrNode = pPr ? context.first(pPr, "w:pBdr") : null;
      const pBdr = pBdrNode ? context.parseBorders(pBdrNode) : null;
      const pShdAttrs = pPr ? context.findAttr(pPr, "w:shd") : null;
      let pShd = null;
      if (pShdAttrs) {
        const tf = pShdAttrs["@w:themeFill"];
        const base = tf ? context.theme.get(tf) : void 0;
        pShd = base ? context.applyTintShade(base, pShdAttrs["@w:themeFillTint"], pShdAttrs["@w:themeFillShade"]) : pShdAttrs["@w:fill"] && !["auto", "FFFFFF", "ffffff"].includes(pShdAttrs["@w:fill"]) ? pShdAttrs["@w:fill"].toUpperCase() : null;
      }
      const tabStops = resolveParagraphTabStops(context.styles, styleId, pPr);
      const rightLeaderTab = tabStops.find(
        (t) => (t.val === "right" || t.val === "end") && t.leader && t.leader !== "none"
      );
      const isTocStyle = /^toc/i.test(styleId ?? "");
      let toc = null;
      if (tabTextPositions.length && (tabTextPositions.length === 1 || isTocStyle) && (rightLeaderTab || isTocStyle) && text.trim()) {
        const split = tabTextPositions[tabTextPositions.length - 1];
        const entry = text.slice(0, split).trim();
        const pageNum = text.slice(split).trim();
        const rightTab = rightLeaderTab ?? tabStops.find((t) => t.val === "right" || t.val === "end");
        if (entry && pageNum) {
          toc = { entry, pageNum, leader: rightLeaderTab?.leader ?? "dot", rightTabTwips: rightTab?.posTwips ?? 0 };
        }
      }
      if (toc) {
        if (excluded === "field") excluded = false;
        for (const run of runs) if (run.href && !/^[a-z]+:/i.test(run.href)) {
          if (run.inheritedHyperlinkUnderline) run.underline = null;
          if (run.inheritedHyperlinkColor) run.color = run.hyperlinkPrintColor ?? null;
        }
      }
      if (hasDrawing && !text.trim() && inlineImageHTwips === 0) excluded = excluded || "drawing";
      const pbbVal = pPr ? context.findAttr(pPr, "w:pageBreakBefore")?.["@w:val"] : void 0;
      const pbbEl = pPr ? context.first(pPr, "w:pageBreakBefore") !== null : false;
      const ppPageBreak = pbbEl && !["0", "false", "off"].includes(pbbVal ?? "");
      const widowControl = context.pPrFlag(pPr, "w:widowControl") ?? styleProps.widowControl ?? true;
      const suppressAutoHyphens = context.pPrFlag(pPr, "w:suppressAutoHyphens") ?? styleProps.suppressAutoHyphens ?? false;
      const ownOutline = pPr ? context.findAttr(pPr, "w:outlineLvl")?.["@w:val"] : void 0;
      const outlineLevel = ownOutline != null ? Number(ownOutline) : styleProps.outlineLevel;
      const keepNext = context.pPrFlag(pPr, "w:keepNext") ?? styleProps.keepNext ?? false;
      const keepLines = context.pPrFlag(pPr, "w:keepLines") ?? styleProps.keepLines ?? false;
      const contextualSpacing = context.pPrFlag(pPr, "w:contextualSpacing") ?? styleProps.contextualSpacing ?? false;
      let pageBreaksBefore = 0;
      if (excluded && excluded !== "empty") {
        context.pendingBreaks += Math.max(ppPageBreak ? 1 : 0, leadingPageBreaks + trailingPageBreaks);
      } else {
        pageBreaksBefore = Math.max(context.pendingBreaks, ppPageBreak ? 1 : 0, leadingPageBreaks);
        context.pendingBreaks = trailingPageBreaks;
      }
      const ownSp = context.spacingProps(pPr);
      const chain = conditionalStyle?.spacing?.present ? context.overlaySpacing(
        context.overlaySpacing(context.styles.defaults.spacing, conditionalStyle.spacing),
        context.resolveViaStyle(context.styles, styleId ?? context.styles.defaultParagraphStyleId, false).spacing
      ) : styleProps.spacing;
      const beforeAuto = ownSp.beforeAuto ?? chain.beforeAuto;
      const afterAuto = ownSp.afterAuto ?? chain.afterAuto;
      const spacing = {
        present: ownSp.present || chain.present,
        line: ownSp.line ?? chain.line,
        lineRule: ownSp.line != null ? ownSp.lineRule : chain.lineRule,
        before: beforeAuto ? 100 : ownSp.before ?? chain.before,
        after: afterAuto ? 100 : ownSp.after ?? chain.after,
        beforeAuto: beforeAuto ?? null,
        afterAuto: afterAuto ?? null,
        lineDirect: ownSp.line != null,
        lineSource: ownSp.line != null ? "ppr" : chain.lineSource ?? null
      };
      const bookmarkIds = context.collectDeep(p, "w:bookmarkStart").map((x) => x.attrs?.["@w:name"]).filter((x) => Boolean(x));
      const frameAttrs = pPr ? context.findAttr(pPr, "w:framePr") : null;
      const frameNum = (name) => frameAttrs?.[name] != null ? Number(frameAttrs[name]) : null;
      const framePr = frameAttrs ? {
        signature: JSON.stringify(Object.entries(frameAttrs).sort(([a], [b]) => a.localeCompare(b))),
        w: frameNum("@w:w"),
        h: frameNum("@w:h"),
        x: frameNum("@w:x"),
        y: frameNum("@w:y"),
        hSpace: frameNum("@w:hSpace") ?? 0,
        vSpace: frameNum("@w:vSpace") ?? 0,
        hAnchor: frameAttrs["@w:hAnchor"] ?? "text",
        vAnchor: frameAttrs["@w:vAnchor"] ?? "text",
        xAlign: frameAttrs["@w:xAlign"] ?? null,
        yAlign: frameAttrs["@w:yAlign"] ?? null,
        wrap: frameAttrs["@w:wrap"] ?? "around"
      } : null;
      context.paragraphs.push({
        index: context.idx,
        bookmarkIds,
        runs,
        text,
        styleId,
        jc,
        bidi,
        indLeft,
        indRight,
        indFirstLine,
        excluded,
        sectionIndex: -1,
        numbered,
        numId,
        ilvl,
        anchors,
        spacing,
        markEmTwips,
        markAsciiFamily,
        paragraphMark,
        pageBreakBefore: pageBreaksBefore > 0,
        pageBreaksBefore,
        widowControl,
        suppressAutoHyphens,
        outlineLevel,
        keepNext,
        keepLines,
        contextualSpacing,
        tabStops,
        toc,
        inlineImageHTwips,
        tableCell,
        tabAt: tabTextPositions,
        ptabAt: ptabPositions,
        columnBreak,
        columnBreakAt: columnBreakPositions,
        pBdr,
        shd: pShd,
        snapToGrid: context.pPrFlag(pPr, "w:snapToGrid") ?? styleProps.snapToGrid ?? true,
        framePr
      });
      const libraryPageMarkers = bookmarkIds.filter((name) => /^TheLibraryPage_\d+$/.test(name)).length;
      if (libraryPageMarkers > 1) context.pendingBreaks += libraryPageMarkers - 1;
      const pSect = pPr ? context.first(pPr, "w:sectPr") : null;
      if (pSect) {
        context.sections.push(context.geomFrom(pSect));
        for (let k = context.pendingFrom; k < context.paragraphs.length; k++)
          context.paragraphs[k].sectionIndex = context.sections.length - 1;
        context.pendingFrom = context.paragraphs.length;
      }
    }
  };
}

// outputs/active/2026-11-17-mushaf-preview/integrated-private-previews/shamela-inline-headings-review/windows/source/packages/ooxml-model/src/index_math.ts
function mathRow(children) {
  const flat = children.flatMap((child) => child.kind === "row" ? child.children : [child]);
  return flat.length === 1 ? flat[0] : { kind: "row", children: flat };
}
function mathChild(nodes, name) {
  const child = first(nodes, name);
  return child ? parseMathNodes(child) : { kind: "row", children: [] };
}
function parseMathNodes(nodes) {
  const out = [];
  for (const node of nodes) {
    if ("#text" in node) {
      const text = String(node["#text"] ?? "");
      if (text.trim()) out.push({ kind: "text", text });
      continue;
    }
    const entry = Object.entries(node).find(([key]) => key !== ":@");
    if (!entry) continue;
    const [name, raw] = entry;
    const body = Array.isArray(raw) ? raw : [];
    if (name === "m:t" || name === "w:t") {
      const text = body.filter((part) => "#text" in part).map((part) => String(part["#text"] ?? "")).join("");
      if (text) out.push({ kind: "text", text });
    } else if (name === "m:f") {
      out.push({ kind: "fraction", numerator: mathChild(body, "m:num"), denominator: mathChild(body, "m:den") });
    } else if (name === "m:sSup" || name === "m:sSub") {
      out.push({
        kind: name === "m:sSup" ? "sup" : "sub",
        base: mathChild(body, "m:e"),
        script: mathChild(body, name === "m:sSup" ? "m:sup" : "m:sub")
      });
    } else if (name === "m:sSubSup") {
      out.push({ kind: "subsup", base: mathChild(body, "m:e"), sub: mathChild(body, "m:sub"), sup: mathChild(body, "m:sup") });
    } else if (name === "m:rad") {
      const degree = first(body, "m:deg");
      out.push({ kind: "radical", degree: degree ? parseMathNodes(degree) : null, radicand: mathChild(body, "m:e") });
    } else if (name === "m:d") {
      const pr = first(body, "m:dPr") ?? [];
      const chr = (tag, fallback) => findAttr(pr, tag)?.["@m:val"] ?? fallback;
      out.push({ kind: "delimiter", begin: chr("m:begChr", "("), end: chr("m:endChr", ")"), content: mathChild(body, "m:e") });
    } else if (name === "m:m") {
      const rows = body.filter((part) => "m:mr" in part).map((part) => {
        const row = part["m:mr"];
        return row.filter((cell) => "m:e" in cell).map((cell) => parseMathNodes(cell["m:e"]));
      });
      out.push({ kind: "matrix", rows });
    } else if (name === "m:nary") {
      const pr = first(body, "m:naryPr") ?? [];
      const operator = findAttr(pr, "m:chr")?.["@m:val"] ?? "\u222B";
      const limLoc = findAttr(pr, "m:limLoc")?.["@m:val"] ?? "subSup";
      const sub = first(body, "m:sub"), sup = first(body, "m:sup");
      out.push({
        kind: "nary",
        operator,
        base: mathChild(body, "m:e"),
        sub: sub ? parseMathNodes(sub) : null,
        sup: sup ? parseMathNodes(sup) : null,
        limits: limLoc === "undOvr"
      });
    } else if (name === "m:acc" || name === "m:bar") {
      const prName = name === "m:acc" ? "m:accPr" : "m:barPr";
      const pr = first(body, prName) ?? [];
      const position = findAttr(pr, "m:pos")?.["@m:val"] === "bot" ? "bottom" : "top";
      const char = name === "m:acc" ? findAttr(pr, "m:chr")?.["@m:val"] ?? "\u0302" : position === "bottom" ? "_" : "\xAF";
      out.push({ kind: "accent", base: mathChild(body, "m:e"), char, position });
    } else if (name === "m:func") {
      out.push({ kind: "function", name: mathChild(body, "m:fName"), argument: mathChild(body, "m:e") });
    } else if (name === "m:limLow" || name === "m:limUpp") {
      out.push({
        kind: "limit",
        base: mathChild(body, "m:e"),
        limit: mathChild(body, "m:lim"),
        position: name === "m:limLow" ? "lower" : "upper"
      });
    } else if (!name.endsWith("Pr")) {
      out.push(parseMathNodes(body));
    }
  }
  return mathRow(out);
}
function mathPlainText(node) {
  switch (node.kind) {
    case "text":
      return node.text;
    case "row":
      return node.children.map(mathPlainText).join("");
    case "fraction":
      return `(${mathPlainText(node.numerator)})/(${mathPlainText(node.denominator)})`;
    case "sup":
      return `${mathPlainText(node.base)}^${mathPlainText(node.script)}`;
    case "sub":
      return `${mathPlainText(node.base)}_${mathPlainText(node.script)}`;
    case "subsup":
      return `${mathPlainText(node.base)}_${mathPlainText(node.sub)}^${mathPlainText(node.sup)}`;
    case "radical":
      return `${node.degree ? `root[${mathPlainText(node.degree)}]` : "sqrt"}(${mathPlainText(node.radicand)})`;
    case "delimiter":
      return `${node.begin}${mathPlainText(node.content)}${node.end}`;
    case "matrix":
      return node.rows.map((row) => row.map(mathPlainText).join(",")).join(";");
    case "nary":
      return `${node.operator}${node.sub ? `_${mathPlainText(node.sub)}` : ""}${node.sup ? `^${mathPlainText(node.sup)}` : ""}${mathPlainText(node.base)}`;
    case "accent":
      return `${node.position === "bottom" ? "under" : "over"}(${mathPlainText(node.base)},${node.char})`;
    case "function":
      return `${mathPlainText(node.name)}(${mathPlainText(node.argument)})`;
    case "limit":
      return `${mathPlainText(node.base)}${node.position === "lower" ? "_" : "^"}${mathPlainText(node.limit)}`;
  }
}

// outputs/active/2026-11-17-mushaf-preview/integrated-private-previews/shamela-inline-headings-review/windows/source/packages/ooxml-model/src/index_run_types.ts
function pageFieldKind(instruction) {
  const name = instruction.trim().match(/^([A-Za-z]+)/)?.[1]?.toUpperCase();
  return name === "PAGE" || name === "NUMPAGES" || name === "SECTIONPAGES" ? name : null;
}
function styleRefField(instruction, styles) {
  const match = instruction.trim().match(/^STYLEREF\s+(?:"([^"]+)"|([^\s\\]+))/i);
  const name = match?.[1] ?? match?.[2];
  if (!name) return null;
  const heading = name.match(/^(?:ال)?عنوان\s*(\d+)$/);
  const candidates = [name, name.toLowerCase(), ...heading ? [`heading ${heading[1]}`, `Heading${heading[1]}`] : []];
  const id = candidates.map((candidate) => styles.nameToId.get(candidate) ?? styles.nameToId.get(candidate.toLowerCase()) ?? (styles.byId.has(candidate) ? candidate : null)).find(Boolean) ?? null;
  return id ? `STYLEREF:${id}` : null;
}

// outputs/active/2026-11-17-mushaf-preview/integrated-private-previews/shamela-inline-headings-review/windows/source/packages/ooxml-model/src/index_charts.ts
function parseChart(xml, theme) {
  const root = parseOoxml(xml);
  const plot = collectDeep(root, "c:plotArea")[0]?.node ?? [];
  const supported = collectDeep(plot, "c:barChart")[0];
  if (!supported) {
    const type = Object.keys(plot.find((node2) => Object.keys(node2).some((key) => /^c:.+Chart$/.test(key))) ?? {}).find((key) => /^c:.+Chart$/.test(key))?.slice(2) ?? "unknown";
    return {
      kind: "unsupported",
      unsupportedType: type,
      direction: "column",
      grouping: "",
      title: null,
      legend: { visible: false, position: "r" },
      showValues: false,
      categoryAxis: false,
      valueAxis: false,
      categories: [],
      series: []
    };
  }
  const node = supported.node;
  const value = (host, tag) => {
    const found = collectDeep(host, tag)[0];
    if (!found) return null;
    return found.attrs["@val"] ?? String(found.node.find((n) => "#text" in n)?.["#text"] ?? "");
  };
  const texts = (host, parent) => {
    const part = collectDeep(host, parent)[0]?.node ?? [];
    return collectDeep(part, "c:pt").sort((a, b) => Number(a.attrs["@idx"]) - Number(b.attrs["@idx"])).map((point) => value(point.node, "c:v") ?? "");
  };
  const chartTitle = collectDeep(root, "c:title")[0]?.node;
  const title = chartTitle ? collectDeep(chartTitle, "a:t").map((t) => String(t.node.find((n) => "#text" in n)?.["#text"] ?? "")).join("").trim() || texts(chartTitle, "c:strCache")[0] || null : null;
  const firstSer = collectDeep(node, "c:ser")[0]?.node ?? [];
  const categories = texts(firstSer, "c:cat");
  const darken = (hex, factor) => hex.match(/../g).map((part) => Math.round(Number.parseInt(part, 16) * factor).toString(16).padStart(2, "0")).join("").toUpperCase();
  const series = collectDeep(node, "c:ser").map((entry, index) => {
    const ser = entry.node;
    const name = texts(ser, "c:tx")[0] ?? `Series ${index + 1}`;
    const values = texts(ser, "c:val").map(Number).filter(Number.isFinite);
    const srgb = collectDeep(ser, "a:srgbClr")[0]?.attrs["@val"];
    const schemeNode = collectDeep(ser, "a:schemeClr")[0];
    let color = srgb?.toUpperCase() ?? theme.get(schemeNode?.attrs["@val"] ?? "") ?? "4472C4";
    const lum = !srgb && schemeNode ? Number(value(schemeNode.node, "a:lumMod") ?? 1e5) / 1e5 : 1;
    if (lum !== 1) color = darken(color, lum);
    return { name, values, color };
  });
  const legend = collectDeep(root, "c:legend")[0]?.node;
  return {
    kind: "bar",
    direction: value(node, "c:barDir") === "bar" ? "bar" : "column",
    grouping: value(node, "c:grouping") ?? "clustered",
    title,
    legend: { visible: Boolean(legend), position: legend ? value(legend, "c:legendPos") ?? "r" : "r" },
    showValues: value(node, "c:showVal") === "1",
    categoryAxis: collectDeep(plot, "c:catAx").length > 0,
    valueAxis: collectDeep(plot, "c:valAx").some((axis) => value(axis.node, "c:delete") !== "1"),
    categories,
    series
  };
}

// outputs/active/2026-11-17-mushaf-preview/integrated-private-previews/shamela-inline-headings-review/windows/source/packages/ooxml-model/src/index_textbox.ts
function parseTextBox(shape, styles, numbering, theme = /* @__PURE__ */ new Map()) {
  const box = collectDeep(shape, "w:txbxContent")[0]?.node;
  if (!box || !box.length) return void 0;
  try {
    const inner = builder.build(box);
    const xml = `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${inner}</w:body></w:document>`;
    const paras = parseDocument(xml, styles, numbering, theme).paragraphs;
    return paras.length ? paras : void 0;
  } catch {
    return void 0;
  }
}

// outputs/active/2026-11-17-mushaf-preview/integrated-private-previews/shamela-inline-headings-review/windows/source/packages/ooxml-model/src/index_image_effects.ts
function imageEffectsOf(node, theme) {
  const blip = collectDeep(node, "a:blip")[0]?.node;
  const out = {};
  const alpha = blip ? collectDeep(blip, "a:alphaModFix")[0]?.attrs?.["@amt"] : null;
  if (alpha != null) out.opacity = Math.max(0, Math.min(1, Number(alpha) / 1e5));
  if (blip && collectDeep(blip, "a:grayscl").length) out.grayscale = true;
  const lum = blip ? collectDeep(blip, "a:lum")[0]?.attrs : void 0;
  if (lum?.["@bright"] != null) out.brightness = 1 + Number(lum["@bright"]) / 1e5;
  if (lum?.["@contrast"] != null) out.contrast = 1 + Number(lum["@contrast"]) / 1e5;
  const colorOf = (host) => {
    const srgb = collectDeep(host, "a:srgbClr")[0];
    const scheme = collectDeep(host, "a:schemeClr")[0];
    const color = (srgb?.attrs["@val"] ?? theme.get(scheme?.attrs["@val"] ?? "") ?? "000000").toUpperCase();
    const colorNode = srgb?.node ?? scheme?.node ?? [];
    const a = collectDeep(colorNode, "a:alpha")[0]?.attrs?.["@val"];
    return { color, opacity: a == null ? 1 : Math.max(0, Math.min(1, Number(a) / 1e5)) };
  };
  const shadow = collectDeep(node, "a:outerShdw")[0];
  if (shadow) {
    const dist = Number(shadow.attrs["@dist"] ?? 0) / 9525;
    const angle = Number(shadow.attrs["@dir"] ?? 0) / 6e4 * Math.PI / 180;
    const c = colorOf(shadow.node);
    out.shadow = {
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
      blur: Number(shadow.attrs["@blurRad"] ?? 0) / 9525,
      ...c
    };
  } else {
    const effectIdx = collectDeep(node, "a:effectRef")[0]?.attrs?.["@idx"];
    const encoded = effectIdx ? theme.get(`__effectStyle:${effectIdx}`) : void 0;
    if (encoded) {
      try {
        const e = JSON.parse(encoded);
        const angle = e.dir / 6e4 * Math.PI / 180;
        out.shadow = {
          x: Math.cos(angle) * e.dist / 9525,
          y: Math.sin(angle) * e.dist / 9525,
          blur: e.blurRad / 9525,
          color: e.color,
          opacity: e.opacity
        };
      } catch {
      }
    }
  }
  const glow = collectDeep(node, "a:glow")[0];
  if (glow) out.glow = { radius: Number(glow.attrs["@rad"] ?? 0) / 9525, ...colorOf(glow.node) };
  const soft = collectDeep(node, "a:softEdge")[0]?.attrs?.["@rad"];
  if (soft != null) out.softEdge = Number(soft) / 9525;
  const line = collectDeep(node, "a:ln")[0];
  if (line && !collectDeep(line.node, "a:noFill").length) {
    const c = colorOf(line.node);
    const dash = collectDeep(line.node, "a:prstDash")[0]?.attrs?.["@val"];
    out.border = {
      width: Math.max(0.5, Number(line.attrs["@w"] ?? 0) / 9525),
      color: c.color,
      ...dash ? { dash } : {}
    };
  }
  if (blip) {
    const duo = collectDeep(blip, "a:duotone")[0];
    if (duo) {
      const colors = duo.node.filter((n) => "a:srgbClr" in n || "a:schemeClr" in n).map((n) => colorOf([n]).color);
      if (colors.length >= 2) out.duotone = { low: colors[0], high: colors[1] };
    }
  }
  const reflection = collectDeep(node, "a:reflection")[0];
  if (reflection) out.reflection = {
    distance: Number(reflection.attrs["@dist"] ?? 0) / 9525,
    startOpacity: Number(reflection.attrs["@stA"] ?? 1e5) / 1e5,
    endOpacity: Number(reflection.attrs["@endA"] ?? 0) / 1e5
  };
  return Object.keys(out).length ? out : void 0;
}

// outputs/active/2026-11-17-mushaf-preview/integrated-private-previews/shamela-inline-headings-review/windows/source/packages/ooxml-model/src/index_diagrams.ts
function parseDiagramDrawing(xml, theme, scale) {
  const out = [];
  const root = parseOoxml(xml);
  for (const { node: sp } of collectDeep(root, "dsp:sp")) {
    const spPr = collectDeep(sp, "dsp:spPr")[0]?.node ?? sp;
    const xfrm = collectDeep(spPr, "a:xfrm")[0]?.node ?? [];
    const off = collectDeep(xfrm, "a:off")[0]?.attrs;
    const ext = collectDeep(xfrm, "a:ext")[0]?.attrs;
    if (!off || !ext) continue;
    const clrNode = collectDeep(spPr, "a:solidFill")[0]?.node ?? collectDeep(spPr, "a:gs")[0]?.node;
    const srgb = clrNode ? collectDeep(clrNode, "a:srgbClr")[0]?.attrs?.["@val"] : void 0;
    const sch = clrNode ? collectDeep(clrNode, "a:schemeClr")[0]?.attrs?.["@val"] : void 0;
    const fill = srgb ? srgb.toUpperCase() : sch ? theme.get(sch) ?? null : null;
    const tx = collectDeep(sp, "dsp:txBody")[0]?.node ?? [];
    let text = "";
    for (const { node: t } of collectDeep(tx, "a:t")) {
      const seg = t.find((n) => "#text" in n)?.["#text"];
      if (seg != null) text += String(seg);
    }
    const szAttr = collectDeep(tx, "a:rPr")[0]?.attrs?.["@sz"];
    out.push({
      x: Math.round(Number(off["@x"]) * scale / 635),
      y: Math.round(Number(off["@y"]) * scale / 635),
      w: Math.round(Number(ext["@cx"]) * scale / 635),
      h: Math.round(Number(ext["@cy"]) * scale / 635),
      prst: collectDeep(spPr, "a:prstGeom")[0]?.attrs?.["@prst"] ?? "rect",
      fill,
      text: text.trim(),
      em: szAttr ? Math.round(Number(szAttr) / 5) : 200
    });
  }
  return out;
}

// outputs/active/2026-11-17-mushaf-preview/integrated-private-previews/shamela-inline-headings-review/windows/source/packages/ooxml-model/src/index_vml_properties.ts
function parseVmlStyle(style) {
  const out = /* @__PURE__ */ new Map();
  if (!style) return out;
  for (const part of style.split(";")) {
    const i = part.indexOf(":");
    if (i < 0) continue;
    const k = part.slice(0, i).trim().toLowerCase();
    const v = part.slice(i + 1).trim().toLowerCase();
    if (k) out.set(k, v);
  }
  return out;
}
function vmlAngle(value) {
  if (!value) return 0;
  const raw = value.trim().toLowerCase();
  return raw.endsWith("fd") ? (Number(raw.slice(0, -2)) || 0) / 65536 : Number(raw) || 0;
}
function vmlUnit(tok) {
  if (!tok) return 0;
  const t = tok.trim().toLowerCase();
  const num = parseFloat(t);
  if (!isFinite(num)) return 0;
  if (t.endsWith("pt")) return num * 20;
  if (t.endsWith("in")) return num * 1440;
  if (t.endsWith("cm")) return num * 566.9291;
  if (t.endsWith("mm")) return num * 56.69291;
  if (t.endsWith("px")) return num * 15;
  return num * 15;
}
var VML_NAMED = {
  aqua: "00FFFF",
  black: "000000",
  blue: "0000FF",
  fuchsia: "FF00FF",
  gray: "808080",
  grey: "808080",
  green: "008000",
  lime: "00FF00",
  maroon: "800000",
  navy: "000080",
  olive: "808000",
  purple: "800080",
  red: "FF0000",
  silver: "C0C0C0",
  teal: "008080",
  white: "FFFFFF",
  yellow: "FFFF00"
};
var VML_SYS = {
  windowtext: "000000",
  window: "FFFFFF",
  buttonface: "F0F0F0",
  buttontext: "000000",
  buttonshadow: "A0A0A0",
  buttonhighlight: "FFFFFF",
  highlight: "0078D7",
  highlighttext: "FFFFFF",
  graytext: "6D6D6D",
  infobackground: "FFFFE1",
  infotext: "000000",
  menu: "F0F0F0",
  menutext: "000000",
  scrollbar: "C8C8C8",
  background: "000000",
  activecaption: "99B4D1",
  inactivecaption: "BFCDDB",
  captiontext: "000000",
  inactivecaptiontext: "434E54",
  activeborder: "B4B4B4",
  inactiveborder: "F4F7FC",
  appworkspace: "ABABAB",
  threeddarkshadow: "696969",
  threedlightshadow: "E3E3E3"
};
var VML_SCHEME = {
  "scheme.background": "lt1",
  "scheme.fill": "lt1",
  "scheme.text": "dk1",
  "scheme.shadow": "dk1",
  "scheme.title": "dk1",
  "scheme.accent": "accent1",
  "scheme.hyperlink": "hlink",
  "scheme.followed": "folHlink"
};
var VML_SCHEME_IDX = ["lt1", "dk1", "dk1", "dk1", "lt1", "accent1", "hlink", "folHlink"];
function vmlColor(raw, theme) {
  if (!raw) return null;
  let t = raw.trim().toLowerCase().replace(/\s+\[[^\]]*\]$/, "").trim();
  if (!t || t === "none" || t === "auto") return null;
  if (VML_NAMED[t]) return VML_NAMED[t];
  if (VML_SYS[t]) return VML_SYS[t];
  if (VML_SCHEME[t]) return theme.get(VML_SCHEME[t])?.toUpperCase() ?? null;
  const idx = t.match(/^scheme\s*\(\s*(\d+)\s*\)$/);
  if (idx) {
    const nm = VML_SCHEME_IDX[Number(idx[1])];
    return nm ? theme.get(nm)?.toUpperCase() ?? null : null;
  }
  const rgbFn = t.match(/^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);
  if (rgbFn) {
    const cl = (v) => Math.max(0, Math.min(255, Number(v))).toString(16).padStart(2, "0");
    return (cl(rgbFn[1]) + cl(rgbFn[2]) + cl(rgbFn[3])).toUpperCase();
  }
  if (t.startsWith("#")) t = t.slice(1);
  if (/^[0-9a-f]{3}$/.test(t)) return t.split("").map((c) => c + c).join("").toUpperCase();
  if (/^[0-9a-f]{6}$/.test(t)) return t.toUpperCase();
  return null;
}
function vmlArcSize(raw) {
  if (!raw) return 0.2;
  const t = raw.trim().toLowerCase();
  const n = parseFloat(t);
  if (!isFinite(n)) return 0.2;
  if (t.endsWith("f")) return n / 65536;
  if (t.endsWith("%")) return n / 100;
  return n;
}
function vmlRoundRectRadius(w, h, raw) {
  return Math.round(Math.min(w, h) * Math.max(0, Math.min(0.5, vmlArcSize(raw))));
}
function vmlDash(style, w) {
  if (!style) return null;
  const t = style.trim().toLowerCase();
  const u = w > 0 ? w : 1;
  if (/^[\d.\s]+$/.test(t)) {
    const nums = t.split(/\s+/).map(Number).filter((n) => isFinite(n) && n > 0);
    return nums.length ? nums.map((n) => n * u) : null;
  }
  switch (t) {
    case "dash":
    case "shortdash":
    case "longdash":
      return [3 * u, 2 * u];
    case "dot":
    case "shortdot":
      return [u, 1.5 * u];
    case "dashdot":
    case "shortdashdot":
    case "longdashdot":
      return [3 * u, 1.5 * u, u, 1.5 * u];
    case "dashdotdot":
    case "shortdashdotdot":
    case "longdashdotdot":
      return [3 * u, 1.5 * u, u, 1.5 * u, u, 1.5 * u];
    default:
      return null;
  }
}
var VML_SHAPE_TAGS = [
  "v:shape",
  "v:rect",
  "v:roundrect",
  "v:oval",
  "v:line",
  "v:polyline",
  "v:curve",
  "v:arc",
  "v:image"
];
var VML_SPT = {
  "110": "diamond",
  "202": "rect",
  "75": "picture",
  "20": "line",
  "32": "line",
  "9": "hexagon"
};

// outputs/active/2026-11-17-mushaf-preview/integrated-private-previews/shamela-inline-headings-review/windows/source/packages/ooxml-model/src/index_vml_shapes.ts
function parseVmlShapes(pict, styles, numbering, theme) {
  const out = [];
  const types = /* @__PURE__ */ new Map();
  for (const st of collectDeep(pict, "v:shapetype")) {
    const id = st.attrs["@id"];
    if (id) types.set(id, st.attrs);
  }
  const groups = collectDeep(pict, "v:group");
  const inGroup = /* @__PURE__ */ new Set();
  const inTextBox = /* @__PURE__ */ new Set();
  for (const { node: box } of collectDeep(pict, "v:textbox")) {
    for (const tag of VML_SHAPE_TAGS)
      for (const { node } of collectDeep(box, tag)) inTextBox.add(node);
  }
  for (const { node: g, attrs: ga } of groups) {
    const gst = parseVmlStyle(ga["@style"]);
    const gw = vmlUnit(gst.get("width")), gh = vmlUnit(gst.get("height"));
    const gx = (() => {
      const a1 = gst.get("left"), a2 = gst.get("margin-left");
      return a1 != null && a2 != null ? vmlUnit(a1) + vmlUnit(a2) : vmlUnit(a1 ?? a2);
    })();
    const gy = (() => {
      const a1 = gst.get("top"), a2 = gst.get("margin-top");
      return a1 != null && a2 != null ? vmlUnit(a1) + vmlUnit(a2) : vmlUnit(a1 ?? a2);
    })();
    const [csx, csy] = (ga["@coordsize"] ?? "1,1").split(",").map(Number);
    const [cox, coy] = (ga["@coordorigin"] ?? "0,0").split(",").map(Number);
    const cx = csx || 1, cy = csy || 1;
    const REL_H0 = { page: "page", margin: "margin", text: "column" };
    const REL_V0 = {
      page: "page",
      margin: "margin",
      text: "paragraph",
      line: "line"
    };
    const grh = gst.get("mso-position-horizontal-relative");
    const grv = gst.get("mso-position-vertical-relative");
    const inlineGroup = (gst.get("position") ?? "").toLowerCase() !== "absolute" && grh === "char" && grv === "line" ? ga["@o:spid"] ?? ga["@id"] : void 0;
    const gz = gst.get("z-index") ? Number(gst.get("z-index").replace(/[^0-9.-]/g, "")) : 0;
    for (const tag of VML_SHAPE_TAGS) {
      for (const { node: ch, attrs: ca } of collectDeep(g, tag)) {
        inGroup.add(ch);
        const cst = parseVmlStyle(ca["@style"]);
        const wrapDistance = (side) => vmlUnit(cst.get(`mso-wrap-distance-${side}`) ?? gst.get(`mso-wrap-distance-${side}`));
        const flip = (cst.get("flip") ?? gst.get("flip") ?? "").toLowerCase();
        const rotation = vmlAngle(cst.get("rotation") ?? gst.get("rotation"));
        const logical = (v) => {
          if (v == null) return 0;
          const t = v.trim().toLowerCase();
          return /(pt|px|in|cm|mm)$/.test(t) ? vmlUnit(t) : parseFloat(t) || 0;
        };
        const lx = logical(cst.get("left")), ly = logical(cst.get("top"));
        const lw = logical(cst.get("width")), lh = logical(cst.get("height"));
        const chKind = tag === "v:shape" ? collectDeep(ch, "v:imagedata").length ? "picture" : "rect" : tag.slice(2);
        const tRef = (ca["@type"] ?? "").replace(/^#/, "");
        const tAttrs = tRef ? types.get(tRef) : void 0;
        const attrOf = (name) => ca[name] ?? tAttrs?.[name];
        const offish = (v) => v === "f" || v === "false";
        const hasBox = collectDeep(ch, "w:txbxContent").length > 0;
        const tbNode = collectDeep(ch, "v:textbox")[0];
        const tb = hasBox ? parseTextBox(ch, styles, numbering, theme) : void 0;
        const chStroke = offish(attrOf("@stroked")) ? null : vmlColor(attrOf("@strokecolor"), theme);
        const rawFill = vmlColor(attrOf("@fillcolor"), theme);
        const chFill = offish(attrOf("@filled")) ? null : rawFill ?? (chKind === "picture" && !hasBox ? null : "FFFFFF");
        const chImage = collectDeep(ch, "v:imagedata")[0];
        const chStrokeNode = collectDeep(ch, "v:stroke")[0];
        const shadow = chImage && inlineGroup ? collectDeep(ch, "v:shadow")[0]?.attrs : void 0;
        const imageEffects = {};
        if (shadow && !offish(shadow["@on"])) {
          const [x, y] = (shadow["@offset"] ?? "2pt,2pt").split(",");
          const raw = shadow["@opacity"] ?? "1", opacity = raw.endsWith("f") ? Number.parseFloat(raw) / 65536 : Number.parseFloat(raw);
          if (Number.isFinite(opacity) && opacity >= 0 && opacity <= 1) imageEffects.shadow = { x: vmlUnit(x) / 15, y: vmlUnit(y) / 15, blur: 0, color: vmlColor(shadow["@color"] ?? "black", theme) ?? "000000", opacity };
        }
        if (chImage && inlineGroup && attrOf("@stroked") === "t") imageEffects.border = { width: vmlUnit(attrOf("@strokeweight") ?? "1pt") / 15, color: chStroke ?? "000000" };
        let ins;
        if (tb) {
          const parts = (tbNode?.attrs?.["@inset"] ?? "").split(/[,\s]+/).filter(Boolean);
          const DEF = [144, 72, 144, 72];
          const inset = (i) => parts[i] ? vmlUnit(parts[i]) : DEF[i];
          ins = { l: inset(0), t: inset(1), r: inset(2), b: inset(3) };
        }
        out.push({
          extentW: Math.round(lw * gw / cx),
          extentH: Math.round(lh * gh / cy),
          ...Math.abs(Math.abs(rotation ?? 0) % 180 - 90) < 1e-3 ? {
            nativeGroupGeometry: {
              extentW: Math.round(lw * gh / cy),
              extentH: Math.round(lh * gw / cx),
              posHOffset: Math.round(gx + (lx - (cox || 0) + lw / 2) * gw / cx - lw * gh / cy / 2),
              posVOffset: Math.round(gy + (ly - (coy || 0) + lh / 2) * gh / cy - lh * gw / cx / 2)
            }
          } : {},
          posHRel: grh ? REL_H0[grh] ?? "column" : "column",
          posHOffset: Math.round(gx + (lx - (cox || 0)) * gw / cx),
          posVRel: grv ? REL_V0[grv] ?? "paragraph" : "paragraph",
          posVOffset: Math.round(gy + (ly - (coy || 0)) * gh / cy),
          posHAlign: null,
          posVAlign: null,
          behindDoc: gz < 0,
          zOrder: gz,
          distL: wrapDistance("left"),
          distR: wrapDistance("right"),
          distT: wrapDistance("top"),
          distB: wrapDistance("bottom"),
          wrap: "",
          rId: chImage?.attrs?.["@r:id"] ?? chImage?.attrs?.["@o:relid"] ?? null,
          ...chImage ? { stretch: true } : {},
          ...rotation ? { rotDeg: rotation } : {},
          ...flip.includes("x") ? { flipH: true } : {},
          ...flip.includes("y") ? { flipV: true } : {},
          ...tb ? { textBox: tb } : {},
          ...ins ? { boxIns: ins, boxAnchor: cst.get("v-text-anchor") === "middle" ? "ctr" : "t" } : {},
          shape: {
            prst: chKind,
            fill: chFill,
            stroke: chStroke,
            strokeW: offish(attrOf("@stroked")) ? 0 : Math.round(attrOf("@strokeweight") ? vmlUnit(attrOf("@strokeweight")) : 15),
            adj: null,
            ...chStrokeNode?.attrs?.["@linestyle"] ? { lineStyle: chStrokeNode.attrs["@linestyle"] } : {}
          },
          vml: true,
          ...inlineGroup ? { nativeInlineVmlGroup: inlineGroup } : {},
          ...Object.keys(imageEffects).length ? { imageEffects } : {},
          ...chKind === "roundrect" ? { radiusTwips: vmlRoundRectRadius(lw * gw / cx, lh * gh / cy, attrOf("@arcsize")) } : {}
        });
      }
    }
  }
  for (const tag of VML_SHAPE_TAGS) {
    for (const { node: sh, attrs: a } of collectDeep(pict, tag)) {
      if (inGroup.has(sh)) continue;
      if (inTextBox.has(sh)) continue;
      const st = parseVmlStyle(a["@style"]);
      const inlineFlow = (st.get("position") ?? "").toLowerCase() !== "absolute";
      const tbNode = collectDeep(sh, "v:textbox")[0];
      const hasBox = collectDeep(sh, "w:txbxContent").length > 0;
      const tRef = (a["@type"] ?? "").replace(/^#/, "");
      const tAttrs = tRef ? types.get(tRef) : void 0;
      const spt = a["@o:spt"] ?? a["@spt"] ?? tAttrs?.["@o:spt"] ?? tAttrs?.["@spt"];
      const local = tag.slice(2);
      const directShapeContent = sh.filter((item) => !("v:textbox" in item) && !("w:txbxContent" in item));
      const imageData = collectDeep(directShapeContent, "v:imagedata")[0];
      let kind = spt && VML_SPT[spt] ? VML_SPT[spt] : local !== "shape" ? local : imageData ? "picture" : "rect";
      if (hasBox && kind === "rect") kind = "rect";
      let w = vmlUnit(st.get("width")), h = vmlUnit(st.get("height"));
      const sum = (k1, k2) => {
        const v1 = st.get(k1), v2 = st.get(k2);
        if (v1 != null && v2 != null) return vmlUnit(v1) + vmlUnit(v2);
        return vmlUnit(v1 ?? v2);
      };
      let x = sum("left", "margin-left"), y = sum("top", "margin-top");
      if (kind === "line" && (a["@from"] || a["@to"])) {
        const pt = (v) => (v ?? "0,0").split(",").map((c) => vmlUnit(c.trim()));
        const [fx, fy] = pt(a["@from"]);
        const [tx, ty] = pt(a["@to"]);
        w = Math.max(1, Math.abs(tx - fx));
        h = Math.max(1, Math.abs(ty - fy));
        if (x <= 0) x = Math.min(fx, tx);
        if (y <= 0) y = Math.min(fy, ty);
      }
      const zRaw = st.get("z-index");
      const z = zRaw ? Number(zRaw.replace(/[^0-9.-]/g, "")) : 0;
      const REL_H = { page: "page", margin: "margin", text: "column" };
      const REL_V = {
        page: "page",
        margin: "margin",
        text: "paragraph",
        line: "line"
      };
      const alignH = st.get("mso-position-horizontal") ?? null;
      const alignV = st.get("mso-position-vertical") ?? null;
      const relHRaw = st.get("mso-position-horizontal-relative");
      const relVRaw = st.get("mso-position-vertical-relative");
      const posHRel = relHRaw ? REL_H[relHRaw] ?? "column" : alignH ? "page" : "column";
      const posVRel = relVRaw ? REL_V[relVRaw] ?? "paragraph" : "paragraph";
      const wrapNode = collectDeep(sh, "w10:wrap")[0] ?? collectDeep(pict, "w10:wrap")[0];
      const wt = (wrapNode?.attrs?.["@type"] ?? "").toLowerCase();
      const WRAP = {
        square: "Square",
        tight: "Tight",
        through: "Through",
        topandbottom: "TopAndBottom"
      };
      const wrap = WRAP[wt] ?? "None";
      const wrapDistance = (side) => vmlUnit(st.get(`mso-wrap-distance-${side}`));
      const flip = (st.get("flip") ?? "").toLowerCase();
      const rotation = vmlAngle(st.get("rotation"));
      const attrOf = (nm) => a[nm] ?? tAttrs?.[nm];
      const offish = (v) => v === "f" || v === "false";
      const isFilled = !offish(attrOf("@filled"));
      const isStroked = !offish(attrOf("@stroked"));
      const fillColor = isFilled ? vmlColor(attrOf("@fillcolor"), theme) : null;
      const strokeColor = isStroked ? vmlColor(attrOf("@strokecolor"), theme) ?? "000000" : null;
      const strokeNode = collectDeep(sh, "v:stroke")[0];
      const strokeW = attrOf("@strokeweight") ? vmlUnit(attrOf("@strokeweight")) : 15;
      const dash = vmlDash(strokeNode?.attrs?.["@dashstyle"], strokeW);
      const endcap = strokeNode?.attrs?.["@endcap"] ?? "flat";
      const effFill = !isFilled ? null : fillColor ?? (kind === "picture" && !hasBox ? null : "FFFFFF");
      const tb = hasBox ? parseTextBox(sh, styles, numbering, theme) : void 0;
      const vmlCrop = (v) => {
        if (!v) return 0;
        const s = v.trim().toLowerCase();
        if (s.endsWith("f")) return Number(s.slice(0, -1)) / 65536;
        if (s.endsWith("%")) return Number(s.slice(0, -1)) / 100;
        return Number(s) || 0;
      };
      const crop = imageData ? {
        l: vmlCrop(imageData.attrs["@cropleft"]),
        t: vmlCrop(imageData.attrs["@croptop"]),
        r: vmlCrop(imageData.attrs["@cropright"]),
        b: vmlCrop(imageData.attrs["@cropbottom"])
      } : null;
      let ins;
      if (tb) {
        const parts = (tbNode?.attrs?.["@inset"] ?? "").split(/[,\s]+/).filter((x2) => x2 !== "");
        const DEF = [144, 72, 144, 72];
        const g = (i) => parts[i] ? vmlUnit(parts[i]) : DEF[i];
        ins = { l: g(0), t: g(1), r: g(2), b: g(3) };
      }
      if (!tb && !w && !h) continue;
      out.push({
        ...typeof a["@id"] === "string" ? { nativeSourceShape: { id: a["@id"], ...typeof a["@o:spid"] === "string" ? { spid: a["@o:spid"] } : {} } } : {},
        extentW: Math.round(w),
        extentH: Math.round(h),
        posHRel,
        posHOffset: Math.round(x),
        posVRel,
        posVOffset: Math.round(y),
        distL: wrapDistance("left"),
        distR: wrapDistance("right"),
        distT: wrapDistance("top"),
        distB: wrapDistance("bottom"),
        wrap: wrap === "None" ? "" : wrap,
        rId: imageData?.attrs?.["@r:id"] ?? imageData?.attrs?.["@o:relid"] ?? null,
        ...imageData ? { stretch: true } : {},
        ...rotation ? { rotDeg: rotation } : {},
        ...flip.includes("x") ? { flipH: true } : {},
        ...flip.includes("y") ? { flipV: true } : {},
        ...crop && (crop.l || crop.t || crop.r || crop.b) ? { srcRect: crop } : {},
        behindDoc: z < 0,
        ...inlineFlow ? { inlineFlow: true } : {},
        posHAlign: alignH && ["left", "center", "right"].includes(alignH) ? alignH : null,
        posVAlign: alignV && ["top", "center", "bottom"].includes(alignV) ? alignV : null,
        zOrder: z,
        ...tb ? { textBox: tb } : {},
        ...ins ? { boxIns: ins, boxAnchor: "t" } : {},
        shape: {
          prst: kind,
          fill: effFill,
          stroke: strokeColor,
          strokeW: isStroked ? Math.round(strokeW) : 0,
          adj: kind === "roundrect" ? vmlArcSize(attrOf("@arcsize")) : null,
          ...dash ? { dash } : {},
          endcap,
          ...strokeNode?.attrs?.["@linestyle"] ? { lineStyle: strokeNode.attrs["@linestyle"] } : {}
        },
        vml: true,
        ...kind === "roundrect" ? { radiusTwips: vmlRoundRectRadius(w, h, attrOf("@arcsize")) } : {}
      });
    }
  }
  return out;
}

// outputs/active/2026-11-17-mushaf-preview/integrated-private-previews/shamela-inline-headings-review/windows/source/packages/ooxml-model/src/index_sizes.ts
function relativeSize(from, rawPct) {
  if (rawPct == null) return void 0;
  const pct = Number(rawPct) / 1e5;
  if (!Number.isFinite(pct) || pct <= 0) return void 0;
  return { from: from ?? "page", pct };
}

// outputs/active/2026-11-17-mushaf-preview/integrated-private-previews/shamela-inline-headings-review/windows/source/packages/ooxml-model/src/index_document.ts
function projectHiddenParagraphMarks(body) {
  const hasOnly = (nodes, tags) => nodes.every((node) => Object.keys(node).every((key) => key === ":@" || tags.includes(key)));
  const plainRuns = (nodes) => hasOnly(nodes, ["w:pPr", "w:r"]) && nodes.some((node) => "w:r" in node) && nodes.every((node) => !("w:r" in node) || hasOnly(node["w:r"], ["w:rPr", "w:t", "w:sym", "w:tab", "w:footnoteReference"]));
  const projected = [];
  for (const node of body) {
    const previous = projected.at(-1);
    const left = previous?.["w:p"];
    const right = node["w:p"];
    const leftProperties = left && first(left, "w:pPr");
    const rightProperties = right && first(right, "w:pPr");
    const mark = leftProperties && first(leftProperties, "w:rPr");
    const vanish = mark && findAttr(mark, "w:vanish");
    const enabled = vanish && /^(?:1|true|on)$/i.test(vanish["@w:val"] ?? "1");
    const leftAlignment = leftProperties && findAttr(leftProperties, "w:jc")?.["@w:val"];
    const rightAlignment = rightProperties && findAttr(rightProperties, "w:jc")?.["@w:val"];
    if (!left || !right || !leftProperties || !rightProperties || !enabled || leftAlignment !== rightAlignment || JSON.stringify(first(leftProperties, "w:tabs")) !== JSON.stringify(first(rightProperties, "w:tabs")) || !hasOnly(leftProperties, ["w:ind", "w:jc", "w:rPr", "w:tabs"]) || !hasOnly(rightProperties, ["w:ind", "w:jc", "w:rPr", "w:tabs"]) || !plainRuns(left) || !plainRuns(right)) {
      projected.push(node);
      continue;
    }
    projected[projected.length - 1] = {
      ...node,
      "w:p": [{ "w:pPr": rightProperties }, ...left.filter((run) => "w:r" in run), ...right.filter((run) => "w:r" in run)]
    };
  }
  return projected;
}
function parseDocument(documentXml, styles, numbering = /* @__PURE__ */ new Map(), theme = /* @__PURE__ */ new Map(), rels, hideParagraphMarks = false) {
  const root = parseOoxml(documentXml);
  const doc = first(root, "w:document");
  const body = doc ? first(doc, "w:body") : null;
  if (!body) throw new Error("w:body \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
  const projectedBody = hideParagraphMarks ? projectHiddenParagraphMarks(body) : body;
  const DEFAULT_GEO = {
    pageWTwips: 11906,
    pageHTwips: 16838,
    marLeftTwips: 1440,
    marRightTwips: 1440,
    marTopTwips: 1440,
    marBottomTwips: 1440,
    columnTwips: 9026,
    colCount: 1,
    colSpaceTwips: 708,
    colWidthTwips: 9026,
    pgNumFmt: null,
    pgNumStart: null,
    sectStart: "nextPage",
    docGridLinePitch: null,
    docGridType: null
  };
  function geomFrom(sectPr) {
    if (!sectPr) return DEFAULT_GEO;
    const pgSz = findAttr(sectPr, "w:pgSz");
    const pgMar = findAttr(sectPr, "w:pgMar");
    const w = Number(pgSz?.["@w:w"] ?? DEFAULT_GEO.pageWTwips);
    const h = Number(pgSz?.["@w:h"] ?? DEFAULT_GEO.pageHTwips);
    const l = Number(pgMar?.["@w:left"] ?? DEFAULT_GEO.marLeftTwips);
    const r = Number(pgMar?.["@w:right"] ?? DEFAULT_GEO.marRightTwips);
    const t = Number(pgMar?.["@w:top"] ?? DEFAULT_GEO.marTopTwips);
    const b = Number(pgMar?.["@w:bottom"] ?? DEFAULT_GEO.marBottomTwips);
    const headerRefs = {}, footerRefs = {};
    for (const node of sectPr) {
      for (const [key, bag] of [["w:headerReference", headerRefs], ["w:footerReference", footerRefs]]) {
        if (!(key in node)) continue;
        const a = node[":@"] ?? {};
        const ty = a["@w:type"] ?? "default";
        const rid = a["@r:id"];
        if (rid) bag[ty] = rid;
      }
    }
    const colsAttr = findAttr(sectPr, "w:cols");
    const colsNode = first(sectPr, "w:cols");
    const explicitColumns = (colsNode ?? []).flatMap((node) => {
      if (!("w:col" in node)) return [];
      const attrs = node[":@"] ?? {};
      const widthTwips = Number(attrs["@w:w"]);
      if (!Number.isFinite(widthTwips) || widthTwips <= 0) return [];
      const spaceAfterTwips = Number(attrs["@w:space"] ?? colsAttr?.["@w:space"] ?? 0);
      return [{ widthTwips, spaceAfterTwips: Number.isFinite(spaceAfterTwips) ? spaceAfterTwips : 0 }];
    });
    const colCount = Math.max(1, explicitColumns.length || Number(colsAttr?.["@w:num"] ?? 1) || 1);
    const colSpaceTwips = Number(colsAttr?.["@w:space"] ?? 708);
    const usable = w - l - r;
    const colWidthTwips = explicitColumns[0]?.widthTwips ?? (colCount > 1 ? Math.floor((usable - colSpaceTwips * (colCount - 1)) / colCount) : usable);
    const notePr = (kind) => {
      const host = first(sectPr, `w:${kind}Pr`);
      if (!host) return void 0;
      const val = (tag) => findAttr(host, `w:${tag}`)?.["@w:val"];
      const out = {};
      const start = val("numStart");
      if (start != null && Number.isFinite(Number(start))) out.start = Number(start);
      const restart = val("numRestart");
      if (restart) out.restart = restart;
      const fmt = val("numFmt");
      if (fmt) out.fmt = fmt;
      const position = val("pos");
      if (position) out.position = position;
      return Object.keys(out).length ? out : void 0;
    };
    const footnotePr = notePr("footnote");
    const endnotePr = notePr("endnote");
    return {
      pageWTwips: w,
      pageHTwips: h,
      marLeftTwips: l,
      marRightTwips: r,
      marTopTwips: t,
      marBottomTwips: b,
      columnTwips: colWidthTwips,
      colCount,
      colSpaceTwips,
      colWidthTwips,
      ...explicitColumns.length ? { explicitColumns } : {},
      headerRefs,
      footerRefs,
      pgNumFmt: findAttr(sectPr, "w:pgNumType")?.["@w:fmt"] ?? null,
      pgNumStart: findAttr(sectPr, "w:pgNumType")?.["@w:start"] != null ? Number(findAttr(sectPr, "w:pgNumType")["@w:start"]) : null,
      sectStart: findAttr(sectPr, "w:type")?.["@w:val"] ?? "nextPage",
      docGridLinePitch: findAttr(sectPr, "w:docGrid")?.["@w:linePitch"] != null ? Number(findAttr(sectPr, "w:docGrid")["@w:linePitch"]) : null,
      docGridType: findAttr(sectPr, "w:docGrid")?.["@w:type"] ?? null,
      headerDistTwips: Number(pgMar?.["@w:header"] ?? 720),
      footerDistTwips: Number(pgMar?.["@w:footer"] ?? 720),
      titlePg: first(sectPr, "w:titlePg") !== null,
      ...footnotePr ? { footnotePr } : {},
      ...endnotePr ? { endnotePr } : {},
      ...(() => {
        const pgBorders = collectDeep(sectPr, "w:pgBorders")[0];
        if (!pgBorders) return { pageBorders: null };
        return {
          pageBorders: parseBorders(pgBorders.node),
          pageBorderOffsetFrom: pgBorders.attrs["@w:offsetFrom"] === "text" ? "text" : "page",
          pageBorderDisplay: pgBorders.attrs["@w:display"] ?? "allPages",
          pageBorderZOrder: pgBorders.attrs["@w:zOrder"] === "back" ? "back" : "front"
        };
      })()
    };
  }
  const sections = [];
  let pendingFrom = 0;
  const paragraphs = [];
  let idx = 0;
  let pendingBreaks = 0;
  const footnoteSeq = { n: 0 }, endnoteSeq = { n: 0 };
  let tableCounter = 0;
  const MAX_TABLE_NESTING = 16;
  const flattenBlocks = createTableFlattener({
    get first() {
      return first;
    },
    get flattenBlocks() {
      return flattenBlocks;
    },
    get MAX_TABLE_NESTING() {
      return MAX_TABLE_NESTING;
    },
    get findAttr() {
      return findAttr;
    },
    get styles() {
      return styles;
    },
    get parseBorders() {
      return parseBorders;
    },
    get collectDeep() {
      return collectDeep;
    },
    get tableCounter() {
      return tableCounter;
    },
    set tableCounter(value) {
      tableCounter = value;
    },
    get tableStyleRegionForCell() {
      return tableStyleRegionForCell;
    }
  });
  createParagraphParser({
    get flattenBlocks() {
      return flattenBlocks;
    },
    get body() {
      return projectedBody;
    },
    get idx() {
      return idx;
    },
    set idx(value) {
      idx = value;
    },
    get first() {
      return first;
    },
    get findAttr() {
      return findAttr;
    },
    get resolveViaStyle() {
      return resolveViaStyle;
    },
    get styles() {
      return styles;
    },
    get pPrFlag() {
      return pPrFlag;
    },
    get numbering() {
      return numbering;
    },
    get indProps() {
      return indProps;
    },
    get rPrProps() {
      return rPrProps;
    },
    get theme() {
      return theme;
    },
    get rPrLook() {
      return rPrLook;
    },
    get parseMathNodes() {
      return parseMathNodes;
    },
    get mathPlainText() {
      return mathPlainText;
    },
    get pageFieldKind() {
      return pageFieldKind;
    },
    get styleRefField() {
      return styleRefField;
    },
    get rels() {
      return rels;
    },
    get resolveSymChar() {
      return resolveSymChar;
    },
    get sourceSymChar() {
      return sourceSymChar;
    },
    get endnoteSeq() {
      return endnoteSeq;
    },
    get footnoteSeq() {
      return footnoteSeq;
    },
    get drawingRoots() {
      return drawingRoots;
    },
    get collectDeep() {
      return collectDeep;
    },
    get partRelsRef() {
      return documentPartContext.partRelsRef;
    },
    get partNameRef() {
      return documentPartContext.partNameRef;
    },
    get chartsRef() {
      return documentPartContext.chartsRef;
    },
    get parseChart() {
      return parseChart;
    },
    get parseTextBox() {
      return parseTextBox;
    },
    get imageEffectsOf() {
      return imageEffectsOf;
    },
    get diagramsRef() {
      return documentPartContext.diagramsRef;
    },
    get parseDiagramDrawing() {
      return parseDiagramDrawing;
    },
    get parseVmlShapes() {
      return parseVmlShapes;
    },
    get relativeSize() {
      return relativeSize;
    },
    get drawingGradient() {
      return drawingGradient;
    },
    get themeGradient() {
      return themeGradient;
    },
    get parseBorders() {
      return parseBorders;
    },
    get applyTintShade() {
      return applyTintShade;
    },
    get parseTabStops() {
      return parseTabStops;
    },
    get pendingBreaks() {
      return pendingBreaks;
    },
    set pendingBreaks(value) {
      pendingBreaks = value;
    },
    get spacingProps() {
      return spacingProps;
    },
    get overlaySpacing() {
      return overlaySpacing;
    },
    get paragraphs() {
      return paragraphs;
    },
    get sections() {
      return sections;
    },
    get geomFrom() {
      return geomFrom;
    },
    get pendingFrom() {
      return pendingFrom;
    },
    set pendingFrom(value) {
      pendingFrom = value;
    }
  })();
  sections.push(geomFrom(first(body, "w:sectPr")));
  for (let k = pendingFrom; k < paragraphs.length; k++)
    paragraphs[k].sectionIndex = sections.length - 1;
  for (let i = 1; i < sections.length; i++) {
    const prev = sections[i - 1];
    const cur = sections[i];
    cur.headerRefs = { ...prev.headerRefs ?? {}, ...cur.headerRefs ?? {} };
    cur.footerRefs = { ...prev.footerRefs ?? {}, ...cur.footerRefs ?? {} };
  }
  for (let i = 1; i < sections.length; i++) {
    if (sections[i].sectStart === "continuous") continue;
    const firstParagraph = paragraphs.find((paragraph) => paragraph.sectionIndex === i);
    if (!firstParagraph) continue;
    firstParagraph.pageBreaksBefore = (firstParagraph.pageBreaksBefore ?? 0) + 1;
    firstParagraph.pageBreakBefore = true;
  }
  for (let start = 0; start < paragraphs.length; ) {
    const candidate = (paragraph) => !paragraph.tableCell && paragraph.tabAt.length === 1 && /^.+\t\s*[0-9٠-٩]+\s*$/u.test(paragraph.text.trim());
    if (!candidate(paragraphs[start])) {
      start++;
      continue;
    }
    let end = start + 1;
    while (end < paragraphs.length && candidate(paragraphs[end])) end++;
    if (end - start >= 3) {
      const explicit = paragraphs.slice(start, end).find((paragraph) => paragraph.toc);
      const rightTabTwips = explicit?.toc?.rightTabTwips ?? 0;
      for (let i = start; i < end; i++) if (!paragraphs[i].toc) {
        const paragraph = paragraphs[i];
        const split = paragraph.text.lastIndexOf("	");
        paragraph.toc = {
          entry: paragraph.text.slice(0, split).trim(),
          pageNum: paragraph.text.slice(split + 1).trim(),
          leader: "dot",
          rightTabTwips
        };
      }
    }
    start = end;
  }
  const section = sections[sections.length - 1];
  const pageBackground = documentXml.match(/<w:background\b[^>]*\bw:color="([0-9A-Fa-f]{6})"/)?.[1]?.toUpperCase();
  return {
    section,
    sections,
    paragraphs,
    compatibilityMode: 11,
    defaultTabStop: 720,
    ...pageBackground ? { pageBackground } : {},
    footnotes: /* @__PURE__ */ new Map(),
    endnotes: /* @__PURE__ */ new Map(),
    numbering,
    headerFooters: /* @__PURE__ */ new Map(),
    relTargets: /* @__PURE__ */ new Map(),
    evenAndOddHeaders: false,
    partRels: /* @__PURE__ */ new Map(),
    mediaFiles: /* @__PURE__ */ new Map(),
    embeddedFonts: /* @__PURE__ */ new Map()
  };
}

// outputs/active/2026-11-17-mushaf-preview/integrated-private-previews/shamela-inline-headings-review/windows/source/packages/ooxml-model/src/index_settings.ts
function compatibilityMode(settingsXml) {
  if (!settingsXml) return 11;
  const m = settingsXml.match(
    /w:name="compatibilityMode"[^>]*w:val="(\d+)"|w:val="(\d+)"[^>]*w:name="compatibilityMode"/
  );
  return m ? Number(m[1] ?? m[2]) : 11;
}
function defaultTabStop(settingsXml) {
  if (!settingsXml) return 720;
  const m = settingsXml.match(/w:defaultTabStop[^>]*w:val="(\d+)"/);
  return m ? Number(m[1]) : 720;
}

// outputs/active/2026-11-17-mushaf-preview/integrated-private-previews/shamela-inline-headings-review/windows/source/packages/ooxml-model/src/index_notes.ts
function parseNotes(notesXml, documentXml, styles, numbering = /* @__PURE__ */ new Map(), tag = "w:footnote", theme = /* @__PURE__ */ new Map()) {
  const out = /* @__PURE__ */ new Map();
  if (!notesXml) return out;
  const nsMatch = documentXml.match(/<w:document([^>]*)>/);
  const ns = nsMatch ? nsMatch[1] : ' xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  const open = "<" + tag, close = "</" + tag + ">";
  let pos = 0;
  for (; ; ) {
    const i = notesXml.indexOf(open, pos);
    if (i < 0) break;
    const after = notesXml[i + open.length];
    if (after !== " " && after !== ">") {
      pos = i + open.length;
      continue;
    }
    const e = notesXml.indexOf(close, i);
    if (e < 0) break;
    const m = notesXml.slice(i, e + close.length);
    pos = e + close.length;
    const openingTag = m.slice(0, m.indexOf(">") + 1);
    const idM = openingTag.match(/w:id="(-?\d+)"/);
    if (!idM) continue;
    const inner = m.slice(m.indexOf(">") + 1, m.lastIndexOf("</"));
    const id = idM[1];
    if (!id) continue;
    try {
      const wrapped = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document${ns}><w:body>${inner}</w:body></w:document>`;
      const notePs = parseDocument(wrapped, styles, numbering, theme).paragraphs;
      const notePart = tag === "w:endnote" ? "endnotes.xml" : "footnotes.xml";
      for (const q of notePs) for (const a of q.anchors ?? []) a.part = notePart;
      out.set(id, notePs);
      const noteType = openingTag.match(/w:type="(separator|continuationSeparator)"/)?.[1];
      if (noteType === "separator") out.set("-1", notePs);
      else if (noteType === "continuationSeparator") out.set("0", notePs);
    } catch {
    }
  }
  return out;
}
function parseHeaderFooterPart(partXml, documentXml, styles, numbering = /* @__PURE__ */ new Map(), theme = /* @__PURE__ */ new Map(), partName = null) {
  const nsMatch = documentXml.match(/<w:document([^>]*)>/);
  const ns = nsMatch ? nsMatch[1] : ' xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  const openAt = partXml.indexOf("<w:hdr") >= 0 ? partXml.indexOf("<w:hdr") : partXml.indexOf("<w:ftr");
  if (openAt < 0) return [];
  const gt = partXml.indexOf(">", openAt);
  const closeAt = partXml.lastIndexOf("</");
  if (gt < 0 || closeAt < 0) return [];
  const inner = partXml.slice(gt + 1, closeAt);
  try {
    const wrapped = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document${ns}><w:body>${inner}</w:body></w:document>`;
    const ps = parseDocument(wrapped, styles, numbering, theme).paragraphs;
    if (partName) for (const q of ps) for (const a of q.anchors ?? []) a.part = partName;
    return ps;
  } catch {
    return [];
  }
}
function notePreferences(settingsXml, kind) {
  const defaults = kind === "footnote" ? { start: 1, restart: "continuous", fmt: "decimal", position: "pageBottom" } : { start: 1, restart: "continuous", fmt: "decimal", position: "docEnd" };
  if (!settingsXml) return defaults;
  const block = settingsXml.match(new RegExp(`<w:${kind}Pr\\b[\\s\\S]*?</w:${kind}Pr>`))?.[0];
  if (!block) return defaults;
  const val = (tag) => block.match(new RegExp(`<w:${tag}\\b[^>]*w:val="([^"]+)"`))?.[1];
  return {
    start: Number(val("numStart") ?? defaults.start) || defaults.start,
    restart: val("numRestart") ?? defaults.restart,
    fmt: val("numFmt") ?? defaults.fmt,
    position: val("pos") ?? defaults.position
  };
}

// outputs/active/2026-11-17-mushaf-preview/integrated-private-previews/shamela-inline-headings-review/windows/source/packages/ooxml-model/src/word_parenthesis_symbol_slots.ts
function nativeWordParenthesisSymbolSlot(run, noteParagraph = false, ownedCustomMark) {
  const slot = run.nativeWordSymbolOffsets;
  if (slot?.length !== 1 || slot[0].at !== 0 || slot[0].length !== 1 || run.text.length !== 1 || (run.sourceText ?? run.text) !== run.text || run.hidden || run.noteBodyRef) return false;
  const family = /^Khizana Native [a-f0-9]{20}$/.test(run.family ?? "") ? run.nativeSourceFamily : run.family;
  if (run.nativeCsFamily && run.nativeCsFamily.toLowerCase() !== family?.toLowerCase()) return false;
  if (noteParagraph && !run.noteRef && family?.trim() && /^[\ue000-\uf8ff]$/u.test(run.text) && ownedCustomMark === run.text) return true;
  const note = run.noteRef;
  if (family?.trim() && /^[\ue000-\uf8ff]$/u.test(run.text) && note?.custom === true && note.customMark === run.text && typeof note.id === "string" && note.id.length > 0 && (note.kind === "footnote" || note.kind === "endnote")) return true;
  if (!run.noteRef && (/^Symbol$/iu.test(family ?? "") && /^[\uf021\uf074]$/u.test(run.text) || /^Wingdings$/iu.test(family ?? "") && /^[\uf03f\uf04a\uf04c]$/u.test(run.text))) return true;
  if (/^Symbol$/iu.test(family ?? "") && run.text === "\uF0B7" && !run.noteRef) return true;
  return /^Wingdings 2$/iu.test(family ?? "") && /^[\uf075-\uf077]$/u.test(run.text) && (run.noteRef?.custom === true && run.noteRef.customMark === run.text || noteParagraph && !run.noteRef);
}

// outputs/active/2026-11-17-mushaf-preview/integrated-private-previews/shamela-inline-headings-review/windows/source/packages/ooxml-model/src/word_hidden_source.ts
function hiddenWordSource(paragraph) {
  if (!paragraph.runs.some((run) => run.hidden && Boolean(run.sourceText ?? run.text))) return;
  let raw = "", visible = "", comVisible = "";
  const intervals = [];
  for (const run of paragraph.runs) {
    const value = run.noteBodyRef || run.noteRef && !run.noteRef.custom ? "" : run.sourceText ?? run.text;
    const start = raw.length;
    raw += value;
    if (run.hidden) {
      if (value.length) intervals.push([start, raw.length]);
    } else {
      visible += value;
      const legacyMark = run.family === "Symbol" && value === "\uF02A" && run.noteRef?.custom === true && run.noteRef.customMark === "\uF02A";
      const symbol = run.nativeWordSymbolOffsets?.length === 1 ? run.nativeWordSymbolOffsets[0] : void 0;
      const family = /^Khizana Native [a-f0-9]{20}$/.test(run.family ?? "") ? run.nativeSourceFamily : run.family;
      const arabesqueMark = family === "AGA Arabesque" && !run.noteRef && !run.noteBodyRef && value === run.text && symbol?.at === 0 && symbol.length === 1 && /^[\uf074\uf07b\uf07d]$/u.test(value);
      comVisible += legacyMark || arabesqueMark ? "(" : value;
    }
  }
  return { raw, visible, comVisible, intervals, ownedInline: paragraph.anchors?.length === 1 && paragraph.anchors[0]?.inlineFlow === true };
}

// outputs/active/2026-11-17-mushaf-preview/integrated-private-previews/shamela-inline-headings-review/windows/source/packages/ooxml-model/src/word_page_alignment.ts
var normalizeWordPageText = (value) => value.replace(/[\u0013-\u0015]/g, "").replace(/[\r\u0001\u0007\u000e]/g, " ").replace(/\s+/g, " ").trim();
function matchesWordPageText(wordValue, modelValue) {
  if (wordValue === modelValue) return true;
  if (!wordValue.includes("")) return false;
  const escaped = wordValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\u0002/g, "[0-9\u0660-\u0669]+");
  return new RegExp(`^${escaped}$`, "u").test(modelValue);
}
function matchesHqpbSymbolProjection(word, paragraph) {
  let projected = "", count = 0;
  for (const run of paragraph.runs) {
    if (run.hidden) continue;
    const value = run.sourceText ?? run.text;
    if (!/^HQPB[1-5]$/.test(run.family ?? "") || run.noteRef || run.noteBodyRef) {
      projected += value;
      continue;
    }
    const slots = new Set((run.nativeWordSymbolOffsets ?? []).filter((slot) => slot.length === 1 && /^[\uf000-\uf0ff]$/u.test(value[slot.at] ?? "")).map((slot) => slot.at));
    for (let offset = 0; offset < value.length; offset++) {
      if (slots.has(offset)) {
        projected += "(";
        count++;
      } else projected += value[offset];
    }
  }
  return count > 0 && normalizeWordPageText(projected) === word;
}
function matchesWordPageParagraph(wordValue, paragraph) {
  const word = normalizeWordPageText(wordValue), model = normalizeWordPageText(paragraph.text);
  if (!model && /^\/+$/u.test(word) && word.length === paragraph.anchors?.filter((anchor) => anchor.inlineFlow).length) return true;
  if (matchesWordPageText(word, model)) return true;
  if (matchesHqpbSymbolProjection(word, paragraph)) return true;
  const isLegacyNoteStar = (run) => /^Symbol$/iu.test(run.family ?? "") && run.text === "\uF02A" && run.noteRef?.custom === true && run.noteRef.customMark === "\uF02A";
  const renderedRuns = paragraph.runs.filter((run) => !run.hidden);
  if (renderedRuns.some(isLegacyNoteStar) && normalizeWordPageText(renderedRuns.map((run) => run.text).join("")) === model) {
    const comText = renderedRuns.map((run) => isLegacyNoteStar(run) ? "(" : run.noteRef?.custom === false ? "" : run.text).join("");
    if (normalizeWordPageText(comText) === word) return true;
  }
  const hidden = hiddenWordSource(paragraph);
  if (hidden && normalizeWordPageText(hidden.visible) === model && matchesWordPageText(word, normalizeWordPageText(hidden.raw))) return true;
  const inline = paragraph.anchors?.filter((anchor) => anchor.inlineFlow) ?? [];
  if (inline.length && inline.every((anchor) => wordInlineSourcePositions.has(anchor))) {
    let imageStory = paragraph.text;
    for (const at of inline.map((anchor) => wordInlineSourcePositions.get(anchor)).sort((a, b) => b - a))
      imageStory = imageStory.slice(0, at) + "/" + imageStory.slice(at);
    if (matchesWordPageText(word, normalizeWordPageText(imageStory))) return true;
  }
  const authoredFamily = (run) => /^Khizana Native [a-f0-9]{20}$/.test(run.family ?? "") ? run.nativeSourceFamily ?? run.family ?? "" : run.family ?? "";
  const provedSymbolRun = (run) => /^(?:AGA Arabesque|KFGQPC Arabic Symbols 0[12])$/iu.test(authoredFamily(run)) && (!run.nativeCsFamily || /^(?:AGA Arabesque|KFGQPC Arabic Symbols 0[12])$/iu.test(run.nativeCsFamily)) || nativeWordParenthesisSymbolSlot(run) || /^Symbol$/iu.test(authoredFamily(run)) && run.text === "\uF0D2" && run.noteRef?.custom === true && run.noteRef.customMark === "\uF0D2";
  const visibleRuns = paragraph.runs.filter((run) => !run.hidden);
  let alignmentSources = visibleRuns.map((run) => run.sourceText ?? run.text);
  let alignedSource = normalizeWordPageText(alignmentSources.join("")) === model;
  if (!alignedSource && visibleRuns.some((run) => run.noteRef && !run.noteRef.custom && run.sourceText === "")) {
    const referenceSources = visibleRuns.map((run) => run.noteRef && !run.noteRef.custom && run.sourceText === "" ? run.text : run.sourceText ?? run.text);
    if (normalizeWordPageText(referenceSources.join("")) === model) {
      alignmentSources = referenceSources;
      alignedSource = true;
    }
  }
  if (alignedSource) {
    let candidates = [""], symbolSlots = 0;
    for (const [index, run] of visibleRuns.entries()) {
      const source = alignmentSources[index];
      let variants = [source];
      if (provedSymbolRun(run) && /^[\uF000-\uF0FF]$/u.test(run.text)) {
        symbolSlots++;
        variants = [.../* @__PURE__ */ new Set([
          source,
          run.text,
          "(",
          .../^AGA Arabesque$/iu.test(authoredFamily(run)) && run.sourceText === "(" ? [""] : []
        ])];
      }
      if (candidates.length * variants.length > 256) {
        candidates = [];
        break;
      }
      candidates = candidates.flatMap((prefix) => variants.map((value) => prefix + value));
    }
    if (symbolSlots && candidates.some((value) => matchesWordPageText(word, normalizeWordPageText(value)))) return true;
  }
  if (paragraph.runs.map((run) => run.text).join("") === paragraph.text) {
    const byRun = normalizeWordPageText(paragraph.runs.map((run) => provedSymbolRun(run) ? run.text.replace(/[\uF000-\uF0FF]/gu, "(") : run.text).join(""));
    if (matchesWordPageText(word, byRun)) return true;
  }
  const symbols = new Set(paragraph.runs.filter(provedSymbolRun).flatMap((run) => [...run.text].filter((char) => /[\uF000-\uF0FF]/u.test(char))));
  for (const char of symbols) {
    const unproved = paragraph.runs.some((run) => run.text.includes(char) && !provedSymbolRun(run));
    if (unproved) symbols.delete(char);
  }
  const comparableModel = normalizeWordPageText([...paragraph.text].map((char) => symbols.has(char) ? "(" : char).join(""));
  if (symbols.size && matchesWordPageText(word, comparableModel)) return true;
  if (paragraph.anchors?.filter((anchor) => anchor.inlineFlow).length === 1) {
    if (/^\s*\n/u.test(paragraph.text) && word.startsWith("/ ") && matchesWordPageText(word.slice(2), comparableModel)) return true;
    if (/\n\s*$/u.test(paragraph.text) && word.endsWith(" /") && matchesWordPageText(word.slice(0, -2), comparableModel)) return true;
  }
  if (paragraph.runs.some((run) => run.noteRef) && /\(\s*\)/u.test(word)) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\(\s*\\\)/g, "\\([0-9\u0660-\u0669]+\\)");
    if (new RegExp(`^${escaped}$`, "u").test(model)) return true;
  }
  if (/\t[0-9٠-٩]+\s*$/u.test(paragraph.text)) {
    const withoutPage = (value) => value.replace(/\s+[0-9٠-٩]+\s*$/u, "").trim();
    const compact = (value) => withoutPage(value).replace(/\s+/g, "");
    if (compact(word) === compact(model)) return true;
  }
  if (/\.{10,}/.test(model) && /\.{10,}/.test(word)) {
    const leader = (value) => {
      const [prefix = "", suffix = ""] = value.split(/\.{10,}/, 2);
      return [prefix.replace(/\s+/g, ""), suffix.replace(/\D/g, "").replace(/^0+/, "")];
    };
    const [wordPrefix, wordNumber] = leader(word), [modelPrefix, modelNumber] = leader(model);
    if (wordPrefix === modelPrefix && wordNumber === modelNumber && wordNumber.length > 0) return true;
  }
  const decorative = paragraph.runs.length > 0 && paragraph.runs.every((run) => /(?:arabesque|wingdings|webdings|symbol)/i.test(authoredFamily(run))) && !/[\p{L}\p{N}]/u.test(word) && !/[\p{L}\p{N}]/u.test(model);
  return decorative;
}
function alignWordParagraphIndices(model, map) {
  const word = map.paragraphs ?? [];
  if (!word.length) return null;
  const modelText = model.paragraphs.map((p) => normalizeWordPageText(p.text));
  const wordText = word.map((p) => normalizeWordPageText(p.text));
  if (word.length === model.paragraphs.length) {
    const directWordText = wordText.map((text, index) => text === "/" && !modelText[index] && model.paragraphs[index]?.anchors?.some((anchor) => anchor.inlineFlow) ? "" : text);
    if (directWordText.every((text, index) => matchesWordPageParagraph(text, model.paragraphs[index]))) {
      return word.map((_, index) => index);
    }
  }
  const material = model.paragraphs.map((paragraph, index) => ({
    paragraph,
    index,
    optional: !modelText[index] && Boolean(paragraph.anchors?.some((anchor) => anchor.inlineFlow))
  })).filter((item) => modelText[item.index] || item.optional);
  const wordNonEmpty = wordText.map((text, index) => ({ text, index })).filter((item) => item.text);
  const required = Array(material.length + 1).fill(0);
  for (let i = material.length - 1; i >= 0; i--) required[i] = required[i + 1] + (material[i].optional ? 0 : 1);
  const stack = [{ i: 0, j: 0, branch: 0 }], failed = /* @__PURE__ */ new Set();
  let matched = false;
  while (stack.length) {
    const frame = stack[stack.length - 1], key = frame.i * (wordNonEmpty.length + 1) + frame.j;
    const remaining = wordNonEmpty.length - frame.j;
    if (failed.has(key) || remaining < required[frame.i] || remaining > material.length - frame.i) {
      stack.pop();
      continue;
    }
    if (frame.i === material.length) {
      if (frame.j === wordNonEmpty.length) {
        matched = true;
        break;
      }
      stack.pop();
      continue;
    }
    const item = material[frame.i];
    if (frame.branch === 0) {
      frame.branch = 1;
      if (frame.j < wordNonEmpty.length && matchesWordPageParagraph(wordNonEmpty[frame.j].text, item.paragraph)) {
        frame.consumed = true;
        stack.push({ i: frame.i + 1, j: frame.j + 1, branch: 0 });
        continue;
      }
    }
    if (frame.branch === 1) {
      frame.branch = 2;
      if (item.optional) {
        frame.consumed = false;
        stack.push({ i: frame.i + 1, j: frame.j, branch: 0 });
        continue;
      }
    }
    failed.add(key);
    stack.pop();
  }
  if (!matched) return null;
  const materialPairs = stack.slice(0, -1).filter((frame) => frame.consumed).map((frame) => ({
    model: material[frame.i].index,
    word: wordNonEmpty[frame.j].index
  }));
  const assigned = Array(model.paragraphs.length);
  const pairs = [
    { model: -1, word: -1 },
    ...materialPairs,
    { model: model.paragraphs.length, word: word.length }
  ];
  for (let p = 1; p + 1 < pairs.length; p++)
    assigned[pairs[p].model] = pairs[p].word;
  for (let p = 0; p + 1 < pairs.length; p++) {
    const a = pairs[p], b = pairs[p + 1];
    const modelCount = b.model - a.model - 1, wordCount = b.word - a.word - 1;
    for (let offset = 0; offset < modelCount; offset++) {
      let wordIndex;
      if (wordCount > 0)
        wordIndex = a.word + 1 + Math.min(wordCount - 1, Math.floor((offset + 0.5) * wordCount / modelCount));
      else wordIndex = a.word >= 0 ? a.word : b.word;
      const fallback = a.word >= 0 ? a.word : b.word;
      assigned[a.model + 1 + offset] = word[wordIndex] ? wordIndex : fallback;
    }
  }
  return assigned.every((index) => Number.isInteger(index) && index >= 0 && index < word.length) ? assigned : null;
}

// outputs/active/2026-11-17-mushaf-preview/integrated-private-previews/shamela-inline-headings-review/windows/source/packages/ooxml-model/src/index.ts
function extractFromDocx(bytes) {
  const {
    documentXml,
    stylesXml,
    settingsXml,
    numberingXml,
    footnotesXml,
    endnotesXml,
    headerFooterParts,
    documentRels,
    themeXml,
    partRels,
    diagramDrawings,
    chartParts,
    mediaFiles,
    embeddedFonts
  } = openDocx(bytes);
  documentPartContext.partRelsRef = partRels;
  documentPartContext.diagramsRef = diagramDrawings;
  documentPartContext.chartsRef = chartParts;
  documentPartContext.partNameRef = "document.xml";
  const theme = parseTheme(themeXml, settingsXml);
  const styles = parseStyles(stylesXml, theme);
  const numbering = parseNumbering(numberingXml);
  const printsHiddenText = /<(?:[\w.-]+:)?printHiddenText\b[^>]*>/i.test(settingsXml ?? "");
  const model = parseDocument(documentXml, styles, numbering, theme, documentRels, !printsHiddenText);
  const resolveMarginRef = (rid) => {
    const target = documentRels.get(rid) ?? rid;
    return target.replace(/^\.\.\//, "").replace(/^word\//, "");
  };
  for (const section of model.sections) {
    if (section.headerRefs) section.headerRefs = Object.fromEntries(
      Object.entries(section.headerRefs).map(([kind, rid]) => [kind, resolveMarginRef(rid)])
    );
    if (section.footerRefs) section.footerRefs = Object.fromEntries(
      Object.entries(section.footerRefs).map(([kind, rid]) => [kind, resolveMarginRef(rid)])
    );
  }
  model.compatibilityMode = compatibilityMode(settingsXml);
  model.defaultTabStop = defaultTabStop(settingsXml);
  const backgroundSetting = (settingsXml ?? "").match(/<w:displayBackgroundShape\b([^>]*)>/)?.[1];
  const backgroundEnabled = backgroundSetting !== void 0 && !/\bw:val\s*=\s*["'](?:0|false|off)["']/i.test(backgroundSetting);
  if (!backgroundEnabled) delete model.pageBackground;
  model.numbering = numbering;
  model.footnotes = parseNotes(footnotesXml, documentXml, styles, numbering, "w:footnote", theme);
  model.endnotes = parseNotes(endnotesXml, documentXml, styles, numbering, "w:endnote", theme);
  model.noteSettings = {
    footnote: notePreferences(settingsXml, "footnote"),
    endnote: notePreferences(settingsXml, "endnote")
  };
  const counters = {
    footnote: model.noteSettings.footnote.start - 1,
    endnote: model.noteSettings.endnote.start - 1
  };
  let previousSection = -1;
  for (let pi = 0; pi < model.paragraphs.length; pi++) {
    const paragraph = model.paragraphs[pi];
    const sectionChanged = previousSection >= 0 && paragraph.sectionIndex !== previousSection;
    previousSection = paragraph.sectionIndex;
    for (const kind of ["footnote", "endnote"]) {
      const local = model.sections[paragraph.sectionIndex]?.[`${kind}Pr`];
      const pref = { ...model.noteSettings[kind], ...local };
      if (pref.restart === "eachPage" && paragraph.pageBreakBefore && pi > 0 || sectionChanged && (pref.restart === "eachSect" || local?.start != null))
        counters[kind] = pref.start - 1;
    }
    for (const run of paragraph.runs) {
      const ref = run.noteRef;
      if (!ref) continue;
      const kind = ref.kind === "endnote" ? "endnote" : "footnote";
      const local = model.sections[paragraph.sectionIndex]?.[`${kind}Pr`];
      const pref = { ...model.noteSettings[kind], ...local };
      if (!ref.custom) ref.num = ++counters[kind];
      ref.fmt = pref.fmt;
    }
  }
  model.relTargets = documentRels;
  model.partRels = partRels;
  model.mediaFiles = mediaFiles;
  model.embeddedFonts = embeddedFonts;
  const evenOdd = (settingsXml ?? "").match(/<w:evenAndOddHeaders\b([^>]*)\/?\s*>/);
  const evenOddVal = evenOdd?.[1]?.match(/w:val="([^"]+)"/)?.[1];
  model.evenAndOddHeaders = Boolean(evenOdd) && !["0", "false", "off"].includes(evenOddVal ?? "");
  for (const [name, xml] of headerFooterParts)
    model.headerFooters.set(name, parseHeaderFooterPart(xml, documentXml, styles, numbering, theme, name));
  return model;
}
export {
  alignWordParagraphIndices,
  extractFromDocx
};
