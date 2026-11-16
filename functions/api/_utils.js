// Cloudflare Pages Functions 公共工具
const enc = new TextEncoder();

function b64url(bytes) {
  let s = '';
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(str) {
  const s = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers }
  });
}

async function hmac(secret, text) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(text));
  return b64url(sig);
}

export async function makeToken(env, days = 30) {
  const exp = Date.now() + days * 86400000;
  return exp + '.' + await hmac(env.SESSION_SECRET, String(exp));
}

export async function verifyToken(env, token) {
  if (!token) return false;
  const [exp, sig] = String(token).split('.');
  if (!exp || !sig) return false;
  if (Number(exp) < Date.now()) return false;
  const expect = await hmac(env.SESSION_SECRET, exp);
  if (expect.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expect.length; i++) diff |= expect.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

export function getCookie(request, name) {
  const raw = request.headers.get('cookie') || '';
  for (const part of raw.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return rest.join('=');
  }
  return '';
}

export async function isAuthed(request, env) {
  return verifyToken(env, getCookie(request, 'cc_session'));
}

export function sessionCookie(token, days = 30) {
  return `cc_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${days * 86400}`;
}

export function clearCookie() {
  return 'cc_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
}

export async function readLibrary(env) {
  const raw = await env.LIBRARY.get('library');
  if (!raw) return { version: '', library: null, updatedAt: null };
  const data = JSON.parse(raw);
  return { version: data.version || '', library: data.library || null, updatedAt: data.updatedAt || null };
}

export async function writeLibrary(env, library) {
  const version = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const record = { version, library, updatedAt: new Date().toISOString() };
  await env.LIBRARY.put('library', JSON.stringify(record));
  // 留最近 10 份快照，误覆盖时可回滚
  await env.LIBRARY.put('snap:' + version, JSON.stringify(record));
  const list = await env.LIBRARY.list({ prefix: 'snap:' });
  const keys = list.keys.map(k => k.name).sort();
  while (keys.length > 10) await env.LIBRARY.delete(keys.shift());
  return version;
}
