import { PageHeader } from "@/components/erp";
import { DeliveryNoteCreateForm } from "@/components/delivery-form";
import { formOptions } from "@/server/queries";

export const metadata = { title: "Yeni irsaliye" };

export default async function NewDeliveryNotePage() {
  const { customers, suppliers, products, warehouses } = await formOptions();
  return (
    <div>
      <PageHeader title="Yeni irsaliye" description="Sevk veya alış irsaliyesi oluşturun." />
      <DeliveryNoteCreateForm
        customers={customers}
        suppliers={suppliers}
        products={products}
        warehouses={warehouses}
      />
    </div>
  );
}
