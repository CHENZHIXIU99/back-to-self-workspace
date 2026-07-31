export type TransactionLike = {
  amount: number;
  type: string;
  category: string;
  date: string;
};

export function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateKey(dateKey:string):Date{
  const [year,month,day]=dateKey.split("-").map(Number);
  return new Date(year,month-1,day,12);
}

export function addDaysKey(dateKey:string,days:number):string{
  const date=parseDateKey(dateKey);
  date.setDate(date.getDate()+days);
  return localDateKey(date);
}

export function startOfWeekKey(dateKey:string):string{
  const date=parseDateKey(dateKey);
  const offset=(date.getDay()+6)%7;
  date.setDate(date.getDate()-offset);
  return localDateKey(date);
}

export function endOfWeekKey(dateKey:string):string{
  return addDaysKey(startOfWeekKey(dateKey),6);
}

export function monthBounds(monthKey:string):{start:string;end:string}{
  const [year,month]=monthKey.split("-").map(Number);
  return {
    start:`${year}-${String(month).padStart(2,"0")}-01`,
    end:localDateKey(new Date(year,month,0,12)),
  };
}

export function inDateRange(date:string,start:string,end:string):boolean{
  return Boolean(date)&&date>=start&&date<=end;
}

export function rangeStartKey(end:string,days:number):string{
  return addDaysKey(end,-Math.max(0,days-1));
}

export type FocusTimerLike={
  mode:"countdown"|"stopwatch";
  running:boolean;
  endAt:number;
  startedAt:number;
  remainingSeconds:number;
  elapsedSeconds:number;
  durationSeconds:number;
};

export function normalizeFocusMinutes(value:unknown,fallback=25):number{
  const parsed=Number(value);
  if(!Number.isFinite(parsed))return fallback;
  return Math.min(600,Math.max(1,Math.round(parsed)));
}

export function focusTimerSnapshot(timer:FocusTimerLike,now=Date.now()){
  if(timer.mode==="countdown"){
    const remaining=timer.running
      ?Math.max(0,Math.ceil((timer.endAt-now)/1000))
      :Math.max(0,Math.round(timer.remainingSeconds));
    return {
      displaySeconds:remaining,
      elapsedSeconds:Math.max(0,timer.durationSeconds-remaining),
      completed:remaining===0,
    };
  }
  const elapsed=timer.running
    ?Math.max(timer.elapsedSeconds,Math.floor((now-timer.startedAt)/1000))
    :Math.max(0,Math.round(timer.elapsedSeconds));
  return {displaySeconds:elapsed,elapsedSeconds:elapsed,completed:false};
}

export function focusMinutesFromSeconds(seconds:number):number{
  return Math.max(1,Math.round(Math.max(0,seconds)/60));
}

export function checkinDurationMinutes(arrivedAt:string,leftAt="",now=Date.now()):number{
  const start=new Date(arrivedAt).getTime();
  const end=leftAt?new Date(leftAt).getTime():now;
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<start)return 0;
  return Math.max(0,Math.round((end-start)/60000));
}

export function daysBetween(start:string,end:string):number{
  const [sy,sm,sd]=start.split("-").map(Number);
  const [ey,em,ed]=end.split("-").map(Number);
  return Math.round((Date.UTC(ey,em-1,ed)-Date.UTC(sy,sm-1,sd))/86400000);
}

export function average(values:number[]):number|null{
  if(!values.length)return null;
  return Math.round(values.reduce((sum,value)=>sum+value,0)/values.length*10)/10;
}

export type HealthLike={date:string;status?:string;sleep:number|null;water:number;meals:number|null};
export function summarizeHealth(records:HealthLike[],start:string,end:string){
  const scoped=records.filter(item=>inDateRange(item.date,start,end)).sort((a,b)=>a.date.localeCompare(b.date));
  const sleepValues=scoped.flatMap(item=>item.sleep===null?[]:[item.sleep]);
  const waterValues=scoped.map(item=>item.water).filter(value=>value>0);
  const mealValues=scoped.flatMap(item=>item.meals===null?[]:[item.meals]);
  const latestSleep=[...scoped].reverse().find(item=>item.sleep!==null);
  return {
    days:scoped.length,
    sleepAverage:average(sleepValues),
    waterAverage:average(waterValues),
    mealAverage:average(mealValues),
    regularMealDays:mealValues.filter(value=>value>=2).length,
    latestSleep:latestSleep?.sleep??null,
  };
}

