import type {
  PartyType,
  PaymentMethod,
  Prisma,
  UserRole,
} from "@prisma/client";
import { formatMoney, formatQty } from "@/lib/format";
import {
  invoiceStatusLabel,
  purchaseOrderStatusLabel,
  salesOrderStatusLabel,
} from "@/lib/labels";
import { writeAudit } from "@/server/audit";
import type { Db } from "@/server/db";
import { ErpError } from "@/server/errors";
import {
  DEFAULT_VAT_RATE,
  pricedLine,
  toTry,
} from "@/server/money";
import { assertPermission } from "@/server/permissions";
import {
  applyStock,
  consumeReservationAndShip,
  releaseReservation,
  reserveStock,
} from "@/server/stock";

export type Actor = {
  userId?: string | null;
  companyId: string;
  role: UserRole;
};

export type LineInput = {
  productId: string;
  quantity: number;
  unitPrice: number;
  vatRate?: number;
  discountBps?: number;
  lotCode?: string | null;
  serialCode?: string | null;
};

export type PartyInput = {
  type: PartyType;
  code?: string;
  name: string;
  taxNumber?: string | null;
  taxOffice?: string | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  address?: string | null;
  notes?: string | null;
  active?: boolean;
};

export type ProductInput = {
  sku: string;
  barcode?: string | null;
  name: string;
  unit: string;
  salePrice: number;
  purchasePrice: number;
  vatRate?: number;
  minStock: number;
  trackSerial?: boolean;
  trackLot?: boolean;
  openingStock?: number;
  openingWarehouseId?: string;
  openingDate?: Date;
  active?: boolean;
};

function clean(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function assertMoney(value: number, label: string) {
  if (!Number.isInteger(value) || value < 0) {
    throw new ErpError(`${label} negatif olamaz.`);
  }
}

function assertQty(value: number) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new ErpError("Miktar sıfırdan büyük olmalı.");
  }
}

function assertAmount(value: number) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new ErpError("Tutar sıfırdan büyük olmalı.");
  }
}

async function nextNumber(tx: Db, companyId: string, prefix: string, date: Date) {
  const key = `${companyId}:${prefix}-${date.getUTCFullYear()}`;
  const row = await tx.documentSequence.upsert({
    where: { id: key },
    create: { id: key, companyId, next: 1 },
    update: { next: { increment: 1 } },
  });
  return `${prefix}-${date.getUTCFullYear()}-${String(row.next).padStart(4, "0")}`;
}

async function nextPartyCode(tx: Db, companyId: string, type: PartyType) {
  const prefix = type === "CUSTOMER" ? "C" : "T";
  const count = await tx.party.count({ where: { companyId, type } });
  for (let n = count + 1; n < count + 1000; n += 1) {
    const code = `${prefix}-${String(n).padStart(4, "0")}`;
    const exists = await tx.party.findUnique({
      where: { companyId_code: { companyId, code } },
    });
    if (!exists) return code;
  }
  throw new ErpError("Cari kodu üretilemedi.");
}

function normalizeLines(lines: LineInput[], fallbackVat = DEFAULT_VAT_RATE) {
  if (lines.length === 0) throw new ErpError("En az bir satır ekleyin.");
  if (lines.length > 40) throw new ErpError("Bir belgede en fazla 40 satır olabilir.");
  return lines.map((line) => {
    assertQty(line.quantity);
    assertMoney(line.unitPrice, "Birim fiyat");
    if (!line.productId) throw new ErpError("Satırda ürün seçilmedi.");
    const vatRate = line.vatRate ?? fallbackVat;
    const priced = pricedLine({
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      vatRate,
      discountBps: line.discountBps ?? 0,
    });
    return {
      productId: line.productId,
      ...priced,
      lotCode: clean(line.lotCode),
      serialCode: clean(line.serialCode),
    };
  });
}

function sumLines(lines: { lineNet: number; vatAmount: number; lineTotal: number }[]) {
  return {
    subtotal: lines.reduce((s, l) => s + l.lineNet, 0),
    vatTotal: lines.reduce((s, l) => s + l.vatAmount, 0),
    total: lines.reduce((s, l) => s + l.lineTotal, 0),
  };
}

async function assertProducts(tx: Db, companyId: string, lines: { productId: string }[]) {
  const ids = [...new Set(lines.map((line) => line.productId))];
  const products = await tx.product.findMany({
    where: { id: { in: ids }, companyId },
  });
  if (products.length !== ids.length) throw new ErpError("Satırdaki ürün bulunamadı.");
  const inactive = products.find((product) => !product.active);
  if (inactive) {
    throw new ErpError(`${inactive.sku} pasif. Yeni belgeye eklenemez.`);
  }
  return new Map(products.map((p) => [p.id, p]));
}

async function defaultWarehouse(tx: Db, companyId: string, warehouseId?: string | null) {
  if (warehouseId) {
    const wh = await tx.warehouse.findFirst({
      where: { id: warehouseId, companyId, active: true },
    });
    if (!wh) throw new ErpError("Depo bulunamadı.");
    return wh;
  }
  const wh = await tx.warehouse.findFirst({
    where: { companyId, active: true },
    orderBy: [{ isDefault: "desc" }, { code: "asc" }],
  });
  if (!wh) throw new ErpError("Şirkette aktif depo yok.");
  return wh;
}

async function requireParty(tx: Db, companyId: string, id: string, type: PartyType) {
  const party = await tx.party.findFirst({ where: { id, companyId } });
  if (!party) throw new ErpError("Cari bulunamadı.");
  if (!party.active) throw new ErpError("Pasif cariye yeni belge açılamaz.");
  if (party.type !== type) {
    throw new ErpError(
      type === "CUSTOMER"
        ? "Satış belgeleri yalnızca müşteri carisine kesilir."
        : "Satın alma belgeleri yalnızca tedarikçi carisine kesilir.",
    );
  }
  return party;
}

async function postJournal(
  tx: Db,
  args: {
    companyId: string;
    date: Date;
    memo: string;
    source: string;
    sourceId: string;
    lines: { accountCode: string; debit: number; credit: number; memo?: string }[];
  },
) {
  const debit = args.lines.reduce((s, l) => s + l.debit, 0);
  const credit = args.lines.reduce((s, l) => s + l.credit, 0);
  if (debit !== credit) throw new ErpError("Yevmiye kaydı dengeli değil.");
  if (debit === 0) return null;
  const codes = [...new Set(args.lines.map((l) => l.accountCode))];
  const accounts = await tx.account.findMany({
    where: { companyId: args.companyId, code: { in: codes } },
  });
  const byCode = new Map(accounts.map((a) => [a.code, a]));
  for (const code of codes) {
    if (!byCode.has(code)) throw new ErpError(`Hesap planında ${code} yok.`);
  }
  const number = await nextNumber(tx, args.companyId, "YM", args.date);
  return tx.journalEntry.create({
    data: {
      companyId: args.companyId,
      number,
      date: args.date,
      memo: args.memo,
      source: args.source,
      sourceId: args.sourceId,
      lines: {
        create: args.lines.map((line) => ({
          accountId: byCode.get(line.accountCode)!.id,
          debit: line.debit,
          credit: line.credit,
          memo: line.memo ?? null,
        })),
      },
    },
  });
}

async function moveMoney(
  tx: Db,
  args: {
    moneyAccountId: string;
    signedAmount: number;
    date: Date;
    paymentId?: string;
    checkNoteId?: string;
    note?: string;
  },
) {
  const account = await tx.moneyAccount.findUnique({ where: { id: args.moneyAccountId } });
  if (!account) throw new ErpError("Kasa/banka hesabı bulunamadı.");
  const next = account.balance + args.signedAmount;
  if (next < 0) throw new ErpError(`${account.name} bakiyesi yetersiz.`);
  await tx.moneyAccount.update({ where: { id: account.id }, data: { balance: next } });
  await tx.moneyMovement.create({
    data: {
      moneyAccountId: account.id,
      paymentId: args.paymentId,
      checkNoteId: args.checkNoteId,
      type: args.signedAmount >= 0 ? "IN" : "OUT",
      amount: Math.abs(args.signedAmount),
      signedAmount: args.signedAmount,
      date: args.date,
      note: args.note,
    },
  });
}

