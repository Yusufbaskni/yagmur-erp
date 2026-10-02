"use server";

import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { signSession, SESSION_COOKIE } from "@/lib/session";
import { writeAudit } from "@/server/audit";
import { COMPANY_COOKIE, resolveActor } from "@/server/company";
import { db, withTx } from "@/server/db";
import { asErp, rethrowRedirect } from "@/server/errors";
import {
  cancelGoodsReceipt,
  cancelPurchaseOrder,
  cancelSalesInvoice,
  cancelSalesOrder,
  confirmPurchaseOrder,
  confirmSalesOrder,
  createCollection,
  createDeliveryNote,
  createParty,
  createProduct,
  createPurchaseInvoiceFromReceipt,
  createPurchaseOrder,
  createPurchaseReturn,
  createSalesOrder,
  createSalesReturn,
  createSupplierPayment,
  deleteParty,
  deleteProduct,
  invoiceSalesOrder,
  postManualMovement,
  receivePurchaseOrder,
  transferStock,
  updateParty,
  updateProduct,
  updatePurchaseOrder,
  updateSalesOrder,
  type Actor,
} from "@/server/ledger";
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
  respondEInvoiceSandbox,
  sendEInvoiceSandbox,
  setLeaveStatus,
  updateCheckNoteStatus,
} from "@/server/modules";
import {
  parseDocumentHeader,
  parseDueDates,
  parseKurus,
  parseMilli,
  parseMovement,
  parseParty,
  parsePayment,
  parseProduct,
  parseVatRate,
} from "@/server/parse";
import { parseDateInput } from "@/lib/dates";

export type ActionState = { error: string | null };

function touch() {
  revalidatePath("/", "layout");
}

async function actor(): Promise<Actor> {
  const a = await resolveActor();
  return { userId: a.userId, companyId: a.companyId, role: a.role };
}

async function run<T>(fn: () => Promise<T>, fallback: string): Promise<T | ActionState> {
  try {
    return await fn();
  } catch (error) {
    rethrowRedirect(error);
    const erp = asErp(error);
    if (erp) return { error: erp.message };
    console.error(error);
    return { error: fallback };
  }
}

export async function loginAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const user = await db().user.findUnique({ where: { email } });
  const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !valid) return { error: "E-posta veya şifre hatalı." };
  const membership = await db().userCompany.findFirst({
    where: { userId: user.id },
    orderBy: { company: { name: "asc" } },
  });
  const token = await signSession({ sub: user.id, email: user.email, name: user.name });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure:
      process.env.COOKIE_SECURE === "1" ||
      (process.env.COOKIE_SECURE !== "0" && process.env.NODE_ENV === "production"),
    maxAge: 60 * 60 * 24 * 7,
  });
  if (membership) {
    jar.set(COMPANY_COOKIE, membership.companyId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  redirect("/");
}

export async function logoutAction() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(COMPANY_COOKIE);
  redirect("/giris");
}

export async function switchCompanyAction(formData: FormData) {
  const companyId = String(formData.get("companyId") ?? "");
  const a = await resolveActor();
  const membership = await db().userCompany.findFirst({
    where: { userId: a.userId!, companyId },
  });
  if (!membership) redirect("/?hata=" + encodeURIComponent("Şirket erişiminiz yok."));
  const jar = await cookies();
  jar.set(COMPANY_COOKIE, companyId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  touch();
  redirect("/");
}

export async function createPartyAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await run(async () => {
    const party = await withTx(async (tx) =>
      createParty(tx, await actor(), parseParty(formData)),
    );
    touch();
    redirect(`/cariler/${party.id}`);
  }, "Cari kaydedilemedi.");
  return result as ActionState;
}

export async function updatePartyAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  const result = await run(async () => {
    await withTx(async (tx) => updateParty(tx, await actor(), id, parseParty(formData)));
    touch();
    redirect(`/cariler/${id}`);
  }, "Cari güncellenemedi.");
  return result as ActionState;
}

