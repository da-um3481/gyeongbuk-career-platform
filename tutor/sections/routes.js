// 라우트 레지스트리 — 핵심 8개 1단 + 나머지는 '더 보기'로 접기.
// kind: 'home' | 'student_search' | 'student_hub' | 'prep' | 'orgs_list' | 'org_detail'
//     | 'daily' | 'tests_reports' | 'rx_paths' | 'settings' | 'table' | 'intro'
window.CORE_NAV = [
  { id: 'home',     label: '홈',               icon: '🏠' },
  { id: 'students', label: '학생 찾기',         icon: '👥' },
  { id: 'orgs',     label: '기관 현황',         icon: '🏫' },
  { id: 'prep',     label: '상담 준비',         icon: '📋' },
  { id: 'daily',    label: '오늘 처리',         icon: '📅' },
  { id: 'tests',    label: '검사·리포트',       icon: '🧭' },
  { id: 'rx',       label: '처방·경로',         icon: '💊' },
  { id: 'settings', label: '설정·입력',         icon: '⚙️' },
];

// '더 보기' 아래 접히는 상세 화면 — 기존 전용 화면으로의 바로가기 모음
window.MORE_NAV = [
  { id: 'schedule',    label: '수업 캘린더(전체)' },
  { id: 'homework',    label: '숙제(전체)' },
  { id: 'overview',    label: '학생 전체 목록' },
  { id: 'progress',    label: '진도·성취(전체)' },
  { id: 'attendance',  label: '출결·AI 세션' },
  { id: 'contents',    label: '학습 콘텐츠' },
  { id: 'books',       label: '교재' },
  { id: 'qbank',       label: '문제은행' },
  { id: 'prescription',label: '학습 처방(이력)' },
  { id: 'paths',       label: '학습 경로(전체)' },
  { id: 'diagnosis',   label: '취약 단원 진단(전체)' },
  { id: 'gpa',         label: '내신 등급 계산기' },
  { id: 'roadmap',     label: '대입 로드맵(전체)' },
  { id: 'rx_res',      label: '학습 처방 자료실' },
  { id: 'counsel',     label: '상담 기록(전체)' },
  { id: 'parent',      label: '학부모 리포트(전체)' },
  { id: 'onboarding',  label: '기관 온보딩 가이드' },
  { id: 'guide',       label: '프로그램 소개' },
];