export async function createParty(tx: Db, actor: Actor, input: PartyInput) {
  assertPermission(actor.role, "party");
  const name = input.name.trim();
  if (name.length < 2) throw new ErpError("Ünvan en az 2 karakter olmalı.");
  const code = input.code?.trim() || (await nextPartyCode(tx, actor.companyId, input.type));
  const party = await tx.party.create({
    data: {
      companyId: actor.companyId,
      type: input.type,
      code,
      name,
      taxNumber: clean(input.taxNumber),
      taxOffice: clean(input.taxOffice),
      phone: clean(input.phone),
      email: clean(input.email),
      city: clean(input.city),
      address: clean(input.address),
      notes: clean(input.notes),
      active: input.active ?? true,
    },
  });
  await writeAudit(tx, {
    companyId: actor.companyId,
    userId: actor.userId,
    action: "CREATE",
    entityType: "Party",
    entityId: party.id,
    summary: `Cari oluşturuldu: ${party.code} ${party.name}`,
  });
  return party;
}

export async function updateParty(tx: Db, actor: Actor, id: string, input: PartyInput) {
  assertPermission(actor.role, "party");
  const current = await tx.party.findFirst({ where: { id, companyId: actor.companyId } });
  if (!current) throw new ErpError("Cari bulunamadı.");
  const name = input.name.trim();
  if (name.length < 2) throw new ErpError("Ünvan en az 2 karakter olmalı.");
  const code = input.code?.trim();
  if (!code) throw new ErpError("Cari kodu zorunlu.");
  const party = await tx.party.update({
    where: { id },
    data: {
      type: input.type,
      code,
      name,
      taxNumber: clean(input.taxNumber),
      taxOffice: clean(input.taxOffice),
      phone: clean(input.phone),
      email: clean(input.email),
      city: clean(input.city),
      address: clean(input.address),
      notes: clean(input.notes),
      active: input.active ?? current.active,
    },
  });
  await writeAudit(tx, {
    companyId: actor.companyId,
    userId: actor.userId,
    action: "UPDATE",
    entityType: "Party",
    entityId: party.id,
    summary: `Cari güncellendi: ${party.code}`,
  });
  return party;
}

export async function deleteParty(tx: Db, actor: Actor, id: string) {
  assertPermission(actor.role, "party");
  const party = await tx.party.findFirst({ where: { id, companyId: actor.companyId } });
  if (!party) throw new ErpError("Cari bulunamadı.");
  const [orders, invoices, purchases, receipts, payments, pinvoices] = await Promise.all([
    tx.salesOrder.count({ where: { partyId: id } }),
    tx.salesInvoice.count({ where: { partyId: id } }),
    tx.purchaseOrder.count({ where: { partyId: id } }),
    tx.goodsReceipt.count({ where: { partyId: id } }),
    tx.payment.count({ where: { partyId: id } }),
    tx.purchaseInvoice.count({ where: { partyId: id } }),
  ]);
  if (orders + invoices + purchases + receipts + payments + pinvoices > 0) {
    throw new ErpError("Hareketi olan cari silinemez. Kaydı pasife alın.");
  }
  await tx.party.delete({ where: { id } });
}

export async function createProduct(tx: Db, actor: Actor, input: ProductInput) {
  assertPermission(actor.role, "product");
  const sku = input.sku.trim().toUpperCase();
  const name = input.name.trim();
  const unit = input.unit.trim();
  if (!sku) throw new ErpError("SKU zorunlu.");
  if (name.length < 2) throw new ErpError("Ürün adı en az 2 karakter olmalı.");
  if (!unit) throw new ErpError("Birim zorunlu.");
  assertMoney(input.salePrice, "Satış fiyatı");
  assertMoney(input.purchasePrice, "Alış fiyatı");
  if (!Number.isInteger(input.minStock) || input.minStock < 0) {
    throw new ErpError("Asgari stok negatif olamaz.");
  }
  const vatRate = input.vatRate ?? DEFAULT_VAT_RATE;
  if (![0, 1, 10, 20].includes(vatRate)) throw new ErpError("KDV oranı 0, 1, 10 veya 20 olmalı.");
  const opening = input.openingStock ?? 0;
  if (!Number.isInteger(opening) || opening < 0) {
    throw new ErpError("Açılış stoku negatif olamaz.");
  }
  const product = await tx.product.create({
    data: {
      companyId: actor.companyId,
      sku,
      barcode: clean(input.barcode),
      name,
      unit,
      salePrice: input.salePrice,
      purchasePrice: input.purchasePrice,
      vatRate,
      minStock: input.minStock,
      trackSerial: input.trackSerial ?? false,
      trackLot: input.trackLot ?? false,
      stockOnHand: 0,
      stockReserved: 0,
      active: input.active ?? true,
    },
  });
  if (opening > 0) {
    const wh = await defaultWarehouse(tx, actor.companyId, input.openingWarehouseId);
    await applyStock(tx, {
      productId: product.id,
      warehouseId: wh.id,
      signedQty: opening,
      type: "IN",
      date: input.openingDate ?? new Date(),
      source: "MANUAL",
      note: "Açılış stoku",
    });
  }
  return tx.product.findUniqueOrThrow({ where: { id: product.id } });
}

export async function updateProduct(
  tx: Db,
  actor: Actor,
  id: string,
  input: Omit<ProductInput, "openingStock" | "openingDate" | "openingWarehouseId">,
) {
  assertPermission(actor.role, "product");
  const current = await tx.product.findFirst({ where: { id, companyId: actor.companyId } });
  if (!current) throw new ErpError("Ürün bulunamadı.");
  const sku = input.sku.trim().toUpperCase();
  const name = input.name.trim();
  const unit = input.unit.trim();
  if (!sku) throw new ErpError("SKU zorunlu.");
  if (name.length < 2) throw new ErpError("Ürün adı en az 2 karakter olmalı.");
  if (!unit) throw new ErpError("Birim zorunlu.");
  assertMoney(input.salePrice, "Satış fiyatı");
  assertMoney(input.purchasePrice, "Alış fiyatı");
  if (!Number.isInteger(input.minStock) || input.minStock < 0) {
    throw new ErpError("Asgari stok negatif olamaz.");
  }
  const vatRate = input.vatRate ?? current.vatRate;
  if (![0, 1, 10, 20].includes(vatRate)) throw new ErpError("KDV oranı 0, 1, 10 veya 20 olmalı.");
  return tx.product.update({
    where: { id },
    data: {
      sku,
      barcode: clean(input.barcode),
      name,
      unit,
      salePrice: input.salePrice,
      purchasePrice: input.purchasePrice,
      vatRate,
      minStock: input.minStock,
      trackSerial: input.trackSerial ?? current.trackSerial,
      trackLot: input.trackLot ?? current.trackLot,
      active: input.active ?? current.active,
    },
  });
}

export async function deleteProduct(tx: Db, actor: Actor, id: string) {
  assertPermission(actor.role, "product");
  const product = await tx.product.findFirst({ where: { id, companyId: actor.companyId } });
  if (!product) throw new ErpError("Ürün bulunamadı.");
  const [moves, so, si, po, gr] = await Promise.all([
    tx.stockMovement.count({ where: { productId: id } }),
    tx.salesOrderLine.count({ where: { productId: id } }),
    tx.salesInvoiceLine.count({ where: { productId: id } }),
    tx.purchaseOrderLine.count({ where: { productId: id } }),
    tx.goodsReceiptLine.count({ where: { productId: id } }),
  ]);
  if (moves + so + si + po + gr > 0) {
    throw new ErpError("Hareketi olan ürün silinemez. Kaydı pasife alın.");
  }
  await tx.warehouseStock.deleteMany({ where: { productId: id } });
  await tx.product.delete({ where: { id } });
}

