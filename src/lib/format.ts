export function formatMoney(kurusValue: number) {
  const sign = kurusValue < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(kurusValue));
  const lira = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, "0");
  const grouped = new Intl.NumberFormat("tr-TR").format(lira);
  return `${sign}${grouped},${frac} TL`;
}

export function formatQty(milliValue: number) {
  const sign = milliValue < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(milliValue));
  const whole = Math.floor(abs / 1000);
  const frac = abs % 1000;
  const grouped = new Intl.NumberFormat("tr-TR").format(whole);
  if (frac === 0) return `${sign}${grouped}`;
  const fracStr = String(frac).padStart(3, "0").replace(/0+$/, "");
  return `${sign}${grouped},${fracStr}`;
}

export function formatDate(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function kurusToInput(kurusValue: number) {
  const sign = kurusValue < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(kurusValue));
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

export function milliToInput(milliValue: number) {
  const sign = milliValue < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(milliValue));
  const frac = String(abs % 1000).padStart(3, "0").replace(/0+$/, "");
  return frac
    ? `${sign}${Math.floor(abs / 1000)}.${frac}`
    : `${sign}${Math.floor(abs / 1000)}`;
}
