// 直接调用 Worker 和真实 SQLite，验证审核隔离、鉴权、输入、分页及并发行为。
// 测试不会向线上网站发送请求，也不需要 Cloudflare 账号。
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../comments-worker.js';
import { validArticle } from '../comments.js';
import { createDatabase } from './database.mjs';

const ORIGIN = 'https://catrix.net';
const ARTICLE = '/posts/2026-09-27-dirty-words/';
const KEY = 'test-admin-key-32-characters-long-for-tests';
function setup(t) {
  // 每个测试独享数据库，结束时关闭；固定密钥和示例 IP 仅用于测试。
  const DB = createDatabase(); t.after(() => DB.sqlite.close());
  const env = { DB, COMMENTS_ADMIN_KEY: KEY, COMMENTS_RATE_SALT: 'test-rate-salt-32-characters-long-for-tests', COMMENTS_RATE_LIMIT: '3' };
  const request = (path, options = {}) => worker.fetch(new Request('https://worker.example' + path, options), env);
  const payload = (extra = {}) => ({ article: ARTICLE, nickname: '小读者', body: '这篇文章让我想起校园生活。', requestId: crypto.randomUUID(), ...extra });
  const post = (data, headers = {}) => request('/comments', { method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.1', ...headers }, body: JSON.stringify(data) });
  const list = (article = ARTICLE, before = '') => request('/comments?' + new URLSearchParams({ article, ...(before ? { before } : {}) }));
  const moderate = (id, status, key = KEY) => request('/admin/comments/moderate', { method: 'POST', headers: { 'X-Comments-Key': key, 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) });
  return { env, request, payload, post, list, moderate, db: DB.sqlite };
}

// 完整流程：提交立即公开，按文章隔离，并兼容旧版状态管理。
test('submission is public immediately, isolated per article, and supports legacy moderation', async t => {
  const { post, payload, list, moderate, request } = setup(t);
  assert.equal((await post(payload())).status, 201);
  assert.equal((await (await list()).json()).comments.length, 1);
  const admin = await request('/admin/comments/list', { headers: { 'X-Comments-Key': KEY } });
  const [{ id }] = (await admin.json()).comments;
  assert.equal((await moderate(id, 'approved')).status, 200);
  const data = await (await list()).json();
  assert.equal(data.comments.length, 1);
  assert.deepEqual(Object.keys(data.comments[0]).sort(), ['body', 'created_at', 'id', 'nickname', 'parent_body', 'parent_id', 'parent_nickname']);
  assert.equal((await (await list('/posts/another/')).json()).comments.length, 0);
  await moderate(id, 'rejected');
  assert.equal((await (await list()).json()).comments.length, 0);
  await moderate(id, 'approved');
  assert.equal((await (await list()).json()).comments.length, 1);
});

test('duplicates reuse a receipt and do not consume more quota', async t => {
  const { post, payload, db } = setup(t); const data = payload();
  assert.equal((await post(data)).status, 201);
  for (let i = 0; i < 5; i++) assert.equal((await post(data)).status, 200);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM comments').get().n, 1);
  assert.equal(db.prepare('SELECT count FROM comment_rate_limits').get().count, 1);
  assert.equal((await post({ ...data, body: '修改后的不同内容' })).status, 409);
});

test('rate limiting blocks a fourth distinct comment and returns retry time', async t => {
  const { post, payload } = setup(t);
  for (let i = 0; i < 3; i++) assert.equal((await post(payload())).status, 201);
  const response = await post(payload());
  assert.equal(response.status, 429);
  assert.ok(Number(response.headers.get('Retry-After')) > 0);
  assert.equal((await post(payload(), { 'CF-Connecting-IP': '192.0.2.2' })).status, 201);
});

test('concurrent rate limit requests admit at most three comments', async t => {
  const { post, payload, db } = setup(t);
  const results = await Promise.all(Array.from({ length: 8 }, () => post(payload())));
  assert.equal(results.filter(r => r.status === 201).length, 3);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM comments').get().n, 3);
});

test('concurrent identical retries create one comment', async t => {
  const { post, payload, db } = setup(t); const data = payload();
  await Promise.all([post(data), post(data)]);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM comments').get().n, 1);
});

test('public CORS accepts configured origins and rejects other origins', async t => {
  const { request, post, payload } = setup(t);
  const preflight = await request('/comments', { method: 'OPTIONS', headers: { Origin: ORIGIN } });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), ORIGIN);
  assert.equal((await post(payload(), { Origin: 'https://elsewhere.example' })).status, 403);
  assert.equal((await post(payload(), { Origin: '' })).status, 403);
  const badGet = await request('/comments?article=' + ARTICLE, { headers: { Origin: 'https://elsewhere.example' } });
  assert.equal(badGet.status, 403);
  assert.equal(badGet.headers.get('Access-Control-Allow-Origin'), null);
});

test('moderation requires a separate secret and cannot run via GET', async t => {
  const { request, moderate, env } = setup(t);
  assert.equal((await moderate(1, 'approved', 'legacy-admin-key')).status, 401);
  assert.equal((await request('/admin/comments/list')).status, 401);
  assert.equal((await request('/admin/comments/moderate?id=1&status=approved', { headers: { 'X-Comments-Key': KEY } })).status, 405);
  assert.equal((await moderate(999, 'approved')).status, 404);
  env.COMMENTS_ADMIN_KEY = '';
  assert.equal((await moderate(1, 'approved')).status, 503);
});

