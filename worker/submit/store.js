export async function saveSubmission(env, data) {
  if (data.files.some(file => !(file instanceof File) || file.size === 0 || !/\.(md|docx?|jpe?g|png|webp|gif)$/i.test(file.name))) {
    throw new Error("只支持非空的 Markdown、Word（.doc / .docx）及图片（PNG、JPG、JPEG、WebP、GIF）文件。");
  }
  if (data.files.length > 20 || data.files.reduce((size, file) => size + file.size, 0) > 20 * 1024 * 1024) {
    throw new Error("最多上传 20 个文件，合计不超过 20 MB。");
  }
  if (data.files.some(file => !file.name || /[\\/]/.test(file.name))) {
    throw new Error("文件名不能包含目录路径。");
  }
  const filenames = data.files.map(file => file.name);
  if (new Set(filenames.map(name => name.toLowerCase())).size !== filenames.length) {
    throw new Error("文件名不能重复。");
  }
  const docFiles = filenames.filter(name => /\.(md|docx?)$/i.test(name));
  if (docFiles.length !== 1) {
    throw new Error("请上传一个 Markdown 或 Word（.doc / .docx）正文文件。");
  }
  const isWord = /\.(docx?)$/i.test(docFiles[0]);
  const imageFiles = filenames.filter(name => /\.(jpe?g|png|webp|gif)$/i.test(name));
  if (!isWord && imageFiles.length === 0) {
    throw new Error("最少上传一张照片作为封面。");
  }
  if (imageFiles.length > 1) {
    const coverImages = imageFiles.filter(name => {
      const stem = name.replace(/\.[^/.]+$/, "").toLowerCase();
      return stem === "cover";
    });
    if (coverImages.length === 0) {
      throw new Error("多张照片时，请将封面图片命名为 cover。");
    }
    if (coverImages.length > 1) {
      throw new Error("只能有一张封面图片命名为 cover。");
    }
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
  let body = "";
  if (markdownFile) {
    const markdown = await env.IMAGES.get(submission.r2_prefix + markdownFile.filename);
    if (markdown) {
      body = await markdown.text();
    }
  }

  const wordFile = files.find(file => /\.(docx?)$/i.test(file.filename));

  return {
    submission,
    hasMarkdown: Boolean(markdownFile),
    hasWord: Boolean(wordFile),
    markdownFile: markdownFile ? markdownFile.filename : null,
    wordFile: wordFile ? wordFile.filename : null,
    body: markdownFile ? body : null,
    files: markdownFile ? files.filter(file => file !== markdownFile) : files,
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
