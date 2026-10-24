/* 비밀번호 해시(PBKDF2) + 서명 토큰 — 관리자/학생 API 공용 */
const crypto = require("crypto");

const ITER = 120000;
const KEYLEN = 32;
const DIGEST = "sha256";

function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString("hex");
  const h = crypto.pbkdf2Sync(String(pw), salt, ITER, KEYLEN, DIGEST).toString("hex");
  return `pbkdf2$${ITER}$${salt}$${h}`;
}

function verifyPassword(pw, stored) {
  try {
    if (!stored) return false;
    const parts = String(stored).split("$");
    if (parts.length !== 4) return false;
    const iter = parseInt(parts[1], 10);
    const salt = parts[2];
    const want = Buffer.from(parts[3], "hex");
    const got = crypto.pbkdf2Sync(String(pw), salt, iter, want.length || KEYLEN, DIGEST);
    return got.length === want.length && crypto.timingSafeEqual(got, want);
  } catch (e) {
    return false;
  }
}

const SECRET = crypto
  .createHash("sha256")
  .update("daum-student:" + (process.env.STUDENT_SECRET || process.env.TUTOR_TOKEN || "fallback"))
  .digest();

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  return body + "." + sig;
}

function verifyToken(tok) {
  try {
    if (!tok || String(tok).indexOf(".") < 0) return null;
    const i = String(tok).lastIndexOf(".");
    const body = String(tok).slice(0, i);
    const sig = String(tok).slice(i + 1);
    const want = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
    if (sig.length !== want.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null;
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!p || !p.sid || !p.exp || p.exp < Date.now()) return null;
    return p;
  } catch (e) {
    return null;
  }
}

module.exports = { hashPassword, verifyPassword, sign, verifyToken };