export async function postManualMovement(
  tx: Db,
  actor: Actor,
  input: {
    productId: string;
    warehouseId?: string;
    kind: "IN" | "OUT" | "ADJUSTMENT";
    quantity: number;
    date: Date;
    note?: string | null;
    lotCode?: string | null;
    serialCode?: string | null;
  },
) {
  assertPermission(actor.role, "stock");
  const product = await tx.product.findFirst({
    where: { id: input.productId, companyId: actor.companyId },
  });
  if (!product) throw new ErpError("Ürün bulunamadı.");
  const wh = await defaultWarehouse(tx, actor.companyId, input.warehouseId);
  const note = clean(input.note) ?? undefined;
  const lotCode = clean(input.lotCode);
  const serialCode = clean(input.serialCode);
  if (product.trackLot && !lotCode && input.kind !== "ADJUSTMENT") {
    throw new ErpError(`${product.sku} için lot kodu zorunlu.`);
  }
  if (product.trackSerial && !serialCode && input.kind !== "ADJUSTMENT") {
    throw new ErpError(`${product.sku} için seri no zorunlu.`);
  }
  if (input.kind === "ADJUSTMENT") {
    if (!Number.isInteger(input.quantity) || input.quantity < 0) {
      throw new ErpError("Sayılan miktar negatif olamaz.");
    }
    const stock = await tx.warehouseStock.findUnique({
      where: { warehouseId_productId: { warehouseId: wh.id, productId: product.id } },
    });
    const onHand = stock?.onHand ?? 0;
    const delta = input.quantity - onHand;
    if (delta === 0) throw new ErpError("Sayım farkı yok.");
    await applyStock(tx, {
      productId: product.id,
      warehouseId: wh.id,
      signedQty: delta,
      type: "ADJUSTMENT",
      date: input.date,
      source: "MANUAL",
      note: note ?? "Sayım düzeltmesi",
      lotCode,
      serialCode,
    });
    return;
  }
  assertQty(input.quantity);
  await applyStock(tx, {
    productId: product.id,
    warehouseId: wh.id,
    signedQty: input.kind === "IN" ? input.quantity : -input.quantity,
    type: input.kind,
    date: input.date,
    source: "MANUAL",
    note,
    lotCode,
    serialCode,
  });
}

export async function createSalesOrder(
  tx: Db,
  actor: Actor,
  input: {
    partyId: string;
    warehouseId?: string;
    date: Date;
    notes?: string | null;
    lines: LineInput[];
    currencyCode?: string;
    exchangeRate?: number;
    discountBps?: number;
    priceListId?: string | null;
    discountTemplateId?: string | null;
  },
) {
  assertPermission(actor.role, "sales");
  await requireParty(tx, actor.companyId, input.partyId, "CUSTOMER");
  const wh = await defaultWarehouse(tx, actor.companyId, input.warehouseId);
  const products = await assertProducts(tx, actor.companyId, input.lines);
  const lines = normalizeLines(
    input.lines.map((line) => ({
      ...line,
      vatRate: line.vatRate ?? products.get(line.productId)?.vatRate ?? DEFAULT_VAT_RATE,
    })),
  );
  let discountBps = input.discountBps ?? 0;
  if (input.discountTemplateId) {
    const tpl = await tx.discountTemplate.findFirst({
      where: { id: input.discountTemplateId, companyId: actor.companyId, active: true },
    });
    if (!tpl) throw new ErpError("İndirim şablonu bulunamadı.");
    discountBps = tpl.percentBps;
  }
  if (input.priceListId) {
    const items = await tx.priceListItem.findMany({
      where: { priceListId: input.priceListId },
    });
    const priceMap = new Map(items.map((i) => [i.productId, i.unitPrice]));
    for (const line of lines) {
      const listed = priceMap.get(line.productId);
      if (listed != null) {
        const priced = pricedLine({
          quantity: line.quantity,
          unitPrice: listed,
          vatRate: line.vatRate,
          discountBps: Math.max(line.discountBps, discountBps),
        });
        Object.assign(line, priced, { unitPrice: listed });
      }
    }
  } else if (discountBps > 0) {
    for (const line of lines) {
      const priced = pricedLine({
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        vatRate: line.vatRate,
        discountBps: Math.max(line.discountBps, discountBps),
      });
      Object.assign(line, priced);
    }
  }
  const number = await nextNumber(tx, actor.companyId, "SS", input.date);
  const order = await tx.salesOrder.create({
    data: {
      companyId: actor.companyId,
      number,
      partyId: input.partyId,
      warehouseId: wh.id,
      priceListId: input.priceListId ?? null,
      discountTemplateId: input.discountTemplateId ?? null,
      date: input.date,
      currencyCode: input.currencyCode ?? "TRY",
      exchangeRate: input.exchangeRate ?? 100,
      discountBps,
      notes: clean(input.notes),
      status: "DRAFT",
      lines: { create: lines },
    },
  });
  await writeAudit(tx, {
    companyId: actor.companyId,
    userId: actor.userId,
    action: "CREATE",
    entityType: "SalesOrder",
    entityId: order.id,
    summary: `Satış siparişi ${order.number}`,
  });
  return order;
}

export async function updateSalesOrder(
  tx: Db,
  actor: Actor,
  id: string,
  input: {
    partyId: string;
    warehouseId?: string;
    date: Date;
    notes?: string | null;
    lines: LineInput[];
    currencyCode?: string;
    exchangeRate?: number;
    discountBps?: number;
  },
) {
  assertPermission(actor.role, "sales");
  const order = await tx.salesOrder.findFirst({
    where: { id, companyId: actor.companyId },
  });
  if (!order) throw new ErpError("Satış siparişi bulunamadı.");
  if (order.status !== "DRAFT") {
    throw new ErpError("Yalnızca taslak sipariş düzenlenebilir.");
  }
  await requireParty(tx, actor.companyId, input.partyId, "CUSTOMER");
  const wh = await defaultWarehouse(tx, actor.companyId, input.warehouseId ?? order.warehouseId);
  const products = await assertProducts(tx, actor.companyId, input.lines);
  const lines = normalizeLines(
    input.lines.map((line) => ({
      ...line,
      vatRate: line.vatRate ?? products.get(line.productId)?.vatRate ?? DEFAULT_VAT_RATE,
      discountBps: line.discountBps ?? input.discountBps ?? order.discountBps,
    })),
  );
  await tx.salesOrderLine.deleteMany({ where: { salesOrderId: id } });
  return tx.salesOrder.update({
    where: { id },
    data: {
      partyId: input.partyId,
      warehouseId: wh.id,
      date: input.date,
      notes: clean(input.notes),
      currencyCode: input.currencyCode ?? order.currencyCode,
      exchangeRate: input.exchangeRate ?? order.exchangeRate,
      discountBps: input.discountBps ?? order.discountBps,
      lines: { create: lines },
    },
  });
}

