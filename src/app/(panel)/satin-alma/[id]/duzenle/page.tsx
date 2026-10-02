import { notFound } from "next/navigation";
import { PageHeader } from "@/components/erp";
import { DocumentForm } from "@/components/forms";
import { kurusToInput, milliToInput } from "@/lib/format";
import { updatePurchaseOrderAction } from "@/server/actions";
import { formOptions, getPurchaseOrder } from "@/server/queries";

export const metadata = { title: "Satın almayı düzenle" };

export default async function EditPurchasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [order, opts] = await Promise.all([getPurchaseOrder(id), formOptions()]);
  if (!order) notFound();
  if (order.status !== "DRAFT") {
    return <PageHeader title={order.number} description="Yalnızca taslak sipariş düzenlenebilir." />;
  }
  return (
    <div>
      <PageHeader eyebrow={order.number} title="Satın almayı düzenle" />
      <DocumentForm
        action={updatePurchaseOrderAction}
        parties={opts.suppliers}
        products={opts.products}
        warehouses={opts.warehouses}
        price="purchase"
        submitLabel="Taslağı kaydet"
        initial={{
          id: order.id,
          partyId: order.partyId,
          warehouseId: order.warehouseId,
          date: order.date.toISOString().slice(0, 10),
          notes: order.notes,
          lines: order.lines.map((line) => ({
            productId: line.productId,
            quantity: milliToInput(line.quantity),
            unitPrice: kurusToInput(line.unitPrice),
            vatRate: String(line.vatRate),
          })),
        }}
      />
    </div>
  );
}
