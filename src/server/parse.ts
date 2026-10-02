import { Prisma } from "@prisma/client";
import { parseDateInput } from "@/lib/dates";
import { ErpError } from "@/server/errors";
import type { LineInput, PartyInput, ProductInput } from "@/server/ledger";
import { DEFAULT_VAT_RATE, kurus, milli } from "@/server/money";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export function parseLooseDecimal(raw: string) {
  const value = raw.trim().replace(/\s/g, "");
  if (!value) throw new ErpError("Sayı girin.");
  const normalized = value.includes(",")
    ? value.replace(/\./g, "").replace(",", ".")
    : value;
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
    throw new ErpError(`Geçersiz sayı: ${raw}`);
  }
  return new Prisma.Decimal(normalized);
}

export function parseKurus(raw: string) {
  const value = kurus(parseLooseDecimal(raw));
  if (value < 0) throw new ErpError("Tutar negatif olamaz.");
  return value;
}

export function parseMilli(raw: string) {
  const value = milli(parseLooseDecimal(raw));
  if (value < 0) throw new ErpError("Miktar negatif olamaz.");
  return value;
}

export function parseVatRate(raw: string) {
  if (!raw) return DEFAULT_VAT_RATE;
  const value = Number(raw);
  if (![0, 1, 10, 20].includes(value)) throw new ErpError("KDV oranı 0, 1, 10 veya 20 olmalı.");
  return value;
}

export function parseLines(formData: FormData): LineInput[] {
  const productIds = formData.getAll("productId").map(String);
  const quantities = formData.getAll("quantity").map(String);
  const prices = formData.getAll("unitPrice").map(String);
  const vatRates = formData.getAll("vatRate").map(String);
  const discounts = formData.getAll("discountBps").map(String);
  const lots = formData.getAll("lotCode").map(String);
  const serials = formData.getAll("serialCode").map(String);
  if (productIds.length === 0) throw new ErpError("En az bir satır ekleyin.");
  return productIds.map((productId, index) => ({
    productId,
    quantity: parseMilli(quantities[index] ?? ""),
    unitPrice: parseKurus(prices[index] ?? ""),
    vatRate: parseVatRate(vatRates[index] ?? String(DEFAULT_VAT_RATE)),
    discountBps: discounts[index] ? Number(discounts[index]) : 0,
    lotCode: lots[index] || null,
    serialCode: serials[index] || null,
  }));
}

export function parseAllocations(formData: FormData) {
  const ids = formData.getAll("allocDocId").map(String);
  const amounts = formData.getAll("allocAmount").map(String);
  const allocations: { documentId: string; amount: number }[] = [];
  ids.forEach((documentId, index) => {
    const raw = (amounts[index] ?? "").trim();
    if (!raw) return;
    const amount = parseKurus(raw);
    if (amount === 0) return;
    allocations.push({ documentId, amount });
  });
  return allocations;
}

export function parseParty(formData: FormData): PartyInput {
  const type = text(formData, "type");
  if (type !== "CUSTOMER" && type !== "SUPPLIER") {
    throw new ErpError("Cari türü seçin.");
  }
  return {
    type,
    code: text(formData, "code") || undefined,
    name: text(formData, "name"),
    taxNumber: text(formData, "taxNumber"),
    taxOffice: text(formData, "taxOffice"),
    phone: text(formData, "phone"),
    email: text(formData, "email"),
    city: text(formData, "city"),
    address: text(formData, "address"),
    notes: text(formData, "notes"),
    active: text(formData, "active") === "on",
  };
}

export function parseProduct(formData: FormData, withOpening: boolean): ProductInput {
  const opening = text(formData, "openingStock");
  return {
    sku: text(formData, "sku"),
    barcode: text(formData, "barcode") || null,
    name: text(formData, "name"),
    unit: text(formData, "unit"),
    salePrice: parseKurus(text(formData, "salePrice")),
    purchasePrice: parseKurus(text(formData, "purchasePrice")),
    vatRate: parseVatRate(text(formData, "vatRate")),
    minStock: parseMilli(text(formData, "minStock") || "0"),
    trackSerial: text(formData, "trackSerial") === "on",
    trackLot: text(formData, "trackLot") === "on",
    openingStock: withOpening ? parseMilli(opening || "0") : undefined,
    openingWarehouseId: text(formData, "warehouseId") || undefined,
    active: text(formData, "active") === "on",
  };
}

export function parseDocumentHeader(formData: FormData) {
  return {
    partyId: text(formData, "partyId"),
    warehouseId: text(formData, "warehouseId") || undefined,
    date: parseDateInput(text(formData, "date")),
    notes: text(formData, "notes"),
    lines: parseLines(formData),
    currencyCode: text(formData, "currencyCode") || "TRY",
    exchangeRate: text(formData, "exchangeRate")
      ? Number(text(formData, "exchangeRate"))
      : 100,
    discountBps: text(formData, "discountBps") ? Number(text(formData, "discountBps")) : 0,
    priceListId: text(formData, "priceListId") || null,
    discountTemplateId: text(formData, "discountTemplateId") || null,
  };
}

export function parseDueDates(formData: FormData) {
  return {
    date: parseDateInput(text(formData, "date")),
    dueDate: parseDateInput(text(formData, "dueDate")),
    notes: text(formData, "notes"),
  };
}

export function parseMethod(raw: string): "CASH" | "BANK" | "CHECK" {
  if (raw === "BANK" || raw === "CHECK" || raw === "CASH") return raw;
  throw new ErpError("Ödeme yöntemi seçin.");
}

export function parseMovement(formData: FormData) {
  const kind = text(formData, "kind");
  if (kind !== "IN" && kind !== "OUT" && kind !== "ADJUSTMENT") {
    throw new ErpError("Hareket türü seçin.");
  }
  return {
    productId: text(formData, "productId"),
    warehouseId: text(formData, "warehouseId") || undefined,
    kind: kind as "IN" | "OUT" | "ADJUSTMENT",
    quantity: parseMilli(text(formData, "quantity")),
    date: parseDateInput(text(formData, "date")),
    note: text(formData, "note"),
    lotCode: text(formData, "lotCode") || null,
    serialCode: text(formData, "serialCode") || null,
  };
}

export function parsePayment(formData: FormData) {
  return {
    partyId: text(formData, "partyId"),
    date: parseDateInput(text(formData, "date")),
    method: parseMethod(text(formData, "method")),
    amount: parseKurus(text(formData, "amount")),
    notes: text(formData, "notes"),
    allocations: parseAllocations(formData),
    moneyAccountId: text(formData, "moneyAccountId") || null,
    currencyCode: text(formData, "currencyCode") || "TRY",
    exchangeRate: text(formData, "exchangeRate")
      ? Number(text(formData, "exchangeRate"))
      : 100,
  };
}
