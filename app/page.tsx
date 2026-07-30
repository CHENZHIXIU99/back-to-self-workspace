"use client";
/* eslint-disable @next/next/no-img-element */

import {
  Activity, BarChart3, BookOpen, CalendarDays, Camera, Check, ChevronRight, CircleDollarSign,
  Clock3, Download, Droplets, HeartHandshake, Home, ListTodo, Menu, Moon,
  CupSoda, Flower2, NotebookPen, Pause, Play, Plus, Search, Settings, Shirt, Sparkles, Trash2,
  Upload, UserRound, WalletCards, X
} from "lucide-react";
import { useEffect, useState } from "react";
import { loadWorkspace, saveWorkspace, type WorkspaceData, seedData } from "@/lib/db";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

type Page = "today" | "tasks" | "calendar" | "temporary" | "health" | "weight" | "finance" | "growth" | "emotion" | "weekly" | "trends" | "settings";
type Modal = null | "task" | "expense" | "temporary" | "weight" | "drink" | "outfit" | "period" | "focus" | "emotion" | "note";

const nav: { id: Page; label: string; icon: typeof Home }[] = [
  { id: "today", label: "今日首页", icon: Home }, { id: "tasks", label: "每日任务", icon: ListTodo },
  { id: "calendar", label: "日历日程", icon: CalendarDays }, { id: "temporary", label: "临时任务", icon: NotebookPen },
  { id: "health", label: "生活与健康", icon: Activity },
  { id: "finance", label: "记账本", icon: WalletCards }, { id: "growth", label: "学习成长", icon: BookOpen },
  { id: "emotion", label: "情绪暂停", icon: HeartHandshake }, { id: "weekly", label: "每周计划与复盘", icon: Sparkles },
  { id: "trends", label: "历史趋势", icon: BarChart3 }, { id: "settings", label: "设置与数据", icon: Settings },
];

const pageTitle: Record<Page, [string, string]> = {
  today:["今日","把注意力放回此刻"], tasks:["每日任务","清楚地完成，不把一天塞满"], calendar:["日历日程","为重要的事留出时间"],
  temporary:["临时任务","先接住，再安排"], health:["生活与健康","身体、饮品、穿搭、体重与周期，都在这里温和记录"], weight:["生活与健康","观察身体，不做评判"],
  finance:["个人记账","看见钱的去向，不制造消费焦虑"], growth:["学习成长","把输入变成自己的行动"], emotion:["情绪暂停","情绪可以存在，但不必立刻行动"],
  weekly:["每周计划与复盘","保护真正重要的方向"], trends:["历史趋势","从变化中了解自己"], settings:["设置与数据","数据只属于你"],
};

export default function HomePage() {
  const [data, setData] = useState<WorkspaceData>(seedData);
  const [page, setPage] = useState<Page>("today");
  const [modal, setModal] = useState<Modal>(null);
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState("");
  const [query, setQuery] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [theme, setTheme] = useState<"light"|"dark">("light");
  const [timer, setTimer] = useState<{running:boolean;end:number;remaining:number}>(() => {
    if (typeof window !== "undefined") {
      try { const saved=localStorage.getItem("bts-timer"); if(saved) return JSON.parse(saved); } catch {}
    }
    return {running:false,end:0,remaining:25*60};
  });

  useEffect(() => { loadWorkspace().then(v => { setData(v); setReady(true); }); }, []);
  useEffect(() => { if ("serviceWorker" in navigator) navigator.serviceWorker.register(`${basePath}/sw.js`).catch(()=>{}); }, []);
  useEffect(() => { if (ready) saveWorkspace(data); }, [data, ready]);
  useEffect(() => { localStorage.setItem("bts-timer", JSON.stringify(timer)); }, [timer]);
  useEffect(() => {
    if (!timer.running) return;
    const id = setInterval(() => {
      setTimer(t => {
        const remaining = Math.max(0, Math.ceil((t.end-Date.now())/1000));
        if (!remaining) { setToast("本轮专注已完成，休息一下吧"); setTimeout(()=>setToast(""),2400); return {...t,running:false,remaining:0}; }
        return {...t,remaining};
      });
    },1000);
    return () => clearInterval(id);
  }, [timer.running]);

  function update(fn:(d:WorkspaceData)=>WorkspaceData){ setData(fn); }
  function notify(msg:string){ setToast(msg); setTimeout(()=>setToast(""),2400); }
  const completed = data.tasks.filter(t=>t.done).length;
  const expense = data.transactions.filter(t=>t.type==="支出").reduce((s,t)=>s+t.amount,0);
  const income = data.transactions.filter(t=>t.type==="收入").reduce((s,t)=>s+t.amount,0);
  const fmt = (n:number)=>`¥${n.toFixed(2)}`;
  const todayLabel = new Intl.DateTimeFormat("zh-CN",{month:"long",day:"numeric",weekday:"long"}).format(new Date());

  function toggleTask(id:string){ update(d=>({...d,tasks:d.tasks.map(t=>t.id===id?{...t,done:!t.done}:t)})); }
  function remove(kind:"tasks"|"temporary"|"transactions"|"notes",id:string){
    if (!confirm("确定删除这条记录吗？删除后可通过数据备份恢复。")) return;
    update(d=>({...d,[kind]:d[kind].filter((x:{id:string})=>x.id!==id)})); notify("已删除");
  }
  function exportJson(){
    download(`BackToSelf-数据备份-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(data,null,2),"application/json");
  }
  function exportMarkdown(){
    const md=`# BackToSelf Workspace｜每周复盘\n\n- 完成任务：${completed}/${data.tasks.length}\n- 本周支出：${fmt(expense)}\n- 专注记录：${data.focusSessions} 次\n\n## 本周做得最好的一件事\n\n${data.review.best || "暂未填写"}\n\n## 下周重点\n\n${data.review.next || "暂未填写"}\n`;
    download("BackToSelf-每周复盘.md",md,"text/markdown");
  }
  function download(name:string,text:string,type:string){ const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([text],{type})); a.download=name;a.click();URL.revokeObjectURL(a.href); }
  async function importFile(file:File){ try{ const parsed=JSON.parse(await file.text()); if(!parsed.schemaVersion||!Array.isArray(parsed.tasks)) throw new Error(); setData(parsed);notify("数据已恢复"); }catch{notify("无法导入：文件格式不正确");} }

  if (!ready) return <div className="loading"><div className="breath"/><p>正在打开 BackToSelf…</p></div>;
  return <div className={theme==="dark"?"app dark":"app"}>
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">B</div><div><b>BackToSelf</b><span>PERSONAL WORKSPACE</span></div></div>
      <nav>{nav.map(n=><button key={n.id} className={page===n.id?"active":""} onClick={()=>setPage(n.id)}><n.icon size={18}/>{n.label}</button>)}</nav>
      <div className="side-quote">今天不需要解决所有事情，只需要完成眼前这一小步。</div>
    </aside>
    <main>
      <header className="topbar">
        <button className="icon mobile-only" onClick={()=>setMobileMenu(true)} aria-label="打开菜单"><Menu/></button>
        <div><h1>{pageTitle[page][0]}</h1><p>{pageTitle[page][1]}</p></div>
        <div className="top-actions"><div className="search"><Search size={17}/><input aria-label="全局搜索" value={query} onChange={e=>setQuery(e.target.value)} placeholder="搜索任务、笔记、账单…"/></div><button className="avatar" onClick={()=>setPage("settings")}>自</button></div>
      </header>
      <div className="content">
        {query ? <SearchResults data={data} query={query} go={setPage}/> :
        page==="today" ? <Today data={data} completed={completed} expense={expense} today={todayLabel} open={setModal} go={setPage} toggle={toggleTask} update={update}/> :
        page==="tasks" ? <Tasks data={data} toggle={toggleTask} open={setModal} remove={remove}/> :
        page==="calendar" ? <Calendar data={data} open={setModal}/> :
        page==="temporary" ? <Temporary data={data} open={setModal} remove={remove} update={update}/> :
        page==="health" ? <Health data={data} update={update}/> :
        page==="weight" ? <Weight data={data} open={setModal}/> :
        page==="finance" ? <Finance data={data} income={income} expense={expense} open={setModal} remove={remove}/> :
        page==="growth" ? <Growth data={data} open={setModal} remove={remove} update={update}/> :
        page==="emotion" ? <Emotion data={data} open={setModal}/> :
        page==="weekly" ? <Weekly data={data} update={update} exportMd={exportMarkdown}/> :
        page==="trends" ? <Trends data={data}/> :
        <SettingsPage data={data} theme={theme} setTheme={setTheme} exportJson={exportJson} importFile={importFile} reset={()=>{if(confirm("确定清空全部数据吗？建议先导出备份，此操作无法撤销。"))setData({...seedData,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()})}}/>}
      </div>
    </main>
    <nav className="bottom-nav">
      {[["today","今日",Home],["calendar","日程",CalendarDays],["temporary","记录",Plus],["growth","成长",BookOpen],["settings","我的",UserRound]].map(([id,label,Icon])=><button key={id as string} className={page===id?"active":""} onClick={()=>setPage(id as Page)}><Icon size={21}/><span>{label as string}</span></button>)}
    </nav>
    {mobileMenu&&<div className="drawer-backdrop" onClick={()=>setMobileMenu(false)}><div className="drawer" onClick={e=>e.stopPropagation()}><div className="drawer-title"><b>全部功能</b><button className="icon" onClick={()=>setMobileMenu(false)}><X/></button></div>{nav.map(n=><button key={n.id} onClick={()=>{setPage(n.id);setMobileMenu(false)}}><n.icon size={19}/>{n.label}</button>)}</div></div>}
    {modal&&<Editor modal={modal} close={()=>setModal(null)} update={update} notify={notify} timer={timer} setTimer={setTimer}/>}
    {toast&&<div className="toast" role="status" aria-live="polite"><Check size={17}/>{toast}</div>}
  </div>;
}

