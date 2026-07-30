import { openDB } from "idb";

export type Task={id:string;title:string;next:string;standard:string;minutes:number;category:string;priority:string;done:boolean;important?:boolean};
export type WorkspaceData={
  schemaVersion:number;createdAt:string;updatedAt:string;status:string;focusSessions:number;
  profile:{name:string};
  tasks:Task[];temporary:{id:string;title:string;deadline:string;priority:string;done:boolean}[];
  transactions:{id:string;amount:number;type:string;category:string;note:string;date:string}[];
  health:{date:string;sleep:number|null;water:number;meals:number|null};weights:{id:string;value:number;date:string}[];
  drinks:{id:string;name:string;type:string;amount:number|null;photo:string;date:string;time:string;sticker?:boolean}[];
  outfits:{id:string;photo:string;date:string;occasion:string;mood:string;note:string}[];
  periods:{id:string;startDate:string;endDate:string;flow:string;note:string}[];
  notes:{id:string;type:string;title:string;content:string;action:string}[];
  schedule:{time:string;title:string;type:string}[];boundaries:string[];review:{best:string;next:string};
};
const now=new Date().toISOString();
export const seedData:WorkspaceData={schemaVersion:6,createdAt:now,updatedAt:now,status:"",focusSessions:0,profile:{name:"橙子"},
tasks:[],temporary:[],transactions:[],health:{date:"",sleep:null,water:0,meals:null},weights:[],drinks:[],outfits:[],periods:[],notes:[],schedule:[],boundaries:[],review:{best:"",next:""}};

const DB="back-to-self",STORE="workspace",KEY="primary";
export async function loadWorkspace():Promise<WorkspaceData>{try{const db=await openDB(DB,1,{upgrade(db){if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE)}});const saved=await db.get(STORE,KEY) as WorkspaceData|undefined;if(!saved)return seedData;if((saved.schemaVersion||1)<2){const demoIds=new Set(["t1","t2","t3","tmp1","m1","m2","m3","w1","w2","w3","w4","n1"]);return {...saved,schemaVersion:6,status:"",focusSessions:0,profile:{name:"橙子"},tasks:saved.tasks.filter(x=>!demoIds.has(x.id)),temporary:saved.temporary.filter(x=>!demoIds.has(x.id)),transactions:saved.transactions.filter(x=>!demoIds.has(x.id)),weights:saved.weights.filter(x=>!demoIds.has(x.id)),notes:saved.notes.filter(x=>!demoIds.has(x.id)),schedule:[],health:{date:"",sleep:null,water:0,meals:null},drinks:[],outfits:[],periods:[],boundaries:[],review:{best:"",next:""}}}return {...seedData,...saved,schemaVersion:6,profile:{...seedData.profile,...saved.profile},health:{...seedData.health,...saved.health},drinks:(saved.drinks||[]).map(x=>({...x,sticker:x.sticker||false})),outfits:saved.outfits||[],periods:saved.periods||[]}}catch{return seedData}}
export async function saveWorkspace(data:WorkspaceData){try{const db=await openDB(DB,1,{upgrade(db){if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE)}});await db.put(STORE,{...data,updatedAt:new Date().toISOString()},KEY)}catch{}}
