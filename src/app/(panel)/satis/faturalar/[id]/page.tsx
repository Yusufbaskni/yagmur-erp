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
import { PostButton } from "@/components/forms";
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
import { todayInput } from "@/lib/dates";
import { startOfToday } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { invoiceStatusLabel, paymentMethodLabel } from "@/lib/labels";
import {
  cancelSalesInvoiceAction,
  createEInvoiceAction,
  returnSalesInvoiceAction,
} from "@/server/actions";
import { getSalesInvoice } from "@/server/queries";

export const metadata = { title: "Satış faturası" };

export default async function InvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ hata?: string }>;
}) {
  const { id } = await params;
  const { hata } = await searchParams;
  const invoice = await getSalesInvoice(id);
  if (!invoice) notFound();
  const remaining = invoice.total - invoice.paidAmount;
  const overdue =
    (invoice.status === "OPEN" || invoice.status === "PARTIAL") &&
    invoice.dueDate < startOfToday();
  return (
    <div>
      <PageHeader
        eyebrow={invoice.isReturn ? "Satış iadesi" : "Satış faturası"}
        title={invoice.number}
        description={`${formatDate(invoice.date)} · ${invoice.party.name}`}
        actions={
          <>
            <StatusBadge code={invoice.status} label={invoiceStatusLabel[invoice.status]} />
            {overdue ? <StatusBadge code="LOW" label="Vadesi geçmiş" /> : null}
            {invoice.status === "OPEN" && invoice.paidAmount === 0 && !invoice.isReturn ? (
              <PostButton
                action={cancelSalesInvoiceAction}
                id={invoice.id}
                label="Faturayı iptal et"
                variant="outline"
              />
            ) : null}
            {remaining > 0 && !invoice.isReturn ? (
              <LinkButton href="/tahsilat/yeni">Tahsilat</LinkButton>
            ) : null}
          </>
        }
      />
      <ErrorNote message={hata} />
      <div className="mb-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <Info label="Müşteri" value={invoice.party.name} href={`/cariler/${invoice.partyId}`} />
        <Info
          label="Sipariş"
          value={invoice.orderNumber}
          href={invoice.salesOrderId ? `/satis/${invoice.salesOrderId}` : undefined}
        />
        <Info label="Depo" value={invoice.warehouse.name} />
        <Info label="Vade" value={formatDate(invoice.dueDate)} />
      </div>
      {!invoice.isReturn && invoice.status !== "CANCELLED" ? (
        <div className="mb-4 grid gap-3 md:grid-cols-2">
          <Panel className="p-3">
            <h2 className="mb-1 text-sm font-semibold">İade</h2>
            <form action={returnSalesInvoiceAction} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="id" value={invoice.id} />
              <label className="grid gap-1 text-xs">
                <span>Tarih</span>
                <Input type="date" name="date" defaultValue={todayInput()} className="w-40" required />
              </label>
              <Button type="submit" variant="outline">
                İade faturası
              </Button>
            </form>
          </Panel>
          <Panel className="p-3">
            <h2 className="mb-1 text-sm font-semibold">e-Fatura (sandbox)</h2>
            {invoice.eInvoices[0] ? (
              <LinkButton href={`/e-fatura/${invoice.eInvoices[0].id}`} variant="secondary">
                {invoice.eInvoices[0].number}
              </LinkButton>
            ) : (
              <form action={createEInvoiceAction}>
                <input type="hidden" name="salesInvoiceId" value={invoice.id} />
                <Button type="submit" variant="outline" size="sm">
                  UBL taslağı oluştur
                </Button>
              </form>
            )}
          </Panel>
        </div>
      ) : null}
      <Panel>
        <LinesTable
          lines={invoice.lines.map((line) => ({
            id: line.id,
            sku: line.product.sku,
            name: line.product.name,
            unit: line.product.unit,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            lineTotal: line.lineTotal,
          }))}
        />
        <div className="grid gap-2 border-t px-3 py-3 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Ara toplam (KDV hariç)</p>
            <Money value={invoice.subtotal} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">KDV</p>
            <Money value={invoice.vatTotal} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Genel toplam</p>
            <Money value={invoice.total} />
          </div>
        </div>
        <TotalBox total={invoice.total} paid={invoice.paidAmount} />
      </Panel>
      <Panel className="mt-4">
        <h2 className="px-3 py-2 text-sm font-semibold">Tahsilatlar</h2>
        {invoice.allocations.length === 0 ? (
          <p className="px-3 pb-3 text-sm text-muted-foreground">Tahsilat yok.</p>
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
                    <Link href={`/tahsilat/${allocation.paymentId}`} className="font-medium text-primary">
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
