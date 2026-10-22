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

  /* ---------- 자료실(교재·처방자료) 관리 ---------- */

  /* 스키마 보강: 최종 확인일·수정일·상태 (여러 번 실행해도 안전) */
  {
    name: "wa_lib_migrate",
    params: [],
    sql: `ALTER TABLE learning_contents ADD COLUMN IF NOT EXISTS verified_at date;
      ALTER TABLE learning_contents ADD COLUMN IF NOT EXISTS updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE prescription_resources ADD COLUMN IF NOT EXISTS verified_at date;
      ALTER TABLE prescription_resources ADD COLUMN IF NOT EXISTS status character varying(20) DEFAULT '활성';
      ALTER TABLE prescription_resources ADD COLUMN IF NOT EXISTS updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;`,
  },

  {
    name: "wa_lib_meta",
    params: [],
    sql: `SELECT id, subject_name FROM subjects ORDER BY id`,
  },

  {
    name: "wa_lib_contents",
    params: [{ name: "q" }, { name: "subject_id" }],
    sql: `SELECT c.id, c.title, c.content_type, c.format, c.difficulty, c.estimated_minutes,
        c.author, c.source, c.url, c.tags, c.description, c.status, c.verified_at,
        to_char(c.verified_at,'YYYY-MM-DD') AS verified_on,
        to_char(c.updated_at,'YYYY-MM-DD')  AS updated_on,
        s.subject_name
      FROM learning_contents c
      LEFT JOIN subjects s ON s.id = c.subject_id
      WHERE ($1 = '' OR c.title ILIKE '%'||$1||'%' OR COALESCE(c.tags,'') ILIKE '%'||$1||'%'
             OR COALESCE(c.source,'') ILIKE '%'||$1||'%' OR COALESCE(c.description,'') ILIKE '%'||$1||'%')
        AND (NULLIF($2,'') IS NULL OR c.subject_id = NULLIF($2,'')::int)
      ORDER BY c.status NULLS LAST, c.id DESC
      LIMIT 300`,
  },

  {
    name: "wa_lib_content_add",
    params: [
      { name: "subject_id" }, { name: "title" }, { name: "content_type" }, { name: "format" },
      { name: "difficulty" }, { name: "estimated_minutes" }, { name: "author" }, { name: "source" },
      { name: "url" }, { name: "tags" }, { name: "description" }, { name: "status" }, { name: "verified_at" },
    ],
    sql: `INSERT INTO learning_contents
        (subject_id, title, content_type, format, difficulty, estimated_minutes, author, source,
         url, tags, description, status, verified_at)
      VALUES (NULLIF($1,'')::int, $2, NULLIF($3,''), NULLIF($4,''), NULLIF($5,''), NULLIF($6,'')::int,
        NULLIF($7,''), NULLIF($8,''), NULLIF($9,''), NULLIF($10,''), NULLIF($11,''),
        COALESCE(NULLIF($12,''),'활성'), NULLIF($13,'')::date)
      RETURNING id, title`,
  },

  {
    name: "wa_lib_content_upd",
    params: [
      { name: "id" }, { name: "subject_id" }, { name: "title" }, { name: "content_type" }, { name: "format" },
      { name: "difficulty" }, { name: "estimated_minutes" }, { name: "author" }, { name: "source" },
      { name: "url" }, { name: "tags" }, { name: "description" }, { name: "status" }, { name: "verified_at" },
    ],
    sql: `UPDATE learning_contents SET
        subject_id = NULLIF($2,'')::int, title = $3, content_type = NULLIF($4,''), format = NULLIF($5,''),
        difficulty = NULLIF($6,''), estimated_minutes = NULLIF($7,'')::int, author = NULLIF($8,''),
        source = NULLIF($9,''), url = NULLIF($10,''), tags = NULLIF($11,''), description = NULLIF($12,''),
        status = COALESCE(NULLIF($13,''),'활성'), verified_at = NULLIF($14,'')::date, updated_at = NOW()
      WHERE id = $1::int
      RETURNING id, title`,
  },

  {
    name: "wa_lib_content_del",
    params: [{ name: "id" }],
    sql: `UPDATE learning_contents SET status = '중지', updated_at = NOW()
      WHERE id = $1::int RETURNING id`,
  },

  {
    name: "wa_lib_content_touch",
    params: [{ name: "id" }],
    sql: `UPDATE learning_contents SET verified_at = CURRENT_DATE, updated_at = NOW()
      WHERE id = $1::int RETURNING id, to_char(verified_at,'YYYY-MM-DD') AS verified_on`,
  },

  {
    name: "wa_lib_rx",
    params: [{ name: "q" }, { name: "subject_id" }, { name: "resource_type" }],
    sql: `SELECT r.id, r.title, r.resource_type, r.level, r.target, r.provider, r.url,
        r.note, r.tags, r.status, r.verified_at,
        to_char(r.verified_at,'YYYY-MM-DD') AS verified_on,
        to_char(r.updated_at,'YYYY-MM-DD')  AS updated_on,
        s.subject_name
      FROM prescription_resources r
      LEFT JOIN subjects s ON s.id = r.subject_id
      WHERE ($1 = '' OR r.title ILIKE '%'||$1||'%' OR COALESCE(r.tags,'') ILIKE '%'||$1||'%'
             OR COALESCE(r.provider,'') ILIKE '%'||$1||'%' OR COALESCE(r.note,'') ILIKE '%'||$1||'%')
        AND (NULLIF($2,'') IS NULL OR r.subject_id = NULLIF($2,'')::int)
        AND (NULLIF($3,'') IS NULL OR r.resource_type = $3)
      ORDER BY r.status NULLS LAST, r.id DESC
      LIMIT 300`,
  },

  {
    name: "wa_lib_rx_add",
    params: [
      { name: "resource_type" }, { name: "subject_id" }, { name: "title" }, { name: "provider" },
      { name: "url" }, { name: "level" }, { name: "target" }, { name: "note" }, { name: "tags" },
      { name: "status" }, { name: "verified_at" },
    ],
    sql: `INSERT INTO prescription_resources
        (resource_type, subject_id, title, provider, url, level, target, note, tags, status, verified_at)
      VALUES ($1, NULLIF($2,'')::int, $3, NULLIF($4,''), NULLIF($5,''), NULLIF($6,''), NULLIF($7,''),
        NULLIF($8,''), NULLIF($9,''), COALESCE(NULLIF($10,''),'활성'), NULLIF($11,'')::date)
      RETURNING id, title`,
  },

  {
    name: "wa_lib_rx_upd",
    params: [
      { name: "id" }, { name: "resource_type" }, { name: "subject_id" }, { name: "title" }, { name: "provider" },
      { name: "url" }, { name: "level" }, { name: "target" }, { name: "note" }, { name: "tags" },
      { name: "status" }, { name: "verified_at" },
    ],
    sql: `UPDATE prescription_resources SET
        resource_type = $2, subject_id = NULLIF($3,'')::int, title = $4, provider = NULLIF($5,''),
        url = NULLIF($6,''), level = NULLIF($7,''), target = NULLIF($8,''), note = NULLIF($9,''),
        tags = NULLIF($10,''), status = COALESCE(NULLIF($11,''),'활성'),
        verified_at = NULLIF($12,'')::date, updated_at = NOW()
      WHERE id = $1::int
      RETURNING id, title`,
  },

  {
    name: "wa_lib_rx_del",
    params: [{ name: "id" }],
    sql: `UPDATE prescription_resources SET status = '중지', updated_at = NOW()
      WHERE id = $1::int RETURNING id`,
  },

  {
    name: "wa_lib_rx_touch",
    params: [{ name: "id" }],
    sql: `UPDATE prescription_resources SET verified_at = CURRENT_DATE, updated_at = NOW()
      WHERE id = $1::int RETURNING id, to_char(verified_at,'YYYY-MM-DD') AS verified_on`,
  },

  /* 완전 삭제 — 잘못 등록한 자료 정리용(화면 버튼은 '중지'만 사용) */
  {
    name: "wa_lib_content_purge",
    params: [{ name: "id" }],
    sql: `DELETE FROM learning_contents WHERE id = $1::int RETURNING id`,
  },

  {
    name: "wa_lib_rx_purge",
    params: [{ name: "id" }],
    sql: `DELETE FROM prescription_resources WHERE id = $1::int RETURNING id`,
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
