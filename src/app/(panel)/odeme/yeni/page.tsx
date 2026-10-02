import { PageHeader } from "@/components/erp";
import { PaymentForm } from "@/components/forms";
import { formatDate } from "@/lib/format";
import { createSupplierPaymentAction } from "@/server/actions";
import { formOptions, openPurchaseInvoicesForParty } from "@/server/queries";

export const metadata = { title: "Yeni ödeme" };

export default async function NewPaymentPage() {
  const { suppliers } = await formOptions();
  const invoices = (
    await Promise.all(suppliers.map((party) => openPurchaseInvoicesForParty(party.id)))
  ).flat();
  return (
    <div>
      <PageHeader
        title="Yeni ödeme"
        description="Tutar, seçilen alış faturalarının açık bakiyesini aşamaz."
      />
      <PaymentForm
        action={createSupplierPaymentAction}
        parties={suppliers}
        noun="alış faturaları"
        documents={invoices.map((invoice) => ({
          id: invoice.id,
          partyId: invoice.partyId,
          number: invoice.number,
          remaining: invoice.total - invoice.paidAmount,
          dateLabel: formatDate(invoice.date),
        }))}
      />
    </div>
  );
}
