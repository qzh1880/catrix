import { replay, periodStart, rules } from './rankings.js';

const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const json = (data,status=200,headers={}) => Response.json(data,{status,headers:{'Cache-Control':'no-store',...headers}});
async function digest(value) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),n=>n.toString(16).padStart(2,'0')).join(''); }
async function read(request) {
  if (request.headers.get('Content-Type')?.split(';')[0].trim() !== 'application/json') throw {status:415,message:'请使用 JSON 提交。'};
  const reader = request.body?.getReader(); if (!reader) throw {status:400,message:'缺少内容。'};
  let size=0; const chunks=[];
  while(true) { const {value,done}=await reader.read(); if(done)break; size+=value.length; if(size>300000){await reader.cancel();throw {status:413,message:'提交内容过大。'};} chunks.push(value); }
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  try { const data=JSON.parse(new TextDecoder().decode(bytes));if(!data||typeof data!=='object'||Array.isArray(data))throw Error();return data; } catch {throw {status:400,message:'提交格式不正确。'};}
}
async function limit(request,env,scope,quota) {
  const ip=request.headers.get('CF-Connecting-IP');
  if(!ip)throw {status:503,message:'服务尚未配置完整。'};
  const now=Math.floor(Date.now()/1000),window=Math.floor(now/600);
  const bucket=await digest(`${env.COMMENTS_RATE_SALT}:${scope}:${window}:${ip}`);
  await env.DB.prepare('DELETE FROM comment_rate_limits WHERE expires_at < ?').bind(now).run();
  const row=await env.DB.prepare('INSERT INTO comment_rate_limits (bucket,count,expires_at) VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1 WHERE count < ? RETURNING count').bind(bucket,(window+1)*600,quota).first();
  if(!row)throw {status:429,message:'操作较频繁，请稍后再试。'};
}