function Today({data,completed,expense,today,open,go,toggle,update}:{data:WorkspaceData;completed:number;expense:number;today:string;open:(m:Modal)=>void;go:(p:Page)=>void;toggle:(id:string)=>void;update:(f:(d:WorkspaceData)=>WorkspaceData)=>void}){
  const main=data.tasks.find(t=>t.important) || data.tasks[0];
  return <><section className="hello"><div><span className="eyebrow">{today}</span><h2>早上好，今天想怎样照顾自己？</h2><p>今天不需要解决所有事情，只需要完成眼前这一小步。</p></div><div className="status-select"><label>今日状态</label><select value={data.status} onChange={e=>update(d=>({...d,status:e.target.value}))}><option value="">选择今天的状态</option><option>精力正常</option><option>状态很好</option><option>有点疲惫</option><option>情绪波动</option><option>很需要休息</option></select></div></section>
  {(data.status==="情绪波动"||data.status==="很需要休息")&&<div className="gentle-banner"><Moon size={20}/><div><b>要进入低精力模式吗？</b><p>今天先维持基本运转，不要求高产。其他任务可以先放进“今天可以不做”。</p></div><button className="text-btn">调整今天</button></div>}
  <section className="summary-grid">
    <Summary icon={ListTodo} title="今日待办" value={`${completed}/${data.tasks.length}`} note={main?.title||"还没有任务"} progress={data.tasks.length?completed/data.tasks.length:0} onClick={()=>go("tasks")}/>
    <Summary icon={CircleDollarSign} title="今日支出" value={`¥${expense.toFixed(2)}`} note={`${data.transactions.length} 笔记录`} action="快速记一笔" onAction={()=>open("expense")}/>
    <Summary icon={NotebookPen} title="临时任务" value={`${data.temporary.filter(t=>!t.done).length} 项`} note={data.temporary[0]?.title||"暂无临时任务"} action="快速添加" onAction={()=>open("temporary")}/>
    <Summary icon={Activity} title="健康记录" value={data.health.sleep?`${data.health.sleep}h 睡眠`:"暂无记录"} note={data.weights.length?`最近体重 ${data.weights.at(-1)?.value}kg`:"记录身体、饮品与周期"} onClick={()=>go("health")}/>
  </section>
  {main&&<section className="focus-card"><div className="focus-top"><div><span className="eyebrow">今日最重要任务</span><h2>{main.title}</h2></div><span className="duration"><Clock3 size={16}/>{main.minutes} 分钟</span></div><div className="focus-details"><div><span>具体下一步</span><p>{main.next}</p></div><div><span>完成标准</span><p>{main.standard}</p></div></div><div className="focus-actions"><button className="primary" onClick={()=>open("focus")}><Play size={17}/>开始专注</button><button className="secondary" onClick={()=>toggle(main.id)}>{main.done?"恢复任务":"标记完成"}</button></div></section>}
  <section className="two-col"><div className="panel"><div className="panel-head"><div><span className="eyebrow">时间轴</span><h3>接下来的安排</h3></div><button className="text-btn" onClick={()=>go("calendar")}>查看全部<ChevronRight size={15}/></button></div>{data.schedule.length?<div className="timeline">{data.schedule.map((x,i)=><div className="time-row" key={x.time}><time>{x.time}</time><span className={i===0?"dot current":"dot"}/><div><b>{x.title}</b><p>{x.type}</p></div></div>)}</div>:<Empty title="今天还没有日程" note="给今天留一点空间，或添加第一项安排。"/>}</div>
  <div className="panel"><div className="panel-head"><div><span className="eyebrow">快速操作</span><h3>现在想记录什么？</h3></div></div><div className="quick-grid">{[["添加任务",ListTodo,"task"],["记一笔",WalletCards,"expense"],["临时任务",NotebookPen,"temporary"],["情绪暂停",HeartHandshake,"emotion"],["记录穿搭",Shirt,"outfit"],["添加笔记",BookOpen,"note"]].map(([label,Icon,m])=><button key={label as string} onClick={()=>open(m as Modal)}><Icon size={20}/><span>{label as string}</span></button>)}</div></div></section></>
}