export async function deletePartyAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  try {
    await withTx(async (tx) => deleteParty(tx, await actor(), id));
    touch();
  } catch (error) {
    rethrowRedirect(error);
    const erp = asErp(error);
    if (erp) redirect(`/cariler/${id}?hata=${encodeURIComponent(erp.message)}`);
    throw error;
  }
  redirect("/cariler");
}

export async function createProductAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await run(async () => {
    const product = await withTx(async (tx) =>
      createProduct(tx, await actor(), parseProduct(formData, true)),
    );
    touch();
    redirect(`/urunler/${product.id}`);
  }, "Ürün kaydedilemedi.");
  return result as ActionState;
}

export async function updateProductAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  const result = await run(async () => {
    const input = parseProduct(formData, false);
    await withTx(async (tx) => updateProduct(tx, await actor(), id, input));
    touch();
    redirect(`/urunler/${id}`);
  }, "Ürün güncellenemedi.");
  return result as ActionState;
}

export async function deleteProductAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  try {
    await withTx(async (tx) => deleteProduct(tx, await actor(), id));
    touch();
  } catch (error) {
    rethrowRedirect(error);
    const erp = asErp(error);
    if (erp) redirect(`/urunler/${id}?hata=${encodeURIComponent(erp.message)}`);
    throw error;
  }
  redirect("/urunler");
}

export async function createMovementAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await run(async () => {
    await withTx(async (tx) =>
      postManualMovement(tx, await actor(), parseMovement(formData)),
    );
    touch();
    redirect("/stok");
  }, "Stok hareketi kaydedilemedi.");
  return result as ActionState;
}

async function documentAction(
  formData: FormData,
  pathName: string,
  work: () => Promise<unknown>,
) {
  try {
    await work();
    touch();
  } catch (error) {
    rethrowRedirect(error);
    const erp = asErp(error);
    if (erp) redirect(`${pathName}?hata=${encodeURIComponent(erp.message)}`);
    throw error;
  }
}

export async function createSalesOrderAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await run(async () => {
    const order = await withTx(async (tx) =>
      createSalesOrder(tx, await actor(), parseDocumentHeader(formData)),
    );
    touch();
    redirect(`/satis/${order.id}`);
  }, "Sipariş kaydedilemedi.");
  return result as ActionState;
}

export async function updateSalesOrderAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  const result = await run(async () => {
    await withTx(async (tx) =>
      updateSalesOrder(tx, await actor(), id, parseDocumentHeader(formData)),
    );
    touch();
    redirect(`/satis/${id}`);
  }, "Sipariş güncellenemedi.");
  return result as ActionState;
}

export async function confirmSalesOrderAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  await documentAction(formData, `/satis/${id}`, async () =>
    withTx(async (tx) => confirmSalesOrder(tx, await actor(), id)),
  );
  redirect(`/satis/${id}`);
}

export async function cancelSalesOrderAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  await documentAction(formData, `/satis/${id}`, async () =>
    withTx(async (tx) => cancelSalesOrder(tx, await actor(), id)),
  );
  redirect(`/satis/${id}`);
}

export async function invoiceSalesOrderAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  let invoiceId = "";
  try {
    const invoice = await withTx(async (tx) =>
      invoiceSalesOrder(tx, await actor(), id, parseDueDates(formData)),
    );
    invoiceId = invoice.id;
    touch();
  } catch (error) {
    rethrowRedirect(error);
    const erp = asErp(error);
    if (erp) redirect(`/satis/${id}?hata=${encodeURIComponent(erp.message)}`);
    throw error;
  }
  redirect(`/satis/faturalar/${invoiceId}`);
}

export async function cancelSalesInvoiceAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  await documentAction(formData, `/satis/faturalar/${id}`, async () =>
    withTx(async (tx) => cancelSalesInvoice(tx, await actor(), id)),
  );
  redirect(`/satis/faturalar/${id}`);
}