export async function handleCommunity(request,env,url=new URL(request.url)) {
  const origin=request.headers.get('Origin');
  const allowed=(env.COMMENTS_ALLOWED_ORIGINS||'https://catrix.net').split(',').map(s=>s.trim()).includes(origin);
  const cors=allowed?{'Access-Control-Allow-Origin':origin,Vary:'Origin'}:{};
  const reply=(data,status=200)=>json(data,status,cors);
  try {
    if(origin&&!allowed)return reply({error:'此来源未开放。'},403);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...cors,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, X-Comments-Key'}});
    if(!env.DB||!env.COMMENTS_RATE_SALT||env.COMMENTS_RATE_SALT.length<32)return reply({error:'服务尚未配置完整。'},503);
    if(request.method==='GET') {
      if(url.pathname==='/community/feedback') {
        const page=Number(url.searchParams.get('page')||1);
        if(!Number.isSafeInteger(page)||page<1||page>10000)return reply({error:'页码不正确。'},400);
        const rows=(await env.DB.prepare("SELECT f.id,f.nickname,f.body,f.created_at,COUNT(l.voter) AS likes FROM feedback f LEFT JOIN community_likes l ON l.kind='feedback' AND l.target_id=f.id WHERE f.deleted=0 GROUP BY f.id ORDER BY likes DESC,f.id DESC LIMIT 21 OFFSET ?").bind((page-1)*20).all()).results;
        return reply({items:rows.slice(0,20),more:rows.length>20});
      }
      if(url.pathname==='/community/likes') {
        const kind=url.searchParams.get('kind'); const ids=(url.searchParams.get('ids')||'').split(',').map(Number);
        if(!['comment','feedback'].includes(kind)||ids.length>20||ids.some(id=>!Number.isSafeInteger(id)||id<1))return reply({error:'点赞目标不正确。'},400);
        const visitor=url.searchParams.get('visitor');const voter=uuid(visitor)?await digest(`${env.COMMENTS_RATE_SALT}:visitor:${visitor}`):'';
        const rows=(await env.DB.prepare(`SELECT target_id,COUNT(*) AS likes,MAX(CASE WHEN voter=? THEN 1 ELSE 0 END) AS liked FROM community_likes WHERE kind=? AND target_id IN (${ids.map(()=>'?').join(',')}) GROUP BY target_id`).bind(voter,kind,...ids).all()).results;
        return reply({items:rows});
      }
      if(url.pathname==='/community/rankings') {
        const start=periodStart(url.searchParams.get('period')||'week');
        const rows=(await env.DB.prepare('SELECT nickname,score,lines,finished_at FROM (SELECT *,ROW_NUMBER() OVER (PARTITION BY player ORDER BY score DESC,finished_at ASC,session_id ASC) AS n FROM ranked_scores WHERE finished_at >= ?) WHERE n=1 ORDER BY score DESC,finished_at ASC,session_id ASC LIMIT 50').bind(start).all()).results;
        return reply({items:rows,timezone:'Asia/Shanghai',version:rules.VERSION});
      }
      return reply({error:'接口不存在。'},404);
    }
    if(request.method!=='POST')return reply({error:'请求方法不正确。'},405);
    if(!allowed)return reply({error:'请从网站页面操作。'},403);
    const data=await read(request);
    // 管理删除复用评论管理密钥，不向前端公开任何凭证。
    if(['/community/admin/delete-feedback','/community/admin/check'].includes(url.pathname)) {
      const key=request.headers.get('X-Comments-Key')||'';
      if(!env.COMMENTS_ADMIN_KEY||env.COMMENTS_ADMIN_KEY.length<32)return reply({error:'管理服务未配置。'},503);
      if(await digest(key)!==await digest(env.COMMENTS_ADMIN_KEY))return reply({error:'管理凭证不正确。'},401);
      if(url.pathname==='/community/admin/check')return reply({ok:true});
      if(!Number.isSafeInteger(data.id)||data.id<1)return reply({error:'编号不正确。'},400);
      const result=await env.DB.prepare("UPDATE feedback SET nickname='',body='',deleted=1 WHERE id=?").bind(data.id).run();
      return result.meta.changes?reply({ok:true}):reply({error:'反馈不存在。'},404);
    }
    if(!uuid(data.visitor))return reply({error:'浏览器标识不正确，请刷新重试。'},400);
    const player=await digest(`${env.COMMENTS_RATE_SALT}:visitor:${data.visitor}`);
    if(url.pathname==='/community/like') {
      if(!['comment','feedback'].includes(data.kind)||!Number.isSafeInteger(data.id)||data.id<1||typeof data.liked!=='boolean')return reply({error:'点赞参数不正确。'},400);
      await limit(request,env,'likes',100);
      const table=data.kind==='comment'?'comments':'feedback';const condition=data.kind==='comment'?"status='approved' AND body!=''":'deleted=0';
      const target=await env.DB.prepare(`SELECT id FROM ${table} WHERE id=? AND ${condition}`).bind(data.id).first();
      if(!target)return reply({error:'内容不存在或已删除。'},404);
      if(data.liked)await env.DB.prepare(`INSERT INTO community_likes(kind,target_id,voter) SELECT ?,id,? FROM ${table} WHERE id=? AND ${condition} ON CONFLICT DO NOTHING`).bind(data.kind,player,data.id).run();
      else await env.DB.prepare('DELETE FROM community_likes WHERE kind=? AND target_id=? AND voter=?').bind(data.kind,data.id,player).run();
      const count=await env.DB.prepare('SELECT COUNT(*) AS likes FROM community_likes WHERE kind=? AND target_id=?').bind(data.kind,data.id).first();
      return reply({ok:true,likes:count.likes,liked:data.liked});
    }
    if(url.pathname==='/community/feedback') {
      const nickname=typeof data.nickname==='string'?data.nickname.trim():'';const body=typeof data.body==='string'?data.body.trim():'';
      if(!uuid(data.requestId)||!nickname||nickname.length>40||body.length<2||body.length>2000||/[\x00-\x1f\x7f]/.test(nickname)||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(body))return reply({error:'请填写 1–40 字符昵称和 2–2000 字符建议。'},400);
      const old=await env.DB.prepare('SELECT nickname,body,deleted FROM feedback WHERE request_id=?').bind(data.requestId).first();
      if(old)return old.deleted?reply({error:'反馈已删除。'},410):old.nickname===nickname&&old.body===body?reply({ok:true}):reply({error:'重复提交标识不一致。'},409);
      await limit(request,env,'feedback',10);
      await env.DB.prepare('INSERT INTO feedback(request_id,nickname,body) VALUES (?,?,?) ON CONFLICT(request_id) DO NOTHING').bind(data.requestId,nickname,body).run();
      const saved=await env.DB.prepare('SELECT nickname,body,deleted FROM feedback WHERE request_id=?').bind(data.requestId).first();
      if(saved.deleted)return reply({error:'反馈已删除。'},410);
      if(saved.nickname!==nickname||saved.body!==body)return reply({error:'重复提交标识不一致。'},409);
      return reply({ok:true},201);
    }
    if(url.pathname==='/community/rankings/start') {
      await limit(request,env,'rank-start',20);
      const now=Math.floor(Date.now()/1000);const id=crypto.randomUUID(),seed=crypto.getRandomValues(new Uint32Array(1))[0];
      await env.DB.prepare('DELETE FROM ranked_sessions WHERE expires_at < ? AND id NOT IN (SELECT session_id FROM ranked_scores)').bind(now).run();
      await env.DB.prepare('INSERT INTO ranked_sessions(id,player,seed,started_at,expires_at) VALUES (?,?,?,?,?)').bind(id,player,seed,now,now+7200).run();
      return reply({id,seed,version:rules.VERSION,maxTicks:rules.MAX_TICKS},201);
    }
    if(url.pathname==='/community/rankings/submit') {
      const nickname=typeof data.nickname==='string'?data.nickname.trim():'';
      if(!uuid(data.sessionId)||!nickname||nickname.length>24||/[\x00-\x1f\x7f]/.test(nickname)||data.version!==rules.VERSION)return reply({error:'请填写 1–24 字符昵称，并使用当前游戏版本。'},400);
      const session=await env.DB.prepare('SELECT * FROM ranked_sessions WHERE id=? AND player=?').bind(data.sessionId,player).first();
      if(!session)return reply({error:'排位对局不存在。'},404);
      const existing=await env.DB.prepare('SELECT score,lines FROM ranked_scores WHERE session_id=?').bind(data.sessionId).first();
      if(existing)return reply({ok:true,...existing});
      const now=Math.floor(Date.now()/1000);if(session.expires_at<now)return reply({error:'本局提交已过期，请重新开始。'},410);
      await limit(request,env,'rank-submit',10);
      const result=replay(session.seed,data.log);
      if(result.ticks*rules.STEP>(now-session.started_at+2)*1000)return reply({error:'游戏时间校验失败。'},400);
      await env.DB.prepare('INSERT INTO ranked_scores(session_id,player,nickname,score,lines,finished_at) VALUES (?,?,?,?,?,?) ON CONFLICT(session_id) DO NOTHING').bind(session.id,player,nickname,result.score,result.lines,now).run();
      // 并发重试也只承认数据库首次保存的成绩，响应与实际榜单一致。
      const saved=await env.DB.prepare('SELECT score,lines FROM ranked_scores WHERE session_id=?').bind(session.id).first();
      return reply({ok:true,...saved},201);
    }
    return reply({error:'接口不存在。'},404);
  } catch(error) {return reply({error:error.status?error.message:'服务暂时不可用，请稍后重试。'},error.status||503);}
}
