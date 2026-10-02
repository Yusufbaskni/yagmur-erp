import { formatQty } from "@/lib/format";
import type { Db } from "@/server/db";
import { ErpError } from "@/server/errors";

/** Ürün kartındaki toplam ile depo satırları sapmasın diye işlem sonrası doğrular. */
export async function assertProductStockMatchesWarehouses(tx: Db, productId: string) {
  const product = await tx.product.findUnique({ where: { id: productId } });
  if (!product) throw new ErpError("Ürün bulunamadı.");
  const rows = await tx.warehouseStock.findMany({ where: { productId } });
  const onHand = rows.reduce((sum, row) => sum + row.onHand, 0);
  const reserved = rows.reduce((sum, row) => sum + row.reserved, 0);
  if (onHand !== product.stockOnHand || reserved !== product.stockReserved) {
    throw new ErpError(
      `Stok tutarsızlığı: ${product.sku}. Ürün eldeki ${formatQty(product.stockOnHand)} / rezerv ${formatQty(product.stockReserved)}; depolar ${formatQty(onHand)} / ${formatQty(reserved)}.`,
    );
  }
}

export async function ensureWarehouseStock(
  tx: Db,
  warehouseId: string,
  productId: string,
) {
  return tx.warehouseStock.upsert({
    where: { warehouseId_productId: { warehouseId, productId } },
    create: { warehouseId, productId, onHand: 0, reserved: 0 },
    update: {},
  });
}

export async function applyStock(
  tx: Db,
  args: {
    productId: string;
    warehouseId: string;
    signedQty: number;
    type:
      | "IN"
      | "OUT"
      | "ADJUSTMENT"
      | "TRANSFER_OUT"
      | "TRANSFER_IN"
      | "PRODUCTION_IN"
      | "PRODUCTION_OUT";
    date: Date;
    source:
      | "MANUAL"
      | "SALES_INVOICE"
      | "GOODS_RECEIPT"
      | "INVOICE_CANCEL"
      | "RECEIPT_CANCEL"
      | "SALES_RETURN"
      | "PURCHASE_RETURN"
      | "TRANSFER"
      | "WORK_ORDER"
      | "DELIVERY_NOTE";
    sourceId?: string;
    sourceLabel?: string;
    note?: string;
    lotCode?: string | null;
    serialCode?: string | null;
  },
) {
  const product = await tx.product.findUnique({ where: { id: args.productId } });
  if (!product) throw new ErpError("Ürün bulunamadı.");
  const wh = await ensureWarehouseStock(tx, args.warehouseId, args.productId);
  const nextWh = wh.onHand + args.signedQty;
  const nextProd = product.stockOnHand + args.signedQty;
  if (nextWh < 0 || nextProd < 0) {
    throw new ErpError(
      `Yetersiz stok: ${product.sku} ${product.name}. Depoda ${formatQty(wh.onHand)} ${product.unit}, işlem ${formatQty(Math.abs(args.signedQty))} ${product.unit}.`,
    );
  }
  if (wh.reserved > nextWh) {
    throw new ErpError(
      `Rezerve stok bozulur: ${product.sku}. Depoda ${formatQty(wh.onHand)}, rezerv ${formatQty(wh.reserved)}.`,
    );
  }
  await tx.warehouseStock.update({
    where: { id: wh.id },
    data: { onHand: nextWh },
  });
  await tx.product.update({
    where: { id: product.id },
    data: { stockOnHand: nextProd },
  });
  await tx.stockMovement.create({
    data: {
      productId: product.id,
      warehouseId: args.warehouseId,
      type: args.type,
      quantity: Math.abs(args.signedQty),
      signedQty: args.signedQty,
      date: args.date,
      source: args.source,
      sourceId: args.sourceId,
      sourceLabel: args.sourceLabel,
      note: args.note,
      lotCode: args.lotCode ?? null,
      serialCode: args.serialCode ?? null,
    },
  });
  await assertProductStockMatchesWarehouses(tx, product.id);
}

