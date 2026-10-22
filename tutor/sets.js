/* ============================================================
   시험지 세트 — EBS 단추 등 외부에서 만든 시험지를 등록·배정·채점
   · 채점 시 입력한 오답 단원은 wa_weak(취약 단원 진단)에 자동 반영됩니다.
   ============================================================ */
(function () {
  var S = { q: "", subject: "", studentId: "", rows: [], meta: [], students: [], weak: [], reco: [] };
  var EDIT = null;
  var CURRENT_SET = null;
  var timer = null;

  function $(id) { return document.getElementById(id); }
  function esc(v) {
    var d = document.createElement("div");
    d.textContent = v == null ? "" : String(v);
    return d.innerHTML;
  }
  function val(id) { var e = $(id); return e ? String(e.value || "").trim() : ""; }
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
  function connected() {
    return !!(window.agentdb && window.agentdb.isConnected && window.agentdb.isConnected());
  }
  function exec(name, params) { return window.agentdb.executeQuery(name, params || {}); }

  function input(id, label, v, ph, type) {
    return '<label for="' + id + '">' + esc(label) + "</label>" +
      '<input id="' + id + '" type="' + (type || "text") + '" value="' + esc(v == null ? "" : v) + '" placeholder="' + esc(ph || "") + '" />';
  }
  function textarea(id, label, v, ph) {
    return '<label for="' + id + '">' + esc(label) + "</label>" +
      '<textarea id="' + id + '" placeholder="' + esc(ph || "") + '">' + esc(v == null ? "" : v) + "</textarea>";
  }
  function opt(list, cur) {
    return list.map(function (v) {
      return '<option value="' + esc(v) + '"' + (String(cur || "") === String(v) ? " selected" : "") + ">" + esc(v) + "</option>";
    }).join("");
  }
  function subjOpts(cur) {
    return '<option value="">(과목 없음)</option>' + S.meta.map(function (m) {
      return '<option value="' + m.id + '"' + (String(cur || "") === String(m.id) ? " selected" : "") + ">" + esc(m.subject_name) + "</option>";
    }).join("");
  }
  function stuOpts(cur) {
    return '<option value="">학생 선택</option>' + S.students.map(function (s) {
      return '<option value="' + s.id + '"' + (String(cur || "") === String(s.id) ? " selected" : "") + ">" +
        esc(s.name) + (s.grade ? " (" + esc(s.grade) + ")" : "") + "</option>";
    }).join("");
  }

  /* ---------- 화면 ---------- */
  function shell(root) {
    root.innerHTML =
      '<div class="hero"><div class="micro">문제은행</div><h1>시험지 세트</h1>' +
        "<p>EBS 단추 등에서 만든 시험지를 등록하고 학생에게 배정·채점합니다. 채점 시 적은 오답 단원은 취약 단원 진단에 자동 반영됩니다.</p></div>" +
      '<div class="panel" style="margin-bottom:12px">' +
        '<div class="lib-bar">' +
          '<input id="set-q" type="search" placeholder="제목·단원·태그 검색" value="' + esc(S.q) + '" />' +
          '<select id="set-sub"></select>' +
          '<select id="set-stu"></select>' +
          '<button class="btn primary" id="set-add">＋ 세트 등록</button>' +
        "</div>" +
        '<div id="set-reco" class="set-reco"></div>' +
      "</div>" +
      '<div class="panel" id="set-list"><div class="skl" style="width:40%"></div></div>';

    $("set-q").oninput = function () {
      clearTimeout(timer);
      var v = this.value;
      timer = setTimeout(function () { S.q = v.trim(); load(); }, 250);
    };
    $("set-sub").onchange = function () { S.subject = this.value; load(); };
    $("set-stu").onchange = function () { S.studentId = this.value; loadReco(); };
    $("set-add").onclick = function () { openForm(null); };
  }

  function paint() {
    var sub = $("set-sub");
    if (sub && !sub.dataset.filled && S.meta.length) {
      sub.innerHTML = '<option value="">과목 전체</option>' + S.meta.map(function (m) {
        return '<option value="' + m.id + '">' + esc(m.subject_name) + "</option>";
      }).join("");
      sub.dataset.filled = "1";
      sub.value = S.subject;
    }
    var stu = $("set-stu");
    if (stu && !stu.dataset.filled && S.students.length) {
      stu.innerHTML = '<option value="">학생 선택(추천 보기)</option>' + S.students.map(function (s) {
        return '<option value="' + s.id + '">' + esc(s.name) + (s.grade ? " (" + esc(s.grade) + ")" : "") + "</option>";
      }).join("");
      stu.dataset.filled = "1";
      stu.value = S.studentId;
    }
  }

  async function render(root) {
    if (!connected()) {
      root.innerHTML =
        '<div class="hero"><div class="micro">문제은행</div><h1>시험지 세트</h1></div>' +
        '<div class="err-note">DB에 연결되지 않아 사용할 수 없습니다. (데모 모드)</div>';
      return;
    }
    shell(root);
    try {
      var m = await exec("wa_lib_meta", {});
      S.meta = m.rows || [];
      var st = await exec("wa_students_pick", {});
      S.students = st.rows || [];
    } catch (e) { /* 목록 실패해도 진행 */ }
    paint();
    await load();
  }

  async function load() {
    var box = $("set-list");
    if (!box) return;
    box.innerHTML = '<div class="skl" style="width:50%;margin-bottom:8px"></div><div class="skl" style="width:80%"></div>';
    try {
      var r = await exec("wa_qb_sets", { q: S.q, subject_id: S.subject });
      S.rows = r.rows || [];
      draw();
    } catch (e) {
      box.innerHTML = '<div class="err-note">불러오기 실패: ' + esc(e && e.message ? e.message : e) + "</div>";
    }
  }

  async function loadReco() {
    var banner = $("set-reco");
    if (!banner) return;
    if (!S.studentId) {
      S.weak = []; S.reco = [];
      banner.innerHTML = "";
      draw();
      return;
    }
    banner.innerHTML = '<span class="pa">추천 계산 중…</span>';
    try {
      var w = await exec("wa_qb_weak_units", { student_id: S.studentId });
      var r = await exec("wa_qb_recommend", { student_id: S.studentId });
      S.weak = w.rows || [];
      S.reco = r.rows || [];
      var stu = null;
      for (var i = 0; i < S.students.length; i++) if (String(S.students[i].id) === String(S.studentId)) stu = S.students[i];
      banner.innerHTML =
        '<b>' + esc(stu ? stu.name : "학생") + "</b> 오답 단원 " +
        (S.weak.length
          ? S.weak.map(function (x) { return '<span class="pill pill-warn">' + esc(x.unit_name) + (Number(x.miss_count) > 1 ? " ×" + x.miss_count : "") + "</span>"; }).join(" ")
          : '<span class="pa">없음 (채점 기록이 쌓이면 자동 생성됩니다)</span>') +
        " · 추천 세트 <b>" + S.reco.length + "</b>개";
      draw();
    } catch (e) {
      banner.innerHTML = '<span class="err-note">추천 계산 실패: ' + esc(e && e.message ? e.message : e) + "</span>";
    }
  }

  function draw() {
    var box = $("set-list");
    if (!box) return;
    var recoIds = {};
    S.reco.forEach(function (r) { recoIds[String(r.id)] = true; });

    var rows = S.rows.map(function (r) {
      var title = "<b>" + esc(r.title) + "</b>" +
        '<div class="lib-sub2">' + esc(r.source || "—") + (r.unit_name ? " · " + esc(r.unit_name) : "") + "</div>";
      if (r.url) title = '<a href="' + esc(r.url) + '" target="_blank" rel="noopener" class="lib-link">' + title + "</a>";
      if (recoIds[String(r.id)]) title = '<span class="pill pill-brand">추천</span> ' + title;

      var spec = (r.item_count ? r.item_count + "문항" : "—") + (r.points ? " / " + r.points + "점" : "");
      var assign = (r.assigned_count || 0) + "명" + (Number(r.graded_count) ? " (채점 " + r.graded_count + ")" : "");
      var btns =
        '<div class="lib-act">' +
          '<button class="mini-btn" data-act="assign" data-id="' + r.id + '">배정·채점</button>' +
          '<button class="mini-btn" data-act="edit" data-id="' + r.id + '">수정</button>' +
          (r.status === "중지" ? "" : '<button class="mini-btn" data-act="del" data-id="' + r.id + '">중지</button>') +
        "</div>";
      return "<tr>" +
        '<td data-label="세트">' + title + "</td>" +
        '<td data-label="과목">' + esc(r.subject_name || "—") + "</td>" +
        '<td data-label="난이도">' + esc(r.difficulty || "—") + "</td>" +
        '<td data-label="구성">' + esc(spec) + "</td>" +
        '<td data-label="배정">' + esc(assign) + "</td>" +
        '<td data-label="상태">' + (r.status === "중지" ? '<span class="pill">중지</span>' : '<span class="pill pill-ok">' + esc(r.status || "활성") + "</span>") + "</td>" +
        "<td>" + btns + "</td></tr>";
    }).join("");

    box.innerHTML =
      '<div class="ph"><div class="pt">등록된 시험지 세트</div><div class="pa">' + S.rows.length + "건</div></div>" +
      (S.rows.length
        ? '<table class="tbl m-cards"><thead><tr><th>세트</th><th>과목</th><th>난이도</th><th>구성</th><th>배정</th><th>상태</th><th></th></tr></thead><tbody>' +
          rows + "</tbody></table>"
        : '<div class="empty">등록된 세트가 없습니다. EBS 단추에서 시험지를 만든 뒤 ‘＋ 세트 등록’으로 링크를 저장하세요.</div>');

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
    if (act === "assign") return openAssign(row);
    if (act === "del") {
      if (!confirm("‘" + row.title + "’ 을(를) 중지 처리할까요?\n배정·채점 기록은 유지됩니다.")) return;
      try { await exec("wa_qb_set_del", { id: id }); toast("중지 처리했습니다"); load(); }
      catch (e) { toast("실패: " + (e && e.message ? e.message : e)); }
    }
  }

  /* ---------- 세트 등록·수정 ---------- */
  function openForm(row) {
    EDIT = row || null;
    var d = row || {};
    openModal(
      "<h3>" + (row ? "세트 수정" : "시험지 세트 등록") + "</h3>" +
        '<div class="grid2">' +
          "<div>" +
            input("f-title", "세트명 *", d.title, "예: 중3-1 이차방정식 기본 15문항") +
            '<label for="f-source">출처</label><select id="f-source">' +
              opt(["EBS 단추", "학교 시험", "출판사", "자체제작", "기타"], d.source || "EBS 단추") + "</select>" +
            '<label for="f-sub">과목</label><select id="f-sub">' + subjOpts(d.subject_id) + "</select>" +
            input("f-grade", "학년", d.grade, "예: 중3") +
            input("f-unit", "단원", d.unit_name, "예: 이차방정식") +
          "</div>" +
          "<div>" +
            '<label for="f-diff">난이도</label><select id="f-diff">' + opt(["", "상", "중", "하"], d.difficulty) + "</select>" +
            input("f-items", "문항 수", d.item_count, "15", "number") +
            input("f-points", "배점 합", d.points, "100", "number") +
            input("f-url", "시험지 링크", d.url, "https://ai-plus.ebs.co.kr/...") +
            input("f-verified", "최종 확인일", d.verified_on, "", "date") +
            '<label for="f-status">상태</label><select id="f-status">' + opt(["활성", "중지"], d.status || "활성") + "</select>" +
          "</div>" +
        "</div>" +
        input("f-tags", "태그", d.tags, "쉼표 구분") +
        textarea("f-note", "메모", d.note, "출제 범위·주의사항") +
        '<div class="foot">' +
          (row ? '<button class="btn" id="mDel" style="margin-right:auto;color:#c0392b;border-color:#f0c9c4">영구 삭제</button>' : "") +
          '<button class="btn" id="mCancel">취소</button>' +
          '<button class="btn primary" id="mSave">' + (row ? "저장" : "등록") + "</button></div>"
    );
    $("mCancel").onclick = closeModal;
    $("mSave").onclick = save;
    if ($("mDel")) $("mDel").onclick = hardDelete;
    setTimeout(function () { var t = $("f-title"); if (t) t.focus(); }, 30);
  }

  async function save() {
    var title = val("f-title");
    if (!title) { toast("세트명을 입력하세요"); return; }
    var btn = $("mSave");
    btn.disabled = true;
    btn.textContent = "저장 중…";
    var p = {
      id: EDIT ? EDIT.id : "",
      title: title,
      source: val("f-source"),
      subject_id: val("f-sub"),
      grade: val("f-grade"),
      unit_name: val("f-unit"),
      difficulty: val("f-diff"),
      item_count: val("f-items"),
      points: val("f-points"),
      url: val("f-url"),
      note: val("f-note"),
      tags: val("f-tags"),
      status: val("f-status") || "활성",
      verified_at: val("f-verified"),
    };
    try {
      await exec(EDIT ? "wa_qb_set_upd" : "wa_qb_set_add", p);
      closeModal();
      toast(EDIT ? "수정했습니다" : "등록했습니다");
      load();
    } catch (e) {
      toast("실패: " + (e && e.message ? e.message : e));
      btn.disabled = false;
      btn.textContent = "저장";
    }
  }

  async function hardDelete() {
    if (!EDIT) return;
    if (!confirm("‘" + EDIT.title + "’ 을(를) 완전히 삭제할까요?\n배정 기록도 함께 사라지며 되돌릴 수 없습니다.")) return;
    try {
      await exec("wa_qb_set_purge", { id: EDIT.id });
      closeModal(); toast("삭제했습니다"); load();
    } catch (e) { toast("실패: " + (e && e.message ? e.message : e)); }
  }

  /* ---------- 배정·채점 ---------- */
  async function openAssign(set) {
    CURRENT_SET = set;
    var body = '<div style="text-align:center;padding:16px"><div class="skl" style="width:60%;margin:0 auto"></div></div>';
    openModal("<h3>배정·채점 — " + esc(set.title) + "</h3>" + body);
    await renderAssign(set.id);
  }

  async function renderAssign(setId) {
    var r;
    try { r = await exec("wa_qb_assign_list", { set_id: setId, student_id: "" }); }
    catch (e) { toast("불러오기 실패: " + (e && e.message ? e.message : e)); return; }
    var rows = r.rows || [];

    var list = rows.length
      ? '<table class="tbl"><thead><tr><th>학생</th><th>배정</th><th>상태</th><th>점수</th><th>오답 단원</th><th></th></tr></thead><tbody>' +
        rows.map(function (a) {
          return "<tr><td>" + esc(a.student_name || "-") + "</td>" +
            "<td>" + esc(a.assigned_on || "") + "</td>" +
            "<td>" + (a.status === "채점" ? '<span class="pill pill-ok">채점</span>' : '<span class="pill">배정</span>') + "</td>" +
            "<td>" + (a.score == null ? "—" : a.score) + "</td>" +
            '<td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(a.wrong_units || "—") + "</td>" +
            '<td><button class="mini-btn" data-grade="' + a.id + '" data-stu="' + esc(a.student_name || "") +
              '" data-score="' + esc(a.score == null ? "" : a.score) + '" data-wrong="' + esc(a.wrong_units || "") +
              '" data-fb="' + esc(a.feedback || "") + '">' + (a.status === "채점" ? "수정" : "채점") + "</button></td></tr>";
        }).join("") + "</tbody></table>"
      : '<div class="empty">아직 배정된 학생이 없습니다.</div>';

    var html =
      '<h3>배정·채점 — ' + esc(CURRENT_SET.title) + "</h3>" +
      '<div class="lib-note" style="margin:0 0 8px">배정 ' + rows.length + "명 · 채점 " +
        rows.filter(function (a) { return a.status === "채점"; }).length + "명</div>" +
      '<div style="overflow:auto;max-height:280px">' + list + "</div>" +
      '<div style="border-top:1px solid var(--ink-100);margin-top:12px;padding-top:10px">' +
        '<div class="grid2">' +
          "<div>" + '<label for="a-stu">학생 배정</label><select id="a-stu">' + stuOpts("") + "</select></div>" +
          "<div>" + input("a-due", "마감일", "", "", "date") + "</div>" +
        "</div>" +
        input("a-note", "메모", "", "예: 오답노트까지 제출") +
      "</div>" +
      '<div class="foot"><button class="btn" id="mCancel">닫기</button>' +
      '<button class="btn primary" id="a-add">학생 배정</button></div>';

    openModal(html);
    $("mCancel").onclick = closeModal;
    $("a-add").onclick = addAssign;
    document.querySelectorAll("button[data-grade]").forEach(function (b) {
      b.onclick = function () {
        openGrade({
          id: b.dataset.grade, student_name: b.dataset.stu,
          score: b.dataset.score, wrong_units: b.dataset.wrong, feedback: b.dataset.fb,
        }, setId);
      };
    });
  }

  async function addAssign() {
    var sid = val("a-stu");
    if (!sid) { toast("학생을 선택하세요"); return; }
    var b = $("a-add");
    b.disabled = true;
    try {
      await exec("wa_qb_assign_add", {
        set_id: CURRENT_SET.id, student_id: sid, due_date: val("a-due"), note: val("a-note"),
      });
      toast("배정했습니다");
      await renderAssign(CURRENT_SET.id);
      load();
    } catch (e) {
      toast("실패: " + (e && e.message ? e.message : e));
      b.disabled = false;
    }
  }

  function openGrade(a, setId) {
    openModal(
      "<h3>채점 — " + esc(a.student_name || "학생") + "</h3>" +
        '<div class="grid2">' +
          "<div>" + input("g-score", "점수", a.score, "예: 85", "number") + "</div>" +
          "<div>" + input("g-wrong", "오답 단원", a.wrong_units, "쉼표로 구분: 이차방정식,인수분해") + "</div>" +
        "</div>" +
        '<div class="lib-note">오답 단원은 취약 단원 진단(#diagnosis)에 ‘오답’으로 자동 반영됩니다.</div>' +
        textarea("g-fb", "피드백", a.feedback, "예: 판별식 계산 실수 반복") +
        '<div class="foot"><button class="btn" id="gBack">← 목록</button>' +
        '<button class="btn primary" id="gSave">저장</button></div>'
    );
    $("gBack").onclick = function () { renderAssign(setId); };
    $("gSave").onclick = async function () {
      var btn = $("gSave");
      btn.disabled = true;
      btn.textContent = "저장 중…";
      try {
        await exec("wa_qb_grade", {
          id: a.id, score: val("g-score"), wrong_units: val("g-wrong"), feedback: val("g-fb"),
        });
        toast("채점을 저장했습니다");
        await renderAssign(setId);
        load();
        if (S.studentId) loadReco();
      } catch (e) {
        toast("실패: " + (e && e.message ? e.message : e));
        btn.disabled = false;
        btn.textContent = "저장";
      }
    };
    setTimeout(function () { var t = $("g-score"); if (t) t.focus(); }, 30);
  }

  /* ---------- 스타일 ---------- */
  function injectCSS() {
    if ($("set-style")) return;
    var st = document.createElement("style");
    st.id = "set-style";
    st.textContent =
      ".lib-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center}" +
      ".lib-bar input,.lib-bar select{height:32px;padding:0 10px;border:1px solid var(--ink-200);border-radius:8px;font-size:12.5px;background:#fff;color:var(--ink-900);font-family:inherit}" +
      ".lib-bar input{flex:1 1 180px;min-width:150px}" +
      ".lib-bar input:focus,.lib-bar select:focus{outline:none;border-color:var(--brand-500)}" +
      ".lib-bar .btn{margin-left:auto}" +
      ".set-reco{font-size:12px;color:var(--ink-600);margin-top:10px;line-height:1.8}" +
      ".set-reco .pill{margin-right:4px}" +
      ".lib-sub2{font-size:11px;color:var(--ink-500);margin-top:2px}" +
      ".lib-link{color:inherit;text-decoration:none}.lib-link:hover b{color:var(--brand-500)}" +
      ".lib-act{display:flex;gap:4px;justify-content:flex-end}" +
      ".mini-btn{height:24px;padding:0 8px;border-radius:6px;border:1px solid var(--ink-200);background:#fff;font-size:11px;color:var(--ink-700);cursor:pointer}" +
      ".mini-btn:hover{color:var(--brand-500);border-color:var(--brand-500)}" +
      "@media (max-width:820px){.lib-bar .btn{margin-left:0;width:100%}.lib-act{justify-content:flex-start}}";
    document.head.appendChild(st);
  }

  window.EXTRA_ROUTES = window.EXTRA_ROUTES || {};
  window.EXTRA_ROUTES.sets = render;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", injectCSS);
  else injectCSS();
})();
