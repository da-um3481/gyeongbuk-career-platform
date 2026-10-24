/* 다움 학습노트 — 학생용 */
(function () {
  var TOKEN_KEY = "daum_stu_token";
  var TAB = "today";
  var DATA = {};
  var ME = null;

  var app = document.getElementById("app");
  var modal = document.getElementById("modal");
  var toastEl = document.getElementById("toast");

  function $(id) { return document.getElementById(id); }
  function esc(v) {
    var d = document.createElement("div");
    d.textContent = v == null ? "" : String(v);
    return d.innerHTML;
  }
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    setTimeout(function () { toastEl.classList.remove("show"); }, 2000);
  }
  function token() {
    try { return localStorage.getItem(TOKEN_KEY) || ""; } catch (e) { return ""; }
  }
  function setToken(t) {
    try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch (e) {}
  }
  function api(action, extra) {
    var body = Object.assign({ action: action }, extra || {});
    return fetch("/api/student", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token() },
      body: JSON.stringify(body),
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) {
          if (r.status === 401) { setToken(""); renderLogin("다시 로그인해 주세요."); }
          throw new Error(j.error || ("HTTP " + r.status));
        }
        return j;
      });
    });
  }

  /* ---------------- 로그인 ---------------- */
  function renderLogin(msg) {
    ME = null;
    $("btnOut").style.display = "none";
    $("btnPw").style.display = "none";
    app.innerHTML =
      '<div class="login"><div class="card">' +
        '<img src="/logo-mark.png" alt="DA.UM" />' +
        "<h1>다움 학습노트</h1>" +
        '<div class="sub">학번과 비밀번호로 들어오세요</div>' +
        '<label for="lid">학번 또는 아이디</label>' +
        '<input id="lid" autocomplete="username" placeholder="예: S2026001" />' +
        '<label for="lpw">비밀번호</label>' +
        '<input id="lpw" type="password" autocomplete="current-password" placeholder="비밀번호" />' +
        '<button class="primary" id="lgo">들어가기</button>' +
        '<div class="err" id="lerr">' + esc(msg || "") + "</div>" +
      "</div></div>";
    $("lgo").onclick = doLogin;
    $("lpw").onkeydown = function (e) { if (e.key === "Enter") doLogin(); };
    setTimeout(function () { var e = $("lid"); if (e) e.focus(); }, 50);
  }

  function doLogin() {
    var id = $("lid").value.trim();
    var pw = $("lpw").value;
    if (!id || !pw) { $("lerr").textContent = "학번과 비밀번호를 입력하세요."; return; }
    var b = $("lgo");
    b.disabled = true;
    b.textContent = "확인 중…";
    fetch("/api/student", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "login", id: id, pw: pw }),
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error(res.j.error || "로그인 실패");
        setToken(res.j.token);
        ME = res.j.student;
        boot();
      })
      .catch(function (e) {
        $("lerr").textContent = e.message;
        b.disabled = false;
        b.textContent = "들어가기";
      });
  }

  /* ---------------- 본문 ---------------- */
  function shell() {
    var name = (ME && ME.name) || "학생";
    app.innerHTML =
      '<div class="wrap">' +
        '<div class="hello"><h2>' + esc(name) + "님, 안녕하세요</h2>" +
          "<p>" + esc([ME.grade, ME.school].filter(Boolean).join(" · ")) +
          (ME.learning_goal ? " · " + esc(ME.learning_goal) : "") + "</p></div>" +
        '<div class="tabs">' +
          '<button data-tab="today">오늘</button>' +
          '<button data-tab="hw">숙제</button>' +
          '<button data-tab="sets">내 시험지</button>' +
          '<button data-tab="rx">처방·로드맵</button>' +
          '<button data-tab="grade">성적·진도</button>' +
        "</div>" +
        '<div id="body"><div class="sec"><div class="empty">불러오는 중…</div></div></div>' +
        '<div class="foot-note">다움진로진학컨설팅 · 학습 문의는 담당 선생님께</div>' +
      "</div>";
    document.querySelectorAll(".tabs button").forEach(function (b) {
      b.onclick = function () { TAB = b.dataset.tab; paintTabs(); loadTab(); };
    });
    $("btnOut").style.display = "";
    $("btnPw").style.display = "";
    $("btnOut").onclick = logout;
    $("btnPw").onclick = openPw;
    paintTabs();
    loadTab();
  }

  function paintTabs() {
    document.querySelectorAll(".tabs button").forEach(function (b) {
      b.classList.toggle("on", b.dataset.tab === TAB);
    });
  }

  function logout() {
    setToken("");
    renderLogin("");
  }

  function boot() {
    shell();
  }

  function row(html) { return html; }

  function emptyBox(t) { return '<div class="empty">' + esc(t) + "</div>"; }

  async function loadTab() {
    var box = $("body");
    if (!box) return;
    box.innerHTML = '<div class="sec"><div class="empty">불러오는 중…</div></div>';
    try {
      if (TAB === "today") {
        var d = await api("home");
        box.innerHTML = viewToday(d);
        box.querySelectorAll("button[data-done]").forEach(function (b) {
          b.onclick = function () { markDone(b.dataset.done); };
        });
      } else if (TAB === "hw") {
        var h = await api("homework");
        box.innerHTML = viewHw(h.homework || []);
        box.querySelectorAll("button[data-done]").forEach(function (b) {
          b.onclick = function () { markDone(b.dataset.done); };
        });
      } else if (TAB === "sets") {
        var s = await api("sets");
        box.innerHTML = viewSets(s.sets || []);
      } else if (TAB === "rx") {
        var p = await api("prescription");
        box.innerHTML = viewRx(p);
      } else {
        var g = await api("grades");
        box.innerHTML = viewGrades(g);
      }
    } catch (e) {
      box.innerHTML = '<div class="sec"><div class="empty">' + esc(e.message) + "</div></div>";
    }
  }

  function viewToday(d) {
    var cls = (d.classes || []).map(function (c) {
      return '<div class="row"><div class="d">' + esc(String(c.date || "").slice(5)) + "</div>" +
        '<div class="b"><b>' + esc(c.subject_name || "수업") + " · " + esc(c.topic || "") + "</b>" +
        "<span>" + esc([c.start_time, c.end_time].filter(Boolean).join("~")) +
        (c.attendance ? " · 출결 " + esc(c.attendance) : "") + "</span></div></div>";
    }).join("");

    var hw = (d.homework || []).map(function (h) {
      return '<div class="row"><div class="d">' + esc(h.due ? h.due.slice(5) : "—") + "</div>" +
        '<div class="b"><b>' + esc(h.title) + "</b><span>" + esc(h.subject_name || "") + " · 마감</span></div>" +
        '<button class="mini" data-done="' + h.id + '">완료</button></div>';
    }).join("");

    var st = (d.sets || []).map(function (s) {
      return '<div class="row"><div class="d">시험지</div>' +
        '<div class="b"><b>' + esc(s.title) + "</b><span>" +
        (s.due ? "마감 " + esc(s.due) : "기한 없음") + "</span></div>" +
        (s.url
          ? '<a class="mini go" style="text-decoration:none;display:inline-flex;align-items:center" href="' + esc(s.url) + '" target="_blank" rel="noopener">풀기</a>'
          : '<span class="pill">링크 없음</span>') +
        "</div>";
    }).join("");

    var wk = (d.weak || []).map(function (w) {
      return '<span class="pill warn" style="margin:0 4px 4px 0">' + esc(w.unit) + " ×" + w.n + "</span>";
    }).join("");

    return (
      '<div class="sec"><h3>다가오는 수업 <span class="cnt">' + (d.classes || []).length + "건</span></h3>" +
        (cls || emptyBox("예정된 수업이 없습니다.")) + "</div>" +
      '<div class="sec"><h3>남은 숙제 <span class="cnt">' + (d.homework || []).length + "개</span></h3>" +
        (hw || emptyBox("남은 숙제가 없습니다.")) + "</div>" +
      '<div class="sec"><h3>풀어야 할 시험지 <span class="cnt">' + (d.sets || []).length + "개</span></h3>" +
        (st || emptyBox("배정된 시험지가 없습니다.")) + "</div>" +
      (wk ? '<div class="sec"><h3>내가 자주 틀린 단원</h3>' + wk + "</div>" : "")
    );
  }

  function viewHw(list) {
    if (!list.length) return '<div class="sec">' + emptyBox("숙제가 없습니다.") + "</div>";
    var rows = list.map(function (h) {
      var done = h.status === "완료";
      return '<div class="row"><div class="d">' + esc(h.due ? h.due.slice(5) : "—") + "</div>" +
        '<div class="b"><b>' + esc(h.title) + "</b><span>" + esc(h.subject_name || "") +
        (h.score != null ? " · " + esc(h.score) + "점" : "") +
        (h.feedback ? " · " + esc(h.feedback) : "") + "</span></div>" +
        (done
          ? '<span class="pill ok">완료</span>'
          : '<button class="mini" data-done="' + h.id + '">완료</button>') +
        "</div>";
    }).join("");
    return '<div class="sec"><h3>내 숙제 <span class="cnt">' + list.length + "개</span></h3>" + rows + "</div>";
  }

  function viewSets(list) {
    if (!list.length) return '<div class="sec">' + emptyBox("배정된 시험지가 없습니다.") + "</div>";
    var rows = list.map(function (s) {
      var graded = s.status === "채점";
      return '<div class="sec" style="margin-top:10px">' +
        '<h3 style="justify-content:space-between">' + esc(s.title) +
          '<span class="pill ' + (graded ? "ok" : "brand") + '">' + (graded ? "채점 완료" : "풀기 전") + "</span></h3>" +
        '<div style="font-size:12px;color:var(--ink-500);margin-bottom:8px">' +
          esc([s.subject_name, s.unit_name, s.item_count ? s.item_count + "문항" : ""].filter(Boolean).join(" · ")) + "</div>" +
        (graded
          ? '<div class="grid2"><div class="kpi"><b>' + (s.score == null ? "—" : esc(s.score)) + "</b><span>점수</span></div>" +
            '<div class="kpi"><b style="font-size:12px;line-height:1.6">' + esc(s.wrong_units || "없음") + "</b><span>틀린 단원</span></div></div>"
          : "") +
        (s.url
          ? '<a class="mini go" style="margin-top:10px;display:inline-flex;align-items:center;text-decoration:none" href="' + esc(s.url) + '" target="_blank" rel="noopener">시험지 열기 ↗</a>'
          : "") +
        (s.feedback ? '<div style="font-size:12px;color:var(--ink-600);margin-top:8px">선생님: ' + esc(s.feedback) + "</div>" : "") +
        "</div>";
    }).join("");
    return rows;
  }

  function viewRx(p) {
    var c = (p.counsel || []).map(function (x) {
      return '<div class="row"><div class="d">' + esc(String(x.date || "").slice(5)) + "</div>" +
        '<div class="b"><b>' + esc(x.topic || "상담") + "</b><span>" + esc(x.prescription || "") + "</span>" +
        (x.next_step ? '<span style="display:block;margin-top:3px;color:var(--brand)">다음: ' + esc(x.next_step) + "</span>" : "") +
        "</div></div>";
    }).join("");
    var s = (p.steps || []).map(function (x) {
      return '<div class="row"><div class="d">' + x.step_order + "단계</div>" +
        '<div class="b"><b>' + esc(x.title) + "</b><span>" + esc(x.path_name || "") + (x.target ? " · " + esc(x.target) : "") + "</span></div>" +
        '<span class="pill ' + (x.status === "완료" ? "ok" : "mute") + '">' + esc(x.status || "예정") + "</span></div>";
    }).join("");
    return (
      '<div class="sec"><h3>상담 처방 <span class="cnt">' + (p.counsel || []).length + "건</span></h3>" +
        (c || emptyBox("상담 기록이 없습니다.")) + "</div>" +
      '<div class="sec"><h3>학습 로드맵</h3>' + (s || emptyBox("학습 경로가 없습니다.")) + "</div>"
    );
  }

  function viewGrades(g) {
    var grades = (g.grades || []).map(function (x) {
      return '<div class="row"><div class="d">' + esc(x.school_year) + "-" + esc(x.semester) + '</div>' +
        '<div class="b"><b>' + esc(x.subject_name) + "</b><span>" + esc(x.achievement || "") + "</span></div>" +
        '<span class="pill ' + (Number(x.grade) <= 2 ? "ok" : "mute") + '">' + esc(x.grade == null ? "—" : x.grade + "등급") + "</span></div>";
    }).join("");
    var prog = (g.progress || []).map(function (x) {
      var pct = Math.max(0, Math.min(100, Number(x.progress_percent) || 0));
      return '<div style="padding:8px 0;border-top:1px solid var(--ink-50)">' +
        '<div style="display:flex;justify-content:space-between;font-size:12.5px">' +
          "<b>" + esc(x.unit_name || "-") + "</b>" +
          '<span style="color:var(--ink-500)">' + esc(x.subject_name || "") + " · " + pct + "%</span></div>" +
        '<div class="bar-l"><i style="width:' + pct + '%"></i></div></div>';
    }).join("");
    return (
      '<div class="sec"><h3>내신 성적 <span class="cnt">' + (g.grades || []).length + "건</span></h3>" +
        (grades || emptyBox("성적이 등록되지 않았습니다.")) + "</div>" +
      '<div class="sec"><h3>단원별 진도</h3>' + (prog || emptyBox("진도 정보가 없습니다.")) + "</div>"
    );
  }

  async function markDone(id) {
    try {
      var r = await api("complete", { id: id });
      if (r.ok) { toast("숙제를 완료로 표시했습니다"); loadTab(); }
      else toast("처리하지 못했습니다");
    } catch (e) { toast(e.message); }
  }

  /* ---------------- 비밀번호 변경 ---------------- */
  function openPw() {
    modal.innerHTML =
      '<div class="box"><h3>비밀번호 변경</h3>' +
        '<label>현재 비밀번호</label><input id="p-old" type="password" />' +
        '<label>새 비밀번호 (4자 이상)</label><input id="p-new" type="password" />' +
        '<div class="err" id="p-err"></div>' +
        '<div class="foot"><button id="p-cancel">취소</button><button class="primary" id="p-save">변경</button></div></div>';
    modal.classList.add("show");
    modal.onclick = function (e) { if (e.target === modal) closePw(); };
    $("p-cancel").onclick = closePw;
    $("p-save").onclick = async function () {
      try {
        var r = await api("change_pw", { old: $("p-old").value, new: $("p-new").value });
        if (!r.ok) { $("p-err").textContent = r.error || "변경 실패"; return; }
        closePw();
        toast("비밀번호를 변경했습니다");
      } catch (e) { $("p-err").textContent = e.message; }
    };
  }
  function closePw() { modal.classList.remove("show"); modal.innerHTML = ""; }

  /* ---------------- 시작 ---------------- */
  (async function start() {
    if (!token()) return renderLogin("");
    try {
      var r = await api("me");
      ME = r.student;
      if (!ME) return renderLogin("");
      boot();
    } catch (e) {
      setToken("");
      renderLogin("");
    }
  })();
})();
