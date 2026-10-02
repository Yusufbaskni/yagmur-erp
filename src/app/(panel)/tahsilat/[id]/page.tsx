import Link from "next/link";
import { notFound } from "next/navigation";
import { Money, PageHeader, Panel } from "@/components/erp";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatMoney } from "@/lib/format";
import { paymentMethodLabel } from "@/lib/labels";
import { getPayment } from "@/server/queries";

export const metadata = { title: "Tahsilat" };

export default async function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const payment = await getPayment(id);
  if (!payment || payment.type !== "COLLECTION") notFound();
  return (
    <div>
      <PageHeader
        eyebrow="Tahsilat"
        title={payment.number}
        description={`${formatDate(payment.date)} · ${paymentMethodLabel[payment.method]} · ${formatMoney(payment.amount)}`}
      />
      <p className="mb-4 text-sm">
        <Link href={`/cariler/${payment.partyId}`} className="font-medium text-primary">
          {payment.party.code} · {payment.party.name}
        </Link>
      </p>
      <Panel>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fatura</TableHead>
              <TableHead className="text-right">Uygulanan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payment.allocations.map((allocation) => (
              <TableRow key={allocation.id}>
                <TableCell>
                  {allocation.salesInvoice ? (
                    <Link href={`/satis/faturalar/${allocation.salesInvoiceId}`} className="font-medium text-primary">
                      {allocation.salesInvoice.number}
                    </Link>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Money value={allocation.amount} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
      {payment.notes ? <p className="mt-3 text-sm text-muted-foreground">{payment.notes}</p> : null}
    </div>
  );
}
