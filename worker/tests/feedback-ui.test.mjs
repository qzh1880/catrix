import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

class Element {
  children = []; dataset = {}; listeners = {}; value = ''; textContent = ''; disabled = false;
  append(...items) { this.children.push(...items); }
  replaceChildren() { this.children = []; }
  addEventListener(name, listener) { this.listeners[name] = listener; }
  setAttribute() {} removeAttribute() {} reportValidity() { return true; }
  focus() {}
}

const tick = () => new Promise(resolve => setImmediate(resolve));

function setupHome(onRequest) {
  const elements = new Map();
  // On homepage, only home-feedback, form, fields, body, submit, status exist (no list, no name input)
  elements.set('home-feedback', new Element());
  elements.set('feedback-form', new Element());
  elements.set('feedback-fields', new Element());
  elements.set('feedback-body', new Element());
  elements.set('feedback-submit', new Element());
  elements.set('feedback-status', new Element());

  const get = id => elements.get(id) || null;
  get('home-feedback').dataset = { api: 'https://comments-api.catrix.net' };
  get('feedback-body').value = '建议在主页增加暗色模式切换';
  
  const CatrixCommunity = {
    configure() {},
    request: onRequest
  };

  vm.runInNewContext(readFileSync(new URL('../../assets/js/feedback.js', import.meta.url), 'utf8'), {
    window: { CatrixCommunity },
    document: {
      getElementById: get,
      createElement: () => new Element(),
      readyState: 'complete',
      addEventListener: () => {}
    },
    crypto, setTimeout, clearTimeout
  });
  return get;
}

test('home feedback automatically uses "访客" as nickname when submitting', async () => {
  const requests = [];
  const get = setupHome(async (endpoint, data) => {
    requests.push({ endpoint, data });
    return { ok: true };
  });

  await get('feedback-form').listeners.submit({ preventDefault() {} });
  await tick();

  assert.equal(requests.length, 1);
  assert.equal(requests[0].endpoint, 'feedback');
  assert.equal(requests[0].data.nickname, '访客');
  assert.equal(requests[0].data.body, '建议在主页增加暗色模式切换');
  assert.ok(requests[0].data.requestId);
  assert.equal(get('feedback-body').value, '');
  assert.equal(get('feedback-status').textContent, '建议已提交，感谢你的反馈！');
  assert.equal(get('feedback-status').dataset.state, 'success');
  assert.equal(get('feedback-submit').disabled, false);
});

test('home feedback rejects empty or 1-char bodies before submitting', async () => {
  const requests = [];
  const get = setupHome(async (endpoint, data) => {
    requests.push({ endpoint, data });
    return { ok: true };
  });

  get('feedback-body').value = '  ';
  await get('feedback-form').listeners.submit({ preventDefault() {} });
  assert.equal(requests.length, 0);
  assert.equal(get('feedback-status').textContent, '建议内容至少需 2 个字。');

  get('feedback-body').value = '好';
  await get('feedback-form').listeners.submit({ preventDefault() {} });
  assert.equal(requests.length, 0);
  assert.equal(get('feedback-status').textContent, '建议内容至少需 2 个字。');
});

test('failed feedback submission preserves the input and allows idempotent retry', async () => {
  const requests = [];
  let shouldFail = true;
  const get = setupHome(async (endpoint, data) => {
    requests.push({ endpoint, data });
    if (shouldFail) throw new Error('网络连接超时，请重试');
    return { ok: true };
  });

  await get('feedback-form').listeners.submit({ preventDefault() {} });
  await tick();

  assert.equal(requests.length, 1);
  assert.equal(get('feedback-body').value, '建议在主页增加暗色模式切换');
  assert.equal(get('feedback-status').textContent, '网络连接超时，请重试');
  assert.equal(get('feedback-status').dataset.state, 'error');
  assert.equal(get('feedback-submit').disabled, false);

  // Retry with same content
  shouldFail = false;
  await get('feedback-form').listeners.submit({ preventDefault() {} });
  await tick();

  assert.equal(requests.length, 2);
  assert.equal(requests[0].data.requestId, requests[1].data.requestId);
  assert.equal(get('feedback-body').value, '');
  assert.equal(get('feedback-status').dataset.state, 'success');
});
