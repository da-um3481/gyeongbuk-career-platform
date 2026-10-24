/* ============================================================
   학생용 API — 본인 데이터만 반환 (student_id는 토큰에서만 결정)
   POST /api/student  { action, ... }
   action: login | home | homework | complete | sets | prescription
           | grades | profile | change_pw
   ============================================================ */
const { Pool } = require("pg");
const { hashPassword, verifyPassword, sign, verifyToken } = require("./_hash");

const CONN = process.env.DATABASE_URL || "";
const pool = new Pool({
  connectionString: CONN,
  ssl: CONN.includes("sslmode=disable") || CONN === "" ? false : { rejectUnauthorized: false },
  max: 3,
  idleTimeoutMillis: 10000,
});

const DAY = 24 * 60 * 60 * 1000;

async function loadStudent(sid) {
  const r = await pool.query(
    `SELECT s.id, s.name, s.student_code, s.grade, s.school,
            s.learning_goal, s.learning_style, o.name AS org_name
       FROM students s LEFT JOIN organizations o ON o.id = s.org_id
      WHERE s.id = $1`,
    [sid]
  );
  return r.rows[0] || null;
}

async function home(sid) {
  const [classes, hw, sets, weak] = await Promise.all([
    pool.query(
      `SELECT to_char(c.class_date,'YYYY-MM-DD') AS date, c.start_time, c.end_time,
              c.topic, c.status, c.attendance, sub.subject_name
         FROM class_schedule c LEFT JOIN subjects sub ON sub.id = c.subject_id
        WHERE c.student_id = $1 AND c.class_date >= CURRENT_DATE
        ORDER BY c.class_date, c.start_time LIMIT 7`,
      [sid]
    ),
    pool.query(
      `SELECT h.id, h.title, to_char(h.due_date,'YYYY-MM-DD') AS due, h.status, h.score,
              sub.subject_name
         FROM homework h LEFT JOIN subjects sub ON sub.id = h.subject_id
        WHERE h.student_id = $1 AND COALESCE(h.status,'') <> '완료'
        ORDER BY h.due_date NULLS LAST LIMIT 10`,
      [sid]
    ),
    pool.query(
      `SELECT a.id, qs.title, qs.url, a.status,
              to_char(a.due_date,'YYYY-MM-DD') AS due
         FROM question_set_assignments a JOIN question_sets qs ON qs.id = a.set_id
        WHERE a.student_id = $1 AND a.status = '배정'
        ORDER BY a.id DESC LIMIT 10`,
      [sid]
    ),
    pool.query(
      `SELECT trim(u.unit) AS unit, count(*) AS n
         FROM question_set_assignments a
         CROSS JOIN LATERAL unnest(string_to_array(COALESCE(a.wrong_units,''), ',')) AS u(unit)
        WHERE a.student_id = $1 AND COALESCE(a.status,'') = '채점' AND trim(u.unit) <> ''
        GROUP BY trim(u.unit) ORDER BY count(*) DESC LIMIT 8`,
      [sid]
    ),
  ]);
  return {
    classes: classes.rows,
    homework: hw.rows,
    sets: sets.rows,
    weak: weak.rows,
  };
}

async function homework(sid) {
  const r = await pool.query(
    `SELECT h.id, h.title, COALESCE(h.description,'') AS description,
            to_char(h.assigned_date,'YYYY-MM-DD') AS assigned,
            to_char(h.due_date,'YYYY-MM-DD') AS due,
            h.status, h.score, h.feedback, sub.subject_name
       FROM homework h LEFT JOIN subjects sub ON sub.id = h.subject_id
      WHERE h.student_id = $1
      ORDER BY h.due_date DESC NULLS LAST, h.id DESC LIMIT 40`,
    [sid]
  );
  return { homework: r.rows };
}

async function sets(sid) {
  const r = await pool.query(
    `SELECT a.id, qs.title, qs.url, qs.item_count, qs.points, qs.difficulty, qs.unit_name,
            sub.subject_name, a.status, a.score, a.wrong_units, a.feedback,
            to_char(a.assigned_date,'YYYY-MM-DD') AS assigned,
            to_char(a.due_date,'YYYY-MM-DD') AS due,
            to_char(a.graded_date,'YYYY-MM-DD') AS graded
       FROM question_set_assignments a
       JOIN question_sets qs ON qs.id = a.set_id
       LEFT JOIN subjects sub ON sub.id = qs.subject_id
      WHERE a.student_id = $1
      ORDER BY a.id DESC LIMIT 50`,
    [sid]
  );
  return { sets: r.rows };
}

