import { openDB } from "idb";
import { localDateKey, startOfWeekKey } from "./logic";

export type Task={
  id:string;title:string;next:string;standard:string;minutes:number;category:string;priority:string;
  done:boolean;important?:boolean;createdDate?:string;completedDate?:string;checkinPlace?:string;
};
export type DailyHealth={date:string;status:string;sleep:number|null;water:number;meals:number|null};
export type FocusRecord={id:string;date:string;minutes:number;completedAt:string};
export type CheckinRecord={id:string;taskId:string;title:string;place:string;date:string;arrivedAt:string;leftAt:string};
export type WeeklyReview={weekStart:string;best:string;next:string};
export type WorkspaceData={
  schemaVersion:number;createdAt:string;updatedAt:string;
  status:string;focusSessions:number;
  profile:{name:string};
  settings:{monthlyBudget:number;focusMinutes:number};
  tasks:Task[];temporary:{id:string;title:string;deadline:string;priority:string;done:boolean}[];
  transactions:{id:string;amount:number;type:string;category:string;note:string;date:string}[];
  health:{date:string;sleep:number|null;water:number;meals:number|null};
  healthRecords:DailyHealth[];
  weights:{id:string;value:number;date:string}[];
  drinks:{id:string;name:string;type:string;amount:number|null;photo:string;date:string;time:string;sticker?:boolean}[];
  outfits:{id:string;photo:string;date:string;occasion:string;mood:string;note:string}[];
  periods:{id:string;startDate:string;endDate:string;flow:string;note:string}[];
  notes:{id:string;type:string;title:string;content:string;action:string;createdDate?:string}[];
  schedule:{id:string;date:string;time:string;title:string;type:string}[];
  focusRecords:FocusRecord[];
  checkins:CheckinRecord[];
  boundaries:string[];
  review:{best:string;next:string};
  reviews:WeeklyReview[];
};

const now=new Date().toISOString();
export const seedData:WorkspaceData={
  schemaVersion:10,createdAt:now,updatedAt:now,status:"",focusSessions:0,profile:{name:"橙子"},
  settings:{monthlyBudget:3000,focusMinutes:25},
  tasks:[],temporary:[],transactions:[],
  health:{date:"",sleep:null,water:0,meals:null},healthRecords:[],
  weights:[],drinks:[],outfits:[],periods:[],notes:[],schedule:[],focusRecords:[],checkins:[],
  boundaries:[],review:{best:"",next:""},reviews:[],
};

function normalizeSchedule(schedule:Partial<WorkspaceData["schedule"][number]>[]|undefined){
  const fallbackDate=localDateKey();
  return (schedule||[]).map((item,index)=>({
    id:item.id||`legacy-schedule-${index}-${item.time||"00:00"}`,
    date:item.date||fallbackDate,
    time:item.time||"09:00",
    title:item.title||"未命名日程",
    type:item.type||"个人安排",
  }));
}

function normalizeHealthRecords(saved:Partial<WorkspaceData>){
  const records=new Map<string,DailyHealth>();
  for(const item of saved.healthRecords||[]){
    if(!item?.date)continue;
    records.set(item.date,{
      date:item.date,status:item.status||"",sleep:item.sleep??null,
      water:Math.max(0,Number(item.water)||0),meals:item.meals??null,
    });
  }
  const legacy=saved.health;
  if(legacy?.date&&!records.has(legacy.date)){
    records.set(legacy.date,{date:legacy.date,status:"",sleep:legacy.sleep??null,water:Math.max(0,legacy.water||0),meals:legacy.meals??null});
  }
  const today=localDateKey();
  if(saved.status){
    const current=records.get(today)||{date:today,status:"",sleep:null,water:0,meals:null};
    records.set(today,{...current,status:saved.status});
  }
  return [...records.values()].sort((a,b)=>a.date.localeCompare(b.date));
}