test('HTML and SQL-like input are stored as plain data', async t => {
  const { post, payload, moderate, list } = setup(t);
  const body = '<script>alert(1)</script>\n\' ; DROP TABLE comments; --';
  assert.equal((await post(payload({ body, nickname: '<img src=x>' }))).status, 201);
  await moderate(1, 'approved');
  const [comment] = (await (await list()).json()).comments;
  assert.equal(comment.body, body);
  assert.equal(comment.nickname, '<img src=x>');
});

test('field types, lengths, whitespace and control characters are validated', async t => {
  const { post, payload, db } = setup(t);
  for (const extra of [{ nickname: ' ' }, { nickname: 'a'.repeat(41) }, { nickname: 'a\nb' }, { body: ' ' }, { body: 'a'.repeat(2001) }, { body: 12 }, { body: 'a\u0000b' }, { article: 'https://elsewhere.example/' }, { requestId: 'not-a-uuid' }]) {
    assert.equal((await post(payload(extra))).status, 400, JSON.stringify(extra));
  }
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM comments').get().n, 0);
});

test('invalid JSON, content type and oversized bodies are rejected', async t => {
  const { request, post, payload } = setup(t);
  assert.equal((await post(payload(), { 'Content-Type': 'text/plain' })).status, 415);
  const send = body => request('/comments', { method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body });
  assert.equal((await send('{')).status, 400);
  assert.equal((await send('null')).status, 400);
  assert.equal((await send('x'.repeat(17000))).status, 413);
});

test('service fails closed if deployment configuration is missing', async t => {
  const { env, post, payload, request } = setup(t);
  env.COMMENTS_RATE_SALT = '';
  assert.equal((await post(payload())).status, 503);
  env.DB = undefined;
  assert.equal((await request('/comments?article=' + ARTICLE)).status, 503);
});

test('public pagination is bounded and skips pending comments', async t => {
  const { db, list } = setup(t);
  const insert = db.prepare('INSERT INTO comments (request_id, article, nickname, body, status) VALUES (?, ?, ?, ?, ?)');
  for (let i = 0; i < 25; i++) insert.run(crypto.randomUUID(), ARTICLE, '读者', '留言正文', 'approved');
  insert.run(crypto.randomUUID(), ARTICLE, '待审核', '不可公开', 'pending');
  const page1 = await (await list()).json();
  assert.equal(page1.comments.length, 20); assert.equal(page1.comments[0].id, 25);
  const page2 = await (await list(ARTICLE, String(page1.next))).json();
  assert.equal(page2.comments.length, 5); assert.equal(page2.next, null);
  assert.equal(new Set([...page1.comments, ...page2.comments].map(c => c.id)).size, 25);
  assert.equal((await list(ARTICLE, '-1')).status, 400);
});

test('admin pagination and state validation', async t => {
  const { request, moderate, db } = setup(t);
  const insert = db.prepare("INSERT INTO comments (request_id, article, nickname, body, status) VALUES (?, ?, ?, ?, 'approved')");
  for (let i = 0; i < 35; i++) insert.run(crypto.randomUUID(), ARTICLE, '读者', '留言正文');
  const call = path => request(path, { headers: { 'X-Comments-Key': KEY } });
  const first = await (await call('/admin/comments/list')).json();
  assert.equal(first.comments.length, 30);
  const second = await (await call('/admin/comments/list?before=' + first.next)).json();
  assert.equal(second.comments.length, 5);
  assert.equal((await call('/admin/comments/list?status=any')).status, 400);
  assert.equal((await moderate(1, 'any')).status, 400);
});

test('article identifiers only accept canonical article paths', () => {
  assert.equal(validArticle(ARTICLE), true);
  assert.equal(validArticle('/posts/%E4%BD%A0%E5%A5%BD/'), true);
  assert.equal(validArticle('/discuss/'), true);
  assert.equal(validArticle('/discuss'), true);
  for (const value of ['/about/', '/posts/../', '/posts/a/?x=1', '/posts/a/#x', '//example/posts/a/', '/posts/a', null]) assert.equal(validArticle(value), false);
});

test('admin UI exposes no secret and forbids framing', async t => {
  const { request } = setup(t);
  const response = await request('/admin/comments');
  assert.equal(response.status, 200);
  assert.ok(response.headers.get('Content-Security-Policy').includes("frame-ancestors 'none'"));
  assert.ok(!(await response.text()).includes(KEY));
});

// 删除不能绕过管理鉴权，重试也不能恢复已清除的内容。
test('admin deletion clears content and prevents retry resurrection', async t => {
  const { request, post, payload, list, db, moderate } = setup(t);
  const data = payload();
  await post(data);
  const remove = (id, key = KEY) => request('/admin/comments/delete', {
    method: 'POST', headers: { 'X-Comments-Key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id })
  });
  assert.equal((await remove(1, 'wrong')).status, 401);
  assert.equal((await (await list()).json()).comments.length, 1);
  assert.equal((await request('/admin/comments/delete?id=1', { headers: { 'X-Comments-Key': KEY } })).status, 405);
  assert.equal((await remove(-1)).status, 400);
  assert.equal((await remove(999)).status, 404);
  assert.equal((await remove(1)).status, 200);
  assert.equal((await remove(1)).status, 200);
  assert.equal((await (await list()).json()).comments.length, 0);
  const row = db.prepare('SELECT * FROM comments WHERE id = 1').get();
  assert.equal(row.body, ''); assert.equal(row.nickname, '');
  assert.equal((await post(data)).status, 410);
  assert.equal((await moderate(1, 'approved')).status, 404);
  const deleted = await request('/admin/comments/list?status=rejected', { headers: { 'X-Comments-Key': KEY } });
  assert.equal((await deleted.json()).comments.length, 0);
});
