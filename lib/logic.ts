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