export async function reserveStock(
  tx: Db,
  args: {
    productId: string;
    warehouseId: string;
    quantity: number;
    date: Date;
    sourceId: string;
    sourceLabel: string;
  },
) {
  const product = await tx.product.findUnique({ where: { id: args.productId } });
  if (!product) throw new ErpError("Ürün bulunamadı.");
  const wh = await ensureWarehouseStock(tx, args.warehouseId, args.productId);
  const available = wh.onHand - wh.reserved;
  if (available < args.quantity) {
    throw new ErpError(
      `Rezerv için yetersiz stok: ${product.sku} ${product.name}. Kullanılabilir ${formatQty(available)} ${product.unit}, istenen ${formatQty(args.quantity)} ${product.unit}.`,
    );
  }
  await tx.warehouseStock.update({
    where: { id: wh.id },
    data: { reserved: wh.reserved + args.quantity },
  });
  await tx.product.update({
    where: { id: product.id },
    data: { stockReserved: product.stockReserved + args.quantity },
  });
  await tx.stockMovement.create({
    data: {
      productId: product.id,
      warehouseId: args.warehouseId,
      type: "RESERVE",
      quantity: args.quantity,
      signedQty: 0,
      date: args.date,
      source: "SALES_ORDER",
      sourceId: args.sourceId,
      sourceLabel: args.sourceLabel,
      note: `Rezervasyon ${args.sourceLabel}`,
    },
  });
  await assertProductStockMatchesWarehouses(tx, product.id);
}

export async function releaseReservation(
  tx: Db,
  args: {
    productId: string;
    warehouseId: string;
    quantity: number;
    date: Date;
    sourceId: string;
    sourceLabel: string;
  },
) {
  const product = await tx.product.findUnique({ where: { id: args.productId } });
  if (!product) throw new ErpError("Ürün bulunamadı.");
  const wh = await ensureWarehouseStock(tx, args.warehouseId, args.productId);
  if (wh.reserved < args.quantity || product.stockReserved < args.quantity) {
    throw new ErpError(`Rezerv serbest bırakılamadı: ${product.sku}`);
  }
  await tx.warehouseStock.update({
    where: { id: wh.id },
    data: { reserved: wh.reserved - args.quantity },
  });
  await tx.product.update({
    where: { id: product.id },
    data: { stockReserved: product.stockReserved - args.quantity },
  });
  await tx.stockMovement.create({
    data: {
      productId: product.id,
      warehouseId: args.warehouseId,
      type: "UNRESERVE",
      quantity: args.quantity,
      signedQty: 0,
      date: args.date,
      source: "SALES_ORDER",
      sourceId: args.sourceId,
      sourceLabel: args.sourceLabel,
      note: `Rezerv iptali ${args.sourceLabel}`,
    },
  });
  await assertProductStockMatchesWarehouses(tx, product.id);
}

export async function consumeReservationAndShip(
  tx: Db,
  args: {
    productId: string;
    warehouseId: string;
    quantity: number;
    date: Date;
    sourceId: string;
    sourceLabel: string;
    lotCode?: string | null;
    serialCode?: string | null;
  },
) {
  await releaseReservation(tx, {
    productId: args.productId,
    warehouseId: args.warehouseId,
    quantity: args.quantity,
    date: args.date,
    sourceId: args.sourceId,
    sourceLabel: args.sourceLabel,
  });
  await applyStock(tx, {
    productId: args.productId,
    warehouseId: args.warehouseId,
    signedQty: -args.quantity,
    type: "OUT",
    date: args.date,
    source: "SALES_INVOICE",
    sourceId: args.sourceId,
    sourceLabel: args.sourceLabel,
    note: `Satış faturası ${args.sourceLabel}`,
    lotCode: args.lotCode,
    serialCode: args.serialCode,
  });
}