export async function returnSalesInvoiceAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  let returnId = "";
  try {
    const inv = await withTx(async (tx) =>
      createSalesReturn(tx, await actor(), id, {
        date: parseDateInput(String(formData.get("date") ?? "")),
        notes: String(formData.get("notes") ?? ""),
      }),
    );
    returnId = inv.id;
    touch();
  } catch (error) {
    rethrowRedirect(error);
    const erp = asErp(error);
    if (erp) redirect(`/satis/faturalar/${id}?hata=${encodeURIComponent(erp.message)}`);
    throw error;
  }
  redirect(`/satis/faturalar/${returnId}`);
}

export async function createPurchaseOrderAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await run(async () => {
    const order = await withTx(async (tx) =>
      createPurchaseOrder(tx, await actor(), parseDocumentHeader(formData)),
    );
    touch();
    redirect(`/satin-alma/${order.id}`);
  }, "Satın alma kaydedilemedi.");
  return result as ActionState;
}

export async function updatePurchaseOrderAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  const result = await run(async () => {
    await withTx(async (tx) =>
      updatePurchaseOrder(tx, await actor(), id, parseDocumentHeader(formData)),
    );
    touch();
    redirect(`/satin-alma/${id}`);
  }, "Satın alma güncellenemedi.");
  return result as ActionState;
}

export async function confirmPurchaseOrderAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  await documentAction(formData, `/satin-alma/${id}`, async () =>
    withTx(async (tx) => confirmPurchaseOrder(tx, await actor(), id)),
  );
  redirect(`/satin-alma/${id}`);
}

export async function cancelPurchaseOrderAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  await documentAction(formData, `/satin-alma/${id}`, async () =>
    withTx(async (tx) => cancelPurchaseOrder(tx, await actor(), id)),
  );
  redirect(`/satin-alma/${id}`);
}

export async function receivePurchaseOrderAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  let receiptId = "";
  try {
    const receipt = await withTx(async (tx) =>
      receivePurchaseOrder(tx, await actor(), id, {
        date: parseDateInput(String(formData.get("date") ?? "")),
        notes: String(formData.get("notes") ?? ""),
      }),
    );
    receiptId = receipt.id;
    touch();
  } catch (error) {
    rethrowRedirect(error);
    const erp = asErp(error);
    if (erp) redirect(`/satin-alma/${id}?hata=${encodeURIComponent(erp.message)}`);
    throw error;
  }
  redirect(`/satin-alma/mal-kabul/${receiptId}`);
}

export async function cancelGoodsReceiptAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  await documentAction(formData, `/satin-alma/mal-kabul/${id}`, async () =>
    withTx(async (tx) => cancelGoodsReceipt(tx, await actor(), id)),
  );
  redirect(`/satin-alma/mal-kabul/${id}`);
}

export async function createPurchaseInvoiceAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  let invoiceId = "";
  try {
    const invoice = await withTx(async (tx) =>
      createPurchaseInvoiceFromReceipt(tx, await actor(), id, parseDueDates(formData)),
    );
    invoiceId = invoice.id;
    touch();
  } catch (error) {
    rethrowRedirect(error);
    const erp = asErp(error);
    if (erp) redirect(`/satin-alma/mal-kabul/${id}?hata=${encodeURIComponent(erp.message)}`);
    throw error;
  }
  redirect(`/satin-alma/faturalar/${invoiceId}`);
}

export async function returnPurchaseInvoiceAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  let returnId = "";
  try {
    const inv = await withTx(async (tx) =>
      createPurchaseReturn(tx, await actor(), id, {
        date: parseDateInput(String(formData.get("date") ?? "")),
        notes: String(formData.get("notes") ?? ""),
      }),
    );
    returnId = inv.id;
    touch();
  } catch (error) {
    rethrowRedirect(error);
    const erp = asErp(error);
    if (erp) redirect(`/satin-alma/faturalar/${id}?hata=${encodeURIComponent(erp.message)}`);
    throw error;
  }
  redirect(`/satin-alma/faturalar/${returnId}`);
}

export async function createCollectionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await run(async () => {
    const payment = await withTx(async (tx) =>
      createCollection(tx, await actor(), parsePayment(formData)),
    );
    touch();
    redirect(`/tahsilat/${payment.id}`);
  }, "Tahsilat kaydedilemedi.");
  return result as ActionState;
}

