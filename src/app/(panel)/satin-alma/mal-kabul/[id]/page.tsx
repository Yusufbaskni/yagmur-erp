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
import { formatDate } from "@/lib/format";
import { receiptStatusLabel } from "@/lib/labels";
import {
  cancelGoodsReceiptAction,
  createPurchaseInvoiceAction,
} from "@/server/actions";
import { getGoodsReceipt } from "@/server/queries";

export const metadata = { title: "Mal kabul" };

export default async function ReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ hata?: string }>;
}) {
  const { id } = await params;
  const { hata } = await searchParams;
  const receipt = await getGoodsReceipt(id);
  if (!receipt) notFound();
  const subtotal = receipt.lines.reduce((sum, line) => sum + line.lineNet, 0);
  const vatTotal = receipt.lines.reduce((sum, line) => sum + line.vatAmount, 0);
  const total = receipt.lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const activeInvoice = receipt.purchaseInvoices.find(
    (inv) => !inv.isReturn && inv.status !== "CANCELLED",
  );
  return (
    <div>
      <PageHeader
        eyebrow="Mal kabul"
        title={receipt.number}
        description="Stok girişi. Borç alış faturası ile açılır."
        actions={
          <>
            <StatusBadge code={receipt.status} label={receiptStatusLabel[receipt.status]} />
            {receipt.status === "POSTED" && !activeInvoice ? (
              <PostButton
                action={cancelGoodsReceiptAction}
                id={receipt.id}
                label="Kabulü iptal et"
                variant="outline"
              />
            ) : null}
            {activeInvoice ? (
              <LinkButton href={`/satin-alma/faturalar/${activeInvoice.id}`} variant="secondary">
                {activeInvoice.number}
              </LinkButton>
            ) : null}
          </>
        }
      />
      <ErrorNote message={hata} />
      <div className="mb-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <Info label="Tedarikçi" value={receipt.party.name} href={`/cariler/${receipt.partyId}`} />
        <Info
          label="Sipariş"
          value={receipt.orderNumber}
          href={receipt.purchaseOrderId ? `/satin-alma/${receipt.purchaseOrderId}` : undefined}
        />
        <Info label="Kabul tarihi" value={formatDate(receipt.date)} />
        <Info
          label="Depo"
          value={receipt.warehouse ? `${receipt.warehouse.code} · ${receipt.warehouse.name}` : "—"}
        />
      </div>
      <Panel>
        <LinesTable
          showVat
          lines={receipt.lines.map((line) => ({
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
      </Panel>
      {receipt.status === "POSTED" && !activeInvoice ? (
        <Panel className="mt-4 p-3">
          <h2 className="mb-1 text-sm font-semibold">Alış faturası kes</h2>
          <p className="mb-2 text-sm text-muted-foreground">
            Fatura tedarikçi borcunu açar. Ödeme alış faturasına uygulanır.
          </p>
          <DueForm action={createPurchaseInvoiceAction} id={receipt.id} label="Fatura kes" />
        </Panel>
      ) : null}
      {receipt.purchaseInvoices.length > 0 ? (
        <Panel className="mt-4">
          <h2 className="px-3 py-2 text-sm font-semibold">Bağlı faturalar</h2>
          <ul className="space-y-1 px-3 pb-3 text-sm">
            {receipt.purchaseInvoices.map((inv) => (
              <li key={inv.id}>
                <Link href={`/satin-alma/faturalar/${inv.id}`} className="font-medium text-primary">
                  {inv.number}
                </Link>
                <span className="text-muted-foreground"> · {formatDate(inv.date)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
      {receipt.notes ? <p className="mt-3 text-sm text-muted-foreground">{receipt.notes}</p> : null}
    </div>
  );
}

function Info({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="rounded-xl bg-card px-3 py-2 ring-1 ring-foreground/10">
      <p className="text-xs text-muted-foreground">{label}</p>
      {href ? (
        <Link href={href} className="font-medium text-primary">
          {value}
        </Link>
      ) : (
        <p className="font-medium">{value}</p>
      )}
    </div>
  );
}
