/** One 2024 crafting labor day, matching commission estimates. */
export const LABOR_DAY_HOURS = 8;

export function sessionHoursForElapsedDays(days) {
  const count = Number(days);
  if (!Number.isFinite(count) || count <= 0) return 0;
  return count * LABOR_DAY_HOURS;
}