export async function confirmSalesOrder(tx: Db, actor: Actor, id: string) {
  assertPermission(actor.role, "sales");
  const order = await tx.salesOrder.findFirst({
    where: { id, companyId: actor.companyId },
    include: { lines: true },
  });
  if (!order) throw new ErpError("Satış siparişi bulunamadı.");
  if (order.status !== "DRAFT") {
    throw new ErpError(
      `Sipariş onaylanamaz. Durum: ${salesOrderStatusLabel[order.status]}.`,
    );
  }
  if (order.lines.length === 0) throw new ErpError("Siparişte satır yok.");
  const need = new Map<string, number>();
  for (const line of order.lines) {
    need.set(line.productId, (need.get(line.productId) ?? 0) + line.quantity);
  }
  for (const [productId, quantity] of need) {
    await reserveStock(tx, {
      productId,
      warehouseId: order.warehouseId,
      quantity,
      date: order.date,
      sourceId: order.id,
      sourceLabel: order.number,
    });
  }
  const updated = await tx.salesOrder.update({
    where: { id },
    data: { status: "CONFIRMED" },
  });
  await writeAudit(tx, {
    companyId: actor.companyId,
    userId: actor.userId,
    action: "CONFIRM",
    entityType: "SalesOrder",
    entityId: order.id,
    summary: `Sipariş onaylandı ve stok rezerve edildi: ${order.number}`,
  });
  return updated;
}

export async function cancelSalesOrder(tx: Db, actor: Actor, id: string) {
  assertPermission(actor.role, "sales");
  const order = await tx.salesOrder.findFirst({
    where: { id, companyId: actor.companyId },
    include: { lines: true },
  });
  if (!order) throw new ErpError("Satış siparişi bulunamadı.");
  if (order.status !== "DRAFT" && order.status !== "CONFIRMED") {
    throw new ErpError(
      `Sipariş iptal edilemez. Durum: ${salesOrderStatusLabel[order.status]}.`,
    );
  }
  if (order.status === "CONFIRMED") {
    const need = new Map<string, number>();
    for (const line of order.lines) {
      need.set(line.productId, (need.get(line.productId) ?? 0) + line.quantity);
    }
    for (const [productId, quantity] of need) {
      await releaseReservation(tx, {
        productId,
        warehouseId: order.warehouseId,
        quantity,
        date: order.date,
        sourceId: order.id,
        sourceLabel: order.number,
      });
    }
  }
  const updated = await tx.salesOrder.update({
    where: { id },
    data: { status: "CANCELLED" },
  });
  await writeAudit(tx, {
    companyId: actor.companyId,
    userId: actor.userId,
    action: "CANCEL",
    entityType: "SalesOrder",
    entityId: order.id,
    summary: `Sipariş iptal: ${order.number}`,
  });
  return updated;
}

export async function invoiceSalesOrder(
  tx: Db,
  actor: Actor,
  orderId: string,
  input: { date: Date; dueDate: Date; notes?: string | null },
) {
  assertPermission(actor.role, "sales");
  const order = await tx.salesOrder.findFirst({
    where: { id: orderId, companyId: actor.companyId },
    include: { lines: true, invoice: true },
  });
  if (!order) throw new ErpError("Satış siparişi bulunamadı.");
  if (order.status !== "CONFIRMED" || order.invoice) {
    throw new ErpError(
      `Sipariş faturalanamaz. Durum: ${salesOrderStatusLabel[order.status]}.`,
    );
  }
  if (input.dueDate < input.date) {
    throw new ErpError("Vade, fatura tarihinden önce olamaz.");
  }
  const totals = sumLines(order.lines);
  const totalTry = toTry(totals.total, order.exchangeRate);
  const number = await nextNumber(tx, actor.companyId, "SF", input.date);
  const invoice = await tx.salesInvoice.create({
    data: {
      companyId: actor.companyId,
      number,
      partyId: order.partyId,
      warehouseId: order.warehouseId,
      salesOrderId: order.id,
      orderNumber: order.number,
      status: totals.total === 0 ? "PAID" : "OPEN",
      date: input.date,
      dueDate: input.dueDate,
      currencyCode: order.currencyCode,
      exchangeRate: order.exchangeRate,
      subtotal: totals.subtotal,
      vatTotal: totals.vatTotal,
      total: totals.total,
      totalTry,
      paidAmount: 0,
      notes: clean(input.notes) ?? order.notes,
      lines: {
        create: order.lines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          discountBps: line.discountBps,
          vatRate: line.vatRate,
          lineNet: line.lineNet,
          vatAmount: line.vatAmount,
          lineTotal: line.lineTotal,
          lotCode: line.lotCode,
          serialCode: line.serialCode,
        })),
      },
    },
  });
  const need = new Map<string, { quantity: number; lotCode: string | null; serialCode: string | null }>();
  for (const line of order.lines) {
    const prev = need.get(line.productId);
    if (prev) {
      prev.quantity += line.quantity;
    } else {
      need.set(line.productId, {
        quantity: line.quantity,
        lotCode: line.lotCode,
        serialCode: line.serialCode,
      });
    }
  }
  for (const [productId, row] of need) {
    await consumeReservationAndShip(tx, {
      productId,
      warehouseId: order.warehouseId,
      quantity: row.quantity,
      date: input.date,
      sourceId: invoice.id,
      sourceLabel: number,
      lotCode: row.lotCode,
      serialCode: row.serialCode,
    });
  }
  await tx.salesOrder.update({
    where: { id: order.id },
    data: { status: "INVOICED" },
  });
  await postJournal(tx, {
    companyId: actor.companyId,
    date: input.date,
    memo: `Satış faturası ${number}`,
    source: "SALES_INVOICE",
    sourceId: invoice.id,
    lines: [
      { accountCode: "120", debit: totalTry, credit: 0, memo: "Alıcılar" },
      { accountCode: "600", debit: 0, credit: toTry(totals.subtotal, order.exchangeRate), memo: "Yurtiçi satışlar" },
      { accountCode: "391", debit: 0, credit: toTry(totals.vatTotal, order.exchangeRate), memo: "Hesaplanan KDV" },
    ].filter((l) => l.debit + l.credit > 0),
  });
  await writeAudit(tx, {
    companyId: actor.companyId,
    userId: actor.userId,
    action: "INVOICE",
    entityType: "SalesInvoice",
    entityId: invoice.id,
    summary: `Satış faturası ${number} (KDV dahil ${formatMoney(totals.total)})`,
  });
  return invoice;
}

export async function cancelSalesInvoice(tx: Db, actor: Actor, id: string) {
  assertPermission(actor.role, "sales");
  const invoice = await tx.salesInvoice.findFirst({
    where: { id, companyId: actor.companyId },
    include: { lines: true, allocations: true },
  });
  if (!invoice) throw new ErpError("Satış faturası bulunamadı.");
  if (invoice.isReturn) throw new ErpError("İade faturası bu yolla iptal edilmez.");
  if (invoice.status !== "OPEN" || invoice.paidAmount !== 0 || invoice.allocations.length > 0) {
    throw new ErpError(
      `Fatura iptal edilemez. Durum: ${invoiceStatusLabel[invoice.status]}.`,
    );
  }
  const need = new Map<string, number>();
  for (const line of invoice.lines) {
    need.set(line.productId, (need.get(line.productId) ?? 0) + line.quantity);
  }
  for (const [productId, quantity] of need) {
    await applyStock(tx, {
      productId,
      warehouseId: invoice.warehouseId,
      signedQty: quantity,
      type: "IN",
      date: invoice.date,
      source: "INVOICE_CANCEL",
      sourceId: invoice.id,
      sourceLabel: invoice.number,
      note: `Fatura iptali ${invoice.number}`,
    });
  }
  if (invoice.salesOrderId) {
    const order = await tx.salesOrder.findUnique({
      where: { id: invoice.salesOrderId },
      include: { lines: true },
    });
    if (order) {
      for (const line of order.lines) {
        await reserveStock(tx, {
          productId: line.productId,
          warehouseId: order.warehouseId,
          quantity: line.quantity,
          date: invoice.date,
          sourceId: order.id,
          sourceLabel: order.number,
        });
      }
      await tx.salesOrder.update({
        where: { id: order.id },
        data: { status: "CONFIRMED" },
      });
    }
  }
  return tx.salesInvoice.update({
    where: { id },
    data: { status: "CANCELLED", salesOrderId: null },
  });
}

