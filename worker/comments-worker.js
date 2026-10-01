import { handleCommunity } from "./community.js";
import { handleComments } from "./comments.js";

// 部署评论与社区服务，明确分发评论、点赞、反馈及排行榜路由。
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/community/")) return handleCommunity(request, env, url);
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
