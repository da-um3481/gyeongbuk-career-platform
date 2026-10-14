/* ============================================================
   AI 튜터 대시보드 — 쿼리 API (Vercel 서버리스 함수)
   POST /api/tutor  { q: "wa_students", params: {...} }  ->  { rows: [...] }
   DB 연결 정보는 서버 환경변수(DATABASE_URL)에만 존재합니다.
   ============================================================ */
const { Pool } = require("pg");
const QUERIES_JSON = require("./queries.json");

/* 번들에 없던 추가 쿼리 (학생 등록) */
const EXTRA_QUERIES = [
  {
    name: "wa_m_student_add",
    params: [
      { name: "student_code" }, { name: "name" }, { name: "grade" }, { name: "school" },
      { name: "phone" }, { name: "parent_name" }, { name: "parent_phone" }, { name: "parent_email" },
      { name: "learning_style" }, { name: "learning_goal" }, { name: "org_id" },
    ],
    sql: `INSERT INTO students
        (student_code, name, grade, school, phone, parent_name, parent_phone, parent_email,
         enrolled_date, learning_style, learning_goal, status, org_id)
      VALUES (
        COALESCE(NULLIF($1,''), 'S' || to_char(CURRENT_DATE,'YYYYMMDD') || '-' ||
          lpad(((SELECT COALESCE(MAX(id),0)+1 FROM students))::text, 4, '0')),
        $2,
        NULLIF($3,''), NULLIF($4,''), NULLIF($5,''),
        NULLIF($6,''), NULLIF($7,''), NULLIF($8,''),
        CURRENT_DATE, NULLIF($9,''), NULLIF($10,''), '수강중',
        CASE WHEN NULLIF($11,'') IS NULL THEN NULL ELSE $11::int END
      )
      RETURNING id, student_code, name`,
  },
];

const ALL = (QUERIES_JSON.queries || []).concat(EXTRA_QUERIES);
const BY_NAME = {};
ALL.forEach((q) => { BY_NAME[q.name] = q; });

const CONN = process.env.DATABASE_URL || "";
const pool = new Pool({
  connectionString: CONN,
  ssl: CONN.includes("sslmode=disable") || CONN === "" ? false : { rejectUnauthorized: false },
  max: 3,
  idleTimeoutMillis: 10000,
});

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!CONN) return res.status(503).json({ error: "DATABASE_URL not configured" });

  const need = process.env.TUTOR_TOKEN;
  if (need && req.headers["x-tutor-token"] !== need) {
    return res.status(401).json({ error: "unauthorized" });
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (e) { return res.status(400).json({ error: "bad json" }); }
  }
  body = body || {};

  const q = BY_NAME[body.q];
  if (!q) return res.status(400).json({ error: "unknown query: " + body.q });

  const p = body.params || {};
  const binds = (q.params || []).map((x) => (p[x.name] === undefined ? null : p[x.name]));

  try {
    const out = await pool.query(q.sql, binds);
    return res.status(200).json({ rows: out.rows });
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
};
