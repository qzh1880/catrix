// 浏览器与后端共用排位规则和随机数算法；修改规则时须提升版本。
(function(root) {
  const VERSION = '2026-10-v1', STEP = 50, MAX_TICKS = 18000, MAX_ACTIONS = 12000;
  function seeded(seed) {
    let value = seed >>> 0;
    return () => { value = (Math.imul(value,1664525) + 1013904223) >>> 0; return value / 4294967296; };
  }
  const api = { VERSION, STEP, MAX_TICKS, MAX_ACTIONS, seeded };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CatrixRankRules = api;
})(globalThis);
