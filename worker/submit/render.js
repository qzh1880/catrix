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

export function findCoverFilename(files = []) {
  const filenames = files.map(file => (typeof file === "string" ? file : file?.filename || file?.name || ""));
  const images = filenames.filter(name => /\.(jpe?g|png|webp|gif)$/i.test(name));
  if (images.length === 1) return images[0];
  const cover = images.find(name => {
    const stem = name.replace(/\.[^/.]+$/, "").toLowerCase();
    return stem === "cover";
  });
  return cover || images[0] || "cover.png";
}

// Build the article file included in the ZIP download.
export function renderIndexMd(submission, body, files = []) {
  const beijingDate = new Date(
    Date.parse(submission.created_at.replace(" ", "T") + "Z") + 8 * 3600 * 1000
  );
  const quote = value => JSON.stringify(String(value));
  const cover = findCoverFilename(files);

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
    `cover: ${quote(cover)}`,
    "---",
    "",
    body,
  ].join("\n");
}