export function weightChange(records:{date:string;value:number}[],start:string,end:string):number|null{
  const scoped=records.filter(item=>inDateRange(item.date,start,end)).sort((a,b)=>a.date.localeCompare(b.date));
  if(scoped.length<2)return null;
  return Math.round((scoped.at(-1)!.value-scoped[0].value)*10)/10;
}

export function periodsOverlap(
  existing:{startDate:string;endDate:string}[],
  startDate:string,
  endDate:string,
):boolean{
  const newEnd=endDate||"9999-12-31";
  return existing.some(item=>{
    const existingEnd=item.endDate||"9999-12-31";
    return startDate<=existingEnd&&item.startDate<=newEnd;
  });
}

export function predictNextPeriod(periods:{startDate:string}[]):{averageCycle:number;nextDate:string}|null{
  const starts=[...new Set(periods.map(item=>item.startDate).filter(Boolean))].sort();
  if(starts.length<2)return null;
  const intervals=starts.slice(1).map((date,index)=>daysBetween(starts[index],date)).filter(days=>days>=20&&days<=45);
  if(!intervals.length)return null;
  const averageCycle=Math.round(intervals.slice(-6).reduce((sum,value)=>sum+value,0)/intervals.slice(-6).length);
  return {averageCycle,nextDate:addDaysKey(starts.at(-1)!,averageCycle)};
}

export type CyclePhaseForecast={
  averageCycle:number;
  variation:number;
  nextPeriod:string;
  menstruation:{start:string;end:string};
  follicular:{start:string;end:string};
  ovulation:string;
  fertile:{start:string;end:string};
  luteal:{start:string;end:string};
  currentPhase:"经期"|"卵泡期"|"预计排卵期"|"黄体期"|"等待新周期记录";
  confidence:"初步估算"|"参考性较好";
};

export function estimateCyclePhases(
  periods:{startDate:string;endDate?:string}[],
  referenceDate=localDateKey(),
):CyclePhaseForecast|null{
  const sorted=[...periods].filter(item=>item.startDate).sort((a,b)=>a.startDate.localeCompare(b.startDate));
  if(sorted.length<2)return null;
  const starts=[...new Set(sorted.map(item=>item.startDate))];
  const intervals=starts.slice(1).map((date,index)=>daysBetween(starts[index],date)).filter(days=>days>=20&&days<=45).slice(-6);
  if(!intervals.length)return null;
  const averageCycle=Math.round(intervals.reduce((sum,value)=>sum+value,0)/intervals.length);
  const variation=Math.max(...intervals)-Math.min(...intervals);
  const latest=sorted.at(-1)!;
  const nextPeriod=addDaysKey(latest.startDate,averageCycle);
  const ovulation=addDaysKey(nextPeriod,-14);
  const estimatedPeriodEnd=latest.endDate||addDaysKey(latest.startDate,4);
  const menstruationEnd=estimatedPeriodEnd<ovulation?estimatedPeriodEnd:addDaysKey(ovulation,-1);
  const follicularStart=addDaysKey(menstruationEnd,1);
  const follicularEnd=addDaysKey(ovulation,-1);
  const fertile={start:addDaysKey(ovulation,-5),end:addDaysKey(ovulation,1)};
  const luteal={start:addDaysKey(ovulation,1),end:addDaysKey(nextPeriod,-1)};
  let currentPhase:CyclePhaseForecast["currentPhase"]="等待新周期记录";
  if(inDateRange(referenceDate,latest.startDate,menstruationEnd))currentPhase="经期";
  else if(inDateRange(referenceDate,follicularStart,addDaysKey(fertile.start,-1)))currentPhase="卵泡期";
  else if(inDateRange(referenceDate,fertile.start,fertile.end))currentPhase="预计排卵期";
  else if(inDateRange(referenceDate,addDaysKey(fertile.end,1),luteal.end))currentPhase="黄体期";
  return {
    averageCycle,variation,nextPeriod,
    menstruation:{start:latest.startDate,end:menstruationEnd},
    follicular:{start:follicularStart,end:follicularEnd},
    ovulation,fertile,luteal,currentPhase,
    confidence:intervals.length>=3&&variation<=7?"参考性较好":"初步估算",
  };
}

