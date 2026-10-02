import { PageHeader } from "@/components/erp";
import { DocumentForm } from "@/components/forms";
import { createSalesOrderAction } from "@/server/actions";
import { formOptions } from "@/server/queries";

export const metadata = { title: "Yeni satış siparişi" };

export default async function NewSalesPage() {
  const { customers, products, warehouses } = await formOptions();
  return (
    <div>
      <PageHeader
        title="Yeni satış siparişi"
        description="Onayda stok rezerve edilir; fatura kesilince düşer. Tutarlar KDV dahildir."
      />
      <DocumentForm
        action={createSalesOrderAction}
        parties={customers}
        products={products}
        warehouses={warehouses}
        price="sale"
        submitLabel="Taslak kaydet"
      />
    </div>
  );
}
