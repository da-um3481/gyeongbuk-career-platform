/* ============================================================
   자료실 — 교재·처방자료 관리 (등록/수정/중지/최종확인일)
   원본 main.js 는 한 줄 훅(window.EXTRA_ROUTES)으로만 연결합니다.
   ============================================================ */
(function () {
  var S = { tab: "content", q: "", subject: "", rtype: "", year: "", atype: "", rows: [], meta: [], adm: {} };
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
      '<div class="hero"><div class="micro">자료실</div><h1>교재·처방자료 · 입시정보 관리</h1>' +
        "<p>상담·처방에 쓰는 교재와 자료, 대학별 모집단위·전형 정보를 직접 등록·수정하고 최종 확인일로 현행성을 관리합니다.</p></div>" +
      '<div class="panel" style="margin-bottom:12px">' +
        '<div class="lib-tabs">' + tabBtn("content", "학습 콘텐츠·교재") + tabBtn("rx", "처방 자료") +
          tabBtn("adm", "입시 정보") + "</div>" +
        '<div class="lib-bar">' +
          '<input id="lib-q" type="search" placeholder="검색" value="' + esc(S.q) + '" />' +
          '<select id="lib-sub"></select>' +
          '<select id="lib-rtype"><option value="">분류 전체</option>' +
            ["교재", "도서", "문제집", "영상", "문제", "기타"].map(function (v) {
              return '<option value="' + v + '"' + (S.rtype === v ? " selected" : "") + ">" + v + "</option>";
            }).join("") + "</select>" +
          '<select id="lib-year"><option value="">연도 전체</option></select>' +
          '<select id="lib-atype"><option value="">전형 전체</option></select>' +
          '<button class="btn" id="lib-csv">⬆ CSV 업로드</button>' +
          '<button class="btn primary" id="lib-add">＋ 등록</button>' +
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
    $("lib-year").onchange = function () { S.year = this.value; load(); };
    $("lib-atype").onchange = function () { S.atype = this.value; load(); };
    $("lib-add").onclick = function () { openForm(null); };
    $("lib-csv").onclick = openImport;
  }

  function paint() {
    if (!$("lib-rtype")) return;
    var rx = S.tab === "rx", adm = S.tab === "adm";
    $("lib-rtype").style.display = rx ? "" : "none";
    $("lib-sub").style.display = adm ? "none" : "";
    $("lib-year").style.display = adm ? "" : "none";
    $("lib-atype").style.display = adm ? "" : "none";
    $("lib-q").placeholder = adm ? "대학·모집단위·전형 검색" : "제목·태그·출처 검색";
    document.querySelectorAll(".lib-tab").forEach(function (b) {
      b.classList.toggle("on", b.dataset.tab === S.tab);
    });
    var sel = $("lib-sub");
    if (sel && !sel.dataset.filled && S.meta.length) {
      sel.innerHTML = '<option value="">과목 전체</option>' +
        S.meta.map(function (m) { return '<option value="' + m.id + '">' + esc(m.subject_name) + "</option>"; }).join("");
      sel.dataset.filled = "1";
      sel.value = S.subject;
    }
    var ys = $("lib-year");
    if (ys && !ys.dataset.filled && S.adm.years) {
      ys.innerHTML = '<option value="">연도 전체</option>' +
        S.adm.years.map(function (y) { return '<option value="' + y + '">' + y + "학년도</option>"; }).join("");
      ys.dataset.filled = "1";
      ys.value = S.year;
    }
    var as = $("lib-atype");
    if (as && !as.dataset.filled && S.adm.types) {
      as.innerHTML = '<option value="">전형 전체</option>' +
        S.adm.types.map(function (t) { return '<option value="' + esc(t) + '">' + esc(t) + "</option>"; }).join("");
      as.dataset.filled = "1";
      as.value = S.atype;
    }
  }

  async function render(root) {
    if (!connected()) {
      root.innerHTML =
        '<div class="hero"><div class="micro">자료실</div><h1>교재·처방자료 · 입시정보 관리</h1></div>' +
        '<div class="err-note">DB에 연결되지 않아 자료를 관리할 수 없습니다. (데모 모드)<br />' +
        "Vercel 환경변수 DATABASE_URL · TUTOR_TOKEN 을 확인한 뒤 재배포하세요.</div>";
      return;
    }
    shell(root);
    try {
      var m = await exec("wa_lib_meta", {});
      S.meta = m.rows || [];
    } catch (e) { S.meta = []; }
    try {
      var a = await exec("wa_adm_meta", {});
      S.adm = (a.rows && a.rows[0]) || {};
    } catch (e) { S.adm = {}; }
    paint();
    await load();
  }

  async function load() {
    var box = $("lib-list");
    if (!box) return;
    box.innerHTML = '<div class="skl" style="width:50%;margin-bottom:8px"></div><div class="skl" style="width:80%"></div>';
    try {
      var r;
      if (S.tab === "adm") {
        r = await exec("wa_adm_list", { q: S.q, year: S.year, university: "", admission_type: S.atype });
      } else if (S.tab === "rx") {
        r = await exec("wa_lib_rx", { q: S.q, subject_id: S.subject, resource_type: S.rtype });
      } else {
        r = await exec("wa_lib_contents", { q: S.q, subject_id: S.subject });
      }
      S.rows = r.rows || [];
      drawTable();
    } catch (e) {
      box.innerHTML = '<div class="err-note">불러오기 실패: ' + esc(e && e.message ? e.message : e) + "</div>";
    }
  }

  function drawTable() {
    var box = $("lib-list");
    var rx = S.tab === "rx", adm = S.tab === "adm";
    var stale = S.rows.filter(function (r) { var d = daysSince(r.verified_on); return d === null || d > 365; }).length;
    var title = adm ? "입시 정보(모집단위·전형)" : rx ? "처방 자료" : "학습 콘텐츠·교재";
    var head = adm
      ? ["대학 / 모집단위", "전형", "모집인원", "수능최저", "최종 확인", "상태", ""]
      : rx
      ? ["자료명", "분류", "과목", "수준", "제공처", "최종 확인", "상태", ""]
      : ["자료명", "유형", "과목", "난이도", "출처", "최종 확인", "상태", ""];

    var rows = S.rows.map(function (r) {
      var cells;
      if (adm) {
        var nm = "<b>" + esc(r.university) + "</b>" +
          '<div class="lib-sub2">' + esc(r.department || "모집단위 미기재") + (r.year ? " · " + r.year + "학년도" : "") + "</div>";
        if (r.url) nm = '<a href="' + esc(r.url) + '" target="_blank" rel="noopener" class="lib-link">' + nm + "</a>";
        cells = [nm, esc(r.admission_type || "—"),
          r.recruitment == null ? "—" : String(r.recruitment) + "명",
          esc(r.min_score ? String(r.min_score).slice(0, 40) : "—"),
          verifiedCell(r), statusCell(r.status)];
      } else {
      var name = '<b>' + esc(r.title) + "</b>" +
        (r.tags ? '<div class="lib-sub2">' + esc(r.tags) + "</div>" : "");
      if (r.url) name = '<a href="' + esc(r.url) + '" target="_blank" rel="noopener" class="lib-link">' + name + "</a>";
      cells = rx
        ? [name, esc(r.resource_type), esc(r.subject_name || "—"), esc(r.level || "—"),
           esc(r.provider || "—"), verifiedCell(r), statusCell(r.status)]
        : [name, esc(r.content_type || "—"), esc(r.subject_name || "—"), esc(r.difficulty || "—"),
           esc(r.source || "—"), verifiedCell(r), statusCell(r.status)];
      }
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
        : '<div class="empty">' + (adm
            ? "등록된 입시 정보가 없습니다. ‘＋ 등록’으로 대학별 모집단위·전형을 추가하세요."
            : "조건에 맞는 자료가 없습니다. ‘＋ 등록’으로 추가할 수 있습니다.") + "</div>");

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
        await exec(S.tab === "adm" ? "wa_adm_touch" : S.tab === "rx" ? "wa_lib_rx_touch" : "wa_lib_content_touch", { id: id });
        toast("최종 확인일을 오늘로 갱신했습니다");
        load();
      } catch (e) { toast("실패: " + (e && e.message ? e.message : e)); }
      return;
    }
    if (act === "del") {
      var label = S.tab === "adm" ? (row.university + " " + (row.department || "")) : row.title;
      if (!confirm("‘" + label + "’ 을(를) 중지 처리할까요?\n(삭제 대신 ‘중지’로 남겨 이력을 보존합니다)")) return;
      try {
        await exec(S.tab === "adm" ? "wa_adm_del" : S.tab === "rx" ? "wa_lib_rx_del" : "wa_lib_content_del", { id: id });
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
    var rx = S.tab === "rx", adm = S.tab === "adm";
    var d = row || {};
    var html;

    if (adm) {
      var types = ["수시-교과", "수시-종합", "수시-논술", "수시-실기", "정시-가", "정시-나", "정시-다", "기타"];
      if (d.admission_type && types.indexOf(d.admission_type) < 0) types.push(d.admission_type);
      html = "<h3>" + (row ? "입시 정보 수정" : "입시 정보 등록") + "</h3>" +
        '<div class="grid2">' +
          "<div>" +
            input("f-year", "입시 연도", d.year, "예: 2027", "number") +
            input("f-univ", "대학 *", d.university, "예: 경북대학교") +
            input("f-dept", "모집단위", d.department, "예: 컴퓨터학부") +
            '<label for="f-atype">전형</label><select id="f-atype">' + opt(types, d.admission_type || "수시-교과") + "</select>" +
            input("f-recr", "모집인원", d.recruitment, "예: 12", "number") +
            input("f-verified", "최종 확인일", d.verified_on, "", "date") +
            '<label for="f-status">상태</label><select id="f-status">' + opt(["활성", "중지"], d.status || "활성") + "</select>" +
          "</div>" +
          "<div>" +
            textarea("f-minscore", "수능 최저", d.min_score, "예: 국·수·영·탐 2개 합 7등급") +
            textarea("f-selection", "전형 방법", d.selection, "예: 학생부 70 + 면접 30") +
            textarea("f-elig", "지원 자격", d.eligibility, "예: 2027년 2월 졸업예정자") +
          "</div>" +
        "</div>" +
        '<div class="grid2">' +
          "<div>" + input("f-sched", "일정", d.schedule, "예: 원서 9.9~9.13, 면접 11.22") + "</div>" +
          "<div>" + input("f-url", "요강 URL", d.url, "https://") + "</div>" +
        "</div>" +
        input("f-tags", "태그", d.tags, "쉼표 구분") +
        textarea("f-note", "메모", d.note, "상담 시 참고사항") +
        footHtml(row);
    } else if (rx) {
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
        footHtml(row);
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
        footHtml(row);
    }
    openModal(html);
    $("mCancel").onclick = closeModal;
    $("mSave").onclick = save;
    if ($("mDel")) $("mDel").onclick = hardDelete;
    setTimeout(function () { var t = $("f-univ") || $("f-title"); if (t) t.focus(); }, 30);
  }

  function footHtml(row) {
    return '<div class="foot">' +
      (row ? '<button class="btn" id="mDel" style="margin-right:auto;color:#c0392b;border-color:#f0c9c4">영구 삭제</button>' : "") +
      '<button class="btn" id="mCancel">취소</button>' +
      '<button class="btn primary" id="mSave">' + (row ? "저장" : "등록") + "</button></div>";
  }

  /* 완전 삭제 — 수동으로만 실행 (자동 정리 없음) */
  async function hardDelete() {
    if (!EDIT) return;
    var name = S.tab === "adm" ? "wa_adm_purge" : S.tab === "rx" ? "wa_lib_rx_purge" : "wa_lib_content_purge";
    var label = S.tab === "adm" ? (EDIT.university + " " + (EDIT.department || "")) : EDIT.title;
    if (!confirm("‘" + label + "’ 을(를) DB에서 완전히 삭제할까요?\n이 작업은 되돌릴 수 없습니다.")) return;
    try {
      await exec(name, { id: EDIT.id });
      closeModal();
      toast("삭제했습니다");
      load();
    } catch (e) { toast("실패: " + (e && e.message ? e.message : e)); }
  }

  /* ---------- CSV 일괄 등록 ---------- */
  var CSV_SPEC = {
    content: {
      imp: "wa_lib_content_import", need: "title", subjectFrom: "subject_name",
      cols: [
        { k: "title", n: ["자료명", "제목", "교재명", "title"] },
        { k: "subject_name", n: ["과목", "subject", "과목명"] },
        { k: "content_type", n: ["유형", "구분", "type"] },
        { k: "format", n: ["형식", "format"] },
        { k: "difficulty", n: ["난이도", "difficulty"] },
        { k: "estimated_minutes", n: ["예상시간", "시간", "시간(분)", "minutes"], t: "int" },
        { k: "author", n: ["저자", "author"] },
        { k: "source", n: ["출처", "source", "출판사"] },
        { k: "url", n: ["url", "링크", "link"] },
        { k: "tags", n: ["태그", "tags", "키워드"] },
        { k: "description", n: ["설명", "비고", "description", "메모"] },
        { k: "status", n: ["상태", "status"] },
        { k: "verified_at", n: ["최종확인일", "확인일", "verified_at"], t: "date" },
      ],
    },
    rx: {
      imp: "wa_lib_rx_import", need: "title", subjectFrom: "subject_name",
      cols: [
        { k: "title", n: ["자료명", "제목", "교재명", "title"] },
        { k: "resource_type", n: ["분류", "유형", "type"] },
        { k: "subject_name", n: ["과목", "subject", "과목명"] },
        { k: "level", n: ["수준", "난이도", "level"] },
        { k: "target", n: ["대상", "target"] },
        { k: "provider", n: ["제공처", "출판사", "provider"] },
        { k: "url", n: ["url", "링크", "link"] },
        { k: "tags", n: ["태그", "tags", "키워드"] },
        { k: "note", n: ["메모", "비고", "note"] },
        { k: "status", n: ["상태", "status"] },
        { k: "verified_at", n: ["최종확인일", "확인일", "verified_at"], t: "date" },
      ],
    },
    adm: {
      imp: "wa_adm_import", need: "university",
      cols: [
        { k: "year", n: ["연도", "입시연도", "year"], t: "int" },
        { k: "university", n: ["대학", "대학명", "university"] },
        { k: "department", n: ["모집단위", "학과", "department"] },
        { k: "admission_type", n: ["전형", "전형유형", "admission_type"] },
        { k: "recruitment", n: ["모집인원", "인원", "recruitment"], t: "int" },
        { k: "min_score", n: ["수능최저", "최저", "min_score"] },
        { k: "selection", n: ["전형방법", "전형요소", "selection"] },
        { k: "eligibility", n: ["지원자격", "자격", "eligibility"] },
        { k: "schedule", n: ["일정", "schedule"] },
        { k: "url", n: ["요강url", "url", "링크", "요강"] },
        { k: "tags", n: ["태그", "tags"] },
        { k: "note", n: ["메모", "비고", "note"] },
        { k: "status", n: ["상태", "status"] },
        { k: "verified_at", n: ["최종확인일", "확인일", "verified_at"], t: "date" },
      ],
    },
  };

  function normHead(s) {
    return String(s || "").replace(/^\uFEFF/, "").replace(/\s|_|\*|\(|\)/g, "").toLowerCase();
  }
  function parseCSV(text) {
    text = String(text || "").replace(/^\uFEFF/, "");
    var rows = [], row = [], cur = "", inQ = false, i, c;
    for (i = 0; i < text.length; i++) {
      c = text[i];
      if (inQ) {
        if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
        else cur += c;
      } else if (c === '"') inQ = true;
      else if (c === ",") { row.push(cur); cur = ""; }
      else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
      else if (c !== "\r") cur += c;
    }
    if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (x) { return String(x).trim() !== ""; }); });
  }
  function toDate(v) {
    var s = String(v || "").trim();
    if (!s) return null;
    var m = s.match(/^(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/);
    if (!m) return null;
    return m[1] + "-" + ("0" + m[2]).slice(-2) + "-" + ("0" + m[3]).slice(-2);
  }
  function subjectIdByName(name) {
    var n = String(name || "").trim();
    if (!n) return null;
    for (var i = 0; i < S.meta.length; i++) {
      if (String(S.meta[i].subject_name).trim() === n) return S.meta[i].id;
    }
    for (var j = 0; j < S.meta.length; j++) {
      if (n.indexOf(String(S.meta[j].subject_name).trim()) >= 0) return S.meta[j].id;
    }
    return null;
  }

  function mapCSV(spec, table) {
    var head = table[0].map(normHead);
    var idx = {};
    spec.cols.forEach(function (c) {
      for (var i = 0; i < head.length; i++) {
        if (c.n.some(function (a) { return normHead(a) === head[i]; })) { idx[c.k] = i; break; }
      }
    });
    var out = [], skipped = 0;
    for (var r = 1; r < table.length; r++) {
      var raw = table[r], obj = {}, notEmpty = false;
      spec.cols.forEach(function (c) {
        var pos = idx[c.k];
        var v = pos == null ? "" : String(raw[pos] == null ? "" : raw[pos]).trim();
        if (v !== "") notEmpty = true;
        if (c.t === "int") obj[c.k] = v === "" ? null : (parseInt(v.replace(/[^\d\-]/g, ""), 10) || null);
        else if (c.t === "date") obj[c.k] = toDate(v);
        else if (c.k === spec.subjectFrom) obj.subject_id = subjectIdByName(v);
        else obj[c.k] = v === "" ? null : v;
      });
      if (!notEmpty) continue;
      if (!obj[spec.need]) { skipped++; continue; }
      out.push(obj);
    }
    return { rows: out, skipped: skipped, mapped: Object.keys(idx).length };
  }

  function downloadTemplate() {
    var spec = CSV_SPEC[S.tab];
    var heads = spec.cols.map(function (c) { return c.n[0]; });
    var sample = spec.cols.map(function (c) {
      if (c.k === "title") return "예시 자료명";
      if (c.k === "university") return "경북대학교";
      if (c.k === "department") return "컴퓨터학부";
      if (c.k === "admission_type") return "수시-교과";
      if (c.k === "subject_name") return S.meta[0] ? S.meta[0].subject_name : "수학";
      if (c.k === "year") return String(new Date().getFullYear() + 1);
      if (c.k === "verified_at") return new Date().toISOString().slice(0, 10);
      return "";
    });
    var csv = "\uFEFF" + heads.join(",") + "\r\n" + sample.map(function (v) {
      return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    }).join(",") + "\r\n";
    var blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (S.tab === "adm" ? "입시정보" : S.tab === "rx" ? "처방자료" : "교재") + "_양식.csv";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  function openImport() {
    var input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,text/csv";
    input.onchange = function () {
      var f = input.files && input.files[0];
      if (!f) return;
      var rd = new FileReader();
      rd.onload = function () {
        var table;
        try { table = parseCSV(rd.result); } catch (e) { toast("CSV를 읽을 수 없습니다"); return; }
        if (!table.length) { toast("빈 파일입니다"); return; }
        var res = mapCSV(CSV_SPEC[S.tab], table);
        if (!res.rows.length) { toast("등록할 행이 없습니다. 첫 줄이 머리글인지 확인하세요"); return; }
        previewImport(res, f.name);
      };
      rd.readAsText(f, "utf-8");
    };
    input.click();
  }

  function previewImport(res, fileName) {
    var spec = CSV_SPEC[S.tab];
    var cols = spec.cols.filter(function (c) { return c.k !== "subject_name"; }).slice(0, 6);
    var head = cols.map(function (c) { return c.n[0]; });
    var body = res.rows.slice(0, 6).map(function (r) {
      return "<tr>" + cols.map(function (c) {
        var v = r[c.k];
        return "<td>" + esc(v == null ? "" : String(v).slice(0, 28)) + "</td>";
      }).join("") + "</tr>";
    }).join("");

    openModal(
      "<h3>CSV 미리보기</h3>" +
        '<div class="lib-note" style="margin:0 0 10px">' + esc(fileName) + " · 등록 대상 <b>" + res.rows.length + "건</b>" +
        (res.skipped ? " · 건너뜀 " + res.skipped + "건(필수값 없음)" : "") + "</div>" +
        '<div style="overflow:auto;max-height:260px;border:1px solid var(--ink-100);border-radius:8px">' +
          '<table class="tbl"><thead><tr>' + head.map(function (h) { return "<th>" + esc(h) + "</th>"; }).join("") +
          "</tr></thead><tbody>" + body + "</tbody></table></div>" +
        '<div class="lib-note">상위 6건만 표시합니다. 등록 후 ‘중지/영구 삭제’로 정리할 수 있습니다.</div>' +
        '<div class="foot"><button class="btn" id="mTpl">양식 내려받기</button>' +
        '<button class="btn" id="mCancel">취소</button>' +
        '<button class="btn primary" id="mImport">' + res.rows.length + "건 등록</button></div>"
    );
    $("mTpl").onclick = downloadTemplate;
    $("mCancel").onclick = closeModal;
    $("mImport").onclick = function () { runImport(spec, res.rows); };
  }

  async function runImport(spec, rows) {
    var btn = $("mImport");
    btn.disabled = true;
    btn.textContent = "등록 중…";
    var done = 0;
    try {
      for (var i = 0; i < rows.length; i += 200) {
        var chunk = rows.slice(i, i + 200);
        var r = await exec(spec.imp, { rows: JSON.stringify(chunk) });
        done += (r.rows || []).length;
      }
      closeModal();
      toast(done + "건을 등록했습니다");
      load();
    } catch (e) {
      toast("실패(" + done + "건 등록됨): " + (e && e.message ? e.message : e));
      btn.disabled = false;
      btn.textContent = "다시 시도";
    }
  }

  async function save() {
    var adm = S.tab === "adm";
    var rx = S.tab === "rx";
    if (adm) {
      if (!val("f-univ")) { toast("대학명을 입력하세요"); return; }
    } else if (!val("f-title")) {
      toast(adm ? "대학명을 입력하세요" : "자료명을 입력하세요");
      return;
    }
    var btn = $("mSave");
    btn.disabled = true;
    btn.textContent = "저장 중…";

    var p;
    var name;
    if (adm) {
      p = {
        id: EDIT ? EDIT.id : "",
        year: val("f-year"),
        university: val("f-univ"),
        department: val("f-dept"),
        admission_type: val("f-atype"),
        recruitment: val("f-recr"),
        eligibility: val("f-elig"),
        selection: val("f-selection"),
        min_score: val("f-minscore"),
        schedule: val("f-sched"),
        url: val("f-url"),
        note: val("f-note"),
        tags: val("f-tags"),
        status: val("f-status") || "활성",
        verified_at: val("f-verified"),
      };
      name = EDIT ? "wa_adm_upd" : "wa_adm_add";
    } else if (rx) {
      p = {
        id: EDIT ? EDIT.id : "",
        resource_type: val("f-rtype") || "교재",
        subject_id: val("f-sub"),
        title: val("f-title"),
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
        title: val("f-title"),
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
