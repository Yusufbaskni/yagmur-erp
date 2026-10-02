import { beforeEach, describe, expect, it } from "vitest";
import { prisma, withTx } from "@/server/db";
import {
  confirmPurchaseOrder,
  confirmSalesOrder,
  createCollection,
  createParty,
  createProduct,
  createPurchaseInvoiceFromReceipt,
  createPurchaseOrder,
  createPurchaseReturn,
  createSalesOrder,
  createSalesReturn,
  createSupplierPayment,
  customerReceivable,
  invoiceSalesOrder,
  receivePurchaseOrder,
  supplierPayable,
  transferStock,
  type Actor,
} from "@/server/ledger";
import { seedChartOfAccounts } from "@/server/modules";
import { kurus, milli, pricedLine, vatOnNet } from "@/server/money";
import { db } from "@/server/db";

const date = new Date(Date.UTC(2026, 5, 15, 12));
const due = new Date(Date.UTC(2026, 6, 15, 12));

async function reset() {
  const tables = [
    "PaymentAllocation",
    "MoneyMovement",
    "Payment",
    "JournalLine",
    "JournalEntry",
    "EInvoice",
    "DeliveryNoteLine",
    "DeliveryNote",
    "StockTransferLine",
    "StockTransfer",
    "StockMovement",
    "SalesInvoiceLine",
    "SalesInvoice",
    "SalesOrderLine",
    "SalesOrder",
    "PurchaseInvoiceLine",
    "PurchaseInvoice",
    "GoodsReceiptLine",
    "GoodsReceipt",
    "PurchaseOrderLine",
    "PurchaseOrder",
    "WorkOrder",
    "BomLine",
    "Bom",
    "LeaveRequest",
    "Employee",
    "Department",
    "Opportunity",
    "Lead",
    "CheckNote",
    "PriceListItem",
    "PriceList",
    "DiscountTemplate",
    "WarehouseStock",
    "Product",
    "Warehouse",
    "MoneyAccount",
    "Account",
    "CurrencyRate",
    "AuditLog",
    "Party",
    "DocumentSequence",
    "UserCompany",
    "User",
    "Company",
  ];
  // SQLite: delete in dependency order via prisma
  await prisma.paymentAllocation.deleteMany();
  await prisma.moneyMovement.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.journalLine.deleteMany();
  await prisma.journalEntry.deleteMany();
  await prisma.eInvoice.deleteMany();
  await prisma.deliveryNoteLine.deleteMany();
  await prisma.deliveryNote.deleteMany();
  await prisma.stockTransferLine.deleteMany();
  await prisma.stockTransfer.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.salesInvoiceLine.deleteMany();
  await prisma.salesInvoice.deleteMany();
  await prisma.salesOrderLine.deleteMany();
  await prisma.salesOrder.deleteMany();
  await prisma.purchaseInvoiceLine.deleteMany();
  await prisma.purchaseInvoice.deleteMany();
  await prisma.goodsReceiptLine.deleteMany();
  await prisma.goodsReceipt.deleteMany();
  await prisma.purchaseOrderLine.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.workOrder.deleteMany();
  await prisma.bomLine.deleteMany();
  await prisma.bom.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.department.deleteMany();
  await prisma.opportunity.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.checkNote.deleteMany();
  await prisma.priceListItem.deleteMany();
  await prisma.priceList.deleteMany();
  await prisma.discountTemplate.deleteMany();
  await prisma.warehouseStock.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.moneyAccount.deleteMany();
  await prisma.account.deleteMany();
  await prisma.currencyRate.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.party.deleteMany();
  await prisma.documentSequence.deleteMany();
  await prisma.userCompany.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();
  void tables;
}

beforeEach(async () => {
  await reset();
});

