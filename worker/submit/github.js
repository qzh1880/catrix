import { postDir, renderIndexMd } from "./render.js";

// Read main, prepare the files, then publish one commit.
export async function publishArticle(env, { submission, body, files }) {
  // 1. Start from the latest main.
  const main = await github(env, "/commits/main");
  const directory = postDir(submission.created_at, submission.title);

  // 2. Add the Markdown text and upload the images.
  const entries = [{
    path: `${directory}/index.md`,
    mode: "100644",
    type: "blob",
    content: renderIndexMd(submission, body),
  }];
  for (const file of files) {
    const object = await env.IMAGES.get(submission.r2_prefix + file.filename);
    if (!object) throw new Error(`R2 文件不存在：${file.filename}`);
    const blob = await github(env, "/git/blobs", "POST", {
      content: base64(await object.arrayBuffer()),
      encoding: "base64",
    });
    entries.push({ path: `${directory}/${file.filename}`, mode: "100644", type: "blob", sha: blob.sha });
  }

  // 3. Create the commit and update main.
  const tree = await github(env, "/git/trees", "POST", {
    base_tree: main.commit.tree.sha,
    tree: entries,
  });
  const commit = await github(env, "/git/commits", "POST", {
    message: `auto: 发布：${submission.title}`,
    tree: tree.sha,
    parents: [main.sha],
  });

  // Refuse to overwrite changes made to main while we were publishing.
  await github(env, "/git/refs/heads/main", "PATCH", { sha: commit.sha, force: false });
  return { sha: commit.sha, url: `https://github.com/${env.GITHUB_REPO}/commit/${commit.sha}` };
}

async function github(env, path, method = "GET", data) {
  const response = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "catrix-submit",
      "X-GitHub-Api-Version": "2026-03-10",
    },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok) {
    const message = path === "/commits/main" && [409, 422].includes(response.status)
      ? "main 分支不存在或没有提交。请先在 GitHub 创建 main，或将已有分支重命名为 main。"
      : result.message || response.statusText;
    throw new Error(`GitHub ${response.status}：${message}`);
  }
  return result;
}

function base64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary);
}
