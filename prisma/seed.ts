import bcrypt from "bcryptjs";
import { DEMO_EMAIL, DEMO_NAME, DEMO_PASSWORD } from "../src/lib/demo";
import { todayInput } from "../src/lib/dates";
import { prisma } from "../src/server/db";
import {
  cancelPurchaseOrder,
  cancelSalesOrder,
  confirmPurchaseOrder,
  confirmSalesOrder,
  createCollection,
  createDeliveryNote,
  createParty,
  createProduct,
  createPurchaseInvoiceFromReceipt,
  createPurchaseOrder,
  createSalesOrder,
  createSupplierPayment,
  invoiceSalesOrder,
  postManualMovement,
  receivePurchaseOrder,
  transferStock,
  type Actor,
} from "../src/server/ledger";
import {
  completeWorkOrder,
  createBom,
  createCheckNote,
  createEmployee,
  createLead,
  createLeaveRequest,
  createOpportunity,
  createOutgoingEInvoice,
  createWorkOrder,
  seedChartOfAccounts,
} from "../src/server/modules";
import { kurus, milli } from "../src/server/money";

function day(offset: number) {
  const [year, month, date] = todayInput().split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date + offset, 12));
}

const k = (value: string) => kurus(value);
const q = (value: string) => milli(value);

async function main() {
  const existing = await prisma.user.count();
  if (existing > 0) {
    console.log("Veritabanında kayıt var, tohum atlandı.");
    return;
  }

  await prisma.$transaction(
    async (tx) => {
      const yagmur = await tx.company.create({
        data: {
          code: "YGM",
          name: "Yağmur Gıda Ticaret",
          shortName: "Yağmur",
          taxNumber: "8450123456",
          city: "İstanbul",
        },
      });

      const deneme = await tx.company.create({
        data: {
          code: "DNM",
          name: "Deneme Gıda Ltd",
          shortName: "Deneme",
          taxNumber: "1112223344",
          city: "Ankara",
        },
      });

      const user = await tx.user.create({
        data: {
          email: DEMO_EMAIL,
          name: DEMO_NAME,
          passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10),
          memberships: {
            create: [
              { companyId: yagmur.id, role: "ADMIN" },
              { companyId: deneme.id, role: "ADMIN" },
            ],
          },
        },
      });

      const actor: Actor = {
        userId: user.id,
        companyId: yagmur.id,
        role: "ADMIN" as const,
      };
      const denemeActor: Actor = {
        userId: user.id,
        companyId: deneme.id,
        role: "ADMIN" as const,
      };

      // ——— Yağmur: chart, warehouses, money, FX ———
      await seedChartOfAccounts(tx, yagmur.id);

      const merkez = await tx.warehouse.create({
        data: {
          companyId: yagmur.id,
          code: "MERKEZ",
          name: "Merkez Depo",
          isDefault: true,
        },
      });
      const antalya = await tx.warehouse.create({
        data: {
          companyId: yagmur.id,
          code: "ANTALYA",
          name: "Antalya Depo",
          isDefault: false,
        },
      });

      const kasa = await tx.moneyAccount.create({
        data: {
          companyId: yagmur.id,
          type: "CASH",
          code: "KASA",
          name: "Kasa",
          balance: k("50000"),
        },
      });
      const garanti = await tx.moneyAccount.create({
        data: {
          companyId: yagmur.id,
          type: "BANK",
          code: "GARANTI",
          name: "Garanti Bankası",
          balance: k("2000000"),
        },
      });
      void kasa;

      await tx.currencyRate.create({
        data: {
          companyId: yagmur.id,
          code: "TRY",
          name: "Türk Lirası",
          rateToTry: 100,
          asOfDate: day(0),
        },
      });
      await tx.currencyRate.create({
        data: {
          companyId: yagmur.id,
          code: "USD",
          name: "ABD Doları",
          rateToTry: 345000,
          asOfDate: day(0),
        },
      });

      const customers = {
        marmara: await createParty(tx, actor, {
          type: "CUSTOMER",
          code: "C-0001",
          name: "Marmara Market A.Ş.",
          taxNumber: "8450011122",
          taxOffice: "Kadıköy",
          phone: "0216 555 01 01",
          email: "satinalma@marmaramarket.example",
          city: "İstanbul",
          address: "Caferağa Mah. Moda Cad. No: 14 Kadıköy",
        }),
        ege: await createParty(tx, actor, {
          type: "CUSTOMER",
          code: "C-0002",
          name: "Ege Gross Marketcilik Ltd. Şti.",
          taxNumber: "3760092211",
          taxOffice: "Bornova",
          phone: "0232 555 02 02",
          email: "depo@egegross.example",
          city: "İzmir",
          address: "Kazımdirik Mah. Ankara Cad. No: 88 Bornova",
        }),
        baskent: await createParty(tx, actor, {
          type: "CUSTOMER",
          code: "C-0003",
          name: "Başkent Bakkalcılık A.Ş.",
          taxNumber: "0690123456",
          taxOffice: "Çankaya",
          phone: "0312 555 03 03",
          city: "Ankara",
          address: "Kızılırmak Mah. Dumlupınar Blv. No: 3 Çankaya",
        }),
        karadeniz: await createParty(tx, actor, {
          type: "CUSTOMER",
          code: "C-0004",
          name: "Karadeniz Toptan Gıda Ltd. Şti.",
          taxNumber: "6120448890",
          taxOffice: "Ortahisar",
          phone: "0462 555 04 04",
          city: "Trabzon",
          address: "Kemerkaya Mah. Uzun Sok. No: 7 Ortahisar",
        }),
        bursa: await createParty(tx, actor, {
          type: "CUSTOMER",
          code: "C-0005",
          name: "Bursa Lezzet Lokantaları",
          taxNumber: "1780556677",
          taxOffice: "Nilüfer",
          phone: "0224 555 05 05",
          city: "Bursa",
          address: "Odunluk Mah. Akpınar Cad. No: 21 Nilüfer",
        }),
        kapadokya: await createParty(tx, actor, {
          type: "CUSTOMER",
          code: "C-0006",
          name: "Kapadokya Market",
          taxNumber: "5090332211",
          taxOffice: "Nevşehir",
          phone: "0384 555 06 06",
          city: "Nevşehir",
          address: "Yeni Mah. Atatürk Blv. No: 40",
        }),
      };

      const suppliers = {
        trakya: await createParty(tx, actor, {
          type: "SUPPLIER",
          code: "T-0001",
          name: "Trakya Un ve Yem Sanayi A.Ş.",
          taxNumber: "8590441100",
          taxOffice: "Çorlu",
          phone: "0282 555 11 11",
          city: "Tekirdağ",
          address: "Kazımiye OSB 4. Cad. No: 9 Çorlu",
        }),
        ayvalik: await createParty(tx, actor, {
          type: "SUPPLIER",
          code: "T-0002",
          name: "Ayvalık Zeytin Kooperatifi",
          taxNumber: "1180667788",
          taxOffice: "Ayvalık",
          phone: "0266 555 12 12",
          city: "Balıkesir",
          address: "Fevzipaşa Mah. Barbaros Cad. No: 2 Ayvalık",
        }),
        mersin: await createParty(tx, actor, {
          type: "SUPPLIER",
          code: "T-0003",
          name: "Mersin Bakliyat Ticaret Ltd. Şti.",
          taxNumber: "6200778899",
          taxOffice: "Akdeniz",
          phone: "0324 555 13 13",
          city: "Mersin",
          address: "İhsaniye Mah. İsmet İnönü Blv. No: 55",
        }),
        konya: await createParty(tx, actor, {
          type: "SUPPLIER",
          code: "T-0004",
          name: "Konya Süt ve Peynir Ürünleri",
          taxNumber: "5410889900",
          taxOffice: "Selçuklu",
          phone: "0332 555 14 14",
          city: "Konya",
          address: "Horozluhan Mah. Yeni Sanayi No: 18 Selçuklu",
        }),
        rize: await createParty(tx, actor, {
          type: "SUPPLIER",
          code: "T-0005",
          name: "Doğu Karadeniz Çay A.Ş.",
          taxNumber: "7340990011",
          taxOffice: "Rize",
          phone: "0464 555 15 15",
          city: "Rory",
          address: "Müftü Mah. Çaykur Cad. No: 6",
        }),
      };

      const specs = [
        ["YAG-5L", "Ayçiçek yağı 5 L", "Adet", "289.90", "214.50", "20", "20", "8690001001", false],
        ["PRC-25", "Baldo pirinç 25 kg", "Çuval", "945.00", "760.00", "10", "20", "8690001002", false],
        ["UN-550", "Un tip 550 50 kg", "Çuval", "810.00", "635.00", "8", "20", "8690001003", false],
        ["MER-1", "Kırmızı mercimek 1 kg", "Koli", "68.50", "44.00", "40", "20", "8690001004", false],
        ["ZEY-1L", "Sızma zeytinyağı 1 L", "Adet", "349.00", "265.00", "12", "20", "8690001005", false],
        ["SEK-25", "Toz şeker 25 kg", "Çuval", "715.00", "560.00", "8", "20", "8690001006", false],
        ["MAK-500", "Spagetti 500 g", "Koli", "186.00", "124.00", "30", "20", "8690001007", false],
        ["SAL-830", "Domates salçası 830 g", "Koli", "432.00", "298.00", "20", "20", "8690001008", false],
        ["PEY-1", "Tam yağlı beyaz peynir 1 kg", "Kg", "248.00", "176.00", "10", "20", "8690001009", true],
        ["CAY-1", "Rory filiz çayı 1 kg", "Kg", "172.00", "118.00", "15", "1", "8690001010", false],
      ] as const;

      const products: Record<string, { id: string }> = {};
      for (const [sku, name, unit, sale, buy, min, vat, barcode, trackLot] of specs) {
        products[sku] = await createProduct(tx, actor, {
          sku,
          name,
          unit,
          salePrice: k(sale),
          purchasePrice: k(buy),
          minStock: q(min),
          vatRate: Number(vat),
          barcode,
          trackLot,
          openingStock: q(min),
          openingWarehouseId: merkez.id,
          openingDate: day(-60),
        });
      }

      const mix = await createProduct(tx, actor, {
        sku: "MIX-1",
        name: "Haftalık karışık paket",
        unit: "Paket",
        salePrice: k("420.00"),
        purchasePrice: k("280.00"),
        minStock: q("5"),
        vatRate: 20,
        barcode: "8690001011",
        openingStock: 0,
        openingWarehouseId: merkez.id,
      });
      products["MIX-1"] = mix;

      const PEY_LOT = "LOT-PEY-2501";

      const line = (
        sku: string,
        quantity: string,
        price: string,
        lotCode?: string,
      ) => ({
        productId: products[sku].id,
        quantity: q(quantity),
        unitPrice: k(price),
        ...(lotCode ? { lotCode } : {}),
      });

      async function purchase(
        supplierId: string,
        date: Date,
        lines: {
          productId: string;
          quantity: number;
          unitPrice: number;
          lotCode?: string;
        }[],
        notes?: string,
      ) {
        const order = await createPurchaseOrder(tx, actor, {
          partyId: supplierId,
          warehouseId: merkez.id,
          date,
          lines,
          notes,
        });
        await confirmPurchaseOrder(tx, actor, order.id);
        return order;
      }

      async function receiveAndInvoice(
        orderId: string,
        receiveDate: Date,
        dueDate: Date,
        notes?: string,
      ) {
        const receipt = await receivePurchaseOrder(tx, actor, orderId, {
          date: receiveDate,
          notes,
        });
        return createPurchaseInvoiceFromReceipt(tx, actor, receipt.id, {
          date: receiveDate,
          dueDate,
          notes,
        });
      }

      const poAyvalik = await purchase(
        suppliers.ayvalik.id,
        day(-40),
        [line("YAG-5L", "100", "214.50"), line("ZEY-1L", "80", "265.00")],
        "Sezonluk yağ alımı",
      );
      const invAyvalik = await receiveAndInvoice(poAyvalik.id, day(-38), day(-10));

      const poTrakya = await purchase(suppliers.trakya.id, day(-35), [
        line("UN-550", "40", "635.00"),
        line("SEK-25", "36", "560.00"),
      ]);
      const invTrakya = await receiveAndInvoice(poTrakya.id, day(-33), day(-5));

      const poMersin = await purchase(suppliers.mersin.id, day(-28), [
        line("PRC-25", "50", "760.00"),
        line("MER-1", "240", "44.00"),
        line("MAK-500", "180", "124.00"),
        line("SAL-830", "90", "298.00"),
      ]);
      const invMersin = await receiveAndInvoice(poMersin.id, day(-26), day(10));

      const poKonya = await purchase(
        suppliers.konya.id,
        day(-20),
        [line("PEY-1", "60", "176.00", PEY_LOT)],
        "Soğuk zincir",
      );
      const invKonya = await receiveAndInvoice(poKonya.id, day(-18), day(5));

      const poRize = await purchase(suppliers.rize.id, day(-12), [
        line("CAY-1", "70", "118.00"),
      ]);
      await receiveAndInvoice(poRize.id, day(-11), day(18));

      const poOpen = await purchase(
        suppliers.trakya.id,
        day(-2),
        [line("UN-550", "15", "635.00")],
        "Ek un siparişi, henüz sevk edilmedi",
      );
      void poOpen;

      const poDraft = await createPurchaseOrder(tx, actor, {
        partyId: suppliers.mersin.id,
        warehouseId: merkez.id,
        date: day(0),
        notes: "Fiyat teyidi bekleniyor",
        lines: [line("PRC-25", "10", "760.00")],
      });
      void poDraft;

      const poCancel = await createPurchaseOrder(tx, actor, {
        partyId: suppliers.ayvalik.id,
        warehouseId: merkez.id,
        date: day(-15),
        lines: [line("ZEY-1L", "20", "265.00")],
      });
      await cancelPurchaseOrder(tx, actor, poCancel.id);

      const priceList = await tx.priceList.create({
        data: {
          companyId: yagmur.id,
          code: "PERAKENDE",
          name: "Perakende liste",
          items: {
            create: [
              { productId: products["YAG-5L"].id, unitPrice: k("279.90") },
              { productId: products["ZEY-1L"].id, unitPrice: k("339.00") },
              { productId: products["CAY-1"].id, unitPrice: k("165.00") },
            ],
          },
        },
      });

      const discountTpl = await tx.discountTemplate.create({
        data: {
          companyId: yagmur.id,
          code: "IND5",
          name: "%5 peşin indirim",
          percentBps: 500,
        },
      });

      async function sell(
        customerId: string,
        date: Date,
        lines: {
          productId: string;
          quantity: number;
          unitPrice: number;
          lotCode?: string;
        }[],
        due: Date,
        notes?: string,
        extras?: { priceListId?: string; discountTemplateId?: string },
      ) {
        const order = await createSalesOrder(tx, actor, {
          partyId: customerId,
          warehouseId: merkez.id,
          date,
          lines,
          notes,
          priceListId: extras?.priceListId,
          discountTemplateId: extras?.discountTemplateId,
        });
        await confirmSalesOrder(tx, actor, order.id);
        return invoiceSalesOrder(tx, actor, order.id, { date, dueDate: due, notes });
      }

      const marmaraInvoice = await sell(
        customers.marmara.id,
        day(-18),
        [
          line("YAG-5L", "24", "289.90"),
          line("PRC-25", "8", "945.00"),
          line("CAY-1", "10", "172.00"),
        ],
        day(-4),
        "Kadıköy depo teslimatı",
      );

      const paidInvoice = await sell(
        customers.ege.id,
        day(-14),
        [
          line("MER-1", "80", "68.50"),
          line("MAK-500", "40", "186.00"),
          line("SAL-830", "20", "432.00"),
        ],
        day(16),
      );

      const partialInvoice = await sell(
        customers.baskent.id,
        day(-9),
        [
          line("YAG-5L", "16", "289.90"),
          line("ZEY-1L", "18", "349.00"),
          line("UN-550", "10", "810.00"),
        ],
        day(6),
        undefined,
        { priceListId: priceList.id, discountTemplateId: discountTpl.id },
      );

      await sell(
        customers.karadeniz.id,
        day(-6),
        [
          line("SEK-25", "12", "715.00"),
          line("PEY-1", "20", "248.00", PEY_LOT),
          line("UN-550", "8", "810.00"),
        ],
        day(-1),
      );

      await sell(
        customers.bursa.id,
        day(-2),
        [
          line("MAK-500", "25", "186.00"),
          line("SAL-830", "15", "432.00"),
          line("PEY-1", "12", "248.00", PEY_LOT),
          line("MER-1", "30", "68.50"),
        ],
        day(20),
      );

      const confirmed = await createSalesOrder(tx, actor, {
        partyId: customers.ege.id,
        warehouseId: merkez.id,
        date: day(0),
        notes: "Yarın sevk, henüz faturalanmadı",
        lines: [line("CAY-1", "12", "172.00"), line("ZEY-1L", "10", "349.00")],
      });
      await confirmSalesOrder(tx, actor, confirmed.id);

      await createSalesOrder(tx, actor, {
        partyId: customers.kapadokya.id,
        warehouseId: merkez.id,
        date: day(0),
        notes: "Müşteri onayı bekleniyor",
        lines: [line("PRC-25", "4", "945.00"), line("YAG-5L", "6", "289.90")],
      });

      const cancelled = await createSalesOrder(tx, actor, {
        partyId: customers.marmara.id,
        warehouseId: merkez.id,
        date: day(-10),
        lines: [line("UN-550", "6", "810.00")],
      });
      await cancelSalesOrder(tx, actor, cancelled.id);

      await createCollection(tx, actor, {
        partyId: customers.ege.id,
        date: day(-7),
        method: "BANK",
        amount: paidInvoice.total,
        notes: "EFT ile kapandı",
        moneyAccountId: garanti.id,
        allocations: [{ documentId: paidInvoice.id, amount: paidInvoice.total }],
      });
      await createCollection(tx, actor, {
        partyId: customers.baskent.id,
        date: day(-3),
        method: "CHECK",
        amount: k("8000"),
        notes: "Çek, bakiye açık",
        moneyAccountId: garanti.id,
        allocations: [{ documentId: partialInvoice.id, amount: k("8000") }],
      });

      await createSupplierPayment(tx, actor, {
        partyId: suppliers.ayvalik.id,
        date: day(-9),
        method: "BANK",
        amount: invAyvalik.total,
        moneyAccountId: garanti.id,
        allocations: [{ documentId: invAyvalik.id, amount: invAyvalik.total }],
      });
      await createSupplierPayment(tx, actor, {
        partyId: suppliers.konya.id,
        date: day(-8),
        method: "BANK",
        amount: invKonya.total,
        moneyAccountId: garanti.id,
        allocations: [{ documentId: invKonya.id, amount: invKonya.total }],
      });
      await createSupplierPayment(tx, actor, {
        partyId: suppliers.mersin.id,
        date: day(-4),
        method: "BANK",
        amount: k("40000"),
        notes: "Kısmi havale",
        moneyAccountId: garanti.id,
        allocations: [{ documentId: invMersin.id, amount: k("40000") }],
      });
      void invTrakya;

      const peynir = await tx.product.findUniqueOrThrow({
        where: { companyId_sku: { companyId: yagmur.id, sku: "PEY-1" } },
      });
      await postManualMovement(tx, actor, {
        productId: peynir.id,
        warehouseId: merkez.id,
        kind: "OUT",
        quantity: q("3"),
        date: day(-1),
        note: "Soğuk hava firesi",
        lotCode: PEY_LOT,
      });
      const un = await tx.product.findUniqueOrThrow({
        where: { companyId_sku: { companyId: yagmur.id, sku: "UN-550" } },
      });
      await postManualMovement(tx, actor, {
        productId: un.id,
        warehouseId: merkez.id,
        kind: "ADJUSTMENT",
        quantity: un.stockOnHand - q("4"),
        date: day(0),
        note: "Depo sayımı, 4 çuval eksik",
      });

      await tx.product.update({
        where: { id: products["UN-550"].id },
        data: { minStock: q("25") },
      });
      await tx.product.update({
        where: { id: products["SEK-25"].id },
        data: { minStock: q("30") },
      });

      await createDeliveryNote(tx, actor, {
        direction: "SALES",
        partyId: customers.marmara.id,
        warehouseId: merkez.id,
        date: day(-17),
        salesInvoiceId: marmaraInvoice.id,
        notes: "Marmara sevkiyat irsaliyesi",
        lines: [
          { productId: products["YAG-5L"].id, quantity: q("24") },
          { productId: products["PRC-25"].id, quantity: q("8") },
          { productId: products["CAY-1"].id, quantity: q("10") },
        ],
      });

      await transferStock(tx, actor, {
        fromWarehouseId: merkez.id,
        toWarehouseId: antalya.id,
        date: day(-5),
        notes: "Antalya şube stok takviyesi",
        lines: [
          { productId: products["YAG-5L"].id, quantity: q("15") },
          { productId: products["PRC-25"].id, quantity: q("5") },
          { productId: products["ZEY-1L"].id, quantity: q("8") },
        ],
      });

      await createCheckNote(tx, actor, {
        kind: "CHECK",
        partyId: customers.baskent.id,
        moneyAccountId: garanti.id,
        dueDate: day(25),
        amount: k("8000"),
        bankName: "Ziraat Bankası",
        serialNo: "CK-2026-0042",
        notes: "Başkent kısmi tahsilat çeki",
      });

      const bom = await createBom(tx, actor, {
        code: "BOM-MIX",
        name: "Karışık paket reçetesi",
        finishedProductId: mix.id,
        outputQty: q("1"),
        lines: [
          { productId: products["MER-1"].id, quantity: q("2") },
          { productId: products["MAK-500"].id, quantity: q("1") },
          { productId: products["CAY-1"].id, quantity: q("1") },
        ],
      });
      const workOrder = await createWorkOrder(tx, actor, {
        bomId: bom.id,
        warehouseId: merkez.id,
        quantity: q("5"),
        date: day(-3),
        notes: "Demo karışık paket üretimi",
      });
      await completeWorkOrder(tx, actor, workOrder.id);

      const depoDept = await tx.department.create({
        data: {
          companyId: yagmur.id,
          code: "DEPO",
          name: "Depo ve Lojistik",
        },
      });
      const satisDept = await tx.department.create({
        data: {
          companyId: yagmur.id,
          code: "SATIS",
          name: "Satış",
        },
      });

      const emp1 = await createEmployee(tx, actor, {
        code: "P-001",
        name: "Mehmet Yıldız",
        departmentId: depoDept.id,
        title: "Depo sorumlusu",
        phone: "0532 555 20 01",
        hireDate: day(-400),
      });
      await createEmployee(tx, actor, {
        code: "P-002",
        name: "Zeynep Kara",
        departmentId: satisDept.id,
        title: "Satış temsilcisi",
        email: "zeynep@yagmurgida.example",
        hireDate: day(-200),
      });
      await createEmployee(tx, actor, {
        code: "P-003",
        name: "Ali Çelik",
        departmentId: depoDept.id,
        title: "Sevkiyat elemanı",
        hireDate: day(-90),
      });

      await createLeaveRequest(tx, actor, {
        employeeId: emp1.id,
        startDate: day(5),
        endDate: day(9),
        days: 5,
        reason: "Yıllık izin",
      });

      const lead1 = await createLead(tx, actor, {
        name: "Selin Aksoy",
        companyName: "Aksoy Marketler",
        phone: "0533 555 30 01",
        email: "selin@aksoymarket.example",
        source: "Fuar",
        notes: "Anadolu yakası zinciri",
      });
      const lead2 = await createLead(tx, actor, {
        name: "Hakan Demir",
        companyName: "Demir Gıda Toptan",
        phone: "0532 555 30 02",
        source: "Referans",
        partyId: customers.kapadokya.id,
      });

      await createOpportunity(tx, actor, {
        title: "Aksoy aylık yağ anlaşması",
        amount: k("85000"),
        stage: "PROPOSAL",
        leadId: lead1.id,
        expectedClose: day(30),
      });
      await createOpportunity(tx, actor, {
        title: "Kapadokya sezonluk stok",
        amount: k("42000"),
        stage: "NEGOTIATION",
        leadId: lead2.id,
        partyId: customers.kapadokya.id,
        expectedClose: day(14),
      });

      await createOutgoingEInvoice(tx, actor, paidInvoice.id);

      // ——— Deneme: light demo ———
      await seedChartOfAccounts(tx, deneme.id);

      const denemeWh = await tx.warehouse.create({
        data: {
          companyId: deneme.id,
          code: "MERKEZ",
          name: "Merkez Depo",
          isDefault: true,
        },
      });

      await tx.moneyAccount.create({
        data: {
          companyId: deneme.id,
          type: "CASH",
          code: "KASA",
          name: "Kasa",
          balance: k("10000"),
        },
      });

      await createParty(tx, denemeActor, {
        type: "CUSTOMER",
        code: "C-0001",
        name: "Deneme Market",
        city: "Ankara",
        phone: "0312 555 99 99",
      });

      await createProduct(tx, denemeActor, {
        sku: "DNM-1",
        name: "Deneme ürün 1 kg",
        unit: "Kg",
        salePrice: k("50.00"),
        purchasePrice: k("30.00"),
        minStock: q("5"),
        vatRate: 20,
        barcode: "8690009001",
        openingStock: q("25"),
        openingWarehouseId: denemeWh.id,
        openingDate: day(-7),
      });
    },
    { timeout: 180000 },
  );

  console.log("Demo verisi yüklendi.");
  console.log(`Giriş: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
