/* ============================================================
   튜터 대시보드 확장 — 학생 등록 화면
   (원본 main.js/routes.js 는 건드리지 않고 기능만 덧붙입니다)
   ============================================================ */
(function () {
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

  function field(id, label, type, ph) {
    return (
      '<label for="' + id + '">' + esc(label) + "</label>" +
      '<input id="' + id + '" type="' + (type || "text") + '" placeholder="' + esc(ph || "") + '" />'
    );
  }

  async function openStudentForm() {
    var orgs = [];
    try {
      var r = await window.agentdb.executeQuery("wa_orgs_pick", {});
      orgs = r.rows || [];
    } catch (e) { /* 기관 목록 실패해도 진행 */ }
    var opts =
      '<option value="">(소속 없음)</option>' +
      orgs.map(function (o) { return '<option value="' + o.id + '">' + esc(o.name) + "</option>"; }).join("");

    openModal(
      "<h3>학생 등록</h3>" +
        '<div class="grid2">' +
          '<div>' + field("f-name", "이름 *", "text", "예: 홍길동") +
            field("f-grade", "학년", "text", "예: 중3") +
            field("f-school", "학교", "text", "예: 안동중학교") +
            field("f-phone", "학생 연락처", "text", "010-0000-0000") +
            field("f-style", "학습 스타일", "text", "시각형/청각형/체험형") +
          "</div>" +
          '<div>' +
            field("f-pname", "학부모 이름", "text", "") +
            field("f-pphone", "학부모 연락처", "text", "010-0000-0000") +
            field("f-pemail", "학부모 이메일", "email", "parent@email.com") +
            '<label for="f-org">소속 기관</label><select id="f-org">' + opts + "</select>" +
            field("f-code", "학번 (비우면 자동생성)", "text", "S2026....") +
          "</div>" +
        "</div>" +
        '<label for="f-goal">학습 목표</label>' +
        '<textarea id="f-goal" placeholder="예: 수학 기초 다지기 / 내신 1등급 유지"></textarea>' +
        '<div class="foot"><button class="btn" id="mCancel">취소</button>' +
        '<button class="btn primary" id="mSave">등록</button></div>'
    );
    $("mCancel").onclick = closeModal;
    $("mSave").onclick = saveStudent;
    setTimeout(function () { var n = $("f-name"); if (n) n.focus(); }, 30);
  }

  async function saveStudent() {
    var g = function (id) { var e = $(id); return e ? String(e.value || "").trim() : ""; };
    var name = g("f-name");
    if (!name) { toast("이름을 입력하세요"); return; }
    if (window.agentdb.isConnected && !window.agentdb.isConnected()) {
      toast("DB가 연결되지 않아 저장되지 않습니다 (데모 모드)");
      return;
    }
    var save = $("mSave");
    save.disabled = true;
    save.textContent = "등록 중…";
    try {
      var r = await window.agentdb.executeQuery("wa_m_student_add", {
        student_code: g("f-code"), name: name, grade: g("f-grade"), school: g("f-school"),
        phone: g("f-phone"), parent_name: g("f-pname"), parent_phone: g("f-pphone"),
        parent_email: g("f-pemail"), learning_style: g("f-style"), learning_goal: g("f-goal"),
        org_id: g("f-org"),
      });
      closeModal();
      var row = (r.rows && r.rows[0]) || {};
      toast("학생 등록됨" + (row.student_code ? " (" + row.student_code + ")" : ""));
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    } catch (e) {
      toast("실패: " + (e && e.message ? e.message : e));
      save.disabled = false;
      save.textContent = "등록";
    }
  }

  function mount() {
    var right = document.querySelector(".top .right");
    if (!right) return;
    if (!$("ext-add-student")) {
      var b = document.createElement("button");
      b.id = "ext-add-student";
      b.textContent = "＋ 학생 등록";
      b.style.cssText = "border-color:var(--brand-500);color:var(--brand-500);font-weight:700";
      b.onclick = openStudentForm;
      right.appendChild(b);
    }
    if (!$("ext-logout")) {
      var o = document.createElement("button");
      o.id = "ext-logout";
      o.textContent = "로그아웃";
      o.onclick = function () { if (window.TUTOR_LOGOUT) window.TUTOR_LOGOUT(); };
      right.appendChild(o);
    }
  }

  function startExtras() {
    mount();
    new MutationObserver(mount).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startExtras);
  else startExtras();
})();
