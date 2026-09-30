import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';

// 在 SQLite 中运行真实迁移和查询，模拟业务用到的 D1 接口。
// 不覆盖 Cloudflare 线上绑定、网络及运行时差异。
export function createDatabase(filename = ':memory:') {
  const sqlite = new DatabaseSync(filename);
  // 按文件名依次执行所有迁移，模拟正式环境的升级顺序。
  for (const file of readdirSync(new URL('../migrations/', import.meta.url)).filter(f => f.endsWith('.sql')).sort()) {
    sqlite.exec(readFileSync(new URL('../migrations/' + file, import.meta.url), 'utf8'));
  }
  return {
    sqlite,
    prepare(sql) {
      // 保持 prepare().bind().first/all/run() 形式，使测试可以直接调用 Worker。
      return {
        bind(...args) {
          const statement = sqlite.prepare(sql);
          return {
            async first() { return statement.get(...args) || null; },
            async all() { return { results: statement.all(...args) }; },
            async run() {
              // 将 SQLite 写入结果转换为业务代码读取的 D1 meta 字段。
              const result = statement.run(...args);
              return { meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } };
            },
          };
        },
      };
    },
  };
}
