import { handleComments } from "./comments.js";

// 独立部署评论服务，只开放评论及其审核路由。
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (
      url.pathname === "/comments" ||
      url.pathname === "/admin/comments" ||
      url.pathname.startsWith("/admin/comments/")
    ) {
      return handleComments(request, env, url);
    }
    return new Response("Not Found", { status: 404 });
  },
};
