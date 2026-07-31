"use client";
/* eslint-disable @next/next/no-img-element */

import {
  Activity, BarChart3, BookOpen, CalendarDays, Camera, Check, ChevronLeft, ChevronRight, CircleDollarSign,
  Clock3, Download, Droplets, HeartHandshake, Home, ListTodo, LogIn, LogOut, MapPin, Menu, Moon,
  CupSoda, Flower2, NotebookPen, Pause, Pencil, Play, Plus, RotateCcw, Search, Settings, Shirt, Sparkles, Trash2,
  Upload, UserRound, WalletCards, X
} from "lucide-react";
import { useEffect, useState } from "react";
import { loadWorkspace, normalizeWorkspace, saveWorkspace, type WorkspaceData, seedData } from "@/lib/db";
import {
  addDaysKey,
  buildMonthCalendar,
  checkinDurationMinutes,
  endOfWeekKey,
  estimateCyclePhases,
  expenseByCategory,
  focusMinutesFromSeconds,
  focusTimerSnapshot,
  inDateRange,
  localDateKey,
  monthBounds,
  normalizeFocusMinutes,
  normalizeMoney,
  periodsOverlap,
  rangeStartKey,
  schedulesForDate,
  startOfWeekKey,
  summarizeHealth,
  summarizeTransactions,
  weightChange,
  type FocusTimerLike,
} from "@/lib/logic";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

type Page = "today" | "tasks" | "calendar" | "temporary" | "focusData" | "checkins" | "health" | "weight" | "finance" | "growth" | "emotion" | "weekly" | "monthly" | "trends" | "settings";
type Modal = null | "task" | "schedule" | "expense" | "temporary" | "weight" | "drink" | "outfit" | "period" | "focus" | "emotion" | "note";
type EditingItem=
  |{kind:"task";value:WorkspaceData["tasks"][number]}
  |{kind:"transaction";value:WorkspaceData["transactions"][number]}
  |{kind:"drink";value:WorkspaceData["drinks"][number]}
  |{kind:"weight";value:WorkspaceData["weights"][number]};
type FontChoice = "cute" | "system" | "rounded";

const nav: { id: Page; label: string; icon: typeof Home }[] = [
  { id: "today", label: "今日首页", icon: Home }, { id: "tasks", label: "每日任务", icon: ListTodo },
  { id: "calendar", label: "日历日程", icon: CalendarDays }, { id: "temporary", label: "临时任务", icon: NotebookPen },
  { id: "focusData", label: "专注记录", icon: Clock3 },
  { id: "checkins", label: "到达与离开打卡", icon: MapPin },
  { id: "health", label: "生活与健康", icon: Activity },
  { id: "finance", label: "记账本", icon: WalletCards }, { id: "growth", label: "学习成长", icon: BookOpen },
  { id: "emotion", label: "情绪暂停", icon: HeartHandshake }, { id: "weekly", label: "每周计划与复盘", icon: Sparkles },
  { id: "monthly", label: "每月总结", icon: CalendarDays },
  { id: "trends", label: "历史趋势", icon: BarChart3 }, { id: "settings", label: "设置与数据", icon: Settings },
];

const pageTitle: Record<Page, [string, string]> = {
  today:["今日","把注意力放回此刻"], tasks:["每日任务","清楚地完成，不把一天塞满"], calendar:["日历日程","为重要的事留出时间"],
  temporary:["临时任务","先接住，再安排"], focusData:["专注记录","按天累积，看见自己的专注时间"], checkins:["到达与离开打卡","到达时开始，离开时为这段行动收尾"], health:["生活与健康","身体、饮品、穿搭、体重与周期，都在这里温和记录"], weight:["生活与健康","观察身体，不做评判"],
  finance:["个人记账","看见钱的去向，不制造消费焦虑"], growth:["学习成长","把输入变成自己的行动"], emotion:["情绪暂停","情绪可以存在，但不必立刻行动"],
  weekly:["每周计划与复盘","只统计所选自然周的数据"], monthly:["每月总结","按自然月看见真实变化"], trends:["历史趋势","从变化中了解自己"], settings:["设置与数据","数据只属于你"],
};

type DailyHealth=WorkspaceData["healthRecords"][number];
type TimerState=FocusTimerLike;
function countdownTimer(minutes=25):TimerState{
  const durationSeconds=normalizeFocusMinutes(minutes)*60;
  return {mode:"countdown",running:false,endAt:0,startedAt:0,remainingSeconds:durationSeconds,elapsedSeconds:0,durationSeconds};
}
function stopwatchTimer():TimerState{
  return {mode:"stopwatch",running:false,endAt:0,startedAt:0,remainingSeconds:0,elapsedSeconds:0,durationSeconds:0};
}
function loadTimerState():TimerState{
  if(typeof window==="undefined")return countdownTimer();
  try{
    const saved=localStorage.getItem("bts-timer");
    if(!saved)return countdownTimer();
    const parsed=JSON.parse(saved);
    if(parsed.mode==="stopwatch"){
      const elapsedSeconds=Math.max(0,Math.round(Number(parsed.elapsedSeconds)||0));
      const running=Boolean(parsed.running);
      return {
        ...stopwatchTimer(),running,elapsedSeconds,
        startedAt:running?(Number(parsed.startedAt)||Date.now()-elapsedSeconds*1000):0,
      };
    }
    const durationSeconds=normalizeFocusMinutes(
      Number(parsed.durationSeconds)/60||parsed.plannedMinutes||25,
    )*60;
    const savedRemaining=Number(parsed.remainingSeconds??parsed.remaining);
    const remainingSeconds=Math.min(durationSeconds,Math.max(0,Math.round(
      Number.isFinite(savedRemaining)?savedRemaining:durationSeconds,
    )));
    const endAt=Number(parsed.endAt??parsed.end)||0;
    return {
      ...countdownTimer(durationSeconds/60),
      running:Boolean(parsed.running&&endAt),
      endAt,
      remainingSeconds,
    };
  }catch{return countdownTimer()}
}
function formatFocusTime(seconds:number){
  const safe=Math.max(0,Math.floor(seconds));
  const hours=Math.floor(safe/3600);
  const minutes=Math.floor((safe%3600)/60);
  const secs=safe%60;
  return hours
    ?`${String(hours).padStart(2,"0")}:${String(minutes).padStart(2,"0")}:${String(secs).padStart(2,"0")}`
    :`${String(minutes).padStart(2,"0")}:${String(secs).padStart(2,"0")}`;
}
const blankHealth=(date:string):DailyHealth=>({date,status:"",sleep:null,water:0,meals:null});
function healthOn(records:DailyHealth[],date:string){return records.find(item=>item.date===date)||blankHealth(date)}
function upsertHealth(records:DailyHealth[],date:string,patch:Partial<DailyHealth>){
  const current=healthOn(records,date);
  return [...records.filter(item=>item.date!==date),{...current,...patch,date}].sort((a,b)=>a.date.localeCompare(b.date));
}

export default function HomePage() {
  const [data, setData] = useState<WorkspaceData>(seedData);
  const [page, setPage] = useState<Page>("today");
  const [modal, setModal] = useState<Modal>(null);
  const [editingItem,setEditingItem]=useState<EditingItem|null>(null);
  const [scheduleDate, setScheduleDate] = useState(localDateKey());
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState("");
  const [query, setQuery] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [theme, setTheme] = useState<"light"|"dark">("light");
  const [font, setFont] = useState<FontChoice>(() => {
    if (typeof window === "undefined") return "cute";
    return (localStorage.getItem("orange-workspace-font") as FontChoice) || "cute";
  });
  const [timer, setTimer] = useState<TimerState>(loadTimerState);

  useEffect(() => { loadWorkspace().then(v => { setData(v); setReady(true); }); }, []);
  useEffect(() => { if ("serviceWorker" in navigator) navigator.serviceWorker.register(`${basePath}/sw.js`).catch(()=>{}); }, []);
  useEffect(() => { if (ready) saveWorkspace(data); }, [data, ready]);
  useEffect(() => { localStorage.setItem("bts-timer", JSON.stringify(timer)); }, [timer]);
  useEffect(() => { localStorage.setItem("orange-workspace-font", font); }, [font]);
  useEffect(() => {
    if (!ready||!timer.running) return;
    const tick=()=>{
      const snapshot=focusTimerSnapshot(timer);
      if(timer.mode==="countdown"){
        if(snapshot.completed){
          setTimer(t=>({...t,running:false,endAt:0,remainingSeconds:0,elapsedSeconds:t.durationSeconds}));
          const minutes=focusMinutesFromSeconds(timer.durationSeconds);
          update(d=>({...d,focusSessions:d.focusSessions+1,focusRecords:[...d.focusRecords,{id:crypto.randomUUID(),date:localDateKey(),minutes,completedAt:new Date().toISOString()}]}));
          notify(`倒计时完成，已记录 ${minutes} 分钟专注`);
        }else{
          setTimer(t=>t.mode==="countdown"&&t.remainingSeconds!==snapshot.displaySeconds?{...t,remainingSeconds:snapshot.displaySeconds}:t);
        }
      }else{
        setTimer(t=>t.mode==="stopwatch"&&t.elapsedSeconds!==snapshot.elapsedSeconds?{...t,elapsedSeconds:snapshot.elapsedSeconds}:t);
      }
    };
    tick();
    const id = setInterval(() => {
      tick();
    },1000);
    return () => clearInterval(id);
  }, [ready,timer]);

  function update(fn:(d:WorkspaceData)=>WorkspaceData){ setData(current=>({...fn(current),updatedAt:new Date().toISOString()})); }
  function notify(msg:string){ setToast(msg); setTimeout(()=>setToast(""),2400); }
  const completed = data.tasks.filter(t=>t.done).length;
  const todayKey = localDateKey();
  const monthKey = todayKey.slice(0,7);
  const todayFinance = summarizeTransactions(data.transactions,todayKey);
  const monthFinance = summarizeTransactions(data.transactions,monthKey);
  const todayLabel = new Intl.DateTimeFormat("zh-CN",{month:"long",day:"numeric",weekday:"long"}).format(new Date());

  function toggleTask(id:string){ update(d=>({...d,tasks:d.tasks.map(t=>t.id===id?{...t,done:!t.done,completedDate:t.done?"":todayKey}:t)})); }
  function remove(kind:"tasks"|"temporary"|"transactions"|"notes",id:string){
    if (!confirm("确定删除这条记录吗？删除后可通过数据备份恢复。")) return;
    update(d=>({...d,[kind]:d[kind].filter((x:{id:string})=>x.id!==id)})); notify("已删除");
  }
  function removeSchedule(id:string){
    if (!confirm("确定删除这项日程吗？")) return;
    update(d=>({...d,schedule:d.schedule.filter(item=>item.id!==id)})); notify("日程已删除");
  }
  function arriveCheckin(task:WorkspaceData["tasks"][number]){
    if(data.checkins.some(item=>item.taskId===task.id&&!item.leftAt))return notify("这项任务已经到达打卡，请离开后再开始下一次");
    const place=task.checkinPlace?.trim()||task.title;
    const arrivedAt=new Date().toISOString();
    update(d=>({...d,checkins:[{id:crypto.randomUUID(),taskId:task.id,title:task.title,place,date:localDateKey(),arrivedAt,leftAt:""},...d.checkins]}));
    notify(`已到达${place}，现在可以安心开始了`);
  }
  function leaveCheckin(id:string){
    const current=data.checkins.find(item=>item.id===id);
    if(!current||current.leftAt)return notify("这次打卡已经结束");
    const leftAt=new Date().toISOString();
    const minutes=checkinDurationMinutes(current.arrivedAt,leftAt);
    update(d=>({...d,checkins:d.checkins.map(item=>item.id===id?{...item,leftAt}:item)}));
    notify(`已离开${current.place}，本次停留 ${formatFocusTotal(minutes)}`);
  }
  function exportJson(){
    download(`橙子成长工作台-数据备份-${localDateKey()}.json`,JSON.stringify(data,null,2),"application/json");
  }
  function download(name:string,text:string,type:string){ const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([text],{type})); a.download=name;a.click();URL.revokeObjectURL(a.href); }
  async function importFile(file:File){ try{ const parsed=JSON.parse(await file.text()); if(!parsed.schemaVersion||!Array.isArray(parsed.tasks)) throw new Error(); setData({...normalizeWorkspace(parsed),updatedAt:new Date().toISOString()});notify("数据已恢复，并已升级为新版格式"); }catch{notify("无法导入：文件格式不正确");} }
  function openSchedule(date=localDateKey()){setScheduleDate(date);setModal("schedule")}
  function setDefaultFocusMinutes(value:unknown){
    const minutes=normalizeFocusMinutes(value,data.settings.focusMinutes);
    update(d=>({...d,settings:{...d.settings,focusMinutes:minutes}}));
    if(!timer.running)setTimer(countdownTimer(minutes));
  }

  const ownerName=data.profile.name.trim();
  const workspaceName=ownerName?`${ownerName}的工作台`:"我的工作台";
  useEffect(()=>{if(ready)document.title=workspaceName},[ready,workspaceName]);

  if (!ready) return <div className="loading"><div className="breath"/><p>正在打开橙子成长工作台…</p></div>;
  return <div className={`app${theme==="dark"?" dark":""} font-${font}`}>
    <aside className="sidebar">
      <div className="brand"><img className="brand-logo" src={`${basePath}/icon.png`} alt={workspaceName}/><div><b>{workspaceName}</b><span>MY GROWTH SPACE</span></div></div>
      <nav>{nav.map(n=><button key={n.id} className={page===n.id?"active":""} onClick={()=>setPage(n.id)}><n.icon size={18}/>{n.label}</button>)}</nav>
      <div className="side-quote">慢一点也没关系，把今天过得清楚一点。</div>
    </aside>
    <main>
      <header className="topbar">
        <button className="icon mobile-only" onClick={()=>setMobileMenu(true)} aria-label="打开菜单"><Menu/></button>
        <div><h1>{pageTitle[page][0]}</h1><p>{pageTitle[page][1]}</p></div>
        <div className="top-actions"><div className="search"><Search size={17}/><input aria-label="全局搜索" value={query} onChange={e=>setQuery(e.target.value)} placeholder="搜索任务、笔记、账单…"/></div><button className="avatar" onClick={()=>setPage("settings")}>自</button></div>
      </header>
      <div className="content">
        {query ? <SearchResults data={data} query={query} go={setPage}/> :
        page==="today" ? <Today data={data} completed={completed} todayExpense={todayFinance.expense} todayTransactions={todayFinance.count} today={todayLabel} open={setModal} go={setPage} toggle={toggleTask} update={update}/> :
        page==="tasks" ? <Tasks data={data} toggle={toggleTask} open={setModal} edit={item=>{setEditingItem({kind:"task",value:item});setModal("task")}} remove={remove} arrive={arriveCheckin} leave={leaveCheckin}/> :
        page==="calendar" ? <Calendar data={data} open={setModal} openSchedule={openSchedule} removeSchedule={removeSchedule}/> :
        page==="temporary" ? <Temporary data={data} open={setModal} remove={remove} update={update}/> :
        page==="focusData" ? <FocusInsights data={data}/> :
        page==="checkins" ? <CheckinInsights data={data} update={update} notify={notify} leave={leaveCheckin}/> :
        page==="health" ? <Health data={data} update={update} notify={notify}/> :
        page==="weight" ? <Weight data={data} open={setModal}/> :
        page==="finance" ? <Finance data={data} update={update} income={monthFinance.income} expense={monthFinance.expense} balance={monthFinance.balance} monthKey={monthKey} open={setModal} edit={item=>{setEditingItem({kind:"transaction",value:item});setModal("expense")}} remove={remove}/> :
        page==="growth" ? <Growth data={data} open={setModal} remove={remove} update={update}/> :
        page==="emotion" ? <Emotion data={data} open={setModal}/> :
        page==="weekly" ? <Weekly data={data} update={update} download={download}/> :
        page==="monthly" ? <Monthly data={data}/> :
        page==="trends" ? <Trends data={data}/> :
        <SettingsPage data={data} update={update} theme={theme} setTheme={setTheme} font={font} setFont={setFont} setDefaultFocusMinutes={setDefaultFocusMinutes} exportJson={exportJson} importFile={importFile} reset={()=>{if(confirm("确定清空全部数据吗？建议先导出备份，此操作无法撤销。")){setData({...seedData,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});setTimer(countdownTimer())}}}/>}
      </div>
    </main>
    <nav className="bottom-nav">
      {[["today","今日",Home],["calendar","日历",CalendarDays],["temporary","记录",Plus],["health","健康",Activity],["settings","我的",UserRound]].map(([id,label,Icon])=><button key={id as string} className={page===id?"active":""} onClick={()=>setPage(id as Page)}><Icon size={21}/><span>{label as string}</span></button>)}
    </nav>
    {mobileMenu&&<div className="drawer-backdrop" onClick={()=>setMobileMenu(false)}><div className="drawer" onClick={e=>e.stopPropagation()}><div className="drawer-title"><b>全部功能</b><button className="icon" onClick={()=>setMobileMenu(false)}><X/></button></div>{nav.map(n=><button key={n.id} onClick={()=>{setPage(n.id);setMobileMenu(false)}}><n.icon size={19}/>{n.label}</button>)}</div></div>}
    {modal&&<Editor modal={modal} close={()=>{setModal(null);setEditingItem(null)}} update={update} notify={notify} timer={timer} setTimer={setTimer} goFocusData={()=>{setModal(null);setEditingItem(null);setPage("focusData")}} workspaceName={workspaceName} defaultScheduleDate={scheduleDate} workspaceData={data} editingItem={editingItem}/>}
    {toast&&<div className="toast" role="status" aria-live="polite"><Check size={17}/>{toast}</div>}
  </div>;
}

