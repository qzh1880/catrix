import { getSubmission } from "./store.js";
import { ADMIN_HTML, PREVIEW_HTML } from "./admin-page.js";
import { postDir, renderIndexMd } from "./render.js";

const ADMIN_KEY = "guesswhat?";

export async function handleAdmin(request, env, url) {
  if (url.pathname === "/admin") return page(ADMIN_HTML);
  if (url.pathname === "/admin/preview") return page(PREVIEW_HTML);
  if (request.headers.get("X-Admin-Key") !== ADMIN_KEY) return notFound();  // 数据接口：密码走请求头
  switch (url.pathname) {
    case "/admin/list":    return Response.json(await listAll(env));
    case "/admin/post":    return detail(env, url.searchParams.get("id"));
    case "/admin/file":    return fileOf(env, url.searchParams.get("id"), url.searchParams.get("name"));
    case "/admin/approve": return approve(env, url.searchParams.get("id"));
    // case "/admin/reject":  return reject(env, url.searchParams.get("id"));
    default:               return notFound();
  }
}

function notFound() { return new Response("Not Found", { status: 404 }); }
function page(html) { return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } }); }

async function listAll(env) {
  return (await env.DB.prepare(
    "SELECT id, name, title, tags, approved, created_at FROM submissions ORDER BY id DESC"
  ).all()).results;
}

async function detail(env, id) {
  const d = await getSubmission(env, id);
  if (!d) return notFound();
  const enc = new TextEncoder();
  const files = [
    { filename: "index.md", size: enc.encode(d.body).length },
    ...d.images.map(r => ({ filename: r.filename, size: r.content.length })),
  ];
  return Response.json({
    dir: postDir(d.sub.created_at, d.sub.title),
    indexMd: renderIndexMd(d.sub, d.body),
    body: d.body,
    meta: {
      title: d.sub.title,
      author: d.sub.name,
      date: d.sub.created_at,
      tags: JSON.parse(d.sub.tags || "[]"),
      desc: d.sub.description || "",
    },
    files,
  });
}

async function fileOf(env, id, name) {
  const row = await env.DB.prepare(
    "SELECT content FROM submission_files WHERE submission_id = ? AND filename = ?"
  ).bind(id, name).first();
  if (!row) return notFound();
  const types = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg" };
  return new Response(new Uint8Array(row.content), {
    headers: { "Content-Type": types[name.split(".").pop().toLowerCase()] || "application/octet-stream" },
  });
}

async function approve(env, id) {
  await env.DB.prepare("UPDATE submissions SET approved = 1 WHERE id = ?").bind(id).run();
  return Response.json({ ok: true });
}

async function reject(env, id) {
  await env.DB.prepare("UPDATE submissions SET approved = 0 WHERE id = ?").bind(id).run();
  return Response.json({ ok: true });
}