async function companySetup() {
  const company = await prisma.company.create({
    data: {
      code: "TST",
      name: "Test Gıda",
      shortName: "Test",
    },
  });
  await withTx((tx) => seedChartOfAccounts(tx, company.id));
  const warehouse = await prisma.warehouse.create({
    data: {
      companyId: company.id,
      code: "MRK",
      name: "Merkez",
      isDefault: true,
    },
  });
  const warehouse2 = await prisma.warehouse.create({
    data: {
      companyId: company.id,
      code: "ANT",
      name: "Antalya",
      isDefault: false,
    },
  });
  await prisma.moneyAccount.create({
    data: {
      companyId: company.id,
      type: "CASH",
      code: "KASA",
      name: "Kasa",
      balance: 0,
    },
  });
  await prisma.moneyAccount.create({
    data: {
      companyId: company.id,
      type: "BANK",
      code: "BNK",
      name: "Banka",
      balance: kurus("100000"),
    },
  });
  const actor: Actor = { companyId: company.id, role: "ADMIN", userId: null };
  return { company, warehouse, warehouse2, actor };
}

async function customer(actor: Actor, name = "Test Market") {
  return withTx((tx) => createParty(tx, actor, { type: "CUSTOMER", name, city: "İstanbul" }));
}

async function supplier(actor: Actor, name = "Test Tedarikçi") {
  return withTx((tx) => createParty(tx, actor, { type: "SUPPLIER", name, city: "Konya" }));
}

async function product(actor: Actor, sku: string, opening: string, warehouseId: string, vatRate = 20) {
  return withTx((tx) =>
    createProduct(tx, actor, {
      sku,
      name: "Test Ürün",
      unit: "Adet",
      salePrice: kurus("50"),
      purchasePrice: kurus("30"),
      vatRate,
      minStock: 0,
      openingStock: milli(opening),
      openingWarehouseId: warehouseId,
      openingDate: date,
    }),
  );
}

describe("KDV hesapları", () => {
  it("satır net + KDV = brüt", () => {
    const line = pricedLine({
      quantity: milli("10"),
      unitPrice: kurus("100"),
      vatRate: 20,
    });
    expect(line.lineNet).toBe(kurus("1000"));
    expect(line.vatAmount).toBe(vatOnNet(kurus("1000"), 20));
    expect(line.lineTotal).toBe(kurus("1200"));
  });

  it("satış faturasında KDV toplamı doğru ve alacak brüt tutardır", async () => {
    const { actor, warehouse } = await companySetup();
    const party = await customer(actor);
    const item = await product(actor, "KDV-1", "100", warehouse.id, 20);
    const order = await withTx((tx) =>
      createSalesOrder(tx, actor, {
        partyId: party.id,
        warehouseId: warehouse.id,
        date,
        lines: [{ productId: item.id, quantity: milli("10"), unitPrice: kurus("50"), vatRate: 20 }],
      }),
    );
    await withTx((tx) => confirmSalesOrder(tx, actor, order.id));
    const invoice = await withTx((tx) =>
      invoiceSalesOrder(tx, actor, order.id, { date, dueDate: due }),
    );
    expect(invoice.subtotal).toBe(kurus("500"));
    expect(invoice.vatTotal).toBe(kurus("100"));
    expect(invoice.total).toBe(kurus("600"));
    expect(await customerReceivable(db(), party.id)).toBe(kurus("600"));
  });
});

describe("stok rezervasyonu", () => {
  it("onayda rezerve eder, faturada düşer, iptalde serbest bırakır", async () => {
    const { actor, warehouse } = await companySetup();
    const party = await customer(actor);
    const item = await product(actor, "RZV-1", "20", warehouse.id);
    const order = await withTx((tx) =>
      createSalesOrder(tx, actor, {
        partyId: party.id,
        warehouseId: warehouse.id,
        date,
        lines: [{ productId: item.id, quantity: milli("5"), unitPrice: kurus("50") }],
      }),
    );
    await withTx((tx) => confirmSalesOrder(tx, actor, order.id));
    let fresh = await prisma.product.findUniqueOrThrow({ where: { id: item.id } });
    expect(fresh.stockOnHand).toBe(milli("20"));
    expect(fresh.stockReserved).toBe(milli("5"));
    const wh = await prisma.warehouseStock.findUniqueOrThrow({
      where: { warehouseId_productId: { warehouseId: warehouse.id, productId: item.id } },
    });
    expect(wh.reserved).toBe(milli("5"));

    await withTx((tx) => invoiceSalesOrder(tx, actor, order.id, { date, dueDate: due }));
    fresh = await prisma.product.findUniqueOrThrow({ where: { id: item.id } });
    expect(fresh.stockOnHand).toBe(milli("15"));
    expect(fresh.stockReserved).toBe(0);
  });
});

