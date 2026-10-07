const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function postDir(createdAt, title) {
  const safeTitle = String(title)
    .replace(/[\\/:*?"<>|\s]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `content/posts/${createdAt.slice(0, 10)}-${safeTitle}`;
}

export function postPath(createdAt, title) {
  const directory = postDir(createdAt, title).slice("content/".length).toLowerCase();
  return "/" + directory.split("/").map(encodeURIComponent).join("/") + "/";
}

// Build the article file included in the ZIP download.
export function renderIndexMd(submission, body) {
  const beijingDate = new Date(
    Date.parse(submission.created_at.replace(" ", "T") + "Z") + 8 * 3600 * 1000
  );
  const quote = value => JSON.stringify(String(value));

  return [
    "---",
    `date: '${beijingDate.toISOString().slice(0, 19)}+08:00'`,
    "draft: false",
    `title: ${quote(submission.title)}`,
    `url: ${quote(postPath(submission.created_at, submission.title))}`,
    `author: ${quote(submission.name)}`,
    `categories: ["${MONTHS[beijingDate.getUTCMonth()]}.${beijingDate.getUTCFullYear()}"]`,
    `tags: ${submission.tags || "[]"}`,
    `description: ${quote(submission.description || "")}`,
    "showRelated: false",
    'cover: "cover.png"',
    "---",
    "",
    body,
  ].join("\n");
}
