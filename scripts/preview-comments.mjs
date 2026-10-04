// 本地演示：先用 Hugo 构建页面，再用 Node 模拟 Worker。不会连接 Cloudflare。
// 数据保存在内存中，退出后清空；此脚本不能作为正式部署入口。
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { dirname, resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from '../worker/comments-worker.js';
import { createDatabase } from '../worker/tests/database.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const preview = resolve(root, '.comment-preview');
const publicDir = resolve(preview, 'public');
const port = Number(process.env.COMMENTS_PREVIEW_PORT || 1313);
const origin = `http://localhost:${port}`;
mkdirSync(preview, { recursive: true });
// 使用额外配置开启预览评论区，保留正式配置的默认关闭状态。
writeFileSync(resolve(preview, 'comments.toml'), `[params.comments]\nenabled = true\napiURL = "${origin}/comments"\n`);
const build = spawnSync(process.env.HUGO_BINARY || 'hugo', ['--source', root, '--config', 'hugo.toml,.comment-preview/comments.toml', '--baseURL', origin + '/', '--destination', publicDir], { stdio: 'inherit' });
if (build.error || build.status !== 0) { console.error(build.error || 'Hugo build failed'); process.exit(1); }
const DB = createDatabase();
// 这些固定凭证仅用于本机演示；正式部署应配置独立的随机 Secret。
const env = {
  DB, COMMENTS_ADMIN_KEY: 'local-preview-comments-admin-key-only',
  COMMENTS_RATE_SALT: 'local-preview-rate-limit-salt-only-32',
  COMMENTS_ALLOWED_ORIGINS: `${origin},http://127.0.0.1:${port}`,
};
const article = '/posts/2026-09-27-dirty-words/';
// 插入两条示例留言，便于直接检查列表排版。
for (const [nickname, body] of [
  ['示例读者 · 林', '读完之后，我开始留意日常语言里的情绪。这类校园观察很适合继续做成系列。'],
  ['示例读者 · 阿夏', '期待下篇！也想听听不同年级同学的看法。'],
]) {
  DB.sqlite.prepare("INSERT INTO comments (request_id, article, nickname, body, status) VALUES (?, ?, ?, ?, 'approved')").run(crypto.randomUUID(), article, nickname, body);
}
// 反馈示例只存在于本地内存数据库；重启预览会重新生成。
for (const [name, body] of [['演示读者 · 林', '希望增加夜间阅读模式，晚上看文章更舒服。'], ['演示读者 · 阿夏', '想看到更多校园活动的照片和幕后故事。']]) {
  DB.sqlite.prepare('INSERT INTO feedback(request_id,nickname,body) VALUES (?,?,?)').run(crypto.randomUUID(), name, body);
}
for (let i=0;i<3;i++) DB.sqlite.prepare("INSERT INTO community_likes(kind,target_id,voter) VALUES ('feedback',1,?)").run('local-demo-'+i);
// 讨论区示例只存在于本地内存数据库
for (const [name, body] of [
  ['讨论发起人 · 小白', '欢迎来到 CATRIX 开放讨论区！大家对杂志社最近的选题或校园活动有什么想法？'],
  ['读者 · 晨曦', '希望能看到更多高中生摄影作品和社团故事的分享！']
]) {
  DB.sqlite.prepare("INSERT INTO comments (request_id, article, nickname, body, status) VALUES (?, '/discuss/', ?, ?, 'approved')").run(crypto.randomUUID(), name, body);
}
for (let i=0;i<2;i++) DB.sqlite.prepare("INSERT INTO community_likes(kind,target_id,voter) VALUES ('comment',3,?)").run('local-discuss-demo-'+i);
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, origin);
    if (url.pathname.startsWith('/community/') || url.pathname === '/comments' || url.pathname.startsWith('/admin/comments')) {
      // 将 Node 请求转换为 Web Request，复用实际 Worker 处理代码。
      const headers = new Headers();
      for (const [name, value] of Object.entries(req.headers)) if (value) headers.set(name, Array.isArray(value) ? value.join(',') : value);
      headers.set('CF-Connecting-IP', req.socket.remoteAddress || '127.0.0.1');
      // 上一行用真实连接地址模拟 Cloudflare 请求头，不信任客户端传来的同名值。
      const options = { method: req.method, headers };
      if (!['GET', 'HEAD'].includes(req.method)) { options.body = req; options.duplex = 'half'; }
      const response = await worker.fetch(new Request(url, options), env);
      res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer())); return;
    }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
    let file = resolve(publicDir, '.' + decodeURIComponent(url.pathname));
    // 只提供构建目录内的文件，拒绝解析后越出目录的路径。
    if (file !== publicDir && !file.startsWith(publicDir + sep)) { res.writeHead(403); res.end(); return; }
    if (statSync(file).isDirectory()) file = resolve(file, 'index.html');
    let bytes = readFileSync(file);
    if (extname(file) === '.html') bytes = Buffer.from(bytes.toString().replace('<body>', '<body><div style="padding:8px 16px;background:#edf3e7;color:#31432c;text-align:center;font:13px/1.6 system-ui">本地演示 · 评论、反馈与排行榜仅供预览，重启后清空</div>'));
    res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : bytes);
  } catch { res.writeHead(404); res.end('Not found'); }
});
// 仅监听本机，避免局域网其他设备访问使用演示凭证的后台。
server.listen(port, '127.0.0.1', () => {
  console.log(`Preview: ${origin}${article}#comments`);
  console.log(`Discuss: ${origin}/discuss/`);
  console.log(`Moderation: ${origin}/admin/comments`);
  console.log(`Local demo key: ${env.COMMENTS_ADMIN_KEY}`);
  console.log('All comments are local demo data. Stop with Ctrl+C.');
});
process.on('SIGINT', () => server.close(() => { DB.sqlite.close(); process.exit(); }));
