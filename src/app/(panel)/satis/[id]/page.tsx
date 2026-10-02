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
import { DueForm, PostButton } from "@/components/forms";
import { formatDate, formatQty } from "@/lib/format";
import { salesOrderStatusLabel } from "@/lib/labels";
import {
  cancelSalesOrderAction,
  confirmSalesOrderAction,
  invoiceSalesOrderAction,
} from "@/server/actions";
import { getSalesOrder } from "@/server/queries";

export const metadata = { title: "Satış siparişi" };

export default async function SalesOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ hata?: string }>;
}) {
  const { id } = await params;
  const { hata } = await searchParams;
  const order = await getSalesOrder(id);
  if (!order) notFound();
  const total = order.lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const subtotal = order.lines.reduce((sum, line) => sum + line.lineNet, 0);
  const vatTotal = order.lines.reduce((sum, line) => sum + line.vatAmount, 0);
  const need = new Map<string, number>();
  for (const line of order.lines) {
    need.set(line.productId, (need.get(line.productId) ?? 0) + line.quantity);
  }
  const shortages = [...need.entries()].flatMap(([productId, quantity]) => {
    const product = order.lines.find((line) => line.productId === productId)?.product;
    if (!product || product.stockOnHand >= quantity) return [];
    return [`${product.sku}: elde ${formatQty(product.stockOnHand)} ${product.unit}, sipariş ${formatQty(quantity)}`];
  });
  return (
    <div>
      <PageHeader
        eyebrow="Satış siparişi"
        title={order.number}
        description={`${formatDate(order.date)} · ${order.party.name}`}
        actions={
          <>
            <StatusBadge code={order.status} label={salesOrderStatusLabel[order.status]} />
            {order.status === "DRAFT" ? (
              <LinkButton href={`/satis/${order.id}/duzenle`} variant="outline">
                Düzenle
              </LinkButton>
            ) : null}
            {order.invoice ? (
              <LinkButton href={`/satis/faturalar/${order.invoice.id}`} variant="secondary">
                {order.invoice.number}
              </LinkButton>
            ) : null}
          </>
        }
      />
      <ErrorNote message={hata} />
      <div className="mb-4 flex flex-wrap gap-2">
        {order.status === "DRAFT" ? (
          <PostButton action={confirmSalesOrderAction} id={order.id} label="Onayla" />
        ) : null}
        {order.status === "DRAFT" || order.status === "CONFIRMED" ? (
          <PostButton action={cancelSalesOrderAction} id={order.id} label="İptal et" variant="outline" />
        ) : null}
      </div>
      {order.status === "CONFIRMED" ? (
        <Panel className="mb-4 p-3">
          <h2 className="mb-2 text-sm font-semibold">Faturala</h2>
          {shortages.length > 0 ? (
            <p className="mb-2 text-sm text-destructive">
              Stok yetersiz: {shortages.join("; ")}. Fatura kesilmez.
            </p>
          ) : (
            <p className="mb-2 text-sm text-muted-foreground">
              Fatura stoktan düşer ve müşteri alacağını artırır.
            </p>
          )}
          <DueForm action={invoiceSalesOrderAction} id={order.id} label="Fatura kes" />
        </Panel>
      ) : null}
      <Panel>
        <div className="flex items-center justify-between px-3 py-2 text-sm">
          <Link href={`/cariler/${order.partyId}`} className="font-medium text-primary">
            {order.party.code} · {order.party.name}
          </Link>
          <span className="text-muted-foreground">{order.party.city}</span>
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