function Summary({icon:Icon,title,value,note,progress,action,onAction,onClick}:{icon:typeof Home;title:string;value:string;note:string;progress?:number;action?:string;onAction?:()=>void;onClick?:()=>void}){return <article className="summary-card" onClick={onClick}><div className="summary-icon"><Icon size={18}/></div><span>{title}</span><strong>{value}</strong><p>{note}</p>{progress!==undefined&&<div className="progress" aria-label={`完成进度${Math.round(progress*100)}%`}><i style={{width:`${progress*100}%`}}/></div>}{action&&<button className="text-btn" onClick={e=>{e.stopPropagation();onAction?.()}}>{action}<Plus size={15}/></button>}</article>}

function Tasks({data,toggle,open,remove}:{data:WorkspaceData;toggle:(id:string)=>void;open:(m:Modal)=>void;remove:(k:"tasks",id:string)=>void}){return <section className="panel page-panel"><div className="panel-head"><div><span className="eyebrow">今日看板</span><h2>{data.tasks.filter(t=>t.done).length}/{data.tasks.length} 项已完成</h2><p>预计 {data.tasks.reduce((s,t)=>s+t.minutes,0)} 分钟</p></div><button className="primary" onClick={()=>open("task")}><Plus size={17}/>添加任务</button></div><div className="task-list">{data.tasks.map(t=><div className="task-row" key={t.id}><button className={t.done?"check done":"check"} aria-label={t.done?"恢复任务":"完成任务"} onClick={()=>toggle(t.id)}>{t.done&&<Check size={15}/>}</button><div className={t.done?"task-main completed":"task-main"}><b>{t.title}</b><p>{t.next}</p><div className="chips"><span>{t.category}</span><span>{t.priority}</span><span><Clock3 size={12}/>{t.minutes} 分钟</span></div></div><button className="icon danger" onClick={()=>remove("tasks",t.id)} aria-label="删除任务"><Trash2 size={17}/></button></div>)}</div></section>}

function Calendar({data,open}:{data:WorkspaceData;open:(m:Modal)=>void}){const days=Array.from({length:35},(_,i)=>i-2);return <><section className="panel"><div className="panel-head"><div><span className="eyebrow">月视图</span><h2>{new Date().getFullYear()} 年 {new Date().getMonth()+1} 月</h2></div><button className="primary" onClick={()=>open("task")}><Plus size={17}/>添加日程</button></div><div className="calendar-head">{["一","二","三","四","五","六","日"].map(x=><span key={x}>{x}</span>)}</div><div className="calendar-grid">{days.map((d,i)=><button key={i} className={d===new Date().getDate()?"today-day":d<1||d>31?"muted-day":""}>{d<1?30+d:d>31?d-31:d}{d===new Date().getDate()&&<small>今天</small>}</button>)}</div><div className="legend"><span>● 有任务</span><span>✓ 全部完成</span><span>◆ 临时任务</span></div></section><section className="panel"><div className="panel-head"><h3>今天的日程</h3></div>{data.schedule.length?<div className="timeline">{data.schedule.map(x=><div className="time-row" key={x.time}><time>{x.time}</time><span className="dot"/><div><b>{x.title}</b><p>{x.type}</p></div></div>)}</div>:<Empty title="今天还没有日程" note="添加第一项日程后，它会显示在这里。"/>}</section></>}

function Temporary({data,open,remove,update}:{data:WorkspaceData;open:(m:Modal)=>void;remove:(k:"temporary",id:string)=>void;update:(f:(d:WorkspaceData)=>WorkspaceData)=>void}){return <section className="panel page-panel"><div className="panel-head"><div><span className="eyebrow">任务收件箱</span><h2>先记下来，稍后安排</h2></div><button className="primary" onClick={()=>open("temporary")}><Plus size={17}/>添加临时任务</button></div>{data.temporary.length?data.temporary.map(t=><div className="task-row" key={t.id}><button className={t.done?"check done":"check"} onClick={()=>update(d=>({...d,temporary:d.temporary.map(x=>x.id===t.id?{...x,done:!x.done}:x)}))}>{t.done&&<Check size={15}/>}</button><div className="task-main"><b>{t.title}</b><p>截止：{t.deadline||"无明确日期"} · {t.priority}</p></div><button className="secondary small" onClick={()=>update(d=>({...d,tasks:[...d.tasks,{id:crypto.randomUUID(),title:t.title,next:"确认下一步并开始处理",standard:"任务已处理完成",minutes:30,category:"其他",priority:t.priority,done:false}],temporary:d.temporary.filter(x=>x.id!==t.id)}))}>安排到今日</button><button className="icon danger" onClick={()=>remove("temporary",t.id)}><Trash2 size={17}/></button></div>):<Empty title="收件箱是空的" note="临时出现的事情，可以先放在这里。" action="添加第一项" onClick={()=>open("temporary")}/>}</section>}