export function normalizeWorkspace(raw:Partial<WorkspaceData>):WorkspaceData{
  const tasks=(raw.tasks||[]).map(task=>({...task,createdDate:task.createdDate||"",completedDate:task.completedDate||"",checkinPlace:task.checkinPlace||""}));
  const notes=(raw.notes||[]).map(note=>({...note,createdDate:note.createdDate||""}));
  const currentWeek=startOfWeekKey(localDateKey());
  const reviews=[...(raw.reviews||[])];
  if((raw.review?.best||raw.review?.next)&&!reviews.some(item=>item.weekStart===currentWeek)){
    reviews.push({weekStart:currentWeek,best:raw.review?.best||"",next:raw.review?.next||""});
  }
  return {
    ...seedData,...raw,schemaVersion:10,status:"",
    profile:{...seedData.profile,...raw.profile},
    settings:{...seedData.settings,...raw.settings},
    tasks,notes,
    health:{...seedData.health,...raw.health},
    healthRecords:normalizeHealthRecords(raw),
    drinks:(raw.drinks||[]).map(item=>({...item,sticker:item.sticker||false})),
    outfits:raw.outfits||[],periods:raw.periods||[],
    schedule:normalizeSchedule(raw.schedule),
    focusRecords:raw.focusRecords||[],
    checkins:(raw.checkins||[]).map(item=>({...item,taskId:item.taskId||"",title:item.title||item.place||"未命名打卡",place:item.place||item.title||"未命名地点",date:item.date||localDateKey(),arrivedAt:item.arrivedAt||"",leftAt:item.leftAt||""})),
    reviews:reviews.sort((a,b)=>a.weekStart.localeCompare(b.weekStart)),
  };
}

const DB="back-to-self",STORE="workspace",KEY="primary";
export async function loadWorkspace():Promise<WorkspaceData>{
  try{
    const db=await openDB(DB,1,{upgrade(database){if(!database.objectStoreNames.contains(STORE))database.createObjectStore(STORE)}});
    const saved=await db.get(STORE,KEY) as WorkspaceData|undefined;
    if(!saved)return seedData;
    if((saved.schemaVersion||1)<2){
      const demoIds=new Set(["t1","t2","t3","tmp1","m1","m2","m3","w1","w2","w3","w4","n1"]);
      return normalizeWorkspace({
        ...saved,status:"",focusSessions:0,profile:{name:"橙子"},
        tasks:(saved.tasks||[]).filter(item=>!demoIds.has(item.id)),
        temporary:(saved.temporary||[]).filter(item=>!demoIds.has(item.id)),
        transactions:(saved.transactions||[]).filter(item=>!demoIds.has(item.id)),
        weights:(saved.weights||[]).filter(item=>!demoIds.has(item.id)),
        notes:(saved.notes||[]).filter(item=>!demoIds.has(item.id)),
        schedule:[],health:{date:"",sleep:null,water:0,meals:null},healthRecords:[],
        drinks:[],outfits:[],periods:[],focusRecords:[],checkins:[],boundaries:[],review:{best:"",next:""},reviews:[],
      });
    }
    return normalizeWorkspace(saved);
  }catch{return seedData}
}
export async function saveWorkspace(data:WorkspaceData){
  try{
    const db=await openDB(DB,1,{upgrade(database){if(!database.objectStoreNames.contains(STORE))database.createObjectStore(STORE)}});
    await db.put(STORE,{...data,updatedAt:new Date().toISOString()},KEY);
  }catch{}
}
import { openDB } from "idb";
import { localDateKey, startOfWeekKey } from "./logic";

export type Task={
  id:string;title:string;next:string;standard:string;minutes:number;category:string;priority:string;
  done:boolean;important?:boolean;createdDate?:string;completedDate?:string;
};
export type DailyHealth={date:string;status:string;sleep:number|null;water:number;meals:number|null};
export type FocusRecord={id:string;date:string;minutes:number;completedAt:string};
export type WeeklyReview={weekStart:string;best:string;next:string};
export type WorkspaceData={
  schemaVersion:number;createdAt:string;updatedAt:string;
  status:string;focusSessions:number;
  profile:{name:string};
  settings:{monthlyBudget:number};
  tasks:Task[];temporary:{id:string;title:string;deadline:string;priority:string;done:boolean}[];
  transactions:{id:string;amount:number;type:string;category:string;note:string;date:string}[];
  health:{date:string;sleep:number|null;water:number;meals:number|null};
  healthRecords:DailyHealth[];
  weights:{id:string;value:number;date:string}[];
  drinks:{id:string;name:string;type:string;amount:number|null;photo:string;date:string;time:string;sticker?:boolean}[];
  outfits:{id:string;photo:string;date:string;occasion:string;mood:string;note:string}[];
  periods:{id:string;startDate:string;endDate:string;flow:string;note:string}[];
  notes:{id:string;type:string;title:string;content:string;action:string;createdDate?:string}[];
  schedule:{id:string;date:string;time:string;title:string;type:string}[];
  focusRecords:FocusRecord[];
  boundaries:string[];
  review:{best:string;next:string};
  reviews:WeeklyReview[];
};

const now=new Date().toISOString();
export const seedData:WorkspaceData={
  schemaVersion:8,createdAt:now,updatedAt:now,status:"",focusSessions:0,profile:{name:"橙子"},
  settings:{monthlyBudget:3000},
  tasks:[],temporary:[],transactions:[],
  health:{date:"",sleep:null,water:0,meals:null},healthRecords:[],
  weights:[],drinks:[],outfits:[],periods:[],notes:[],schedule:[],focusRecords:[],
  boundaries:[],review:{best:"",next:""},reviews:[],
};

