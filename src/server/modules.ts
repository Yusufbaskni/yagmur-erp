import { randomUUID } from "crypto";
import type { CheckNoteStatus } from "@prisma/client";
import { writeAudit } from "@/server/audit";
import type { Db } from "@/server/db";
import { ErpError } from "@/server/errors";
import type { Actor } from "@/server/ledger";
import { assertPermission } from "@/server/permissions";
import { applyStock } from "@/server/stock";

function clean(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
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

export async function seedChartOfAccounts(tx: Db, companyId: string) {
  const accounts = [
    ["100", "Kasa", "ASSET"],
    ["102", "Bankalar", "ASSET"],
    ["120", "Alıcılar", "ASSET"],
    ["153", "Ticari mallar", "ASSET"],
    ["191", "İndirilecek KDV", "ASSET"],
    ["320", "Satıcılar", "LIABILITY"],
    ["391", "Hesaplanan KDV", "LIABILITY"],
    ["600", "Yurtiçi satışlar", "REVENUE"],
    ["610", "Satıştan iadeler", "REVENUE"],
    ["150", "İlk madde ve malzeme", "ASSET"],
  ] as const;
  for (const [code, name, type] of accounts) {
    await tx.account.upsert({
      where: { companyId_code: { companyId, code } },
      create: { companyId, code, name, type },
      update: { name, type },
    });
  }
}

export async function createCheckNote(
  tx: Db,
  actor: Actor,
  input: {
    kind: "CHECK" | "PROMISSORY";
    partyId?: string | null;
    moneyAccountId?: string | null;
    dueDate: Date;
    amount: number;
    bankName?: string | null;
    serialNo?: string | null;
    notes?: string | null;
  },
) {
  assertPermission(actor.role, "finance");
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new ErpError("Çek/senet tutarı sıfırdan büyük olmalı.");
  }
  const number = await nextNumber(tx, actor.companyId, "CS", input.dueDate);
  return tx.checkNote.create({
    data: {
      companyId: actor.companyId,
      number,
      kind: input.kind,
      partyId: input.partyId ?? null,
      moneyAccountId: input.moneyAccountId ?? null,
      dueDate: input.dueDate,
      amount: input.amount,
      bankName: clean(input.bankName),
      serialNo: clean(input.serialNo),
      notes: clean(input.notes),
      status: "PORTFOLIO",
    },
  });
}

export async function updateCheckNoteStatus(
  tx: Db,
  actor: Actor,
  id: string,
  status: CheckNoteStatus,
) {
  assertPermission(actor.role, "finance");
  const note = await tx.checkNote.findFirst({
    where: { id, companyId: actor.companyId },
  });
  if (!note) throw new ErpError("Çek/senet bulunamadı.");
  if (note.status === status) return note;
  const updated = await tx.checkNote.update({ where: { id }, data: { status } });
  if (status === "COLLECTED" && note.moneyAccountId) {
    const account = await tx.moneyAccount.findUnique({ where: { id: note.moneyAccountId } });
    if (account) {
      await tx.moneyAccount.update({
        where: { id: account.id },
        data: { balance: account.balance + note.amount },
      });
      await tx.moneyMovement.create({
        data: {
          moneyAccountId: account.id,
          checkNoteId: note.id,
          type: "IN",
          amount: note.amount,
          signedAmount: note.amount,
          date: new Date(),
          note: `Çek/senet tahsil ${note.number}`,
        },
      });
    }
  }
  await writeAudit(tx, {
    companyId: actor.companyId,
    userId: actor.userId,
    action: "STATUS",
    entityType: "CheckNote",
    entityId: note.id,
    summary: `Çek/senet ${note.number}: ${note.status} → ${status}`,
  });
  return updated;
}

export async function createBom(
  tx: Db,
  actor: Actor,
  input: {
    code: string;
    name: string;
    finishedProductId: string;
    outputQty: number;
    lines: { productId: string; quantity: number }[];
  },
) {
  assertPermission(actor.role, "manufacturing");
  if (input.lines.length === 0) throw new ErpError("BOM satırı gerekli.");
  if (!Number.isInteger(input.outputQty) || input.outputQty <= 0) {
    throw new ErpError("Çıktı miktarı geçersiz.");
  }
  return tx.bom.create({
    data: {
      companyId: actor.companyId,
      code: input.code.trim().toUpperCase(),
      name: input.name.trim(),
      finishedProductId: input.finishedProductId,
      outputQty: input.outputQty,
      lines: {
        create: input.lines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
        })),
      },
    },
  });
}

