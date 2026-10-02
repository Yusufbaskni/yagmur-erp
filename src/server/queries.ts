import type { Prisma } from "@prisma/client";
import { monthStart, startOfToday } from "@/lib/dates";
import { resolveActor } from "@/server/company";
import { db, type Db } from "@/server/db";

const openStatuses = ["OPEN", "PARTIAL"] as const;

async function companyId() {
  return (await resolveActor()).companyId;
}

export async function balanceMap(tx: Db = db(), cid?: string) {
  const companyId = cid ?? (await resolveActor()).companyId;
  const [invoices, purchases] = await Promise.all([
    tx.salesInvoice.findMany({
      where: { companyId, isReturn: false, status: { in: [...openStatuses] } },
      select: { partyId: true, total: true, paidAmount: true },
    }),
    tx.purchaseInvoice.findMany({
      where: { companyId, isReturn: false, status: { in: [...openStatuses] } },
      select: { partyId: true, total: true, paidAmount: true },
    }),
  ]);
  const map = new Map<string, number>();
  for (const invoice of invoices) {
    map.set(
      invoice.partyId,
      (map.get(invoice.partyId) ?? 0) + (invoice.total - invoice.paidAmount),
    );
  }
  for (const purchase of purchases) {
    map.set(
      purchase.partyId,
      (map.get(purchase.partyId) ?? 0) + (purchase.total - purchase.paidAmount),
    );
  }
  return map;
}

function partyWhere(
  companyId: string,
  filters: { q?: string; type?: string },
): Prisma.PartyWhereInput {
  const where: Prisma.PartyWhereInput = { companyId };
  if (filters.type === "CUSTOMER" || filters.type === "SUPPLIER") {
    where.type = filters.type;
  }
  const q = filters.q?.trim();
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { code: { contains: q } },
      { city: { contains: q } },
      { taxNumber: { contains: q } },
    ];
  }
  return where;
}

export async function listParties(filters: { q?: string; type?: string }) {
  const cid = await companyId();
  const parties = await db().party.findMany({
    where: partyWhere(cid, filters),
    orderBy: [{ type: "asc" }, { code: "asc" }],
  });
  const balances = await balanceMap(db(), cid);
  return parties.map((party) => ({
    ...party,
    balance: balances.get(party.id) ?? 0,
  }));
}

export async function getParty(id: string) {
  const cid = await companyId();
  const party = await db().party.findFirst({ where: { id, companyId: cid } });
  if (!party) return null;
  const [balances, invoices, purchases, salesOrders, purchaseOrders, payments] =
    await Promise.all([
      balanceMap(db(), cid),
      db().salesInvoice.findMany({
        where: { partyId: id, companyId: cid },
        orderBy: { date: "desc" },
        take: 8,
      }),
      db().purchaseInvoice.findMany({
        where: { partyId: id, companyId: cid },
        orderBy: { date: "desc" },
        take: 8,
      }),
      db().salesOrder.findMany({
        where: { partyId: id, companyId: cid },
        orderBy: { date: "desc" },
        include: { lines: true },
        take: 8,
      }),
      db().purchaseOrder.findMany({
        where: { partyId: id, companyId: cid },
        orderBy: { date: "desc" },
        include: { lines: true },
        take: 8,
      }),
      db().payment.findMany({
        where: { partyId: id, companyId: cid },
        orderBy: { date: "desc" },
        take: 8,
      }),
    ]);
  return {
    party,
    balance: balances.get(party.id) ?? 0,
    invoices,
    receipts: purchases,
    salesOrders,
    purchaseOrders,
    payments,
  };
}

