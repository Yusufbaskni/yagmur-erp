import Link from "next/link";
import { ErrorNote, LinkButton, Money, PageHeader, Panel, Qty, StatusBadge } from "@/components/erp";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { invoiceStatusLabel } from "@/lib/labels";
import { getDashboard } from "@/server/queries";

export const metadata = { title: "Panel" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ hata?: string }>;
}) {
  const { hata } = await searchParams;
  const data = await getDashboard();
  return (
    <div>
      <PageHeader
        eyebrow="Bugün"
        title="Operasyon paneli"
        description="Açık satışlar, vadesi gelen alacak ve stoğu azalan ürünler."
        actions={<LinkButton href="/satis/yeni">Yeni satış siparişi</LinkButton>}
      />
      <ErrorNote message={hata} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Açık faturalar" value={data.openAmount} hint={`${data.openCount} belge`} href="/satis/faturalar?durum=ACIK" />
        <Kpi label="Vadesi geçmiş" value={data.overdueAmount} hint={`${data.overdueCount} fatura`} href="/satis/faturalar?durum=ACIK" />
        <Kpi label="Tedarikçi borcu" value={data.payableAmount} hint="Açık alış faturaları" href="/satin-alma/faturalar?durum=ACIK" />
        <Kpi label="Düşük stok" value={data.lowStock.length} money={false} hint="Asgari stok ve altı" href="/urunler" />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel>
          <div className="flex items-center justify-between px-3 py-2">
            <h2 className="text-sm font-semibold">Son satışlar</h2>
            <Link href="/satis/faturalar" className="text-xs text-primary">
              Tümü
            </Link>
          </div>
          <DocTable
            rows={data.recentInvoices.map((invoice) => ({
              href: `/satis/faturalar/${invoice.id}`,
              number: invoice.number,
              party: invoice.party.name,
              date: invoice.date,
              status: invoice.status,
              label: invoiceStatusLabel[invoice.status],
              amount: invoice.total,
            }))}
            empty="Henüz satış faturası yok."
          />
        </Panel>
        <Panel>
          <div className="flex items-center justify-between px-3 py-2">
            <h2 className="text-sm font-semibold">Son alış faturaları</h2>
            <Link href="/satin-alma/faturalar" className="text-xs text-primary">
              Tümü
            </Link>
          </div>
          <DocTable
            rows={data.recentReceipts.map((invoice) => ({
              href: `/satin-alma/faturalar/${invoice.id}`,
              number: invoice.number,
              party: invoice.party.name,
              date: invoice.date,
              status: invoice.status,
              label: invoiceStatusLabel[invoice.status],
              amount: invoice.total,
            }))}
            empty="Henüz alış faturası yok."
          />
        </Panel>
      </div>
      <Panel className="mt-4">
        <div className="px-3 py-2">
          <h2 className="text-sm font-semibold">Düşük stok</h2>
        </div>
        {data.lowStock.length === 0 ? (
          <p className="px-3 pb-4 text-sm text-muted-foreground">Asgari stokun altında ürün yok.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Ürün</TableHead>
                <TableHead className="text-right">Elde</TableHead>
                <TableHead className="text-right">Asgari</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.lowStock.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <Link href={`/urunler/${product.id}`} className="font-medium text-primary">
                      {product.sku}
                    </Link>
                  </TableCell>
                  <TableCell>{product.name}</TableCell>
                  <TableCell className="text-right">
                    <Qty value={product.stockOnHand} unit={product.unit} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Qty value={product.minStock} unit={product.unit} />
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

function Kpi({
  label,
  value,
  hint,
  href,
  money = true,
}: {
  label: string;
  value: number;
  hint: string;
  href: string;
  money?: boolean;
}) {
  return (
    <Link href={href} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 hover:ring-primary/40">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">
        {money ? <Money value={value} /> : value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </Link>
  );
}

function DocTable({
  rows,
  empty,
}: {
  rows: {
    href: string;
    number: string;
    party: string;
    date: Date;
    status: string;
    label: string;
    amount: number;
  }[];
  empty: string;
}) {
  if (rows.length === 0) return <p className="px-3 pb-4 text-sm text-muted-foreground">{empty}</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Belge</TableHead>
          <TableHead>Cari</TableHead>
          <TableHead>Durum</TableHead>
          <TableHead className="text-right">Tutar</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.href}>
            <TableCell>
              <Link href={row.href} className="font-medium text-primary">
                {row.number}
              </Link>
              <p className="text-xs text-muted-foreground">{formatDate(row.date)}</p>
            </TableCell>
            <TableCell className="max-w-40 truncate">{row.party}</TableCell>
            <TableCell>
              <StatusBadge code={row.status} label={row.label} />
            </TableCell>
            <TableCell className="text-right">
              <Money value={row.amount} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