function Today({data,completed,todayExpense,todayTransactions,today,open,go,toggle,update}:{data:WorkspaceData;completed:number;todayExpense:number;todayTransactions:number;today:string;open:(m:Modal)=>void;go:(p:Page)=>void;toggle:(id:string)=>void;update:(f:(d:WorkspaceData)=>WorkspaceData)=>void}){
  const main=data.tasks.find(t=>t.important) || data.tasks[0];
  const todaySchedule=schedulesForDate(data.schedule,localDateKey());
  const todayHealth=healthOn(data.healthRecords,localDateKey());
  return <><section className="hello"><div><span className="eyebrow">{today}</span><h2>{data.profile.name.trim()?`${data.profile.name.trim()}，今天想从哪件小事开始？`:"今天想从哪件小事开始？"}</h2><p>按自己的节奏来，先做好此刻最重要的一件事。</p></div><div className="status-select"><label>今日状态</label><select value={todayHealth.status} onChange={e=>update(d=>({...d,status:"",healthRecords:upsertHealth(d.healthRecords,localDateKey(),{status:e.target.value})}))}><option value="">选择今天的状态</option><option>精力正常</option><option>状态很好</option><option>有点疲惫</option><option>情绪波动</option><option>很需要休息</option></select></div></section>
  {(todayHealth.status==="情绪波动"||todayHealth.status==="很需要休息")&&<div className="gentle-banner"><Moon size={20}/><div><b>今天可以少安排一点</b><p>先照顾身体，只保留真正必要的一件事。</p></div></div>}
  <section className="summary-grid today-summary">
    <Summary icon={ListTodo} title="今日待办" value={`${completed}/${data.tasks.length}`} note={main?.title||"还没有任务"} progress={data.tasks.length?completed/data.tasks.length:0} onClick={()=>go("tasks")}/>
    <Summary icon={CircleDollarSign} title="今日支出" value={`¥${todayExpense.toFixed(2)}`} note={`${todayTransactions} 笔今日记录`} action="快速记一笔" onAction={()=>open("expense")}/>
    <Summary icon={NotebookPen} title="临时任务" value={`${data.temporary.filter(t=>!t.done).length} 项`} note={data.temporary[0]?.title||"暂无临时任务"} onClick={()=>go("temporary")}/>
  </section>
  {main&&<section className="focus-card"><div className="focus-top"><div><span className="eyebrow">今日最重要任务</span><h2>{main.title}</h2></div><span className="duration"><Clock3 size={16}/>{main.minutes} 分钟</span></div><div className="focus-details"><div><span>具体下一步</span><p>{main.next}</p></div><div><span>完成标准</span><p>{main.standard}</p></div></div><div className="focus-actions"><button className="primary" onClick={()=>open("focus")}><Play size={17}/>开始专注</button><button className="secondary" onClick={()=>toggle(main.id)}>{main.done?"恢复任务":"标记完成"}</button></div></section>}
  <section className="panel"><div className="panel-head"><div><span className="eyebrow">时间轴</span><h3>接下来的安排</h3></div><button className="text-btn" onClick={()=>go("calendar")}>查看全部<ChevronRight size={15}/></button></div>{todaySchedule.length?<div className="timeline">{todaySchedule.map((x,i)=><div className="time-row" key={x.id}><time>{x.time}</time><span className={i===0?"dot current":"dot"}/><div><b>{x.title}</b><p>{x.type}</p></div></div>)}</div>:<Empty title="今天还没有日程" note="给今天留一点空间，或去日历安排之后的计划。"/>}</section></>
}

function Summary({icon:Icon,title,value,note,progress,action,onAction,onClick}:{icon:typeof Home;title:string;value:string;note:string;progress?:number;action?:string;onAction?:()=>void;onClick?:()=>void}){return <article className="summary-card" onClick={onClick}><div className="summary-icon"><Icon size={18}/></div><span>{title}</span><strong>{value}</strong><p>{note}</p>{progress!==undefined&&<div className="progress" aria-label={`完成进度${Math.round(progress*100)}%`}><i style={{width:`${progress*100}%`}}/></div>}{action&&<button className="text-btn" onClick={e=>{e.stopPropagation();onAction?.()}}>{action}<Plus size={15}/></button>}</article>}

function Tasks({data,toggle,open,edit,remove,arrive,leave}:{data:WorkspaceData;toggle:(id:string)=>void;open:(m:Modal)=>void;edit:(item:WorkspaceData["tasks"][number])=>void;remove:(k:"tasks",id:string)=>void;arrive:(task:WorkspaceData["tasks"][number])=>void;leave:(id:string)=>void}){
  return <section className="panel page-panel"><div className="panel-head"><div><span className="eyebrow">今日看板</span><h2>{data.tasks.filter(t=>t.done).length}/{data.tasks.length} 项已完成</h2><p>预计 {data.tasks.reduce((s,t)=>s+t.minutes,0)} 分钟</p></div><button className="primary" onClick={()=>open("task")}><Plus size={17}/>添加任务</button></div><div className="task-list">{data.tasks.map(t=>{
    const active=data.checkins.find(item=>item.taskId===t.id&&!item.leftAt);
    return <div className="task-row" key={t.id}><button className={t.done?"check done":"check"} aria-label={t.done?"恢复任务":"完成任务"} onClick={()=>toggle(t.id)}>{t.done&&<Check size={15}/>}</button><div className={t.done?"task-main completed":"task-main"}><b>{t.title}</b><p>{t.next}</p><div className="chips"><span>{t.category}</span><span>{t.priority}</span><span><Clock3 size={12}/>{t.minutes} 分钟</span>{t.checkinPlace&&<span><MapPin size={12}/>{t.checkinPlace}</span>}</div>{t.checkinPlace&&<button className={`checkin-inline${active?" active":""}`} onClick={()=>active?leave(active.id):arrive(t)}>{active?<><LogOut size={15}/>离开打卡</>:<><LogIn size={15}/>到达打卡</>}</button>}</div><button className="icon" onClick={()=>edit(t)} aria-label="修改任务"><Pencil size={17}/></button><button className="icon danger" onClick={()=>remove("tasks",t.id)} aria-label="删除任务"><Trash2 size={17}/></button></div>
  })}</div>{!data.tasks.length&&<Empty title="今天还没有任务" note="添加任务时可以选择填写打卡地点，到达后给自己一个开始信号。" action="添加第一项" onClick={()=>open("task")}/>}</section>
}

function Calendar({data,open,openSchedule,removeSchedule}:{data:WorkspaceData;open:(m:Modal)=>void;openSchedule:(date:string)=>void;removeSchedule:(id:string)=>void}){
  const now=new Date(),today=localDateKey(now);
  const [viewMonth,setViewMonth]=useState(()=>new Date(now.getFullYear(),now.getMonth(),1));
  const [selectedDate,setSelectedDate]=useState(today);
  const year=viewMonth.getFullYear(),month=viewMonth.getMonth();
  const cells=buildMonthCalendar(year,month);
  const drinksByDate=new Map<string,WorkspaceData["drinks"]>();
  for(const drink of data.drinks){const list=drinksByDate.get(drink.date)||[];list.push(drink);drinksByDate.set(drink.date,list)}
  const scheduleCount=new Map<string,number>();
  for(const item of data.schedule)scheduleCount.set(item.date,(scheduleCount.get(item.date)||0)+1);
  const selectedSchedule=schedulesForDate(data.schedule,selectedDate);
  const selectedDateValue=(()=>{const [y,m,d]=selectedDate.split("-").map(Number);return new Date(y,m-1,d)})();
  const selectedLabel=new Intl.DateTimeFormat("zh-CN",{month:"long",day:"numeric",weekday:"long"}).format(selectedDateValue);
  function changeMonth(offset:number){setViewMonth(current=>new Date(current.getFullYear(),current.getMonth()+offset,1))}
  function selectDay(dateKey:string,inMonth:boolean){setSelectedDate(dateKey);if(!inMonth){const [y,m]=dateKey.split("-").map(Number);setViewMonth(new Date(y,m-1,1))}}
  function backToday(){setSelectedDate(today);setViewMonth(new Date(now.getFullYear(),now.getMonth(),1))}
  return <><section className="panel calendar-panel"><div className="panel-head calendar-title-row"><div><span className="eyebrow">月视图</span><div className="calendar-month-switch"><button className="icon" onClick={()=>changeMonth(-1)} aria-label="上个月"><ChevronLeft size={20}/></button><h2>{year} 年 {month+1} 月</h2><button className="icon" onClick={()=>changeMonth(1)} aria-label="下个月"><ChevronRight size={20}/></button><button className="text-btn" onClick={backToday}>回到今天</button></div><p>选择任意日期查看或添加计划；杯子贴纸仍显示在记录当天。</p></div><div className="calendar-actions"><button className="secondary" onClick={()=>open("drink")}><Camera size={17}/>拍今天的饮品</button><button className="primary" onClick={()=>openSchedule(selectedDate)}><Plus size={17}/>为选中日期添加</button></div></div><div className="calendar-head">{["一","二","三","四","五","六","日"].map(x=><span key={x}>{x}</span>)}</div><div className="calendar-grid">{cells.map(cell=>{const drinks=drinksByDate.get(cell.dateKey)||[],stickers=drinks.filter(x=>x.photo&&x.sticker),count=scheduleCount.get(cell.dateKey)||0;const dayDescription=`${cell.dateKey}${count?`，${count} 项日程`:""}${drinks.length?`，${drinks.length} 条饮品记录`:""}`;return <button key={cell.dateKey} className={`${cell.dateKey===today?"today-day ":""}${cell.dateKey===selectedDate?"selected-day ":""}${!cell.inMonth?"muted-day ":""}${stickers.length?"has-sticker":""}`} title={dayDescription} aria-label={dayDescription} onClick={()=>selectDay(cell.dateKey,cell.inMonth)}><span className="calendar-day-number">{cell.day}</span>{cell.dateKey===today&&<small>今天</small>}{count>0&&<span className="calendar-schedule-count">{count}</span>}{stickers.length?<span className="calendar-stickers">{stickers.slice(0,2).map(x=><img key={x.id} src={x.photo} alt={`${x.name}杯子贴纸`}/>)}</span>:drinks.length?<i/>:null}</button>})}</div><div className="legend"><span>小圆点数字：当天的日程数量</span><span>☕ 杯子贴纸：当天有饮品照片</span></div></section><section className="panel selected-schedule-panel"><div className="panel-head"><div><span className="eyebrow">{selectedDate===today?"今天":"已选日期"}</span><h3>{selectedLabel}的日程</h3></div><button className="primary" onClick={()=>openSchedule(selectedDate)}><Plus size={17}/>添加日程</button></div>{selectedSchedule.length?<div className="timeline">{selectedSchedule.map(x=><div className="time-row schedule-time-row" key={x.id}><time>{x.time}</time><span className="dot"/><div className="schedule-entry"><div><b>{x.title}</b><p>{x.type}</p></div><button className="icon danger" onClick={()=>removeSchedule(x.id)} aria-label={`删除日程：${x.title}`}><Trash2 size={16}/></button></div></div>)}</div>:<Empty title="这一天还没有日程" note="可以先把想做的事安排到这一天。"/>}</section></>
}

