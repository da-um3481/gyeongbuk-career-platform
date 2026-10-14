/* ============================================================
   튜터 대시보드 — 비밀번호 게이트
   · 인증 전에는 앱 스크립트를 전혀 로드하지 않습니다.
   · 입력한 비밀번호는 SHA-256 해시로 비교(평문 미저장).
   · 인증 후 그 값을 API 토큰(x-tutor-token)으로 사용합니다.
   ============================================================ */
(function () {
  var EXPECTED = "0c793046af5ee30ce4f901f3b7af9f5ad85bc47487d36396635dc802789099b4"; // daum-tutor-2026
  var KEY_OK = "tutor_ok";
  var KEY_PW = "tutor_pw";

  var SELF = (document.currentScript && document.currentScript.src) || "";
  var DIR = SELF ? SELF.replace(/[^\/]*$/, "") : "/tutor/";

  /* ---------- 순수 JS SHA-256 (UTF-8) ---------- */
  function utf8(s) {
    var out = "", i, c;
    for (i = 0; i < s.length; i++) {
      c = s.charCodeAt(i);
      if (c < 128) out += String.fromCharCode(c);
      else if (c < 2048) out += String.fromCharCode(192 | (c >> 6), 128 | (c & 63));
      else if (c < 55296 || c >= 57344) out += String.fromCharCode(224 | (c >> 12), 128 | ((c >> 6) & 63), 128 | (c & 63));
      else {
        i++;
        c = 65536 + (((c & 1023) << 10) | (s.charCodeAt(i) & 1023));
        out += String.fromCharCode(240 | (c >> 18), 128 | ((c >> 12) & 63), 128 | ((c >> 6) & 63), 128 | (c & 63));
      }
    }
    return out;
  }
  function sha256(input) {
    var ascii = utf8(input);
    function rr(v, a) { return (v >>> a) | (v << (32 - a)); }
    var mp = Math.pow, mw = mp(2, 32), result = "", words = [], bitLen = ascii.length * 8;
    var hash = sha256._h = sha256._h || [], k = sha256._k = sha256._k || [];
    var pc = k.length, comp = {};
    for (var cand = 2; pc < 64; cand++) {
      if (!comp[cand]) {
        for (var q = 0; q < 313; q += cand) comp[q] = cand;
        hash[pc] = (mp(cand, 0.5) * mw) | 0;
        k[pc++] = (mp(cand, 1 / 3) * mw) | 0;
      }
    }
    ascii += "\x80";
    while (ascii.length % 64 - 56) ascii += "\x00";
    for (var i = 0; i < ascii.length; i++) words[i >> 2] |= ascii.charCodeAt(i) << (((3 - i) % 4) * 8);
    words[words.length] = (bitLen / mw) | 0;
    words[words.length] = bitLen;
    for (var j = 0; j < words.length; ) {
      var w = words.slice(j, (j += 16)), oldHash = hash;
      hash = hash.slice(0, 8);
      for (i = 0; i < 64; i++) {
        var w15 = w[i - 15], w2 = w[i - 2], a = hash[0], e = hash[4];
        var t1 = hash[7] + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & hash[5]) ^ (~e & hash[6])) + k[i] +
          (w[i] = (i < 16) ? w[i] : (w[i - 16] + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))) | 0);
        var t2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(t1 + t2) | 0].concat(hash);
        hash[4] = (hash[4] + t1) | 0;
      }
      for (i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
    }
    for (i = 0; i < 8; i++) {
      for (j = 3; j + 1; j--) {
        var b = (hash[i] >> (j * 8)) & 255;
        result += (b < 16 ? "0" : "") + b.toString(16);
      }
    }
    return result;
  }

  /* ---------- 앱 부팅 ---------- */
  var FILES = ["shim.js", "sections/routes.js", "sections/main.js", "extras.js"];
  function boot(pw) {
    window.TUTOR_TOKEN = pw || "";
    var g = document.getElementById("auth-gate");
    if (g) g.remove();
    var shell = document.querySelector(".shell");
    if (shell) shell.style.visibility = "";
    (function next(i) {
      if (i >= FILES.length) return;
      var s = document.createElement("script");
      s.src = DIR + FILES[i];
      s.onload = function () { next(i + 1); };
      s.onerror = function () { next(i + 1); };
      document.head.appendChild(s);
    })(0);
  }

  /* ---------- 게이트 화면 ---------- */
  function gate() {
    var shell = document.querySelector(".shell");
    if (shell) shell.style.visibility = "hidden";
    var d = document.createElement("div");
    d.id = "auth-gate";
    d.style.cssText = "position:fixed;inset:0;z-index:9999;background:#f7f8f9;display:grid;place-items:center;padding:20px";
    d.innerHTML =
      '<div style="background:#fff;border:1px solid #eceef1;border-radius:14px;padding:28px 26px;width:100%;max-width:340px;box-shadow:0 12px 34px rgba(18,32,46,.08)">' +
      '<img src="' + DIR + '../logo-mark.png" alt="DA.UM" style="width:68px;height:68px;display:block;margin:0 auto 10px" />' +
      '<div style="text-align:center;font-weight:800;color:#16304a">다움진로진학컨설팅</div>' +
      '<div style="text-align:center;font-size:12px;color:#6b7683;margin-bottom:18px">진학 및 학습 맞춤엔진</div>' +
      '<label style="font-size:11px;color:#4e5865">비밀번호</label>' +
      '<input id="auth-pw" type="password" autocomplete="current-password" style="width:100%;margin-top:4px;padding:9px 11px;border:1px solid #dfe3e8;border-radius:8px;font-size:14px;outline:none" />' +
      '<div id="auth-err" style="color:#c0392b;font-size:12px;height:16px;margin-top:6px"></div>' +
      '<button id="auth-go" style="width:100%;margin-top:6px;height:38px;border:0;border-radius:9px;background:#12707c;color:#fff;font-weight:700;font-size:14px;cursor:pointer">들어가기</button>' +
      "</div>";
    document.body.appendChild(d);

    var inp = document.getElementById("auth-pw");
    var err = document.getElementById("auth-err");
    function submit() {
      var v = inp.value;
      if (sha256(v) === EXPECTED) {
        try {
          sessionStorage.setItem(KEY_OK, "1");
          sessionStorage.setItem(KEY_PW, v);
        } catch (e) {}
        boot(v);
      } else {
        err.textContent = "비밀번호가 올바르지 않습니다.";
        inp.value = "";
        inp.focus();
      }
    }
    document.getElementById("auth-go").onclick = submit;
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter") submit(); });
    setTimeout(function () { inp.focus(); }, 40);
  }

  function start() {
    var ok = null, pw = "";
    try { ok = sessionStorage.getItem(KEY_OK); pw = sessionStorage.getItem(KEY_PW) || ""; } catch (e) {}
    if (ok === "1" && pw && sha256(pw) === EXPECTED) boot(pw);
    else gate();
  }

  window.TUTOR_LOGOUT = function () {
    try { sessionStorage.removeItem(KEY_OK); sessionStorage.removeItem(KEY_PW); } catch (e) {}
    location.reload();
  };
  window.__tutorSha256 = sha256;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
