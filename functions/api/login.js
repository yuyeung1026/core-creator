import { json, makeToken, sessionCookie } from './_utils.js';

function safeEqual(a, b) {
  const x = String(a), y = String(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

export async function onRequestPost({ request, env }) {
  if (!env.OWNER_PASSWORD || !env.SESSION_SECRET) {
    return json({ error: '服务端未配置 OWNER_PASSWORD / SESSION_SECRET' }, 500);
  }
  let body;
  try { body = await request.json(); } catch (e) { return json({ error: '请求格式错误' }, 400); }
  const password = String((body && body.password) || '');
  if (!password || !safeEqual(password, env.OWNER_PASSWORD)) {
    return json({ error: '口令不正确' }, 401);
  }
  const token = await makeToken(env);
  return json({ ok: true }, 200, { 'set-cookie': sessionCookie(token) });
}

export async function onRequest() {
  return json({ error: 'method not allowed' }, 405);
}
