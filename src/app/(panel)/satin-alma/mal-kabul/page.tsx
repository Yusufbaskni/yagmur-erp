import Link from "next/link";
import { EmptyState, Money, PageHeader, Panel, StatusBadge } from "@/components/erp";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { receiptStatusLabel } from "@/lib/labels";
import { listGoodsReceipts } from "@/server/queries";

export const metadata = { title: "Mal kabul" };

export default async function ReceiptsPage() {
  const receipts = await listGoodsReceipts();
  return (
    <div>
      <PageHeader
        title="Mal kabul"
        description="Kabul stoku artırır. Tedarikçi borcu alış faturası ile açılır."
      />
      {receipts.length === 0 ? (
        <EmptyState title="Mal kabul yok." />
      ) : (
        <Panel>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No</TableHead>
                <TableHead>Tedarikçi</TableHead>
                <TableHead>Depo</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Fatura</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receipts.map((receipt) => {
                const invoice = receipt.purchaseInvoices.find(
                  (inv) => !inv.isReturn && inv.status !== "CANCELLED",
                );
                const total = receipt.purchaseInvoices[0]?.total;
                return (
                  <TableRow key={receipt.id}>
                    <TableCell>
                      <Link href={`/satin-alma/mal-kabul/${receipt.id}`} className="font-medium text-primary">
                        {receipt.number}
                      </Link>
                      <p className="text-xs text-muted-foreground">{formatDate(receipt.date)}</p>
                    </TableCell>
                    <TableCell>{receipt.party.name}</TableCell>
                    <TableCell>
                      {receipt.warehouse ? `${receipt.warehouse.code}` : "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge code={receipt.status} label={receiptStatusLabel[receipt.status]} />
                    </TableCell>
                    <TableCell>
                      {invoice ? (
                        <Link href={`/satin-alma/faturalar/${invoice.id}`} className="text-primary">
                          {invoice.number}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">Bekliyor</span>
                      )}
                      {total !== undefined ? (
                        <p className="text-xs text-muted-foreground">
                          <Money value={total} />
                        </p>
                      ) : null}
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