describe("satış iadesi", () => {
  it("stoğu geri alır ve bakiyeyi düşürür", async () => {
    const { actor, warehouse } = await companySetup();
    const party = await customer(actor);
    const item = await product(actor, "IAD-1", "30", warehouse.id);
    const order = await withTx((tx) =>
      createSalesOrder(tx, actor, {
        partyId: party.id,
        warehouseId: warehouse.id,
        date,
        lines: [{ productId: item.id, quantity: milli("10"), unitPrice: kurus("50"), vatRate: 20 }],
      }),
    );
    await withTx((tx) => confirmSalesOrder(tx, actor, order.id));
    const invoice = await withTx((tx) =>
      invoiceSalesOrder(tx, actor, order.id, { date, dueDate: due }),
    );
    expect(await customerReceivable(db(), party.id)).toBe(kurus("600"));
    await withTx((tx) => createSalesReturn(tx, actor, invoice.id, { date }));
    const fresh = await prisma.product.findUniqueOrThrow({ where: { id: item.id } });
    expect(fresh.stockOnHand).toBe(milli("30"));
    expect(await customerReceivable(db(), party.id)).toBe(0);
  });
});

describe("çoklu depo", () => {
  it("transfer kaynak stoğu düşürür hedefi artırır", async () => {
    const { actor, warehouse, warehouse2 } = await companySetup();
    const item = await product(actor, "DEP-1", "40", warehouse.id);
    await withTx((tx) =>
      transferStock(tx, actor, {
        fromWarehouseId: warehouse.id,
        toWarehouseId: warehouse2.id,
        date,
        lines: [{ productId: item.id, quantity: milli("12") }],
      }),
    );
    const from = await prisma.warehouseStock.findUniqueOrThrow({
      where: { warehouseId_productId: { warehouseId: warehouse.id, productId: item.id } },
    });
    const to = await prisma.warehouseStock.findUniqueOrThrow({
      where: { warehouseId_productId: { warehouseId: warehouse2.id, productId: item.id } },
    });
    expect(from.onHand).toBe(milli("28"));
    expect(to.onHand).toBe(milli("12"));
    const prod = await prisma.product.findUniqueOrThrow({ where: { id: item.id } });
    expect(prod.stockOnHand).toBe(milli("40"));
  });
});

describe("alış faturası ve mal kabul ayrımı", () => {
  it("mal kabul stok artırır, borç alış faturasıyla açılır", async () => {
    const { actor, warehouse } = await companySetup();
    const party = await supplier(actor);
    const item = await product(actor, "ALS-1", "0", warehouse.id);
    const order = await withTx((tx) =>
      createPurchaseOrder(tx, actor, {
        partyId: party.id,
        warehouseId: warehouse.id,
        date,
        lines: [{ productId: item.id, quantity: milli("20"), unitPrice: kurus("8"), vatRate: 20 }],
      }),
    );
    await withTx((tx) => confirmPurchaseOrder(tx, actor, order.id));
    const receipt = await withTx((tx) =>
      receivePurchaseOrder(tx, actor, order.id, { date }),
    );
    const fresh = await prisma.product.findUniqueOrThrow({ where: { id: item.id } });
    expect(fresh.stockOnHand).toBe(milli("20"));
    expect(await supplierPayable(db(), party.id)).toBe(0);

    const invoice = await withTx((tx) =>
      createPurchaseInvoiceFromReceipt(tx, actor, receipt.id, { date, dueDate: due }),
    );
    // 20 * 8 = 160 net + %20 KDV 32 = 192
    expect(invoice.subtotal).toBe(kurus("160"));
    expect(invoice.vatTotal).toBe(kurus("32"));
    expect(invoice.total).toBe(kurus("192"));
    expect(await supplierPayable(db(), party.id)).toBe(kurus("192"));
  });
});