export type MonthCalendarCell = {
  dateKey: string;
  day: number;
  inMonth: boolean;
};

export function buildMonthCalendar(
  year: number,
  monthIndex: number,
): MonthCalendarCell[] {
  const firstDay = new Date(year, monthIndex, 1);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(year, monthIndex, 1 - mondayOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(
      gridStart.getFullYear(),
      gridStart.getMonth(),
      gridStart.getDate() + index,
    );
    return {
      dateKey: localDateKey(date),
      day: date.getDate(),
      inMonth: date.getMonth() === monthIndex,
    };
  });
}

export function schedulesForDate<T extends { date: string; time: string }>(
  schedule: T[],
  date: string,
): T[] {
  return schedule
    .filter((item) => item.date === date)
    .sort((a, b) => a.time.localeCompare(b.time));
}

export function normalizeMoney(value: number | string): number {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 0;
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function toCents(value: number): number {
  return Math.round(normalizeMoney(value) * 100);
}

export function summarizeTransactions(
  transactions: TransactionLike[],
  datePrefix: string,
) {
  const scoped = transactions.filter((item) => item.date.startsWith(datePrefix));
  const incomeCents = scoped
    .filter((item) => item.type === "收入")
    .reduce((sum, item) => sum + toCents(item.amount), 0);
  const expenseCents = scoped
    .filter((item) => item.type === "支出")
    .reduce((sum, item) => sum + toCents(item.amount), 0);

  return {
    income: incomeCents / 100,
    expense: expenseCents / 100,
    balance: (incomeCents - expenseCents) / 100,
    count: scoped.length,
  };
}

export function expenseByCategory(
  transactions: TransactionLike[],
  datePrefix: string,
): Record<string, number> {
  const totals = new Map<string, number>();
  for (const item of transactions) {
    if (
      item.type !== "支出" ||
      !item.date.startsWith(datePrefix) ||
      item.amount <= 0
    ) continue;
    totals.set(
      item.category,
      (totals.get(item.category) ?? 0) + toCents(item.amount),
    );
  }
  return Object.fromEntries(
    [...totals].map(([category, cents]) => [category, cents / 100]),
  );
}
export type TransactionLike = {
  amount: number;
  type: string;
  category: string;
  date: string;
};

export function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateKey(dateKey:string):Date{
  const [year,month,day]=dateKey.split("-").map(Number);
  return new Date(year,month-1,day,12);
}

export function addDaysKey(dateKey:string,days:number):string{
  const date=parseDateKey(dateKey);
  date.setDate(date.getDate()+days);
  return localDateKey(date);
}

export function startOfWeekKey(dateKey:string):string{
  const date=parseDateKey(dateKey);
  const offset=(date.getDay()+6)%7;
  date.setDate(date.getDate()-offset);
  return localDateKey(date);
}

export function endOfWeekKey(dateKey:string):string{
  return addDaysKey(startOfWeekKey(dateKey),6);
}

export function monthBounds(monthKey:string):{start:string;end:string}{
  const [year,month]=monthKey.split("-").map(Number);
  return {
    start:`${year}-${String(month).padStart(2,"0")}-01`,
    end:localDateKey(new Date(year,month,0,12)),
  };
}

export function inDateRange(date:string,start:string,end:string):boolean{
  return Boolean(date)&&date>=start&&date<=end;
}

export function rangeStartKey(end:string,days:number):string{
  return addDaysKey(end,-Math.max(0,days-1));
}

export function daysBetween(start:string,end:string):number{
  const [sy,sm,sd]=start.split("-").map(Number);
  const [ey,em,ed]=end.split("-").map(Number);
  return Math.round((Date.UTC(ey,em-1,ed)-Date.UTC(sy,sm-1,sd))/86400000);
}

export function average(values:number[]):number|null{
  if(!values.length)return null;
  return Math.round(values.reduce((sum,value)=>sum+value,0)/values.length*10)/10;
}

export type HealthLike={date:string;status?:string;sleep:number|null;water:number;meals:number|null};
export function summarizeHealth(records:HealthLike[],start:string,end:string){
  const scoped=records.filter(item=>inDateRange(item.date,start,end)).sort((a,b)=>a.date.localeCompare(b.date));
  const sleepValues=scoped.flatMap(item=>item.sleep===null?[]:[item.sleep]);
  const waterValues=scoped.map(item=>item.water).filter(value=>value>0);
  const mealValues=scoped.flatMap(item=>item.meals===null?[]:[item.meals]);
  const latestSleep=[...scoped].reverse().find(item=>item.sleep!==null);
  return {
    days:scoped.length,
    sleepAverage:average(sleepValues),
    waterAverage:average(waterValues),
    mealAverage:average(mealValues),
    regularMealDays:mealValues.filter(value=>value>=2).length,
    latestSleep:latestSleep?.sleep??null,
  };
}

export function weightChange(records:{date:string;value:number}[],start:string,end:string):number|null{
  const scoped=records.filter(item=>inDateRange(item.date,start,end)).sort((a,b)=>a.date.localeCompare(b.date));
  if(scoped.length<2)return null;
  return Math.round((scoped.at(-1)!.value-scoped[0].value)*10)/10;
}

export function periodsOverlap(
  existing:{startDate:string;endDate:string}[],
  startDate:string,
  endDate:string,
):boolean{
  const newEnd=endDate||"9999-12-31";
  return existing.some(item=>{
    const existingEnd=item.endDate||"9999-12-31";
    return startDate<=existingEnd&&item.startDate<=newEnd;
  });
}

export function predictNextPeriod(periods:{startDate:string}[]):{averageCycle:number;nextDate:string}|null{
  const starts=[...new Set(periods.map(item=>item.startDate).filter(Boolean))].sort();
  if(starts.length<2)return null;
  const intervals=starts.slice(1).map((date,index)=>daysBetween(starts[index],date)).filter(days=>days>=20&&days<=45);
  if(!intervals.length)return null;
  const averageCycle=Math.round(intervals.slice(-6).reduce((sum,value)=>sum+value,0)/intervals.slice(-6).length);
  return {averageCycle,nextDate:addDaysKey(starts.at(-1)!,averageCycle)};
}

export type CyclePhaseForecast={
  averageCycle:number;
  variation:number;
  nextPeriod:string;
  menstruation:{start:string;end:string};
  follicular:{start:string;end:string};
  ovulation:string;
  fertile:{start:string;end:string};
  luteal:{start:string;end:string};
  currentPhase:"经期"|"卵泡期"|"预计排卵期"|"黄体期"|"等待新周期记录";
  confidence:"初步估算"|"参考性较好";
};

export function estimateCyclePhases(
  periods:{startDate:string;endDate?:string}[],
  referenceDate=localDateKey(),
):CyclePhaseForecast|null{
  const sorted=[...periods].filter(item=>item.startDate).sort((a,b)=>a.startDate.localeCompare(b.startDate));
  if(sorted.length<2)return null;
  const starts=[...new Set(sorted.map(item=>item.startDate))];
  const intervals=starts.slice(1).map((date,index)=>daysBetween(starts[index],date)).filter(days=>days>=20&&days<=45).slice(-6);
  if(!intervals.length)return null;
  const averageCycle=Math.round(intervals.reduce((sum,value)=>sum+value,0)/intervals.length);
  const variation=Math.max(...intervals)-Math.min(...intervals);
  const latest=sorted.at(-1)!;
  const nextPeriod=addDaysKey(latest.startDate,averageCycle);
  const ovulation=addDaysKey(nextPeriod,-14);
  const estimatedPeriodEnd=latest.endDate||addDaysKey(latest.startDate,4);
  const menstruationEnd=estimatedPeriodEnd<ovulation?estimatedPeriodEnd:addDaysKey(ovulation,-1);
  const follicularStart=addDaysKey(menstruationEnd,1);
  const follicularEnd=addDaysKey(ovulation,-1);
  const fertile={start:addDaysKey(ovulation,-5),end:addDaysKey(ovulation,1)};
  const luteal={start:addDaysKey(ovulation,1),end:addDaysKey(nextPeriod,-1)};
  let currentPhase:CyclePhaseForecast["currentPhase"]="等待新周期记录";
  if(inDateRange(referenceDate,latest.startDate,menstruationEnd))currentPhase="经期";
  else if(inDateRange(referenceDate,follicularStart,addDaysKey(fertile.start,-1)))currentPhase="卵泡期";
  else if(inDateRange(referenceDate,fertile.start,fertile.end))currentPhase="预计排卵期";
  else if(inDateRange(referenceDate,addDaysKey(fertile.end,1),luteal.end))currentPhase="黄体期";
  return {
    averageCycle,variation,nextPeriod,
    menstruation:{start:latest.startDate,end:menstruationEnd},
    follicular:{start:follicularStart,end:follicularEnd},
    ovulation,fertile,luteal,currentPhase,
    confidence:intervals.length>=3&&variation<=7?"参考性较好":"初步估算",
  };
}

export type MonthCalendarCell = {
  dateKey: string;
  day: number;
  inMonth: boolean;
};

export function buildMonthCalendar(
  year: number,
  monthIndex: number,
): MonthCalendarCell[] {
  const firstDay = new Date(year, monthIndex, 1);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(year, monthIndex, 1 - mondayOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(
      gridStart.getFullYear(),
      gridStart.getMonth(),
      gridStart.getDate() + index,
    );
    return {
      dateKey: localDateKey(date),
      day: date.getDate(),
      inMonth: date.getMonth() === monthIndex,
    };
  });
}

