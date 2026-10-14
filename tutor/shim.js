/* ============================================================
   AgentDB Bridge shim — 정적(sql.js) 백엔드
   원본 대시보드는 window.agentdb.executeQuery(name, params) 를
   호출합니다. 여기서는 번들된 SQLite 덤프를 메모리에 올려
   같은 인터페이스로 응답합니다(읽기 전용, 쓰기는 세션 내에서만 반영).
   ============================================================ */
(function () {
  function b64utf8(b64) {
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  var OVERRIDES = window.TUTOR_SQL_OVERRIDES || {};
  var SQL_CDN = "https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/";

  var api = {
    _db: null,
    _queries: null,
    ready: null,

    async executeQuery(name, params) {
      await api.ready;
      var q = api._queries[name];
      if (!q) throw new Error("알 수 없는 쿼리: " + name);
      var sql = (OVERRIDES[name] || q.sql).replace(/\$(\d+)/g, "?$1");
      var binds = (q.params || []).map(function (p) {
        var v = params ? params[p.name] : undefined;
        return v === undefined || v === null ? null : v;
      });
      var stmt = api._db.prepare(sql);
      try {
        if (binds.length) stmt.bind(binds);
        var rows = [];
        while (stmt.step()) rows.push(stmt.getAsObject());
        return { rows: rows };
      } finally {
        stmt.free();
      }
    },

    async getSchema() {
      await api.ready;
      var res = api._db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
      var tables = res.length ? res[0].values.map(function (r) { return r[0]; }) : [];
      return { tables: tables };
    },

    async getAppInfo() {
      return { id: "local", name: "AI 튜터 학습관리 시스템", scope: "workspace" };
    },
  };

  api.ready = (async function () {
    if (!window.TUTOR_DB_B64 || !window.TUTOR_QUERIES_B64) {
      throw new Error("데이터 번들(data/db.js, data/queries.js)을 찾을 수 없습니다.");
    }
    if (typeof initSqlJs !== "function") {
      throw new Error("sql.js 라이브러리를 불러오지 못했습니다(네트워크 확인).");
    }
    var SQL = await initSqlJs({ locateFile: function (f) { return SQL_CDN + f; } });
    var db = new SQL.Database();
    db.exec(b64utf8(window.TUTOR_DB_B64));
    var parsed = JSON.parse(b64utf8(window.TUTOR_QUERIES_B64));
    var map = {};
    (parsed.queries || []).forEach(function (q) { map[q.name] = q; });
    api._db = db;
    api._queries = map;
    return true;
  })().catch(function (e) {
    var el = document.getElementById("route");
    if (el) {
      el.innerHTML =
        '<div class="err-note" style="margin:20px">데이터 엔진 초기화 실패: ' +
        (e && e.message ? e.message : e) +
        "<br>인터넷 연결을 확인한 뒤 새로고침하세요.</div>";
    }
    throw e;
  });

  window.agentdb = api;
})();
