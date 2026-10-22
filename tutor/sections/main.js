// 다움 통합 웹앱 — 메인 셸, 라우팅, 전역 검색, 학생 요약, 인라인 편집, 모바일 햄버거.
(function () {
  const CORE = window.CORE_NAV, MORE = window.MORE_NAV, T = window.TABLE_ROUTES;
  const db = window.agentdb;

  // ---------- 유틸 ----------
  function esc(v){const d=document.createElement('div');d.textContent=v==null?'':String(v);return d.innerHTML;}
  function fmtDate(v){if(!v)return'';return String(v).slice(0,10);}
  function fmtNum(v){if(v==null||v==='')return'';const n=Number(v);if(!isFinite(n))return esc(v);return n.toLocaleString('ko-KR');}
  function pillClass(v){const s=String(v||'');
    if(/완료|발송|운영중|정상|진행|확정|제출|출석/i.test(s))return'pill pill-ok';
    if(/대기|예정|미발송|초안|준비|보류|지각|배부/i.test(s))return'pill pill-warn';
    if(/실패|지연|미제출|경고|취소|중단|종료|결석/i.test(s))return'pill pill-danger';
    return'pill';}
  function updateTs(){const el=document.getElementById('ts');if(!el)return;
    el.textContent='기준 '+new Date().toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});}
  function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1800);}

  // ---------- 사이드바 ----------
  function renderNav(){
    const nav = document.getElementById('nav');
    nav.replaceChildren();
    const lab = document.createElement('div');lab.className='nav-section-label';lab.textContent='핵심 메뉴';nav.append(lab);
    CORE.forEach(r=>{
      const a=document.createElement('a');a.className='nav-item';a.href='#'+r.id;a.dataset.id=r.id;
      a.innerHTML='<span class="ic">'+esc(r.icon)+'</span><span>'+esc(r.label)+'</span>';
      nav.append(a);
    });
    const more = document.createElement('div');more.className='nav-more';more.id='moreToggle';
    more.innerHTML='<span class="caret">▸</span> 더 보기 ('+MORE.length+')';
    nav.append(more);
    const moreList = document.createElement('div');moreList.id='moreList';moreList.style.display='none';
    MORE.forEach(r=>{
      const a=document.createElement('a');a.className='nav-item';a.href='#'+r.id;a.dataset.id=r.id;
      a.innerHTML='<span class="ic">·</span><span style="font-size:12px">'+esc(r.label)+'</span>';
      moreList.append(a);
    });
    nav.append(moreList);
    more.onclick = ()=>{const open = moreList.style.display!=='none';moreList.style.display=open?'none':'block';more.classList.toggle('open',!open);};
    // 모바일 메뉴 선택 시 닫기
    nav.addEventListener('click',(e)=>{if(e.target.closest('.nav-item')){document.getElementById('side').classList.remove('open');document.getElementById('mobile-mask').classList.remove('show');}});
  }
  function setActive(id){
    document.querySelectorAll('.nav-item').forEach(el=>el.classList.toggle('active',el.dataset.id===id));
  }

  // ---------- 라우팅 ----------
  function parseHash(){
    const h = (location.hash||'#home').replace(/^#/,'');
    const [id, arg] = h.split('/');
    return {id, arg};
  }
  function go(path){if('#'+path!==location.hash)location.hash=path;else render();}
  async function render(){
    const {id, arg} = parseHash();
    const root = document.getElementById('route');
    const navId = (id==='stu'||id==='org') ? (id==='stu'?'students':'orgs') : id;
    setActive(navId);
    root.innerHTML = '<div class="skl" style="width:40%; margin-bottom:10px"></div><div class="skl" style="width:85%; margin-bottom:6px"></div><div class="skl" style="width:70%"></div>';
    try{
      if(id==='home')         return await renderHome(root);
      if(id==='students')     return await renderStudentsPick(root);
      if(id==='stu')          return await renderStudentHub(root, parseInt(arg,10));
      if(id==='orgs')         return await renderOrgsList(root);
      if(id==='org')          return await renderOrgDetail(root, parseInt(arg,10));
      if(id==='prep')         return await renderPrep(root, parseInt(arg,10));
      if(id==='daily')        return await renderDaily(root);
      if(id==='tests')        return await renderTestsReports(root);
      if(id==='rx')           return await renderRxPaths(root);
      if(id==='settings')     return renderSettings(root);
      if(id==='guide')        return renderGuide(root);
      if(window.EXTRA_ROUTES && window.EXTRA_ROUTES[id]) return await window.EXTRA_ROUTES[id](root, arg);
      if(T[id])               return await renderTable(root, id);
      root.innerHTML = '<div class="err-note">알 수 없는 화면: '+esc(id)+'</div>';
    }catch(e){
      console.error(e);
      root.innerHTML = '<div class="err-note">오류: '+esc(e.message||e)+'</div>';
    }
    updateTs();
  }

  // ---------- 홈 ----------
  async function renderHome(root){
    root.innerHTML =
      '<div class="hero"><div class="micro">홈</div><h1>전체 운영 현황</h1><p>학생·기관·일정·관리 필요·리포트 요약.</p></div>'+
      '<div class="kpis" id="kpis"></div>'+
      '<div class="panels two"><div class="panel" id="pa"></div><div class="panel" id="pb"></div></div>'+
      '<div class="panels two" style="margin-top:14px"><div class="panel" id="pc"></div><div class="panel" id="pd"></div></div>';

    async function stage(fn){try{await fn();}catch(e){console.error(e);}await new Promise(r=>setTimeout(r,0));}

    await stage(async()=>{
      const r = await db.executeQuery('wa_summary',{});
      const s = (r.rows&&r.rows[0])||{};
      document.getElementById('kpis').innerHTML = [
        ['관리 중 학생',s.students],['등록 기관',s.orgs],['이번 달 수업',s.classes_month],
        ['진단 검사',s.tests],['상담 기록',s.counsel],['미발송 리포트',s.unsent]
      ].map(x=>'<div class="kpi"><div class="k">'+esc(x[0])+'</div><div class="v">'+esc(fmtNum(x[1]))+'</div></div>').join('');
    });

    await stage(async()=>{
      const r = await db.executeQuery('wa_home_recent_classes',{});
      document.getElementById('pa').innerHTML =
        '<div class="ph"><div class="pt">최근·다가오는 수업</div><div class="pa">일자 가까운 순 10건</div></div>'+
        tableHtml(r.rows,[{k:'class_date',h:'일자',fmt:'date'},{k:'start_time',h:'시간'},{k:'student_name',h:'학생',link:'stu'},
          {k:'subject_name',h:'과목'},{k:'status',h:'상태',fmt:'pill'}]);
    });

    await stage(async()=>{
      const r = await db.executeQuery('wa_home_attention',{});
      document.getElementById('pb').innerHTML =
        '<div class="ph"><div class="pt">관리 필요</div><div class="pa">진도<70%</div></div>'+
        tableHtml(r.rows,[{k:'student_name',h:'학생',link:'stu'},{k:'subject_name',h:'과목'},
          {k:'unit_name',h:'단원'},{k:'progress_pct',h:'진도 %',fmt:'num'}]);
    });

    await stage(async()=>{
      const r = await db.executeQuery('wa_home_drafts',{});
      document.getElementById('pc').innerHTML =
        '<div class="ph"><div class="pt">미발송 리포트</div><div class="pa">학부모 리포트</div></div>'+
        tableHtml(r.rows,[{k:'report_period',h:'기간'},{k:'student_name',h:'학생',link:'stu'},
          {k:'created_at',h:'작성일',fmt:'date'},{k:'status',h:'상태',fmt:'pill'}]);
    });

    await stage(async()=>{
      const r = await db.executeQuery('wa_home_orgs',{});
      document.getElementById('pd').innerHTML =
        '<div class="ph"><div class="pt">기관 현황</div><div class="pa">학생 수</div></div>'+
        tableHtml(r.rows,[{k:'name',h:'기관'},{k:'org_type',h:'유형'},
          {k:'student_count',h:'학생',fmt:'num'},{k:'status',h:'상태',fmt:'pill'}]);
    });
  }

  // ---------- 학생 찾기 ----------
  async function renderStudentsPick(root){
    root.innerHTML =
      '<div class="hero"><div class="micro">학생</div><h1>학생 찾기</h1><p>상단 검색창 또는 아래 목록에서 학생을 선택하면 요약 페이지가 열립니다.</p></div>'+
      '<div class="panel" id="pSt"></div>';
    const r = await db.executeQuery('wa_students_pick',{});
    document.getElementById('pSt').innerHTML =
      '<div class="ph"><div class="pt">전체 학생</div><div class="pa">'+r.rows.length+'명</div></div>'+
      tableHtml(r.rows,[{k:'name',h:'이름',link:'stu'},{k:'grade',h:'학년'},
        {k:'school',h:'학교'},{k:'org_name',h:'소속 기관'}]);
  }

  // ---------- 학생 요약 페이지 (#stu/<id>) ----------
  async function renderStudentHub(root, sid){
    if(!sid){root.innerHTML='<div class="err-note">학생 번호가 없습니다.</div>';return;}
    root.innerHTML =
      '<div id="stuHead"></div>'+
      '<div class="grid2" style="margin-bottom:14px"><div class="panel" id="sB"></div><div class="panel" id="sR"></div></div>'+
      '<div class="grid2" style="margin-bottom:14px"><div class="panel" id="sP"></div><div class="panel" id="sT"></div></div>'+
      '<div class="grid2" style="margin-bottom:14px"><div class="panel" id="sG"></div><div class="panel" id="sRm"></div></div>'+
      '<div class="grid2"><div class="panel" id="sC"></div><div class="panel" id="sRep"></div></div>';

    async function stage(fn){try{await fn();}catch(e){console.error(e);}}

    await stage(async()=>{
      const r = await db.executeQuery('wa_stu_basic',{sid});
      const s = (r.rows&&r.rows[0])||null;
      if(!s){document.getElementById('stuHead').innerHTML='<div class="err-note">학생을 찾을 수 없습니다.</div>';return;}
      document.getElementById('stuHead').innerHTML =
        '<div class="stu-head"><div class="av">'+esc((s.name||'?').charAt(0))+'</div>'+
        '<div><div class="nm">'+esc(s.name)+'</div><div class="sub">'+
        [s.student_code,s.grade,s.school,s.org_name].filter(Boolean).map(esc).join(' · ')+'</div></div>'+
        '<div class="right-btns">'+
        '<button class="btn" id="btnCounsel">+ 상담 기록</button>'+
        '<button class="btn primary" id="btnPrep">상담 준비 열기</button>'+
        '</div></div>';
      document.getElementById('btnCounsel').onclick=()=>openCounselModal(sid, s.name);
      document.getElementById('btnPrep').onclick=()=>go('prep/'+sid);

      document.getElementById('sB').innerHTML =
        '<div class="ph"><div class="pt">기본정보</div></div>'+
        '<div class="kv">'+
        kvRow('학교', s.school)+kvRow('학년', s.grade)+
        kvRow('소속 기관', (s.org_name||'')+(s.org_type?' ('+s.org_type+')':''))+
        kvRow('학부모', [s.parent_name,s.parent_phone,s.parent_email].filter(Boolean).join(' · '))+
        kvRow('학습 스타일', s.learning_style)+kvRow('목표', s.learning_goal)+
        kvRow('상태', s.status)+kvRow('등록일', fmtDate(s.enrolled_date))+
        '</div>';
    });

    await stage(async()=>{
      const r = await db.executeQuery('wa_stu_recent',{sid});
      document.getElementById('sR').innerHTML =
        '<div class="ph"><div class="pt">최근 수업·숙제</div><div class="pa">최신 20건</div></div>'+
        tableHtml(r.rows,[{k:'kind',h:'',fmt:'pill'},{k:'d',h:'일자',fmt:'date'},
          {k:'subject',h:'과목'},{k:'title',h:'내용'},{k:'status',h:'상태',fmt:'pill'}]);
    });

    await stage(async()=>{
      const r = await db.executeQuery('wa_stu_progress',{sid});
      document.getElementById('sP').innerHTML =
        '<div class="ph"><div class="pt">진도·성취</div><div class="pa">단원별</div></div>'+
        tableHtml(r.rows,[{k:'subject_name',h:'과목'},{k:'unit_name',h:'단원'},
          {k:'progress_pct',h:'진도 %',fmt:'num'},{k:'achievement',h:'성취',fmt:'num'}]);
    });

    await stage(async()=>{
      const r = await db.executeQuery('wa_stu_tests',{sid});
      document.getElementById('sT').innerHTML =
        '<div class="ph"><div class="pt">검사 결과</div><div class="pa">MLST·MCDT·NEO</div></div>'+
        tableHtml(r.rows,[{k:'test_date',h:'일자',fmt:'date'},{k:'test_type',h:'검사'},
          {k:'overall_label',h:'결과'},{k:'summary',h:'요약'}]);
    });

    await stage(async()=>{
      const r = await db.executeQuery('wa_stu_grades',{sid});
      document.getElementById('sG').innerHTML =
        '<div class="ph"><div class="pt">내신 성적·등급</div></div>'+
        tableHtml(r.rows,[{k:'school_year',h:'학년도'},{k:'semester',h:'학기'},
          {k:'subject_name',h:'과목'},{k:'achievement',h:'성취'},{k:'grade',h:'등급',fmt:'num'}]);
    });

    await stage(async()=>{
      const [tr, sr] = await Promise.all([
        db.executeQuery('wa_stu_roadmap',{sid}),
        db.executeQuery('wa_stu_roadmap_steps',{sid}),
      ]);
      const panel = document.getElementById('sRm');
      panel.innerHTML =
        '<div class="ph"><div class="pt">진학 목표·로드맵</div>'+
        '<div><button class="mini-btn" id="btnAddTarget">+ 희망 대학</button></div></div>'+
        tableHtml(tr.rows,[{k:'university',h:'대학'},{k:'department',h:'학과'},
          {k:'admission_type',h:'전형'},{k:'target_year',h:'연도',fmt:'num'},
          {k:'done_steps',h:'완료',fmt:'num'},{k:'step_count',h:'전체',fmt:'num'}])+
        renderRoadmapSteps(sr.rows||[]);
      panel.querySelector('#btnAddTarget').onclick=()=>openTargetModal(sid);
      panel.querySelectorAll('input[data-step]').forEach(cb=>cb.onchange=async()=>{
        const stepId = parseInt(cb.dataset.step,10);
        const newStatus = cb.checked ? '완료' : '예정';
        try{ await db.executeQuery('wa_m_step_toggle',{sid:stepId, status:newStatus}); toast(newStatus+' 처리됨'); render(); }
        catch(err){ toast('실패: '+(err.message||err)); cb.checked=!cb.checked; }
      });
    });

    await stage(async()=>{
      const r = await db.executeQuery('wa_stu_counsel',{sid});
      document.getElementById('sC').innerHTML =
        '<div class="ph"><div class="pt">상담 기록·처방</div></div>'+
        tableHtml(r.rows,[{k:'session_date',h:'일자',fmt:'date'},{k:'topic',h:'주제'},
          {k:'content_preview',h:'내용'},{k:'next_date',h:'다음',fmt:'date'}]);
    });

    await stage(async()=>{
      const r = await db.executeQuery('wa_stu_reports',{sid});
      const rows = (r.rows||[]).map(x=>{
        const isDraft = !x.sent_date;
        const parts = [];
        if(isDraft) parts.push('<button class="mini-btn" data-edit="'+x.id+'">수정</button>');
        if(isDraft) parts.push('<button class="mini-btn" data-send="'+x.id+'">발송</button>');
        return {...x, action: parts.join(' ')};
      });
      const panel = document.getElementById('sRep');
      panel.innerHTML =
        '<div class="ph"><div class="pt">학부모 리포트</div>'+
        '<div><button class="mini-btn" id="btnAddReport">+ 리포트 작성</button></div></div>'+
        tableHtml(rows,[{k:'report_period_start',h:'시작',fmt:'date'},{k:'report_period_end',h:'종료',fmt:'date'},
          {k:'status',h:'상태',fmt:'pill'},{k:'sent_date',h:'발송',fmt:'date'},{k:'action',h:'',raw:true}]);
      panel.querySelector('#btnAddReport').onclick=()=>openReportModal(sid, null);
      panel.querySelectorAll('button[data-edit]').forEach(b=>b.onclick=(e)=>{e.stopPropagation();openReportModal(sid, parseInt(b.dataset.edit,10));});
      panel.querySelectorAll('button[data-send]').forEach(b=>b.onclick=async(e)=>{
        e.stopPropagation();
        const rid = parseInt(b.dataset.send,10);
        try{ await db.executeQuery('wa_m_report_send',{rid}); toast('리포트 발송 처리됨'); render(); }
        catch(err){ toast('실패: '+(err.message||err)); }
      });
    });
  }

  function kvRow(k,v){return '<div class="k">'+esc(k)+'</div><div class="v">'+esc(v==null||v===''?'-':v)+'</div>';}

  // ---------- 기관 현황 (목록 + 상세) ----------
  async function renderOrgsList(root){
    root.innerHTML =
      '<div class="hero"><div class="micro">기관</div><h1>기관 현황</h1><p>학교·지자체 센터·개인 — 기관을 선택하면 상세 현황이 열립니다.</p></div>'+
      '<div class="panel" id="pO"></div>';
    const r = await db.executeQuery('wa_orgs_pick',{});
    const rows = r.rows.map(x=>({...x, _link_org: x.id}));
    document.getElementById('pO').innerHTML =
      '<div class="ph"><div class="pt">전체 기관</div><div class="pa">'+r.rows.length+'곳</div></div>'+
      tableHtml(rows,[{k:'name',h:'기관',link:'org'},{k:'org_type',h:'유형',fmt:'pill'},
        {k:'region',h:'지역'},{k:'student_count',h:'학생',fmt:'num'},{k:'status',h:'상태',fmt:'pill'}], 'org');
  }

  async function renderOrgDetail(root, oid){
    if(!oid){root.innerHTML='<div class="err-note">기관 번호가 없습니다.</div>';return;}
    root.innerHTML =
      '<div id="orgHead"></div>'+
      '<div class="kpis" id="orgKpis"></div>'+
      '<div class="panels two"><div class="panel" id="orgInfo"></div><div class="panel" id="orgStu"></div></div>';

    const [d, st] = await Promise.all([
      db.executeQuery('wa_org_detail',{oid}),
      db.executeQuery('wa_org_students',{oid}),
    ]);
    const o = (d.rows&&d.rows[0])||null;
    if(!o){root.innerHTML='<div class="err-note">기관을 찾을 수 없습니다.</div>';return;}

    document.getElementById('orgHead').innerHTML =
      '<div class="stu-head"><div class="av" style="background:var(--ink-700)">'+esc((o.name||'?').charAt(0))+'</div>'+
      '<div><div class="nm">'+esc(o.name)+'</div><div class="sub">'+
      [o.org_type,o.region,o.program_name,o.cohort].filter(Boolean).map(esc).join(' · ')+'</div></div>'+
      '<div class="right-btns"><button class="btn" onclick="location.hash=\'#orgs\'">← 목록</button></div></div>';

    document.getElementById('orgKpis').innerHTML = [
      ['학생',o.student_count],['이번 달 수업',o.classes_month],
      ['30일 상담',o.counsel_30d],['미발송 리포트',o.unsent_reports],
    ].map(x=>'<div class="kpi"><div class="k">'+esc(x[0])+'</div><div class="v">'+esc(fmtNum(x[1]))+'</div></div>').join('');

    document.getElementById('orgInfo').innerHTML =
      '<div class="ph"><div class="pt">기관 정보</div></div>'+
      '<div class="kv">'+
      kvRow('유형',o.org_type)+kvRow('지역',o.region)+kvRow('주소',o.address)+
      kvRow('담당',[o.contact_name,o.contact_phone,o.contact_email].filter(Boolean).join(' · '))+
      kvRow('프로그램',o.program_name)+kvRow('기수',o.cohort)+
      kvRow('기간',[fmtDate(o.start_date),fmtDate(o.end_date)].filter(Boolean).join(' ~ '))+
      kvRow('정원',o.student_quota)+kvRow('상태',o.status)+kvRow('비고',o.note)+
      '</div>';

    document.getElementById('orgStu').innerHTML =
      '<div class="ph"><div class="pt">소속 학생</div><div class="pa">'+(st.rows||[]).length+'명</div></div>'+
      tableHtml(st.rows,[{k:'name',h:'이름',link:'stu'},{k:'grade',h:'학년'},
        {k:'avg_progress',h:'평균 진도',fmt:'num'},{k:'test_count',h:'검사',fmt:'num'},
        {k:'counsel_count',h:'상담',fmt:'num'},{k:'unsent',h:'미발송',fmt:'num'}]);
  }

  // ---------- 상담 준비 (#prep 또는 #prep/<sid>) ----------
  async function renderPrep(root, sid){
    if(!sid){
      // 학생 선택 화면
      const r = await db.executeQuery('wa_students_pick',{});
      root.innerHTML =
        '<div class="hero"><div class="micro">상담 준비</div><h1>상담 전 1분 요약</h1><p>학생을 선택하면 내신·로드맵·최근 상담·검사가 한 화면에 요약됩니다.</p></div>'+
        '<div class="panel"><div class="ph"><div class="pt">학생 선택</div></div>'+
        tableHtml(r.rows.map(x=>({...x, _link_prep:x.id})),[{k:'name',h:'이름',link:'prep'},
          {k:'grade',h:'학년'},{k:'school',h:'학교'},{k:'org_name',h:'소속 기관'}])+'</div>';
      return;
    }
    // 선택된 학생의 요약
    root.innerHTML =
      '<div id="pH"></div>'+
      '<div class="grid3"><div class="panel" id="pA"></div><div class="panel" id="pB"></div><div class="panel" id="pC"></div></div>'+
      '<div style="margin-top:14px" class="panel" id="pD"></div>';
    const [b,g,rm,co] = await Promise.all([
      db.executeQuery('wa_stu_basic',{sid}),
      db.executeQuery('wa_stu_grades',{sid}),
      db.executeQuery('wa_stu_roadmap',{sid}),
      db.executeQuery('wa_stu_counsel',{sid}),
    ]);
    const s = (b.rows&&b.rows[0])||null;
    if(!s){root.innerHTML='<div class="err-note">학생을 찾을 수 없습니다.</div>';return;}
    document.getElementById('pH').innerHTML =
      '<div class="stu-head"><div class="av">'+esc(s.name.charAt(0))+'</div>'+
      '<div><div class="nm">'+esc(s.name)+' <span style="font-size:12px;color:var(--ink-500);font-weight:400">· 상담 준비</span></div>'+
      '<div class="sub">'+[s.student_code,s.grade,s.school,s.org_name].filter(Boolean).map(esc).join(' · ')+'</div></div>'+
      '<div class="right-btns"><button class="btn" onclick="location.hash=\'#stu/'+sid+'\'">학생 전체 보기</button>'+
      '<button class="btn primary" id="pBtnC">+ 상담 기록 추가</button></div></div>';
    document.getElementById('pBtnC').onclick=()=>openCounselModal(sid, s.name);

    document.getElementById('pA').innerHTML =
      '<div class="ph"><div class="pt">내신</div><div class="pa">최근 학기 등급</div></div>'+
      tableHtml((g.rows||[]).slice(0,10),[{k:'school_year',h:'학년도'},{k:'semester',h:'학기'},
        {k:'subject_name',h:'과목'},{k:'grade',h:'등급',fmt:'num'}]);

    document.getElementById('pB').innerHTML =
      '<div class="ph"><div class="pt">진학 목표·로드맵</div></div>'+
      tableHtml(rm.rows,[{k:'university',h:'대학'},{k:'department',h:'학과'},
        {k:'done_steps',h:'완료',fmt:'num'},{k:'step_count',h:'전체',fmt:'num'}]);

    document.getElementById('pC').innerHTML =
      '<div class="ph"><div class="pt">최근 상담 요약</div></div>'+
      tableHtml((co.rows||[]).slice(0,5),[{k:'session_date',h:'일자',fmt:'date'},
        {k:'topic',h:'주제'},{k:'content_preview',h:'내용'}]);

    document.getElementById('pD').innerHTML =
      '<div class="ph"><div class="pt">기본정보 · 학부모 연락</div></div>'+
      '<div class="kv">'+
      kvRow('학부모', [s.parent_name,s.parent_phone,s.parent_email].filter(Boolean).join(' · '))+
      kvRow('목표',s.learning_goal)+kvRow('학습 스타일',s.learning_style)+
      '</div>';
  }

  // ---------- 오늘 처리 (수업+숙제) ----------
  async function renderDaily(root){
    root.innerHTML =
      '<div class="hero"><div class="micro">오늘 처리</div><h1>수업 출결 · 숙제 점수</h1><p>표에서 ✎ 를 누르면 바로 수정됩니다.</p></div>'+
      '<div class="panels two"><div class="panel" id="dC"></div><div class="panel" id="dH"></div></div>';

    const [cs, hw] = await Promise.all([
      db.executeQuery('wa_schedule',{}),
      db.executeQuery('wa_homework',{}),
    ]);
    const cRows = (cs.rows||[]).slice(0,30).map(x=>({...x, _edit:'<button class="mini-btn" data-att="'+x.id+'" data-s="'+esc(x.student_name||'')+'">✎ 출결</button>'}));
    document.getElementById('dC').innerHTML =
      '<div class="ph"><div class="pt">수업</div><div class="pa">최근 30일</div></div>'+
      tableHtml(cRows,[{k:'class_date',h:'일자',fmt:'date'},{k:'student_name',h:'학생',link:'stu'},
        {k:'subject_name',h:'과목'},{k:'status',h:'상태',fmt:'pill'},{k:'_edit',h:'',raw:true}]);
    document.getElementById('dC').querySelectorAll('button[data-att]').forEach(b=>b.onclick=(e)=>{e.stopPropagation();openAttModal(parseInt(b.dataset.att,10),b.dataset.s);});

    const hRows = (hw.rows||[]).slice(0,30).map(x=>({...x, _edit:'<button class="mini-btn" data-hw="'+x.id+'" data-s="'+esc(x.student_name||'')+'" data-t="'+esc(x.title||'')+'">✎ 점수</button>'}));
    document.getElementById('dH').innerHTML =
      '<div class="ph"><div class="pt">숙제</div><div class="pa">마감 가까운 순</div></div>'+
      tableHtml(hRows,[{k:'due_date',h:'마감',fmt:'date'},{k:'student_name',h:'학생',link:'stu'},
        {k:'title',h:'제목'},{k:'status',h:'상태',fmt:'pill'},{k:'score',h:'점수',fmt:'num'},{k:'_edit',h:'',raw:true}]);
    document.getElementById('dH').querySelectorAll('button[data-hw]').forEach(b=>b.onclick=(e)=>{e.stopPropagation();openHwModal(parseInt(b.dataset.hw,10),b.dataset.s,b.dataset.t);});
  }

  // ---------- 검사·리포트 ----------
  async function renderTestsReports(root){
    root.innerHTML =
      '<div class="hero"><div class="micro">검사·리포트</div><h1>검사 세션과 학부모 리포트</h1><p>MLST·MCDT·NEO 결과와 리포트 발행 현황.</p></div>'+
      '<div class="panels two"><div class="panel" id="tT"></div><div class="panel" id="tR"></div></div>';
    const [t,r] = await Promise.all([
      db.executeQuery('wa_tests',{}),
      db.executeQuery('wa_reports',{}),
    ]);
    document.getElementById('tT').innerHTML =
      '<div class="ph"><div class="pt">검사 세션</div></div>'+
      tableHtml(t.rows,[{k:'test_date',h:'일자',fmt:'date'},{k:'student_name',h:'학생',link:'stu'},
        {k:'test_type',h:'검사'},{k:'result_summary',h:'요약'}]);
    const rRows = (r.rows||[]).map(x=>{
      const isDraft = !x.sent_at;
      const parts = [];
      if(isDraft) parts.push('<button class="mini-btn" data-edit="'+x.id+'">수정</button>');
      if(isDraft) parts.push('<button class="mini-btn" data-send="'+x.id+'">발송</button>');
      return {...x, _snd: parts.join(' ')};
    });
    document.getElementById('tR').innerHTML =
      '<div class="ph"><div class="pt">학부모 리포트</div></div>'+
      tableHtml(rRows,[{k:'report_period',h:'기간'},{k:'student_name',h:'학생',link:'stu'},
        {k:'status',h:'상태',fmt:'pill'},{k:'sent_at',h:'발송',fmt:'date'},{k:'_snd',h:'',raw:true}]);
    document.getElementById('tR').querySelectorAll('button[data-edit]').forEach(b=>b.onclick=async(e)=>{
      e.stopPropagation();
      const rid = parseInt(b.dataset.edit,10);
      const one = await db.executeQuery('wa_report_one',{rid});
      const sidRow = one.rows && one.rows[0];
      openReportModal(sidRow ? sidRow.student_id : null, rid);
    });
    document.getElementById('tR').querySelectorAll('button[data-send]').forEach(b=>b.onclick=async(e)=>{
      e.stopPropagation();
      try{ await db.executeQuery('wa_m_report_send',{rid:parseInt(b.dataset.send,10)}); toast('발송 처리됨'); render(); }
      catch(err){ toast('실패: '+(err.message||err)); }
    });
  }

  // ---------- 처방·경로 ----------
  async function renderRxPaths(root){
    root.innerHTML =
      '<div class="hero"><div class="micro">처방·경로</div><h1>학습 처방 · 학습 경로</h1><p>학생별 처방 이력과 경로 진행 상황.</p></div>'+
      '<div class="panels two"><div class="panel" id="rP"></div><div class="panel" id="rPa"></div></div>'+
      '<div style="margin-top:14px" class="panel" id="rW"></div>';
    const [p,pa,w] = await Promise.all([
      db.executeQuery('wa_prescription',{}),
      db.executeQuery('wa_paths',{}),
      db.executeQuery('wa_weak',{}),
    ]);
    document.getElementById('rP').innerHTML =
      '<div class="ph"><div class="pt">학습 처방 이력</div></div>'+
      tableHtml(p.rows,[{k:'student_name',h:'학생',link:'stu'},{k:'issued_date',h:'발부',fmt:'date'},
        {k:'focus_area',h:'중점'},{k:'status',h:'상태',fmt:'pill'}]);
    document.getElementById('rPa').innerHTML =
      '<div class="ph"><div class="pt">학습 경로</div></div>'+
      tableHtml(pa.rows,[{k:'student_name',h:'학생',link:'stu'},{k:'subject_name',h:'과목'},
        {k:'path_name',h:'경로'},{k:'step_count',h:'단계',fmt:'num'},{k:'status',h:'상태',fmt:'pill'}]);
    document.getElementById('rW').innerHTML =
      '<div class="ph"><div class="pt">취약 단원</div><div class="pa">진도<70 또는 성취<70</div></div>'+
      tableHtml(w.rows,[{k:'student_name',h:'학생',link:'stu'},{k:'subject_name',h:'과목'},
        {k:'unit_name',h:'단원'},{k:'progress_pct',h:'진도 %',fmt:'num'},{k:'achievement',h:'성취',fmt:'num'}]);
  }

  // ---------- 설정·입력 ----------
  function renderSettings(root){
    root.innerHTML =
      '<div class="hero"><div class="micro">설정·입력</div><h1>데이터 등록과 전용 화면</h1><p>원본 데이터의 대량 입력·시험지 생성·CSV 등록은 각 전용 화면을 사용합니다.</p></div>'+
      '<div class="panel"><div class="ph"><div class="pt">전용 화면 바로가기</div></div>'+
      '<div class="core">'+[
        ['기관·대상 관리','orgs','기관 등록·학생 소속'],
        ['기관 온보딩','onboarding','8단계 체크리스트'],
        ['학습 콘텐츠','contents','콘텐츠 등록'],
        ['교재','books','출판사·대상 학년'],
        ['문제은행','qbank','문항 등록'],
        ['학습 처방 자료실','rx_res','자료 등록'],
        ['내신 등급 계산기','gpa','점수 입력'],
        ['학부모 리포트(전체)','parent','발행·발송'],
      ].map(c=>'<a class="ccard" href="#'+c[1]+'"><div class="ck">열기</div><div class="ct">'+esc(c[0])+'</div><div class="cd">'+esc(c[2])+'</div></a>').join('')+'</div></div>';
  }

  // ---------- 가이드 ----------
  function renderGuide(root){
    const steps=[['01','진단','MLST·MCDT·NEO 로 학습 성향과 상태 파악.'],
      ['02','성적·목표','내신 등급 계산 + 희망 진학 로드맵.'],
      ['03','처방','취약 단원 → 학습 경로·자료 발부.'],
      ['04','상담·리포트','상담 기록과 학부모 리포트.']];
    root.innerHTML =
      '<div class="hero"><div class="micro">프로그램 소개</div><h1>다움진로진학컨설팅 · 진학 및 학습 맞춤엔진</h1></div>'+
      '<div class="steps">'+steps.map(s=>'<div class="step"><div class="no">'+esc(s[0])+'</div><div class="ti">'+esc(s[1])+'</div><div class="de">'+esc(s[2])+'</div></div>').join('')+'</div>';
  }

  // ---------- 범용 테이블 뷰 (더 보기) ----------
  async function renderTable(root, id){
    const def = T[id];
    root.innerHTML = '<div class="hero"><div class="micro">'+esc(id)+'</div><h1>'+esc(def.label)+'</h1><p>'+esc(def.hint||'')+'</p></div><div class="panel" id="tb"></div>';
    const r = await db.executeQuery(def.q,{});
    document.getElementById('tb').innerHTML =
      '<div class="ph"><div class="pt">'+esc(def.label)+'</div><div class="pa">'+r.rows.length+'건</div></div>'+
      tableHtml(r.rows, def.cols);
  }

  // ---------- 표 유틸 ----------
  function tableHtml(rows, cols, forceLink){
    if(!rows||!rows.length) return '<div class="empty">표시할 자료가 없습니다.</div>';
    const head = '<tr>'+cols.map(c=>'<th class="'+(c.fmt==='num'?'num':'')+'">'+esc(c.h)+'</th>').join('')+'</tr>';
    const body = rows.slice(0,100).map(row=>{
      const linkTo = row._link_prep ? ('prep/'+row._link_prep) :
                     row._link_org  ? ('org/'+row._link_org) :
                     row.id         ? (forceLink==='org' ? 'org/'+row.id : 'stu/'+row.id) : '';
      const trAttr = linkTo ? ' class="row-link" data-link="'+esc(linkTo)+'"' : '';
      return '<tr'+trAttr+'>'+cols.map(c=>{
        let v = row[c.k];
        if(c.raw) return '<td>'+(v||'')+'</td>';
        if(c.fmt==='date') v = fmtDate(v);
        else if(c.fmt==='num') v = fmtNum(v);
        else if(c.fmt==='pill' && v!=null && v!=='') return '<td data-label="'+esc(c.h)+'"><span class="'+pillClass(v)+'">'+esc(v)+'</span></td>';
        if(c.link==='stu' && row.id) return '<td data-label="'+esc(c.h)+'"><a href="#stu/'+row.id+'" style="color:var(--brand-500);text-decoration:none;font-weight:600" onclick="event.stopPropagation()">'+esc(v)+'</a></td>';
        if(c.link==='prep' && row.id) return '<td data-label="'+esc(c.h)+'"><a href="#prep/'+row.id+'" style="color:var(--brand-500);text-decoration:none;font-weight:600" onclick="event.stopPropagation()">'+esc(v)+'</a></td>';
        if(c.link==='org' && row.id) return '<td data-label="'+esc(c.h)+'"><a href="#org/'+row.id+'" style="color:var(--brand-500);text-decoration:none;font-weight:600" onclick="event.stopPropagation()">'+esc(v)+'</a></td>';
        return '<td data-label="'+esc(c.h)+'" class="'+(c.fmt==='num'?'num':'')+'">'+esc(v==null?'':v)+'</td>';
      }).join('')+'</tr>';
    }).join('');
    const more = rows.length>100 ? '<div class="pa" style="margin-top:8px">상위 100건만 표시</div>' : '';
    const html = '<table class="tbl m-cards"><thead>'+head+'</thead><tbody>'+body+'</tbody></table>'+more;
    // 행 클릭 바인딩은 호출부 밖에서 — 간단히 inline onclick 생략, 대신 아래 전역 바인딩 사용
    return html;
  }

  // ---------- 전역 행 클릭 (row-link data-link) ----------
  document.addEventListener('click',(e)=>{
    const tr = e.target.closest('tr.row-link');
    if(tr && !e.target.closest('a,button')){
      const lk = tr.dataset.link;
      if(lk) location.hash = '#'+lk;
    }
  });

  // ---------- 전역 검색 ----------
  let srTimer=null;
  function initSearch(){
    const inp = document.getElementById('srInput');
    const drop = document.getElementById('srDrop');
    const clr = document.getElementById('srClear');
    inp.addEventListener('input',()=>{
      clr.style.display = inp.value ? 'inline' : 'none';
      clearTimeout(srTimer);
      const kw = inp.value.trim();
      if(!kw){drop.style.display='none';return;}
      srTimer = setTimeout(()=>runSearch(kw), 220);
    });
    clr.onclick=()=>{inp.value='';clr.style.display='none';drop.style.display='none';inp.focus();};
    document.addEventListener('click',(e)=>{if(!e.target.closest('.search')) drop.style.display='none';});
    inp.addEventListener('focus',()=>{if(drop.innerHTML) drop.style.display='block';});
  }
  async function runSearch(kw){
    const drop = document.getElementById('srDrop');
    drop.innerHTML = '<div class="sr-empty">검색 중…</div>';drop.style.display='block';
    try{
      const r = await db.executeQuery('wa_search',{kw});
      const rows = r.rows||[];
      if(!rows.length){drop.innerHTML='<div class="sr-empty">검색 결과 없음</div>';return;}
      const groups = {student:[],org:[],test:[],counsel:[]};
      rows.forEach(x=>{(groups[x.kind]||(groups[x.kind]=[])).push(x);});
      const labels = {student:'학생', org:'기관', test:'검사', counsel:'상담'};
      let html = '';
      ['student','org','test','counsel'].forEach(k=>{
        if(!groups[k]||!groups[k].length) return;
        html += '<div class="sr-section">'+labels[k]+'</div>';
        groups[k].forEach(x=>{
          const hash = k==='student' ? 'stu/'+x.ref_id : k==='org' ? 'org/'+x.ref_id : k==='test' ? 'tests' : 'counsel';
          html += '<div class="sr-item" data-h="'+esc(hash)+'">'+
            '<div><div class="sr-t">'+esc(x.title)+'</div><div class="sr-sub">'+esc(x.subtitle||'')+'</div></div>'+
            '<div style="color:var(--ink-400);font-size:11px;align-self:center">'+esc(fmtDate(x.as_of))+'</div></div>';
        });
      });
      drop.innerHTML = html;
      drop.querySelectorAll('.sr-item').forEach(el=>el.onclick=()=>{location.hash='#'+el.dataset.h;drop.style.display='none';document.getElementById('srInput').value='';document.getElementById('srClear').style.display='none';});
    }catch(e){drop.innerHTML='<div class="sr-empty">오류: '+esc(e.message||e)+'</div>';}
  }

  // ---------- 모달 ----------
  function openModal(html){const m=document.getElementById('modal');m.innerHTML='<div class="modal">'+html+'</div>';m.classList.add('show');
    m.onclick=(e)=>{if(e.target===m) closeModal();};}
  function closeModal(){const m=document.getElementById('modal');m.classList.remove('show');m.innerHTML='';}
  window._closeModal = closeModal;

  function openHwModal(hid, sName, title){
    openModal(
      '<h3>숙제 점수 — '+esc(sName)+'</h3>'+
      '<div style="font-size:12px;color:var(--ink-500);margin-bottom:8px">'+esc(title)+'</div>'+
      '<label>상태</label><select id="mSt"><option>제출</option><option>미제출</option><option>배부</option><option>지연</option></select>'+
      '<label>점수 (0-100, 선택)</label><input type="number" id="mSc" min="0" max="100" step="1" />'+
      '<div class="foot"><button class="btn" onclick="_closeModal()">취소</button><button class="btn primary" id="mSave">저장</button></div>'
    );
    document.getElementById('mSave').onclick=async()=>{
      const st = document.getElementById('mSt').value;
      const scRaw = document.getElementById('mSc').value;
      const sc = scRaw==='' ? null : parseFloat(scRaw);
      try{ await db.executeQuery('wa_m_hw_score',{hid, score:sc, status:st}); closeModal(); toast('저장됨'); render(); }
      catch(e){ toast('실패: '+(e.message||e)); }
    };
  }
  function openAttModal(cid, sName){
    openModal(
      '<h3>수업 출결 — '+esc(sName)+'</h3>'+
      '<label>출결</label><select id="mA"><option>출석</option><option>지각</option><option>조퇴</option><option>결석</option></select>'+
      '<div class="foot"><button class="btn" onclick="_closeModal()">취소</button><button class="btn primary" id="mSave">저장</button></div>'
    );
    document.getElementById('mSave').onclick=async()=>{
      const att = document.getElementById('mA').value;
      try{ await db.executeQuery('wa_m_cls_att',{cid, attendance:att}); closeModal(); toast('저장됨'); render(); }
      catch(e){ toast('실패: '+(e.message||e)); }
    };
  }
  function openCounselModal(sid, sName){
    const today = new Date().toISOString().slice(0,10);
    openModal(
      '<h3>상담 기록 — '+esc(sName)+'</h3>'+
      '<label>일자</label><input type="date" id="mD" value="'+today+'" />'+
      '<label>상담사</label><input type="text" id="mCn" placeholder="예: 다움컨설턴트" />'+
      '<label>주제</label><select id="mT"><option>진학</option><option>학습</option><option>진로</option><option>생활</option></select>'+
      '<label>상담 내용</label><textarea id="mCo" placeholder="상담 요지"></textarea>'+
      '<label>처방 (선택)</label><textarea id="mPr" placeholder="학습 처방"></textarea>'+
      '<label>다음 상담 예정일 (선택)</label><input type="date" id="mN" />'+
      '<div class="foot"><button class="btn" onclick="_closeModal()">취소</button><button class="btn primary" id="mSave">저장</button></div>'
    );
    document.getElementById('mSave').onclick=async()=>{
      const d=document.getElementById('mD').value;
      const counselor=document.getElementById('mCn').value||'다움컨설턴트';
      const topic=document.getElementById('mT').value;
      const content=document.getElementById('mCo').value;
      const presc=document.getElementById('mPr').value;
      const nd=document.getElementById('mN').value;
      if(!content.trim()){toast('상담 내용을 입력하세요');return;}
      try{
        await db.executeQuery('wa_m_counsel_add',{sid, d, counselor, topic, content, prescription:presc||null, next_date:nd||null});
        closeModal(); toast('상담 기록 추가됨'); render();
      }catch(e){ toast('실패: '+(e.message||e)); }
    };
  }

  // 로드맵 단계 체크리스트(목표별로 그룹)
  function renderRoadmapSteps(steps){
    if(!steps.length) return '<div class="empty" style="padding:14px">등록된 로드맵 단계가 없습니다.</div>';
    const grouped = {};
    steps.forEach(s=>{
      const key = s.target_id || 'none';
      if(!grouped[key]) grouped[key] = {uni: s.university||'(목표 없음)', dept: s.department||'', items: []};
      grouped[key].items.push(s);
    });
    const blocks = Object.keys(grouped).map(k=>{
      const g = grouped[k];
      const title = esc(g.uni) + (g.dept?' · '+esc(g.dept):'');
      const items = g.items.map(s=>{
        const done = s.status==='완료';
        const when = s.school_year ? (s.school_year+'학년 '+s.semester+'학기') : (s.target_date?fmtDate(s.target_date):'');
        return '<label style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--ink-50);font-size:12.5px;cursor:pointer">'+
          '<input type="checkbox" data-step="'+s.id+'" '+(done?'checked':'')+' />'+
          '<span style="flex:1;color:'+(done?'var(--ink-400)':'var(--ink-800)')+';text-decoration:'+(done?'line-through':'none')+'">'+
          (s.category?'<span class="pill pill-brand" style="margin-right:6px">'+esc(s.category)+'</span>':'')+
          esc(s.title)+'</span>'+
          '<span style="color:var(--ink-500);font-size:11px">'+esc(when)+'</span></label>';
      }).join('');
      return '<div style="margin-top:10px"><div style="font-size:11px;font-weight:700;color:var(--brand-500);margin-bottom:4px">'+title+'</div>'+items+'</div>';
    }).join('');
    return '<div style="margin-top:10px;border-top:1px solid var(--ink-100);padding-top:10px">'+
      '<div class="pa" style="margin-bottom:4px">단계 체크</div>'+blocks+'</div>';
  }

  // 희망 대학 추가 모달
  function openTargetModal(sid){
    openModal(
      '<h3>희망 대학 추가</h3>'+
      '<label>대학 *</label><input type="text" id="tU" placeholder="예: 서울대학교" />'+
      '<label>학과</label><input type="text" id="tD" placeholder="예: 컴퓨터공학과" />'+
      '<label>전형</label><select id="tA"><option value="">선택</option><option>학생부종합</option><option>학생부교과</option><option>논술</option><option>정시</option><option>특기자</option><option>기타</option></select>'+
      '<label>목표 연도</label><input type="number" id="tY" placeholder="예: 2028" min="2026" max="2035" />'+
      '<label>필요 등급 (평균)</label><input type="number" id="tG" placeholder="예: 2.5" step="0.1" min="1" max="9" />'+
      '<label>우선순위 (1-5, 작을수록 높음)</label><input type="number" id="tP" value="3" min="1" max="5" />'+
      '<label>메모</label><textarea id="tN" placeholder="메모"></textarea>'+
      '<div class="foot"><button class="btn" onclick="_closeModal()">취소</button><button class="btn primary" id="mSave">추가</button></div>'
    );
    document.getElementById('mSave').onclick=async()=>{
      const uni=document.getElementById('tU').value.trim();
      if(!uni){toast('대학명을 입력하세요');return;}
      try{
        await db.executeQuery('wa_m_target_add',{
          sid, university:uni,
          department:document.getElementById('tD').value,
          admission_type:document.getElementById('tA').value,
          target_year:document.getElementById('tY').value,
          required_grade:document.getElementById('tG').value,
          priority:document.getElementById('tP').value,
          note:document.getElementById('tN').value,
        });
        closeModal(); toast('목표 추가됨'); render();
      }catch(e){ toast('실패: '+(e.message||e)); }
    };
  }

  // 리포트 작성/수정 모달 (rid=null 이면 신규)
  async function openReportModal(sid, rid){
    let r = null;
    if(rid){
      try{ const q = await db.executeQuery('wa_report_one',{rid}); r = q.rows && q.rows[0]; sid = sid || (r && r.student_id); }
      catch(e){ toast('불러오기 실패: '+(e.message||e)); return; }
    }
    if(!sid){toast('학생을 알 수 없습니다');return;}
    const today = new Date();
    const monStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0,10);
    const monEnd = new Date(today.getFullYear(), today.getMonth()+1, 0).toISOString().slice(0,10);
    const v = (k, def)=> esc(r && r[k]!=null ? r[k] : (def==null?'':def));
    openModal(
      '<h3>'+(rid?'리포트 수정':'리포트 작성')+(r?' — '+esc(r.student_name||''):'')+'</h3>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'+
        '<div><label>기간 시작</label><input type="date" id="rS" value="'+(r?fmtDate(r.report_period_start):monStart)+'" /></div>'+
        '<div><label>기간 종료</label><input type="date" id="rE" value="'+(r?fmtDate(r.report_period_end):monEnd)+'" /></div>'+
      '</div>'+
      '<label>유형</label><select id="rT">'+
        ['월간','주간','학기','특별'].map(x=>'<option '+(r&&r.report_type===x?'selected':'')+'>'+x+'</option>').join('')+
      '</select>'+
      '<label>전반적 진전</label><textarea id="rOv" placeholder="학습 전반의 진척">'+v('overall_progress')+'</textarea>'+
      '<label>강점</label><textarea id="rSt" placeholder="학생의 강점">'+v('strengths')+'</textarea>'+
      '<label>개선 영역</label><textarea id="rIm" placeholder="보완할 점">'+v('areas_for_improvement')+'</textarea>'+
      '<label>컨설턴트 코멘트</label><textarea id="rCm">'+v('teacher_comments')+'</textarea>'+
      '<label>다음 기간 목표</label><textarea id="rGl">'+v('next_period_goals')+'</textarea>'+
      '<div class="foot"><button class="btn" onclick="_closeModal()">취소</button><button class="btn primary" id="mSave">저장</button></div>'
    );
    document.getElementById('mSave').onclick=async()=>{
      const payload = {
        start:document.getElementById('rS').value,
        end:document.getElementById('rE').value,
        rtype:document.getElementById('rT').value,
        overall:document.getElementById('rOv').value,
        strengths:document.getElementById('rSt').value,
        improve:document.getElementById('rIm').value,
        comments:document.getElementById('rCm').value,
        goals:document.getElementById('rGl').value,
      };
      try{
        if(rid) await db.executeQuery('wa_m_report_update',{rid, ...payload});
        else    await db.executeQuery('wa_m_report_add',{sid, ...payload});
        closeModal(); toast(rid?'리포트 수정됨':'리포트 작성됨'); render();
      }catch(e){ toast('실패: '+(e.message||e)); }
    };
  }

  // ---------- 모바일 햄버거 ----------
  function initHamb(){
    const hamb = document.getElementById('hamb');
    const side = document.getElementById('side');
    const mask = document.getElementById('mobile-mask');
    hamb.onclick=()=>{side.classList.add('open');mask.classList.add('show');};
    mask.onclick=()=>{side.classList.remove('open');mask.classList.remove('show');};
  }

  // ---------- 부팅 ----------
  function boot(){
    renderNav(); initSearch(); initHamb();
    window.addEventListener('hashchange',()=>{render();updateTs();});
    document.getElementById('refresh').onclick=()=>{render();updateTs();};
    render();
    console.log('[init] done');
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();
