import { json, isAuthed, readLibrary, writeLibrary } from './_utils.js';

const MAX_BYTES = 20 * 1024 * 1024;

export async function onRequestGet({ env }) {
  try {
    const data = await readLibrary(env);
    return json(data);
  } catch (e) {
    return json({ error: '读取失败：' + e.message }, 500);
  }
}

export async function onRequestPut({ request, env }) {
  try {
    if (!(await isAuthed(request, env))) return json({ error: '未登录' }, 401);

    const buf = await request.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) return json({ error: '资料过大（超过 20MB）' }, 413);
    let body;
    try { body = JSON.parse(new TextDecoder().decode(buf)); } catch (e) { return json({ error: 'JSON 解析失败' }, 400); }
    const library = body && body.library;
    if (!library || !Array.isArray(library.entries)) return json({ error: '缺少 library.entries' }, 400);

    const current = await readLibrary(env);
    const ifMatch = request.headers.get('if-match') || '';
    if (current.version && ifMatch !== current.version) {
      return json({ error: '版本冲突', version: current.version }, 409);
    }

    const version = await writeLibrary(env, library);
    return json({ ok: true, version });
  } catch (e) {
    return json({ error: '保存失败：' + e.message }, 500);
  }
}
