const crypto = require("crypto");

let bcrypt = null;
try {
  bcrypt = require("bcryptjs");
} catch (error) {
  bcrypt = null;
}

const jwtSecret = process.env.JWT_SECRET || "dois-elos-dev-secret-change-me";
const jwtTtlSeconds = Number(process.env.JWT_TTL_SECONDS || 60 * 60 * 8);

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

function signJwt(payload, ttlSeconds = jwtTtlSeconds) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + ttlSeconds };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(body))}`;
  const signature = crypto.createHmac("sha256", jwtSecret).update(unsigned).digest("base64url");
  return `${unsigned}.${signature}`;
}

function verifyJwt(token) {
  if (!token) return null;
  const [header, body, signature] = String(token).split(".");
  if (!header || !body || !signature) return null;
  const unsigned = `${header}.${body}`;
  const expected = crypto.createHmac("sha256", jwtSecret).update(unsigned).digest("base64url");
  if (signature.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

async function hashPassword(password) {
  if (bcrypt) {
    return {
      salt: "bcryptjs",
      passwordHash: await bcrypt.hash(password, 12),
    };
  }
  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt: `scrypt:${salt}`, passwordHash };
}

async function verifyPassword(password, customer) {
  if (!customer) return false;
  if (customer.salt === "bcryptjs" && bcrypt) {
    return bcrypt.compare(password || "", customer.passwordHash);
  }
  if (String(customer.salt || "").startsWith("scrypt:")) {
    const salt = customer.salt.split(":")[1];
    const hash = crypto.scryptSync(password || "", salt, 64).toString("hex");
    return hash === customer.passwordHash;
  }
  const legacyHash = crypto.pbkdf2Sync(password || "", customer.salt, 100000, 64, "sha512").toString("hex");
  return legacyHash === customer.passwordHash;
}

function authFromRequest(request) {
  const header = request.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  return verifyJwt(token);
}

module.exports = {
  authFromRequest,
  hashPassword,
  signJwt,
  verifyJwt,
  verifyPassword,
};
