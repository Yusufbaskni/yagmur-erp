import { Prisma } from "@prisma/client";

export function kurus(value: Prisma.Decimal.Value): number {
  const rounded = new Prisma.Decimal(value).toDecimalPlaces(
    2,
    Prisma.Decimal.ROUND_HALF_UP,
  );
  return rounded.mul(100).toNumber();
}

export function milli(value: Prisma.Decimal.Value): number {
  const rounded = new Prisma.Decimal(value).toDecimalPlaces(
    3,
    Prisma.Decimal.ROUND_HALF_UP,
  );
  return rounded.mul(1000).toNumber();
}

export function lineTotalKurus(quantityMilli: number, unitPriceKurus: number) {
  if (!Number.isInteger(quantityMilli) || !Number.isInteger(unitPriceKurus)) {
    throw new Error("Miktar ve fiyat tam sayı olmalı.");
  }
  const raw = BigInt(quantityMilli) * BigInt(unitPriceKurus);
  const zero = BigInt(0);
  const abs = raw < zero ? -raw : raw;
  const sign = raw < zero ? BigInt(-1) : BigInt(1);
  return Number(((abs + BigInt(500)) / BigInt(1000)) * sign);
}

/** percentBps: 1000 = %10, 2000 = %20 */
export function applyDiscountBps(amount: number, discountBps: number) {
  if (!Number.isInteger(amount) || !Number.isInteger(discountBps)) {
    throw new Error("İndirim hesaplaması tam sayı olmalı.");
  }
  if (discountBps < 0 || discountBps > 10000) {
    throw new Error("İndirim oranı geçersiz.");
  }
  if (discountBps === 0) return amount;
  return Number((BigInt(amount) * BigInt(10000 - discountBps) + BigInt(5000)) / BigInt(10000));
}

/** vatRate: 1 | 10 | 20 */
export function vatOnNet(netKurus: number, vatRate: number) {
  if (![0, 1, 10, 20].includes(vatRate)) {
    throw new Error(`Desteklenmeyen KDV oranı: ${vatRate}`);
  }
  if (!Number.isInteger(netKurus)) throw new Error("Net tutar tam sayı olmalı.");
  return Number((BigInt(netKurus) * BigInt(vatRate) + BigInt(50)) / BigInt(100));
}

export function pricedLine(args: {
  quantity: number;
  unitPrice: number;
  vatRate: number;
  discountBps?: number;
}) {
  const discountBps = args.discountBps ?? 0;
  const grossNet = lineTotalKurus(args.quantity, args.unitPrice);
  const lineNet = applyDiscountBps(grossNet, discountBps);
  const vatAmount = vatOnNet(lineNet, args.vatRate);
  return {
    quantity: args.quantity,
    unitPrice: args.unitPrice,
    discountBps,
    vatRate: args.vatRate,
    lineNet,
    vatAmount,
    lineTotal: lineNet + vatAmount,
  };
}

/** exchangeRate: 1 birim döviz = rate kuruş TRY; TRY için 100 (1 TRY = 100 kuruş / 1) → aslında 1 TRY belgesi için rate=100 anlamına 1:1 kuruş.
 *  Convention: exchangeRate is "kuruş TRY per 1.00 foreign currency unit".
 *  For TRY documents exchangeRate = 100 (1.00 TRY = 100 kuruş).
 *  amountTry = round(amount * exchangeRate / 100)
 */
export function toTry(amount: number, exchangeRate: number) {
  if (!Number.isInteger(amount) || !Number.isInteger(exchangeRate) || exchangeRate <= 0) {
    throw new Error("Kur çevrimi geçersiz.");
  }
  return Number((BigInt(amount) * BigInt(exchangeRate) + BigInt(50)) / BigInt(100));
}

export function assertPositiveQty(quantityMilli: number) {
  if (!Number.isInteger(quantityMilli) || quantityMilli <= 0) {
    throw new Error("Miktar sıfırdan büyük olmalı.");
  }
}

export const DEFAULT_VAT_RATE = 20;
