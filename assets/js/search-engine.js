// 搜索纯函数供浏览器和测试共用；多关键词全部匹配，标题优先。
(function(root) {
  const normalize = value => String(value ?? '').normalize('NFKC').toLowerCase();
  function search(index, query = '', tag = '', category = '') {
    const words = normalize(query).trim().split(/\s+/).filter(Boolean);
    return index.filter(item => (!tag || (item.tags || []).includes(tag)) && (!category || (item.categories || []).includes(category)))
      .map(item => {
        const title = normalize(item.title);
        const metadata = normalize([item.author, ...(item.tags || []), ...(item.categories || [])].join(' '));
        const text = title + ' ' + metadata + ' ' + normalize(item.content);
        const score = words.every(word => text.includes(word)) ? words.reduce((n, word) => n + (title.includes(word) ? 10 : metadata.includes(word) ? 5 : 1), 0) : -1;
        return { item, score };
      }).filter(result => result.score >= 0)
      .sort((a,b) => b.score - a.score || String(b.item.date).localeCompare(String(a.item.date)))
      .map(result => result.item);
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { search };
  else root.CatrixSearch = { search };
})(typeof window === 'undefined' ? globalThis : window);