export async function listProducts(filters: { q?: string }) {
  const cid = await companyId();
  const q = filters.q?.trim();
  return db().product.findMany({
    where: {
      companyId: cid,
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { sku: { contains: q } },
              { barcode: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: { sku: "asc" },
    include: { warehouseStocks: { include: { warehouse: true } } },
  });
}

export async function getProduct(id: string) {
  const cid = await companyId();
  return db().product.findFirst({
    where: { id, companyId: cid },
    include: {
      warehouseStocks: { include: { warehouse: true } },
      movements: { orderBy: { date: "desc" }, take: 20, include: { warehouse: true } },
    },
  });
}

export async function listWarehouses() {
  const cid = await companyId();
  return db().warehouse.findMany({
    where: { companyId: cid },
    orderBy: [{ isDefault: "desc" }, { code: "asc" }],
    include: { stocks: true },
  });
}

export async function listMoneyAccounts() {
  const cid = await companyId();
  return db().moneyAccount.findMany({
    where: { companyId: cid },
    orderBy: { code: "asc" },
    include: { movements: { orderBy: { date: "desc" }, take: 5 } },
  });
}

export async function getDashboard() {
  const cid = await companyId();
  const today = startOfToday();
  const [openInvoices, overdueInvoices, openPurchases, lowStock, recentInvoices, recentPurchases] =
    await Promise.all([
      db().salesInvoice.findMany({
        where: { companyId: cid, isReturn: false, status: { in: [...openStatuses] } },
        select: { total: true, paidAmount: true },
      }),
      db().salesInvoice.findMany({
        where: {
          companyId: cid,
          isReturn: false,
          status: { in: [...openStatuses] },
          dueDate: { lt: today },
        },
        select: { total: true, paidAmount: true },
      }),
      db().purchaseInvoice.findMany({
        where: { companyId: cid, isReturn: false, status: { in: [...openStatuses] } },
        select: { total: true, paidAmount: true },
      }),
      db().product.findMany({
        where: { companyId: cid, active: true },
        orderBy: { sku: "asc" },
      }),
      db().salesInvoice.findMany({
        where: { companyId: cid },
        orderBy: { date: "desc" },
        include: { party: true },
        take: 6,
      }),
      db().purchaseInvoice.findMany({
        where: { companyId: cid },
        orderBy: { date: "desc" },
        include: { party: true },
        take: 6,
      }),
    ]);
  return {
    openAmount: openInvoices.reduce((s, i) => s + (i.total - i.paidAmount), 0),
    openCount: openInvoices.length,
    overdueAmount: overdueInvoices.reduce((s, i) => s + (i.total - i.paidAmount), 0),
    overdueCount: overdueInvoices.length,
    payableAmount: openPurchases.reduce((s, i) => s + (i.total - i.paidAmount), 0),
    lowStock: lowStock.filter((p) => p.stockOnHand <= p.minStock).slice(0, 8),
    recentInvoices,
    recentReceipts: recentPurchases,
  };
}

export async function listSalesOrders(filters: { durum?: string }) {
  const cid = await companyId();
  const where: Prisma.SalesOrderWhereInput = { companyId: cid };
  if (filters.durum === "TASLAK") where.status = "DRAFT";
  if (filters.durum === "ONAYLI") where.status = "CONFIRMED";
  if (filters.durum === "FATURALANDI") where.status = "INVOICED";
  if (filters.durum === "IPTAL") where.status = "CANCELLED";
  const orders = await db().salesOrder.findMany({
    where,
    orderBy: { date: "desc" },
    include: { party: true, lines: true, warehouse: true },
  });
  return orders.map((order) => ({
    ...order,
    total: order.lines.reduce((s, l) => s + l.lineTotal, 0),
  }));
}

export async function getSalesOrder(id: string) {
  const cid = await companyId();
  const order = await db().salesOrder.findFirst({
    where: { id, companyId: cid },
    include: {
      party: true,
      warehouse: true,
      lines: { include: { product: true } },
      invoice: true,
      deliveryNotes: true,
    },
  });
  if (!order) return null;
  return {
    ...order,
    total: order.lines.reduce((s, l) => s + l.lineTotal, 0),
  };
}

export async function listSalesInvoices(filters: { durum?: string }) {
  const cid = await companyId();
  const where: Prisma.SalesInvoiceWhereInput = { companyId: cid };
  if (filters.durum === "ACIK") where.status = { in: [...openStatuses] };
  if (filters.durum === "ODENDI") where.status = "PAID";
  if (filters.durum === "IPTAL") where.status = "CANCELLED";
  if (filters.durum === "IADE") where.isReturn = true;
  return db().salesInvoice.findMany({
    where,
    orderBy: { date: "desc" },
    include: { party: true, warehouse: true },
  });
}

export async function getSalesInvoice(id: string) {
  const cid = await companyId();
  return db().salesInvoice.findFirst({
    where: { id, companyId: cid },
    include: {
      party: true,
      warehouse: true,
      lines: { include: { product: true } },
      allocations: { include: { payment: true } },
      eInvoices: true,
      returns: true,
      originalInvoice: true,
    },
  });
}

export async function getInvoice(id: string) {
  return getSalesInvoice(id);
}

export async function listPurchaseOrders(filters: { durum?: string }) {
  const cid = await companyId();
  const where: Prisma.PurchaseOrderWhereInput = { companyId: cid };
  if (filters.durum === "TASLAK") where.status = "DRAFT";
  if (filters.durum === "ONAYLI") where.status = "CONFIRMED";
  if (filters.durum === "TESLIM") where.status = "RECEIVED";
  const orders = await db().purchaseOrder.findMany({
    where,
    orderBy: { date: "desc" },
    include: { party: true, lines: true, warehouse: true },
  });
  return orders.map((order) => ({
    ...order,
    total: order.lines.reduce((s, l) => s + l.lineTotal, 0),
  }));
}

export async function getPurchaseOrder(id: string) {
  const cid = await companyId();
  const order = await db().purchaseOrder.findFirst({
    where: { id, companyId: cid },
    include: {
      party: true,
      warehouse: true,
      lines: { include: { product: true } },
      receipt: true,
    },
  });
  if (!order) return null;
  return {
    ...order,
    total: order.lines.reduce((s, l) => s + l.lineTotal, 0),
  };
}

export async function listGoodsReceipts() {
  const cid = await companyId();
  return db().goodsReceipt.findMany({
    where: { companyId: cid },
    orderBy: { date: "desc" },
    include: { party: true, warehouse: true, purchaseInvoices: true, lines: true },
  });
}

export async function getGoodsReceipt(id: string) {
  const cid = await companyId();
  return db().goodsReceipt.findFirst({
    where: { id, companyId: cid },
    include: {
      party: true,
      warehouse: true,
      lines: { include: { product: true } },
      purchaseInvoices: true,
      purchaseOrder: true,
    },
  });
}

export async function getReceipt(id: string) {
  return getGoodsReceipt(id);
}

export async function listPurchaseInvoices(filters: { durum?: string }) {
  const cid = await companyId();
  const where: Prisma.PurchaseInvoiceWhereInput = { companyId: cid };
  if (filters.durum === "ACIK") where.status = { in: [...openStatuses] };
  if (filters.durum === "IADE") where.isReturn = true;
  return db().purchaseInvoice.findMany({
    where,
    orderBy: { date: "desc" },
    include: { party: true, warehouse: true, goodsReceipt: true },
  });
}

export async function getPurchaseInvoice(id: string) {
  const cid = await companyId();
  return db().purchaseInvoice.findFirst({
    where: { id, companyId: cid },
    include: {
      party: true,
      warehouse: true,
      lines: { include: { product: true } },
      allocations: { include: { payment: true } },
      goodsReceipt: true,
      returns: true,
      originalInvoice: true,
    },
  });
}

export async function listPayments(type: "COLLECTION" | "SUPPLIER_PAYMENT") {
  const cid = await companyId();
  return db().payment.findMany({
    where: { companyId: cid, type },
    orderBy: { date: "desc" },
    include: { party: true, moneyAccount: true },
  });
}

export async function getPayment(id: string) {
  const cid = await companyId();
  return db().payment.findFirst({
    where: { id, companyId: cid },
    include: {
      party: true,
      moneyAccount: true,
      allocations: {
        include: { salesInvoice: true, purchaseInvoice: true },
      },
    },
  });
}

export async function listMovements() {
  const cid = await companyId();
  return db().stockMovement.findMany({
    where: { product: { companyId: cid } },
    orderBy: { date: "desc" },
    include: { product: true, warehouse: true },
    take: 100,
  });
}

export async function getFinanceSummary() {
  const cid = await companyId();
  const [sales, purchases, collections, payments, cash] = await Promise.all([
    db().salesInvoice.findMany({
      where: { companyId: cid, isReturn: false, status: { in: [...openStatuses] } },
    }),
    db().purchaseInvoice.findMany({
      where: { companyId: cid, isReturn: false, status: { in: [...openStatuses] } },
    }),
    db().payment.findMany({ where: { companyId: cid, type: "COLLECTION" } }),
    db().payment.findMany({ where: { companyId: cid, type: "SUPPLIER_PAYMENT" } }),
    db().moneyAccount.findMany({ where: { companyId: cid } }),
  ]);
  return {
    receivable: sales.reduce((s, i) => s + (i.total - i.paidAmount), 0),
    payable: purchases.reduce((s, i) => s + (i.total - i.paidAmount), 0),
    collections: collections.reduce((s, p) => s + p.amountTry, 0),
    payments: payments.reduce((s, p) => s + p.amountTry, 0),
    cashBalance: cash.reduce((s, a) => s + a.balance, 0),
    accounts: cash,
  };
}

export async function getFinance() {
  const cid = await companyId();
  const start = monthStart();
  const today = startOfToday();
  const [invoices, purchases, payments] = await Promise.all([
    db().salesInvoice.findMany({
      where: { companyId: cid, status: { not: "CANCELLED" }, isReturn: false },
      include: { party: true },
    }),
    db().purchaseInvoice.findMany({
      where: { companyId: cid, status: { not: "CANCELLED" }, isReturn: false },
      include: { party: true },
    }),
    db().payment.findMany({ where: { companyId: cid } }),
  ]);
  const remaining = (row: { total: number; paidAmount: number; status: string }) =>
    row.status === "OPEN" || row.status === "PARTIAL" ? row.total - row.paidAmount : 0;
  const sum = (rows: { total: number; date: Date }[], from?: Date) =>
    rows.filter((row) => !from || row.date >= from).reduce((total, row) => total + row.total, 0);
  const paySum = (type: "COLLECTION" | "SUPPLIER_PAYMENT", from?: Date) =>
    payments
      .filter((payment) => payment.type === type && (!from || payment.date >= from))
      .reduce((total, payment) => total + payment.amountTry, 0);
  return {
    receivables: invoices.reduce((total, invoice) => total + remaining(invoice), 0),
    payables: purchases.reduce((total, purchase) => total + remaining(purchase), 0),
    salesMonth: sum(invoices, start),
    salesAll: sum(invoices),
    purchaseMonth: sum(purchases, start),
    purchaseAll: sum(purchases),
    collectionMonth: paySum("COLLECTION", start),
    collectionAll: paySum("COLLECTION"),
    paymentMonth: paySum("SUPPLIER_PAYMENT", start),
    paymentAll: paySum("SUPPLIER_PAYMENT"),
    openInvoices: invoices
      .filter((invoice) => invoice.status === "OPEN" || invoice.status === "PARTIAL")
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime()),
    openReceipts: purchases
      .filter((purchase) => purchase.status === "OPEN" || purchase.status === "PARTIAL")
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime()),
    today,
  };
}

