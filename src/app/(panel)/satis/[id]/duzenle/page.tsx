import { notFound } from "next/navigation";
import { PageHeader } from "@/components/erp";
import { DocumentForm } from "@/components/forms";
import { kurusToInput, milliToInput } from "@/lib/format";
import { updateSalesOrderAction } from "@/server/actions";
import { formOptions, getSalesOrder } from "@/server/queries";

export const metadata = { title: "Siparişi düzenle" };

export default async function EditSalesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [order, opts] = await Promise.all([getSalesOrder(id), formOptions()]);
  if (!order) notFound();
  if (order.status !== "DRAFT") {
    return (
      <PageHeader
        title={order.number}
        description="Yalnızca taslak sipariş düzenlenebilir."
      />
    );
  }
  const date = order.date.toISOString().slice(0, 10);
  return (
    <div>
      <PageHeader eyebrow={order.number} title="Siparişi düzenle" />
      <DocumentForm
        action={updateSalesOrderAction}
        parties={opts.customers}
        products={opts.products}
        warehouses={opts.warehouses}
        price="sale"
        submitLabel="Taslağı kaydet"
        initial={{
          id: order.id,
          partyId: order.partyId,
          warehouseId: order.warehouseId,
          date,
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