function Health({data,update}:{data:WorkspaceData;update:(f:(d:WorkspaceData)=>WorkspaceData)=>void}){
  const [healthModal,setHealthModal]=useState<Modal>(null);
  const lastWeight=data.weights.at(-1),lastPeriod=data.periods.at(-1);
  const nextPeriod=lastPeriod?new Date(new Date(lastPeriod.startDate).getTime()+28*86400000).toISOString().slice(0,10):"";
  return <><section className="metric-grid">
    <Metric label="昨晚睡眠" value={data.health.sleep?`${data.health.sleep} 小时`:"暂无记录"} note="按真实感受记录"/>
    <Metric label="今日饮水" value={data.health.water?`${data.health.water} ml`:"暂无记录"} note={`${data.drinks.length} 条饮品记录`}/>
    <Metric label="最近体重" value={lastWeight?`${lastWeight.value} kg`:"暂无记录"} note="每周记录一次即可"/>
    <Metric label="姨妈周期" value={lastPeriod?`${lastPeriod.startDate.slice(5)} 开始`:"暂无记录"} note={nextPeriod?`预计下次约 ${nextPeriod.slice(5)}`:"记录后生成周期参考"}/>
  </section>
  <section className="two-col health-columns">
    <div className="panel"><div className="panel-head"><div><span className="eyebrow">身体状态</span><h3>今天的基础记录</h3></div></div><div className="record-stack">
      <label>昨晚睡眠时长（小时）<input type="number" inputMode="decimal" placeholder="例如 7.5" value={data.health.sleep??""} onChange={e=>update(d=>({...d,health:{...d.health,sleep:e.target.value?+e.target.value:null}}))}/></label>
      <label>今天吃了几顿完整正餐<select value={data.health.meals??""} onChange={e=>update(d=>({...d,health:{...d.health,meals:e.target.value?+e.target.value:null}}))}><option value="">暂未记录</option><option value="0">0 餐</option><option value="1">1 餐</option><option value="2">2 餐</option><option value="3">3 餐</option></select></label>
      <div><span className="field-label">快速记录饮水</span><div className="seg">{[200,300,500].map(v=><button onClick={()=>update(d=>({...d,health:{...d.health,water:d.health.water+v}}))} key={v}><Droplets size={16}/>{v}ml</button>)}</div></div>
      <button className="secondary" onClick={()=>setHealthModal("weight")}><BarChart3 size={17}/>{lastWeight?"再次记录体重":"记录体重"}</button>
    </div></div>
    <div className="panel"><div className="panel-head"><div><span className="eyebrow">每日饮品</span><h3>今天喝了什么？</h3></div><button className="primary" onClick={()=>setHealthModal("drink")}><Camera size={17}/>拍照记录</button></div>
      {data.drinks.length?<div className="drink-grid">{data.drinks.map(x=><article className="drink-card" key={x.id}>{x.photo?<img src={x.photo} alt={`${x.name}的照片`}/>:<div className="drink-placeholder"><CupSoda/></div>}<div><span>{x.type}</span><b>{x.name}</b><small>{x.time}{x.amount?` · ${x.amount}ml`:""}</small></div></article>)}</div>:<Empty title="今天还没有饮品记录" note="可以拍照或从相册选择，记录咖啡、茶、牛奶、果汁或其他饮品。" action="记录第一杯" onClick={()=>setHealthModal("drink")}/>}
    </div>
  </section>
  <section className="panel outfit-panel"><div className="panel-head"><div><span className="eyebrow">每日穿搭</span><h2>今天穿了什么？</h2><p>留下当天喜欢的搭配，慢慢形成自己的穿搭相册。</p></div><button className="primary" onClick={()=>setHealthModal("outfit")}><Shirt size={17}/>记录今日穿搭</button></div>
    {data.outfits.length?<div className="outfit-grid">{data.outfits.map(x=><article className="outfit-card" key={x.id}><img src={x.photo} alt={`${x.date}的穿搭照片`}/><div><span>{x.date}</span><b>{x.occasion||"今日穿搭"}</b><p>{x.mood}{x.note?` · ${x.note}`:""}</p></div><button className="outfit-delete" aria-label="删除穿搭记录" onClick={()=>update(d=>({...d,outfits:d.outfits.filter(o=>o.id!==x.id)}))}><Trash2 size={15}/></button></article>)}</div>:<Empty title="还没有穿搭照片" note="上传今天的全身或半身穿搭，建立只属于自己的 Lookbook。" action="记录第一套穿搭" onClick={()=>setHealthModal("outfit")}/>}
  </section>
  <section className="panel period-panel"><div className="panel-head"><div><span className="eyebrow">女性健康</span><h2>姨妈周期</h2><p>只记录自己的日期和感受，不做医疗诊断。</p></div><button className="primary period-button" onClick={()=>setHealthModal("period")}><Flower2 size={17}/>记录本次姨妈</button></div>
    {data.periods.length?<div className="period-history">{[...data.periods].reverse().map(x=><div className="period-row" key={x.id}><div className="period-day"><Flower2/><b>{x.startDate.slice(5)}</b></div><div><b>{x.startDate} 至 {x.endDate||"进行中"}</b><p>经量：{x.flow||"未记录"}{x.note?` · ${x.note}`:""}</p></div></div>)}</div>:<Empty title="还没有周期记录" note="记录每次开始和结束日期，之后可查看自己的周期变化。" action="添加第一次记录" onClick={()=>setHealthModal("period")}/>}
  </section>
  <section className="panel suggestion"><span className="eyebrow">温和提醒</span><h3>健康记录是为了更了解自己</h3><p className="medical-note">周期预测仅根据历史日期估算，不能用于避孕或医疗判断。若经期异常、疼痛明显或身体持续不适，请咨询正规医疗专业人员。</p></section>
  {healthModal&&<Editor modal={healthModal} close={()=>setHealthModal(null)} update={update} notify={()=>setHealthModal(null)} timer={{running:false,end:0,remaining:1500}} setTimer={()=>{}}/>}
  </>}
function Metric({label,value,note}:{label:string;value:string;note:string}){return <div className="metric"><span>{label}</span><strong>{value}</strong><p>{note}</p></div>}

function Weight({data,open}:{data:WorkspaceData;open:(m:Modal)=>void}){const last=data.weights.at(-1);return <><section className="panel hero-metric"><div><span className="eyebrow">最近一次记录</span><h2>{last?.value||"--"}<small> kg</small></h2><p>{last?.date||"暂未记录"} · 目标：保持稳定</p></div><button className="primary" onClick={()=>open("weight")}><Plus size={17}/>记录体重</button></section><section className="panel"><div className="panel-head"><h3>最近 4 周趋势</h3><span className="muted">每周记录一次即可</span></div><div className="bar-chart">{data.weights.map(w=><div key={w.id}><span style={{height:`${Math.max(28,(w.value-55)*8)}px`}}/><b>{w.value}</b><small>{w.date.slice(5)}</small></div>)}</div><p className="trend-text">最近记录整体保持平稳。关注长期变化，也结合睡眠、食欲和身体感受一起观察。</p></section></>}

