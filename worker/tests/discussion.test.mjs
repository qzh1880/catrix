import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.js';
import { createDatabase } from './database.mjs';
import { createRequire } from 'node:module';
const { search } = createRequire(import.meta.url)('../../assets/js/search-engine.js');
const ARTICLE = '/posts/test/';
const KEY = 'test-key-at-least-32-characters-for-admin';
function setup(t) {
  const DB = createDatabase(); t.after(() => DB.sqlite.close());
  const env = { DB, COMMENTS_ADMIN_KEY: KEY, COMMENTS_RATE_SALT: KEY, COMMENTS_RATE_LIMIT: '100' };
  const call = (path, data, key) => worker.fetch(new Request('https://api.example' + path, {
    method: data ? 'POST' : 'GET', headers: { Origin: 'https://catrix.net', 'CF-Connecting-IP': '192.0.2.1', 'Content-Type': 'application/json', ...(key ? { 'X-Comments-Key': key } : {}) },
    ...(data ? { body: JSON.stringify(data) } : {})
  }), env);
  const post = data => call('/comments', { article: ARTICLE, nickname: '读者', body: '留言内容', requestId: crypto.randomUUID(), ...data });
  const report = (id, extra = {}) => call('/comments', { action: 'report', article: ARTICLE, id, reason: 'spam', ...extra });
  const list = async () => (await (await call('/comments?article=' + ARTICLE)).json()).comments;
  return { DB, env, call, post, report, list };
}

test('single-level replies retain context and redact deleted parents', async t => {
  const { post, list, call } = setup(t);
  await post({ nickname: '原作者' });
  assert.equal((await post({ parentId: 1 })).status, 201);
  let rows = await list();
  assert.equal(rows[0].parent_id, 1); assert.equal(rows[0].parent_nickname, '原作者');
  assert.equal((await post({ parentId: 2 })).status, 409);
  assert.equal((await post({ parentId: 1, article: '/posts/another/' })).status, 409);
  assert.equal((await post({ parentId: '1' })).status, 400);
  await call('/admin/comments/delete', { id: 1 }, KEY);
  rows = await list(); assert.equal(rows.length, 1);
  assert.equal(rows[0].parent_nickname, null); assert.equal(rows[0].parent_body, null);
  assert.equal((await post({ parentId: 1 })).status, 409);
});

test('changing reply target with the same request ID is rejected', async t => {
  const { post } = setup(t); await post({});
  const requestId = crypto.randomUUID();
  await post({ requestId, parentId: 1 });
  assert.equal((await post({ requestId, parentId: 1 })).status, 200);
  assert.equal((await post({ requestId })).status, 409);
});

test('reports are deduplicated, private and resolved by administrators', async t => {
  const { post, report, list, call, DB } = setup(t); await post({});
  assert.equal((await report(1)).status, 201);
  assert.equal((await report(1)).status, 200);
  assert.equal(DB.sqlite.prepare('SELECT COUNT(*) AS n FROM comment_reports').get().n, 1);
  const publicRows = await list(); assert.equal(publicRows.length, 1);
  assert.equal(publicRows[0].report_count, undefined);
  assert.equal((await call('/admin/comments/list?status=reported')).status, 401);
  const queue = await (await call('/admin/comments/list?status=reported', null, KEY)).json();
  assert.equal(queue.comments[0].report_count, 1); assert.equal(queue.comments[0].report_reasons, 'spam');
  assert.equal((await call('/admin/comments/resolve-reports', { id: 1 })).status, 401);
  await call('/admin/comments/resolve-reports', { id: 1 }, KEY);
  assert.equal((await (await call('/admin/comments/list?status=reported', null, KEY)).json()).comments.length, 0);
  assert.equal((await list()).length, 1);
});

test('deletion resolves reports and prevents further reporting', async t => {
  const { post, report, call, DB } = setup(t); await post({}); await report(1);
  await call('/admin/comments/delete', { id: 1 }, KEY);
  assert.equal(DB.sqlite.prepare('SELECT status FROM comment_reports').get().status, 'resolved');
  assert.equal((await report(1)).status, 404);
});

test('reports validate targets and enforce a separate quota', async t => {
  const { post, report, env } = setup(t);
  for (let i=0;i<11;i++) await post({});
  assert.equal((await report(1, { reason: '<script>' })).status, 400);
  assert.equal((await report(1, { article: '/posts/wrong/' })).status, 404);
  for (let id=1;id<=10;id++) assert.equal((await report(id)).status, 201);
  const limited = await report(11); assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get('Retry-After')) > 0);
  assert.equal((await report(1)).status, 200);
  assert.equal((await post({})).status, 201);
  env.COMMENTS_RATE_SALT = ''; assert.equal((await report(11)).status, 503);
});

test('search covers full text, author, tags, issue and multiple keywords', () => {
  const index = [
    { title: '校园观察', author: 'Lin', tags: ['校园生活'], categories: ['Sep.2026'], content: 'x'.repeat(2100) + '远端关键词', date: '2026-09-01' },
    { title: '另一个故事', author: 'Wang', tags: ['随笔'], categories: ['Oct.2026'], content: '校园观察', date: '2026-10-01' }
  ];
  assert.equal(search(index, '校园观察')[0], index[0]);
  for (const q of ['lin', '远端关键词', '校园生活', 'Sep.2026', 'Lin 观察']) assert.equal(search(index, q)[0], index[0]);
  assert.deepEqual(search(index, '', '随笔', 'Oct.2026'), [index[1]]);
  assert.equal(search(index, '不存在').length, 0);
  assert.equal(search(index, 'Lin', '随笔').length, 0);
  assert.equal(search(index, '')[0], index[1]);
});
