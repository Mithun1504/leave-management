import type Database from 'better-sqlite3';

export const LEAVE_TYPES = ['Casual', 'Sick', 'Earned'] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];

export interface LeaveBalance {
  leaveType: LeaveType;
  allocatedDays: number;
  usedDays: number;
  remainingDays: number;
}

export interface YearlyBalances {
  year: number;
  balances: LeaveBalance[];
}

export interface DateRange {
  startDate: string;
  endDate: string;
}

const ALLOCATIONS: Record<LeaveType, number> = {
  Casual: 12,
  Sick: 10,
  Earned: 15
};

function utcDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function countWeekdays(startDate: string, endDate: string): number {
  const start = utcDate(startDate).getTime();
  const end = utcDate(endDate).getTime();
  let days = 0;
  for (let timestamp = start; timestamp <= end; timestamp += 86_400_000) {
    const weekday = new Date(timestamp).getUTCDay();
    if (weekday !== 0 && weekday !== 6) days += 1;
  }
  return days;
}

export function weekdaysByYear(range: DateRange): Map<number, number> {
  const result = new Map<number, number>();
  for (let timestamp = utcDate(range.startDate).getTime(); timestamp <= utcDate(range.endDate).getTime(); timestamp += 86_400_000) {
    const date = new Date(timestamp);
    const weekday = date.getUTCDay();
    if (weekday === 0 || weekday === 6) continue;
    const year = date.getUTCFullYear();
    result.set(year, (result.get(year) ?? 0) + 1);
  }
  return result;
}

export class BalanceService {
  constructor(private readonly db: Database.Database) {}

  currentYear(): number {
    return new Date().getUTCFullYear();
  }

  yearlyAllocations(): Record<LeaveType, number> {
    return { ...ALLOCATIONS };
  }

  balancesForYear(employeeId: number, year = this.currentYear()): YearlyBalances {
    const startOfYear = `${year}-01-01`;
    const endOfYear = `${year}-12-31`;
    const approvedRequests = this.db.prepare(`
      SELECT leave_type AS leaveType, start_date AS startDate, end_date AS endDate
      FROM leave_requests
      WHERE employee_id = ? AND status = 'Approved'
        AND start_date <= ? AND end_date >= ?
    `).all(employeeId, endOfYear, startOfYear) as Array<DateRange & { leaveType: LeaveType }>;

    const used: Record<LeaveType, number> = { Casual: 0, Sick: 0, Earned: 0 };
    for (const request of approvedRequests) {
      used[request.leaveType] += weekdaysByYear(request).get(year) ?? 0;
    }

    const balances = LEAVE_TYPES.map((leaveType) => ({
      leaveType,
      allocatedDays: ALLOCATIONS[leaveType],
      usedDays: used[leaveType],
      remainingDays: ALLOCATIONS[leaveType] - used[leaveType]
    }));
    return { year, balances };
  }
}