// 각 '더 보기' 라우트의 쿼리/컬럼 매핑 (조회 전용 테이블 뷰)
window.TABLE_ROUTES = {
  schedule:    { q:'wa_schedule',     label:'수업 캘린더', hint:'최근 30일 ~ 7일 뒤 수업', cols:[
    {k:'class_date',h:'일자',fmt:'date'},{k:'start_time',h:'시간'},{k:'student_name',h:'학생',link:'stu'},
    {k:'subject_name',h:'과목'},{k:'topic',h:'주제'},{k:'status',h:'상태',fmt:'pill'}]},
  homework:    { q:'wa_homework',     label:'숙제',       hint:'최근 숙제 배부·제출', cols:[
    {k:'due_date',h:'마감',fmt:'date'},{k:'student_name',h:'학생',link:'stu'},{k:'subject_name',h:'과목'},
    {k:'title',h:'제목'},{k:'status',h:'상태',fmt:'pill'},{k:'score',h:'점수',fmt:'num'}]},
  overview:    { q:'wa_students',     label:'학생 전체 목록', hint:'학생 이름을 클릭하면 요약 페이지로', cols:[
    {k:'name',h:'이름',link:'stu'},{k:'student_code',h:'학번'},{k:'grade',h:'학년'},
    {k:'school_name',h:'학교'},{k:'org_name',h:'소속 기관'},{k:'learning_style',h:'학습 스타일'}]},
  progress:    { q:'wa_progress',     label:'진도·성취',  hint:'단원별 진도율·성취', cols:[
    {k:'student_name',h:'학생',link:'stu'},{k:'subject_name',h:'과목'},{k:'unit_name',h:'단원'},
    {k:'progress_pct',h:'진도 %',fmt:'num'},{k:'achievement',h:'성취',fmt:'num'},{k:'last_updated',h:'최근',fmt:'date'}]},
  attendance:  { q:'wa_tutor',        label:'출결·AI 세션', hint:'AI 튜터 세션', cols:[
    {k:'session_date',h:'일자',fmt:'date'},{k:'student_name',h:'학생',link:'stu'},{k:'subject_name',h:'과목'},
    {k:'session_type',h:'유형'},{k:'duration_min',h:'분',fmt:'num'},{k:'engagement',h:'참여도'}]},
  contents:    { q:'wa_contents',     label:'학습 콘텐츠', hint:'영상·문제·설명', cols:[
    {k:'title',h:'제목'},{k:'subject_name',h:'과목'},{k:'content_type',h:'유형'},
    {k:'difficulty',h:'난이도'},{k:'duration_min',h:'시간(분)',fmt:'num'}]},
  books:       { q:'wa_books',        label:'교재',       hint:'출판사·대상 학년', cols:[
    {k:'title',h:'교재'},{k:'publisher',h:'출판사'},{k:'subject_name',h:'과목'},
    {k:'target_grade',h:'대상'},{k:'difficulty',h:'난이도'}]},
  qbank:       { q:'wa_qbank',        label:'문제은행',   hint:'과목·단원·난이도', cols:[
    {k:'subject_name',h:'과목'},{k:'unit_name',h:'단원'},{k:'question_type',h:'유형'},
    {k:'difficulty',h:'난이도'},{k:'usage_count',h:'사용',fmt:'num'}]},
  prescription:{ q:'wa_prescription', label:'학습 처방 이력', hint:'상담 세션에서 발부된 처방', cols:[
    {k:'student_name',h:'학생',link:'stu'},{k:'subject_name',h:'과목'},
    {k:'issued_date',h:'발부일',fmt:'date'},{k:'focus_area',h:'중점'},{k:'status',h:'상태',fmt:'pill'}]},
  paths:       { q:'wa_paths',        label:'학습 경로(전체)', hint:'경로별 단계 수', cols:[
    {k:'student_name',h:'학생',link:'stu'},{k:'subject_name',h:'과목'},{k:'path_name',h:'경로'},
    {k:'step_count',h:'단계',fmt:'num'},{k:'status',h:'상태',fmt:'pill'}]},
  diagnosis:   { q:'wa_weak',         label:'취약 단원(전체)', hint:'진도<70 또는 성취<70', cols:[
    {k:'student_name',h:'학생',link:'stu'},{k:'subject_name',h:'과목'},{k:'unit_name',h:'단원'},
    {k:'progress_pct',h:'진도 %',fmt:'num'},{k:'achievement',h:'성취',fmt:'num'}]},
  gpa:         { q:'wa_grades',       label:'내신 등급',  hint:'학기별 성적·등급', cols:[
    {k:'student_name',h:'학생',link:'stu'},{k:'school_year',h:'학년도'},{k:'semester',h:'학기'},
    {k:'subject_name',h:'과목'},{k:'grade_level',h:'등급',fmt:'num'}]},
  roadmap:     { q:'wa_roadmap',      label:'대입 로드맵(전체)', hint:'학생×목표×단계', cols:[
    {k:'student_name',h:'학생',link:'stu'},{k:'target_name',h:'목표'},{k:'step_order',h:'#',fmt:'num'},
    {k:'step_name',h:'단계'},{k:'due_period',h:'시기'},{k:'status',h:'상태',fmt:'pill'}]},
  rx_res:      { q:'wa_rx_res',       label:'학습 처방 자료실', hint:'교재·영상·문제', cols:[
    {k:'title',h:'자료'},{k:'subject_name',h:'과목'},{k:'resource_type',h:'유형'},{k:'target_level',h:'대상'}]},
  counsel:     { q:'wa_counsel',      label:'상담 기록(전체)', hint:'진학/학습 상담 세션', cols:[
    {k:'session_date',h:'일자',fmt:'date'},{k:'student_name',h:'학생',link:'stu'},
    {k:'session_type',h:'유형'},{k:'counselor_name',h:'상담사'},{k:'summary',h:'요약'}]},
  parent:      { q:'wa_reports',      label:'학부모 리포트(전체)', hint:'발행·발송 상태', cols:[
    {k:'report_period',h:'기간'},{k:'student_name',h:'학생',link:'stu'},
    {k:'created_at',h:'작성일',fmt:'date'},{k:'sent_at',h:'발송일',fmt:'date'},{k:'status',h:'상태',fmt:'pill'}]},
  onboarding:  { q:'wa_onboard',      label:'기관 온보딩', hint:'기관별 8단계 진행률', cols:[
    {k:'name',h:'기관'},{k:'org_type',h:'유형'},{k:'student_count',h:'학생',fmt:'num'},
    {k:'done_steps',h:'완료 단계',fmt:'num'},{k:'progress_pct',h:'진행률 %',fmt:'num'}]},
  guide:       { kind:'intro' },
};
