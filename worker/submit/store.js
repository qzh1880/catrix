export async function saveSubmission(env, data) {
  if (data.files.some(file => !(file instanceof File) || file.size === 0 || !/\.(md|jpe?g|png|webp)$/i.test(file.name))) {
    throw new Error("只支持非空的 Markdown、JPG、PNG 或 WebP 文件。");
  }
  if (data.files.length > 5 || data.files.reduce((size, file) => size + file.size, 0) > 3 * 1024 * 1024) {
    throw new Error("最多上传 5 个文件，合计不超过 3 MB。");
  }
  if (data.files.some(file => !file.name || /[\\/]/.test(file.name))) {
    throw new Error("文件名不能包含目录路径。");
  }
  const filenames = data.files.map(file => file.name.toLowerCase() === "cover.png" ? "cover.png" : file.name);
  if (new Set(filenames.map(name => name.toLowerCase())).size !== filenames.length) {
    throw new Error("文件名不能重复。");
  }
  if (filenames.filter(name => name.toLowerCase().endsWith(".md")).length !== 1) {
    throw new Error("请上传一个 Markdown 正文文件。");
  }
  if (!filenames.includes("cover.png")) {
    throw new Error("请上传 cover.png 封面。");
  }

  const prefix = `submissions/${crypto.randomUUID()}/`;
  const tags = data.tags.split(",").map(tag => tag.trim()).filter(Boolean);
  try {
    for (const [index, file] of data.files.entries()) {
      await env.IMAGES.put(prefix + filenames[index], file.stream(), {
        httpMetadata: { contentType: file.type || "application/octet-stream" },
      });
    }
    await env.DB.prepare(
      "INSERT INTO submissions (name, contact, title, tags, description, r2_prefix) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(data.name, data.contact, data.title, JSON.stringify(tags), data.description, prefix).run();
  } catch (error) {
    await env.IMAGES.delete(filenames.map(name => prefix + name));
    throw error;
  }
}

export async function listSubmissions(env) {
  const result = await env.DB.prepare(
    "SELECT id, name, title, tags, approved, published_commit, created_at FROM submissions ORDER BY id DESC"
  ).all();
  return result.results;
}

export async function getSubmission(env, id) {
  const submission = await env.DB.prepare(
    "SELECT * FROM submissions WHERE id = ?"
  ).bind(id).first();
  if (!submission || !submission.r2_prefix) return null;

  const result = await env.IMAGES.list({ prefix: submission.r2_prefix });
  const files = result.objects.map(file => ({
    filename: file.key.slice(submission.r2_prefix.length),
    size: file.size,
  }));
  const markdownFile = files.find(file => file.filename.toLowerCase().endsWith(".md"));
  if (!markdownFile) return null;
  const markdown = await env.IMAGES.get(submission.r2_prefix + markdownFile.filename);
  if (!markdown) return null;

  return {
    submission,
    body: await markdown.text(),
    files: files.filter(file => file !== markdownFile),
  };
}

export async function getSubmissionFile(env, id, filename) {
  if (!filename || /[\\/]/.test(filename)) return null;
  const submission = await env.DB.prepare(
    "SELECT r2_prefix FROM submissions WHERE id = ?"
  ).bind(id).first();
  if (!submission?.r2_prefix) return null;
  return env.IMAGES.get(submission.r2_prefix + filename);
}

export async function markPublished(env, id, commit) {
  await env.DB.prepare(
    "UPDATE submissions SET approved = 1, published_commit = ? WHERE id = ?"
  ).bind(commit, id).run();
}