export async function createSalesReturn(
  tx: Db,
  actor: Actor,
  originalInvoiceId: string,
  input: { date: Date; notes?: string | null },
) {
  assertPermission(actor.role, "sales");
  const original = await tx.salesInvoice.findFirst({
    where: { id: originalInvoiceId, companyId: actor.companyId },
    include: { lines: true },
  });
  if (!original || original.isReturn) throw new ErpError("İade edilecek fatura bulunamadı.");
  if (original.status === "CANCELLED") throw new ErpError("İptal fatura iade edilemez.");
  const number = await nextNumber(tx, actor.companyId, "SI", input.date);
  const totals = sumLines(original.lines);
  const totalTry = toTry(totals.total, original.exchangeRate);
  const invoice = await tx.salesInvoice.create({
    data: {
      companyId: actor.companyId,
      number,
      partyId: original.partyId,
      warehouseId: original.warehouseId,
      orderNumber: original.number,
      isReturn: true,
      originalInvoiceId: original.id,
      status: "PAID",
      date: input.date,
      dueDate: input.date,
      currencyCode: original.currencyCode,
      exchangeRate: original.exchangeRate,
      subtotal: -totals.subtotal,
      vatTotal: -totals.vatTotal,
      total: -totals.total,
      totalTry: -totalTry,
      paidAmount: -totals.total,
      notes: clean(input.notes) ?? `İade: ${original.number}`,
      lines: {
        create: original.lines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          discountBps: line.discountBps,
          vatRate: line.vatRate,
          lineNet: -line.lineNet,
          vatAmount: -line.vatAmount,
          lineTotal: -line.lineTotal,
          lotCode: line.lotCode,
          serialCode: line.serialCode,
        })),
      },
    },
  });
  for (const line of original.lines) {
    await applyStock(tx, {
      productId: line.productId,
      warehouseId: original.warehouseId,
      signedQty: line.quantity,
      type: "IN",
      date: input.date,
      source: "SALES_RETURN",
      sourceId: invoice.id,
      sourceLabel: number,
      note: `Satış iadesi ${number}`,
      lotCode: line.lotCode,
      serialCode: line.serialCode,
    });
  }
  const open = original.total - original.paidAmount;
  if (open > 0) {
    const reduce = Math.min(open, totals.total);
    const paid = original.paidAmount + reduce;
    await tx.salesInvoice.update({
      where: { id: original.id },
      data: {
        paidAmount: paid,
        status: paid >= original.total ? "PAID" : paid > 0 ? "PARTIAL" : original.status,
      },
    });
  }
  await postJournal(tx, {
    companyId: actor.companyId,
    date: input.date,
    memo: `Satış iadesi ${number}`,
    source: "SALES_RETURN",
    sourceId: invoice.id,
    lines: [
      { accountCode: "610", debit: toTry(totals.subtotal, original.exchangeRate), credit: 0 },
      { accountCode: "191", debit: toTry(totals.vatTotal, original.exchangeRate), credit: 0 },
      { accountCode: "120", debit: 0, credit: totalTry },
    ].filter((l) => l.debit + l.credit > 0),
  });
  await writeAudit(tx, {
    companyId: actor.companyId,
    userId: actor.userId,
    action: "RETURN",
    entityType: "SalesInvoice",
    entityId: invoice.id,
    summary: `Satış iadesi ${number} ← ${original.number}`,
  });
  return invoice;
}

export async function createPurchaseOrder(
  tx: Db,
  actor: Actor,
  input: {
    partyId: string;
    warehouseId?: string;
    date: Date;
    notes?: string | null;
    lines: LineInput[];
    currencyCode?: string;
    exchangeRate?: number;
  },
) {
  assertPermission(actor.role, "purchasing");
  await requireParty(tx, actor.companyId, input.partyId, "SUPPLIER");
  const wh = await defaultWarehouse(tx, actor.companyId, input.warehouseId);
  const products = await assertProducts(tx, actor.companyId, input.lines);
  const lines = normalizeLines(
    input.lines.map((line) => ({
      ...line,
      vatRate: line.vatRate ?? products.get(line.productId)?.vatRate ?? DEFAULT_VAT_RATE,
    })),
  );
  const number = await nextNumber(tx, actor.companyId, "SA", input.date);
  return tx.purchaseOrder.create({
    data: {
      companyId: actor.companyId,
      number,
      partyId: input.partyId,
      warehouseId: wh.id,
      date: input.date,
      currencyCode: input.currencyCode ?? "TRY",
      exchangeRate: input.exchangeRate ?? 100,
      notes: clean(input.notes),
      status: "DRAFT",
      lines: {
        create: lines.map(({ discountBps: _d, ...line }) => line),
      },
    },
  });
}

export async function updatePurchaseOrder(
  tx: Db,
  actor: Actor,
  id: string,
  input: {
    partyId: string;
    warehouseId?: string;
    date: Date;
    notes?: string | null;
    lines: LineInput[];
  },
) {
  assertPermission(actor.role, "purchasing");
  const order = await tx.purchaseOrder.findFirst({
    where: { id, companyId: actor.companyId },
  });
  if (!order) throw new ErpError("Satın alma siparişi bulunamadı.");
  if (order.status !== "DRAFT") {
    throw new ErpError("Yalnızca taslak sipariş düzenlenebilir.");
  }
  await requireParty(tx, actor.companyId, input.partyId, "SUPPLIER");
  const wh = await defaultWarehouse(tx, actor.companyId, input.warehouseId ?? order.warehouseId);
  const products = await assertProducts(tx, actor.companyId, input.lines);
  const lines = normalizeLines(
    input.lines.map((line) => ({
      ...line,
      vatRate: line.vatRate ?? products.get(line.productId)?.vatRate ?? DEFAULT_VAT_RATE,
    })),
  );
  await tx.purchaseOrderLine.deleteMany({ where: { purchaseOrderId: id } });
  return tx.purchaseOrder.update({
    where: { id },
    data: {
      partyId: input.partyId,
      warehouseId: wh.id,
      date: input.date,
      notes: clean(input.notes),
      lines: {
        create: lines.map(({ discountBps: _d, ...line }) => line),
      },
    },
  });
}

export async function confirmPurchaseOrder(tx: Db, actor: Actor, id: string) {
  assertPermission(actor.role, "purchasing");
  const order = await tx.purchaseOrder.findFirst({
    where: { id, companyId: actor.companyId },
    include: { lines: true },
  });
  if (!order) throw new ErpError("Satın alma siparişi bulunamadı.");
  if (order.status !== "DRAFT") {
    throw new ErpError(
      `Sipariş onaylanamaz. Durum: ${purchaseOrderStatusLabel[order.status]}.`,
    );
  }
  if (order.lines.length === 0) throw new ErpError("Siparişte satır yok.");
  return tx.purchaseOrder.update({ where: { id }, data: { status: "CONFIRMED" } });
}

export async function cancelPurchaseOrder(tx: Db, actor: Actor, id: string) {
  assertPermission(actor.role, "purchasing");
  const order = await tx.purchaseOrder.findFirst({
    where: { id, companyId: actor.companyId },
  });
  if (!order) throw new ErpError("Satın alma siparişi bulunamadı.");
  if (order.status !== "DRAFT" && order.status !== "CONFIRMED") {
    throw new ErpError(
      `Sipariş iptal edilemez. Durum: ${purchaseOrderStatusLabel[order.status]}.`,
    );
  }
  return tx.purchaseOrder.update({ where: { id }, data: { status: "CANCELLED" } });
}