function Temporary({data,open,remove,update}:{data:WorkspaceData;open:(m:Modal)=>void;remove:(k:"temporary",id:string)=>void;update:(f:(d:WorkspaceData)=>WorkspaceData)=>void}){return <section className="panel page-panel"><div className="panel-head"><div><span className="eyebrow">任务收件箱</span><h2>先记下来，稍后安排</h2></div><button className="primary" onClick={()=>open("temporary")}><Plus size={17}/>添加临时任务</button></div>{data.temporary.length?data.temporary.map(t=><div className="task-row" key={t.id}><button className={t.done?"check done":"check"} onClick={()=>update(d=>({...d,temporary:d.temporary.map(x=>x.id===t.id?{...x,done:!x.done}:x)}))}>{t.done&&<Check size={15}/>}</button><div className="task-main"><b>{t.title}</b><p>截止：{t.deadline||"无明确日期"} · {t.priority}</p></div><button className="secondary small" onClick={()=>update(d=>({...d,tasks:[...d.tasks,{id:crypto.randomUUID(),title:t.title,next:"确认下一步并开始处理",standard:"任务已处理完成",minutes:30,category:"其他",priority:t.priority,done:false,createdDate:localDateKey(),completedDate:""}],temporary:d.temporary.filter(x=>x.id!==t.id)}))}>安排到今日</button><button className="icon danger" onClick={()=>remove("temporary",t.id)}><Trash2 size={17}/></button></div>):<Empty title="收件箱是空的" note="临时出现的事情，可以先放在这里。" action="添加第一项" onClick={()=>open("temporary")}/>}</section>}

function focusTotal(records:WorkspaceData["focusRecords"],start?:string,end?:string){
  return records.filter(item=>(!start||!end)||inDateRange(item.date,start,end)).reduce((sum,item)=>sum+Math.max(0,Number(item.minutes)||0),0);
}
function formatFocusTotal(minutes:number){
  const safe=Math.max(0,Math.round(minutes));
  const hours=Math.floor(safe/60),rest=safe%60;
  return hours?`${hours} 小时${rest?` ${rest} 分钟`:""}`:`${rest} 分钟`;
}
function FocusInsights({data}:{data:WorkspaceData}){
  const today=localDateKey(),currentWeek=startOfWeekKey(today),currentMonth=today.slice(0,7);
  const [mode,setMode]=useState<"week"|"month">("week");
  const [anchor,setAnchor]=useState(today);
  const monthKey=anchor.slice(0,7);
  const start=mode==="week"?startOfWeekKey(anchor):monthBounds(monthKey).start;
  const end=mode==="week"?endOfWeekKey(anchor):monthBounds(monthKey).end;
  const selected=data.focusRecords.filter(item=>inDateRange(item.date,start,end));
  const daily:{date:string;minutes:number;sessions:number}[]=[];
  for(let date=start;date<=end;date=addDaysKey(date,1)){
    const records=selected.filter(item=>item.date===date);
    const minutes=focusTotal(records);
    if(mode==="week"||minutes>0)daily.push({date,minutes,sessions:records.length});
  }
  const maxDaily=Math.max(1,...daily.map(item=>item.minutes));
  const todayMinutes=focusTotal(data.focusRecords,today,today);
  const weekMinutes=focusTotal(data.focusRecords,currentWeek,endOfWeekKey(today));
  const monthMinutes=focusTotal(data.focusRecords,monthBounds(currentMonth).start,monthBounds(currentMonth).end);
  const allMinutes=focusTotal(data.focusRecords);
  const canNext=mode==="week"?start<currentWeek:monthKey<currentMonth;
  function move(offset:number){
    if(mode==="week")setAnchor(addDaysKey(anchor,offset*7));
    else setAnchor(`${shiftMonth(monthKey,offset)}-01`);
  }
  function selectMode(next:"week"|"month"){setMode(next);setAnchor(today)}
  return <><section className="metric-grid focus-summary-grid"><Metric label="今天" value={formatFocusTotal(todayMinutes)} note={`${data.focusRecords.filter(item=>item.date===today).length} 次专注`}/><Metric label="本周" value={formatFocusTotal(weekMinutes)} note={`${currentWeek} 起`}/><Metric label="本月" value={formatFocusTotal(monthMinutes)} note={currentMonth}/><Metric label="历史累计" value={formatFocusTotal(allMinutes)} note={`${data.focusRecords.length} 次真实记录`}/></section><section className="panel focus-insights"><div className="panel-head focus-period-head"><div><span className="eyebrow">按天自动累积</span><h2>{mode==="week"?`${start} 至 ${end}`:`${monthKey.replace("-"," 年 ")} 月`}</h2><p>本周期共 {selected.length} 次，累计 {formatFocusTotal(focusTotal(selected))}</p></div><div className="seg compact"><button className={mode==="week"?"active":""} onClick={()=>selectMode("week")}>按周</button><button className={mode==="month"?"active":""} onClick={()=>selectMode("month")}>按月</button></div></div><div className="focus-period-nav"><button className="icon" onClick={()=>move(-1)} aria-label={mode==="week"?"上一周":"上个月"}><ChevronLeft/></button><button className="secondary" onClick={()=>setAnchor(today)}>回到当前</button><button className="icon" disabled={!canNext} onClick={()=>move(1)} aria-label={mode==="week"?"下一周":"下个月"}><ChevronRight/></button></div>{daily.length&&daily.some(item=>item.minutes>0)?<div className="focus-daily-list">{daily.map(item=><article key={item.date}><div><b>{new Intl.DateTimeFormat("zh-CN",{month:"numeric",day:"numeric",weekday:"short"}).format(new Date(`${item.date}T12:00:00`))}</b><span>{item.sessions?`${item.sessions} 次`:"未专注"}</span></div><div className="focus-day-bar"><i style={{width:`${item.minutes?Math.max(4,item.minutes/maxDaily*100):0}%`}}/></div><strong>{formatFocusTotal(item.minutes)}</strong></article>)}</div>:<Empty title={mode==="week"?"这一周还没有专注记录":"这个月还没有专注记录"} note="完成一次正计时或倒计时后，会自动按当天累积在这里。"/>}</section></>
}

