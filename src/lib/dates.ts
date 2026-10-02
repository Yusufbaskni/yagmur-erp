import { ErpError } from "@/server/errors";

export function todayInput(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addDaysInput(days: number, now = new Date()) {
  const [year, month, day] = todayInput(now).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days, 12));
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDateInput(raw: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new ErpError("Tarih geçersiz.");
  }
  const [year, month, day] = raw.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new ErpError("Tarih geçersiz.");
  }
  return date;
}

export function startOfToday(now = new Date()) {
  return parseDateInput(todayInput(now));
}

export function monthStart(now = new Date()) {
  const [year, month] = todayInput(now).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
}