export async function createWorkOrder(
  tx: Db,
  actor: Actor,
  input: {
    bomId: string;
    warehouseId: string;
    quantity: number;
    date: Date;
    notes?: string | null;
  },
) {
  assertPermission(actor.role, "manufacturing");
  const bom = await tx.bom.findFirst({
    where: { id: input.bomId, companyId: actor.companyId, active: true },
    include: { lines: true },
  });
  if (!bom) throw new ErpError("Ürün ağacı bulunamadı.");
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new ErpError("Üretim miktarı geçersiz.");
  }
  const number = await nextNumber(tx, actor.companyId, "IS", input.date);
  return tx.workOrder.create({
    data: {
      companyId: actor.companyId,
      number,
      bomId: bom.id,
      productId: bom.finishedProductId,
      warehouseId: input.warehouseId,
      quantity: input.quantity,
      status: "DRAFT",
      date: input.date,
      notes: clean(input.notes),
    },
  });
}

export async function completeWorkOrder(tx: Db, actor: Actor, id: string) {
  assertPermission(actor.role, "manufacturing");
  const wo = await tx.workOrder.findFirst({
    where: { id, companyId: actor.companyId },
    include: { bom: { include: { lines: true } } },
  });
  if (!wo) throw new ErpError("İş emri bulunamadı.");
  if (wo.status !== "DRAFT" && wo.status !== "RELEASED") {
    throw new ErpError("İş emri tamamlanamaz.");
  }
  const factor = wo.quantity / wo.bom.outputQty;
  for (const line of wo.bom.lines) {
    const qty = Math.round(line.quantity * factor);
    if (qty <= 0) continue;
    await applyStock(tx, {
      productId: line.productId,
      warehouseId: wo.warehouseId,
      signedQty: -qty,
      type: "PRODUCTION_OUT",
      date: wo.date,
      source: "WORK_ORDER",
      sourceId: wo.id,
      sourceLabel: wo.number,
      note: `Üretim tüketim ${wo.number}`,
    });
  }
  await applyStock(tx, {
    productId: wo.productId,
    warehouseId: wo.warehouseId,
    signedQty: wo.quantity,
    type: "PRODUCTION_IN",
    date: wo.date,
    source: "WORK_ORDER",
    sourceId: wo.id,
    sourceLabel: wo.number,
    note: `Üretim çıktı ${wo.number}`,
  });
  return tx.workOrder.update({ where: { id }, data: { status: "COMPLETED" } });
}

export async function createEmployee(
  tx: Db,
  actor: Actor,
  input: {
    code: string;
    name: string;
    departmentId?: string | null;
    title?: string | null;
    email?: string | null;
    phone?: string | null;
    hireDate?: Date | null;
  },
) {
  assertPermission(actor.role, "hr");
  return tx.employee.create({
    data: {
      companyId: actor.companyId,
      code: input.code.trim(),
      name: input.name.trim(),
      departmentId: input.departmentId ?? null,
      title: clean(input.title),
      email: clean(input.email),
      phone: clean(input.phone),
      hireDate: input.hireDate ?? null,
    },
  });
}

export async function createLeaveRequest(
  tx: Db,
  actor: Actor,
  input: {
    employeeId: string;
    startDate: Date;
    endDate: Date;
    days: number;
    reason?: string | null;
  },
) {
  assertPermission(actor.role, "hr");
  if (input.endDate < input.startDate) throw new ErpError("Bitiş tarihi başlangıçtan önce.");
  if (!Number.isInteger(input.days) || input.days <= 0) throw new ErpError("Gün sayısı geçersiz.");
  const employee = await tx.employee.findFirst({
    where: { id: input.employeeId, companyId: actor.companyId },
  });
  if (!employee) throw new ErpError("Çalışan bulunamadı.");
  return tx.leaveRequest.create({
    data: {
      companyId: actor.companyId,
      employeeId: employee.id,
      startDate: input.startDate,
      endDate: input.endDate,
      days: input.days,
      reason: clean(input.reason),
      status: "PENDING",
    },
  });
}

export async function setLeaveStatus(
  tx: Db,
  actor: Actor,
  id: string,
  status: "APPROVED" | "REJECTED",
) {
  assertPermission(actor.role, "hr");
  const leave = await tx.leaveRequest.findFirst({
    where: { id, companyId: actor.companyId },
  });
  if (!leave || leave.status !== "PENDING") throw new ErpError("İzin talebi güncellenemez.");
  return tx.leaveRequest.update({ where: { id }, data: { status } });
}

export async function createLead(
  tx: Db,
  actor: Actor,
  input: {
    name: string;
    companyName?: string | null;
    phone?: string | null;
    email?: string | null;
    source?: string | null;
    partyId?: string | null;
    notes?: string | null;
  },
) {
  assertPermission(actor.role, "crm");
  return tx.lead.create({
    data: {
      companyId: actor.companyId,
      name: input.name.trim(),
      companyName: clean(input.companyName),
      phone: clean(input.phone),
      email: clean(input.email),
      source: clean(input.source),
      partyId: input.partyId ?? null,
      notes: clean(input.notes),
      status: "NEW",
    },
  });
}