export async function createSupplierPaymentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await run(async () => {
    const payment = await withTx(async (tx) =>
      createSupplierPayment(tx, await actor(), parsePayment(formData)),
    );
    touch();
    redirect(`/odeme/${payment.id}`);
  }, "Ödeme kaydedilemedi.");
  return result as ActionState;
}

export async function createTransferAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await run(async () => {
    const productIds = formData.getAll("productId").map(String);
    const quantities = formData.getAll("quantity").map(String);
    await withTx(async (tx) =>
      transferStock(tx, await actor(), {
        fromWarehouseId: String(formData.get("fromWarehouseId") ?? ""),
        toWarehouseId: String(formData.get("toWarehouseId") ?? ""),
        date: parseDateInput(String(formData.get("date") ?? "")),
        notes: String(formData.get("notes") ?? ""),
        lines: productIds.map((productId, i) => ({
          productId,
          quantity: parseMilli(quantities[i] ?? ""),
        })),
      }),
    );
    touch();
    redirect("/stok/transfer");
  }, "Transfer kaydedilemedi.");
  return result as ActionState;
}

export async function createDeliveryNoteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await run(async () => {
    const productIds = formData.getAll("productId").map(String);
    const quantities = formData.getAll("quantity").map(String);
    const direction = String(formData.get("direction") ?? "SALES");
    const note = await withTx(async (tx) =>
      createDeliveryNote(tx, await actor(), {
        direction: direction === "PURCHASE" ? "PURCHASE" : "SALES",
        partyId: String(formData.get("partyId") ?? ""),
        warehouseId: String(formData.get("warehouseId") ?? "") || undefined,
        date: parseDateInput(String(formData.get("date") ?? "")),
        notes: String(formData.get("notes") ?? ""),
        salesOrderId: String(formData.get("salesOrderId") ?? "") || null,
        salesInvoiceId: String(formData.get("salesInvoiceId") ?? "") || null,
        purchaseOrderId: String(formData.get("purchaseOrderId") ?? "") || null,
        goodsReceiptId: String(formData.get("goodsReceiptId") ?? "") || null,
        lines: productIds.map((productId, i) => ({
          productId,
          quantity: parseMilli(quantities[i] ?? ""),
        })),
      }),
    );
    touch();
    redirect(`/irsaliye/${note.id}`);
  }, "İrsaliye kaydedilemedi.");
  return result as ActionState;
}

export async function createCheckAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await run(async () => {
    const note = await withTx(async (tx) =>
      createCheckNote(tx, await actor(), {
        kind: String(formData.get("kind") ?? "CHECK") === "PROMISSORY" ? "PROMISSORY" : "CHECK",
        partyId: String(formData.get("partyId") ?? "") || null,
        moneyAccountId: String(formData.get("moneyAccountId") ?? "") || null,
        dueDate: parseDateInput(String(formData.get("dueDate") ?? "")),
        amount: parseKurus(String(formData.get("amount") ?? "")),
        bankName: String(formData.get("bankName") ?? ""),
        serialNo: String(formData.get("serialNo") ?? ""),
        notes: String(formData.get("notes") ?? ""),
      }),
    );
    touch();
    redirect(`/cek-senet/${note.id}`);
  }, "Çek/senet kaydedilemedi.");
  return result as ActionState;
}

export async function updateCheckStatusAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as
    | "PORTFOLIO"
    | "COLLECTED"
    | "ENDORSED"
    | "BOUNCED";
  await documentAction(formData, `/cek-senet/${id}`, async () =>
    withTx(async (tx) => updateCheckNoteStatus(tx, await actor(), id, status)),
  );
  redirect(`/cek-senet/${id}`);
}

