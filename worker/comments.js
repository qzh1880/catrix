import { COMMENTS_ADMIN_HTML } from "./comments-admin.js";

// 评论后台：公开接口负责读取、提交；管理接口负责查看队列和修改审核状态。
// env.DB 是 D1 绑定；审核密钥和限流盐值由部署环境提供，不能放入前端。
const STATUSES = new Set(["pending", "approved", "rejected"]);
const encoder = new TextEncoder();
// 不缓存接口结果，使刷新后的公开列表能及时反映审核和隐藏操作。
const json = (body, status = 200, headers = {}) => Response.json(body, {
  status,
  headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers },
});

function origins(env) {
  // 可填写多个逗号分隔的来源，便于为正式站点和测试站点分别开放跨域请求。
  return (env.COMMENTS_ALLOWED_ORIGINS || "https://catrix.net").split(",").map(s => s.trim()).filter(Boolean);
}

// 以文章路径关联留言，不使用域名、查询参数或锚点。
// 此处只校验默认的单层 /posts/<slug>/ 格式，不验证文章是否真实存在。
export function validArticle(value) {
  return typeof value === "string" && value.length <= 500 &&
    /^\/posts\/(?:[A-Za-z0-9_~-]|%[A-Fa-f0-9]{2})+\/$/.test(value);
}

async function readJson(request) {
  // 同时检查声明大小和实际读取字节数，避免缺失或不准确的 Content-Length 绕过限制。
  if (request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw { status: 415, message: "请使用 JSON 提交。" };
  }
  if (Number(request.headers.get("Content-Length")) > 16384) throw { status: 413, message: "提交内容过大。" };
  const reader = request.body?.getReader();
  if (!reader) throw { status: 400, message: "缺少提交内容。" };
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 16384) {
      await reader.cancel();
      throw { status: 413, message: "提交内容过大。" };
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try {
    const data = JSON.parse(new TextDecoder().decode(bytes));
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error();
    return data;
  } catch { throw { status: 400, message: "提交格式不正确。" }; }
}

async function sameSecret(received, expected) {
  // 先得到等长摘要，再比较所有字节，避免字符串比较遇到首个差异就提前返回。
  const [a, b] = await Promise.all([received, expected].map(s => crypto.subtle.digest("SHA-256", encoder.encode(s))));
  const left = new Uint8Array(a), right = new Uint8Array(b);
  let mismatch = 0;
  for (let i = 0; i < left.length; i++) mismatch |= left[i] ^ right[i];
  return mismatch === 0;
}

function beforeId(url) {
  // 游标是上一页最后一条留言的 ID；后续查询只读取更早的记录。
  const value = url.searchParams.get("before");
  if (value === null) return Number.MAX_SAFE_INTEGER;
  const id = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(id) || id < 1) throw { status: 400, message: "分页参数不正确。" };
  return id;
}

// 举报和留言使用不同限流桶，举报不会耗尽读者的留言配额。
async function reportComment(request, env, data, reply) {
  if (!Number.isSafeInteger(data.id) || data.id < 1 || !validArticle(data.article) ||
      !['spam', 'abuse', 'privacy', 'other'].includes(data.reason)) return reply({ error: "举报参数不正确。" }, 400);
  const target = await env.DB.prepare("SELECT id FROM comments WHERE id = ? AND article = ? AND status = 'approved' AND body != ''").bind(data.id, data.article).first();
  if (!target) return reply({ error: "评论不存在或已删除。" }, 404);
  const ip = request.headers.get('CF-Connecting-IP');
  if (!ip || !env.COMMENTS_RATE_SALT || env.COMMENTS_RATE_SALT.length < 32) return reply({ error: "举报服务尚未配置。" }, 503);
  const now = Math.floor(Date.now() / 1000), window = Math.floor(now / 600);
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(`${env.COMMENTS_RATE_SALT}:report:${window}:${ip}`));
  const bucket = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
  const exists = await env.DB.prepare('SELECT id FROM comment_reports WHERE comment_id = ? AND reporter_bucket = ?').bind(data.id, bucket).first();
  if (exists) return reply({ ok: true, message: '举报已收到，请等待管理员处理。' });
  await env.DB.prepare('DELETE FROM comment_rate_limits WHERE expires_at < ?').bind(now).run();
  const limit = await env.DB.prepare('INSERT INTO comment_rate_limits (bucket, count, expires_at) VALUES (?, 1, ?) ON CONFLICT(bucket) DO UPDATE SET count = count + 1 WHERE count < ? RETURNING count').bind(bucket, (window + 1) * 600, 10).first();
  if (!limit) return reply({ error: '举报较频繁，请稍后再试。' }, 429, { 'Retry-After': String((window + 1) * 600 - now) });
  // SQL 再检查目标状态，避免管理员同时删除后仍插入新的举报。
  await env.DB.prepare("INSERT INTO comment_reports (comment_id, reporter_bucket, reason) SELECT id, ?, ? FROM comments WHERE id = ? AND status = 'approved' AND body != '' ON CONFLICT(comment_id, reporter_bucket) DO NOTHING").bind(bucket, data.reason, data.id).run();
  return reply({ ok: true, message: '举报已收到，请等待管理员处理。' }, 201);
}