function normalizeSchedule(schedule:Partial<WorkspaceData["schedule"][number]>[]|undefined){
  const fallbackDate=localDateKey();
  return (schedule||[]).map((item,index)=>({
    id:item.id||`legacy-schedule-${index}-${item.time||"00:00"}`,
    date:item.date||fallbackDate,
    time:item.time||"09:00",
    title:item.title||"未命名日程",
    type:item.type||"个人安排",
  }));
}

function normalizeHealthRecords(saved:Partial<WorkspaceData>){
  const records=new Map<string,DailyHealth>();
  for(const item of saved.healthRecords||[]){
    if(!item?.date)continue;
    records.set(item.date,{
      date:item.date,status:item.status||"",sleep:item.sleep??null,
      water:Math.max(0,Number(item.water)||0),meals:item.meals??null,
    });
  }
  const legacy=saved.health;
  if(legacy?.date&&!records.has(legacy.date)){
    records.set(legacy.date,{date:legacy.date,status:"",sleep:legacy.sleep??null,water:Math.max(0,legacy.water||0),meals:legacy.meals??null});
  }
  const today=localDateKey();
  if(saved.status){
    const current=records.get(today)||{date:today,status:"",sleep:null,water:0,meals:null};
    records.set(today,{...current,status:saved.status});
  }
  return [...records.values()].sort((a,b)=>a.date.localeCompare(b.date));
}

export function normalizeWorkspace(raw:Partial<WorkspaceData>):WorkspaceData{
  const tasks=(raw.tasks||[]).map(task=>({...task,createdDate:task.createdDate||"",completedDate:task.completedDate||""}));
  const notes=(raw.notes||[]).map(note=>({...note,createdDate:note.createdDate||""}));
  const currentWeek=startOfWeekKey(localDateKey());
  const reviews=[...(raw.reviews||[])];
  if((raw.review?.best||raw.review?.next)&&!reviews.some(item=>item.weekStart===currentWeek)){
    reviews.push({weekStart:currentWeek,best:raw.review?.best||"",next:raw.review?.next||""});
  }
  return {
    ...seedData,...raw,schemaVersion:8,status:"",
    profile:{...seedData.profile,...raw.profile},
    settings:{...seedData.settings,...raw.settings},
    tasks,notes,
    health:{...seedData.health,...raw.health},
    healthRecords:normalizeHealthRecords(raw),
    drinks:(raw.drinks||[]).map(item=>({...item,sticker:item.sticker||false})),
    outfits:raw.outfits||[],periods:raw.periods||[],
    schedule:normalizeSchedule(raw.schedule),
    focusRecords:raw.focusRecords||[],
    reviews:reviews.sort((a,b)=>a.weekStart.localeCompare(b.weekStart)),
  };
}

const DB="back-to-self",STORE="workspace",KEY="primary";
export async function loadWorkspace():Promise<WorkspaceData>{
  try{
    const db=await openDB(DB,1,{upgrade(database){if(!database.objectStoreNames.contains(STORE))database.createObjectStore(STORE)}});
    const saved=await db.get(STORE,KEY) as WorkspaceData|undefined;
    if(!saved)return seedData;
    if((saved.schemaVersion||1)<2){
      const demoIds=new Set(["t1","t2","t3","tmp1","m1","m2","m3","w1","w2","w3","w4","n1"]);
      return normalizeWorkspace({
        ...saved,status:"",focusSessions:0,profile:{name:"橙子"},
        tasks:(saved.tasks||[]).filter(item=>!demoIds.has(item.id)),
        temporary:(saved.temporary||[]).filter(item=>!demoIds.has(item.id)),
        transactions:(saved.transactions||[]).filter(item=>!demoIds.has(item.id)),
        weights:(saved.weights||[]).filter(item=>!demoIds.has(item.id)),
        notes:(saved.notes||[]).filter(item=>!demoIds.has(item.id)),
        schedule:[],health:{date:"",sleep:null,water:0,meals:null},healthRecords:[],
        drinks:[],outfits:[],periods:[],focusRecords:[],boundaries:[],review:{best:"",next:""},reviews:[],
      });
    }
    return normalizeWorkspace(saved);
  }catch{return seedData}
}
export async function saveWorkspace(data:WorkspaceData){
  try{
    const db=await openDB(DB,1,{upgrade(database){if(!database.objectStoreNames.contains(STORE))database.createObjectStore(STORE)}});
    await db.put(STORE,{...data,updatedAt:new Date().toISOString()},KEY);
  }catch{}
}
