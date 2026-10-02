import Link from "next/link";
import { EmptyState, LinkButton, Money, PageHeader, Panel } from "@/components/erp";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { paymentMethodLabel } from "@/lib/labels";
import { listPayments } from "@/server/queries";

export const metadata = { title: "Ödeme" };

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const payments = (await listPayments("SUPPLIER_PAYMENT")).filter((payment) => {
    if (!q.trim()) return true;
    const needle = q.trim().toLowerCase();
    return (
      payment.number.toLowerCase().includes(needle) ||
      payment.party.name.toLowerCase().includes(needle) ||
      payment.party.code.toLowerCase().includes(needle)
    );
  });
  return (
    <div>
      <PageHeader
        title="Ödeme"
        description="Tedarikçiye giden para açık alış faturalarına dağıtılır ve borcu düşürür."
        actions={<LinkButton href="/odeme/yeni">Yeni ödeme</LinkButton>}
      />
      <form className="mb-3 flex gap-2" method="get">
        <input
          name="q"
          defaultValue={q}
          placeholder="Fiş veya tedarikçi"
          className="h-8 w-56 rounded-lg border border-input bg-card px-2.5 text-sm"
        />
        <button type="submit" className="h-8 rounded-lg bg-secondary px-3 text-sm">
          Süz
        </button>
      </form>
      {payments.length === 0 ? (
        <EmptyState title="Ödeme yok." action={<LinkButton href="/odeme/yeni">Yeni ödeme</LinkButton>} />
      ) : (
        <Panel>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fiş</TableHead>
                <TableHead>Tarih</TableHead>
                <TableHead>Tedarikçi</TableHead>
                <TableHead>Yöntem</TableHead>
                <TableHead className="text-right">Tutar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>
                    <Link href={`/odeme/${payment.id}`} className="font-medium text-primary">
                      {payment.number}
                    </Link>
                  </TableCell>
                  <TableCell>{formatDate(payment.date)}</TableCell>
                  <TableCell>{payment.party.name}</TableCell>
                  <TableCell>{paymentMethodLabel[payment.method]}</TableCell>
                  <TableCell className="text-right">
                    <Money value={payment.amount} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      )}
    </div>
  );
}
