import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ErrorNote,
  LinesTable,
  LinkButton,
  Money,
  PageHeader,
  Panel,
  StatusBadge,
  TotalBox,
} from "@/components/erp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { startOfToday, todayInput } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { invoiceStatusLabel, paymentMethodLabel } from "@/lib/labels";
import { returnPurchaseInvoiceAction } from "@/server/actions";
import { getPurchaseInvoice } from "@/server/queries";

export const metadata = { title: "Alış faturası" };

export default async function PurchaseInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ hata?: string }>;
}) {
  const { id } = await params;
  const { hata } = await searchParams;
  const invoice = await getPurchaseInvoice(id);
  if (!invoice) notFound();
  const remaining = invoice.total - invoice.paidAmount;
  const overdue =
    (invoice.status === "OPEN" || invoice.status === "PARTIAL") &&
    invoice.dueDate < startOfToday();
  const canReturn =
    !invoice.isReturn && invoice.status !== "CANCELLED" && invoice.returns.length === 0;
  return (
    <div>
      <PageHeader
        eyebrow={invoice.isReturn ? "Alış iadesi" : "Alış faturası"}
        title={invoice.number}
        description={`${invoice.party.name}${invoice.warehouse ? ` · ${invoice.warehouse.name}` : ""}`}
        actions={
          <>
            <StatusBadge code={invoice.status} label={invoiceStatusLabel[invoice.status]} />
            {overdue ? <StatusBadge code="LOW" label="Vadesi geçmiş" /> : null}
            {remaining > 0 && invoice.status !== "CANCELLED" && !invoice.isReturn ? (
              <LinkButton href="/odeme/yeni">Ödeme</LinkButton>
            ) : null}
            {invoice.goodsReceiptId ? (
              <LinkButton href={`/satin-alma/mal-kabul/${invoice.goodsReceiptId}`} variant="outline">
                Mal kabul
              </LinkButton>
            ) : null}
          </>
        }
      />
      <ErrorNote message={hata} />
      <div className="mb-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <Info label="Tedarikçi" value={invoice.party.name} href={`/cariler/${invoice.partyId}`} />
        <Info label="Mal kabul" value={invoice.receiptNumber || "—"} />
        <Info label="Fatura tarihi" value={formatDate(invoice.date)} />
        <Info label="Vade" value={formatDate(invoice.dueDate)} />
      </div>
      <Panel>
        <LinesTable
          showVat
          lines={invoice.lines.map((line) => ({
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
        <TotalBox
          subtotal={invoice.subtotal}
          vatTotal={invoice.vatTotal}
          total={invoice.total}
          paid={invoice.isReturn ? undefined : invoice.paidAmount}
        />
      </Panel>
      {canReturn ? (
        <Panel className="mt-4 p-3">
          <h2 className="mb-1 text-sm font-semibold">İade faturası</h2>
          <p className="mb-2 text-sm text-muted-foreground">
            İade stoku düşürür ve tedarikçi bakiyesini azaltır.
          </p>
          <form action={returnPurchaseInvoiceAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="id" value={invoice.id} />
            <label className="grid gap-1 text-xs">
              <span>Tarih</span>
              <Input type="date" name="date" defaultValue={todayInput()} required className="w-40" />
            </label>
            <label className="grid gap-1 text-xs">
              <span>Not</span>
              <Input name="notes" className="w-56" />
            </label>
            <Button type="submit" size="sm" variant="outline">
              İade oluştur
            </Button>
          </form>
        </Panel>
      ) : null}
      {invoice.returns.length > 0 ? (
        <Panel className="mt-4">
          <h2 className="px-3 py-2 text-sm font-semibold">İadeler</h2>
          <ul className="space-y-1 px-3 pb-3 text-sm">
            {invoice.returns.map((ret) => (
              <li key={ret.id}>
                <Link href={`/satin-alma/faturalar/${ret.id}`} className="font-medium text-primary">
                  {ret.number}
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
      <Panel className="mt-4">
        <h2 className="px-3 py-2 text-sm font-semibold">Ödemeler</h2>
        {invoice.allocations.length === 0 ? (
          <p className="px-3 pb-3 text-sm text-muted-foreground">Bu faturaya ödeme işlenmedi.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fiş</TableHead>
                <TableHead>Tarih</TableHead>
                <TableHead>Yöntem</TableHead>
                <TableHead className="text-right">Tutar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.allocations.map((allocation) => (
                <TableRow key={allocation.id}>
                  <TableCell>
                    <Link href={`/odeme/${allocation.paymentId}`} className="font-medium text-primary">
                      {allocation.payment.number}
                    </Link>
                  </TableCell>
                  <TableCell>{formatDate(allocation.payment.date)}</TableCell>
                  <TableCell>{paymentMethodLabel[allocation.payment.method]}</TableCell>
                  <TableCell className="text-right">
                    <Money value={allocation.amount} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>
      {invoice.notes ? <p className="mt-3 text-sm text-muted-foreground">{invoice.notes}</p> : null}
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
