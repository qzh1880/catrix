// 排位规则由 Worker 执行；浏览器仅使用难度参数与相邻格计算。雷位不发往浏览器。
export const LEVELS = {easy:{name:'初级',cols:9,rows:9,mines:10},normal:{name:'中级',cols:16,rows:16,mines:40},hard:{name:'高级',cols:30,rows:16,mines:99},expert:{name:'专家',cols:30,rows:24,mines:180}};

// 将尺寸和雷数编码进榜单键，确保自定义成绩只与同规格棋盘比较。
export function configuration(level){
 if(Object.hasOwn(LEVELS,level))return {...LEVELS[level],key:level};
 const m=typeof level==='string'&&/^custom-([1-9]\d*)x([1-9]\d*)-([1-9]\d*)$/.exec(level);
 if(!m)throw Error('难度不正确。');
 const [cols,rows,mines]=m.slice(1).map(Number);
 if(cols<5||cols>40||rows<5||rows>30||mines<1||mines>Math.min(300,cols*rows-9))throw Error('自定义宽度须为 5–40，高度 5–30；雷数须为 1–300 且至少留出 9 个安全格。');
 return {key:level,name:`自定义 ${cols}×${rows} / ${mines} 雷`,cols,rows,mines};
}
export function neighbors(i,g){const x=i%g.cols,y=Math.floor(i/g.cols),out=[];for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy;if((dx||dy)&&xx>=0&&xx<g.cols&&yy>=0&&yy<g.rows)out.push(yy*g.cols+xx);}return out;}
export function create(level,first,random=Math.random){
 const cfg=configuration(level);if(!cfg||!Number.isInteger(first)||first<0||first>=cfg.cols*cfg.rows)throw Error('格子或难度不正确。');
 const g={...cfg,cells:Array(cfg.cols*cfg.rows).fill(0),open:[],state:'playing'};
 const safe=new Set([first,...neighbors(first,g)]),pool=g.cells.map((_,i)=>i).filter(i=>!safe.has(i));
 // 有限 Fisher-Yates 抽样保证雷数准确，首击九宫格无雷，但不承诺每局无需猜测。
 for(let n=0;n<cfg.mines;n++){const j=n+Math.floor(random()*(pool.length-n));[pool[n],pool[j]]=[pool[j],pool[n]];g.cells[pool[n]]=-1;}
 for(let i=0;i<g.cells.length;i++)if(g.cells[i]!==-1)g.cells[i]=neighbors(i,g).filter(j=>g.cells[j]===-1).length;
 return reveal(g,first);
}
export function reveal(g,i,flags=[]){
 if(!Number.isInteger(i)||i<0||i>=g.cells.length)throw Error('格子不正确。');
 if(g.state!=='playing'||g.open.includes(i)||flags.includes(i))return g;
 if(g.cells[i]===-1){g.state='lost';g.hit=i;return g;}
 const seen=new Set(g.open),blocked=new Set(flags),todo=[i];while(todo.length){const n=todo.pop();if(seen.has(n)||blocked.has(n)||g.cells[n]===-1)continue;seen.add(n);if(g.cells[n]===0)todo.push(...neighbors(n,g));}
 g.open=[...seen];if(g.open.length===g.cells.length-g.mines)g.state='won';return g;
}

export function validateFlags(g,flags){
 if(!Array.isArray(flags)||flags.length>g.mines||new Set(flags).size!==flags.length||flags.some(i=>!Number.isInteger(i)||i<0||i>=g.cells.length||g.open.includes(i)))throw Error('插旗位置不正确。');
}
// 双击数字只验证旗数，不校正旗子；旗子标错仍会翻到真实地雷。
export function chord(g,i,flags){
 validateFlags(g,flags);
 if(!Number.isInteger(i)||!g.open.includes(i)||!(g.cells[i]>0))throw Error('请双击已经翻开的数字。');
 const around=neighbors(i,g);
 if(around.filter(n=>flags.includes(n)).length!==g.cells[i])throw Error('周围旗子数量需要与数字相同。');
 for(const n of around)if(!flags.includes(n))reveal(g,n,flags);
 return g;
}
export function view(g){return {cols:g.cols,rows:g.rows,mines:g.mines,state:g.state,hit:g.hit,cells:g.cells.map((n,i)=>g.open.includes(i)?n:g.state==='lost'&&n===-1?-1:null)};}
