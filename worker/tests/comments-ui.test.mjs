// 用轻量 DOM 模拟验证异步交互，不连接线上服务。
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

class Element {
  children = []; dataset = {}; listeners = {}; value = ''; textContent = '';
  append(...items) { this.children.push(...items); }
  replaceChildren() { this.children = []; }
  addEventListener(name, listener) { this.listeners[name] = listener; }
  setAttribute() {} removeAttribute() {} reportValidity() { return true; }
}
const tick = () => new Promise(resolve => setImmediate(resolve));
function setup(fetch) {
  const elements = new Map();
  const get = id => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); };
  get('comments').dataset = { api: 'https://api.example/comments', article: '/posts/test/' };
  get('comment-body').value = '立即公开的留言'; get('comment-nickname').value = '读者';
  vm.runInNewContext(readFileSync(new URL('../../assets/js/comments.js', import.meta.url), 'utf8'), {
    document: { getElementById: get, createElement: () => new Element() },
    fetch, URL, location: { href: 'https://catrix.net/posts/test/' },
    crypto, AbortController, setTimeout, clearTimeout
  });
  return get;
}
const reply = data => ({ ok: true, json: async () => data });
const comment = { id: 1, nickname: '读者', body: '立即公开的留言', created_at: '2026-10-01T00:00:00Z' };

test('submission refreshes from the first page even while an older read is pending', async () => {
  let firstResolve; const calls = [];
  const get = setup(async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method });
    if (options.method === 'POST') return reply({ ok: true });
    if (calls.length === 1) return new Promise(resolve => { firstResolve = resolve; });
    return reply({ comments: [comment], next: null });
  });
  await get('comment-form').listeners.submit({ preventDefault() {} });
  assert.equal(get('comment-body').value, '');
  firstResolve(reply({ comments: [], next: 99 }));
  await tick(); await tick();
  assert.equal(calls.length, 3);
  assert.ok(!calls[2].url.includes('before='));
  assert.equal(get('comment-list').children.length, 1);
});

test('failed publication keeps the text and reuses its request identifier on retry', async () => {
  const payloads = [];
  const get = setup(async (url, options = {}) => {
    if (options.method !== 'POST') return reply({ comments: [], next: null });
    payloads.push(JSON.parse(options.body));
    return { ok: false, json: async () => ({ error: '暂时无法提交' }) };
  });
  await tick();
  await get('comment-form').listeners.submit({ preventDefault() {} });
  assert.equal(get('comment-body').value, '立即公开的留言');
  await get('comment-form').listeners.submit({ preventDefault() {} });
  assert.equal(payloads[0].requestId, payloads[1].requestId);
  assert.equal(get('comment-list').children.length, 0);
});