export async function createBomAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await run(async () => {
    const productIds = formData.getAll("componentId").map(String);
    const quantities = formData.getAll("componentQty").map(String);
    const bom = await withTx(async (tx) =>
      createBom(tx, await actor(), {
        code: String(formData.get("code") ?? ""),
        name: String(formData.get("name") ?? ""),
        finishedProductId: String(formData.get("finishedProductId") ?? ""),
        outputQty: parseMilli(String(formData.get("outputQty") ?? "1")),
        lines: productIds.map((productId, i) => ({
          productId,
          quantity: parseMilli(quantities[i] ?? ""),
        })),
      }),
    );
    touch();
    redirect(`/uretim/bom/${bom.id}`);
  }, "Ürün ağacı kaydedilemedi.");
  return result as ActionState;
}

export async function createWorkOrderAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await run(async () => {
    const wo = await withTx(async (tx) =>
      createWorkOrder(tx, await actor(), {
        bomId: String(formData.get("bomId") ?? ""),
        warehouseId: String(formData.get("warehouseId") ?? ""),
        quantity: parseMilli(String(formData.get("quantity") ?? "")),
        date: parseDateInput(String(formData.get("date") ?? "")),
        notes: String(formData.get("notes") ?? ""),
      }),
    );
    touch();
    redirect(`/uretim/is-emri/${wo.id}`);
  }, "İş emri kaydedilemedi.");
  return result as ActionState;
}

export async function completeWorkOrderAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  await documentAction(formData, `/uretim/is-emri/${id}`, async () =>
    withTx(async (tx) => completeWorkOrder(tx, await actor(), id)),
  );
  redirect(`/uretim/is-emri/${id}`);
}

export async function createEmployeeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await run(async () => {
    const emp = await withTx(async (tx) =>
      createEmployee(tx, await actor(), {
        code: String(formData.get("code") ?? ""),
        name: String(formData.get("name") ?? ""),
        departmentId: String(formData.get("departmentId") ?? "") || null,
        title: String(formData.get("title") ?? ""),
        email: String(formData.get("email") ?? ""),
        phone: String(formData.get("phone") ?? ""),
      }),
    );
    touch();
    redirect(`/ik/calisanlar/${emp.id}`);
  }, "Çalışan kaydedilemedi.");
  return result as ActionState;
}

export async function createLeaveAction(formData: FormData) {
  try {
    await withTx(async (tx) =>
      createLeaveRequest(tx, await actor(), {
        employeeId: String(formData.get("employeeId") ?? ""),
        startDate: parseDateInput(String(formData.get("startDate") ?? "")),
        endDate: parseDateInput(String(formData.get("endDate") ?? "")),
        days: Number(formData.get("days") ?? 1),
        reason: String(formData.get("reason") ?? ""),
      }),
    );
    touch();
  } catch (error) {
    rethrowRedirect(error);
    const erp = asErp(error);
    if (erp) redirect(`/ik/izinler?hata=${encodeURIComponent(erp.message)}`);
    throw error;
  }
  redirect(`/ik/izinler`);
}

export async function setLeaveStatusAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as "APPROVED" | "REJECTED";
  await documentAction(formData, `/ik/izinler`, async () =>
    withTx(async (tx) => setLeaveStatus(tx, await actor(), id, status)),
  );
  redirect(`/ik/izinler`);
}

