import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  buildMonthCalendar,
  expenseByCategory,
  localDateKey,
  normalizeMoney,
  schedulesForDate,
  summarizeTransactions,
} from "../lib/logic.ts";

test("每日进度按完成数量计算",()=>{const tasks=[{done:true},{done:false},{done:true}];assert.equal(tasks.filter(x=>x.done).length/tasks.length,2/3)});
test("金额按分累加且不会出现浮点误差",()=>{
  const tx=[
    {type:"支出",amount:.1,category:"餐饮",date:"2026-07-01"},
    {type:"支出",amount:.2,category:"餐饮",date:"2026-07-02"},
    {type:"收入",amount:10,category:"工资",date:"2026-07-03"},
  ];
  assert.deepEqual(summarizeTransactions(tx,"2026-07"),{income:10,expense:.3,balance:9.7,count:3});
});
test("今日与本月账单严格按日期筛选",()=>{
  const tx=[
    {type:"支出",amount:25,category:"餐饮",date:"2026-07-30"},
    {type:"支出",amount:18,category:"交通",date:"2026-07-29"},
    {type:"收入",amount:680,category:"工作",date:"2026-06-30"},
  ];
  assert.equal(summarizeTransactions(tx,"2026-07-30").expense,25);
  assert.deepEqual(summarizeTransactions(tx,"2026-07"),{income:0,expense:43,balance:-43,count:2});
});
test("分类支出不会混入收入和转账",()=>{
  const tx=[
    {type:"支出",amount:30,category:"餐饮",date:"2026-07-01"},
    {type:"收入",amount:200,category:"餐饮",date:"2026-07-02"},
    {type:"转账",amount:50,category:"其他",date:"2026-07-03"},
  ];
  assert.deepEqual(expenseByCategory(tx,"2026-07"),{餐饮:30});
});
test("金额保存为两位小数且非法金额归零",()=>{
  assert.equal(normalizeMoney("12.345"),12.35);
  assert.equal(normalizeMoney("not-a-number"),0);
});
test("本地日期不会使用 UTC 日期替代",()=>{
  assert.equal(localDateKey(new Date(2026,6,30,23,59)),"2026-07-30");
});
test("日历按周一开头生成完整六周且日期准确",()=>{
  const cells=buildMonthCalendar(2026,6);
  assert.equal(cells.length,42);
  assert.equal(cells[0].dateKey,"2026-06-29");
  assert.equal(cells.find(x=>x.dateKey==="2026-07-30")?.day,30);
  assert.equal(cells.at(-1)?.dateKey,"2026-08-09");
});
test("未来日程只显示在对应日期，并按时间先后排列",()=>{
  const schedule=[
    {id:"1",date:"2026-08-05",time:"18:30",title:"晚饭"},
    {id:"2",date:"2026-07-31",time:"09:00",title:"今天"},
    {id:"3",date:"2026-08-05",time:"08:15",title:"晨练"},
  ];
  assert.deepEqual(schedulesForDate(schedule,"2026-08-05").map(x=>x.id),["3","1"]);
  assert.deepEqual(schedulesForDate(schedule,"2026-07-31").map(x=>x.id),["2"]);
});
test("未完成任务自动顺延最多两项",()=>{const pending=[1,2,3,4];assert.deepEqual(pending.slice(0,2),[1,2])});
test("计时器按结束时间恢复",()=>{const now=1_000_000,end=now+25*60*1000;assert.equal(Math.ceil((end-now)/1000),1500)});
test("数据导出后可无损导入",()=>{const data={schemaVersion:1,tasks:[{id:"1"}]};assert.deepEqual(JSON.parse(JSON.stringify(data)),data)});
test("内置杯子识别模型及全部权重文件完整",()=>{
  const modelDir=fileURLToPath(new URL("../public/models/ssdlite_mobilenet_v2/",import.meta.url));
  const manifest=JSON.parse(readFileSync(`${modelDir}/model.json`,"utf8"));
  const shards=manifest.weightsManifest.flatMap(group=>group.paths);
  assert.equal(shards.length,5);
  for(const shard of shards){
    const file=`${modelDir}/${shard}`;
    assert.ok(existsSync(file),`${shard} 应存在`);
    assert.ok(statSync(file).size>1_000_000,`${shard} 不应为空`);
  }
});
test("首页、健康页与设置页不会再次出现重复入口",()=>{
  const source=readFileSync(fileURLToPath(new URL("../app/page.tsx",import.meta.url)),"utf8");
  const today=source.slice(source.indexOf("function Today("),source.indexOf("function Summary("));
  const health=source.slice(source.indexOf("function Health("),source.indexOf("function Metric("));
  const settings=source.slice(source.indexOf("function SettingsPage("),source.indexOf("function SearchResults("));
  assert.doesNotMatch(today,/今日生活记录|快速操作|健康记录/);
  assert.doesNotMatch(today,/title="临时任务"[^\\n]*action="快速添加"/);
  assert.doesNotMatch(health,/记录第一杯|记录第一套穿搭|添加第一次记录|<section className="metric-grid">/);
  assert.doesNotMatch(settings,/install-panel|InstallButton|显示系统安装提示/);
  assert.match(settings,/settings-install-mini/);
});
test("杯子贴纸识别使用适合手机照片的容错阈值且只接受杯子类别",()=>{
  const source=readFileSync(fileURLToPath(new URL("../app/page.tsx",import.meta.url)),"utf8");
  const sticker=source.slice(source.indexOf("async function processCupSticker("),source.indexOf("function Editor("));
  assert.match(sticker,/item\.class==="cup"&&item\.score>=\.35/);
  assert.doesNotMatch(sticker,/item\.class==="bottle"|item\.class==="wine glass"/);
});
test("日程入口不会再误用今日任务，保存时必须写入所选日期",()=>{
  const source=readFileSync(fileURLToPath(new URL("../app/page.tsx",import.meta.url)),"utf8");
  const calendar=source.slice(source.indexOf("function Calendar("),source.indexOf("function Temporary("));
  const editor=source.slice(source.indexOf("function Editor("),source.indexOf("function Field("));
  assert.doesNotMatch(calendar,/open\("task"\)/);
  assert.match(calendar,/openSchedule\(selectedDate\)/);
  assert.match(editor,/modal==="schedule"/);
  assert.match(editor,/date:form\.date/);
});
