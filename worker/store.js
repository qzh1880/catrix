export async function saveSubmission(env, data) {
  const tagList = data.tags.split(",").map(t => t.trim()).filter(Boolean);
  const row = await env.DB.prepare(
    "INSERT INTO submissions (name, contact, title, tags, description) VALUES (?, ?, ?, ?, ?)"
  ).bind(data.name, data.contact, data.title, JSON.stringify(tagList), data.description || "").run();
  for (const file of data.files) {
    await env.DB.prepare(
      "INSERT INTO submission_files (submission_id, filename, content) VALUES (?, ?, ?)"
    ).bind(row.meta.last_row_id, file.name, await file.arrayBuffer()).run();
  }
  return row;
}

export async function getSubmission(env, id) {
  const sub = await env.DB.prepare(
    "SELECT id, name, title, tags, description, created_at FROM submissions WHERE id = ?"
  ).bind(id).first();
  if (!sub) return null;
  const rows = (await env.DB.prepare(
    "SELECT filename, content FROM submission_files WHERE submission_id = ?"
  ).bind(id).all()).results;
  const mdRow = rows.find(r => r.filename.toLowerCase().endsWith(".md"));
  if (!mdRow) return null;
  return {
    sub,
    body: new TextDecoder().decode(new Uint8Array(mdRow.content)),
    images: rows.filter(r => r !== mdRow),
  };
}