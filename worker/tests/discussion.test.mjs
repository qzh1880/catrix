import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../comments-worker.js';
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

test('discuss page supports posting, page-based pagination, replies, and community deletion', async t => {
  const { call, env } = setup(t);
  const DISCUSS = '/discuss/';

  // 1. 发布讨论
  const res1 = await call('/comments', {
    article: DISCUSS,
    nickname: '讨论发起人',
    body: '欢迎来到 CATRIX 讨论区！',
    requestId: crypto.randomUUID()
  });
  assert.equal(res1.status, 201);

  // 2. 分页读取 (使用 page 参数)
  const listRes = await call(`/comments?article=${encodeURIComponent(DISCUSS)}&page=1`);
  assert.equal(listRes.status, 200);
  const listData = await listRes.json();
  assert.equal(listData.comments.length, 1);
  assert.equal(listData.total, 1);
  assert.equal(listData.page, 1);
  assert.equal(listData.more, false);
  const firstId = listData.comments[0].id;

  // 3. 回复讨论 (单层回复)
  const replyRes = await call('/comments', {
    article: DISCUSS,
    nickname: '回复者',
    body: '我也很赞同这个想法。',
    parentId: firstId,
    requestId: crypto.randomUUID()
  });
  assert.equal(replyRes.status, 201);

  const listRes2 = await call(`/comments?article=${encodeURIComponent(DISCUSS)}&page=1`);
  const listData2 = await listRes2.json();
  assert.equal(listData2.total, 2);
  const replyItem = listData2.comments.find(c => c.parent_id === firstId);
  assert.ok(replyItem);
  assert.equal(replyItem.parent_nickname, '讨论发起人');

  // 4. 点赞
  const visitor = crypto.randomUUID();
  const likeRes = await call('/community/like', {
    kind: 'comment',
    id: firstId,
    liked: true,
    visitor
  });
  assert.equal(likeRes.status, 200);
  assert.equal((await likeRes.json()).likes, 1);

  // 5. 管理员删除讨论 (通过 community/admin/delete-comment)
  const delWithoutKey = await call('/community/admin/delete-comment', { id: firstId });
  assert.equal(delWithoutKey.status, 401);

  const delWithKey = await call('/community/admin/delete-comment', { id: firstId }, KEY);
  assert.equal(delWithKey.status, 200);
  assert.equal((await delWithKey.json()).ok, true);

  // 再次读取：被删除的讨论不再显示
  const listRes3 = await call(`/comments?article=${encodeURIComponent(DISCUSS)}&page=1`);
  const listData3 = await listRes3.json();
  assert.equal(listData3.comments.some(c => c.id === firstId), false);
});

