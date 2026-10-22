/* ============================================================
   자료실 — 교재·처방자료 관리 (등록/수정/중지/최종확인일)
   원본 main.js 는 한 줄 훅(window.EXTRA_ROUTES)으로만 연결합니다.
   ============================================================ */
(function () {
  var S = { tab: "content", q: "", subject: "", rtype: "", rows: [], meta: [] };
  var EDIT = null; // 수정 중인 행
  var timer = null;

  function $(id) { return document.getElementById(id); }
  function esc(v) {
    var d = document.createElement("div");
    d.textContent = v == null ? "" : String(v);
    return d.innerHTML;
  }
  function toast(msg) {
    var t = $("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(function () { t.classList.remove("show"); }, 2200);
  }
  function openModal(html) {
    var m = $("modal");
    m.innerHTML = '<div class="modal">' + html + "</div>";
    m.classList.add("show");
    m.onclick = function (e) { if (e.target === m) closeModal(); };
  }
  function closeModal() {
    var m = $("modal");
    m.classList.remove("show");
    m.innerHTML = "";
  }
  function val(id) { var e = $(id); return e ? String(e.value || "").trim() : ""; }

  function connected() {
    return !!(window.agentdb && window.agentdb.isConnected && window.agentdb.isConnected());
  }
  function exec(name, params) {
    return window.agentdb.executeQuery(name, params || {});
  }

  /* ---------- 현행성 표시 ---------- */
  function daysSince(d) {
    if (!d) return null;
    var t = Date.parse(String(d).slice(0, 10));
    if (isNaN(t)) return null;
    return Math.floor((Date.now() - t) / 86400000);
  }
  function verifiedCell(row) {
    var d = daysSince(row.verified_on);
    if (d === null) return '<span class="pill pill-danger">미확인</span>';
    var txt = String(row.verified_on).replace(/-/g, ".");
    if (d > 365) return '<span class="pill pill-warn">'  + txt + " · " + Math.floor(d / 365) + "년 전</span>";
    if (d > 180) return '<span class="pill pill-warn">' + txt + " · " + d + "일 전</span>";
    return '<span class="pill pill-ok">' + txt + "</span>";
  }
  function statusCell(s) {
    if (s === "중지") return '<span class="pill">중지</span>';
    return '<span class="pill pill-ok">' + esc(s || "활성") + "</span>";
  }

  /* ---------- 화면 ---------- */
  function tabBtn(id, label) {
    var on = S.tab === id;
    return '<button class="lib-tab' + (on ? " on" : "") + '" data-tab="' + id + '">' + esc(label) + "</button>";
  }

  function shell(root) {
    root.innerHTML =
      '<div class="hero"><div class="micro">자료실</div><h1>교재·처방자료 관리</h1>' +
        "<p>상담·처방에 쓰는 교재와 자료를 직접 등록·수정하고, 최종 확인일로 현행성을 관리합니다.</p></div>" +
      '<div class="panel" style="margin-bottom:12px">' +
        '<div class="lib-tabs">' + tabBtn("content", "학습 콘텐츠·교재") + tabBtn("rx", "처방 자료") + "</div>" +
        '<div class="lib-bar">' +
          '<input id="lib-q" type="search" placeholder="제목·태그·출처 검색" value="' + esc(S.q) + '" />' +
          '<select id="lib-sub"></select>' +
          '<select id="lib-rtype"><option value="">분류 전체</option>' +
            ["교재", "도서", "문제집", "영상", "문제", "기타"].map(function (v) {
              return '<option value="' + v + '"' + (S.rtype === v ? " selected" : "") + ">" + v + "</option>";
            }).join("") + "</select>" +
          '<button class="btn primary" id="lib-add">＋ 자료 등록</button>' +
        "</div>" +
        '<div id="lib-note" class="lib-note"></div>' +
      "</div>" +
      '<div class="panel" id="lib-list"><div class="skl" style="width:40%"></div></div>';

    document.querySelectorAll(".lib-tab").forEach(function (b) {
      b.onclick = function () { S.tab = b.dataset.tab; S.q = ""; S.subject = ""; paint(); load(); };
    });
    $("lib-q").oninput = function () {
      clearTimeout(timer);
      var v = this.value;
      timer = setTimeout(function () { S.q = v.trim(); load(); }, 250);
    };
    $("lib-sub").onchange = function () { S.subject = this.value; load(); };
    $("lib-rtype").onchange = function () { S.rtype = this.value; load(); };
    $("lib-add").onclick = function () { openForm(null); };
    paint();
  }

  function paint() {
    var rx = S.tab === "rx";
    $("lib-rtype").style.display = rx ? "" : "none";
    document.querySelectorAll(".lib-tab").forEach(function (b) {
      b.classList.toggle("on", b.dataset.tab === S.tab);
    });
    var sel = $("lib-sub");
    if (sel && !sel.dataset.filled) {
      sel.innerHTML = '<option value="">과목 전체</option>' +
        S.meta.map(function (m) { return '<option value="' + m.id + '">' + esc(m.subject_name) + "</option>"; }).join("");
      sel.dataset.filled = "1";
      sel.value = S.subject;
    }
  }

  async function render(root) {
    var okBanner;
    if (!connected()) {
      root.innerHTML =
        '<div class="hero"><div class="micro">자료실</div><h1>교재·처방자료 관리</h1></div>' +
        '<div class="err-note">DB에 연결되지 않아 자료를 관리할 수 없습니다. (데모 모드)<br />' +
        "Vercel 환경변수 DATABASE_URL · TUTOR_TOKEN 을 확인한 뒤 재배포하세요.</div>";
      return;
    }
    shell(root);
    try {
      var m = await exec("wa_lib_meta", {});
      S.meta = m.rows || [];
    } catch (e) { S.meta = []; }
    paint();
    await load();
  }

  async function load() {
    var box = $("lib-list");
    if (!box) return;
    box.innerHTML = '<div class="skl" style="width:50%;margin-bottom:8px"></div><div class="skl" style="width:80%"></div>';
    try {
      var r = S.tab === "rx"
        ? await exec("wa_lib_rx", { q: S.q, subject_id: S.subject, resource_type: S.rtype })
        : await exec("wa_lib_contents", { q: S.q, subject_id: S.subject });
      S.rows = r.rows || [];
      drawTable();
    } catch (e) {
      box.innerHTML = '<div class="err-note">불러오기 실패: ' + esc(e && e.message ? e.message : e) + "</div>";
    }
  }

  function drawTable() {
    var box = $("lib-list");
    var rx = S.tab === "rx";
    var stale = S.rows.filter(function (r) { var d = daysSince(r.verified_on); return d === null || d > 365; }).length;
    var title = rx ? "처방 자료" : "학습 콘텐츠·교재";
    var head = rx
      ? ["자료명", "분류", "과목", "수준", "제공처", "최종 확인", "상태", ""]
      : ["자료명", "유형", "과목", "난이도", "출처", "최종 확인", "상태", ""];

    var rows = S.rows.map(function (r) {
      var name = '<b>' + esc(r.title) + "</b>" +
        (r.tags ? '<div class="lib-sub2">' + esc(r.tags) + "</div>" : "");
      if (r.url) name = '<a href="' + esc(r.url) + '" target="_blank" rel="noopener" class="lib-link">' + name + "</a>";
      var cells = rx
        ? [name, esc(r.resource_type), esc(r.subject_name || "—"), esc(r.level || "—"),
           esc(r.provider || "—"), verifiedCell(r), statusCell(r.status)]
        : [name, esc(r.content_type || "—"), esc(r.subject_name || "—"), esc(r.difficulty || "—"),
           esc(r.source || "—"), verifiedCell(r), statusCell(r.status)];
      var btns =
        '<div class="lib-act">' +
          '<button class="mini-btn" data-act="edit" data-id="' + r.id + '">수정</button>' +
          '<button class="mini-btn" data-act="touch" data-id="' + r.id + '">확인</button>' +
          (r.status === "중지" ? "" : '<button class="mini-btn" data-act="del" data-id="' + r.id + '">중지</button>') +
        "</div>";
      return "<tr>" + cells.map(function (c, i) {
        return '<td data-label="' + esc(head[i]) + '">' + c + "</td>";
      }).join("") + "<td>" + btns + "</td></tr>";
    }).join("");

    box.innerHTML =
      '<div class="ph"><div class="pt">' + title + "</div>" +
        '<div class="pa">' + S.rows.length + "건" +
        (stale ? ' · 확인 필요 ' + stale + "건" : "") + "</div></div>" +
      (S.rows.length
        ? '<table class="tbl m-cards"><thead><tr>' + head.map(function (h) { return "<th>" + h + "</th>"; }).join("") +
          "</tr></thead><tbody>" + rows + "</tbody></table>"
        : '<div class="empty">조건에 맞는 자료가 없습니다. ‘＋ 자료 등록’으로 추가할 수 있습니다.</div>');

    box.querySelectorAll("button[data-act]").forEach(function (b) {
      b.onclick = function () { onAction(b.dataset.act, parseInt(b.dataset.id, 10)); };
    });
  }

  function findRow(id) {
    for (var i = 0; i < S.rows.length; i++) if (Number(S.rows[i].id) === Number(id)) return S.rows[i];
    return null;
  }

  async function onAction(act, id) {
    var row = findRow(id);
    if (!row) return;
    if (act === "edit") return openForm(row);
    if (act === "touch") {
      try {
        await exec(S.tab === "rx" ? "wa_lib_rx_touch" : "wa_lib_content_touch", { id: id });
        toast("최종 확인일을 오늘로 갱신했습니다");
        load();
      } catch (e) { toast("실패: " + (e && e.message ? e.message : e)); }
      return;
    }
    if (act === "del") {
      if (!confirm("‘" + row.title + "’ 을(를) 중지 처리할까요?\n(삭제 대신 ‘중지’로 남겨 이력을 보존합니다)")) return;
      try {
        await exec(S.tab === "rx" ? "wa_lib_rx_del" : "wa_lib_content_del", { id: id });
        toast("중지 처리했습니다");
        load();
      } catch (e) { toast("실패: " + (e && e.message ? e.message : e)); }
    }
  }

  /* ---------- 등록·수정 폼 ---------- */
  function opt(list, cur) {
    return list.map(function (v) {
      var value = typeof v === "string" ? v : v[0];
      var label = typeof v === "string" ? v : v[1];
      return '<option value="' + esc(value) + '"' + (String(cur || "") === String(value) ? " selected" : "") + ">" + esc(label) + "</option>";
    }).join("");
  }
  function subjOpts(cur) {
    return '<option value="">(과목 없음)</option>' + S.meta.map(function (m) {
      return '<option value="' + m.id + '"' + (String(cur || "") === String(m.id) ? " selected" : "") + ">" + esc(m.subject_name) + "</option>";
    }).join("");
  }
  function input(id, label, v, ph, type) {
    return '<label for="' + id + '">' + esc(label) + "</label>" +
      '<input id="' + id + '" type="' + (type || "text") + '" value="' + esc(v == null ? "" : v) + '" placeholder="' + esc(ph || "") + '" />';
  }
  function textarea(id, label, v, ph) {
    return '<label for="' + id + '">' + esc(label) + "</label>" +
      '<textarea id="' + id + '" placeholder="' + esc(ph || "") + '">' + esc(v == null ? "" : v) + "</textarea>";
  }

  function openForm(row) {
    EDIT = row || null;
    var rx = S.tab === "rx";
    var d = row || {};
    var html;

    if (rx) {
      html = "<h3>" + (row ? "자료 수정" : "처방 자료 등록") + "</h3>" +
        '<div class="grid2">' +
          "<div>" +
            input("f-title", "자료명 *", d.title, "예: 개념원리 RPM 중3-1") +
            '<label for="f-rtype">분류 *</label><select id="f-rtype">' +
              opt(["교재", "도서", "문제집", "영상", "문제", "기타"], d.resource_type || "교재") + "</select>" +
            '<label for="f-sub">과목</label><select id="f-sub">' + subjOpts(d.subject_id) + "</select>" +
            input("f-provider", "제공처", d.provider, "출판사·사이트") +
            input("f-url", "URL", d.url, "https://") +
          "</div>" +
          "<div>" +
            '<label for="f-level">수준</label><select id="f-level">' + opt(["", "상", "중", "하"], d.level) + "</select>" +
            input("f-target", "대상", d.target, "예: 중3, 고1") +
            input("f-tags", "태그", d.tags, "쉼표 구분") +
            input("f-verified", "최종 확인일", d.verified_on, "", "date") +
            '<label for="f-status">상태</label><select id="f-status">' + opt(["활성", "중지"], d.status || "활성") + "</select>" +
          "</div>" +
        "</div>" +
        textarea("f-note", "메모", d.note, "사용 후기·주의사항") +
        '<div class="foot"><button class="btn" id="mCancel">취소</button>' +
        '<button class="btn primary" id="mSave">' + (row ? "저장" : "등록") + "</button></div>";
    } else {
      html = "<h3>" + (row ? "자료 수정" : "학습 콘텐츠·교재 등록") + "</h3>" +
        '<div class="grid2">' +
          "<div>" +
            input("f-title", "자료명 *", d.title, "예: 실수와 제곱근 핵심정리") +
            '<label for="f-type">유형</label><select id="f-type">' +
              opt(["개념교재", "문제집", "영상", "문제", "설명자료", "기타"], d.content_type) + "</select>" +
            '<label for="f-sub">과목</label><select id="f-sub">' + subjOpts(d.subject_id) + "</select>" +
            '<label for="f-format">형식</label><select id="f-format">' + opt(["", "PDF", "영상", "인쇄", "온라인"], d.format) + "</select>" +
            '<label for="f-diff">난이도</label><select id="f-diff">' + opt(["", "상", "중", "하"], d.difficulty) + "</select>" +
            input("f-min", "예상 시간(분)", d.estimated_minutes, "30", "number") +
          "</div>" +
          "<div>" +
            input("f-author", "저자", d.author) +
            input("f-source", "출처", d.source, "출판사·자체제작") +
            input("f-url", "URL", d.url, "https://") +
            input("f-tags", "태그", d.tags, "쉼표 구분") +
            input("f-verified", "최종 확인일", d.verified_on, "", "date") +
            '<label for="f-status">상태</label><select id="f-status">' + opt(["활성", "중지"], d.status || "활성") + "</select>" +
          "</div>" +
        "</div>" +
        textarea("f-desc", "설명", d.description, "핵심 개념 요약 노트") +
        '<div class="foot"><button class="btn" id="mCancel">취소</button>' +
        '<button class="btn primary" id="mSave">' + (row ? "저장" : "등록") + "</button></div>";
    }
    openModal(html);
    $("mCancel").onclick = closeModal;
    $("mSave").onclick = save;
    setTimeout(function () { var t = $("f-title"); if (t) t.focus(); }, 30);
  }

  async function save() {
    var rx = S.tab === "rx";
    var title = val("f-title");
    if (!title) { toast("자료명을 입력하세요"); return; }
    var btn = $("mSave");
    btn.disabled = true;
    btn.textContent = "저장 중…";

    var p;
    var name;
    if (rx) {
      p = {
        id: EDIT ? EDIT.id : "",
        resource_type: val("f-rtype") || "교재",
        subject_id: val("f-sub"),
        title: title,
        provider: val("f-provider"),
        url: val("f-url"),
        level: val("f-level"),
        target: val("f-target"),
        note: val("f-note"),
        tags: val("f-tags"),
        status: val("f-status") || "활성",
        verified_at: val("f-verified"),
      };
      name = EDIT ? "wa_lib_rx_upd" : "wa_lib_rx_add";
    } else {
      p = {
        id: EDIT ? EDIT.id : "",
        subject_id: val("f-sub"),
        title: title,
        content_type: val("f-type"),
        format: val("f-format"),
        difficulty: val("f-diff"),
        estimated_minutes: val("f-min"),
        author: val("f-author"),
        source: val("f-source"),
        url: val("f-url"),
        tags: val("f-tags"),
        description: val("f-desc"),
        status: val("f-status") || "활성",
        verified_at: val("f-verified"),
      };
      name = EDIT ? "wa_lib_content_upd" : "wa_lib_content_add";
    }

    try {
      await exec(name, p);
      closeModal();
      toast(EDIT ? "수정했습니다" : "등록했습니다");
      load();
    } catch (e) {
      toast("실패: " + (e && e.message ? e.message : e));
      btn.disabled = false;
      btn.textContent = "저장";
    }
  }

  /* ---------- 상단 바로가기 ---------- */
  function mountTop() {
    var right = document.querySelector(".top .right");
    if (!right || $("ext-library")) return;
    var b = document.createElement("button");
    b.id = "ext-library";
    b.textContent = "📚 자료 관리";
    b.onclick = function () { location.hash = "#library"; };
    right.insertBefore(b, right.firstChild);
  }

  function injectCSS() {
    if ($("lib-style")) return;
    var st = document.createElement("style");
    st.id = "lib-style";
    st.textContent =
      ".lib-tabs{display:flex;gap:4px;background:var(--ink-50);padding:3px;border-radius:9px;width:max-content;margin-bottom:12px}" +
      ".lib-tab{border:0;background:transparent;padding:7px 14px;border-radius:7px;font-size:12.5px;color:var(--ink-600);cursor:pointer;font-weight:600}" +
      ".lib-tab.on{background:#fff;color:var(--brand-500);box-shadow:0 1px 2px rgba(20,26,34,.06)}" +
      ".lib-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center}" +
      ".lib-bar input,.lib-bar select{height:32px;padding:0 10px;border:1px solid var(--ink-200);border-radius:8px;font-size:12.5px;background:#fff;color:var(--ink-900);font-family:inherit}" +
      ".lib-bar input{flex:1 1 200px;min-width:160px}" +
      ".lib-bar input:focus,.lib-bar select:focus{outline:none;border-color:var(--brand-500)}" +
      ".lib-bar .btn{margin-left:auto}" +
      ".lib-note{font-size:11px;color:var(--ink-500);margin-top:8px}" +
      ".lib-sub2{font-size:11px;color:var(--ink-500);margin-top:2px}" +
      ".lib-link{color:inherit;text-decoration:none}" +
      ".lib-link:hover b{color:var(--brand-500)}" +
      ".lib-act{display:flex;gap:4px;justify-content:flex-end}" +
      "@media (max-width:820px){.lib-bar .btn{margin-left:0;width:100%}.lib-act{justify-content:flex-start}}";
    document.head.appendChild(st);
  }

  function start() {
    injectCSS();
    mountTop();
    new MutationObserver(mountTop).observe(document.body, { childList: true, subtree: true });
  }

  window.EXTRA_ROUTES = window.EXTRA_ROUTES || {};
  window.EXTRA_ROUTES.library = render;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
