import { PageHeader } from "@/components/erp";
import { PaymentForm } from "@/components/forms";
import { formatDate } from "@/lib/format";
import { createCollectionAction } from "@/server/actions";
import { formOptions, openSalesInvoicesForParty } from "@/server/queries";

export const metadata = { title: "Yeni tahsilat" };

export default async function NewCollectionPage() {
  const { customers } = await formOptions();
  const invoices = (
    await Promise.all(customers.map((party) => openSalesInvoicesForParty(party.id)))
  ).flat();
  return (
    <div>
      <PageHeader
        title="Yeni tahsilat"
        description="Tutar, seçilen faturaların açık bakiyesini aşamaz."
      />
      <PaymentForm
        action={createCollectionAction}
        parties={customers}
        noun="faturalar"
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