export async function getVatReport() {
  const cid = await companyId();
  const start = monthStart();
  const [sales, purchases] = await Promise.all([
    db().salesInvoice.findMany({
      where: {
        companyId: cid,
        status: { not: "CANCELLED" },
        date: { gte: start },
      },
    }),
    db().purchaseInvoice.findMany({
      where: {
        companyId: cid,
        status: { not: "CANCELLED" },
        date: { gte: start },
      },
    }),
  ]);
  return {
    salesVat: sales.reduce((s, i) => s + i.vatTotal, 0),
    salesNet: sales.reduce((s, i) => s + i.subtotal, 0),
    purchaseVat: purchases.reduce((s, i) => s + i.vatTotal, 0),
    purchaseNet: purchases.reduce((s, i) => s + i.subtotal, 0),
  };
}

export async function openSalesInvoicesForParty(partyId: string) {
  const cid = await companyId();
  return db().salesInvoice.findMany({
    where: {
      companyId: cid,
      partyId,
      isReturn: false,
      status: { in: [...openStatuses] },
    },
    orderBy: { dueDate: "asc" },
  });
}

export async function openPurchaseInvoicesForParty(partyId: string) {
  const cid = await companyId();
  return db().purchaseInvoice.findMany({
    where: {
      companyId: cid,
      partyId,
      isReturn: false,
      status: { in: [...openStatuses] },
    },
    orderBy: { dueDate: "asc" },
  });
}

