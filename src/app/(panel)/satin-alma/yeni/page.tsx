import { PageHeader } from "@/components/erp";
import { DocumentForm } from "@/components/forms";
import { createPurchaseOrderAction } from "@/server/actions";
import { formOptions } from "@/server/queries";

export const metadata = { title: "Yeni satın alma" };

export default async function NewPurchasePage() {
  const { suppliers, products, warehouses } = await formOptions();
  return (
    <div>
      <PageHeader
        title="Yeni satın alma siparişi"
        description="Mal kabul stoku açar; borç alış faturasıyla oluşur."
      />
      <DocumentForm
        action={createPurchaseOrderAction}
        parties={suppliers}
        products={products}
        warehouses={warehouses}
        price="purchase"
        submitLabel="Taslak kaydet"
      />
    </div>
  );
}
