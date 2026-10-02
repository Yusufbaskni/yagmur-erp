export const partyTypeLabel = {
  CUSTOMER: "Müşteri",
  SUPPLIER: "Tedarikçi",
} as const;

export const salesOrderStatusLabel = {
  DRAFT: "Taslak",
  CONFIRMED: "Onaylı",
  INVOICED: "Faturalandı",
  CANCELLED: "İptal",
} as const;

export const purchaseOrderStatusLabel = {
  DRAFT: "Taslak",
  CONFIRMED: "Onaylı",
  RECEIVED: "Teslim alındı",
  CANCELLED: "İptal",
} as const;

export const invoiceStatusLabel = {
  OPEN: "Açık",
  PARTIAL: "Kısmi",
  PAID: "Ödendi",
  CANCELLED: "İptal",
} as const;

export const receiptStatusLabel = {
  POSTED: "İşlendi",
  CANCELLED: "İptal",
} as const;

export const deliveryStatusLabel = {
  DRAFT: "Taslak",
  SHIPPED: "Sevk edildi",
  CANCELLED: "İptal",
} as const;

export const deliveryDirectionLabel = {
  SALES: "Satış",
  PURCHASE: "Alış",
} as const;

export const paymentMethodLabel = {
  CASH: "Nakit",
  BANK: "Banka",
  CHECK: "Çek",
} as const;

export const movementTypeLabel = {
  IN: "Giriş",
  OUT: "Çıkış",
  ADJUSTMENT: "Düzeltme",
  TRANSFER_OUT: "Transfer çıkış",
  TRANSFER_IN: "Transfer giriş",
  RESERVE: "Rezerv",
  UNRESERVE: "Rezerv iptal",
  PRODUCTION_IN: "Üretim giriş",
  PRODUCTION_OUT: "Üretim çıkış",
} as const;

export const movementSourceLabel = {
  MANUAL: "Manuel",
  SALES_INVOICE: "Satış faturası",
  GOODS_RECEIPT: "Mal kabul",
  INVOICE_CANCEL: "Fatura iptali",
  RECEIPT_CANCEL: "Mal kabul iptali",
  SALES_RETURN: "Satış iadesi",
  PURCHASE_RETURN: "Alış iadesi",
  SALES_ORDER: "Satış siparişi",
  TRANSFER: "Depo transferi",
  WORK_ORDER: "İş emri",
  DELIVERY_NOTE: "İrsaliye",
} as const;

export const checkNoteStatusLabel = {
  PORTFOLIO: "Portföy",
  COLLECTED: "Tahsil",
  ENDORSED: "Cirolu",
  BOUNCED: "Karşılıksız",
} as const;

export const eInvoiceStatusLabel = {
  DRAFT: "Taslak",
  SENT: "Gönderildi",
  ACCEPTED: "Kabul",
  REJECTED: "Red",
} as const;

export const workOrderStatusLabel = {
  DRAFT: "Taslak",
  RELEASED: "Serbest",
  COMPLETED: "Tamamlandı",
  CANCELLED: "İptal",
} as const;

export const leaveStatusLabel = {
  PENDING: "Bekliyor",
  APPROVED: "Onaylı",
  REJECTED: "Red",
} as const;

export const leadStatusLabel = {
  NEW: "Yeni",
  CONTACTED: "Görüşüldü",
  QUALIFIED: "Nitelikli",
  LOST: "Kayıp",
  CONVERTED: "Dönüştü",
} as const;

export const opportunityStageLabel = {
  QUALIFICATION: "Nitelik",
  PROPOSAL: "Teklif",
  NEGOTIATION: "Müzakere",
  WON: "Kazanıldı",
  LOST: "Kaybedildi",
} as const;

export const roleLabel = {
  ADMIN: "Yönetici",
  SALES: "Satış",
  PURCHASING: "Satın alma",
  WAREHOUSE: "Depo",
  ACCOUNTING: "Muhasebe",
} as const;

export const UNITS = ["Adet", "Kg", "Koli", "Çuval", "Litre", "Paket"] as const;

export const VAT_RATES = [0, 1, 10, 20] as const;
