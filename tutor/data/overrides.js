/* SQLite 호환 SQL 오버라이드 (PostgreSQL → SQLite) */
window.TUTOR_SQL_OVERRIDES = {

  wa_summary: `
SELECT
  (SELECT COUNT(*) FROM students) AS students,
  (SELECT COUNT(*) FROM organizations) AS orgs,
  (SELECT COUNT(*) FROM class_schedule WHERE class_date >= strftime('%Y-%m-01','now') AND class_date < date(strftime('%Y-%m-01','now'), '+1 month')) AS classes_month,
  (SELECT COUNT(*) FROM test_sessions) AS tests,
  (SELECT COUNT(*) FROM counseling_sessions) AS counsel,
  (SELECT COUNT(*) FROM parent_reports WHERE sent_date IS NULL) AS unsent`,

  wa_home_schedule: `
SELECT cs.class_date, cs.start_time, s.name AS student_name, sub.subject_name, cs.status
FROM class_schedule cs
LEFT JOIN students s ON s.id = cs.student_id
LEFT JOIN subjects sub ON sub.id = cs.subject_id
WHERE cs.class_date BETWEEN date('now','-2 days') AND date('now','+7 days')
ORDER BY cs.class_date, cs.start_time
LIMIT 50`,

  wa_home_drafts: `
SELECT
  COALESCE(strftime('%Y-%m-%d', pr.report_period_start) || ' ~ ' || strftime('%m-%d', pr.report_period_end), pr.report_type) AS report_period,
  s.name AS student_name,
  pr.created_at,
  pr.status
FROM parent_reports pr
LEFT JOIN students s ON s.id = pr.student_id
WHERE pr.sent_date IS NULL
ORDER BY pr.created_at DESC
LIMIT 20`,

  wa_schedule: `
SELECT cs.class_date, cs.start_time, s.name AS student_name, sub.subject_name, cs.topic, cs.status
FROM class_schedule cs
LEFT JOIN students s ON s.id = cs.student_id
LEFT JOIN subjects sub ON sub.id = cs.subject_id
WHERE cs.class_date BETWEEN date('now','-30 days') AND date('now','+7 days')
ORDER BY cs.class_date DESC, cs.start_time
LIMIT 100`,

  wa_prescription: `
SELECT s.name AS student_name,
  NULL AS subject_name,
  cs.session_date AS issued_date,
  substr(COALESCE(cs.prescription, ''), 1, 80) AS focus_area,
  cs.status
FROM counseling_sessions cs
LEFT JOIN students s ON s.id = cs.student_id
WHERE cs.prescription IS NOT NULL AND cs.prescription <> ''
ORDER BY cs.session_date DESC
LIMIT 100`,

  wa_tests: `
SELECT ts.test_date, s.name AS student_name, ts.test_type,
  COALESCE(ts.overall_label, substr(COALESCE(ts.summary, ''), 1, 60)) AS result_summary
FROM test_sessions ts
LEFT JOIN students s ON s.id = ts.student_id
ORDER BY ts.test_date DESC
LIMIT 100`,

  wa_grades: `
SELECT s.name AS student_name, sg.school_year, sg.semester, sg.subject_name,
  NULL AS score, sg.grade AS grade_level
FROM school_grades sg
LEFT JOIN students s ON s.id = sg.student_id
ORDER BY sg.school_year DESC, sg.semester DESC, s.name, sg.subject_name
LIMIT 100`,

  wa_roadmap: `
SELECT s.name AS student_name,
  at.university || COALESCE(' · ' || at.department, '') AS target_name,
  rs.id AS step_order,
  COALESCE(rs.category || ' · ', '') || rs.title AS step_name,
  COALESCE(CAST(rs.school_year AS TEXT) || '학년 ' || CAST(rs.semester AS TEXT) || '학기',
           strftime('%Y-%m-%d', rs.target_date)) AS due_period,
  rs.status
FROM admission_roadmap_steps rs
LEFT JOIN admission_targets at ON at.id = rs.target_id
LEFT JOIN students s ON s.id = rs.student_id
ORDER BY s.name, at.priority, rs.target_date, rs.id
LIMIT 100`,

  wa_counsel: `
SELECT cs.session_date, s.name AS student_name, cs.topic AS session_type,
  cs.counselor AS counselor_name, substr(COALESCE(cs.content, ''), 1, 80) AS summary
FROM counseling_sessions cs
LEFT JOIN students s ON s.id = cs.student_id
ORDER BY cs.session_date DESC
LIMIT 100`,

  wa_reports: `
SELECT
  pr.id,
  COALESCE(strftime('%Y-%m-%d', pr.report_period_start) || ' ~ ' || strftime('%m-%d', pr.report_period_end), pr.report_type) AS report_period,
  s.name AS student_name,
  pr.created_at,
  pr.sent_date AS sent_at,
  pr.status
FROM parent_reports pr
LEFT JOIN students s ON s.id = pr.student_id
ORDER BY pr.created_at DESC
LIMIT 100`,

  wa_search: `
SELECT 'student' AS kind, CAST(s.id AS TEXT) AS ref_id, s.name AS title,
   COALESCE(s.student_code,'') || ' · ' || COALESCE(s.school,'') || ' · ' || COALESCE(s.grade,'') AS subtitle,
   NULL AS as_of
 FROM students s
 WHERE s.name LIKE '%' || ?1 || '%' OR COALESCE(s.student_code,'') LIKE '%' || ?1 || '%' OR COALESCE(s.school,'') LIKE '%' || ?1 || '%'
UNION ALL
SELECT 'org' AS kind, CAST(o.id AS TEXT), o.name,
   COALESCE(o.org_type,'') || ' · ' || COALESCE(o.region,'') AS subtitle,
   NULL
 FROM organizations o
 WHERE o.name LIKE '%' || ?1 || '%' OR COALESCE(o.region,'') LIKE '%' || ?1 || '%'
UNION ALL
SELECT 'test' AS kind, CAST(t.id AS TEXT),
   s.name || ' · ' || COALESCE(t.test_type,'') AS title,
   COALESCE(t.overall_label, substr(COALESCE(t.summary,''),1,40)) AS subtitle,
   t.test_date
 FROM test_sessions t LEFT JOIN students s ON s.id = t.student_id
 WHERE COALESCE(t.test_type,'') LIKE '%' || ?1 || '%' OR COALESCE(t.test_name,'') LIKE '%' || ?1 || '%'
   OR COALESCE(t.summary,'') LIKE '%' || ?1 || '%' OR s.name LIKE '%' || ?1 || '%'
UNION ALL
SELECT 'counsel' AS kind, CAST(c.id AS TEXT),
   s.name || ' · ' || COALESCE(c.topic,'상담') AS title,
   substr(COALESCE(c.content,''),1,50) AS subtitle,
   c.session_date
 FROM counseling_sessions c LEFT JOIN students s ON s.id = c.student_id
 WHERE COALESCE(c.content,'') LIKE '%' || ?1 || '%' OR COALESCE(c.topic,'') LIKE '%' || ?1 || '%' OR s.name LIKE '%' || ?1 || '%'
ORDER BY kind, as_of
LIMIT 30`,

  wa_stu_recent: `
SELECT * FROM (
  SELECT '수업' AS kind, cs.class_date AS d, sub.subject_name AS subject,
     COALESCE(cs.topic, '') AS title, COALESCE(cs.attendance, cs.status) AS status, NULL AS score
   FROM class_schedule cs
   LEFT JOIN subjects sub ON sub.id = cs.subject_id
   WHERE cs.student_id = ?1
   ORDER BY cs.class_date DESC
   LIMIT 10
)
UNION ALL
SELECT * FROM (
  SELECT '숙제' AS kind, h.due_date AS d, sub.subject_name AS subject,
     h.title AS title, h.status AS status, h.score AS score
   FROM homework h
   LEFT JOIN subjects sub ON sub.id = h.subject_id
   WHERE h.student_id = ?1
   ORDER BY h.due_date DESC
   LIMIT 10
)
ORDER BY d DESC`,

  wa_stu_tests: `
SELECT t.id, t.test_date, t.test_type, t.test_name,
  t.overall_label, t.overall_index, substr(COALESCE(t.summary,''),1,120) AS summary
FROM test_sessions t
WHERE t.student_id = ?1
ORDER BY t.test_date DESC
LIMIT 10`,

  wa_stu_counsel: `
SELECT c.session_date, c.counselor, c.topic,
  substr(COALESCE(c.content,''),1,140) AS content_preview,
  substr(COALESCE(c.prescription,''),1,120) AS prescription_preview,
  c.next_date, c.status
FROM counseling_sessions c
WHERE c.student_id = ?1
ORDER BY c.session_date DESC
LIMIT 10`,

  wa_org_detail: `
SELECT o.id, o.name, o.org_type, o.region, o.address,
  o.contact_name, o.contact_phone, o.contact_email,
  o.program_name, o.cohort, o.status, o.start_date, o.end_date, o.student_quota, o.note,
  (SELECT COUNT(*) FROM students s WHERE s.org_id = o.id) AS student_count,
  (SELECT COUNT(*) FROM class_schedule cs JOIN students s ON s.id = cs.student_id
     WHERE s.org_id = o.id AND cs.class_date >= strftime('%Y-%m-01','now')
     AND cs.class_date < date(strftime('%Y-%m-01','now'), '+1 month')) AS classes_month,
  (SELECT COUNT(*) FROM counseling_sessions c JOIN students s ON s.id = c.student_id
     WHERE s.org_id = o.id AND c.session_date >= date('now','-30 days')) AS counsel_30d,
  (SELECT COUNT(*) FROM parent_reports pr JOIN students s ON s.id = pr.student_id
     WHERE s.org_id = o.id AND pr.sent_date IS NULL) AS unsent_reports
FROM organizations o
WHERE o.id = ?1`,

  wa_home_recent_classes: `
SELECT cs.class_date, cs.start_time, s.name AS student_name, sub.subject_name,
  COALESCE(cs.topic,'') AS topic, cs.status
FROM class_schedule cs
LEFT JOIN students s ON s.id = cs.student_id
LEFT JOIN subjects sub ON sub.id = cs.subject_id
ORDER BY ABS(julianday(cs.class_date) - julianday('now')) ASC, cs.start_time
LIMIT 10`,

  wa_m_counsel_add: `
INSERT INTO counseling_sessions (student_id, session_date, counselor, topic, content, prescription, next_date, status)
VALUES (?1, COALESCE(date(NULLIF(?2,'')), date('now')), ?3, ?4, ?5, ?6, date(NULLIF(?7,'')), '완료')
RETURNING id`,

  wa_m_target_add: `
INSERT INTO admission_targets (student_id, university, department, admission_type, target_year, required_grade, priority, status, note)
VALUES (?1, ?2, NULLIF(?3,''), NULLIF(?4,''),
  CASE WHEN ?5 GLOB '[0-9]*' AND ?5 NOT GLOB '*[^0-9]*' THEN CAST(?5 AS INTEGER) ELSE NULL END,
  CASE WHEN ?6 GLOB '[0-9]*' AND ?6 NOT GLOB '*[^0-9.]*' THEN CAST(?6 AS REAL) ELSE NULL END,
  CASE WHEN ?7 GLOB '[0-9]*' AND ?7 NOT GLOB '*[^0-9]*' THEN CAST(?7 AS INTEGER) ELSE 3 END,
  '검토', NULLIF(?8,''))
RETURNING id`,

  wa_m_report_add: `
INSERT INTO parent_reports (student_id, report_period_start, report_period_end, report_type,
  overall_progress, strengths, areas_for_improvement, teacher_comments, next_period_goals, status)
VALUES (?1,
  COALESCE(date(NULLIF(?2,'')), strftime('%Y-%m-01','now')),
  COALESCE(date(NULLIF(?3,'')), date(strftime('%Y-%m-01','now'), '+1 month', '-1 day')),
  NULLIF(?4,''),
  NULLIF(?5,''), NULLIF(?6,''), NULLIF(?7,''), NULLIF(?8,''), NULLIF(?9,''),
  '초안')
RETURNING id`,

  wa_m_report_update: `
UPDATE parent_reports
SET report_period_start = COALESCE(date(NULLIF(?2,'')), report_period_start),
    report_period_end = COALESCE(date(NULLIF(?3,'')), report_period_end),
    report_type = COALESCE(NULLIF(?4,''), report_type),
    overall_progress = NULLIF(?5,''),
    strengths = NULLIF(?6,''),
    areas_for_improvement = NULLIF(?7,''),
    teacher_comments = NULLIF(?8,''),
    next_period_goals = NULLIF(?9,'')
WHERE id = ?1
RETURNING id`
};