export async function listCheckNotes() {
  const cid = await companyId();
  return db().checkNote.findMany({
    where: { companyId: cid },
    orderBy: { dueDate: "asc" },
    include: { party: true, moneyAccount: true },
  });
}

export async function getCheckNote(id: string) {
  const cid = await companyId();
  return db().checkNote.findFirst({
    where: { id, companyId: cid },
    include: { party: true, moneyAccount: true, movements: true },
  });
}

export async function listJournalEntries() {
  const cid = await companyId();
  return db().journalEntry.findMany({
    where: { companyId: cid },
    orderBy: { date: "desc" },
    include: { lines: { include: { account: true } } },
    take: 50,
  });
}

export async function listAccounts() {
  const cid = await companyId();
  return db().account.findMany({
    where: { companyId: cid },
    orderBy: { code: "asc" },
  });
}

export async function listDeliveryNotes() {
  const cid = await companyId();
  return db().deliveryNote.findMany({
    where: { companyId: cid },
    orderBy: { date: "desc" },
    include: { party: true, warehouse: true },
  });
}

export async function getDeliveryNote(id: string) {
  const cid = await companyId();
  return db().deliveryNote.findFirst({
    where: { id, companyId: cid },
    include: {
      party: true,
      warehouse: true,
      lines: { include: { product: true } },
    },
  });
}

