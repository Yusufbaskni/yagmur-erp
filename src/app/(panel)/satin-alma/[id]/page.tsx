import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ErrorNote,
  LinesTable,
  LinkButton,
  PageHeader,
  Panel,
  StatusBadge,
  TotalBox,
} from "@/components/erp";
import { PostButton, ReceiveForm } from "@/components/forms";
import { formatDate } from "@/lib/format";
import { purchaseOrderStatusLabel } from "@/lib/labels";
import {
  cancelPurchaseOrderAction,
  confirmPurchaseOrderAction,
  receivePurchaseOrderAction,
} from "@/server/actions";
import { getPurchaseOrder } from "@/server/queries";

export const metadata = { title: "Satın alma siparişi" };

export default async function PurchaseOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ hata?: string }>;
}) {
  const { id } = await params;
  const { hata } = await searchParams;
  const order = await getPurchaseOrder(id);
  if (!order) notFound();
  const total = order.lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const subtotal = order.lines.reduce((sum, line) => sum + line.lineNet, 0);
  const vatTotal = order.lines.reduce((sum, line) => sum + line.vatAmount, 0);
  return (
    <div>
      <PageHeader
        eyebrow="Satın alma"
        title={order.number}
        description={`${formatDate(order.date)} · ${order.party.name}`}
        actions={
          <>
            <StatusBadge code={order.status} label={purchaseOrderStatusLabel[order.status]} />
            {order.status === "DRAFT" ? (
              <LinkButton href={`/satin-alma/${order.id}/duzenle`} variant="outline">
                Düzenle
              </LinkButton>
            ) : null}
            {order.receipt ? (
              <LinkButton href={`/satin-alma/mal-kabul/${order.receipt.id}`} variant="secondary">
                {order.receipt.number}
              </LinkButton>
            ) : null}
          </>
        }
      />
      <ErrorNote message={hata} />
      <div className="mb-4 flex flex-wrap gap-2">
        {order.status === "DRAFT" ? (
          <PostButton action={confirmPurchaseOrderAction} id={order.id} label="Onayla" />
        ) : null}
        {order.status === "DRAFT" || order.status === "CONFIRMED" ? (
          <PostButton action={cancelPurchaseOrderAction} id={order.id} label="İptal et" variant="outline" />
        ) : null}
      </div>
      {order.status === "CONFIRMED" && !order.receipt ? (
        <Panel className="mb-4 p-3">
          <h2 className="mb-1 text-sm font-semibold">Mal kabul</h2>
          <p className="mb-2 text-sm text-muted-foreground">
            Kabul stoku artırır. Borç alış faturası kesilince açılır.
          </p>
          <ReceiveForm action={receivePurchaseOrderAction} id={order.id} label="Malı kabul et" />
        </Panel>
      ) : null}
      <Panel>
        <div className="px-3 py-2 text-sm">
          <Link href={`/cariler/${order.partyId}`} className="font-medium text-primary">
            {order.party.code} · {order.party.name}
          </Link>
          {order.warehouse ? (
            <p className="text-xs text-muted-foreground">
              Depo: {order.warehouse.code} · {order.warehouse.name}
            </p>
          ) : null}
        </div>
        <LinesTable
          showVat
          lines={order.lines.map((line) => ({
            id: line.id,
            sku: line.product.sku,
            name: line.product.name,
            unit: line.product.unit,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            vatRate: line.vatRate,
            vatAmount: line.vatAmount,
            lineNet: line.lineNet,
            lineTotal: line.lineTotal,
          }))}
        />
        <TotalBox subtotal={subtotal} vatTotal={vatTotal} total={total} />
        {order.notes ? <p className="px-3 pb-3 text-sm text-muted-foreground">{order.notes}</p> : null}
      </Panel>
    </div>
  );
}