export async function createOpportunity(
  tx: Db,
  actor: Actor,
  input: {
    title: string;
    amount?: number;
    stage?: "QUALIFICATION" | "PROPOSAL" | "NEGOTIATION" | "WON" | "LOST";
    leadId?: string | null;
    partyId?: string | null;
    expectedClose?: Date | null;
    notes?: string | null;
  },
) {
  assertPermission(actor.role, "crm");
  return tx.opportunity.create({
    data: {
      companyId: actor.companyId,
      title: input.title.trim(),
      amount: input.amount ?? 0,
      stage: input.stage ?? "QUALIFICATION",
      leadId: input.leadId ?? null,
      partyId: input.partyId ?? null,
      expectedClose: input.expectedClose ?? null,
      notes: clean(input.notes),
    },
  });
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function createOutgoingEInvoice(
  tx: Db,
  actor: Actor,
  salesInvoiceId: string,
) {
  assertPermission(actor.role, "einvoice");
  const invoice = await tx.salesInvoice.findFirst({
    where: { id: salesInvoiceId, companyId: actor.companyId, isReturn: false },
    include: { party: true, lines: { include: { product: true } }, company: true },
  });
  if (!invoice) throw new ErpError("Satış faturası bulunamadı.");
  const existing = await tx.eInvoice.findFirst({
    where: { salesInvoiceId: invoice.id, status: { not: "REJECTED" } },
  });
  if (existing) throw new ErpError("Bu fatura için e-Fatura zaten var.");
  const number = await nextNumber(tx, actor.companyId, "EF", invoice.date);
  const uuid = randomUUID();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2">
  <cbc:UUID xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">${uuid}</cbc:UUID>
  <cbc:ID xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">${escapeXml(number)}</cbc:ID>
  <cbc:IssueDate xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">${invoice.date.toISOString().slice(0, 10)}</cbc:IssueDate>
  <cac:AccountingSupplierParty xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2">
    <cac:Party><cac:PartyName><cbc:Name xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">${escapeXml(invoice.company.name)}</cbc:Name></cac:PartyName></cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2">
    <cac:Party><cac:PartyName><cbc:Name xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">${escapeXml(invoice.party.name)}</cbc:Name></cac:PartyName></cac:Party>
  </cac:AccountingCustomerParty>
  <cbc:DocumentCurrencyCode xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">${escapeXml(invoice.currencyCode)}</cbc:DocumentCurrencyCode>
  <cac:LegalMonetaryTotal xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2">
    <cbc:TaxExclusiveAmount xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">${(invoice.subtotal / 100).toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">${(invoice.total / 100).toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">${(invoice.total / 100).toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
${invoice.lines
  .map(
    (line, i) => `  <cac:InvoiceLine xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2">
    <cbc:ID xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">${i + 1}</cbc:ID>
    <cbc:InvoicedQuantity xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">${(line.quantity / 1000).toFixed(3)}</cbc:InvoicedQuantity>
    <cac:Item><cbc:Name xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">${escapeXml(line.product.name)}</cbc:Name></cac:Item>
    <cac:Price><cbc:PriceAmount xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">${(line.unitPrice / 100).toFixed(2)}</cbc:PriceAmount></cac:Price>
  </cac:InvoiceLine>`,
  )
  .join("\n")}
</Invoice>`;
  return tx.eInvoice.create({
    data: {
      companyId: actor.companyId,
      number,
      direction: "OUTGOING",
      salesInvoiceId: invoice.id,
      status: "DRAFT",
      uuid,
      xmlContent: xml,
    },
  });
}

export async function sendEInvoiceSandbox(tx: Db, actor: Actor, id: string) {
  assertPermission(actor.role, "einvoice");
  const doc = await tx.eInvoice.findFirst({
    where: { id, companyId: actor.companyId },
  });
  if (!doc) throw new ErpError("e-Fatura bulunamadı.");
  if (doc.status !== "DRAFT") throw new ErpError("Yalnızca taslak gönderilir.");
  return tx.eInvoice.update({
    where: { id },
    data: {
      status: "SENT",
      sentAt: new Date(),
      responseNote: "Sandbox mock gönderim — canlı GİB bağlantısı yok.",
    },
  });
}

export async function respondEInvoiceSandbox(
  tx: Db,
  actor: Actor,
  id: string,
  accept: boolean,
) {
  assertPermission(actor.role, "einvoice");
  const doc = await tx.eInvoice.findFirst({
    where: { id, companyId: actor.companyId },
  });
  if (!doc || doc.status !== "SENT") throw new ErpError("Yanıtlanacak gönderilmiş belge yok.");
  return tx.eInvoice.update({
    where: { id },
    data: {
      status: accept ? "ACCEPTED" : "REJECTED",
      respondedAt: new Date(),
      responseNote: accept ? "Sandbox kabul" : "Sandbox red",
    },
  });
}