function Finance({data,income,expense,open,remove}:{data:WorkspaceData;income:number;expense:number;open:(m:Modal)=>void;remove:(k:"transactions",id:string)=>void}){return <><section className="finance-hero"><div><span>本月结余</span><strong>¥{(income-expense).toFixed(2)}</strong><p>收入 ¥{income.toFixed(2)} · 支出 ¥{expense.toFixed(2)}</p></div><button className="primary light" onClick={()=>open("expense")}><Plus size={17}/>记一笔</button></section><section className="two-col"><div className="panel"><div className="panel-head"><h3>最近账单</h3><button className="text-btn">全部账单<ChevronRight size={15}/></button></div>{data.transactions.map(t=><div className="transaction" key={t.id}><div className="category-icon">{t.category[0]}</div><div><b>{t.note||t.category}</b><p>{t.category} · {t.date}</p></div><strong className={t.type==="收入"?"income":""}>{t.type==="支出"?"-":"+"}¥{t.amount.toFixed(2)}</strong><button className="icon danger" onClick={()=>remove("transactions",t.id)}><Trash2 size={16}/></button></div>)}</div><div className="panel"><div className="panel-head"><h3>分类支出</h3></div><div className="donut-wrap"><div className="donut"><span>{expense?Math.round(data.transactions.filter(t=>t.category==="餐饮").reduce((s,t)=>s+t.amount,0)/expense*100):0}%<small>餐饮</small></span></div><div className="category-list">{["餐饮","学习","交通","其他"].map((x,i)=><div key={x}><i style={{background:["#778d78","#c48869","#9b9e8b","#d7d2c8"][i]}}/>{x}<span>¥{data.transactions.filter(t=>t.category===x&&t.type==="支出").reduce((s,t)=>s+t.amount,0).toFixed(0)}</span></div>)}</div></div><div className="budget"><span>本月预算</span><b>已使用 {Math.round(expense/3000*100)}%</b><div className="progress"><i style={{width:`${Math.min(100,expense/30)}%`}}/></div><p>当前支出节奏平稳，可以继续按需要安排。</p></div></div></section></>}

function Growth({data,open,remove,update}:{data:WorkspaceData;open:(m:Modal)=>void;remove:(k:"notes",id:string)=>void;update:(f:(d:WorkspaceData)=>WorkspaceData)=>void}){return <><section className="panel page-panel"><div className="panel-head"><div><span className="eyebrow">学习与灵感</span><h2>留下真正对自己有用的内容</h2></div><button className="primary" onClick={()=>open("note")}><Plus size={17}/>添加笔记</button></div><div className="note-grid">{data.notes.map(n=><article className="note-card" key={n.id}><span>{n.type}</span><h3>{n.title}</h3><p>{n.content}</p><div><button className="text-btn" onClick={()=>{update(d=>({...d,tasks:[...d.tasks,{id:crypto.randomUUID(),title:n.action||`整理：${n.title}`,next:"明确下一步并开始",standard:"行动已完成",minutes:20,category:"学习研究",priority:"重要不紧急",done:false}]}));}}>转为任务<ChevronRight size={14}/></button><button className="icon danger" onClick={()=>remove("notes",n.id)}><Trash2 size={16}/></button></div></article>)}</div></section></>}

function Emotion({data,open}:{data:WorkspaceData;open:(m:Modal)=>void}){return <><section className="emotion-hero"><HeartHandshake size={28}/><span className="eyebrow">此刻先停一下</span><h2>情绪可以存在，但不必立刻采取行动。</h2><p>你不需要马上得出结论，也不需要在情绪最强烈的时候回复任何人。</p><button className="primary" onClick={()=>open("emotion")}>开始 5·3·2·1 落地练习</button></section><section className="two-col"><div className="panel"><h3>今天可以选择的替代行动</h3><div className="choice-list">{["延迟 30 分钟再回复","写下来但不发送","喝水或吃一点东西","完成 15 分钟手边工作","今天暂停讨论"].map(x=><label key={x}><input type="checkbox"/>{x}</label>)}</div></div><div className="panel"><h3>我的消息边界</h3><div className="choice-list">{data.boundaries.map(x=><label key={x}><input type="checkbox" defaultChecked/>{x}</label>)}</div></div></section></>}

function Weekly({data,update,exportMd}:{data:WorkspaceData;update:(f:(d:WorkspaceData)=>WorkspaceData)=>void;exportMd:()=>void}){return <><section className="metric-grid"><Metric label="完成任务" value={`${data.tasks.filter(t=>t.done).length} 项`} note={`共安排 ${data.tasks.length} 项`}/><Metric label="专注次数" value={`${data.focusSessions} 次`} note="温和而持续"/><Metric label="平均睡眠" value={`${data.health.sleep} 小时`} note="结合主观感受"/><Metric label="本周学习" value={`${data.notes.length} 条`} note="笔记与灵感"/></section><section className="panel review"><div className="panel-head"><div><span className="eyebrow">10–15 分钟</span><h2>本周复盘</h2></div><button className="secondary" onClick={exportMd}><Download size={16}/>导出 Markdown 周报</button></div><label>本周完成得最好的一件事是什么？<textarea value={data.review.best} onChange={e=>update(d=>({...d,review:{...d.review,best:e.target.value}}))} placeholder="写下一件具体的事…"/></label><label>下周最需要保护的是什么？<textarea value={data.review.next} onChange={e=>update(d=>({...d,review:{...d.review,next:e.target.value}}))} placeholder="时间、身体、边界或重要方向…"/></label><div className="advice"><h3>下周三条调整建议</h3><ol><li>工作日上午关闭聊天提醒，只在午休和下班后查看。</li><li>每天保留至少 30 分钟空白时间，不再追加任务。</li><li>周三和周六各安排一次 20 分钟轻量活动。</li></ol></div></section></>}

function Trends({data}:{data:WorkspaceData}){const hasData=data.tasks.length+data.transactions.length+data.notes.length+data.weights.length+data.drinks.length+data.outfits.length+data.periods.length>0;return <section className="panel"><div className="panel-head"><div><span className="eyebrow">历史趋势</span><h2>生活节奏总览</h2></div><div className="seg compact"><button className="active">7 天</button><button>30 天</button><button>12 周</button></div></div>{hasData?<><div className="simple-trend-summary"><Metric label="任务完成" value={`${data.tasks.filter(t=>t.done).length}/${data.tasks.length}`} note="按完成数量计算"/><Metric label="生活与健康" value={`${data.drinks.length+data.outfits.length+data.weights.length+data.periods.length} 条`} note="饮品、穿搭、体重与周期"/><Metric label="学习笔记" value={`${data.notes.length} 条`} note="自己的输入与行动"/></div><p className="trend-text">继续记录一段时间后，这里会生成更完整的 7 天、30 天和 12 周趋势。</p></>:<Empty title="还没有可分析的数据" note="从任务、健康、记账或学习模块开始记录，趋势会慢慢形成。"/>}</section>}