export async function handleComments(request, env, url = new URL(request.url)) {
  const admin = url.pathname.startsWith("/admin/comments");
  const origin = request.headers.get("Origin");
  const allowed = origins(env).includes(origin);
  // CORS 用于约束浏览器跨域访问，并不能替代管理接口的密钥鉴权。
  const cors = !admin && allowed ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {};
  const reply = (body, status = 200, extra = {}) => json(body, status, { ...cors, ...extra });
  try {
    if (url.pathname === "/admin/comments" && request.method === "GET") {
      // 审核页面本身不含私有数据；读取队列和修改状态仍需下方的密钥校验。
      return new Response(COMMENTS_ADMIN_HTML, { headers: {
        "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer",
        "Content-Security-Policy": "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
      } });
    }
    if (!admin && origin && !allowed) return reply({ error: "此来源未开放评论接口。" }, 403);
    if (!admin && request.method === "OPTIONS") {
      // JSON 跨域提交前，浏览器会先发送 OPTIONS，询问允许的方法和请求头。
      return new Response(null, { status: 204, headers: {
        ...cors, "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "600",
      } });
    }
    if (!env.DB) return reply({ error: "评论服务尚未配置。" }, 503);
    if (admin) {
      // 评论审核使用独立 Secret；缺失配置时拒绝访问，不回退到原投稿后台的凭证。
      if (!env.COMMENTS_ADMIN_KEY || env.COMMENTS_ADMIN_KEY.length < 32) return reply({ error: "评论审核尚未配置。" }, 503);
      const key = request.headers.get("X-Comments-Key") || "";
      if (key.length > 512 || !await sameSecret(key, env.COMMENTS_ADMIN_KEY)) return reply({ error: "审核凭证不正确。" }, 401);
      if (url.pathname === "/admin/comments/list" && request.method === "GET") {
        const status = url.searchParams.get("status") || "approved";
        if (!STATUSES.has(status) && status !== "reported") return reply({ error: "审核状态不正确。" }, 400);
        const rows = status === 'reported'
          ? (await env.DB.prepare("SELECT c.id, c.article, c.nickname, c.body, c.status, c.created_at, COUNT(r.id) AS report_count, GROUP_CONCAT(DISTINCT r.reason) AS report_reasons FROM comments c JOIN comment_reports r ON r.comment_id = c.id AND r.status = 'pending' WHERE c.body != '' AND c.id < ? GROUP BY c.id ORDER BY c.id DESC LIMIT 31").bind(beforeId(url)).all()).results
          : (await env.DB.prepare("SELECT id, article, nickname, body, status, created_at FROM comments WHERE status = ? AND body != '' AND id < ? ORDER BY id DESC LIMIT 31").bind(status, beforeId(url)).all()).results;
        // 多取一条判断是否还有下一页；额外那条留给下次请求返回。
        return reply({ comments: rows.slice(0, 30), next: rows.length > 30 ? rows[29].id : null });
      }
      if (url.pathname === '/admin/comments/resolve-reports' && request.method === 'POST') {
        const data = await readJson(request);
        if (!Number.isSafeInteger(data.id) || data.id < 1) return reply({ error: '评论编号不正确。' }, 400);
        await env.DB.prepare("UPDATE comment_reports SET status = 'resolved' WHERE comment_id = ?").bind(data.id).run();
        return reply({ ok: true });
      }
      if (url.pathname === "/admin/comments/delete" && request.method === "POST") {
        const data = await readJson(request);
        if (!Number.isSafeInteger(data.id) || data.id < 1) return reply({ error: "评论编号不正确。" }, 400);
        // 清除用户内容，保留提交标识作为删除记录，防止超时重试重新发布。
        const result = await env.DB.prepare("UPDATE comments SET nickname = '', body = '', status = 'rejected' WHERE id = ?").bind(data.id).run();
        await env.DB.prepare("UPDATE comment_reports SET status = 'resolved' WHERE comment_id = ?").bind(data.id).run();
        return result.meta.changes ? reply({ ok: true }) : reply({ error: "评论不存在。" }, 404);
      }
      if (url.pathname === "/admin/comments/moderate" && request.method === "POST") {
        // 审核仅修改状态，隐藏后仍可恢复；使用 POST 避免访问链接就改变数据。
        const data = await readJson(request);
        if (!Number.isSafeInteger(data.id) || data.id < 1 || !STATUSES.has(data.status)) return reply({ error: "审核参数不正确。" }, 400);
        const result = await env.DB.prepare("UPDATE comments SET status = ? WHERE id = ? AND body != ''").bind(data.status, data.id).run();
        return result.meta.changes ? reply({ ok: true }) : reply({ error: "评论不存在。" }, 404);
      }
      return reply({ error: "接口或请求方法不正确。" }, 405);
    }
    if (request.method === "GET") {
      // 公开查询在 SQL 层限制为 approved，绝不把待审核留言交给前端自行过滤。
      const article = url.searchParams.get("article");
      if (!validArticle(article)) return reply({ error: "文章地址不正确。" }, 400);
      const rows = (await env.DB.prepare(
        "SELECT c.id, c.nickname, c.body, c.created_at, c.parent_id, CASE WHEN p.status = 'approved' AND p.body != '' THEN p.nickname ELSE NULL END AS parent_nickname, CASE WHEN p.status = 'approved' AND p.body != '' THEN substr(p.body, 1, 120) ELSE NULL END AS parent_body FROM comments c LEFT JOIN comments p ON p.id = c.parent_id WHERE c.article = ? AND c.status = 'approved' AND c.id < ? ORDER BY c.id DESC LIMIT 21"
      ).bind(article, beforeId(url)).all()).results;
      return reply({ comments: rows.slice(0, 20), next: rows.length > 20 ? rows[19].id : null });
    }
    if (request.method !== "POST") return reply({ error: "请求方法不正确。" }, 405, { Allow: "GET, POST, OPTIONS" });
    if (!allowed) return reply({ error: "请从网站文章页提交评论。" }, 403);
    const data = await readJson(request);
    if (data.action === 'report') return await reportComment(request, env, data, reply);
    if (data.action && data.action !== 'comment') return reply({ error: '请求操作不正确。' }, 400);
    const parentId = data.parentId ?? null;
    if (parentId !== null && (!Number.isSafeInteger(parentId) || parentId < 1)) return reply({ error: '回复目标不正确。' }, 400);
    // 浏览器表单校验可以被绕过，因此服务端还要检查字段类型、长度和控制字符。
    const nickname = typeof data.nickname === "string" ? data.nickname.trim() : "";
    const body = typeof data.body === "string" ? data.body.trim() : "";
    if (!validArticle(data.article) || !nickname || nickname.length > 40 || body.length < 2 || body.length > 2000 ||
        /[\r\n\x00-\x1f\x7f]/.test(nickname) || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(body) ||
        typeof data.requestId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.requestId)) {
      return reply({ error: "请填写 1–40 字符昵称及 2–2000 字符评论。" }, 400);
    }
    const existing = await env.DB.prepare("SELECT article, nickname, body, parent_id FROM comments WHERE request_id = ?").bind(data.requestId).first();
    // 超时重试可能发生在数据库已成功写入之后；相同标识、相同内容直接返回回执。
    // 此检查放在限流前，正常重试不重复扣除配额。
    if (existing) {
      if (existing.body === "") return reply({ error: "这条评论已被管理员删除。" }, 410);
      if (existing.article !== data.article || existing.nickname !== nickname || existing.body !== body || existing.parent_id !== parentId) return reply({ error: "请重新提交。" }, 409);
      return reply({ ok: true, message: "评论已提交，请查看留言列表。" });
    }
    // 仅允许回复同一文章的公开顶层留言，禁止跨文章关联或形成多层嵌套。
    if (parentId !== null) {
      const parent = await env.DB.prepare("SELECT id FROM comments WHERE id = ? AND article = ? AND parent_id IS NULL AND status = 'approved' AND body != ''").bind(parentId, data.article).first();
      if (!parent) return reply({ error: '原留言已删除或无法回复，请取消回复后重试。' }, 409);
    }
    const ip = request.headers.get("CF-Connecting-IP");
    // 线上由 Cloudflare 提供客户端 IP；本地预览脚本用连接地址模拟该请求头。
    if (!ip || !env.COMMENTS_RATE_SALT || env.COMMENTS_RATE_SALT.length < 32) return reply({ error: "评论服务尚未配置完整。" }, 503);
    const now = Math.floor(Date.now() / 1000);
    const window = Math.floor(now / 600);
    // 使用固定的 10 分钟窗口。同一校园出口可能共享 IP，因此允许维护者调整配额。
    const quota = Number(env.COMMENTS_RATE_LIMIT || 20);
    if (!Number.isSafeInteger(quota) || quota < 1 || quota > 1000) return reply({ error: "评论服务配置不正确。" }, 503);
    const hash = await crypto.subtle.digest("SHA-256", encoder.encode(`${env.COMMENTS_RATE_SALT}:${window}:${ip}`));
    // 数据库只存带盐值和时间窗口的哈希，不存原始 IP；新提交时顺便清理过期计数。
    const bucket = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, "0")).join("");
    await env.DB.prepare("DELETE FROM comment_rate_limits WHERE expires_at < ?").bind(now).run();
    const limit = await env.DB.prepare(
      // 在一条 SQL 中检查并增加计数，避免并发请求通过“先读后写”超出配额。
      "INSERT INTO comment_rate_limits (bucket, count, expires_at) VALUES (?, 1, ?) ON CONFLICT(bucket) DO UPDATE SET count = count + 1 WHERE count < ? RETURNING count"
    ).bind(bucket, (window + 1) * 600, quota).first();
    if (!limit) return reply({ error: "提交较频繁，请稍后再试。" }, 429, { "Retry-After": String((window + 1) * 600 - now) });
    await env.DB.prepare(
      // 唯一约束处理并发重试；显式写入 approved，新旧数据库均直接公开新留言。
      "INSERT INTO comments (request_id, article, nickname, body, status, parent_id) SELECT ?, ?, ?, ?, 'approved', ? WHERE ? IS NULL OR EXISTS (SELECT 1 FROM comments WHERE id = ? AND article = ? AND parent_id IS NULL AND status = 'approved' AND body != '') ON CONFLICT(request_id) DO NOTHING"
    ).bind(data.requestId, data.article, nickname, body, parentId, parentId, parentId, data.article).run();
    // 并发重试、父留言删除可能与写入交错，按最终数据库状态给出回执。
    const saved = await env.DB.prepare('SELECT article, nickname, body, parent_id FROM comments WHERE request_id = ?').bind(data.requestId).first();
    if (!saved) return reply({ error: '原留言已删除或无法回复。' }, 409);
    if (saved.body === '') return reply({ error: '这条评论已被管理员删除。' }, 410);
    if (saved.article !== data.article || saved.nickname !== nickname || saved.body !== body || saved.parent_id !== parentId) return reply({ error: '请重新提交。' }, 409);
    return reply({ ok: true, message: "评论已提交，请查看留言列表。" }, 201);
  } catch (error) {
    // 已知输入错误给出明确提示；数据库等内部错误统一返回通用消息，不泄露细节。
    return reply({ error: error?.status ? error.message : "评论服务暂时不可用，请稍后再试。" }, error?.status || 503);
  }
}