async function prescription(sid) {
  const [c, p] = await Promise.all([
    pool.query(
      `SELECT to_char(session_date,'YYYY-MM-DD') AS date, topic,
              COALESCE(prescription,'') AS prescription,
              COALESCE(next_step,'') AS next_step,
              to_char(next_date,'YYYY-MM-DD') AS next_date, counselor
         FROM counseling_sessions WHERE student_id = $1
        ORDER BY session_date DESC LIMIT 12`,
      [sid]
    ),
    pool.query(
      `SELECT lp.path_name, ls.step_order, ls.title, ls.status,
              to_char(ls.target_date,'YYYY-MM-DD') AS target
         FROM learning_paths lp JOIN learning_path_steps ls ON ls.path_id = lp.id
        WHERE lp.student_id = $1
        ORDER BY lp.id, ls.step_order LIMIT 120`,
      [sid]
    ),
  ]);
  return { counsel: c.rows, steps: p.rows };
}

async function grades(sid) {
  const [g, pr] = await Promise.all([
    pool.query(
      `SELECT school_year, semester, subject_name, achievement, grade
         FROM school_grades WHERE student_id = $1
        ORDER BY school_year DESC, semester DESC, subject_name LIMIT 80`,
      [sid]
    ),
    pool.query(
      `SELECT sub.subject_name, cur.unit_name, pt.progress_percent, pt.mastery_score,
              to_char(pt.updated_at,'YYYY-MM-DD') AS updated
         FROM progress_tracking pt
         LEFT JOIN curriculum cur ON cur.id = pt.curriculum_id
         LEFT JOIN subjects sub ON sub.id = cur.subject_id
        WHERE pt.student_id = $1
        ORDER BY sub.subject_name NULLS LAST, cur.unit_order NULLS LAST LIMIT 80`,
      [sid]
    ),
  ]);
  return { grades: g.rows, progress: pr.rows };
}

async function complete(sid, body) {
  const id = parseInt(body.id, 10);
  if (!id) return { ok: false, error: "id 필요" };
  const r = await pool.query(
    `UPDATE homework SET status = '완료', submitted_at = NOW()
      WHERE id = $1 AND student_id = $2 RETURNING id`,
    [id, sid]
  );
  return { ok: r.rows.length > 0 };
}

async function changePw(sid, body) {
  const oldPw = String(body.old || "");
  const newPw = String(body.new || "");
  if (newPw.length < 4) return { ok: false, error: "새 비밀번호는 4자 이상이어야 합니다." };
  const r = await pool.query(`SELECT pw_hash FROM students WHERE id = $1`, [sid]);
  if (!r.rows.length || !verifyPassword(oldPw, r.rows[0].pw_hash)) {
    return { ok: false, error: "현재 비밀번호가 맞지 않습니다." };
  }
  await pool.query(`UPDATE students SET pw_hash = $2, pw_updated_at = NOW() WHERE id = $1`, [
    sid,
    hashPassword(newPw),
  ]);
  return { ok: true };
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!CONN) return res.status(503).json({ error: "DATABASE_URL not configured" });

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (e) { return res.status(400).json({ error: "bad json" }); }
  }
  body = body || {};
  const action = String(body.action || "");

  try {
    if (action === "login") {
      const id = String(body.id || "").trim();
      const pw = String(body.pw || "");
      if (!id || !pw) return res.status(400).json({ error: "학번과 비밀번호를 입력하세요." });
      const r = await pool.query(
        `SELECT id, pw_hash FROM students
          WHERE (login_id IS NOT NULL AND lower(login_id) = lower($1))
             OR lower(student_code) = lower($1)
          LIMIT 1`,
        [id]
      );
      if (!r.rows.length) return res.status(401).json({ error: "계정을 찾을 수 없습니다." });
      if (!verifyPassword(pw, r.rows[0].pw_hash)) {
        return res.status(401).json({ error: "비밀번호가 맞지 않습니다." });
      }
      const sid = r.rows[0].id;
      const token = sign({ sid, exp: Date.now() + 7 * DAY });
      const student = await loadStudent(sid);
      return res.status(200).json({ ok: true, token, student });
    }

    const hdr = String(req.headers.authorization || "");
    const tok = hdr.indexOf("Bearer ") === 0 ? hdr.slice(7) : String(body.token || "");
    const payload = verifyToken(tok);
    if (!payload) return res.status(401).json({ error: "로그인이 필요합니다." });
    const sid = payload.sid;

    if (action === "me" || action === "profile") {
      const s = await loadStudent(sid);
      return res.status(200).json({ student: s });
    }
    if (action === "home") return res.status(200).json(await home(sid));
    if (action === "homework") return res.status(200).json(await homework(sid));
    if (action === "sets") return res.status(200).json(await sets(sid));
    if (action === "prescription") return res.status(200).json(await prescription(sid));
    if (action === "grades") return res.status(200).json(await grades(sid));
    if (action === "complete") return res.status(200).json(await complete(sid, body));
    if (action === "change_pw") return res.status(200).json(await changePw(sid, body));

    return res.status(400).json({ error: "unknown action: " + action });
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
};