export async function createLeadAction(formData: FormData) {
  try {
    await withTx(async (tx) =>
      createLead(tx, await actor(), {
        name: String(formData.get("name") ?? ""),
        companyName: String(formData.get("companyName") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        email: String(formData.get("email") ?? ""),
        source: String(formData.get("source") ?? ""),
        partyId: String(formData.get("partyId") ?? "") || null,
        notes: String(formData.get("notes") ?? ""),
      }),
    );
    touch();
  } catch (error) {
    rethrowRedirect(error);
    const erp = asErp(error);
    if (erp) redirect(`/crm/leads?hata=${encodeURIComponent(erp.message)}`);
    throw error;
  }
  redirect(`/crm/leads`);
}

export async function createOpportunityAction(formData: FormData) {
  try {
    await withTx(async (tx) =>
      createOpportunity(tx, await actor(), {
        title: String(formData.get("title") ?? ""),
        amount: parseKurus(String(formData.get("amount") ?? "0") || "0"),
        stage: String(formData.get("stage") ?? "QUALIFICATION") as
          | "QUALIFICATION"
          | "PROPOSAL"
          | "NEGOTIATION"
          | "WON"
          | "LOST",
        leadId: String(formData.get("leadId") ?? "") || null,
        partyId: String(formData.get("partyId") ?? "") || null,
        notes: String(formData.get("notes") ?? ""),
      }),
    );
    touch();
  } catch (error) {
    rethrowRedirect(error);
    const erp = asErp(error);
    if (erp) redirect(`/crm/firsatlar?hata=${encodeURIComponent(erp.message)}`);
    throw error;
  }
  redirect(`/crm/firsatlar`);
}

export async function createEInvoiceAction(formData: FormData) {
  const salesInvoiceId = String(formData.get("salesInvoiceId") ?? "");
  let id = "";
  try {
    const doc = await withTx(async (tx) =>
      createOutgoingEInvoice(tx, await actor(), salesInvoiceId),
    );
    id = doc.id;
    touch();
  } catch (error) {
    rethrowRedirect(error);
    const erp = asErp(error);
    if (erp) {
      redirect(`/satis/faturalar/${salesInvoiceId}?hata=${encodeURIComponent(erp.message)}`);
    }
    throw error;
  }
  redirect(`/e-fatura/${id}`);
}

export async function sendEInvoiceAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  await documentAction(formData, `/e-fatura/${id}`, async () =>
    withTx(async (tx) => sendEInvoiceSandbox(tx, await actor(), id)),
  );
  redirect(`/e-fatura/${id}`);
}

export async function respondEInvoiceAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const accept = String(formData.get("accept") ?? "") === "1";
  await documentAction(formData, `/e-fatura/${id}`, async () =>
    withTx(async (tx) => respondEInvoiceSandbox(tx, await actor(), id, accept)),
  );
  redirect(`/e-fatura/${id}`);
}

export async function exportBackupAction() {
  const a = await actor();
  const dbUrl = process.env.DATABASE_URL ?? "file:./dev.db";
  const file = dbUrl.replace(/^file:/, "");
  const abs = path.isAbsolute(file) ? file : path.join(process.cwd(), "prisma", path.basename(file));
  const outDir = path.join(process.cwd(), "prisma", "backups");
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const out = path.join(outDir, `yagmur-backup-${stamp}.db`);
  fs.copyFileSync(abs, out);
  await withTx(async (tx) =>
    writeAudit(tx, {
      companyId: a.companyId,
      userId: a.userId,
      action: "BACKUP",
      entityType: "Database",
      summary: `Yedek alındı: ${path.basename(out)}`,
    }),
  );
  touch();
  redirect(`/ayarlar?yedek=${encodeURIComponent(path.basename(out))}`);
}

export async function importBackupAction(formData: FormData) {
  const a = await actor();
  const name = String(formData.get("backupFile") ?? "");
  if (!name || name.includes("..") || name.includes("/")) {
    redirect(`/ayarlar?hata=${encodeURIComponent("Geçersiz yedek dosyası.")}`);
  }
  const src = path.join(process.cwd(), "prisma", "backups", name);
  if (!fs.existsSync(src)) {
    redirect(`/ayarlar?hata=${encodeURIComponent("Yedek bulunamadı.")}`);
  }
  const dbUrl = process.env.DATABASE_URL ?? "file:./dev.db";
  const file = dbUrl.replace(/^file:/, "");
  const abs = path.isAbsolute(file) ? file : path.join(process.cwd(), "prisma", path.basename(file));
  fs.copyFileSync(src, abs);
  await writeAudit(db(), {
    companyId: a.companyId,
    userId: a.userId,
    action: "RESTORE",
    entityType: "Database",
    summary: `Yedek geri yüklendi: ${name}`,
  });
  touch();
  redirect("/ayarlar?ok=restore");
}

// silence unused import warning for parseVatRate if tree-shaken oddly
void parseVatRate;