export function schedulesForDate<T extends { date: string; time: string }>(
  schedule: T[],
  date: string,
): T[] {
  return schedule
    .filter((item) => item.date === date)
    .sort((a, b) => a.time.localeCompare(b.time));
}

export function normalizeMoney(value: number | string): number {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 0;
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function toCents(value: number): number {
  return Math.round(normalizeMoney(value) * 100);
}

export function summarizeTransactions(
  transactions: TransactionLike[],
  datePrefix: string,
) {
  const scoped = transactions.filter((item) => item.date.startsWith(datePrefix));
  const incomeCents = scoped
    .filter((item) => item.type === "收入")
    .reduce((sum, item) => sum + toCents(item.amount), 0);
  const expenseCents = scoped
    .filter((item) => item.type === "支出")
    .reduce((sum, item) => sum + toCents(item.amount), 0);

  return {
    income: incomeCents / 100,
    expense: expenseCents / 100,
    balance: (incomeCents - expenseCents) / 100,
    count: scoped.length,
  };
}

export function expenseByCategory(
  transactions: TransactionLike[],
  datePrefix: string,
): Record<string, number> {
  const totals = new Map<string, number>();
  for (const item of transactions) {
    if (
      item.type !== "支出" ||
      !item.date.startsWith(datePrefix) ||
      item.amount <= 0
    ) continue;
    totals.set(
      item.category,
      (totals.get(item.category) ?? 0) + toCents(item.amount),
    );
  }
  return Object.fromEntries(
    [...totals].map(([category, cents]) => [category, cents / 100]),
  );
}
