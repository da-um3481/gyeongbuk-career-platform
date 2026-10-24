/* ============================================================
   학생 계정 관리 — 로그인 아이디·비밀번호 발급/재설정
   (학생용 화면은 /student)
   ============================================================ */
(function () {
  var S = { q: "", rows: [] };
  var EDIT = null;
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
    setTimeout(function () { t.classList.remove("show"); }, 2400);
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
  function exec(n, p) { return window.agentdb.executeQuery(n, p || {}); }

  function render(root) {
    if (!connected()) {
      root.innerHTML = '<div class="hero"><div class="micro">계정</div><h1>학생 계정</h1></div>' +
        '<div class="err-note">DB에 연결되지 않았습니다.</div>';
      return;
    }
    root.innerHTML =
      '<div class="hero"><div class="micro">계정</div><h1>학생 계정</h1>' +
        "<p>학생용 화면(/student) 로그인에 쓰는 아이디와 비밀번호를 발급·재설정합니다. 비밀번호는 해시로만 저장되며 다시 볼 수 없습니다.</p></div>" +
      '<div class="panel" style="margin-bottom:12px"><div class="lib-bar">' +
        '<input id="acc-q" type="search" placeholder="이름·학번·아이디 검색" value="' + esc(S.q) + '" />' +
        '<a class="btn" href="/student" target="_blank" rel="noopener">학생 화면 열기 ↗</a>' +
      "</div></div>" +
      '<div class="panel" id="acc-list"><div class="skl" style="width:40%"></div></div>';

    $("acc-q").oninput = function () {
      clearTimeout(timer);
      var v = this.value;
      timer = setTimeout(function () { S.q = v.trim(); load(); }, 200);
    };
    load();
  }

  async function load() {
    var box = $("acc-list");
    if (!box) return;
    try {
      var r = await exec("wa_stu_accounts", {});
      S.rows = (r.rows || []).filter(function (s) {
        if (!S.q) return true;
        var q = S.q.toLowerCase();
        return [s.name, s.student_code, s.login_id].some(function (v) {
          return String(v || "").toLowerCase().indexOf(q) >= 0;
        });
      });
      draw();
    } catch (e) {
      box.innerHTML = '<div class="err-note">불러오기 실패: ' + esc(e && e.message ? e.message : e) + "</div>";
    }
  }

  function draw() {
    var box = $("acc-list");
    var withPw = S.rows.filter(function (s) { return s.has_pw; }).length;
    var rows = S.rows.map(function (s) {
      return "<tr>" +
        '<td data-label="이름"><b>' + esc(s.name) + "</b>" +
          '<div class="lib-sub2">' + esc(s.grade || "") + (s.school ? " · " + esc(s.school) : "") + "</div></td>" +
        '<td data-label="학번">' + esc(s.student_code || "—") + "</td>" +
        '<td data-label="로그인 아이디"><code>' + esc(s.login_id || "—") + "</code></td>" +
        '<td data-label="비밀번호">' + (s.has_pw ? '<span class="pill pill-ok">설정됨</span>' : '<span class="pill pill-warn">미설정</span>') + "</td>" +
        '<td data-label="최근 변경">' + esc(s.pw_on || "—") + "</td>" +
        '<td><div class="lib-act"><button class="mini-btn" data-id="' + s.id + '">' +
          (s.has_pw ? "재설정" : "발급") + "</button></div></td></tr>";
    }).join("");

    box.innerHTML =
      '<div class="ph"><div class="pt">학생 목록</div><div class="pa">' + S.rows.length + "명 · 계정 있음 " + withPw + "명</div></div>" +
      (S.rows.length
        ? '<table class="tbl m-cards"><thead><tr><th>이름</th><th>학번</th><th>로그인 아이디</th><th>비밀번호</th><th>최근 변경</th><th></th></tr></thead><tbody>' + rows + "</tbody></table>"
        : '<div class="empty">학생이 없습니다. 먼저 ‘＋ 학생 등록’으로 학생을 추가하세요.</div>');

    box.querySelectorAll("button[data-id]").forEach(function (b) {
      b.onclick = function () { openIssue(parseInt(b.dataset.id, 10)); };
    });
  }

  function randPw() {
    var s = "";
    for (var i = 0; i < 6; i++) s += Math.floor(Math.random() * 10);
    return s;
  }

  function openIssue(id) {
    var stu = null;
    for (var i = 0; i < S.rows.length; i++) if (Number(S.rows[i].id) === id) stu = S.rows[i];
    if (!stu) return;
    EDIT = stu;
    var suggestion = stu.login_id || stu.student_code || "";
    openModal(
      "<h3>" + (stu.has_pw ? "비밀번호 재설정" : "계정 발급") + " — " + esc(stu.name) + "</h3>" +
        '<label for="a-id">로그인 아이디</label>' +
        '<input id="a-id" value="' + esc(suggestion) + '" placeholder="예: ' + esc(stu.student_code || "S2026001") + '" />' +
        '<label for="a-pw">비밀번호 (4자 이상)</label>' +
        '<input id="a-pw" value="' + randPw() + '" />' +
        '<div class="lib-note">저장 후 이 비밀번호를 학생에게 직접 알려주세요. 다시 확인할 수 없습니다.</div>' +
        '<div class="foot"><button class="btn" id="a-rand">새 번호 생성</button>' +
        '<button class="btn" id="mCancel">취소</button>' +
        '<button class="btn primary" id="a-save">저장</button></div>'
    );
    $("a-rand").onclick = function () { $("a-pw").value = randPw(); };
    $("mCancel").onclick = closeModal;
    $("a-save").onclick = saveAccount;
    setTimeout(function () { var e = $("a-pw"); if (e) e.select(); }, 40);
  }

  async function saveAccount() {
    var pw = val("a-pw");
    var lid = val("a-id");
    if (pw.length < 4) { toast("비밀번호는 4자 이상이어야 합니다"); return; }
    var b = $("a-save");
    b.disabled = true;
    b.textContent = "저장 중…";
    try {
      var r = await exec("wa_stu_account_set", { student_id: EDIT.id, login_id: lid, password: pw });
      var row = (r.rows && r.rows[0]) || {};
      closeModal();
      openModal(
        "<h3>계정이 준비되었습니다</h3>" +
          '<div class="acc-done"><div><span class="pa">학생</span><b>' + esc(EDIT.name) + "</b></div>" +
          '<div><span class="pa">아이디</span><b>' + esc(row.login_id || lid) + "</b></div>" +
          '<div><span class="pa">비밀번호</span><b style="font-size:18px;letter-spacing:2px">' + esc(pw) + "</b></div></div>" +
          '<div class="lib-note">이 화면을 닫으면 비밀번호는 다시 볼 수 없습니다. 지금 학생에게 전달하세요.</div>' +
          '<div class="foot"><a class="btn" href="/student" target="_blank" rel="noopener">학생 화면 열기 ↗</a>' +
          '<button class="btn primary" id="mDone">확인</button></div>'
      );
      $("mDone").onclick = closeModal;
      load();
    } catch (e) {
      toast("실패: " + (e && e.message ? e.message : e));
      b.disabled = false;
      b.textContent = "저장";
    }
  }

  function injectCSS() {
    if ($("acc-style")) return;
    var st = document.createElement("style");
    st.id = "acc-style";
    st.textContent =
      ".lib-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center}" +
      ".lib-bar input{height:32px;padding:0 10px;border:1px solid var(--ink-200);border-radius:8px;font-size:12.5px;flex:1 1 200px;min-width:160px}" +
      ".lib-bar .btn{margin-left:auto;text-decoration:none}" +
      ".lib-sub2{font-size:11px;color:var(--ink-500);margin-top:2px}" +
      ".lib-act{display:flex;justify-content:flex-end}" +
      ".mini-btn{height:26px;padding:0 10px;border:1px solid var(--ink-200);border-radius:6px;background:#fff;font-size:11px;cursor:pointer}" +
      ".mini-btn:hover{color:var(--brand-500);border-color:var(--brand-500)}" +
      ".acc-done{display:grid;gap:10px;background:var(--ink-50);border-radius:10px;padding:14px}" +
      ".acc-done span{display:block;font-size:11px}" +
      "code{background:var(--ink-50);padding:1px 6px;border-radius:4px;font-size:12px}";
    document.head.appendChild(st);
  }

  window.EXTRA_ROUTES = window.EXTRA_ROUTES || {};
  window.EXTRA_ROUTES.accounts = render;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", injectCSS);
  else injectCSS();
})();