export async function listTransfers() {
  const cid = await companyId();
  return db().stockTransfer.findMany({
    where: { companyId: cid },
    orderBy: { date: "desc" },
    include: { fromWarehouse: true, toWarehouse: true, lines: true },
  });
}

export async function listBoms() {
  const cid = await companyId();
  return db().bom.findMany({
    where: { companyId: cid },
    include: { finishedProduct: true, lines: { include: { product: true } } },
    orderBy: { code: "asc" },
  });
}

export async function getBom(id: string) {
  const cid = await companyId();
  return db().bom.findFirst({
    where: { id, companyId: cid },
    include: { finishedProduct: true, lines: { include: { product: true } } },
  });
}

export async function listWorkOrders() {
  const cid = await companyId();
  return db().workOrder.findMany({
    where: { companyId: cid },
    orderBy: { date: "desc" },
    include: { product: true, warehouse: true, bom: true },
  });
}

export async function getWorkOrder(id: string) {
  const cid = await companyId();
  return db().workOrder.findFirst({
    where: { id, companyId: cid },
    include: {
      product: true,
      warehouse: true,
      bom: { include: { lines: { include: { product: true } } } },
    },
  });
}

export async function listEmployees() {
  const cid = await companyId();
  return db().employee.findMany({
    where: { companyId: cid },
    include: { department: true },
    orderBy: { code: "asc" },
  });
}