function CheckinInsights({data,update,notify,leave}:{data:WorkspaceData;update:(f:(d:WorkspaceData)=>WorkspaceData)=>void;notify:(message:string)=>void;leave:(id:string)=>void}){
  const today=localDateKey(),currentMonth=today.slice(0,7);
  const [month,setMonth]=useState(currentMonth);
  const [place,setPlace]=useState("");
  const [editingId,setEditingId]=useState("");
  const [editingPlace,setEditingPlace]=useState("");
  const [deletingId,setDeletingId]=useState("");
  const active=data.checkins.filter(item=>!item.leftAt);
  const selected=[...data.checkins].filter(item=>item.date.startsWith(month)).sort((a,b)=>b.arrivedAt.localeCompare(a.arrivedAt));
  const todayCount=data.checkins.filter(item=>item.date===today).length;
  const currentMonthCount=data.checkins.filter(item=>item.date.startsWith(currentMonth)).length;
  const totalMinutes=data.checkins.reduce((sum,item)=>sum+checkinDurationMinutes(item.arrivedAt,item.leftAt),0);
  function arriveStandalone(){
    const value=place.trim();
    if(!value)return notify("请先填写要打卡的地点或场景");
    if(data.checkins.some(item=>!item.leftAt&&item.place===value))return notify(`${value}已经到达打卡，请先离开`);
    const arrivedAt=new Date().toISOString();
    update(d=>({...d,checkins:[{id:crypto.randomUUID(),taskId:"",title:value,place:value,date:localDateKey(),arrivedAt,leftAt:""},...d.checkins]}));
    setPlace("");
    notify(`已到达${value}，现在可以认真开始了`);
  }
  function startEdit(record:WorkspaceData["checkins"][number]){
    setEditingId(record.id);setEditingPlace(record.place);
  }
  function saveEdit(record:WorkspaceData["checkins"][number]){
    const value=editingPlace.trim();
    if(!value)return notify("地点或场景不能为空");
    update(d=>({...d,checkins:d.checkins.map(item=>item.id===record.id?{...item,place:value,title:item.taskId?item.title:value}:item)}));
    setEditingId("");setEditingPlace("");
    notify("打卡记录已修改");
  }
  function removeRecord(id:string){
    update(d=>({...d,checkins:d.checkins.filter(item=>item.id!==id)}));
    setDeletingId("");
    notify("打卡记录已删除");
  }
  const time=(iso:string)=>iso?new Date(iso).toLocaleTimeString("zh-CN",{hour:"2-digit",minute:"2-digit"}):"";
  return <><section className="metric-grid checkin-summary-grid"><Metric label="今天到达" value={`${todayCount} 次`} note={todayCount?"今天的行动已经留下记录":"今天还没有打卡"}/><Metric label="本月到达" value={`${currentMonthCount} 次`} note={currentMonth.replace("-"," 年 ")+" 月"}/><Metric label="历史累计" value={`${data.checkins.length} 次`} note="每次到达计为一次"/><Metric label="累计停留" value={formatFocusTotal(totalMinutes)} note="含正在进行中的打卡"/></section>
  <section className="panel checkin-start-panel"><div className="panel-head"><div><span className="eyebrow">给自己一个开始信号</span><h2>现在到哪里了？</h2><p>也可以在“每日任务”里填写打卡地点，让任务直接出现到达按钮。</p></div></div><div className="checkin-form"><label><MapPin size={18}/><input value={place} onChange={e=>setPlace(e.target.value)} onKeyDown={e=>e.key==="Enter"&&arriveStandalone()} placeholder="例如：图书馆、公司、健身房"/></label><button className="primary" onClick={arriveStandalone}><LogIn size={17}/>到达打卡</button></div></section>
  {active.length>0&&<section className="panel active-checkins"><div className="panel-head"><div><span className="eyebrow">正在进行</span><h2>{active.length} 个地点尚未离开</h2></div></div><div className="checkin-record-list">{active.map(item=><article className="checkin-record active" key={item.id}><div className="checkin-record-icon"><MapPin/></div><div><b>{item.place}</b><p>{item.taskId&&item.title!==item.place?`${item.title} · `:""}{item.date} {time(item.arrivedAt)} 到达</p><span>已停留 {formatFocusTotal(checkinDurationMinutes(item.arrivedAt))}</span></div><button className="secondary" onClick={()=>leave(item.id)}><LogOut size={16}/>离开打卡</button></article>)}</div></section>}
  <section className="panel checkin-history"><div className="panel-head checkin-month-head"><div><span className="eyebrow">到达次数与停留记录</span><h2>{month.replace("-"," 年 ")} 月 · {selected.length} 次</h2><p>同一天多次到达会分别计数。</p></div><div className="checkin-month-nav"><button className="icon" onClick={()=>setMonth(shiftMonth(month,-1))} aria-label="上个月"><ChevronLeft/></button><button className="secondary" onClick={()=>setMonth(currentMonth)}>本月</button><button className="icon" disabled={month>=currentMonth} onClick={()=>setMonth(shiftMonth(month,1))} aria-label="下个月"><ChevronRight/></button></div></div>{selected.length?<div className="checkin-record-list">{selected.map(item=><article className="checkin-record" key={item.id}><div className="checkin-record-icon"><MapPin/></div><div><b>{item.place}</b><p>{item.taskId&&item.title!==item.place?`${item.title} · `:""}{item.date}</p><span>{time(item.arrivedAt)} 到达 · {item.leftAt?`${time(item.leftAt)} 离开 · 停留 ${formatFocusTotal(checkinDurationMinutes(item.arrivedAt,item.leftAt))}`:"尚未离开"}</span>{editingId===item.id&&<div className="checkin-inline-edit"><input aria-label="修改打卡地点" value={editingPlace} onChange={e=>setEditingPlace(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveEdit(item)} autoFocus/><button className="primary" onClick={()=>saveEdit(item)}>保存修改</button><button className="secondary" onClick={()=>{setEditingId("");setEditingPlace("")}}>取消</button></div>}{deletingId===item.id&&<div className="checkin-delete-confirm"><span>确定删除？统计会同步更新。</span><button className="danger-outline" onClick={()=>removeRecord(item.id)}>确认删除</button><button className="secondary" onClick={()=>setDeletingId("")}>取消</button></div>}</div><div className="record-actions checkin-record-actions"><button onClick={()=>startEdit(item)}><Pencil size={14}/>修改</button><button className="danger" onClick={()=>setDeletingId(item.id)}><Trash2 size={14}/>删除</button></div></article>)}</div>:<Empty title="这个月还没有到达记录" note="到达时打一下卡，这里会自动统计次数和停留时长。"/>}</section></>
}

function Health({data,update,notify}:{data:WorkspaceData;update:(f:(d:WorkspaceData)=>WorkspaceData)=>void;notify:(message:string)=>void}){
  const [healthModal,setHealthModal]=useState<Modal>(null);
  const [editingPeriod,setEditingPeriod]=useState<WorkspaceData["periods"][number]|null>(null);
  const [editingDrink,setEditingDrink]=useState<EditingItem|null>(null);
  const today=localDateKey();
  const todayHealth=healthOn(data.healthRecords,today);
  const todayDrinks=data.drinks.filter(x=>x.date===today);
  const lastWeight=[...data.weights].sort((a,b)=>a.date.localeCompare(b.date)).at(-1);
  const seven=summarizeHealth(data.healthRecords,rangeStartKey(today,7),today);
  const thirty=summarizeHealth(data.healthRecords,rangeStartKey(today,30),today);
  const cycle=estimateCyclePhases(data.periods,today);
  const updateTodayHealth=(patch:Partial<DailyHealth>)=>update(d=>({...d,healthRecords:upsertHealth(d.healthRecords,today,patch)}));
  function closeHealthModal(){setHealthModal(null);setEditingPeriod(null);setEditingDrink(null)}
  return <><section className="two-col health-columns">
    <div className="panel"><div className="panel-head"><div><span className="eyebrow">身体状态</span><h3>今天的基础记录</h3></div></div><div className="record-stack">
      <label>昨晚睡眠时长（小时）<input type="number" inputMode="decimal" min="0" max="24" step=".1" placeholder="例如 7.5" value={todayHealth.sleep??""} onChange={e=>updateTodayHealth({sleep:e.target.value?Math.min(24,Math.max(0,+e.target.value)):null})}/></label>
      <label>今天吃了几顿完整正餐<select value={todayHealth.meals??""} onChange={e=>updateTodayHealth({meals:e.target.value?+e.target.value:null})}><option value="">暂未记录</option><option value="0">0 餐</option><option value="1">1 餐</option><option value="2">2 餐</option><option value="3">3 餐</option></select></label>
      <div><span className="field-label">今日饮水量（ml）</span><input type="number" min="0" step="50" inputMode="numeric" value={todayHealth.water||""} placeholder="例如 1200" onChange={e=>updateTodayHealth({water:Math.max(0,Math.round(+e.target.value||0))})}/><div className="seg water-actions">{[-200,200,300,500].map(v=><button onClick={()=>updateTodayHealth({water:Math.max(0,todayHealth.water+v)})} key={v}><Droplets size={16}/>{v>0?"+":""}{v}ml</button>)}</div></div>
      <button className="secondary" onClick={()=>setHealthModal("weight")}><BarChart3 size={17}/>{lastWeight?"再次记录体重":"记录体重"}</button>
      {lastWeight&&<div className="latest-record"><span>最近：{lastWeight.value} kg · {lastWeight.date}</span><div className="record-actions"><button onClick={()=>{setEditingDrink({kind:"weight",value:lastWeight});setHealthModal("weight")}}><Pencil size={13}/>修改</button><button className="danger" onClick={()=>{if(confirm("确定删除这条体重记录吗？"))update(d=>({...d,weights:d.weights.filter(item=>item.id!==lastWeight.id)}))}}><Trash2 size={13}/>删除</button></div></div>}
    </div></div>
    <div className="panel"><div className="panel-head"><div><span className="eyebrow">每日饮品</span><h3>今天喝了什么？</h3></div><button className="primary" onClick={()=>setHealthModal("drink")}><Camera size={17}/>拍照记录</button></div>
      {todayDrinks.length?<div className="drink-grid">{todayDrinks.map(x=><article className={`drink-card${x.sticker?" sticker-card":""}`} key={x.id}>{x.photo?<img src={x.photo} alt={`${x.name}的照片`}/>:<div className="drink-placeholder"><CupSoda/></div>}<div><span>{x.type}</span><b>{x.name}</b><small>{x.time}{x.amount?` · ${x.amount}ml`:""}</small><div className="record-actions"><button onClick={()=>{setEditingDrink({kind:"drink",value:x});setHealthModal("drink")}}><Pencil size={13}/>修改</button><button className="danger" onClick={()=>{if(confirm("确定删除这条饮品记录吗？"))update(d=>({...d,drinks:d.drinks.filter(item=>item.id!==x.id)}))}}><Trash2 size={13}/>删除</button></div></div></article>)}</div>:<Empty title="今天还没有饮品记录" note="点击上方“拍照记录”，只识别照片里的杯子并生成日历贴纸。"/>}
    </div>
  </section>
  <section className="panel health-summary-panel"><div className="panel-head"><div><span className="eyebrow">健康总结</span><h2>只总结真实记录过的数据</h2><p>没有填写的项目不会被当作 0 参与平均。</p></div></div><div className="summary-period-grid"><HealthSummary title="最近 7 天" summary={seven}/><HealthSummary title="最近 30 天" summary={thirty}/></div></section>
  <section className="panel outfit-panel"><div className="panel-head"><div><span className="eyebrow">每日穿搭</span><h2>今天穿了什么？</h2><p>留下当天喜欢的搭配，慢慢形成自己的穿搭相册。</p></div><button className="primary" onClick={()=>setHealthModal("outfit")}><Shirt size={17}/>记录今日穿搭</button></div>
    {data.outfits.length?<div className="outfit-grid">{data.outfits.map(x=><article className="outfit-card" key={x.id}><img src={x.photo} alt={`${x.date}的穿搭照片`}/><div><span>{x.date}</span><b>{x.occasion||"今日穿搭"}</b><p>{x.mood}{x.note?` · ${x.note}`:""}</p></div><button className="outfit-delete" aria-label="删除穿搭记录" onClick={()=>update(d=>({...d,outfits:d.outfits.filter(o=>o.id!==x.id)}))}><Trash2 size={15}/></button></article>)}</div>:<Empty title="还没有穿搭照片" note="点击上方“记录今日穿搭”，上传今天的全身或半身照片。"/>}
  </section>
  <section className="panel period-panel"><div className="panel-head"><div><span className="eyebrow">女性健康</span><h2>姨妈周期</h2><p>只记录自己的日期和感受，不做医疗诊断。</p></div><button className="primary period-button" onClick={()=>setHealthModal("period")}><Flower2 size={17}/>记录本次姨妈</button></div>
    {cycle?<div className="cycle-forecast"><div className="cycle-forecast-head"><div><span>当前推算阶段</span><strong>{cycle.currentPhase}</strong></div><div><span>下次经期预计</span><strong>{cycle.nextPeriod.slice(5)}</strong></div><div><span>平均周期</span><strong>{cycle.averageCycle} 天</strong></div><div><span>估算质量</span><strong>{cycle.confidence}</strong></div></div><div className="cycle-phases"><div className="phase menstruation"><b>经期</b><span>{cycle.menstruation.start.slice(5)} – {cycle.menstruation.end.slice(5)}</span></div><div className="phase follicular"><b>卵泡期</b><span>{cycle.follicular.start.slice(5)} – {cycle.follicular.end.slice(5)}</span></div><div className="phase ovulation"><b>预计排卵</b><span>{cycle.ovulation.slice(5)}</span><small>易孕窗口 {cycle.fertile.start.slice(5)} – {cycle.fertile.end.slice(5)}</small></div><div className="phase luteal"><b>黄体期</b><span>{cycle.luteal.start.slice(5)} – {cycle.luteal.end.slice(5)}</span></div></div><p>按最近有效周期估算；周期波动约 {cycle.variation} 天。预计排卵日按下次经期前约 14 天推算，实际日期可能变化。</p></div>:data.periods.length?<div className="cycle-pending"><b>再记录 1 个周期即可生成阶段参考</b><p>至少需要两次经期开始日期，才会估算卵泡期、排卵窗口和黄体期。</p></div>:null}
    {data.periods.length?<div className="period-history">{[...data.periods].reverse().map(x=><div className="period-row" key={x.id}><div className="period-day"><Flower2/><b>{x.startDate.slice(5)}</b></div><div><b>{x.startDate} 至 {x.endDate||"进行中"}</b><p>经量：{x.flow||"未记录"}{x.note?` · ${x.note}`:""}</p><div className="period-actions"><button className="text-btn" onClick={()=>{setEditingPeriod(x);setHealthModal("period")}}>修改</button><button className="text-btn danger" onClick={()=>{if(confirm("确定删除这条周期记录吗？"))update(d=>({...d,periods:d.periods.filter(item=>item.id!==x.id)}))}}>删除</button></div></div></div>)}</div>:<Empty title="还没有周期记录" note="点击上方“记录本次姨妈”，保存开始日期、结束日期和感受。"/>}
  </section>
  <section className="panel suggestion"><span className="eyebrow">温和提醒</span><h3>健康记录是为了更了解自己</h3><p className="medical-note">周期预测仅根据历史日期估算，不能用于避孕或医疗判断。若经期异常、疼痛明显或身体持续不适，请咨询正规医疗专业人员。</p></section>
  {healthModal&&<Editor modal={healthModal} close={closeHealthModal} update={update} notify={notify} timer={countdownTimer()} setTimer={()=>{}} goFocusData={()=>{}} workspaceName={data.profile.name.trim()?`${data.profile.name.trim()}的工作台`:"我的工作台"} workspaceData={data} editingPeriod={editingPeriod} editingItem={editingDrink}/>}
  </>}
function Metric({label,value,note}:{label:string;value:string;note:string}){return <div className="metric"><span>{label}</span><strong>{value}</strong><p>{note}</p></div>}
function HealthSummary({title,summary}:{title:string;summary:ReturnType<typeof summarizeHealth>}){return <article className="health-summary"><h3>{title}</h3><div><span>睡眠均值<b>{summary.sleepAverage===null?"—":`${summary.sleepAverage} 小时`}</b></span><span>有记录日均饮水<b>{summary.waterAverage===null?"—":`${summary.waterAverage} ml`}</b></span><span>正餐均值<b>{summary.mealAverage===null?"—":`${summary.mealAverage} 餐`}</b></span><span>完整正餐日<b>{summary.regularMealDays} 天</b></span></div><p>这段时间共有 {summary.days} 天留下健康记录。</p></article>}

function Weight({data,open}:{data:WorkspaceData;open:(m:Modal)=>void}){
  const today=localDateKey(),start=rangeStartKey(today,28);
  const records=data.weights.filter(item=>inDateRange(item.date,start,today)).sort((a,b)=>a.date.localeCompare(b.date));
  const last=[...data.weights].sort((a,b)=>a.date.localeCompare(b.date)).at(-1);
  const change=weightChange(data.weights,start,today);
  const values=records.map(item=>item.value),min=values.length?Math.min(...values):0,max=values.length?Math.max(...values):0,span=Math.max(1,max-min);
  const trend=change===null?"至少记录两次后显示变化":Math.abs(change)<.2?"近 4 周基本稳定":change>0?`近 4 周增加 ${change.toFixed(1)} kg`:`近 4 周减少 ${Math.abs(change).toFixed(1)} kg`;
  return <><section className="panel hero-metric"><div><span className="eyebrow">最近一次记录</span><h2>{last?.value||"--"}<small> kg</small></h2><p>{last?.date||"暂未记录"} · 记录用于观察趋势</p></div><button className="primary" onClick={()=>open("weight")}><Plus size={17}/>记录体重</button></section><section className="panel"><div className="panel-head"><h3>最近 4 周趋势</h3><span className="muted">{start} 至 {today}</span></div>{records.length?<div className="bar-chart">{records.map(w=><div key={w.id}><span style={{height:`${32+(w.value-min)/span*92}px`}}/><b>{w.value}</b><small>{w.date.slice(5)}</small></div>)}</div>:<Empty title="最近 4 周还没有记录" note="记录体重后，这里只显示最近 28 天的数据。"/>}<p className="trend-text">{trend}。体重会自然波动，请结合睡眠、食欲和身体感受一起观察。</p></section></>
}

function Finance({data,update,income,expense,balance,monthKey,open,edit,remove}:{data:WorkspaceData;update:(f:(d:WorkspaceData)=>WorkspaceData)=>void;income:number;expense:number;balance:number;monthKey:string;open:(m:Modal)=>void;edit:(item:WorkspaceData["transactions"][number])=>void;remove:(k:"transactions",id:string)=>void}){
  const categories=["餐饮","交通","购物","学习","医疗","工作","其他"];
  const colors=["#778d78","#9b9e8b","#d89464","#b9a06a","#a77778","#7893a2","#d7d2c8"];
  const totals=expenseByCategory(data.transactions,monthKey);
  const ranked=categories.map((name,index)=>({name,index,value:totals[name]||0})).sort((a,b)=>b.value-a.value);
  const top=ranked[0];
  let cursor=0;
  const segments=ranked.filter(x=>x.value>0).map(x=>{const start=cursor;cursor+=x.value/Math.max(expense,1)*100;return `${colors[x.index]} ${start}% ${cursor}%`});
  const donutStyle={background:expense?`conic-gradient(${segments.join(",")})`:"var(--sage-soft)"};
  const budget=Math.max(0,data.settings.monthlyBudget||0);
  const budgetPercent=budget?expense/budget*100:0;
  const budgetLabel=budgetPercent>0&&budgetPercent<1?"<1%":`${Math.round(budgetPercent)}%`;
  return <><section className="finance-hero"><div><span>本月结余</span><strong>¥{balance.toFixed(2)}</strong><p>收入 ¥{income.toFixed(2)} · 支出 ¥{expense.toFixed(2)}</p></div><button className="primary light" onClick={()=>open("expense")}><Plus size={17}/>记一笔</button></section><section className="two-col"><div className="panel"><div className="panel-head"><h3>最近账单</h3></div>{data.transactions.length?data.transactions.map(t=><div className="transaction" key={t.id}><div className="category-icon">{t.category[0]}</div><div><b>{t.note||t.category}</b><p>{t.type} · {t.category} · {t.date}</p></div><strong className={t.type==="收入"?"income":t.type==="转账"?"transfer":""}>{t.type==="支出"?"-":t.type==="收入"?"+":"↔"}¥{t.amount.toFixed(2)}</strong><button className="icon" onClick={()=>edit(t)} aria-label="修改账单"><Pencil size={16}/></button><button className="icon danger" onClick={()=>remove("transactions",t.id)} aria-label="删除账单"><Trash2 size={16}/></button></div>):<Empty title="还没有账单" note="记录第一笔收入或支出后，会显示在这里。" action="记第一笔" onClick={()=>open("expense")}/>}</div><div className="panel"><div className="panel-head"><h3>本月分类支出</h3></div><div className="donut-wrap"><div className="donut" style={donutStyle}><span>{expense?Math.round(top.value/expense*100):0}%<small>{expense?top.name:"暂无支出"}</small></span></div><div className="category-list">{categories.map((x,i)=><div key={x}><i style={{background:colors[i]}}/>{x}<span>¥{(totals[x]||0).toFixed(2)}</span></div>)}</div></div><div className="budget"><label>本月预算（元）<input type="number" min="0" step="100" value={budget||""} placeholder="不设置预算" onChange={e=>update(d=>({...d,settings:{...d.settings,monthlyBudget:Math.max(0,normalizeMoney(e.target.value||0))}}))}/></label><b>{budget?`已使用 ${budgetLabel}`:"暂未设置预算"}</b><div className="progress"><i style={{width:`${Math.min(100,budgetPercent)}%`}}/></div><p>{budgetPercent>100?"本月已超过参考预算，后续记录会继续如实累计。":"预算进度仅作参考，以实际需要为准。"}</p></div></div></section></>}

function Growth({data,open,remove,update}:{data:WorkspaceData;open:(m:Modal)=>void;remove:(k:"notes",id:string)=>void;update:(f:(d:WorkspaceData)=>WorkspaceData)=>void}){return <><section className="panel page-panel"><div className="panel-head"><div><span className="eyebrow">学习与灵感</span><h2>留下真正对自己有用的内容</h2></div><button className="primary" onClick={()=>open("note")}><Plus size={17}/>添加笔记</button></div><div className="note-grid">{data.notes.map(n=><article className="note-card" key={n.id}><span>{n.type}</span><h3>{n.title}</h3><p>{n.content}</p><div><button className="text-btn" onClick={()=>{update(d=>({...d,tasks:[...d.tasks,{id:crypto.randomUUID(),title:n.action||`整理：${n.title}`,next:"明确下一步并开始",standard:"行动已完成",minutes:20,category:"学习研究",priority:"重要不紧急",done:false,createdDate:localDateKey(),completedDate:""}]}));}}>转为任务<ChevronRight size={14}/></button><button className="icon danger" onClick={()=>remove("notes",n.id)}><Trash2 size={16}/></button></div></article>)}</div></section></>}

function Emotion({data,open}:{data:WorkspaceData;open:(m:Modal)=>void}){return <><section className="emotion-hero"><HeartHandshake size={28}/><span className="eyebrow">此刻先停一下</span><h2>情绪可以存在，但不必立刻采取行动。</h2><p>你不需要马上得出结论，也不需要在情绪最强烈的时候回复任何人。</p><button className="primary" onClick={()=>open("emotion")}>开始 5·3·2·1 落地练习</button></section><section className="two-col"><div className="panel"><h3>今天可以选择的替代行动</h3><div className="choice-list">{["延迟 30 分钟再回复","写下来但不发送","喝水或吃一点东西","完成 15 分钟手边工作","今天暂停讨论"].map(x=><label key={x}><input type="checkbox"/>{x}</label>)}</div></div><div className="panel"><h3>我的消息边界</h3><div className="choice-list">{data.boundaries.map(x=><label key={x}><input type="checkbox" defaultChecked/>{x}</label>)}</div></div></section></>}

function Weekly({data,update,download}:{data:WorkspaceData;update:(f:(d:WorkspaceData)=>WorkspaceData)=>void;download:(name:string,text:string,type:string)=>void}){
  const currentStart=startOfWeekKey(localDateKey());
  const [weekStart,setWeekStart]=useState(currentStart);
  const weekEnd=endOfWeekKey(weekStart);
  const completed=data.tasks.filter(item=>item.completedDate&&inDateRange(item.completedDate,weekStart,weekEnd));
  const created=data.tasks.filter(item=>item.createdDate&&inDateRange(item.createdDate,weekStart,weekEnd));
  const focus=data.focusRecords.filter(item=>inDateRange(item.date,weekStart,weekEnd));
  const focusMinutes=focus.reduce((sum,item)=>sum+item.minutes,0);
  const health=summarizeHealth(data.healthRecords,weekStart,weekEnd);
  const notes=data.notes.filter(item=>item.createdDate&&inDateRange(item.createdDate,weekStart,weekEnd));
  const finance=summarizeTransactions(data.transactions.filter(item=>inDateRange(item.date,weekStart,weekEnd)),"");
  const review=data.reviews.find(item=>item.weekStart===weekStart)||{weekStart,best:"",next:""};
  const drinks=data.drinks.filter(item=>inDateRange(item.date,weekStart,weekEnd)).length;
  const schedules=data.schedule.filter(item=>inDateRange(item.date,weekStart,weekEnd)).length;
  function setReview(patch:Partial<typeof review>){update(d=>({...d,reviews:[...d.reviews.filter(item=>item.weekStart!==weekStart),{...review,...patch,weekStart}].sort((a,b)=>a.weekStart.localeCompare(b.weekStart))}))}
  function exportWeek(){
    const md=`# ${weekStart} 至 ${weekEnd} 周结\n\n- 本周完成任务：${completed.length} 项\n- 本周新增任务：${created.length} 项\n- 专注：${focus.length} 次，共 ${focusMinutes} 分钟\n- 平均睡眠：${health.sleepAverage===null?"未记录":`${health.sleepAverage} 小时`}\n- 有饮水记录日均：${health.waterAverage===null?"未记录":`${health.waterAverage} ml`}\n- 完整正餐：${health.regularMealDays} 天\n- 饮品记录：${drinks} 条\n- 学习笔记：${notes.length} 条\n- 日程：${schedules} 项\n- 本周收入：¥${finance.income.toFixed(2)}\n- 本周支出：¥${finance.expense.toFixed(2)}\n\n## 做得最好的一件事\n\n${review.best||"暂未填写"}\n\n## 下周最需要保护的事\n\n${review.next||"暂未填写"}\n`;
    download(`周结-${weekStart}.md`,md,"text/markdown");
  }
  const advice=[
    health.sleepAverage!==null&&health.sleepAverage<7?"最近睡眠均值不足 7 小时，下周可先保护固定的入睡时间。":"继续按身体感受安排节奏，不用为了填满数据而记录。",
    created.length>completed.length?"本周新增任务多于完成任务，下周可以少加一项，先收尾。":"任务节奏目前较平衡，下周只保留真正重要的方向。",
    focus.length===0?"如果需要整段时间，下周先尝试一次 15 分钟专注。":`本周已完成 ${focus.length} 次专注，可以保持这个强度。`,
  ];
  return <><section className="panel period-switcher"><button className="icon" onClick={()=>setWeekStart(addDaysKey(weekStart,-7))}><ChevronLeft/></button><div><span className="eyebrow">{weekStart===currentStart?"本周":"历史周"}</span><h2>{weekStart} 至 {weekEnd}</h2></div><button className="icon" disabled={weekStart>=currentStart} onClick={()=>setWeekStart(addDaysKey(weekStart,7))}><ChevronRight/></button>{weekStart!==currentStart&&<button className="text-btn" onClick={()=>setWeekStart(currentStart)}>回到本周</button>}</section><section className="metric-grid"><Metric label="本周完成" value={`${completed.length} 项`} note={`新增 ${created.length} 项任务`}/><Metric label="本周专注" value={`${focusMinutes} 分钟`} note={`${focus.length} 次已记录专注`}/><Metric label="平均睡眠" value={health.sleepAverage===null?"暂无记录":`${health.sleepAverage} 小时`} note={`${health.days} 天健康记录`}/><Metric label="本周学习" value={`${notes.length} 条`} note={`${schedules} 项日程 · ${drinks} 条饮品`}/></section><section className="panel review"><div className="panel-head"><div><span className="eyebrow">自然周统计</span><h2>{weekStart===currentStart?"本周复盘":"历史周复盘"}</h2></div><button className="secondary" onClick={exportWeek}><Download size={16}/>导出这一周</button></div><div className="week-health-strip"><Metric label="有记录日均饮水" value={health.waterAverage===null?"—":`${health.waterAverage} ml`} note="未填写日不参与平均"/><Metric label="完整正餐日" value={`${health.regularMealDays} 天`} note="每天至少 2 顿完整正餐"/><Metric label="本周收支" value={`¥${finance.balance.toFixed(2)}`} note={`收入 ${finance.income.toFixed(2)} · 支出 ${finance.expense.toFixed(2)}`}/></div><label>这一周完成得最好的一件事是什么？<textarea value={review.best} onChange={e=>setReview({best:e.target.value})} placeholder="写下一件具体的事…"/></label><label>下一周最需要保护的是什么？<textarea value={review.next} onChange={e=>setReview({next:e.target.value})} placeholder="时间、身体、边界或重要方向…"/></label><div className="advice"><h3>根据这一周数据生成的提醒</h3><ol>{advice.map(item=><li key={item}>{item}</li>)}</ol></div></section></>
}

function shiftMonth(monthKey:string,offset:number){const [year,month]=monthKey.split("-").map(Number);const date=new Date(year,month-1+offset,1);return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`}
function Monthly({data}:{data:WorkspaceData}){
  const currentMonth=localDateKey().slice(0,7);
  const [month,setMonth]=useState(currentMonth);
  const {start,end}=monthBounds(month);
  const completed=data.tasks.filter(item=>item.completedDate&&inDateRange(item.completedDate,start,end));
  const created=data.tasks.filter(item=>item.createdDate&&inDateRange(item.createdDate,start,end));
  const focus=data.focusRecords.filter(item=>inDateRange(item.date,start,end));
  const focusMinutes=focus.reduce((sum,item)=>sum+item.minutes,0);
  const health=summarizeHealth(data.healthRecords,start,end);
  const finance=summarizeTransactions(data.transactions,month);
  const notes=data.notes.filter(item=>item.createdDate&&inDateRange(item.createdDate,start,end));
  const drinks=data.drinks.filter(item=>inDateRange(item.date,start,end));
  const outfits=data.outfits.filter(item=>inDateRange(item.date,start,end));
  const weights=data.weights.filter(item=>inDateRange(item.date,start,end));
  const weightDelta=weightChange(data.weights,start,end);
  const schedules=data.schedule.filter(item=>inDateRange(item.date,start,end));
  const hasData=completed.length+created.length+focus.length+health.days+notes.length+drinks.length+outfits.length+weights.length+schedules.length+finance.count>0;
  return <><section className="panel period-switcher"><button className="icon" onClick={()=>setMonth(shiftMonth(month,-1))}><ChevronLeft/></button><div><span className="eyebrow">{month===currentMonth?"本月":"历史月份"}</span><h2>{month.replace("-"," 年 ")} 月</h2></div><button className="icon" disabled={month>=currentMonth} onClick={()=>setMonth(shiftMonth(month,1))}><ChevronRight/></button>{month!==currentMonth&&<button className="text-btn" onClick={()=>setMonth(currentMonth)}>回到本月</button>}</section>{hasData?<><section className="metric-grid"><Metric label="完成任务" value={`${completed.length} 项`} note={`本月新增 ${created.length} 项`}/><Metric label="专注时间" value={`${focusMinutes} 分钟`} note={`${focus.length} 次专注`}/><Metric label="生活记录" value={`${drinks.length+outfits.length} 条`} note={`${drinks.length} 条饮品 · ${outfits.length} 套穿搭`}/><Metric label="本月结余" value={`¥${finance.balance.toFixed(2)}`} note={`收入 ${finance.income.toFixed(2)} · 支出 ${finance.expense.toFixed(2)}`}/></section><section className="panel monthly-summary"><div className="panel-head"><div><span className="eyebrow">身体与生活</span><h2>本月健康总结</h2></div></div><div className="summary-period-grid"><HealthSummary title={`${month} 健康数据`} summary={health}/><article className="health-summary"><h3>其他记录</h3><div><span>体重记录<b>{weights.length} 次</b></span><span>体重变化<b>{weightDelta===null?"—":`${weightDelta>0?"+":""}${weightDelta} kg`}</b></span><span>学习笔记<b>{notes.length} 条</b></span><span>日程安排<b>{schedules.length} 项</b></span></div><p>所有数量都只统计 {start} 至 {end}。</p></article></div></section></>:<section className="panel"><Empty title="这个月还没有记录" note="添加任务、健康、记账或日程后，月结会自动汇总。"/></section>}</>
}

function Trends({data}:{data:WorkspaceData}){
  const [days,setDays]=useState(7);
  const end=localDateKey(),start=rangeStartKey(end,days);
  const health=summarizeHealth(data.healthRecords,start,end);
  const completed=data.tasks.filter(item=>item.completedDate&&inDateRange(item.completedDate,start,end)).length;
  const created=data.tasks.filter(item=>item.createdDate&&inDateRange(item.createdDate,start,end)).length;
  const focus=data.focusRecords.filter(item=>inDateRange(item.date,start,end));
  const life=data.drinks.filter(item=>inDateRange(item.date,start,end)).length+data.outfits.filter(item=>inDateRange(item.date,start,end)).length+data.weights.filter(item=>inDateRange(item.date,start,end)).length+data.periods.filter(item=>inDateRange(item.startDate,start,end)).length;
  const notes=data.notes.filter(item=>item.createdDate&&inDateRange(item.createdDate,start,end)).length;
  const hasData=completed+created+focus.length+life+notes+health.days>0;
  return <section className="panel"><div className="panel-head"><div><span className="eyebrow">{start} 至 {end}</span><h2>生活节奏总览</h2></div><div className="seg compact">{[[7,"7 天"],[30,"30 天"],[84,"12 周"]].map(([value,label])=><button key={value} className={days===value?"active":""} onClick={()=>setDays(value as number)}>{label}</button>)}</div></div>{hasData?<><div className="simple-trend-summary"><Metric label="任务" value={`${completed} 项完成`} note={`${created} 项在此期间新增`}/><Metric label="专注" value={`${focus.reduce((sum,item)=>sum+item.minutes,0)} 分钟`} note={`${focus.length} 次真实记录`}/><Metric label="生活与健康" value={`${life} 条`} note={`${health.days} 天基础健康记录`}/><Metric label="平均睡眠" value={health.sleepAverage===null?"—":`${health.sleepAverage} 小时`} note="仅计算已填写的天数"/><Metric label="有记录日均饮水" value={health.waterAverage===null?"—":`${health.waterAverage} ml`} note="0 或未填写不参与平均"/><Metric label="学习笔记" value={`${notes} 条`} note="按创建日期统计"/></div></>:<Empty title={`最近 ${days===84?"12 周":`${days} 天`}还没有可分析的数据`} note="从任务、健康、记账或学习模块开始记录，趋势会自动形成。"/>}</section>
}

function SettingsPage({data,update,theme,setTheme,font,setFont,setDefaultFocusMinutes,exportJson,importFile,reset}:{data:WorkspaceData;update:(f:(d:WorkspaceData)=>WorkspaceData)=>void;theme:string;setTheme:(x:"light"|"dark")=>void;font:FontChoice;setFont:(x:FontChoice)=>void;setDefaultFocusMinutes:(value:unknown)=>void;exportJson:()=>void;importFile:(f:File)=>void;reset:()=>void}){
  const previewName=data.profile.name.trim()?`${data.profile.name.trim()}的工作台`:"我的工作台";
  return <><section className="panel settings-section profile-panel"><div><span className="eyebrow">专属名称</span><h2>给自己的工作台取个名字</h2><p>每个人都可以在自己的手机上修改，只影响本机显示。</p></div><div className="profile-name-editor"><label>我的名字或昵称<input maxLength={12} value={data.profile.name} onChange={e=>update(d=>({...d,profile:{name:e.target.value.slice(0,12)}}))} placeholder="例如：小红、紫妍"/></label><div className="name-preview"><img src={`${basePath}/icon.png`} alt="工作台图标"/><div><span>修改后显示为</span><b>{previewName}</b></div></div></div></section><section className="panel settings-section"><h2>外观与字体</h2><div className="setting-row"><div><b>显示模式</b><p>选择舒适的阅读环境</p></div><div className="seg compact"><button className={theme==="light"?"active":""} onClick={()=>setTheme("light")}>浅色</button><button className={theme==="dark"?"active":""} onClick={()=>setTheme("dark")}>深色</button></div></div><div className="setting-row font-setting"><div><b>手机字体</b><p>选择后立即生效，并保存在本设备</p></div><div className="seg compact"><button className={font==="cute"?"active":""} onClick={()=>setFont("cute")}>可爱手写</button><button className={font==="system"?"active":""} onClick={()=>setFont("system")}>手机默认</button><button className={font==="rounded"?"active":""} onClick={()=>setFont("rounded")}>清爽圆体</button></div></div><div className="setting-row focus-default-setting"><div><b>默认专注时长</b><p>可设置 1–600 分钟，打开倒计时会自动使用</p></div><label><input aria-label="默认专注时长（分钟）" type="number" min="1" max="600" value={data.settings.focusMinutes} onChange={e=>setDefaultFocusMinutes(e.target.value)}/><span>分钟</span></label></div></section><section className="panel settings-section"><h2>数据与备份</h2><div className="privacy-note">当前数据默认仅保存在本设备中。清除应用或浏览器数据可能导致记录丢失，请定期导出备份。</div><div className="data-actions"><button className="secondary" onClick={exportJson}><Download size={17}/>导出 JSON 备份</button><label className="secondary file-btn"><Upload size={17}/>导入 JSON<input type="file" accept=".json" onChange={e=>e.target.files?.[0]&&importFile(e.target.files[0])}/></label><button className="secondary danger-outline" onClick={reset}><Trash2 size={17}/>清空全部数据</button></div><p className="muted">数据版本 {data.schemaVersion} · 最近更新 {new Date(data.updatedAt).toLocaleString("zh-CN")}</p></section><details className="settings-install-mini"><summary><Download size={14}/>安装到手机桌面<ChevronRight size={14}/></summary><div><p><b>iPhone：</b>用 Safari 打开本页，点击分享，再选择“添加到主屏幕”。</p><p><b>Android：</b>用 Chrome 打开本页，点击右上角菜单，再选择“安装应用”。</p></div></details></>
}

function SearchResults({data,query,go}:{data:WorkspaceData;query:string;go:(p:Page)=>void}){const q=query.toLowerCase(); const rs=[...data.tasks.map(x=>({...x,kind:"任务",page:"tasks" as Page})),...data.notes.map(x=>({...x,kind:"笔记",page:"growth" as Page})),...data.transactions.map(x=>({id:x.id,title:x.note||x.category,content:`${x.category} ¥${x.amount}`,kind:"账单",page:"finance" as Page}))].filter(x=>(x.title+(("content"in x&&x.content)||"")).toLowerCase().includes(q));return <section className="panel"><div className="panel-head"><h2>“{query}” 的搜索结果</h2><span>{rs.length} 条</span></div>{rs.length?rs.map(r=><button className="search-result" key={r.id} onClick={()=>go(r.page)}><span>{r.kind}</span><div><b>{r.title}</b>{"content"in r&&<p>{String(r.content)}</p>}</div><ChevronRight size={18}/></button>):<Empty title="没有找到相关内容" note="换一个关键词，或检查日期和标签。"/>}</section>}

function Empty({title,note,action,onClick}:{title:string;note:string;action?:string;onClick?:()=>void}){return <div className="empty"><Sparkles/><h3>{title}</h3><p>{note}</p>{action&&<button className="secondary" onClick={onClick}>{action}</button>}</div>}

async function loadPhoto(source:Blob|string):Promise<HTMLImageElement>{
  return new Promise<HTMLImageElement>((resolve,reject)=>{
    const img=new Image(),url=typeof source==="string"?source:URL.createObjectURL(source);
    img.onload=()=>{if(typeof source!=="string")URL.revokeObjectURL(url);resolve(img)};
    img.onerror=()=>{if(typeof source!=="string")URL.revokeObjectURL(url);reject(new Error("image"))};
    img.src=url;
  });
}

async function processLocalPhoto(file:File):Promise<string>{
  const source=await loadPhoto(file);
  const scale=Math.min(1,1000/Math.max(source.naturalWidth,source.naturalHeight));
  const w=Math.max(1,Math.round(source.naturalWidth*scale)),h=Math.max(1,Math.round(source.naturalHeight*scale));
  const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext("2d");if(!ctx)throw new Error("canvas");
  ctx.drawImage(source,0,0,w,h);
  return canvas.toDataURL("image/jpeg",.82);
}

type CupDetector={detect:(input:HTMLCanvasElement,maxNumBoxes?:number,minScore?:number)=>Promise<{bbox:[number,number,number,number];class:string;score:number}[]>};
let cupDetectorPromise:Promise<CupDetector>|null=null;
async function getCupDetector():Promise<CupDetector>{
  if(!cupDetectorPromise)cupDetectorPromise=(async()=>{
    const [tf,coco]=await Promise.all([import("@tensorflow/tfjs"),import("@tensorflow-models/coco-ssd")]);
    await tf.ready();
    const modelUrl=new URL(`${basePath}/models/ssdlite_mobilenet_v2/model.json`,window.location.origin).toString();
    return coco.load({base:"lite_mobilenet_v2",modelUrl});
  })().catch(error=>{cupDetectorPromise=null;throw error});
  return cupDetectorPromise;
}

async function processCupSticker(input:Blob|string):Promise<string>{
  const source=await loadPhoto(input);
  const detectScale=Math.min(1,640/Math.max(source.naturalWidth,source.naturalHeight));
  const detectCanvas=document.createElement("canvas");
  detectCanvas.width=Math.max(1,Math.round(source.naturalWidth*detectScale));detectCanvas.height=Math.max(1,Math.round(source.naturalHeight*detectScale));
  const detectContext=detectCanvas.getContext("2d");if(!detectContext)throw new Error("canvas");
  detectContext.drawImage(source,0,0,detectCanvas.width,detectCanvas.height);
  const detector=await getCupDetector();
  const detected=await detector.detect(detectCanvas,20,.15);
  const cup=detected
    .filter(item=>item.class==="cup"&&item.score>=.35)
    .sort((a,b)=>(b.score*Math.sqrt(b.bbox[2]*b.bbox[3]))-(a.score*Math.sqrt(a.bbox[2]*a.bbox[3])))[0];
  if(!cup)throw new Error("NO_CUP");

  const [boxX,boxY,boxW,boxH]=cup.bbox,padX=boxW*.04,padY=boxH*.01;
  const sx=Math.max(0,(boxX-padX)/detectScale),sy=Math.max(0,(boxY-padY)/detectScale);
  const sw=Math.min(source.naturalWidth-sx,(boxW+padX*2)/detectScale),sh=Math.min(source.naturalHeight-sy,(boxH+padY*2)/detectScale);
  const scale=Math.min(1,460/Math.max(sw,sh)),cropW=Math.max(1,Math.round(sw*scale)),cropH=Math.max(1,Math.round(sh*scale));
  const canvas=document.createElement("canvas");canvas.width=cropW;canvas.height=cropH;
  const ctx=canvas.getContext("2d",{willReadFrequently:true});if(!ctx)throw new Error("canvas");
  ctx.drawImage(source,sx,sy,sw,sh,0,0,cropW,cropH);

  const image=ctx.getImageData(0,0,cropW,cropH),pixels=image.data,gray=new Uint8Array(cropW*cropH),palette:number[][]=[];
  const sample=(x:number,y:number)=>{const i=(y*cropW+x)*4;palette.push([pixels[i],pixels[i+1],pixels[i+2]])};
  const stride=Math.max(2,Math.round(Math.min(cropW,cropH)/24));
  for(let x=0;x<cropW;x+=stride){sample(x,0);sample(x,cropH-1)}
  for(let y=stride;y<cropH-stride;y+=stride){sample(0,y);sample(cropW-1,y)}
  for(let i=0,p=0;i<pixels.length;i+=4,p++)gray[p]=(pixels[i]*.299+pixels[i+1]*.587+pixels[i+2]*.114)|0;
  for(let y=0;y<cropH;y++)for(let x=0;x<cropW;x++){
    const p=y*cropW,i=p*4,sourceR=pixels[i],sourceG=pixels[i+1],sourceB=pixels[i+2];
    let nearest=Infinity;
    for(const color of palette){const dr=sourceR-color[0],dg=sourceG-color[1],db=sourceB-color[2];nearest=Math.min(nearest,dr*dr+dg*dg+db*db)}
    const edge=x>0&&x<cropW-1&&y>0&&y<cropH-1?Math.abs(gray[p-1]-gray[p+1])+Math.abs(gray[p-cropW]-gray[p+cropW]):0;
    const alpha=Math.max(0,Math.min(255,(Math.sqrt(nearest)-22)/38*255+edge*1.25));
    let r=(sourceR-128)*1.14+128,g=(sourceG-128)*1.14+128,b=(sourceB-128)*1.14+128;
    r=Math.round(Math.max(0,Math.min(255,r))/32)*32;g=Math.round(Math.max(0,Math.min(255,g))/32)*32;b=Math.round(Math.max(0,Math.min(255,b))/32)*32;
    if(edge>72){r*=.55;g*=.55;b*=.55}
    pixels[i]=r;pixels[i+1]=g;pixels[i+2]=b;pixels[i+3]=alpha;
  }
  ctx.putImageData(image,0,0);

  const shaped=document.createElement("canvas");shaped.width=cropW;shaped.height=cropH;
  const shapedContext=shaped.getContext("2d");if(!shapedContext)throw new Error("canvas");
  shapedContext.beginPath();
  if(cropH>=cropW*.72){
    shapedContext.moveTo(cropW*.16,cropH*.05);
    shapedContext.bezierCurveTo(cropW*.31,-cropH*.01,cropW*.69,-cropH*.01,cropW*.84,cropH*.05);
    shapedContext.bezierCurveTo(cropW*.93,cropH*.09,cropW*.94,cropH*.15,cropW*.9,cropH*.22);
    shapedContext.lineTo(cropW*.82,cropH*.9);
    shapedContext.bezierCurveTo(cropW*.81,cropH*.98,cropW*.68,cropH,cropW*.5,cropH);
    shapedContext.bezierCurveTo(cropW*.32,cropH,cropW*.19,cropH*.98,cropW*.18,cropH*.9);
    shapedContext.lineTo(cropW*.1,cropH*.22);
    shapedContext.bezierCurveTo(cropW*.06,cropH*.15,cropW*.07,cropH*.09,cropW*.16,cropH*.05);
  }else{
    shapedContext.roundRect(cropW*.06,cropH*.08,cropW*.72,cropH*.84,Math.max(12,cropH*.12));
    shapedContext.moveTo(cropW*.72,cropH*.27);
    shapedContext.bezierCurveTo(cropW*.98,cropH*.2,cropW*.99,cropH*.73,cropW*.72,cropH*.68);
    shapedContext.bezierCurveTo(cropW*.82,cropH*.62,cropW*.84,cropH*.34,cropW*.72,cropH*.35);
  }
  shapedContext.closePath();shapedContext.clip();shapedContext.drawImage(canvas,0,0);
  const shapedPixels=shapedContext.getImageData(0,0,cropW,cropH).data;

  const silhouette=document.createElement("canvas");silhouette.width=cropW;silhouette.height=cropH;
  const silhouetteContext=silhouette.getContext("2d");if(!silhouetteContext)throw new Error("canvas");
  const mask=silhouetteContext.createImageData(cropW,cropH);
  for(let i=0;i<shapedPixels.length;i+=4){mask.data[i]=255;mask.data[i+1]=252;mask.data[i+2]=246;mask.data[i+3]=shapedPixels[i+3]}
  silhouetteContext.putImageData(mask,0,0);
  const sticker=document.createElement("canvas"),pad=Math.max(18,Math.round(Math.min(cropW,cropH)*.07));
  sticker.width=cropW+pad*2;sticker.height=cropH+pad*2;
  const out=sticker.getContext("2d");if(!out)throw new Error("canvas");
  const outline=Math.max(4,Math.round(pad*.38));
  for(let dy=-outline;dy<=outline;dy+=2)for(let dx=-outline;dx<=outline;dx+=2)if(dx*dx+dy*dy<=outline*outline)out.drawImage(silhouette,pad+dx,pad+dy);
  out.drawImage(shaped,pad,pad);
  return sticker.toDataURL("image/webp",.88);
}

function Editor({modal,close,update,notify,timer,setTimer,goFocusData,workspaceName="我的工作台",defaultScheduleDate=localDateKey(),workspaceData,editingPeriod=null,editingItem=null}:{modal:Exclude<Modal,null>;close:()=>void;update:(f:(d:WorkspaceData)=>WorkspaceData)=>void;notify:(x:string)=>void;timer:TimerState;setTimer:React.Dispatch<React.SetStateAction<TimerState>>;goFocusData:()=>void;workspaceName?:string;defaultScheduleDate?:string;workspaceData:WorkspaceData;editingPeriod?:WorkspaceData["periods"][number]|null;editingItem?:EditingItem|null}){
  const today=localDateKey();
  const [form,setForm]=useState<Record<string,string>>(()=>{
    if(modal==="schedule")return {date:defaultScheduleDate,time:"09:00",type:"个人安排"};
    if(editingPeriod)return {...editingPeriod};
    if(editingItem?.kind==="task"){const item=editingItem.value;return {title:item.title,next:item.next,standard:item.standard,minutes:String(item.minutes),category:item.category,priority:item.priority,checkinPlace:item.checkinPlace||""}}
    if(editingItem?.kind==="transaction"){const item=editingItem.value;return {amount:String(item.amount),type:item.type,category:item.category,note:item.note,date:item.date}}
    if(editingItem?.kind==="drink"){const item=editingItem.value;return {name:item.name,type:item.type,amount:item.amount?String(item.amount):"",photo:item.photo,sourcePhoto:item.photo,sticker:item.sticker?"true":"",photoStatus:item.sticker?"sticker":"original"}}
    if(editingItem?.kind==="weight")return {value:String(editingItem.value.value),date:editingItem.value.date};
    return {};
  });
  const [step,setStep]=useState(0);
  const [processing,setProcessing]=useState(false);
  const [customFocusMinutes,setCustomFocusMinutes]=useState(()=>String(Math.max(1,Math.round(timer.durationSeconds/60)||workspaceData.settings.focusMinutes)));
  const set=(k:string,v:string)=>setForm(f=>({...f,[k]:v}));
  async function recognizeCup(source:Blob|string){
    setProcessing(true);set("photoError","");
    try{
      const sticker=await processCupSticker(source);
      set("photo",sticker);set("sticker","true");set("photoStatus","sticker");
      notify("杯子贴纸已生成");
    }catch(error){
      const noCup=error instanceof Error&&error.message==="NO_CUP";
      const message=noCup?"照片已保留，但没有识别到杯子。请让杯子占画面一半以上再试。":"照片已保留，贴纸暂未生成。可以保存记录，或点击“重新生成贴纸”。";
      set("sticker","");set("photoStatus","original");set("photoError",message);notify(message);
    }finally{setProcessing(false)}
  }
  async function readPhoto(file:File|undefined,cupOnly=false){
    if(!file)return;
    setProcessing(true);set("photoError","");
    try{
      const photo=await processLocalPhoto(file);
      set("photo",photo);set("sourcePhoto",photo);set("sticker","");set("photoStatus",cupOnly?"original":"ready");
      if(cupOnly)await recognizeCup(file);else notify("照片已加入");
    }catch{
      const message="照片读取失败，请重新拍摄或换一张照片。";
      set("photo","");set("sourcePhoto","");set("sticker","");set("photoError",message);notify(message);
    }finally{setProcessing(false)}
  }
  async function retryCup(){if(form.sourcePhoto)await recognizeCup(form.sourcePhoto)}
  function save(){
    if(modal==="task"){if(!form.title)return notify("请填写任务名称");const minutes=Math.min(600,Math.max(5,+form.minutes||30));const next={title:form.title,next:form.next||"明确下一步并开始",standard:form.standard||"达到预期结果",minutes,category:form.category||"AI训练",priority:form.priority||"重要不紧急",checkinPlace:form.checkinPlace?.trim()||""};update(d=>({...d,tasks:editingItem?.kind==="task"?d.tasks.map(item=>item.id===editingItem.value.id?{...item,...next}:item):[...d.tasks,{id:crypto.randomUUID(),...next,done:false,createdDate:today,completedDate:""}]}));}
    if(modal==="schedule"){if(!form.date)return notify("请选择日期");if(!form.time)return notify("请选择时间");if(!form.title?.trim())return notify("请填写日程名称");update(d=>({...d,schedule:[...d.schedule,{id:crypto.randomUUID(),date:form.date,time:form.time,title:form.title.trim(),type:form.type||"个人安排"}].sort((a,b)=>`${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))}));}
    if(modal==="temporary"){if(!form.title)return notify("请填写任务名称");update(d=>({...d,temporary:[...d.temporary,{id:crypto.randomUUID(),title:form.title,deadline:form.deadline||"",priority:form.priority||"普通",done:false}]}));}
    if(modal==="expense"){const amount=normalizeMoney(form.amount||0);if(amount<=0)return notify("金额必须大于 0");const next={amount,type:form.type||"支出",category:form.category||"餐饮",note:form.note||"",date:form.date||today};update(d=>({...d,transactions:editingItem?.kind==="transaction"?d.transactions.map(item=>item.id===editingItem.value.id?{...item,...next}:item):[{id:crypto.randomUUID(),...next},...d.transactions]}));}
    if(modal==="weight"){const value=normalizeMoney(form.value||0);if(value<=0||value>500)return notify("请输入正确体重");const date=form.date||today;update(d=>({...d,weights:(editingItem?.kind==="weight"?d.weights.map(item=>item.id===editingItem.value.id?{...item,value,date}:item):[...d.weights,{id:crypto.randomUUID(),value,date}]).sort((a,b)=>a.date.localeCompare(b.date))}));}
    if(modal==="drink"){const amount=form.amount?Math.round(+form.amount):null;if(!form.name)return notify("请填写饮品名称");if(amount!==null&&(!Number.isFinite(amount)||amount<=0))return notify("容量必须大于 0");const next={name:form.name,type:form.type||"咖啡",amount,photo:form.photo||"",sticker:form.sticker==="true"};update(d=>({...d,drinks:editingItem?.kind==="drink"?d.drinks.map(item=>item.id===editingItem.value.id?{...item,...next}:item):[{id:crypto.randomUUID(),...next,date:today,time:new Date().toLocaleTimeString("zh-CN",{hour:"2-digit",minute:"2-digit"})},...d.drinks]}));}
    if(modal==="outfit"){if(!form.photo)return notify("请先上传一张穿搭照片");update(d=>({...d,outfits:[{id:crypto.randomUUID(),photo:form.photo,date:today,occasion:form.occasion||"",mood:form.mood||"",note:form.note||""},...d.outfits]}));}
    if(modal==="period"){if(!form.startDate)return notify("请选择开始日期");if(form.endDate&&form.endDate<form.startDate)return notify("结束日期不能早于开始日期");const other=workspaceData.periods.filter(item=>item.id!==editingPeriod?.id);if(periodsOverlap(other,form.startDate,form.endDate||""))return notify("这段日期与已有周期重叠，请检查后再保存");const next={startDate:form.startDate,endDate:form.endDate||"",flow:form.flow||"",note:form.note||""};update(d=>({...d,periods:(editingPeriod?d.periods.map(item=>item.id===editingPeriod.id?{...item,...next}:item):[...d.periods,{id:crypto.randomUUID(),...next}]).sort((a,b)=>a.startDate.localeCompare(b.startDate))}));}
    if(modal==="note"){if(!form.title)return notify("请填写标题");update(d=>({...d,notes:[{id:crypto.randomUUID(),type:form.type||"灵感",title:form.title,content:form.content||"",action:form.action||"",createdDate:today},...d.notes]}));}
    notify("已保存到本设备");close();
  }
  function finishFocus(){
    const elapsedSeconds=focusTimerSnapshot(timer).elapsedSeconds;
    if(elapsedSeconds<60)return notify("专注满 1 分钟后再记录");
    const minutes=focusMinutesFromSeconds(elapsedSeconds);
    setTimer(timer.mode==="countdown"?countdownTimer(timer.durationSeconds/60):stopwatchTimer());
    update(d=>({...d,focusSessions:d.focusSessions+1,focusRecords:[...d.focusRecords,{id:crypto.randomUUID(),date:localDateKey(),minutes,completedAt:new Date().toISOString()}]}));
    notify(`已记录 ${minutes} 分钟专注`);close();
  }
  function changeFocusMode(mode:TimerState["mode"]){
    if(timer.running)return notify("请先暂停，再切换计时方式");
    setTimer(mode==="countdown"?countdownTimer(workspaceData.settings.focusMinutes):stopwatchTimer());
    if(mode==="countdown")setCustomFocusMinutes(String(workspaceData.settings.focusMinutes));
  }
  function applyCountdownMinutes(value:unknown){
    if(timer.running)return notify("请先暂停，再修改倒计时时长");
    const minutes=normalizeFocusMinutes(value,workspaceData.settings.focusMinutes);
    setCustomFocusMinutes(String(minutes));
    setTimer(countdownTimer(minutes));
    notify(`倒计时已设置为 ${minutes} 分钟`);
  }
  function toggleFocusTimer(){
    setTimer(current=>{
      const snapshot=focusTimerSnapshot(current);
      if(current.running){
        return current.mode==="countdown"
          ?{...current,running:false,endAt:0,remainingSeconds:snapshot.displaySeconds,elapsedSeconds:snapshot.elapsedSeconds}
          :{...current,running:false,startedAt:0,elapsedSeconds:snapshot.elapsedSeconds};
      }
      if(current.mode==="countdown"){
        const remaining=snapshot.displaySeconds>0?snapshot.displaySeconds:current.durationSeconds;
        return {...current,running:true,endAt:Date.now()+remaining*1000,remainingSeconds:remaining,elapsedSeconds:current.durationSeconds-remaining};
      }
      return {...current,running:true,startedAt:Date.now()-current.elapsedSeconds*1000};
    });
  }
  function resetFocus(){
    if(timer.running)return notify("请先暂停，再重置计时");
    setTimer(timer.mode==="countdown"?countdownTimer(timer.durationSeconds/60||workspaceData.settings.focusMinutes):stopwatchTimer());
  }
  if(modal==="focus"){
    const snapshot=focusTimerSnapshot(timer);
    const progress=timer.mode==="countdown"&&timer.durationSeconds?Math.min(100,Math.round(snapshot.elapsedSeconds/timer.durationSeconds*100)):0;
    return <div className="modal-backdrop"><div className="modal focus-modal"><button className="modal-close" onClick={close} aria-label="关闭专注计时"><X/></button><span className="eyebrow">专注当下</span><h2>本轮专注</h2><div className="focus-mode-switch" role="group" aria-label="计时方式"><button className={timer.mode==="countdown"?"active":""} disabled={timer.running} onClick={()=>changeFocusMode("countdown")}>倒计时</button><button className={timer.mode==="stopwatch"?"active":""} disabled={timer.running} onClick={()=>changeFocusMode("stopwatch")}>正计时</button></div><div className="timer-display" aria-live="off">{formatFocusTime(snapshot.displaySeconds)}</div><p>{timer.mode==="countdown"?`已专注 ${formatFocusTime(snapshot.elapsedSeconds)} · 进度 ${progress}%`:`从 00:00 开始，按自己的节奏结束并记录。`}</p>{timer.mode==="countdown"&&<><div className="timer-presets">{[15,25,45,60].map(v=><button disabled={timer.running} className={timer.durationSeconds===v*60?"active":""} onClick={()=>applyCountdownMinutes(v)} key={v}>{v} 分钟</button>)}</div><div className="custom-timer"><label htmlFor="custom-focus-minutes">自定义分钟</label><div><input id="custom-focus-minutes" type="number" min="1" max="600" inputMode="numeric" disabled={timer.running} value={customFocusMinutes} onChange={e=>setCustomFocusMinutes(e.target.value)} onBlur={()=>customFocusMinutes&&setCustomFocusMinutes(String(normalizeFocusMinutes(customFocusMinutes,workspaceData.settings.focusMinutes)))}/><button className="secondary" disabled={timer.running||!customFocusMinutes} onClick={()=>applyCountdownMinutes(customFocusMinutes)}>设置</button></div></div></>}<div className="focus-actions"><button className="primary large" onClick={toggleFocusTimer}>{timer.running?<><Pause/>暂停</>:<><Play/>{snapshot.elapsedSeconds>0?"继续":"开始"}</>}</button><button className="secondary" onClick={finishFocus}>结束并记录</button><button className="icon reset-focus" disabled={timer.running} onClick={resetFocus} aria-label="重置计时"><RotateCcw/></button></div><small className="focus-help">锁屏、切到后台或刷新页面后，计时会按真实经过时间继续恢复。</small><button className="text-btn focus-data-link" onClick={goFocusData}><BarChart3 size={15}/>查看每日、每周和每月专注数据</button></div></div>
  }
  if(modal==="emotion"){const prompts=[["我看到的 5 样东西","慢慢环顾四周，把看到的东西写下来"],["我听到的 3 种声音","注意远近不同的声音"],["身体接触到的 2 个位置","例如双脚接触地面、背部接触椅背"],["我现在准备完成的 1 件事","只选一件很小、可以马上开始的事"]];return <div className="modal-backdrop"><div className="modal emotion-modal"><button className="modal-close" onClick={close}><X/></button><span className="eyebrow">5 · 3 · 2 · 1 落地练习</span><div className="step-indicator">{prompts.map((_,i)=><i className={i<=step?"active":""} key={i}/>)}</div><h2>{prompts[step][0]}</h2><p>{prompts[step][1]}</p><textarea autoFocus value={form[`s${step}`]||""} onChange={e=>set(`s${step}`,e.target.value)} placeholder="写在这里…"/><button className="primary full" onClick={()=>step<3?setStep(step+1):(notify("我已经回到此刻。现在先做眼前这一件事。"),close())}>{step<3?"下一步":"完成练习"}</button></div></div>}
  const titles:{[K in Exclude<Modal,null|"focus"|"emotion">]:string}={task:editingItem?.kind==="task"?"修改任务":"添加今日任务",schedule:"添加日程",expense:editingItem?.kind==="transaction"?"修改账单":"快速记一笔",temporary:"添加临时任务",weight:editingItem?.kind==="weight"?"修改体重":"记录体重",drink:editingItem?.kind==="drink"?"修改饮品记录":"记录每日饮品",outfit:"记录今日穿搭",period:editingPeriod?"修改姨妈记录":"记录姨妈周期",note:"添加学习笔记"};
  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&close()}><div className="modal form-modal"><button className="modal-close" onClick={close} aria-label="关闭"><X/></button><span className="eyebrow">{workspaceName}</span><h2>{titles[modal as keyof typeof titles]}</h2>
    {modal==="task"&&<><Field label="任务名称"><input autoFocus value={form.title||""} onChange={e=>set("title",e.target.value)} placeholder="例如：去图书馆学习"/></Field><div className="form-grid"><Field label="类型"><select value={form.category||"AI训练"} onChange={e=>set("category",e.target.value)}><option>AI训练</option><option>提示词测试</option><option>素材整理</option><option>学习研究</option><option>生活事务</option><option>其他</option></select></Field><Field label="优先级"><select value={form.priority||"重要不紧急"} onChange={e=>set("priority",e.target.value)}><option>重要不紧急</option><option>紧急重要</option><option>普通</option><option>可延后</option></select></Field></div><Field label="预计时长（分钟）"><input type="number" min="5" value={form.minutes||"30"} onChange={e=>set("minutes",e.target.value)}/></Field><Field label="打卡地点或场景（可选）"><input value={form.checkinPlace||""} onChange={e=>set("checkinPlace",e.target.value)} placeholder="例如：图书馆、公司、健身房"/></Field><div className="privacy-note">填写后，这项任务会出现“到达打卡”；离开时再点一次，自动统计本月和历史到达次数、停留时长。</div><Field label="具体下一步"><textarea value={form.next||""} onChange={e=>set("next",e.target.value)} placeholder="15–30 分钟内能完成什么？"/></Field><Field label="完成标准"><textarea value={form.standard||""} onChange={e=>set("standard",e.target.value)} placeholder="怎样算完成？"/></Field></>}
    {modal==="schedule"&&<><div className="form-grid"><Field label="计划日期"><input autoFocus type="date" value={form.date||defaultScheduleDate} onChange={e=>set("date",e.target.value)}/></Field><Field label="开始时间"><input type="time" value={form.time||"09:00"} onChange={e=>set("time",e.target.value)}/></Field></div><Field label="日程名称"><input value={form.title||""} onChange={e=>set("title",e.target.value)} placeholder="例如：和朋友吃晚饭"/></Field><Field label="类型"><select value={form.type||"个人安排"} onChange={e=>set("type",e.target.value)}><option>个人安排</option><option>工作</option><option>学习</option><option>运动</option><option>约会</option><option>出行</option><option>其他</option></select></Field><div className="privacy-note">可以选择今天之后的任意日期。保存后会出现在对应日期的日历和日程列表中。</div></>}
    {modal==="temporary"&&<><Field label="任务名称"><input autoFocus value={form.title||""} onChange={e=>set("title",e.target.value)} placeholder="突然出现的事情"/></Field><Field label="截止日期（可选）"><input type="date" onChange={e=>set("deadline",e.target.value)}/></Field><Field label="优先级"><select onChange={e=>set("priority",e.target.value)}><option>普通</option><option>紧急重要</option><option>重要不紧急</option><option>可延后</option></select></Field></>}
    {modal==="expense"&&<><Field label="金额"><div className="money-input"><span>¥</span><input type="number" inputMode="decimal" min=".01" step=".01" value={form.amount||""} onChange={e=>set("amount",e.target.value)} placeholder="0.00"/></div></Field><div className="form-grid"><Field label="类型"><select value={form.type||"支出"} onChange={e=>set("type",e.target.value)}><option>支出</option><option>收入</option><option>转账</option></select></Field><Field label="分类"><select value={form.category||"餐饮"} onChange={e=>set("category",e.target.value)}><option>餐饮</option><option>交通</option><option>购物</option><option>学习</option><option>医疗</option><option>工作</option><option>其他</option></select></Field></div><Field label="账单日期"><input type="date" value={form.date||today} onChange={e=>set("date",e.target.value)}/></Field><Field label="备注"><input value={form.note||""} onChange={e=>set("note",e.target.value)} placeholder={form.type==="收入"?"这笔收入来自哪里？":form.type==="转账"?"转入或转出的账户":"这笔钱花在哪里？"}/></Field><div className="privacy-note">收入增加本月结余，支出减少本月结余；账户之间的转账不计入收支。</div></>}
    {modal==="weight"&&<><div className="form-grid"><Field label="体重（kg）"><input autoFocus type="number" inputMode="decimal" step=".1" value={form.value||""} onChange={e=>set("value",e.target.value)} placeholder="例如 62.5"/></Field><Field label="记录日期"><input type="date" value={form.date||today} onChange={e=>set("date",e.target.value)}/></Field></div><div className="privacy-note">体重只是身体状态的一项记录，不代表你的价值。每周记录一次就足够了。</div></>}
    {modal==="drink"&&<><div className={`photo-upload cup-sticker-preview${form.sticker==="true"?" ready":""}`}>{processing?<div className="photo-processing"><Sparkles/><b>正在生成杯子贴纸…</b><span>只提取杯子，不处理画面里的其他物品</span></div>:form.photo?<><img src={form.photo} alt={form.sticker==="true"?"杯子卡通贴纸预览":"已选择的饮品照片"}/>{form.sticker!=="true"&&<span className="original-photo-badge">照片已加入 · 待生成贴纸</span>}</>:<div><Camera size={28}/><b>添加一张饮品照片</b><span>让杯子单独、完整地出现在画面中</span></div>}</div>{form.photo&&<button type="button" className="remove-photo" onClick={()=>{setForm(current=>({...current,photo:"",sourcePhoto:"",sticker:"",photoStatus:"",photoError:""}));notify("照片已移除，可以重新选择")}}><Trash2 size={15}/>移除照片</button>}{form.photoError&&<div className="photo-error"><span>{form.photoError}</span>{form.sourcePhoto&&<button type="button" onClick={retryCup}><Sparkles size={15}/>重新生成贴纸</button>}</div>}<div className="photo-actions"><label className="secondary"><Camera size={17}/>打开相机<input type="file" accept="image/*" capture="environment" onChange={e=>readPhoto(e.target.files?.[0],true)}/></label><label className="secondary"><Upload size={17}/>从相册选择<input type="file" accept="image/*" onChange={e=>readPhoto(e.target.files?.[0],true)}/></label></div><div className="form-grid"><Field label="饮品名称"><input value={form.name||""} onChange={e=>set("name",e.target.value)} placeholder="例如：燕麦拿铁"/></Field><Field label="饮品类型"><select value={form.type||"咖啡"} onChange={e=>set("type",e.target.value)}><option>咖啡</option><option>茶</option><option>牛奶</option><option>果汁</option><option>气泡水</option><option>其他饮品</option></select></Field></div><Field label="大约容量（ml，可选）"><input type="number" inputMode="numeric" value={form.amount||""} onChange={e=>set("amount",e.target.value)} placeholder="例如 350"/></Field><div className="cartoon-note"><CupSoda/><span>杯子识别模型已内置到应用中，不再依赖国外网络。照片不会上传；只有识别出的杯子会生成卡通贴纸。</span></div></>}
    {modal==="outfit"&&<><div className="photo-upload outfit-preview">{processing?<div className="photo-processing"><Sparkles/><b>正在整理照片…</b></div>:form.photo?<img src={form.photo} alt="今日穿搭预览"/>:<div><Shirt size={28}/><b>上传今日穿搭</b><span>保留照片原貌，用 Lookbook 卡片展示</span></div>}</div><div className="photo-actions"><label className="secondary"><Camera size={17}/>拍摄穿搭<input type="file" accept="image/*" capture="environment" onChange={e=>readPhoto(e.target.files?.[0])}/></label><label className="secondary"><Upload size={17}/>从相册选择<input type="file" accept="image/*" onChange={e=>readPhoto(e.target.files?.[0])}/></label></div><div className="form-grid"><Field label="场合（可选）"><select value={form.occasion||""} onChange={e=>set("occasion",e.target.value)}><option value="">日常</option><option>上班</option><option>约会</option><option>运动</option><option>旅行</option><option>居家</option></select></Field><Field label="今天的感觉"><select value={form.mood||""} onChange={e=>set("mood",e.target.value)}><option value="">暂不填写</option><option>舒服自在</option><option>清爽利落</option><option>温柔松弛</option><option>有点特别</option></select></Field></div><Field label="穿搭备注（可选）"><input value={form.note||""} onChange={e=>set("note",e.target.value)} placeholder="例如：第一次尝试这组配色"/></Field></>}
    {modal==="period"&&<><div className="form-grid"><Field label="开始日期"><input autoFocus type="date" value={form.startDate||""} onChange={e=>set("startDate",e.target.value)}/></Field><Field label="结束日期（可稍后补充）"><input type="date" value={form.endDate||""} onChange={e=>set("endDate",e.target.value)}/></Field></div><Field label="经量感受（可选）"><select value={form.flow||""} onChange={e=>set("flow",e.target.value)}><option value="">暂不记录</option><option>较少</option><option>正常</option><option>较多</option></select></Field><Field label="身体感受或备注（可选）"><textarea value={form.note||""} onChange={e=>set("note",e.target.value)} placeholder="例如：第一天有轻微腹痛，今天想多休息。"/></Field><div className="privacy-note">周期预测仅作个人记录参考，不能替代医疗建议或作为避孕依据。</div></>}
    {modal==="note"&&<><div className="form-grid"><Field label="类型"><select onChange={e=>set("type",e.target.value)}><option>灵感</option><option>播客笔记</option><option>读书笔记</option></select></Field><Field label="标题"><input autoFocus value={form.title||""} onChange={e=>set("title",e.target.value)} placeholder="笔记标题"/></Field></div><Field label="核心内容"><textarea value={form.content||""} onChange={e=>set("content",e.target.value)} placeholder="对我真正有用的内容…"/></Field><Field label="可以采取的行动"><input value={form.action||""} onChange={e=>set("action",e.target.value)} placeholder="可一键转为任务"/></Field></>}
    <div className="modal-actions"><button className="secondary" onClick={close}>取消</button><button className="primary" onClick={save}>保存</button></div></div></div>
}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="field">{label}{children}</label>}
