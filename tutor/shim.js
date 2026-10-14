/* ============================================================
   AgentDB Bridge shim (v2 — 서버 DB 연결판)
   1순위: /api/tutor (PostgreSQL, 실제 저장)
   2순위: 번들된 SQLite 스냅샷(sql.js, 읽기 전용 데모) — API 미설정/실패 시
   ============================================================ */
(function () {
  var TOKEN = window.TUTOR_TOKEN || "";
  var API = "/api/tutor";
  var usingDb = null; // null=미확정, true=DB, false=로컬 스냅샷
  var SELF = (document.currentScript && document.currentScript.src) || "";
  var DIR = SELF ? SELF.replace(/[^\/]*$/, "") : "/tutor/";

  function b64utf8(b64) {
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = src;
      s.onload = res;
      s.onerror = function () { rej(new Error("불러오기 실패: " + src)); };
      document.head.appendChild(s);
    });
  }

  /* ---------- 로컬(스냅샷) 백엔드 ---------- */
  var localReady = null;
  var ldb = null;
  var lqueries = null;
  var OVERRIDES = null;

  function initLocal() {
    if (localReady) return localReady;
    localReady = (async function () {
      if (typeof initSqlJs !== "function") {
        await loadScript("https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/sql-wasm.js");
      }
      if (!window.TUTOR_DB_B64) await loadScript(DIR + "data/db.js");
      if (!window.TUTOR_QUERIES_B64) await loadScript(DIR + "data/queries.js");
      if (!window.TUTOR_SQL_OVERRIDES) await loadScript(DIR + "data/overrides.js");
      OVERRIDES = window.TUTOR_SQL_OVERRIDES || {};
      var SQL = await initSqlJs({
        locateFile: function (f) { return "https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/" + f; },
      });
      ldb = new SQL.Database();
      ldb.exec(b64utf8(window.TUTOR_DB_B64));
      var parsed = JSON.parse(b64utf8(window.TUTOR_QUERIES_B64));
      lqueries = {};
      (parsed.queries || []).forEach(function (q) { lqueries[q.name] = q; });
      return true;
    })();
    return localReady;
  }

  async function runLocal(name, params) {
    await initLocal();
    var q = lqueries[name];
    if (!q) throw new Error("알 수 없는 쿼리: " + name);
    var sql = (OVERRIDES[name] || q.sql).replace(/\$(\d+)/g, "?$1");
    var binds = (q.params || []).map(function (p) {
      var v = params ? params[p.name] : undefined;
      return v === undefined || v === null ? null : v;
    });
    var stmt = ldb.prepare(sql);
    try {
      if (binds.length) stmt.bind(binds);
      var rows = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      return rows;
    } finally {
      stmt.free();
    }
  }

  /* ---------- 상태 배지 ---------- */
  function badge() {
    var host = document.querySelector(".top .right");
    if (!host) return;
    var el = document.getElementById("db-mode");
    if (!el) {
      el = document.createElement("span");
      el.id = "db-mode";
      el.style.cssText = "font-size:11px;padding:3px 9px;border-radius:999px;font-weight:600";
      host.insertBefore(el, host.firstChild);
    }
    if (usingDb) {
      el.textContent = "DB 연결됨";
      el.style.background = "#DCF4E6";
      el.style.color = "#1f9d55";
    } else {
      el.textContent = "데모(로컬) · 저장 안 됨";
      el.style.background = "#FBEBD0";
      el.style.color = "#b7791f";
    }
  }

  /* ---------- 공개 API ---------- */
  var api = {
    mode: "unknown",
    isConnected: function () { return usingDb === true; },
    async executeQuery(name, params) {
      params = params || {};
      if (usingDb !== false) {
        try {
          var r = await fetch(API, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-tutor-token": TOKEN },
            body: JSON.stringify({ q: name, params: params }),
          });
          if (r.ok) {
            var j = await r.json();
            if (j && Array.isArray(j.rows)) {
              usingDb = true; api.mode = "db"; badge();
              return { rows: j.rows };
            }
          } else if (r.status === 404 || r.status === 401 || r.status === 405 || r.status === 503 || r.status === 500) {
            usingDb = false;
          }
        } catch (e) {
          usingDb = false;
        }
      }
      var rows = await runLocal(name, params);
      usingDb = false; api.mode = "local"; badge();
      return { rows: rows };
    },
    async getSchema() {
      if (usingDb) return { tables: [] };
      await initLocal();
      var res = ldb.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
      return { tables: res.length ? res[0].values.map(function (r) { return r[0]; }) : [] };
    },
    async getAppInfo() {
      return { id: "local", name: "AI 튜터 학습관리 시스템", scope: "workspace" };
    },
  };

  document.addEventListener("DOMContentLoaded", function () { setTimeout(badge, 300); });
  window.agentdb = api;
})();
