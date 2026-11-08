// Server-side admin auth.
//
// Admin passwords live ONLY in server env vars (no VITE_ prefix, so Vite never
// bundles them into the public JS). The browser posts the password once to
// admin-login.js, which returns a short-lived HMAC-signed token listing the
// scopes that password unlocks. Every admin function then checks that token
// with requireAdmin() instead of comparing a password.
//
// Scopes:
//   admin      full SNZ sys admin — also satisfies every scope below except wfsc
//   bingo      Fish Bingo admin only
//   nationals  Nationals admin only
//   catfish    Catfish Cull competition admin only
//   mudgeway   Mudgeway Trophy admin only
//   wfsc       WFSC 2026 scoring app only (separate app; admin does NOT imply it)

const crypto = require('crypto')

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000

const SCOPE_ENV = {
  admin:     'SNZ_ADMIN_PASSWORD',
  bingo:     'SNZ_BINGO_ADMIN_PASSWORD',
  nationals: 'SNZ_NATIONALS_ADMIN_PASSWORD',
  catfish:   'SNZ_CATFISH_ADMIN_PASSWORD',
  mudgeway:  'SNZ_MUDGEWAY_ADMIN_PASSWORD',
  wfsc:      'SNZ_WFSC_ADMIN_PASSWORD',
}

function secret() {
  const s = process.env.ADMIN_TOKEN_SECRET
  if (!s || s.length < 32) throw new Error('ADMIN_TOKEN_SECRET is not configured')
  return s
}

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest()
  const hb = crypto.createHash('sha256').update(String(b)).digest()
  return crypto.timingSafeEqual(ha, hb)
}

// Every scope this password unlocks (normally exactly one).
function scopesForPassword(password) {
  if (!password) return []
  return Object.entries(SCOPE_ENV)
    .filter(([, envName]) => process.env[envName] && safeEqual(password, process.env[envName]))
    .map(([scope]) => scope)
}

const b64u = (buf) => Buffer.from(buf).toString('base64url')
const sign = (data) => crypto.createHmac('sha256', secret()).update(data).digest('base64url')

function issueToken(scopes) {
  const payload = b64u(JSON.stringify({ s: scopes, exp: Date.now() + TOKEN_TTL_MS }))
  return `${payload}.${sign(payload)}`
}

function verifyToken(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null
  const [payload, sig] = token.split('.')
  const expected = sign(payload)
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString())
    if (!Array.isArray(data.s) || typeof data.exp !== 'number' || data.exp < Date.now()) return null
    return data
  } catch {
    return null
  }
}

// True if the token grants any of `scopes`. 'admin' satisfies everything but wfsc.
function hasScope(data, scopes = ['admin']) {
  if (!data) return false
  return scopes.some(s => data.s.includes(s) || (s !== 'wfsc' && data.s.includes('admin')))
}

// Read the token from the request body (adminToken) or Authorization header.
function requireAdmin(event, body, scopes = ['admin']) {
  const auth = event?.headers?.authorization || event?.headers?.Authorization || ''
  const token = (body && body.adminToken) || (auth.startsWith('Bearer ') ? auth.slice(7) : null)
  const data = verifyToken(token)
  return hasScope(data, scopes) ? data : null
}

module.exports = { scopesForPassword, issueToken, verifyToken, hasScope, requireAdmin, SCOPE_ENV }
