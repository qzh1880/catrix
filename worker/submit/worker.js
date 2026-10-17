import { handleAdmin } from "./admin.js";
import { saveSubmission } from "./store.js";

const ALLOWED_SITES = [
  "https://catrix.net",
  "http://localhost:1313",
  "http://127.0.0.1:1313",
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const cors = {
      "Access-Control-Allow-Origin": ALLOWED_SITES.includes(origin) ? origin : "",
      "Access-Control-Allow-Headers": "Content-Type, X-Admin-Key",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      Vary: "Origin",
    };

    // The browser checks CORS before sending some requests.
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    let response;
    try {
      response = url.pathname.startsWith("/admin")
        ? await handleAdmin(request, env, url)
        : await handleSubmission(request, env);
    } catch (error) {
      console.error(error);
      response = Response.json({ error: error.message || "请求失败。" }, { status: 500 });
    }

    // Both handlers share the same CORS headers.
    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(cors)) {
      headers.set(name, value);
    }
    return new Response(response.body, { status: response.status, headers });
  },
};

async function handleSubmission(request, env) {
  if (request.method !== "POST") {
    return new Response("Not Found", { status: 404 });
  }

  const form = await request.formData();
  await saveSubmission(env, {
    name: form.get("name"),
    contact: form.get("contact"),
    title: form.get("title"),
    tags: form.get("tags") || "",
    description: String(form.get("description") || "").slice(0, 1000),
    files: form.getAll("files"),
  });

  return Response.json({ ok: true });
}