export async function receivePurchaseOrder(
  tx: Db,
  actor: Actor,
  orderId: string,
  input: { date: Date; notes?: string | null },
) {
  assertPermission(actor.role, "purchasing");
  const order = await tx.purchaseOrder.findFirst({
    where: { id: orderId, companyId: actor.companyId },
    include: { lines: true, receipt: true },
  });
  if (!order) throw new ErpError("Satın alma siparişi bulunamadı.");
  if (order.status !== "CONFIRMED" || order.receipt) {
    throw new ErpError(
      `Mal kabul yapılamaz. Durum: ${purchaseOrderStatusLabel[order.status]}.`,
    );
  }
  const number = await nextNumber(tx, actor.companyId, "MK", input.date);
  const receipt = await tx.goodsReceipt.create({
    data: {
      companyId: actor.companyId,
      number,
      partyId: order.partyId,
      warehouseId: order.warehouseId,
      purchaseOrderId: order.id,
      orderNumber: order.number,
      status: "POSTED",
      date: input.date,
      notes: clean(input.notes) ?? order.notes,
      lines: {
        create: order.lines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          vatRate: line.vatRate,
          lineNet: line.lineNet,
          vatAmount: line.vatAmount,
          lineTotal: line.lineTotal,
          lotCode: line.lotCode,
          serialCode: line.serialCode,
        })),
      },
    },
  });
  for (const line of order.lines) {
    await applyStock(tx, {
      productId: line.productId,
      warehouseId: order.warehouseId,
      signedQty: line.quantity,
      type: "IN",
      date: input.date,
      source: "GOODS_RECEIPT",
      sourceId: receipt.id,
      sourceLabel: number,
      note: `Mal kabul ${number}`,
      lotCode: line.lotCode,
      serialCode: line.serialCode,
    });
  }
  await tx.purchaseOrder.update({
    where: { id: order.id },
    data: { status: "RECEIVED" },
  });
  await writeAudit(tx, {
    companyId: actor.companyId,
    userId: actor.userId,
    action: "RECEIVE",
    entityType: "GoodsReceipt",
    entityId: receipt.id,
    summary: `Mal kabul ${number} (borç belgesi değil — alış faturası ayrı)`,
  });
  return receipt;
}

export async function cancelGoodsReceipt(tx: Db, actor: Actor, id: string) {
  assertPermission(actor.role, "purchasing");
  const receipt = await tx.goodsReceipt.findFirst({
    where: { id, companyId: actor.companyId },
    include: { lines: true, purchaseInvoices: true },
  });
  if (!receipt) throw new ErpError("Mal kabul bulunamadı.");
  if (receipt.status !== "POSTED") {
    throw new ErpError("Mal kabul iptal edilemez.");
  }
  if (receipt.purchaseInvoices.some((inv) => inv.status !== "CANCELLED")) {
    throw new ErpError("Bağlı alış faturası varken mal kabul iptal edilemez.");
  }
  for (const line of receipt.lines) {
    await applyStock(tx, {
      productId: line.productId,
      warehouseId: receipt.warehouseId,
      signedQty: -line.quantity,
      type: "OUT",
      date: receipt.date,
      source: "RECEIPT_CANCEL",
      sourceId: receipt.id,
      sourceLabel: receipt.number,
      note: `Mal kabul iptali ${receipt.number}`,
    });
  }
  if (receipt.purchaseOrderId) {
    await tx.purchaseOrder.update({
      where: { id: receipt.purchaseOrderId },
      data: { status: "CONFIRMED" },
    });
  }
  return tx.goodsReceipt.update({
    where: { id },
    data: { status: "CANCELLED", purchaseOrderId: null },
  });
}

export async function createPurchaseInvoiceFromReceipt(
  tx: Db,
  actor: Actor,
  receiptId: string,
  input: { date: Date; dueDate: Date; notes?: string | null },
) {
  assertPermission(actor.role, "purchasing");
  const receipt = await tx.goodsReceipt.findFirst({
    where: { id: receiptId, companyId: actor.companyId },
    include: { lines: true, purchaseInvoices: true, purchaseOrder: true },
  });
  if (!receipt || receipt.status !== "POSTED") {
    throw new ErpError("Mal kabul bulunamadı.");
  }
  if (receipt.purchaseInvoices.some((inv) => !inv.isReturn && inv.status !== "CANCELLED")) {
    throw new ErpError("Bu mal kabul için alış faturası zaten var.");
  }
  if (input.dueDate < input.date) {
    throw new ErpError("Vade, fatura tarihinden önce olamaz.");
  }
  const totals = sumLines(receipt.lines);
  const rate = receipt.purchaseOrder?.exchangeRate ?? 100;
  const currency = receipt.purchaseOrder?.currencyCode ?? "TRY";
  const totalTry = toTry(totals.total, rate);
  const number = await nextNumber(tx, actor.companyId, "AF", input.date);
  const invoice = await tx.purchaseInvoice.create({
    data: {
      companyId: actor.companyId,
      number,
      partyId: receipt.partyId,
      warehouseId: receipt.warehouseId,
      goodsReceiptId: receipt.id,
      receiptNumber: receipt.number,
      status: totals.total === 0 ? "PAID" : "OPEN",
      date: input.date,
      dueDate: input.dueDate,
      currencyCode: currency,
      exchangeRate: rate,
      subtotal: totals.subtotal,
      vatTotal: totals.vatTotal,
      total: totals.total,
      totalTry,
      paidAmount: 0,
      notes: clean(input.notes) ?? receipt.notes,
      lines: {
        create: receipt.lines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          vatRate: line.vatRate,
          lineNet: line.lineNet,
          vatAmount: line.vatAmount,
          lineTotal: line.lineTotal,
          lotCode: line.lotCode,
          serialCode: line.serialCode,
        })),
      },
    },
  });
  await postJournal(tx, {
    companyId: actor.companyId,
    date: input.date,
    memo: `Alış faturası ${number}`,
    source: "PURCHASE_INVOICE",
    sourceId: invoice.id,
    lines: [
      { accountCode: "153", debit: toTry(totals.subtotal, rate), credit: 0, memo: "Ticari mallar" },
      { accountCode: "191", debit: toTry(totals.vatTotal, rate), credit: 0, memo: "İndirilecek KDV" },
      { accountCode: "320", debit: 0, credit: totalTry, memo: "Satıcılar" },
    ].filter((l) => l.debit + l.credit > 0),
  });
  await writeAudit(tx, {
    companyId: actor.companyId,
    userId: actor.userId,
    action: "INVOICE",
    entityType: "PurchaseInvoice",
    entityId: invoice.id,
    summary: `Alış faturası ${number} ← ${receipt.number}`,
  });
  return invoice;
}

