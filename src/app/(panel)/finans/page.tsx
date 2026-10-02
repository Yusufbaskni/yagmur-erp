import Link from "next/link";
import { Money, PageHeader, Panel } from "@/components/erp";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getFinanceSummary, listPurchaseInvoices, listSalesInvoices } from "@/server/queries";
import { formatDate } from "@/lib/format";
import { invoiceStatusLabel } from "@/lib/labels";
import { StatusBadge } from "@/components/erp";
import { startOfToday } from "@/lib/dates";

export const metadata = { title: "Finans özeti" };

export default async function FinancePage() {
  const [data, openSales, openPurchases] = await Promise.all([
    getFinanceSummary(),
    listSalesInvoices({ durum: "ACIK" }),
    listPurchaseInvoices({ durum: "ACIK" }),
  ]);
  const today = startOfToday();
  return (
    <div>
      <PageHeader
        title="Finans özeti"
        description="Alacak, borç, tahsilat/ödeme ve kasa bakiyesi. Bu ekran genel muhasebe defteri değildir."
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi label="Alacaklar" value={data.receivable} hint="Açık satış faturaları" />
        <Kpi label="Borçlar" value={data.payable} hint="Açık alış faturaları" />
        <Kpi label="Tahsilat" value={data.collections} hint="Toplam tahsilat" />
        <Kpi label="Ödeme" value={data.payments} hint="Toplam tedarikçi ödemesi" />
        <Kpi label="Kasa / banka" value={data.cashBalance} hint="Hesap bakiyeleri" />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <OpenList
          title="Açık alacaklar"
          rows={openSales.map((invoice) => ({
            id: invoice.id,
            href: `/satis/faturalar/${invoice.id}`,
            number: invoice.number,
            party: invoice.party.name,
            due: invoice.dueDate,
            status: invoice.status,
            remaining: invoice.total - invoice.paidAmount,
            overdue: invoice.dueDate < today,
          }))}
        />
        <OpenList
          title="Açık borçlar"
          rows={openPurchases.map((invoice) => ({
            id: invoice.id,
            href: `/satin-alma/faturalar/${invoice.id}`,
            number: invoice.number,
            party: invoice.party.name,
            due: invoice.dueDate,
            status: invoice.status,
            remaining: invoice.total - invoice.paidAmount,
            overdue: invoice.dueDate < today,
          }))}
        />
      </div>
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-2 text-2xl font-semibold">
        <Money value={value} />
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function OpenList({
  title,
  rows,
}: {
  title: string;
  rows: {
    id: string;
    href: string;
    number: string;
    party: string;
    due: Date;
    status: "OPEN" | "PARTIAL" | "PAID" | "CANCELLED";
    remaining: number;
    overdue: boolean;
  }[];
}) {
  return (
    <Panel>
      <h2 className="px-3 py-2 text-sm font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="px-3 pb-3 text-sm text-muted-foreground">Açık belge yok.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Belge</TableHead>
              <TableHead>Vade</TableHead>
              <TableHead className="text-right">Kalan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <Link href={row.href} className="font-medium text-primary">
                    {row.number}
                  </Link>
                  <p className="text-xs text-muted-foreground">{row.party}</p>
                </TableCell>
                <TableCell>
                  {formatDate(row.due)}
                  <div className="mt-1">
                    <StatusBadge code={row.status} label={invoiceStatusLabel[row.status]} />
                  </div>
                  {row.overdue ? <p className="text-xs text-destructive">Vadesi geçti</p> : null}
                </TableCell>
                <TableCell className="text-right">
                  <Money value={row.remaining} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Panel>
  );
}