export async function getEmployee(id: string) {
  const cid = await companyId();
  return db().employee.findFirst({
    where: { id, companyId: cid },
    include: { department: true, leaveRequests: { orderBy: { startDate: "desc" } } },
  });
}

export async function listDepartments() {
  const cid = await companyId();
  return db().department.findMany({
    where: { companyId: cid },
    orderBy: { code: "asc" },
  });
}

export async function listLeaveRequests() {
  const cid = await companyId();
  return db().leaveRequest.findMany({
    where: { companyId: cid },
    include: { employee: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function listLeads() {
  const cid = await companyId();
  return db().lead.findMany({
    where: { companyId: cid },
    include: { party: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function listOpportunities() {
  const cid = await companyId();
  return db().opportunity.findMany({
    where: { companyId: cid },
    include: { party: true, lead: true },
    orderBy: { updatedAt: "desc" },
  });
}

export async function listEInvoices() {
  const cid = await companyId();
  return db().eInvoice.findMany({
    where: { companyId: cid },
    orderBy: { createdAt: "desc" },
    include: { salesInvoice: true },
  });
}

export async function getEInvoice(id: string) {
  const cid = await companyId();
  return db().eInvoice.findFirst({
    where: { id, companyId: cid },
    include: { salesInvoice: { include: { party: true } } },
  });
}

export async function listAuditLogs() {
  const cid = await companyId();
  return db().auditLog.findMany({
    where: { companyId: cid },
    orderBy: { createdAt: "desc" },
    include: { user: true },
    take: 100,
  });
}

export async function listPriceLists() {
  const cid = await companyId();
  return db().priceList.findMany({
    where: { companyId: cid },
    include: { items: { include: { product: true } } },
    orderBy: { code: "asc" },
  });
}

export async function listDiscountTemplates() {
  const cid = await companyId();
  return db().discountTemplate.findMany({
    where: { companyId: cid },
    orderBy: { code: "asc" },
  });
}

export async function listCurrencyRates() {
  const cid = await companyId();
  return db().currencyRate.findMany({
    where: { companyId: cid },
    orderBy: [{ code: "asc" }, { asOfDate: "desc" }],
  });
}

export async function formOptions() {
  const cid = await companyId();
  const [customers, suppliers, products, warehouses, priceLists, discounts, moneyAccounts] =
    await Promise.all([
      db().party.findMany({
        where: { companyId: cid, type: "CUSTOMER", active: true },
        orderBy: { name: "asc" },
      }),
      db().party.findMany({
        where: { companyId: cid, type: "SUPPLIER", active: true },
        orderBy: { name: "asc" },
      }),
      db().product.findMany({
        where: { companyId: cid, active: true },
        orderBy: { sku: "asc" },
      }),
      db().warehouse.findMany({
        where: { companyId: cid, active: true },
        orderBy: [{ isDefault: "desc" }, { code: "asc" }],
      }),
      db().priceList.findMany({ where: { companyId: cid, active: true } }),
      db().discountTemplate.findMany({ where: { companyId: cid, active: true } }),
      db().moneyAccount.findMany({ where: { companyId: cid, active: true } }),
    ]);
  return { customers, suppliers, products, warehouses, priceLists, discounts, moneyAccounts };
}

export async function partyOptions(type: "CUSTOMER" | "SUPPLIER") {
  const opts = await formOptions();
  return type === "CUSTOMER" ? opts.customers : opts.suppliers;
}

export async function productOptions() {
  const opts = await formOptions();
  return opts.products;
}

export async function openReceiptsForPayment() {
  const cid = await companyId();
  return db().purchaseInvoice.findMany({
    where: {
      companyId: cid,
      isReturn: false,
      status: { in: [...openStatuses] },
    },
    orderBy: { dueDate: "asc" },
  });
}

export async function openInvoicesForCollection() {
  const cid = await companyId();
  return db().salesInvoice.findMany({
    where: {
      companyId: cid,
      isReturn: false,
      status: { in: [...openStatuses] },
    },
    orderBy: { dueDate: "asc" },
  });
}