export async function createPurchaseReturn(
  tx: Db,
  actor: Actor,
  originalInvoiceId: string,
  input: { date: Date; notes?: string | null },
) {
  assertPermission(actor.role, "purchasing");
  const original = await tx.purchaseInvoice.findFirst({
    where: { id: originalInvoiceId, companyId: actor.companyId },
    include: { lines: true },
  });
  if (!original || original.isReturn) throw new ErpError("İade edilecek alış faturası yok.");
  if (original.status === "CANCELLED") throw new ErpError("İptal fatura iade edilemez.");
  const number = await nextNumber(tx, actor.companyId, "AI", input.date);
  const totals = sumLines(
    original.lines.map((l) => ({
      lineNet: Math.abs(l.lineNet),
      vatAmount: Math.abs(l.vatAmount),
      lineTotal: Math.abs(l.lineTotal),
    })),
  );
  const totalTry = toTry(totals.total, original.exchangeRate);
  const invoice = await tx.purchaseInvoice.create({
    data: {
      companyId: actor.companyId,
      number,
      partyId: original.partyId,
      warehouseId: original.warehouseId,
      receiptNumber: original.receiptNumber,
      isReturn: true,
      originalInvoiceId: original.id,
      status: "PAID",
      date: input.date,
      dueDate: input.date,
      currencyCode: original.currencyCode,
      exchangeRate: original.exchangeRate,
      subtotal: -totals.subtotal,
      vatTotal: -totals.vatTotal,
      total: -totals.total,
      totalTry: -totalTry,
      paidAmount: -totals.total,
      notes: clean(input.notes) ?? `İade: ${original.number}`,
      lines: {
        create: original.lines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          vatRate: line.vatRate,
          lineNet: -Math.abs(line.lineNet),
          vatAmount: -Math.abs(line.vatAmount),
          lineTotal: -Math.abs(line.lineTotal),
          lotCode: line.lotCode,
          serialCode: line.serialCode,
        })),
      },
    },
  });
  for (const line of original.lines) {
    await applyStock(tx, {
      productId: line.productId,
      warehouseId: original.warehouseId,
      signedQty: -line.quantity,
      type: "OUT",
      date: input.date,
      source: "PURCHASE_RETURN",
      sourceId: invoice.id,
      sourceLabel: number,
      note: `Alış iadesi ${number}`,
      lotCode: line.lotCode,
      serialCode: line.serialCode,
    });
  }
  const open = original.total - original.paidAmount;
  if (open > 0) {
    const reduce = Math.min(open, totals.total);
    const paid = original.paidAmount + reduce;
    await tx.purchaseInvoice.update({
      where: { id: original.id },
      data: {
        paidAmount: paid,
        status: paid >= original.total ? "PAID" : paid > 0 ? "PARTIAL" : original.status,
      },
    });
  }
  await writeAudit(tx, {
    companyId: actor.companyId,
    userId: actor.userId,
    action: "RETURN",
    entityType: "PurchaseInvoice",
    entityId: invoice.id,
    summary: `Alış iadesi ${number} ← ${original.number}`,
  });
  return invoice;
}

async function applyCustomerAllocations(
  tx: Db,
  partyId: string,
  allocations: { documentId: string; amount: number }[],
) {
  const ids = allocations.map((row) => row.documentId);
  if (new Set(ids).size !== ids.length) {
    throw new ErpError("Aynı fatura bir tahsilatta iki kez seçilemez.");
  }
  const invoices = await tx.salesInvoice.findMany({
    where: { id: { in: ids }, isReturn: false },
  });
  const byId = new Map(invoices.map((invoice) => [invoice.id, invoice]));
  for (const allocation of allocations) {
    assertAmount(allocation.amount);
    const invoice = byId.get(allocation.documentId);
    if (!invoice) throw new ErpError("Fatura bulunamadı.");
    if (invoice.partyId !== partyId) throw new ErpError("Fatura seçilen cariye ait değil.");
    if (invoice.status !== "OPEN" && invoice.status !== "PARTIAL") {
      throw new ErpError(`${invoice.number} tahsilata kapalı.`);
    }
    const remaining = invoice.total - invoice.paidAmount;
    if (allocation.amount > remaining) {
      throw new ErpError(
        `Tahsilat açık tutarı aşıyor: ${invoice.number} açık ${formatMoney(remaining)}, uygulanan ${formatMoney(allocation.amount)}.`,
      );
    }
  }
  for (const allocation of allocations) {
    const invoice = byId.get(allocation.documentId)!;
    const paid = invoice.paidAmount + allocation.amount;
    await tx.salesInvoice.update({
      where: { id: invoice.id },
      data: {
        paidAmount: paid,
        status: paid === invoice.total ? "PAID" : "PARTIAL",
      },
    });
  }
}

async function applySupplierAllocations(
  tx: Db,
  partyId: string,
  allocations: { documentId: string; amount: number }[],
) {
  const ids = allocations.map((row) => row.documentId);
  if (new Set(ids).size !== ids.length) {
    throw new ErpError("Aynı alış faturası bir ödemede iki kez seçilemez.");
  }
  const invoices = await tx.purchaseInvoice.findMany({
    where: { id: { in: ids }, isReturn: false },
  });
  const byId = new Map(invoices.map((invoice) => [invoice.id, invoice]));
  for (const allocation of allocations) {
    assertAmount(allocation.amount);
    const invoice = byId.get(allocation.documentId);
    if (!invoice) throw new ErpError("Alış faturası bulunamadı.");
    if (invoice.partyId !== partyId) throw new ErpError("Belge seçilen cariye ait değil.");
    if (invoice.status !== "OPEN" && invoice.status !== "PARTIAL") {
      throw new ErpError(`${invoice.number} ödemeye kapalı.`);
    }
    const remaining = invoice.total - invoice.paidAmount;
    if (allocation.amount > remaining) {
      throw new ErpError(
        `Ödeme açık tutarı aşıyor: ${invoice.number} açık ${formatMoney(remaining)}, uygulanan ${formatMoney(allocation.amount)}.`,
      );
    }
  }
  for (const allocation of allocations) {
    const invoice = byId.get(allocation.documentId)!;
    const paid = invoice.paidAmount + allocation.amount;
    await tx.purchaseInvoice.update({
      where: { id: invoice.id },
      data: {
        paidAmount: paid,
        status: paid === invoice.total ? "PAID" : "PARTIAL",
      },
    });
  }
}

async function resolveMoneyAccount(
  tx: Db,
  companyId: string,
  method: PaymentMethod,
  moneyAccountId?: string | null,
) {
  if (moneyAccountId) {
    const account = await tx.moneyAccount.findFirst({
      where: { id: moneyAccountId, companyId, active: true },
    });
    if (!account) throw new ErpError("Kasa/banka hesabı bulunamadı.");
    return account;
  }
  const type = method === "BANK" ? "BANK" : "CASH";
  const account = await tx.moneyAccount.findFirst({
    where: { companyId, type, active: true },
    orderBy: { code: "asc" },
  });
  if (!account) throw new ErpError(`${type === "BANK" ? "Banka" : "Kasa"} hesabı tanımlı değil.`);
  return account;
}

export async function createCollection(
  tx: Db,
  actor: Actor,
  input: {
    partyId: string;
    date: Date;
    method: PaymentMethod;
    amount: number;
    notes?: string | null;
    allocations: { documentId: string; amount: number }[];
    moneyAccountId?: string | null;
    currencyCode?: string;
    exchangeRate?: number;
  },
) {
  assertPermission(actor.role, "finance");
  assertAmount(input.amount);
  const party = await tx.party.findFirst({
    where: { id: input.partyId, companyId: actor.companyId },
  });
  if (!party || party.type !== "CUSTOMER") {
    throw new ErpError("Tahsilat yalnızca müşteri carisine işlenir.");
  }
  if (input.allocations.length === 0) {
    throw new ErpError("Tahsilat açık bir faturaya uygulanmalı.");
  }
  const allocated = input.allocations.reduce((sum, row) => sum + row.amount, 0);
  if (allocated !== input.amount) {
    throw new ErpError("Tahsilat tutarı fatura dağılımıyla eşleşmiyor.");
  }
  await applyCustomerAllocations(tx, party.id, input.allocations);
  const rate = input.exchangeRate ?? 100;
  const amountTry = toTry(input.amount, rate);
  const moneyAccount = await resolveMoneyAccount(
    tx,
    actor.companyId,
    input.method,
    input.moneyAccountId,
  );
  const number = await nextNumber(tx, actor.companyId, "TH", input.date);
  const payment = await tx.payment.create({
    data: {
      companyId: actor.companyId,
      number,
      type: "COLLECTION",
      method: input.method,
      partyId: party.id,
      moneyAccountId: moneyAccount.id,
      date: input.date,
      amount: input.amount,
      currencyCode: input.currencyCode ?? "TRY",
      exchangeRate: rate,
      amountTry,
      notes: clean(input.notes),
      allocations: {
        create: input.allocations.map((row) => ({
          salesInvoiceId: row.documentId,
          amount: row.amount,
        })),
      },
    },
  });
  await moveMoney(tx, {
    moneyAccountId: moneyAccount.id,
    signedAmount: amountTry,
    date: input.date,
    paymentId: payment.id,
    note: `Tahsilat ${number}`,
  });
  await postJournal(tx, {
    companyId: actor.companyId,
    date: input.date,
    memo: `Tahsilat ${number}`,
    source: "COLLECTION",
    sourceId: payment.id,
    lines: [
      {
        accountCode: moneyAccount.type === "BANK" ? "102" : "100",
        debit: amountTry,
        credit: 0,
      },
      { accountCode: "120", debit: 0, credit: amountTry },
    ],
  });
  return payment;
}

