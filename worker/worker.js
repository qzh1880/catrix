import { handleAdmin } from "./admin.js";
import { saveSubmission } from "./store.js";
import { handleComments } from "./comments.js";

const ALLOWED_SITES = ["https://catrix.net", "http://localhost:1313"];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // 评论路由要先于通用 /admin 分发，以便使用独立的评论审核鉴权。
    if (url.pathname === "/comments" || url.pathname === "/admin/comments" || url.pathname.startsWith("/admin/comments/")) {
      return handleComments(request, env, url);
    }
    if (url.pathname.startsWith("/admin")) {
      return handleAdmin(request, env, url);
    }
    return handleSubmission(request, env, url);
  },
};

async function handleSubmission(request, env, url) {
  const origin = request.headers.get("Origin") || "";
  const cors = {
    "Access-Control-Allow-Origin": ALLOWED_SITES.includes(origin) ? origin : "",
    Vary: "Origin",
  };
  if (request.method !== "POST") return new Response("Not Found", { status: 404 });

  const form = await request.formData();
  const data = {
    name: form.get("name"),
    contact: form.get("contact"),
    title: form.get("title"),
    tags: form.get("tags") || "",
    files: form.getAll("files"),
    description: String(form.get("description") || "").slice(0, 1000),
  };

  const row = await saveSubmission(env, data);
  console.log("已入库 #" + row.meta.last_row_id + "：" + data.title);

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