describe("tahsilat ve ödeme", () => {
  it("alacağı düşürür ve açık tutarın üstüne çıkamaz", async () => {
    const { actor, warehouse } = await companySetup();
    const party = await customer(actor);
    const item = await product(actor, "THS-1", "20", warehouse.id);
    const order = await withTx((tx) =>
      createSalesOrder(tx, actor, {
        partyId: party.id,
        warehouseId: warehouse.id,
        date,
        lines: [{ productId: item.id, quantity: milli("10"), unitPrice: kurus("50"), vatRate: 20 }],
      }),
    );
    await withTx((tx) => confirmSalesOrder(tx, actor, order.id));
    const invoice = await withTx((tx) =>
      invoiceSalesOrder(tx, actor, order.id, { date, dueDate: due }),
    );

    await withTx((tx) =>
      createCollection(tx, actor, {
        partyId: party.id,
        date,
        method: "BANK",
        amount: kurus("200"),
        allocations: [{ documentId: invoice.id, amount: kurus("200") }],
      }),
    );

    expect(await customerReceivable(db(), party.id)).toBe(kurus("400"));
    await expect(
      withTx((tx) =>
        createCollection(tx, actor, {
          partyId: party.id,
          date,
          method: "CASH",
          amount: kurus("500"),
          allocations: [{ documentId: invoice.id, amount: kurus("500") }],
        }),
      ),
    ).rejects.toThrow(/açık tutarı aşıyor/);
  });

  it("tedarikçi ödemesi alış faturasına uygulanır", async () => {
    const { actor, warehouse } = await companySetup();
    const party = await supplier(actor);
    const item = await product(actor, "ODM-1", "0", warehouse.id);
    const order = await withTx((tx) =>
      createPurchaseOrder(tx, actor, {
        partyId: party.id,
        warehouseId: warehouse.id,
        date,
        lines: [{ productId: item.id, quantity: milli("20"), unitPrice: kurus("8"), vatRate: 20 }],
      }),
    );
    await withTx((tx) => confirmPurchaseOrder(tx, actor, order.id));
    const receipt = await withTx((tx) => receivePurchaseOrder(tx, actor, order.id, { date }));
    const invoice = await withTx((tx) =>
      createPurchaseInvoiceFromReceipt(tx, actor, receipt.id, { date, dueDate: due }),
    );

    await expect(
      withTx((tx) =>
        createSupplierPayment(tx, actor, {
          partyId: party.id,
          date,
          method: "BANK",
          amount: kurus("200"),
          allocations: [{ documentId: invoice.id, amount: kurus("200") }],
        }),
      ),
    ).rejects.toThrow(/açık tutarı aşıyor/);

    expect(await supplierPayable(db(), party.id)).toBe(kurus("192"));
  });
});

describe("alış iadesi", () => {
  it("stoğu düşürür", async () => {
    const { actor, warehouse } = await companySetup();
    const party = await supplier(actor);
    const item = await product(actor, "AIR-1", "0", warehouse.id);
    const order = await withTx((tx) =>
      createPurchaseOrder(tx, actor, {
        partyId: party.id,
        warehouseId: warehouse.id,
        date,
        lines: [{ productId: item.id, quantity: milli("10"), unitPrice: kurus("10"), vatRate: 10 }],
      }),
    );
    await withTx((tx) => confirmPurchaseOrder(tx, actor, order.id));
    const receipt = await withTx((tx) => receivePurchaseOrder(tx, actor, order.id, { date }));
    const invoice = await withTx((tx) =>
      createPurchaseInvoiceFromReceipt(tx, actor, receipt.id, { date, dueDate: due }),
    );
    await withTx((tx) => createPurchaseReturn(tx, actor, invoice.id, { date }));
    const fresh = await prisma.product.findUniqueOrThrow({ where: { id: item.id } });
    expect(fresh.stockOnHand).toBe(0);
  });
});
