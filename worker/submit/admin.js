import {
  listSubmissions,
  getSubmission,
  getSubmissionFile,
  markPublished,
} from "./store.js";
import { postDir, postPath, renderIndexMd } from "./render.js";
import { publishArticle } from "./github.js";

export async function handleAdmin(request, env, url) {
  if (!env.ADMIN_KEY) {
    return new Response("ADMIN_KEY is not set", { status: 503 });
  }
  if (request.headers.get("X-Admin-Key") !== env.ADMIN_KEY) {
    return new Response("Unauthorized", { status: 401 });
  }

  const id = url.searchParams.get("id");
  switch (url.pathname) {
    case "/admin/list":
      return listResponse(env);
    case "/admin/post":
      return postResponse(env, id);
    case "/admin/file":
      return fileResponse(env, id, url.searchParams.get("name"));
    case "/admin/publish":
      return publishResponse(request, env, id);
    default:
      return notFound();
  }
}

function notFound() {
  return new Response("Not Found", { status: 404 });
}

async function listResponse(env) {
  const posts = await listSubmissions(env);
  return Response.json(posts.map(post => ({
    ...post,
    commit_url: post.published_commit
      ? `https://github.com/${env.GITHUB_REPO}/commit/${post.published_commit}`
      : "",
    page_url: "https://catrix.net" + postPath(post.created_at, post.title),
  })));
}

async function postResponse(env, id) {
  const record = await getSubmission(env, id);
  if (!record) return notFound();

  const { submission, body, files } = record;
  const indexMd = renderIndexMd(submission, body);
  return Response.json({
    dir: postDir(submission.created_at, submission.title),
    indexMd,
    body,
    meta: {
      title: submission.title,
      author: submission.name,
      date: submission.created_at,
      tags: JSON.parse(submission.tags || "[]"),
      desc: submission.description || "",
    },
    files: [
      { filename: "index.md", size: new TextEncoder().encode(indexMd).length },
      ...files,
    ],
  });
}

async function fileResponse(env, id, filename) {
  const file = await getSubmissionFile(env, id, filename);
  if (!file) return notFound();
  return new Response(file.body, {
    headers: { "Content-Type": file.httpMetadata?.contentType || "application/octet-stream" },
  });
}

async function publishResponse(request, env, id) {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
  }
  const record = await getSubmission(env, id);
  if (!record) return notFound();
  const confirmation = await request.json();
  if (confirmation.title !== record.submission.title) {
    return Response.json({ error: "文章标题不一致。" }, { status: 400 });
  }
  if (record.submission.approved) {
    return Response.json({ error: "这篇文章已经发布。" }, { status: 409 });
  }
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) {
    return Response.json({ error: "请先配置 GITHUB_TOKEN 和 GITHUB_REPO。" }, { status: 503 });
  }

  const commit = await publishArticle(env, record);
  await markPublished(env, id, commit.sha);
  return Response.json({ ok: true, commit: commit.sha, url: commit.url });
}
