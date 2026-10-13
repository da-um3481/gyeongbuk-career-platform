/* ============================================================
   경상북도 진로학업설계 플랫폼 - App
   ============================================================ */
(function () {
  "use strict";
  const G = window.GB || {};
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );

  /* ---- 학교 위치(좌표·주소) 매칭: geo.js(OpenStreetMap) 기반 ---- */
  function candName(s) { return String(s == null ? "" : s).replace(/\s+/g, ""); }
  function pbStrip(s) { return s.replace(/^경상북도/, "").replace(/^경북/, ""); }
  function locateSchool(name) {
    const list = G.osmSchools || [];
    const v = candName(name);
    if (!v) return null;
    let best = null, bestScore = 0;
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      const n = candName(o.n);
      if (!n) continue;
      let score = 0;
      if (n === v) score = 1000;
      else if (n.indexOf(v) >= 0 && v.length >= 6) score = 600 + v.length;
      else if (v.indexOf(n) >= 0 && n.length >= 7) score = 500 + n.length;
      if (score > bestScore) { best = o; bestScore = score; }
    }
    return bestScore >= 500 ? best : null;
  }
  function schoolAddr(district, o) {
    if (!o) return "";
    if (o.a) return o.a;
    if (o.st && o.hn) return district + " " + o.st + " " + o.hn;
    if (o.st) return district + " " + o.st;
    return "";
  }
  function addrFor(name, district, o) {
    const map = G.schoolAddresses || {};
    if (name && map[name]) return map[name];
    return schoolAddr(district, o);
  }
  /* ---- 관심 저장(즐겨찾기) ---- */
  const FAV_KEY = "gb_fav_v1";
  function favGet() {
    try {
      const f = JSON.parse(localStorage.getItem(FAV_KEY) || "{}");
      return { schools: f.schools || [], jobs: f.jobs || [] };
    } catch (e) {
      return { schools: [], jobs: [] };
    }
  }
  function favHas(kind, name) {
    return favGet()[kind + "s"].indexOf(name) >= 0;
  }
  function favToggle(kind, name) {
    const f = favGet();
    const arr = f[kind + "s"];
    const i = arr.indexOf(name);
    if (i >= 0) arr.splice(i, 1);
    else arr.push(name);
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify(f));
    } catch (e) {}
  }
  function favStar(kind, name, small) {
    const on = favHas(kind, name);
    return `<button class="fav-btn${on ? " on" : ""}" data-fav="${esc(kind)}" data-favname="${esc(name)}" title="관심 저장" aria-label="관심 저장">${on ? "★" : "☆"}${small ? "" : " 저장"}</button>`;
  }

  function schoolCardHTML(name, district, showDistrict) {
    const type = G.schoolTypeOf(name);
    const color = (G.schoolTypeColor || {})[type] || "b-slate";
    const o = locateSchool(name);
    const addr = addrFor(name, district, o);
    return `<div class="li hover" data-school="${esc(name)}" data-schooldistrict="${esc(district)}" role="button" tabindex="0" style="cursor:pointer">
      <div class="row between"><h4 style="font-size:14.5px">${esc(name)}</h4><span class="row" style="gap:6px"><span class="badge ${color}">${esc(type)}</span>${favStar("school", name, true)}</span></div>
      ${showDistrict ? `<div class="li-sub mt-8">${esc(district)}</div>` : ""}
      ${addr ? `<div class="li-sub mt-8">📍 ${esc(addr)}</div>` : ""}
      <div class="tc-foot" style="margin-top:8px;padding-top:8px">🗺️ 위치 · 길찾기 →</div></div>`;
  }
  function schoolPoints() {
    const pts = [];
    (G.highSchools || []).forEach((s) => {
      const o = locateSchool(s.name);
      if (o && o.lat && o.lon) pts.push({ name: s.name, district: s.district, type: s.type, lat: +o.lat, lon: +o.lon });
    });
    return pts;
  }
  function filteredSchools() {
    return (G.highSchools || []).filter(
      (s) =>
        (state.mapDistrict === "전체" || s.district === state.mapDistrict) &&
        (state.mapType === "전체" || s.type === state.mapType)
    );
  }
  function transitBlock(district, heading) {
    const t = (G.transit || {})[district];
    if (!t) return "";
    return `<p class="mt-16" style="font-weight:800">${heading ? "🚉 " + esc(heading) + " 교통 안내" : "🚉 교통 안내"}</p>
      <div class="li" style="box-shadow:none;cursor:default">
        ${t.rail && t.rail.length ? `<div>🚆 ${t.rail.map(esc).join(" · ")}</div>` : `<div class="li-sub">🚆 철도역 없음 (버스 이용)</div>`}
        ${t.bus && t.bus.length ? `<div class="mt-8">🚌 ${t.bus.map(esc).join(" · ")}</div>` : ""}
        ${t.note ? `<div class="li-sub mt-8">ℹ️ ${esc(t.note)}</div>` : ""}
        <div class="map-actions mt-8">
          <a class="btn btn-sm" href="https://www.letskorail.com" target="_blank" rel="noopener">코레일 기차 예매</a>
          <a class="btn btn-sm" href="https://www.bustago.or.kr" target="_blank" rel="noopener">시외버스 예매</a>
        </div>
      </div>`;
  }

  const state = {
    tab: "home",
    district: "전체",
    hsType: "전체",
    hsQ: "",
    mapDistrict: "전체",
    mapType: "전체",
    schoolType: "all",
    subjectGroup: "전체",
    subjectType: "전체",
    subjectQ: "",
    field: "전체",
    jobCat: "all",
    jobQ: "",
    jobFutureOnly: false,
    expArea: "전체",
    chapter: "concept",
    recommendUni: 0,
  };

  /* ---------------- Header / Nav / Footer ---------------- */
  function renderChrome() {
    $("#site-header").innerHTML = `
      <div class="header-inner">
        <div class="brand" data-goto="home" role="button" tabindex="0" aria-label="홈으로">
          <div class="brand-mark">경북</div>
          <div class="brand-text">
            <b>경상북도 진로학업설계 플랫폼</b>
            <small>질문이 진로가 되는 경북 진로교육 · 22개 시·군</small>
          </div>
        </div>
        <div class="header-spacer"></div>
        <div class="header-actions">
          <button class="ghost-btn" data-goto="counseling">진로검사 바로가기</button>
        </div>
      </div>`;

    $("#tab-nav").innerHTML = `
      <div class="tab-scroll">
        ${G.tabs
          .map(
            (t) =>
              `<button class="tab-btn${t.id === state.tab ? " active" : ""}" data-tab="${t.id}">${t.icon ? esc(t.icon) + " " : ""}${esc(t.label)}</button>`
          )
          .join("")}
      </div>`;

    const sitemap = (G.tabs || [])
      .filter((t) => t.id !== "home")
      .map((t) => `<button class="foot-nav" data-tab="${esc(t.id)}">${t.icon ? esc(t.icon) + " " : ""}${esc(t.label)}</button>`)
      .join("");
    $("#site-footer").innerHTML = `
      <div class="foot-inner">
        <div><b>${esc(G.meta.title)}</b> · ${esc(G.meta.slogan)}</div>
        <div class="foot-cols">
          <div>
            <div class="foot-h">바로가기 (메뉴)</div>
            <div class="foot-nav-wrap">${sitemap}</div>
          </div>
          <div>
            <div class="foot-h">외부 기관</div>
            <div class="foot-links">
              <a href="https://www.gbe.kr/jinhak/main.do" target="_blank" rel="noopener">경북진학지원센터</a>
              <a href="https://www.ggoomgil.go.kr" target="_blank" rel="noopener">꿈길 진로체험</a>
              <a href="https://www.career.go.kr" target="_blank" rel="noopener">커리어넷</a>
              <a href="https://www.adiga.kr" target="_blank" rel="noopener">대입정보포털</a>
            </div>
          </div>
        </div>
        <div class="muted">${esc(G.meta.title)} · ${esc(G.meta.office)} · 본 플랫폼은 진로·학업설계 이해를 돕기 위한 교육용 자료이며, 대학별 전형·과목 정보는 반드시 각 대학 입학처 원문을 확인하세요.</div>
      </div>`;
  }

  /* ---------------- Home ---------------- */
  function viewHome() {
    const cards = (G.homeCards || [])
      .map(
        (c) => `
      <article class="card hover tab-card" data-goto="${esc(c.id)}" tabindex="0">
        <div class="tc-top">
          <div class="tc-icon ${esc(c.grad)}">${esc(c.icon)}</div>
          <span class="badge ${esc(c.badgeClass)}">${esc(c.badge)}</span>
        </div>
        <div>
          <h3>${esc(c.title)}</h3>
          <div class="tc-sub">${esc(c.sub)}</div>
        </div>
        <p class="tc-desc">${esc(c.desc)}</p>
        <div class="tc-foot">${esc(c.stats)} →</div>
      </article>`
      )
      .join("");
    return `
      <section class="page">
        <div class="hero">
          <span class="eyebrow">경상북도교육청 · ${esc(G.meta.updated)}</span>
          <h1>교사·학생·학부모가 함께 보는 <span class="accent">경상북도</span> 진로·학업설계 <span class="accent2">E-Book</span></h1>
          <p>${esc(G.meta.slogan)} · 2022 개정 교육과정과 고교학점제 192학점을 기반으로, 경북 22개 시·군의 학생이 자기주도적으로 진로를 설계하도록 돕습니다.</p>
          <div class="hero-stats">
            <div class="hs"><b>${esc(G.meta.cities + G.meta.counties)}</b><span>시·군</span></div>
            <div class="hs"><b>11</b><span>진로·학업 콘텐츠</span></div>
            <div class="hs"><b>192</b><span>졸업 최소 학점</span></div>
            <div class="hs"><b>2028</b><span>대입 대비</span></div>
          </div>
        </div>
        <div class="section-title">
          <div class="st-icon">📌</div>
          <div><h2>무엇을 탐색할까요?</h2><p>관심 주제를 선택하면 경북 맞춤 정보로 이동합니다.</p></div>
        </div>
        <div class="grid cols-3">${cards}</div>
      </section>`;
  }

  /* ---------------- 진로·학업설계 ---------------- */
  function chapterTabs() {
    return (G.chapters || [])
      .map(
        (c) =>
          `<button class="ch-btn${c.id === state.chapter ? " active" : ""}" data-chapter="${esc(c.id)}">
            <div class="ch-num ${esc(c.grad)}">${esc(c.num)}</div>
            <h4>${esc(c.title)}</h4>
            <p>${esc(c.subtitle)}</p>
          </button>`
      )
      .join("");
  }
  function viewDesign() {
    const ch = (G.chapters || []).find((c) => c.id === state.chapter) || (G.chapters || [])[0];
    let body = "";
    if (ch) {
      if (ch.roadmap) {
        body = `<div class="grid cols-3">${(G.roadmap || [])
          .map(
            (r) => `<article class="card">
              <div class="row between"><span class="badge b-indigo">${esc(r.step)}</span><span class="badge b-slate">${esc(r.title.split(" (")[0])}</span></div>
              <h4 class="mt-8" style="font-weight:800">“${esc(r.question)}”</h4>
              <p class="mt-8 muted">${esc(r.desc)}</p>
              <ul class="mt-8" style="padding-left:18px;font-size:13px;color:var(--slate-600)">${r.actions.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>
            </article>`
          )
          .join("")}</div>`;
      } else if (ch.growth) {
        body = `<div class="grid cols-4">${(G.growth || [])
          .map(
            (g) => `<article class="card">
              <div class="row between"><h4 style="font-weight:900">${esc(g.stage)}</h4><span class="badge b-emerald">${esc(g.period)}</span></div>
              <p class="tc-sub mt-8">${esc(g.focus)}</p>
              <ul class="mt-8" style="padding-left:18px;font-size:13px;color:var(--slate-600)">${g.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>
            </article>`
          )
          .join("")}</div>`;
      } else if (ch.backward) {
        body = `
          <div class="notice info">백워드 디자인: <b>목표(전공·직업) → 권장과목 확인 → 학기별 배치</b> 순으로 거꾸로 설계합니다.</div>
          <div class="grid cols-4 mt-16">
            ${[
              { n: "STEP 1", t: "목표 정하기", d: "희망 전공·직업 2~3개를 정합니다." },
              { n: "STEP 2", t: "권장과목 확인", d: "대학·전공별 필수·권장 이수과목을 조회합니다." },
              { n: "STEP 3", t: "과목 배치", d: "학기별로 진로선택·일반선택을 배치합니다." },
              { n: "STEP 4", t: "검증·수정", d: "이수 학점과 균형을 점검하고 수정합니다." },
            ]
              .map(
                (s) => `<article class="card"><span class="badge b-indigo">${esc(s.n)}</span><h4 class="mt-8" style="font-weight:800">${esc(s.t)}</h4><p class="mt-8 muted">${esc(s.d)}</p></article>`
              )
              .join("")}
          </div>
          <div class="mt-16">
            <div class="notice ok">Tip · 경북은 시·군 소재 학교 간 <b>공동교육과정</b>과 지역 대학 연계 진로과목으로 선택 폭을 넓힙니다.</div>
          </div>`;
      } else if (ch.planb) {
        body = `<div class="grid cols-2">${(G.planB || [])
          .map(
            (p) => `<article class="card">
              <div class="row between"><span class="badge b-rose">${esc(p.type)}</span><span class="tc-sub">${esc(p.name)}</span></div>
              <p class="mt-8"><b>${esc(p.example)}</b></p>
              <p class="mt-8 muted">${esc(p.tip)}</p>
              <div class="tag-row">${p.keep.map((k) => `<span class="tag">${esc(k)}</span>`).join("")}</div>
            </article>`
          )
          .join("")}</div>`;
      } else {
        const principals = (ch.principles || [])
          .map(
            (p) => `<article class="card"><h4 style="font-weight:800">${esc(p.title)}</h4><p class="mt-8 muted">${esc(p.desc)}</p></article>`
          )
          .join("");
        const sections = (ch.sections || [])
          .map(
            (s) => `<div class="mt-16"><h3 style="font-size:16px;font-weight:800">${esc(s.heading)}</h3>
              <ul class="mt-8" style="padding-left:18px;color:var(--slate-600);font-size:13.5px">${(s.list || []).map((i) => `<li>${esc(i)}</li>`).join("")}</ul></div>`
          )
          .join("");
        body = `<div class="grid cols-3">${principals}</div>${sections}`;
      }
    }
    return `
      <section class="page">
        <div class="section-title">
          <div class="st-icon">🧭</div>
          <div><h2>경북 진로·학업설계</h2><p>개념 & 5단계 실천 로드맵 · 질문이 나의 진로가 되는 길</p></div>
        </div>
        <div class="chapter-nav">${chapterTabs()}</div>
        ${ch ? `<div class="card"><h3 style="font-size:18px;font-weight:900">${esc(ch.num)}. ${esc(ch.title)}</h3><p class="mt-8 muted">${esc(ch.intro)}</p></div>` : ""}
        <div class="mt-16">${body}</div>
      </section>`;
  }

  /* ---------------- 고교 선택 ---------------- */
  function viewHighschool() {
    const dists = G.districts || [];
    const dName = state.district;
    const d = dists.find((x) => x.name === dName);
    const distChips = [{ name: "전체" }].concat(dists);
    const chips = distChips
      .map((x) => `<button class="chip${x.name === dName ? " active" : ""}" data-district="${esc(x.name)}">${esc(x.name)}</button>`)
      .join("");

    const detail = d
      ? `<article class="card mt-16">
          <div class="row between">
            <div><h3 style="font-size:18px;font-weight:900">${esc(d.name)}</h3><span class="tc-sub">${esc(d.region)} · ${esc(d.industry)}</span></div>
            <span class="badge b-sky">${esc(d.type)}</span>
          </div>
          <p class="mt-8 muted">${esc(d.desc)}</p>
          <div class="tag-row">${d.tags.map((t) => `<span class="tag">#${esc(t)}</span>`).join("")}</div>
          ${d.unis.length ? `<p class="mt-8" style="font-size:13px"><b>지역 대학:</b> ${d.unis.map(esc).join(", ")}</p>` : ""}
          <button class="btn btn-sm btn-primary mt-16" data-mapdist="${esc(d.name)}">🗺️ ${esc(d.name)} 지도 · 길찾기</button>
        </article>`
      : `<div class="notice info mt-16">22개 시·군 중 하나를 선택하면 지역 산업·대학·특화 정보를 볼 수 있습니다.</div>`;

    const typeNames = ["전체", "일반고", "특성화고", "마이스터고", "과학고", "외국어고", "예술고", "체육고", "자율형 공립고", "자율형 사립고"];
    const typeChips = typeNames
      .map((t) => `<button class="chip${t === state.hsType ? " active" : ""}" data-hstype="${esc(t)}">${esc(t)}</button>`)
      .join("");

    const q = state.hsQ.trim().toLowerCase();
    const matched = (G.highSchools || []).filter((s) => {
      if (dName !== "전체" && s.district !== dName) return false;
      if (state.hsType !== "전체" && s.type !== state.hsType) return false;
      if (q && s.name.toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    let schoolList;
    if (!matched.length) {
      schoolList = `<div class="empty">조건에 맞는 고등학교가 없습니다.</div>`;
    } else if (dName === "전체" && state.hsType === "전체" && !q) {
      schoolList = Object.keys(G.highSchoolData)
        .map((dist) => {
          const items = G.highSchoolData[dist] || [];
          return `<div class="mt-16"><div class="row between"><h3 style="font-size:15px;font-weight:900">${esc(dist)}</h3><span class="badge b-slate">${items.length}교</span></div>
            <div class="grid cols-3 mt-8">${items.map((n) => schoolCardHTML(n, dist, false)).join("")}</div></div>`;
        })
        .join("");
    } else {
      schoolList = `<div class="grid cols-3">${matched.map((s) => schoolCardHTML(s.name, s.district, dName === "전체")).join("")}</div>`;
    }

    const types = (G.schoolTypes || [])
      .map(
        (t) => `<div class="acc" data-acc><button class="acc-head"><span class="q"><span class="n" style="background:var(--sky-50);color:var(--sky-700)">유형</span>${esc(t.name)}</span><span class="caret">▾</span></button>
          <div class="acc-body"><p>${esc(t.summary)}</p><ul class="mt-8" style="padding-left:18px">${t.points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul></div></div>`
      )
      .join("");

    const admission = [
      { t: "평준화 지역", d: "일부 도시는 중학교 내신으로 선발합니다. 관내 고교 배정 방식·지원 절차를 확인하세요." },
      { t: "비평준화 지역", d: "고등학교별 전형(내신·추첨 등)으로 선발합니다. 희망 고교의 전형과 지원 전략을 세워야 합니다." },
      { t: "전기고 / 후기고", d: "특목고·마이스터고·특성화고는 전기, 일반고·자공고는 후기에 선발됩니다. 원서 시기가 다릅니다." },
      { t: "경북 공동교육과정", d: "인근 학교·지역 대학과 연계한 공동교육과정으로 다양한 선택과목을 이수할 수 있습니다." },
    ]
      .map(
        (a) => `<article class="card"><h4 style="font-weight:800;color:var(--sky-700)">${esc(a.t)}</h4><p class="mt-8 muted">${esc(a.d)}</p></article>`
      )
      .join("");

    return `
      <section class="page">
        <div class="section-title">
          <div class="st-icon g-sky">🏫</div>
          <div><h2>고교 선택</h2><p>경북 22개 시·군 고교 안내 · 고입 전형 가이드</p></div>
        </div>
        <div class="chip-row">${chips}</div>
        ${detail}
        <div class="toolbar mt-16">
          <div class="search-wrap"><input type="search" id="hs-q" placeholder="고등학교명 검색 (예: 포항고, 마이스터, 여자고)" value="${esc(state.hsQ)}" /></div>
        </div>
        <div class="chip-row mb-16">${typeChips}</div>
        <div class="result-line">경북 22개 시·군 · 총 ${matched.length}개교</div>
        <div>${schoolList}</div>
        <div class="section-title mt-24"><div class="st-icon g-indigo">🎯</div><div><h2 style="font-size:18px">고교 유형별 심층 분석</h2></div></div>
        <div class="grid cols-2">${types}</div>
        <div class="section-title mt-24"><div class="st-icon g-sky">📋</div><div><h2 style="font-size:18px">고입 전형 체계</h2></div></div>
        <div class="grid cols-4">${admission}</div>
        <div class="notice mt-16">출처: 위키백과 지역별 고등학교 분류 및 공개 자료. 유형은 학교명 기반 자동 분류로 실제와 다를 수 있으며, 최신 개설·전형 정보는 <b>학교알리미·해당 교육지원청</b>에서 확인하세요.</div>
      </section>`;
  }

  /* ---------------- 고교 지도 ---------------- */
  function mapPopup(p) {
    const o = locateSchool(p.name);
    const addr = addrFor(p.name, p.district, o);
    const enc = encodeURIComponent(p.district + " " + p.name);
    const dest = p.lat + "," + p.lon;
    return `<div style="min-width:190px">
      <b style="font-size:14px">${esc(p.name)}</b><br>
      <span style="color:#64748b;font-size:12px">${esc(p.type)} · ${esc(p.district)}</span>
      ${addr ? `<div style="margin-top:6px;font-size:12px">📍 ${esc(addr)}</div>` : ""}
      <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px">
        <a class="btn btn-sm" target="_blank" rel="noopener" href="https://map.naver.com/p/search/${enc}">네이버</a>
        <a class="btn btn-sm" target="_blank" rel="noopener" href="https://map.kakao.com/?q=${enc}">카카오</a>
        <a class="btn btn-sm" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=transit">길찾기</a>
      </div></div>`;
  }
  function viewMap() {
    const dists = ["전체"].concat((G.districts || []).map((d) => d.name));
    const types = ["전체", "일반고", "특성화고", "마이스터고", "과학고", "외국어고", "예술고", "체육고", "자율형 공립고", "자율형 사립고"];
    const dChips = dists.map((d) => `<button class="chip${d === state.mapDistrict ? " active" : ""}" data-mapdistrict="${esc(d)}">${esc(d)}</button>`).join("");
    const tChips = types.map((t) => `<button class="chip${t === state.mapType ? " active" : ""}" data-maptype="${esc(t)}">${esc(t)}</button>`).join("");
    const pts = schoolPoints().filter((p) => (state.mapDistrict === "전체" || p.district === state.mapDistrict) && (state.mapType === "전체" || p.type === state.mapType));
    return `
      <section class="page">
        <div class="section-title"><div class="st-icon g-sky">🗺️</div><div><h2>경북 고교 지도</h2><p>22개 시·군 고등학교 위치 · 마커 클릭 시 길찾기</p></div></div>
        <div class="chip-row mb-16">${dChips}</div>
        <div class="chip-row mb-16">${tChips}</div>
        <div class="result-line">표시 ${pts.length}개교 / 필터 ${filteredSchools().length}개교 (좌표 보유 ${schoolPoints().length}개교)</div>
        <div id="gbmap"></div>
        <div class="notice mt-16 no-print">지도는 OpenStreetMap 기반입니다. 좌표가 없는 일부 학교는 아래 목록의 <b>위치·길찾기</b>로 확인하세요.</div>
        <div class="section-title mt-24"><div class="st-icon g-indigo">📋</div><div><h2 style="font-size:18px">학교 목록</h2></div></div>
        <div id="gbmap-list" class="grid cols-3"></div>
        <div class="section-title mt-24"><div class="st-icon g-sky">🚉</div><div><h2 style="font-size:18px">시·군별 교통 안내</h2><p>기차·버스·항공 거점 · 통학·학교 방문 참고</p></div></div>
        <div class="grid cols-2">${(G.districts || []).map((d) => `<div class="card">${transitBlock(d.name, d.name)}</div>`).join("")}</div>
      </section>`;
  }
  function renderMapList() {
    const box = document.getElementById("gbmap-list");
    if (!box) return;
    const list = filteredSchools();
    box.innerHTML = list.length
      ? list.map((s) => schoolCardHTML(s.name, s.district, true)).join("")
      : `<div class="empty">조건에 맞는 학교가 없습니다.</div>`;
  }
  function initGbMap() {
    const el = document.getElementById("gbmap");
    if (!el) return;
    if (window.__gbmap) { try { window.__gbmap.remove(); } catch (e) {} window.__gbmap = null; }
    const pts = schoolPoints().filter((p) => (state.mapDistrict === "전체" || p.district === state.mapDistrict) && (state.mapType === "전체" || p.type === state.mapType));
    if (!window.L) {
      el.innerHTML = '<div class="empty" style="height:100%;display:grid;place-items:center">지도 라이브러리를 불러오지 못했습니다(오프라인 환경). 아래 학교 목록을 이용하세요.</div>';
      renderMapList();
      return;
    }
    const map = L.map("gbmap", { scrollWheelZoom: true, worldCopyJump: true }).setView([36.35, 128.75], 8);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap contributors" }).addTo(map);
    pts.forEach((p) => {
      const special = p.type !== "일반고";
      L.circleMarker([p.lat, p.lon], { radius: 6, color: "#fff", weight: 1.5, fillColor: special ? "#7c3aed" : "#4f46e5", fillOpacity: 0.9 })
        .addTo(map)
        .bindPopup(mapPopup(p));
    });
    if (pts.length) { try { map.fitBounds(pts.map((p) => [p.lat, p.lon]), { padding: [30, 30], maxZoom: 12 }); } catch (e) {} }
    window.__gbmap = map;
    setTimeout(() => { try { map.invalidateSize(); } catch (e) {} }, 80);
    renderMapList();
  }

  /* ---------------- 과목 선택 정보 ---------------- */
  function viewSubjects() {
    const groups = ["전체"].concat((G.subjectGroups || []).map((g) => g.group));
    const types = ["전체", "공통과목", "일반선택", "진로선택"];
    const groupChips = groups
      .map((g) => `<button class="chip${g === state.subjectGroup ? " active" : ""}" data-subgroup="${esc(g)}">${esc(g)}</button>`)
      .join("");
    const typeChips = types
      .map((t) => `<button class="chip${t === state.subjectType ? " active" : ""}" data-subtype="${esc(t)}">${esc(t)}</button>`)
      .join("");

    const q = state.subjectQ.trim().toLowerCase();
    let items = [];
    (G.subjectGroups || []).forEach((grp) => {
      if (state.subjectGroup !== "전체" && grp.group !== state.subjectGroup) return;
      grp.subjects.forEach((s) => {
        if (state.subjectType !== "전체" && s.type !== state.subjectType) return;
        if (q && !(s.name + s.desc).toLowerCase().includes(q)) return;
        items.push(Object.assign({ group: grp.group, color: grp.color }, s));
      });
    });
    const count = items.length;
    const list = count
      ? items
          .map(
            (s) => `<div class="li"><div class="row between"><h4>${esc(s.name)}</h4>
              <span class="row" style="gap:6px"><span class="badge ${esc(s.color)}">${esc(s.type)}</span><span class="badge b-slate">${esc(s.credits)}학점</span></span></div>
              <div class="li-sub mt-8">${esc(s.group)}</div>
              <p>${esc(s.desc)}</p></div>`
          )
          .join("")
      : `<div class="empty">조건에 맞는 과목이 없습니다.</div>`;

    return `
      <section class="page">
        <div class="section-title">
          <div class="st-icon g-indigo">📚</div>
          <div><h2>과목 선택 정보</h2><p>2022 개정 보통교과 백과 · 공통과목 / 일반선택 / 진로선택</p></div>
        </div>
        <div class="toolbar">
          <div class="search-wrap"><input type="search" id="subj-q" placeholder="과목명·설명 검색" value="${esc(state.subjectQ)}" /></div>
          <div class="chip-row">${typeChips}</div>
        </div>
        <div class="chip-row mb-16">${groupChips}</div>
        <div class="result-line">총 ${count}개 과목</div>
        <div class="stack">${list}</div>
      </section>`;
  }

  /* ---------------- 대학 학과 ---------------- */
  function viewMajors() {
    const fields = ["전체"].concat(G.deptFields || []);
    const chips = fields
      .map((f) => `<button class="chip${f === state.field ? " active" : ""}" data-field="${esc(f)}">${esc(f)}</button>`)
      .join("");
    const list = (G.depts || []).filter((d) => state.field === "전체" || d.field === state.field);
    const cards = list.length
      ? list
          .map(
            (d) => `<article class="card">
              <div class="row between"><h3 style="font-size:16px;font-weight:900">${esc(d.name)}</h3><span class="badge b-indigo">${esc(d.field)}</span></div>
              <p class="mt-8 muted">${esc(d.summary)}</p>
              <p class="mt-8" style="font-size:12.5px"><b>주요 교육과정</b></p>
              <div class="tag-row">${d.courses.map((c) => `<span class="tag">${esc(c)}</span>`).join("")}</div>
              <p class="mt-8" style="font-size:12.5px"><b>졸업 후 진로</b></p>
              <div class="tag-row">${d.jobs.map((j) => `<span class="tag" style="background:var(--emerald-50);color:var(--emerald-700)">${esc(j)}</span>`).join("")}</div>
              <p class="mt-8" style="font-size:12.5px"><b>관련 고교 과목</b> · ${d.subjects.map(esc).join(", ")}</p>
            </article>`
          )
          .join("")
      : `<div class="empty">해당 계열의 학과 정보가 없습니다.</div>`;
    return `
      <section class="page">
        <div class="section-title"><div class="st-icon g-blue">🎓</div><div><h2>대학 학과</h2><p>7개 계열별 전공 & 배우는 내용 · 졸업 후 진로</p></div></div>
        <div class="chip-row mb-16">${chips}</div>
        <div class="grid cols-3">${cards}</div>
      </section>`;
  }

  /* ---------------- 직업 백과 ---------------- */
  function viewJobs() {
    const cats = G.jobCategories || [];
    const chips = cats
      .map((c) => `<button class="chip${c.id === state.jobCat ? " active" : ""}" data-jobcat="${esc(c.id)}">${esc(c.name)}</button>`)
      .join("");
    const q = state.jobQ.trim().toLowerCase();
    let list = (G.jobs || []).filter((j) => {
      if (state.jobCat !== "all" && j.cat !== state.jobCat) return false;
      if (state.jobFutureOnly && !j.future) return false;
      if (q && !(j.name + j.desc + j.gb).toLowerCase().includes(q)) return false;
      return true;
    });
    const count = list.length;
    const cards = count
      ? list
          .map(
            (j) => `<article class="card hover" data-job="${esc(j.name)}" tabindex="0">
              <div class="row between"><h3 style="font-size:15.5px;font-weight:800">${esc(j.name)}</h3><span class="row" style="gap:6px">${favStar("job", j.name, true)}${j.future ? '<span class="badge b-emerald">미래유망</span>' : '<span class="badge b-slate">직업</span>'}</span></div>
              <div class="tc-sub mt-8">${esc(j.cat)} · ${esc(j.gb)}</div>
              <p class="tc-desc mt-8">${esc(j.desc)}</p>
              <div class="tc-foot">권장과목 보기 →</div>
            </article>`
          )
          .join("")
      : `<div class="empty">조건에 맞는 직업이 없습니다.</div>`;
    return `
      <section class="page">
        <div class="section-title"><div class="st-icon g-emerald">💼</div><div><h2>직업 백과</h2><p>경북 미래산업 유망 직업 & 직업 사전</p></div></div>
        <div class="toolbar">
          <div class="search-wrap"><input type="search" id="job-q" placeholder="직업명·분야 검색" value="${esc(state.jobQ)}" /></div>
          <label class="chip${state.jobFutureOnly ? " active" : ""}" data-jobfuture="1" style="user-select:none">✦ 미래유망만</label>
        </div>
        <div class="chip-row mb-16">${chips}</div>
        <div class="result-line">총 ${count}개 직업</div>
        <div class="grid cols-3">${cards}</div>
      </section>`;
  }

  /* ---------------- 진로검사·진로상담 ---------------- */
  function viewCounseling() {
    const tests = (G.tests || [])
      .map(
        (t) => `<article class="card">
          <div class="row between"><h4 style="font-weight:800">${esc(t.name)}</h4><span class="badge b-indigo">${esc(t.for)}</span></div>
          <p class="mt-8 muted">${esc(t.desc)}</p>
          <a class="btn btn-sm btn-primary mt-16" style="display:inline-block" href="${esc(t.url)}" target="_blank" rel="noopener">커리어넷에서 검사하기</a>
        </article>`
      )
      .join("");
    const centers = (G.counselingCenters || [])
      .map(
        (c) => `<div class="li"><div class="row between"><h4>${esc(c.name)}</h4><a class="btn btn-sm" href="${esc(c.url)}" target="_blank" rel="noopener">바로가기</a></div><p>${esc(c.desc)}</p></div>`
      )
      .join("");
    return `
      <section class="page">
        <div class="section-title"><div class="st-icon g-purple">🧪</div><div><h2>진로검사·진로상담</h2><p>커리어넷 7종 검사 & 경북 지역 1:1 맞춤 상담</p></div></div>
        <div class="notice info">검사는 <b>커리어넷(career.go.kr)</b>에서 무료로 이용할 수 있으며, 결과는 진로 가설을 세우는 출발점입니다.</div>
        <div class="grid cols-3 mt-16">${tests}</div>
        <div class="section-title mt-24"><div class="st-icon g-indigo">🤝</div><div><h2 style="font-size:18px">경북 지역 상담·지원 기관</h2></div></div>
        <div class="stack">${centers}</div>
      </section>`;
  }

  /* ---------------- 진로체험 ---------------- */
  function viewExperience() {
    const areas = ["전체"].concat(Array.from(new Set((G.experiences || []).map((e) => e.area))));
    const chips = areas
      .map((a) => `<button class="chip${a === state.expArea ? " active" : ""}" data-exparea="${esc(a)}">${esc(a)}</button>`)
      .join("");
    const list = (G.experiences || []).filter((e) => state.expArea === "전체" || e.area === state.expArea);
    const cards = list
      .map(
        (e) => `<article class="card">
          <div class="row between"><h4 style="font-weight:800;font-size:15.5px">${esc(e.name)}</h4><span class="badge b-teal">${esc(e.type)}</span></div>
          <div class="li-sub mt-8">${esc(e.area)}</div>
          <p class="mt-8 muted">${esc(e.desc)}</p>
          <div class="row mt-16">
            <a class="btn btn-sm" href="${esc(e.url || "https://map.naver.com/p/search/" + encodeURIComponent(e.name))}" target="_blank" rel="noopener">자세히 보기</a>
            ${/(시|군)$/.test(e.area) ? `<button class="btn btn-sm" data-schooldistrict="${esc(e.area)}" data-school="${esc(e.name)}">🗺️ 위치·길찾기</button>` : ""}
          </div>
        </article>`
      )
      .join("");
    return `
      <section class="page">
        <div class="section-title"><div class="st-icon g-teal">🚌</div><div><h2>진로체험</h2><p>교육부 꿈길 공식 진로체험망 & 경북 체험처</p></div></div>
        <div class="hero" style="background:linear-gradient(135deg,#0f766e,#0d9488 55%,#0f172a);padding:24px">
          <h2 style="font-size:19px;font-weight:900">꿈길에서 전국·경북 진로체험 프로그램을 검색하고 신청하세요</h2>
          <p style="color:#ccfbf1;margin-top:8px">교육부·한국직업능력연구원 운영 진로체험 지원망 · 학교 단위 신청 및 개인 체험처 검색</p>
          <a class="btn btn-amber mt-16" style="display:inline-block;text-decoration:none" href="https://www.ggoomgil.go.kr" target="_blank" rel="noopener">꿈길 진로체험망 바로가기 →</a>
        </div>
        <div class="chip-row mt-24 mb-16">${chips}</div>
        <div class="grid cols-3">${cards}</div>
        <div class="section-title mt-24"><div class="st-icon g-amber">🦺</div><div><h2 style="font-size:18px">안전한 진로체험 수칙</h2></div></div>
        <div class="grid cols-4">
          ${[
            { t: "사전 안전교육", d: "체험 전 안전교육과 유의사항을 반드시 숙지합니다." },
            { t: "보호자 동의", d: "교외 체험 시 보호자 동의와 담당 교사 확인을 거칩니다." },
            { t: "인솔·연락체계", d: "인솔 교사와 비상 연락 체계를 사전에 확인합니다." },
            { t: "체험 후 기록", d: "체험 내용을 진로 포트폴리오에 기록합니다." },
          ]
            .map((s) => `<article class="card"><h4 style="font-weight:800">${esc(s.t)}</h4><p class="mt-8 muted">${esc(s.d)}</p></article>`)
            .join("")}
        </div>
      </section>`;
  }

  /* ---------------- 진로 포트폴리오 ---------------- */
  const PF_KEY = "gb_portfolio_v1";
  function loadPF() {
    try {
      return JSON.parse(localStorage.getItem(PF_KEY) || "{}");
    } catch (e) {
      return {};
    }
  }
  function viewPortfolio() {
    const pf = loadPF();
    const v = (k) => esc(pf[k] || "");
    const ta = (k, label, ph) => `<div class="pf-field"><label>${esc(label)}</label><textarea data-pf="${k}" placeholder="${esc(ph)}">${v(k)}</textarea></div>`;
    const ip = (k, label, ph) => `<div class="pf-field"><label>${esc(label)}</label><input type="text" data-pf="${k}" placeholder="${esc(ph)}" value="${v(k)}" /></div>`;
    const rows = ["1학년", "2학년", "3학년"]
      .map(
        (g) => `<tr>
          <td>${g}</td>
          <td><input type="text" data-pf="plan_${g}_1" placeholder="1학기 이수 과목" value="${esc(pf["plan_" + g + "_1"] || "")}" style="width:100%" /></td>
          <td><input type="text" data-pf="plan_${g}_2" placeholder="2학기 이수 과목" value="${esc(pf["plan_" + g + "_2"] || "")}" style="width:100%" /></td>
          <td><input type="text" data-pf="plan_${g}_c" placeholder="누적 학점" value="${esc(pf["plan_" + g + "_c"] || "")}" style="width:100%" /></td>
        </tr>`
      )
      .join("");
    return `
      <section class="page">
        <div class="section-title"><div class="st-icon g-port">🗂️</div><div><h2>진로 포트폴리오</h2><p>진로활동 & 192학점 진로·학업설계 워크북</p></div></div>
        <div class="toolbar no-print">
          <span class="muted" style="font-size:13px;font-weight:700">작성 내용은 이 브라우저에 자동 저장됩니다.</span>
          <div class="header-spacer" style="flex:1"></div>
          <button class="btn btn-sm" data-pf-reset>초기화</button>
          <button class="btn btn-sm btn-primary" data-pf-print>인쇄 / PDF 저장</button>
        </div>
        <div class="card">
          <h3 style="font-weight:900">1. 인적사항 · 진로 가설</h3>
          <div class="grid cols-2 mt-16">
            ${ip("name", "이름", "홍길동")}
            ${ip("school", "학교 / 학년", "○○고등학교 2학년")}
            ${ip("region", "거주 시·군", "예) 안동시")}
            ${ip("hypo", "나의 진로 가설 (한 문장)", "예) 나는 사람을 돕는 바이오 연구자가 되고 싶다")}
          </div>
        </div>
        <div class="card mt-16">
          <h3 style="font-weight:900">2. 진로 질문 3가지</h3>
          <div class="stack mt-16">
            ${ta("q1", "질문 1", "왜 이 분야에 끌리는가?")}
            ${ta("q2", "질문 2", "무엇을 더 알고 싶은가?")}
            ${ta("q3", "질문 3", "어떻게 알아낼 것인가?")}
          </div>
        </div>
        <div class="card mt-16">
          <h3 style="font-weight:900">3. 진로활동 기록</h3>
          <div class="grid cols-2 mt-16">
            ${ta("act1", "대표 활동 (동아리·자율·봉사)", "무엇을, 왜 했는가")}
            ${ta("act2", "진로체험·탐구 활동", "배운 점과 느낀 점")}
            ${ta("act3", "독서·교과 심화", "진로와 연결된 배움")}
            ${ta("act4", "성과·수상·프로젝트", "결과와 성장")}
          </div>
        </div>
        <div class="card mt-16">
          <h3 style="font-weight:900">4. 192학점 진로·학업설계표</h3>
          <div class="table-wrap mt-16">
            <table><thead><tr><th>학년</th><th>1학기 이수 과목</th><th>2학기 이수 과목</th><th>누적 학점</th></tr></thead>
            <tbody>${rows}</tbody></table>
          </div>
        </div>
        <div class="card mt-16">
          <h3 style="font-weight:900">5. 성찰 & 다음 단계</h3>
          <div class="stack mt-16">
            ${ta("reflection", "학기 성찰", "무엇이 달라졌고, 다음에 무엇을 할 것인가")}
          </div>
        </div>
      </section>`;
  }

  /* ---------------- 2028 대입정보 ---------------- */
  function viewAdmission() {
    const a = G.admission2028 || { stats: [], sections: [], changes: [] };
    const stats = (a.stats || [])
      .map((s) => `<div class="stat"><b>${esc(s.v)}</b><span>${esc(s.l)}</span></div>`)
      .join("");
    const sections = (a.sections || [])
      .map(
        (s) => `<div class="card mt-16"><h3 style="font-weight:900;color:var(--pink-700)">${esc(s.title)}</h3>
          <ul class="mt-8" style="padding-left:18px;color:var(--slate-600);font-size:13.5px">${s.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul></div>`
      )
      .join("");
    const changes = (a.changes || [])
      .map((c) => `<tr><td><span class="badge b-rose">${esc(c.tag)}</span></td><td>${esc(c.text)}</td></tr>`)
      .join("");
    return `
      <section class="page">
        <div class="section-title"><div class="st-icon g-pink">📝</div><div><h2>2028 대입정보</h2><p>수능 안내 · 성취평가제 · 전형시행계획</p></div></div>
        <div class="stat-grid">${stats}</div>
        ${sections}
        <div class="section-title mt-24"><div class="st-icon g-pink">🔔</div><div><h2 style="font-size:18px">수시/정시 주요 변경 사항</h2></div></div>
        <div class="table-wrap"><table><thead><tr><th>구분</th><th>주요 내용</th></tr></thead><tbody>${changes}</tbody></table></div>
        <div class="notice mt-16">대학별 2028 전형시행계획은 <a href="https://www.adiga.kr" target="_blank" rel="noopener">대입정보포털(adiga.kr)</a>과 각 대학 입학처에서 반드시 확인하세요.</div>
      </section>`;
  }

  /* ---------------- 권장이수과목 ---------------- */
  function viewRecommend() {
    const unis = G.recommend || [];
    const chips = unis
      .map((u, i) => `<button class="chip${i === state.recommendUni ? " active" : ""}" data-uni="${i}">${esc(u.uni)}</button>`)
      .join("");
    const u = unis[state.recommendUni];
    let table = `<div class="empty">대학을 선택하세요.</div>`;
    if (u) {
      const rows = (u.depts || [])
        .map(
          (d) => `<tr><td><b>${esc(d.dept)}</b></td>
            <td>${d.required.length ? d.required.map((x) => `<span class="badge b-rose">${esc(x)}</span>`).join(" ") : '<span class="muted">-</span>'}</td>
            <td>${d.rec.map((x) => `<span class="badge b-indigo">${esc(x)}</span>`).join(" ")}</td></tr>`
        )
        .join("");
      table = `<div class="table-wrap"><table><thead><tr><th>전공/모집단위</th><th>필수 이수과목</th><th>권장 이수과목</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    }
    return `
      <section class="page">
        <div class="section-title"><div class="st-icon g-amber">✅</div><div><h2>권장이수과목</h2><p>2028 대입 주요 대학 전공별 필수·권장 과목</p></div></div>
        <div class="chip-row mb-16">${chips}</div>
        ${u ? `<div class="notice info mb-16"><b>${esc(u.uni)}</b> · ${esc(u.type)}</div>` : ""}
        ${table}
        <div class="notice mt-16">권장이수과목은 대학·전공·전형에 따라 달라질 수 있습니다. 각 대학 입학처의 최신 자료를 확인하세요.</div>
      </section>`;
  }

  /* ---------------- 고교학점제 ---------------- */
  function viewCredit() {
    const intro = (G.creditIntro || [])
      .map((s) => {
        if (s.faq) {
          const faq = (G.creditFaq || [])
            .map(
              (f, i) => `<div class="acc" data-acc><button class="acc-head"><span class="q"><span class="n">Q${i + 1}</span>${esc(f.q)}</span><span class="caret">▾</span></button><div class="acc-body">${esc(f.a)}</div></div>`
            )
            .join("");
          return `<div class="card mt-16"><h3 style="font-weight:900">${esc(s.n)}. ${esc(s.title)}</h3><div class="mt-16">${faq}</div></div>`;
        }
        return `<div class="card mt-16"><h3 style="font-weight:900"><span class="badge b-slate" style="margin-right:8px">${esc(s.n)}</span>${esc(s.title)}</h3><p class="mt-8 muted">${esc(s.body)}</p></div>`;
      })
      .join("");
    return `
      <section class="page">
        <div class="section-title"><div class="st-icon g-slate">🧩</div><div><h2>고교학점제</h2><p>제도 안내 · 192학점 · 성취평가제 · 경북 공동교육과정</p></div></div>
        <div class="stat-grid">
          <div class="stat"><b>192</b><span>졸업 최소 학점</span></div>
          <div class="stat"><b>174</b><span>교과 이수 학점</span></div>
          <div class="stat"><b>18</b><span>창의적 체험활동</span></div>
          <div class="stat"><b>5등급</b><span>성취평가(A~E)</span></div>
        </div>
        ${intro}
      </section>`;
  }

  /* ---------------- 관심 저장 ---------------- */
  function viewFavorites() {
    const f = favGet();
    const schools = (G.highSchools || []).filter((s) => f.schools.indexOf(s.name) >= 0);
    const jobs = (G.jobs || []).filter((j) => f.jobs.indexOf(j.name) >= 0);
    const schoolCards = schools.length
      ? schools.map((s) => schoolCardHTML(s.name, s.district, true)).join("")
      : `<div class="empty">저장한 학교가 없습니다. 고교 선택·고교 지도 탭에서 ☆ 버튼을 눌러 저장하세요.</div>`;
    const jobCards = jobs.length
      ? jobs
          .map(
            (j) => `<article class="card hover" data-job="${esc(j.name)}" tabindex="0">
              <div class="row between"><h3 style="font-size:15.5px;font-weight:800">${esc(j.name)}</h3>${favStar("job", j.name, true)}</div>
              <div class="tc-sub mt-8">${esc(j.cat)} · ${esc(j.gb)}</div>
              <p class="tc-desc mt-8">${esc(j.desc)}</p></article>`
          )
          .join("")
      : `<div class="empty">저장한 직업이 없습니다. 직업 백과 탭에서 ☆ 버튼을 눌러 저장하세요.</div>`;
    return `
      <section class="page">
        <div class="section-title"><div class="st-icon g-amber">⭐</div><div><h2>관심 저장</h2><p>저장한 학교·직업을 모아봅니다 · 이 브라우저에 저장됩니다</p></div></div>
        <div class="section-title" style="margin-top:2px"><div class="st-icon g-sky" style="width:36px;height:36px;font-size:16px">🏫</div><div><h2 style="font-size:17px">관심 학교 (${schools.length})</h2></div></div>
        <div class="grid cols-3">${schoolCards}</div>
        <div class="section-title mt-24"><div class="st-icon g-emerald" style="width:36px;height:36px;font-size:16px">💼</div><div><h2 style="font-size:17px">관심 직업 (${jobs.length})</h2></div></div>
        <div class="grid cols-3">${jobCards}</div>
      </section>`;
  }

  /* ---------------- School map modal ---------------- */
  function openSchoolMap(district, name) {
    const label = name ? name : district;
    const q = name ? district + " " + name : district;
    const enc = encodeURIComponent(q);
    const o = name ? locateSchool(name) : null;
    const hasCoord = !!(o && o.lat && o.lon);
    const addr = addrFor(name, district, o);
    const geo = hasCoord ? o.lat + "," + o.lon : addr ? encodeURIComponent(addr) : enc;
    const naver = "https://map.naver.com/p/search/" + enc;
    const kakao = "https://map.kakao.com/?q=" + enc;
    const gSearch = "https://www.google.com/maps/search/?api=1&query=" + geo;
    const gTransit = "https://www.google.com/maps/dir/?api=1&destination=" + geo + "&travelmode=transit";
    const gDrive = "https://www.google.com/maps/dir/?api=1&destination=" + geo + "&travelmode=driving";
    const gWalk = "https://www.google.com/maps/dir/?api=1&destination=" + geo + "&travelmode=walking";
    const embed = "https://maps.google.com/maps?q=" + geo + "&z=16&hl=ko&output=embed";
    const sub = name ? district + " · 고등학교" : district + " · 지역";
    const locInfo = addr || (o && o.lat)
      ? `<p class="mt-16" style="font-weight:800">위치 정보</p>
         <div class="li" style="box-shadow:none;cursor:default">
           ${addr ? `<div>📍 ${esc(addr)}</div>` : ""}
           ${o && o.lat ? `<div class="li-sub mt-8">🛰️ 좌표 ${esc(o.lat)}, ${esc(o.lon)}</div>` : ""}
         </div>`
      : `<p class="map-note mt-16">📍 이 학교의 좌표·주소 데이터가 없어 학교명으로 검색합니다. 정확한 위치는 지도 앱에서 확인하세요.</p>`;
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-head">
          <div><h3>🗺️ ${esc(label)}</h3><span class="tc-sub">${esc(sub)}</span></div>
          <button class="x-btn" data-close>✕</button>
        </div>
        <div class="modal-body">
          <iframe class="map-embed" title="${esc(label)} 지도" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="${embed}"></iframe>
          <p class="map-note mt-8">지도가 표시되지 않으면 아래 '지도 앱에서 열기'를 이용하세요.</p>
          ${locInfo}
          ${transitBlock(district, district)}

          <p class="mt-16" style="font-weight:800">지도 앱에서 열기</p>
          <div class="map-actions">
            <a class="btn btn-sm" href="${naver}" target="_blank" rel="noopener">네이버 지도</a>
            <a class="btn btn-sm" href="${kakao}" target="_blank" rel="noopener">카카오맵</a>
            <a class="btn btn-sm" href="${gSearch}" target="_blank" rel="noopener">구글 지도</a>
          </div>

          <p class="mt-16" style="font-weight:800">길찾기</p>
          <div class="map-actions">
            <a class="btn btn-sm btn-primary" href="${gTransit}" target="_blank" rel="noopener">🚌 대중교통</a>
            <a class="btn btn-sm" href="${gDrive}" target="_blank" rel="noopener">🚗 자동차</a>
            <a class="btn btn-sm" href="${gWalk}" target="_blank" rel="noopener">🚶 도보</a>
          </div>
          <p class="map-note mt-8">길찾기 버튼을 누르면 지도 앱이 열립니다. 출발지(집·학교·터미널 등)를 입력하면 최적 경로가 안내됩니다.</p>

          <p class="map-note mt-16">📍 주소·좌표 출처: OpenStreetMap · 위키백과 (도로명주소 체계와 다를 수 있으니 최종 확인은 지도 앱·학교알리미를 이용하세요.)</p>
          <div class="notice info mt-16">경북은 시·군 간 이동이 넓어 <b>시외·시내버스, 기차(KTX·무궁화)</b>를 함께 확인하는 것이 좋습니다. 학교 방문·상담은 사전 예약을 권장합니다.</div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay || e.target.closest("[data-close]")) close();
    });
    document.addEventListener("keydown", function onKey(e) {
      if (e.key === "Escape") {
        close();
        document.removeEventListener("keydown", onKey);
      }
    });
  }

  /* ---------------- Job modal ---------------- */
  function openJob(name) {
    const j = (G.jobs || []).find((x) => x.name === name);
    if (!j) return;
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-head">
          <div><h3>${esc(j.name)}</h3><span class="tc-sub">${esc(j.cat)} · ${esc(j.gb)}</span></div>
          <button class="x-btn" data-close>✕</button>
        </div>
        <div class="modal-body">
          <p>${esc(j.desc)}</p>
          <p class="mt-16" style="font-weight:800">고교 권장이수과목</p>
          <div class="tag-row">${j.subjects.map((s) => `<span class="tag" style="background:var(--indigo-50);color:var(--indigo-700)">${esc(s)}</span>`).join("")}</div>
          <p class="mt-16" style="font-weight:800">경북 연관 산업</p>
          <div class="tag-row"><span class="tag">${esc(j.gb)}</span></div>
          <p class="mt-16" style="font-weight:800">탐색 방법</p>
          <ul style="padding-left:18px;color:var(--slate-600)">
            <li>관련 학과(위 '대학 학과' 탭)에서 배우는 내용을 확인하세요.</li>
            <li>'권장이수과목' 탭에서 이 직업에 필요한 과목을 점검하세요.</li>
            <li>'진로체험' 탭에서 관련 산업체·기관 체험을 신청하세요.</li>
          </ul>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay || e.target.closest("[data-close]")) close();
    });
    document.addEventListener("keydown", function onKey(e) {
      if (e.key === "Escape") {
        close();
        document.removeEventListener("keydown", onKey);
      }
    });
  }

  /* ---------------- Router ---------------- */
  const VIEWS = {
    home: viewHome,
    design: viewDesign,
    highschool: viewHighschool,
    map: viewMap,
    subjects: viewSubjects,
    majors: viewMajors,
    jobs: viewJobs,
    counseling: viewCounseling,
    experience: viewExperience,
    portfolio: viewPortfolio,
    admission: viewAdmission,
    recommend: viewRecommend,
    credit: viewCredit,
    favorites: viewFavorites,
  };
  const ALIAS = { career_academic_design: "design", career_design: "design", exploration: "design", career_experience: "experience", admission_2028: "admission", recommendations: "recommend", counseling_test: "counseling", highschool_admission: "highschool" };

  function go(tab) {
    tab = ALIAS[tab] || tab;
    if (!VIEWS[tab]) tab = "home";
    state.tab = tab;
    location.hash = "#" + tab;
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function render() {
    $$("#tab-nav .tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === state.tab));
    const fn = VIEWS[state.tab] || viewHome;
    $("#main").innerHTML = fn();
    $("#main").focus({ preventScroll: true });
    if (state.tab === "map") initGbMap();
    // re-bind portfolio inputs
    bindPortfolioInputs();
  }

  function bindPortfolioInputs() {
    $$("[data-pf]").forEach((inp) => {
      inp.addEventListener("input", () => {
        const pf = loadPF();
        pf[inp.dataset.pf] = inp.value;
        try {
          localStorage.setItem(PF_KEY, JSON.stringify(pf));
        } catch (e) {}
      });
    });
  }

  /* ---------------- Event delegation ---------------- */
  document.addEventListener("click", (e) => {
    const t = e.target;
    const fav = t.closest("[data-fav]");
    if (fav) {
      e.stopPropagation();
      favToggle(fav.dataset.fav, fav.dataset.favname);
      render();
      return;
    }
    const goto = t.closest("[data-goto]");
    if (goto) {
      go(goto.dataset.goto);
      return;
    }
    const tabBtn = t.closest("[data-tab]");
    if (tabBtn) {
      go(tabBtn.dataset.tab);
      return;
    }
    const ch = t.closest("[data-chapter]");
    if (ch) {
      state.chapter = ch.dataset.chapter;
      render();
      return;
    }
    const dist = t.closest("[data-district]");
    if (dist) {
      state.district = dist.dataset.district;
      render();
      return;
    }
    const mdist = t.closest("[data-mapdistrict]");
    if (mdist) {
      state.mapDistrict = mdist.dataset.mapdistrict;
      render();
      return;
    }
    const mtype = t.closest("[data-maptype]");
    if (mtype) {
      state.mapType = mtype.dataset.maptype;
      render();
      return;
    }
    const ht = t.closest("[data-hstype]");
    if (ht) {
      state.hsType = ht.dataset.hstype;
      render();
      return;
    }
    const sg = t.closest("[data-subgroup]");
    if (sg) {
      state.subjectGroup = sg.dataset.subgroup;
      render();
      return;
    }
    const st = t.closest("[data-subtype]");
    if (st) {
      state.subjectType = st.dataset.subtype;
      render();
      return;
    }
    const fd = t.closest("[data-field]");
    if (fd) {
      state.field = fd.dataset.field;
      render();
      return;
    }
    const jc = t.closest("[data-jobcat]");
    if (jc) {
      state.jobCat = jc.dataset.jobcat;
      render();
      return;
    }
    const jf = t.closest("[data-jobfuture]");
    if (jf) {
      state.jobFutureOnly = !state.jobFutureOnly;
      render();
      return;
    }
    const ea = t.closest("[data-exparea]");
    if (ea) {
      state.expArea = ea.dataset.exparea;
      render();
      return;
    }
    const un = t.closest("[data-uni]");
    if (un) {
      state.recommendUni = Number(un.dataset.uni);
      render();
      return;
    }
    const job = t.closest("[data-job]");
    if (job) {
      openJob(job.dataset.job);
      return;
    }
    const sc = t.closest("[data-school]");
    if (sc) {
      openSchoolMap(sc.dataset.schooldistrict, sc.dataset.school);
      return;
    }
    const md = t.closest("[data-mapdist]");
    if (md) {
      openSchoolMap(md.dataset.mapdist, "");
      return;
    }
    const acc = t.closest(".acc-head");
    if (acc) {
      acc.parentElement.classList.toggle("open");
      return;
    }
    if (t.closest("[data-pf-print]")) {
      window.print();
      return;
    }
    if (t.closest("[data-pf-reset]")) {
      if (confirm("작성한 포트폴리오 내용을 모두 지울까요?")) {
        try {
          localStorage.removeItem(PF_KEY);
        } catch (e2) {}
        render();
      }
      return;
    }
  });

  document.addEventListener("input", (e) => {
    const t = e.target;
    if (t.id === "subj-q") {
      state.subjectQ = t.value;
      clearTimeout(window.__sq);
      window.__sq = setTimeout(() => {
        render();
        const inp = $("#subj-q");
        if (inp) {
          inp.focus();
          inp.setSelectionRange(inp.value.length, inp.value.length);
        }
      }, 220);
    } else if (t.id === "hs-q") {
      state.hsQ = t.value;
      clearTimeout(window.__hq);
      window.__hq = setTimeout(() => {
        render();
        const inp = $("#hs-q");
        if (inp) {
          inp.focus();
          inp.setSelectionRange(inp.value.length, inp.value.length);
        }
      }, 220);
    } else if (t.id === "job-q") {
      state.jobQ = t.value;
      clearTimeout(window.__jq);
      window.__jq = setTimeout(() => {
        render();
        const inp = $("#job-q");
        if (inp) {
          inp.focus();
          inp.setSelectionRange(inp.value.length, inp.value.length);
        }
      }, 220);
    }
  });

  document.addEventListener("keydown", (e) => {
    const el = e.target.closest("[data-goto], [data-job], [data-school]");
    if (el && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      if (el.dataset.goto) go(el.dataset.goto);
      else if (el.dataset.school) openSchoolMap(el.dataset.schooldistrict, el.dataset.school);
      else openJob(el.dataset.job);
    }
  });

  window.addEventListener("hashchange", () => {
    const h = location.hash.replace("#", "");
    if (h && VIEWS[ALIAS[h] || h] && (ALIAS[h] || h) !== state.tab) {
      state.tab = ALIAS[h] || h;
      render();
    }
  });

  /* ---------------- Init ---------------- */
  function init() {
    const h = location.hash.replace("#", "");
    if (h && (VIEWS[ALIAS[h] || h])) state.tab = ALIAS[h] || h;
    renderChrome();
    render();
  }
  document.addEventListener("DOMContentLoaded", init);
  if (document.readyState !== "loading") init();
})();
