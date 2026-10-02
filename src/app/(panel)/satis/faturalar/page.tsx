import Link from "next/link";
import { EmptyState, Money, PageHeader, Panel, StatusBadge } from "@/components/erp";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { startOfToday } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { invoiceStatusLabel } from "@/lib/labels";
import { listSalesInvoices } from "@/server/queries";

export const metadata = { title: "Satış faturaları" };

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ durum?: string }>;
}) {
  const { durum = "" } = await searchParams;
  const invoices = await listSalesInvoices({ durum });
  const today = startOfToday();
  return (
    <div>
      <PageHeader
        title="Satış faturaları"
        description="Açık faturalar müşteri alacağıdır. Tahsilat kalan tutarı düşürür."
      />
      <form className="mb-3 flex flex-wrap gap-2" method="get">
        <select name="durum" defaultValue={durum} className="h-8 rounded-lg border border-input bg-card px-2 text-sm">
          <option value="">Tümü</option>
          <option value="ACIK">Açık ve kısmi</option>
          <option value="ODENDI">Ödendi</option>
          <option value="IPTAL">İptal</option>
          <option value="IADE">İade</option>
        </select>
        <Button type="submit" size="sm" variant="secondary">
          Süz
        </Button>
      </form>
      {invoices.length === 0 ? (
        <EmptyState title="Fatura yok. Onaylı bir satış siparişini faturalayın." />
      ) : (
        <Panel>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No</TableHead>
                <TableHead>Müşteri</TableHead>
                <TableHead>Vade</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead className="text-right">Toplam</TableHead>
                <TableHead className="text-right">Kalan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => {
                const remaining = invoice.total - invoice.paidAmount;
                const overdue =
                  (invoice.status === "OPEN" || invoice.status === "PARTIAL") &&
                  invoice.dueDate < today;
                return (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      <Link href={`/satis/faturalar/${invoice.id}`} className="font-medium text-primary">
                        {invoice.number}
                      </Link>
                      <p className="text-xs text-muted-foreground">{formatDate(invoice.date)}</p>
                    </TableCell>
                    <TableCell>{invoice.party.name}</TableCell>
                    <TableCell>
                      {formatDate(invoice.dueDate)}
                      {overdue ? <p className="text-xs text-destructive">Vadesi geçti</p> : null}
                    </TableCell>
                    <TableCell>
                      <StatusBadge code={invoice.status} label={invoiceStatusLabel[invoice.status]} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={invoice.total} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={remaining} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Panel>
      )}
    </div>
  );
}