function SettingsPage({data,theme,setTheme,exportJson,importFile,reset}:{data:WorkspaceData;theme:string;setTheme:(x:"light"|"dark")=>void;exportJson:()=>void;importFile:(f:File)=>void;reset:()=>void}){return <><section className="panel settings-section install-panel"><div className="install-sticker">装</div><div><span className="eyebrow">像 App 一样使用</span><h2>安装到手机桌面</h2><p><b>iPhone：</b>用 Safari 打开本页 → 点击分享按钮 → 添加到主屏幕。</p><p><b>Android：</b>用 Chrome 打开本页 → 点击右上角菜单 → 安装应用。</p><InstallButton/></div></section><section className="panel settings-section"><h2>外观与体验</h2><div className="setting-row"><div><b>显示模式</b><p>选择舒适的阅读环境</p></div><div className="seg compact"><button className={theme==="light"?"active":""} onClick={()=>setTheme("light")}>浅色</button><button className={theme==="dark"?"active":""} onClick={()=>setTheme("dark")}>深色</button></div></div><div className="setting-row"><div><b>默认专注时长</b><p>开始专注时自动选择</p></div><span>25 分钟</span></div></section><section className="panel settings-section"><h2>数据与备份</h2><div className="privacy-note">当前数据默认仅保存在本设备的浏览器中。清除浏览器数据可能导致记录丢失，请定期导出备份。</div><div className="data-actions"><button className="secondary" onClick={exportJson}><Download size={17}/>导出 JSON 备份</button><label className="secondary file-btn"><Upload size={17}/>导入 JSON<input type="file" accept=".json" onChange={e=>e.target.files?.[0]&&importFile(e.target.files[0])}/></label><button className="secondary danger-outline" onClick={reset}><Trash2 size={17}/>清空全部数据</button></div><p className="muted">数据版本 {data.schemaVersion} · 最近更新 {new Date(data.updatedAt).toLocaleString("zh-CN")}</p></section><section className="panel settings-section"><h2>关于 BackToSelf Workspace</h2><p>一个帮助你照顾工作、身体、生活与成长的个人工作台。它不会评判你，也不会因为未完成而惩罚你。</p></section></>}

type InstallPromptEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:"accepted"|"dismissed"}>};
function InstallButton(){
  const [promptEvent,setPromptEvent]=useState<InstallPromptEvent|null>(null);
  useEffect(()=>{const handler=(e:Event)=>{e.preventDefault();setPromptEvent(e as InstallPromptEvent)};window.addEventListener("beforeinstallprompt",handler);return()=>window.removeEventListener("beforeinstallprompt",handler)},[]);
  async function install(){if(promptEvent){await promptEvent.prompt();await promptEvent.userChoice;setPromptEvent(null)}else alert("iPhone 请点击 Safari 底部“分享”，再选择“添加到主屏幕”；Android 请使用 Chrome 打开后选择“安装应用”。")}
  return <button className="primary install-now" onClick={install}><Download size={17}/>{promptEvent?"立即安装到手机":"查看安装方法"}</button>
}

function SearchResults({data,query,go}:{data:WorkspaceData;query:string;go:(p:Page)=>void}){const q=query.toLowerCase(); const rs=[...data.tasks.map(x=>({...x,kind:"任务",page:"tasks" as Page})),...data.notes.map(x=>({...x,kind:"笔记",page:"growth" as Page})),...data.transactions.map(x=>({id:x.id,title:x.note||x.category,content:`${x.category} ¥${x.amount}`,kind:"账单",page:"finance" as Page}))].filter(x=>(x.title+(("content"in x&&x.content)||"")).toLowerCase().includes(q));return <section className="panel"><div className="panel-head"><h2>“{query}” 的搜索结果</h2><span>{rs.length} 条</span></div>{rs.length?rs.map(r=><button className="search-result" key={r.id} onClick={()=>go(r.page)}><span>{r.kind}</span><div><b>{r.title}</b>{"content"in r&&<p>{String(r.content)}</p>}</div><ChevronRight size={18}/></button>):<Empty title="没有找到相关内容" note="换一个关键词，或检查日期和标签。"/>}</section>}

function Empty({title,note,action,onClick}:{title:string;note:string;action?:string;onClick?:()=>void}){return <div className="empty"><Sparkles/><h3>{title}</h3><p>{note}</p>{action&&<button className="secondary" onClick={onClick}>{action}</button>}</div>}

async function processLocalPhoto(file:File,cartoon:boolean):Promise<string>{
  const source=await new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image();const url=URL.createObjectURL(file);img.onload=()=>{URL.revokeObjectURL(url);resolve(img)};img.onerror=reject;img.src=url});
  const max=cartoon?760:1000,scale=Math.min(1,max/Math.max(source.naturalWidth,source.naturalHeight));
  const w=Math.max(1,Math.round(source.naturalWidth*scale)),h=Math.max(1,Math.round(source.naturalHeight*scale));
  const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext("2d",{willReadFrequently:cartoon});if(!ctx)throw new Error("canvas");
  ctx.drawImage(source,0,0,w,h);
  if(!cartoon)return canvas.toDataURL("image/jpeg",.82);
  const image=ctx.getImageData(0,0,w,h),pixels=image.data,gray=new Uint8Array(w*h);
  for(let i=0,p=0;i<pixels.length;i+=4,p++)gray[p]=(pixels[i]*.299+pixels[i+1]*.587+pixels[i+2]*.114)|0;
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const p=y*w+x,i=p*4;let r=(pixels[i]-128)*1.12+128,g=(pixels[i+1]-128)*1.12+128,b=(pixels[i+2]-128)*1.12+128;r=Math.round(Math.max(0,Math.min(255,r))/36)*36;g=Math.round(Math.max(0,Math.min(255,g))/36)*36;b=Math.round(Math.max(0,Math.min(255,b))/36)*36;const edge=Math.abs(gray[p-1]-gray[p+1])+Math.abs(gray[p-w]-gray[p+w]);if(edge>72){r*=.5;g*=.5;b*=.5}pixels[i]=r;pixels[i+1]=g;pixels[i+2]=b}
  ctx.putImageData(image,0,0);
  const sticker=document.createElement("canvas"),pad=Math.max(12,Math.round(Math.min(w,h)*.025));sticker.width=w+pad*2;sticker.height=h+pad*2;
  const out=sticker.getContext("2d");if(!out)throw new Error("canvas");
  const radius=Math.max(18,Math.round(Math.min(w,h)*.05));out.fillStyle="#fffaf3";out.beginPath();out.roundRect(0,0,sticker.width,sticker.height,radius);out.fill();
  out.save();out.beginPath();out.roundRect(pad,pad,w,h,Math.max(12,radius-pad/2));out.clip();out.drawImage(canvas,pad,pad);out.restore();
  return sticker.toDataURL("image/webp",.84);
}