export async function createSupplierPayment(
  tx: Db,
  actor: Actor,
  input: {
    partyId: string;
    date: Date;
    method: PaymentMethod;
    amount: number;
    notes?: string | null;
    allocations: { documentId: string; amount: number }[];
    moneyAccountId?: string | null;
    currencyCode?: string;
    exchangeRate?: number;
  },
) {
  assertPermission(actor.role, "finance");
  assertAmount(input.amount);
  const party = await tx.party.findFirst({
    where: { id: input.partyId, companyId: actor.companyId },
  });
  if (!party || party.type !== "SUPPLIER") {
    throw new ErpError("Ödeme yalnızca tedarikçi carisine işlenir.");
  }
  if (input.allocations.length === 0) {
    throw new ErpError("Ödeme açık bir alış faturasına uygulanmalı.");
  }
  const allocated = input.allocations.reduce((sum, row) => sum + row.amount, 0);
  if (allocated !== input.amount) {
    throw new ErpError("Ödeme tutarı belge dağılımıyla eşleşmiyor.");
  }
  await applySupplierAllocations(tx, party.id, input.allocations);
  const rate = input.exchangeRate ?? 100;
  const amountTry = toTry(input.amount, rate);
  const moneyAccount = await resolveMoneyAccount(
    tx,
    actor.companyId,
    input.method,
    input.moneyAccountId,
  );
  const number = await nextNumber(tx, actor.companyId, "OD", input.date);
  const payment = await tx.payment.create({
    data: {
      companyId: actor.companyId,
      number,
      type: "SUPPLIER_PAYMENT",
      method: input.method,
      partyId: party.id,
      moneyAccountId: moneyAccount.id,
      date: input.date,
      amount: input.amount,
      currencyCode: input.currencyCode ?? "TRY",
      exchangeRate: rate,
      amountTry,
      notes: clean(input.notes),
      allocations: {
        create: input.allocations.map((row) => ({
          purchaseInvoiceId: row.documentId,
          amount: row.amount,
        })),
      },
    },
  });
  await moveMoney(tx, {
    moneyAccountId: moneyAccount.id,
    signedAmount: -amountTry,
    date: input.date,
    paymentId: payment.id,
    note: `Ödeme ${number}`,
  });
  await postJournal(tx, {
    companyId: actor.companyId,
    date: input.date,
    memo: `Tedarikçi ödemesi ${number}`,
    source: "SUPPLIER_PAYMENT",
    sourceId: payment.id,
    lines: [
      { accountCode: "320", debit: amountTry, credit: 0 },
      {
        accountCode: moneyAccount.type === "BANK" ? "102" : "100",
        debit: 0,
        credit: amountTry,
      },
    ],
  });
  return payment;
}

export async function customerReceivable(tx: Db, partyId: string) {
  const invoices = await tx.salesInvoice.findMany({
    where: { partyId, isReturn: false, status: { in: ["OPEN", "PARTIAL"] } },
    select: { total: true, paidAmount: true },
  });
  return invoices.reduce((sum, invoice) => sum + (invoice.total - invoice.paidAmount), 0);
}

export async function supplierPayable(tx: Db, partyId: string) {
  const invoices = await tx.purchaseInvoice.findMany({
    where: { partyId, isReturn: false, status: { in: ["OPEN", "PARTIAL"] } },
    select: { total: true, paidAmount: true },
  });
  return invoices.reduce((sum, invoice) => sum + (invoice.total - invoice.paidAmount), 0);
}

export function orderTotal(lines: { lineTotal: number }[]) {
  return lines.reduce((sum, line) => sum + line.lineTotal, 0);
}

export async function transferStock(
  tx: Db,
  actor: Actor,
  input: {
    fromWarehouseId: string;
    toWarehouseId: string;
    date: Date;
    notes?: string | null;
    lines: { productId: string; quantity: number; lotCode?: string | null; serialCode?: string | null }[];
  },
) {
  assertPermission(actor.role, "stock");
  if (input.fromWarehouseId === input.toWarehouseId) {
    throw new ErpError("Kaynak ve hedef depo aynı olamaz.");
  }
  const from = await defaultWarehouse(tx, actor.companyId, input.fromWarehouseId);
  const to = await defaultWarehouse(tx, actor.companyId, input.toWarehouseId);
  if (input.lines.length === 0) throw new ErpError("En az bir satır ekleyin.");
  const number = await nextNumber(tx, actor.companyId, "TR", input.date);
  for (const line of input.lines) {
    assertQty(line.quantity);
    await applyStock(tx, {
      productId: line.productId,
      warehouseId: from.id,
      signedQty: -line.quantity,
      type: "TRANSFER_OUT",
      date: input.date,
      source: "TRANSFER",
      sourceLabel: number,
      note: `Transfer çıkış ${number}`,
      lotCode: line.lotCode,
      serialCode: line.serialCode,
    });
    await applyStock(tx, {
      productId: line.productId,
      warehouseId: to.id,
      signedQty: line.quantity,
      type: "TRANSFER_IN",
      date: input.date,
      source: "TRANSFER",
      sourceLabel: number,
      note: `Transfer giriş ${number}`,
      lotCode: line.lotCode,
      serialCode: line.serialCode,
    });
  }
  return tx.stockTransfer.create({
    data: {
      companyId: actor.companyId,
      number,
      fromWarehouseId: from.id,
      toWarehouseId: to.id,
      date: input.date,
      notes: clean(input.notes),
      lines: {
        create: input.lines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          lotCode: clean(line.lotCode),
          serialCode: clean(line.serialCode),
        })),
      },
    },
  });
}

export async function createDeliveryNote(
  tx: Db,
  actor: Actor,
  input: {
    direction: "SALES" | "PURCHASE";
    partyId: string;
    warehouseId?: string;
    date: Date;
    notes?: string | null;
    salesOrderId?: string | null;
    salesInvoiceId?: string | null;
    purchaseOrderId?: string | null;
    goodsReceiptId?: string | null;
    lines: { productId: string; quantity: number; lotCode?: string | null; serialCode?: string | null }[];
  },
) {
  assertPermission(actor.role, input.direction === "SALES" ? "sales" : "purchasing");
  const wh = await defaultWarehouse(tx, actor.companyId, input.warehouseId);
  if (input.lines.length === 0) throw new ErpError("En az bir satır ekleyin.");
  for (const line of input.lines) assertQty(line.quantity);
  const number = await nextNumber(tx, actor.companyId, "IR", input.date);
  return tx.deliveryNote.create({
    data: {
      companyId: actor.companyId,
      number,
      direction: input.direction,
      partyId: input.partyId,
      warehouseId: wh.id,
      salesOrderId: input.salesOrderId ?? null,
      salesInvoiceId: input.salesInvoiceId ?? null,
      purchaseOrderId: input.purchaseOrderId ?? null,
      goodsReceiptId: input.goodsReceiptId ?? null,
      status: "SHIPPED",
      date: input.date,
      notes: clean(input.notes),
      lines: {
        create: input.lines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          lotCode: clean(line.lotCode),
          serialCode: clean(line.serialCode),
        })),
      },
    },
  });
}

export type PartyRecord = Prisma.PartyGetPayload<object>;

export { formatQty };
