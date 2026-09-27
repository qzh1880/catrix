export function postDir(createdAt, title) {
  const safe = String(title).replace(/[\\/:*?"<>|\s]+/g, "-").replace(/^-+|-+$/g, "");
  return `content/posts/${createdAt.slice(0, 10)}-${safe}`;
}

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function renderIndexMd(sub, body) {
  const bj = new Date(Date.parse(sub.created_at.replace(" ", "T") + "Z") + 8 * 3600 * 1000);
  const esc = s => String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return [
    "---",
    `date: '${bj.toISOString().slice(0, 19)}+08:00'`,
    "draft: false",
    `title: "${esc(sub.title)}"`,
    `author: "${esc(sub.name)}"`,
    `categories: ["${MON[bj.getUTCMonth()]}.${bj.getUTCFullYear()}"]`,
    `tags: ${sub.tags || "[]"}`,
    `description: "${esc(sub.description || "")}"`,
    "showRelated: false",
    'cover: "cover.png"',
    "---",
    "",
    body,
  ].join("\n");
}