function Editor({modal,close,update,notify,timer,setTimer}:{modal:Exclude<Modal,null>;close:()=>void;update:(f:(d:WorkspaceData)=>WorkspaceData)=>void;notify:(x:string)=>void;timer:{running:boolean;end:number;remaining:number};setTimer:React.Dispatch<React.SetStateAction<{running:boolean;end:number;remaining:number}>>}){
  const [form,setForm]=useState<Record<string,string>>({});
  const [step,setStep]=useState(0);
  const [processing,setProcessing]=useState(false);
  const set=(k:string,v:string)=>setForm(f=>({...f,[k]:v}));
  async function readPhoto(file:File|undefined,cartoon=false){if(!file)return;setProcessing(true);try{set("photo",await processLocalPhoto(file,cartoon))}catch{notify("照片处理失败，请换一张照片重试")}finally{setProcessing(false)}}
  function save(){
    if(modal==="task"){if(!form.title)return notify("请填写任务名称");update(d=>({...d,tasks:[...d.tasks,{id:crypto.randomUUID(),title:form.title,next:form.next||"明确下一步并开始",standard:form.standard||"达到预期结果",minutes:+form.minutes||30,category:form.category||"其他",priority:form.priority||"普通",done:false}]}));}
    if(modal==="temporary"){if(!form.title)return notify("请填写任务名称");update(d=>({...d,temporary:[...d.temporary,{id:crypto.randomUUID(),title:form.title,deadline:form.deadline||"",priority:form.priority||"普通",done:false}]}));}
    if(modal==="expense"){if(!+form.amount)return notify("请输入正确金额");update(d=>({...d,transactions:[{id:crypto.randomUUID(),amount:+form.amount,type:form.type||"支出",category:form.category||"餐饮",note:form.note||"",date:new Date().toISOString().slice(0,10)},...d.transactions]}));}
    if(modal==="weight"){if(!+form.value)return notify("请输入正确体重");update(d=>({...d,weights:[...d.weights,{id:crypto.randomUUID(),value:+form.value,date:new Date().toISOString().slice(0,10)}]}));}
    if(modal==="drink"){if(!form.name)return notify("请填写饮品名称");update(d=>({...d,drinks:[{id:crypto.randomUUID(),name:form.name,type:form.type||"其他饮品",amount:form.amount?+form.amount:null,photo:form.photo||"",date:new Date().toISOString().slice(0,10),time:new Date().toLocaleTimeString("zh-CN",{hour:"2-digit",minute:"2-digit"})},...d.drinks],health:{...d.health,water:d.health.water+(form.amount?+form.amount:0)}}));}
    if(modal==="outfit"){if(!form.photo)return notify("请先上传一张穿搭照片");update(d=>({...d,outfits:[{id:crypto.randomUUID(),photo:form.photo,date:new Date().toISOString().slice(0,10),occasion:form.occasion||"",mood:form.mood||"",note:form.note||""},...d.outfits]}));}
    if(modal==="period"){if(!form.startDate)return notify("请选择开始日期");update(d=>({...d,periods:[...d.periods,{id:crypto.randomUUID(),startDate:form.startDate,endDate:form.endDate||"",flow:form.flow||"",note:form.note||""}].sort((a,b)=>a.startDate.localeCompare(b.startDate))}));}
    if(modal==="note"){if(!form.title)return notify("请填写标题");update(d=>({...d,notes:[{id:crypto.randomUUID(),type:form.type||"灵感",title:form.title,content:form.content||"",action:form.action||""},...d.notes]}));}
    notify("已保存到本设备");close();
  }
  if(modal==="focus"){const mm=String(Math.floor(timer.remaining/60)).padStart(2,"0"),ss=String(timer.remaining%60).padStart(2,"0");return <div className="modal-backdrop"><div className="modal focus-modal"><button className="modal-close" onClick={close}><X/></button><span className="eyebrow">专注当下</span><h2>完成一轮 AI 训练测试</h2><div className="timer-display">{mm}:{ss}</div><p>情绪可以暂时存在，但我先完成手上的这一小步。</p><div className="timer-presets">{[15,25,45].map(v=><button onClick={()=>setTimer({running:false,end:0,remaining:v*60})} key={v}>{v} 分钟</button>)}</div><div className="focus-actions"><button className="primary large" onClick={()=>setTimer(t=>t.running?{...t,running:false}:{...t,running:true,end:Date.now()+t.remaining*1000})}>{timer.running?<><Pause/>暂停</>:<><Play/>开始</>}</button><button className="secondary" onClick={()=>{setTimer({running:false,end:0,remaining:25*60});update(d=>({...d,focusSessions:d.focusSessions+1}));notify("本轮专注已记录");close();}}>提前结束并记录</button></div></div></div>}
  if(modal==="emotion"){const prompts=[["我看到的 5 样东西","慢慢环顾四周，把看到的东西写下来"],["我听到的 3 种声音","注意远近不同的声音"],["身体接触到的 2 个位置","例如双脚接触地面、背部接触椅背"],["我现在准备完成的 1 件事","只选一件很小、可以马上开始的事"]];return <div className="modal-backdrop"><div className="modal emotion-modal"><button className="modal-close" onClick={close}><X/></button><span className="eyebrow">5 · 3 · 2 · 1 落地练习</span><div className="step-indicator">{prompts.map((_,i)=><i className={i<=step?"active":""} key={i}/>)}</div><h2>{prompts[step][0]}</h2><p>{prompts[step][1]}</p><textarea autoFocus value={form[`s${step}`]||""} onChange={e=>set(`s${step}`,e.target.value)} placeholder="写在这里…"/><button className="primary full" onClick={()=>step<3?setStep(step+1):(notify("我已经回到此刻。现在先做眼前这一件事。"),close())}>{step<3?"下一步":"完成练习"}</button></div></div>}
  const titles:{[K in Exclude<Modal,null|"focus"|"emotion">]:string}={task:"添加今日任务",expense:"快速记一笔",temporary:"添加临时任务",weight:"记录体重",drink:"记录每日饮品",outfit:"记录今日穿搭",period:"记录姨妈周期",note:"添加学习笔记"};
  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&close()}><div className="modal form-modal"><button className="modal-close" onClick={close}><X/></button><span className="eyebrow">BackToSelf Workspace</span><h2>{titles[modal as keyof typeof titles]}</h2>
    {modal==="task"&&<><Field label="任务名称"><input autoFocus value={form.title||""} onChange={e=>set("title",e.target.value)} placeholder="例如：完成一轮 AI 训练测试"/></Field><div className="form-grid"><Field label="类型"><select onChange={e=>set("category",e.target.value)}><option>AI训练</option><option>提示词测试</option><option>素材整理</option><option>学习研究</option><option>生活事务</option><option>其他</option></select></Field><Field label="优先级"><select onChange={e=>set("priority",e.target.value)}><option>重要不紧急</option><option>紧急重要</option><option>普通</option><option>可延后</option></select></Field></div><Field label="预计时长（分钟）"><input type="number" min="5" value={form.minutes||"30"} onChange={e=>set("minutes",e.target.value)}/></Field><Field label="具体下一步"><textarea value={form.next||""} onChange={e=>set("next",e.target.value)} placeholder="15–30 分钟内能完成什么？"/></Field><Field label="完成标准"><textarea value={form.standard||""} onChange={e=>set("standard",e.target.value)} placeholder="怎样算完成？"/></Field></>}
    {modal==="temporary"&&<><Field label="任务名称"><input autoFocus value={form.title||""} onChange={e=>set("title",e.target.value)} placeholder="突然出现的事情"/></Field><Field label="截止日期（可选）"><input type="date" onChange={e=>set("deadline",e.target.value)}/></Field><Field label="优先级"><select onChange={e=>set("priority",e.target.value)}><option>普通</option><option>紧急重要</option><option>重要不紧急</option><option>可延后</option></select></Field></>}
    {modal==="expense"&&<><Field label="金额"><div className="money-input"><span>¥</span><input autoFocus type="number" inputMode="decimal" value={form.amount||""} onChange={e=>set("amount",e.target.value)} placeholder="0.00"/></div></Field><div className="form-grid"><Field label="类型"><select onChange={e=>set("type",e.target.value)}><option>支出</option><option>收入</option><option>转账</option></select></Field><Field label="分类"><select onChange={e=>set("category",e.target.value)}><option>餐饮</option><option>交通</option><option>购物</option><option>学习</option><option>医疗</option><option>工作</option><option>其他</option></select></Field></div><Field label="备注"><input value={form.note||""} onChange={e=>set("note",e.target.value)} placeholder="这笔钱花在哪里？"/></Field></>}
    {modal==="weight"&&<><Field label="体重（kg）"><input autoFocus type="number" inputMode="decimal" step=".1" value={form.value||""} onChange={e=>set("value",e.target.value)} placeholder="例如 62.5"/></Field><div className="privacy-note">体重只是身体状态的一项记录，不代表你的价值。每周记录一次就足够了。</div></>}
    {modal==="drink"&&<><div className="photo-upload">{processing?<div className="photo-processing"><Sparkles/><b>正在变成卡通贴纸…</b><span>全部处理都在本机完成</span></div>:form.photo?<img src={form.photo} alt="饮品卡通贴纸预览"/>:<div><Camera size={28}/><b>添加一张饮品照片</b><span>上传后自动生成卡通贴纸</span></div>}</div><div className="photo-actions"><label className="secondary"><Camera size={17}/>打开相机<input type="file" accept="image/*" capture="environment" onChange={e=>readPhoto(e.target.files?.[0],true)}/></label><label className="secondary"><Upload size={17}/>从相册选择<input type="file" accept="image/*" onChange={e=>readPhoto(e.target.files?.[0],true)}/></label></div><div className="form-grid"><Field label="饮品名称"><input autoFocus value={form.name||""} onChange={e=>set("name",e.target.value)} placeholder="例如：燕麦拿铁"/></Field><Field label="饮品类型"><select onChange={e=>set("type",e.target.value)}><option>咖啡</option><option>茶</option><option>牛奶</option><option>果汁</option><option>气泡水</option><option>其他饮品</option></select></Field></div><Field label="大约容量（ml，可选）"><input type="number" inputMode="numeric" value={form.amount||""} onChange={e=>set("amount",e.target.value)} placeholder="例如 350"/></Field><div className="cartoon-note"><CupSoda/><span>照片会在本机完成颜色简化、轮廓强化和贴纸白边，不会上传到服务器。</span></div></>}
    {modal==="outfit"&&<><div className="photo-upload outfit-preview">{processing?<div className="photo-processing"><Sparkles/><b>正在整理照片…</b></div>:form.photo?<img src={form.photo} alt="今日穿搭预览"/>:<div><Shirt size={28}/><b>上传今日穿搭</b><span>保留照片原貌，用 Lookbook 卡片展示</span></div>}</div><div className="photo-actions"><label className="secondary"><Camera size={17}/>拍摄穿搭<input type="file" accept="image/*" capture="environment" onChange={e=>readPhoto(e.target.files?.[0])}/></label><label className="secondary"><Upload size={17}/>从相册选择<input type="file" accept="image/*" onChange={e=>readPhoto(e.target.files?.[0])}/></label></div><div className="form-grid"><Field label="场合（可选）"><select value={form.occasion||""} onChange={e=>set("occasion",e.target.value)}><option value="">日常</option><option>上班</option><option>约会</option><option>运动</option><option>旅行</option><option>居家</option></select></Field><Field label="今天的感觉"><select value={form.mood||""} onChange={e=>set("mood",e.target.value)}><option value="">暂不填写</option><option>舒服自在</option><option>清爽利落</option><option>温柔松弛</option><option>有点特别</option></select></Field></div><Field label="穿搭备注（可选）"><input value={form.note||""} onChange={e=>set("note",e.target.value)} placeholder="例如：第一次尝试这组配色"/></Field></>}
    {modal==="period"&&<><div className="form-grid"><Field label="开始日期"><input autoFocus type="date" value={form.startDate||""} onChange={e=>set("startDate",e.target.value)}/></Field><Field label="结束日期（可稍后补充）"><input type="date" value={form.endDate||""} onChange={e=>set("endDate",e.target.value)}/></Field></div><Field label="经量感受（可选）"><select value={form.flow||""} onChange={e=>set("flow",e.target.value)}><option value="">暂不记录</option><option>较少</option><option>正常</option><option>较多</option></select></Field><Field label="身体感受或备注（可选）"><textarea value={form.note||""} onChange={e=>set("note",e.target.value)} placeholder="例如：第一天有轻微腹痛，今天想多休息。"/></Field><div className="privacy-note">周期预测仅作个人记录参考，不能替代医疗建议或作为避孕依据。</div></>}
    {modal==="note"&&<><div className="form-grid"><Field label="类型"><select onChange={e=>set("type",e.target.value)}><option>灵感</option><option>播客笔记</option><option>读书笔记</option></select></Field><Field label="标题"><input autoFocus value={form.title||""} onChange={e=>set("title",e.target.value)} placeholder="笔记标题"/></Field></div><Field label="核心内容"><textarea value={form.content||""} onChange={e=>set("content",e.target.value)} placeholder="对我真正有用的内容…"/></Field><Field label="可以采取的行动"><input value={form.action||""} onChange={e=>set("action",e.target.value)} placeholder="可一键转为任务"/></Field></>}
    <div className="modal-actions"><button className="secondary" onClick={close}>取消</button><button className="primary" onClick={save}>保存</button></div></div></div>
}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="field">{label}{children}</label>}
